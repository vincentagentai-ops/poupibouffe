// Catalogue modifiable : les recettes de base (src/recettes.js) plus les modifications faites depuis le site,
// enregistrées sur le serveur sous la forme { id: recette } (null = recette supprimée).
// Partagé par le navigateur et le serveur.
import { RAYONS } from "./recettes.js";

// Recettes de base remplacées ou supprimées, puis recettes ajoutées, triées par nom.
export function fusionner(base, modifs = {}) {
  const ids = new Set(base.map(r => r.id));
  const liste = base.flatMap(r => (r.id in modifs ? (modifs[r.id] ? [modifs[r.id]] : []) : [r]));
  const ajoutees = Object.entries(modifs).filter(([id, r]) => r && !ids.has(id)).map(([, r]) => r);
  return [...liste, ...ajoutees.sort((a, b) => a.nom.localeCompare(b.nom, "fr"))];
}

const texte = (v, max, min = 0) => (typeof v === "string" && v.trim().length >= min && v.length <= max ? v.trim() : null);
export const ID_VALIDE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO_VALIDE = /^\/photos\/[a-z0-9-]+\.(?:jpg|png|webp)(?:\?v=\d+)?$/;

// Renvoie une recette propre, ou null si quelque chose ne va pas.
export function validerRecette(r) {
  if (!r || typeof r !== "object") return null;
  const id = typeof r.id === "string" && r.id.length <= 60 && ID_VALIDE.test(r.id) ? r.id : null;
  const nom = texte(r.nom, 120, 1);
  const astuce = texte(r.astuce ?? "", 300);
  const temps = Number.isInteger(r.temps) && r.temps > 0 && r.temps <= 1440 ? r.temps : null;
  if (!id || !nom || astuce === null || !temps) return null;
  if (!Array.isArray(r.tags) || r.tags.length > 8) return null;
  const tags = r.tags.map(t => texte(t, 20, 1));
  if (tags.includes(null)) return null;
  if (!Array.isArray(r.ing) || r.ing.length < 1 || r.ing.length > 40) return null;
  const ing = [];
  for (const ligne of r.ing) {
    if (!Array.isArray(ligne) || ligne.length !== 4) return null;
    const [q, unite, nomIng, rayon] = ligne;
    if (q !== null && !(typeof q === "number" && q > 0 && q < 100000)) return null;
    const u = texte(unite, 12), n = texte(nomIng, 60, 1);
    if (u === null || !n || !RAYONS.includes(rayon)) return null;
    ing.push([q, u, n, rayon]);
  }
  if (!Array.isArray(r.etapes) || r.etapes.length < 1 || r.etapes.length > 30) return null;
  const etapes = r.etapes.map(e => texte(e, 600, 1));
  if (etapes.includes(null)) return null;
  const propre = { id, nom, temps, tags, astuce, ing, etapes };
  if (r.photo != null) {
    if (typeof r.photo !== "string" || !PHOTO_VALIDE.test(r.photo)) return null;
    propre.photo = r.photo;
  }
  return propre;
}

// Identifiant lisible tiré du nom, rendu unique dans le catalogue : « Gratin de blettes » → « gratin-de-blettes ».
export function nouvelId(nom, existants) {
  const base = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "recette";
  let id = base, n = 2;
  while (existants.has(id)) id = `${base}-${n++}`;
  return id;
}
