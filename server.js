// Serveur Poupibouffe pour le réseau de la maison : sert le site construit (dist/)
// et garde le menu de la semaine dans data/etat.json, partagé par tous les appareils.
// Sans dépendance : `npm run build` puis `npm start`.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RECETTES } from "./src/recettes.js";

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(RACINE, "dist");
const FICHIER_ETAT = path.join(RACINE, "data", "etat.json");
const PORT = Number(process.env.PORT) || 8420;
const HOTE = process.env.HOST || "0.0.0.0";
const TAILLE_MAX = 32 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};
const IDS = new Set(RECETTES.map(r => r.id));

// N'accepte qu'un état cohérent : 7 recettes connues, 1 à 10 couverts, des cases cochées courtes.
function valider(etat) {
  if (!etat || typeof etat !== "object") return null;
  const { semaine, couverts, coches } = etat;
  if (!Array.isArray(semaine) || semaine.length !== 7 || !semaine.every(id => IDS.has(id))) return null;
  if (!Number.isInteger(couverts) || couverts < 1 || couverts > 10) return null;
  if (!coches || typeof coches !== "object" || Array.isArray(coches)) return null;
  const propres = {};
  for (const [cle, v] of Object.entries(coches).slice(0, 300)) if (v === true && cle.length <= 80) propres[cle] = true;
  return { semaine, couverts, coches: propres };
}

async function lireEtat() {
  try { return JSON.parse(await fs.readFile(FICHIER_ETAT, "utf8")); } catch { return null; }
}
// Écriture atomique : fichier temporaire puis renommage, pour ne jamais laisser un JSON à moitié écrit.
async function ecrireEtat(etat) {
  await fs.mkdir(path.dirname(FICHIER_ETAT), { recursive: true });
  const tmp = FICHIER_ETAT + ".tmp";
  await fs.writeFile(tmp, JSON.stringify({ ...etat, majLe: new Date().toISOString() }, null, 2));
  await fs.rename(tmp, FICHIER_ETAT);
}

function envoyer(res, statut, corps, type = "application/json; charset=utf-8") {
  res.writeHead(statut, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(typeof corps === "string" || Buffer.isBuffer(corps) ? corps : JSON.stringify(corps));
}

async function api(req, res) {
  if (req.method === "GET") {
    const etat = await lireEtat();
    return etat ? envoyer(res, 200, etat) : envoyer(res, 404, { erreur: "Aucun menu enregistré" });
  }
  if (req.method === "PUT") {
    let corps = "";
    for await (const morceau of req) {
      corps += morceau;
      if (corps.length > TAILLE_MAX) return envoyer(res, 413, { erreur: "Requête trop volumineuse" });
    }
    let etat;
    try { etat = valider(JSON.parse(corps)); } catch { etat = null; }
    if (!etat) return envoyer(res, 400, { erreur: "Menu invalide" });
    await ecrireEtat(etat);
    return envoyer(res, 200, { ok: true });
  }
  res.setHeader("Allow", "GET, PUT");
  return envoyer(res, 405, { erreur: "Méthode non autorisée" });
}

async function fichier(req, res) {
  let chemin;
  try { chemin = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { return envoyer(res, 400, "Adresse invalide", TYPES[".txt"]); }
  const cible = path.join(DIST, path.normalize(chemin === "/" ? "/index.html" : chemin));
  if (!cible.startsWith(DIST + path.sep)) return envoyer(res, 403, "Interdit", TYPES[".txt"]);
  try {
    const contenu = await fs.readFile(cible);
    const type = TYPES[path.extname(cible)] || "application/octet-stream";
    const cache = chemin.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : contenu);
  } catch {
    envoyer(res, 404, "Page introuvable", TYPES[".txt"]);
  }
}

const serveur = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/etat")) return await api(req, res);
    if (req.method !== "GET" && req.method !== "HEAD") return envoyer(res, 405, "Méthode non autorisée", TYPES[".txt"]);
    return await fichier(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) envoyer(res, 500, { erreur: "Erreur du serveur" });
  }
});

serveur.listen(PORT, HOTE, () => console.log(`Poupibouffe sur http://${HOTE}:${PORT}`));
