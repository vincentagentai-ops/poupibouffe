// Serveur Poupibouffe pour le réseau de la maison : sert le site construit (dist/),
// garde le menu de la semaine dans data/etat.json et les recettes modifiées depuis le site
// dans data/recettes.json (+ leurs photos dans data/photos/), partagés par tous les appareils.
// Sans dépendance : `npm run build` puis `npm start`.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RECETTES } from "./src/recettes.js";
import { fusionner, validerRecette, ID_VALIDE } from "./src/catalogue.js";

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(RACINE, "dist");
const DATA = path.join(RACINE, "data");
const FICHIER_ETAT = path.join(DATA, "etat.json");
const FICHIER_RECETTES = path.join(DATA, "recettes.json");
const PHOTOS = path.join(DATA, "photos");
const PORT = Number(process.env.PORT) || 8420;
const HOTE = process.env.HOST || "0.0.0.0";
const TAILLE_MAX = 32 * 1024;
const TAILLE_RECETTE = 64 * 1024;
const TAILLE_PHOTO = 6 * 1024 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};
const IDS_BASE = new Set(RECETTES.map(r => r.id));

async function lireJson(fichier) {
  try { return JSON.parse(await fs.readFile(fichier, "utf8")); } catch { return null; }
}
// Écriture atomique : fichier temporaire puis renommage, pour ne jamais laisser un fichier à moitié écrit.
async function ecrire(fichier, contenu) {
  await fs.mkdir(path.dirname(fichier), { recursive: true });
  const tmp = fichier + ".tmp";
  await fs.writeFile(tmp, contenu);
  await fs.rename(tmp, fichier);
}

const lireModifs = async () => (await lireJson(FICHIER_RECETTES))?.modifs ?? {};
const ecrireModifs = modifs => ecrire(FICHIER_RECETTES, JSON.stringify({ modifs, majLe: new Date().toISOString() }, null, 2));
const idsCatalogue = async () => new Set(fusionner(RECETTES, await lireModifs()).map(r => r.id));

// N'accepte qu'un état cohérent : 7 recettes du catalogue, 1 à 10 couverts, des cases cochées courtes.
function valider(etat, ids) {
  if (!etat || typeof etat !== "object") return null;
  const { semaine, couverts, coches } = etat;
  if (!Array.isArray(semaine) || semaine.length !== 7 || !semaine.every(id => ids.has(id))) return null;
  if (!Number.isInteger(couverts) || couverts < 1 || couverts > 10) return null;
  if (!coches || typeof coches !== "object" || Array.isArray(coches)) return null;
  const propres = {};
  for (const [cle, v] of Object.entries(coches).slice(0, 300)) if (v === true && cle.length <= 80) propres[cle] = true;
  return { semaine, couverts, coches: propres };
}

function envoyer(res, statut, corps, type = "application/json; charset=utf-8") {
  res.writeHead(statut, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(typeof corps === "string" || Buffer.isBuffer(corps) ? corps : JSON.stringify(corps));
}
const nonAutorise = (res, methodes) => { res.setHeader("Allow", methodes); return envoyer(res, 405, { erreur: "Méthode non autorisée" }); };

// Corps de la requête, ou null s'il dépasse la taille permise.
async function lireCorps(req, max) {
  const morceaux = [];
  let taille = 0;
  for await (const m of req) {
    taille += m.length;
    if (taille > max) return null;
    morceaux.push(m);
  }
  return Buffer.concat(morceaux);
}

async function apiEtat(req, res) {
  if (req.method === "GET") {
    const etat = await lireJson(FICHIER_ETAT);
    return etat ? envoyer(res, 200, etat) : envoyer(res, 404, { erreur: "Aucun menu enregistré" });
  }
  if (req.method === "PUT") {
    const corps = await lireCorps(req, TAILLE_MAX);
    if (!corps) return envoyer(res, 413, { erreur: "Requête trop volumineuse" });
    let etat;
    try { etat = valider(JSON.parse(corps), await idsCatalogue()); } catch { etat = null; }
    if (!etat) return envoyer(res, 400, { erreur: "Menu invalide" });
    await ecrire(FICHIER_ETAT, JSON.stringify({ ...etat, majLe: new Date().toISOString() }, null, 2));
    return envoyer(res, 200, { ok: true });
  }
  return nonAutorise(res, "GET, PUT");
}

// GET /api/recettes → { modifs } ; PUT /api/recettes/<id> enregistre une recette ;
// DELETE /api/recettes/<id> la supprime, ou rétablit l'originale avec ?retablir.
async function apiRecettes(req, res, url) {
  const id = url.pathname.slice("/api/recettes".length).replace(/^\//, "");
  if (!id) return req.method === "GET" ? envoyer(res, 200, { modifs: await lireModifs() }) : nonAutorise(res, "GET");
  if (!ID_VALIDE.test(id) || id.length > 60) return envoyer(res, 400, { erreur: "Identifiant invalide" });
  const modifs = await lireModifs();
  if (req.method === "PUT") {
    const corps = await lireCorps(req, TAILLE_RECETTE);
    if (!corps) return envoyer(res, 413, { erreur: "Recette trop volumineuse" });
    let recette;
    try { recette = validerRecette(JSON.parse(corps)); } catch { recette = null; }
    if (!recette || recette.id !== id) return envoyer(res, 400, { erreur: "Recette invalide" });
    modifs[id] = recette;
  } else if (req.method === "DELETE") {
    if (url.searchParams.has("retablir") || !IDS_BASE.has(id)) delete modifs[id];
    else modifs[id] = null;
  } else return nonAutorise(res, "PUT, DELETE");
  await ecrireModifs(modifs);
  return envoyer(res, 200, { ok: true, modifs });
}

// PUT /api/photos/<id> : image JPEG, PNG ou WebP, reconnue à ses premiers octets.
function typeImage(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ".jpg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return ".webp";
  return null;
}
async function apiPhotos(req, res, url) {
  if (req.method !== "PUT") return nonAutorise(res, "PUT");
  const id = url.pathname.slice("/api/photos/".length);
  if (!ID_VALIDE.test(id) || id.length > 60) return envoyer(res, 400, { erreur: "Identifiant invalide" });
  const corps = await lireCorps(req, TAILLE_PHOTO);
  if (!corps) return envoyer(res, 413, { erreur: "Photo trop lourde (6 Mo au plus)" });
  const ext = corps.length > 12 && typeImage(corps);
  if (!ext) return envoyer(res, 400, { erreur: "Photo JPEG, PNG ou WebP attendue" });
  await fs.mkdir(PHOTOS, { recursive: true });
  for (const autre of [".jpg", ".png", ".webp"]) if (autre !== ext) await fs.rm(path.join(PHOTOS, id + autre), { force: true });
  await ecrire(path.join(PHOTOS, id + ext), corps);
  return envoyer(res, 200, { photo: `/photos/${id}${ext}?v=${Date.now()}` });
}

async function fichier(req, res, url) {
  let chemin;
  try { chemin = decodeURIComponent(url.pathname); } catch { return envoyer(res, 400, "Adresse invalide", TYPES[".txt"]); }
  const [dossier, relatif] = chemin.startsWith("/photos/") ? [PHOTOS, chemin.slice("/photos".length)] : [DIST, chemin === "/" ? "/index.html" : chemin];
  const cible = path.join(dossier, path.normalize(relatif));
  if (!cible.startsWith(dossier + path.sep)) return envoyer(res, 403, "Interdit", TYPES[".txt"]);
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
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/etat") return await apiEtat(req, res);
    if (url.pathname === "/api/recettes" || url.pathname.startsWith("/api/recettes/")) return await apiRecettes(req, res, url);
    if (url.pathname.startsWith("/api/photos/")) return await apiPhotos(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return envoyer(res, 405, "Méthode non autorisée", TYPES[".txt"]);
    return await fichier(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) envoyer(res, 500, { erreur: "Erreur du serveur" });
  }
});

serveur.listen(PORT, HOTE, () => console.log(`Poupibouffe sur http://${HOTE}:${PORT}`));
