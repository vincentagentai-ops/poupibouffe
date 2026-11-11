import { ajuster, formaterQuantite, nomPiece } from "./quantites.js";
import { RAYONS } from "./recettes.js";

// Liste de courses de la semaine : additionne un même ingrédient sur tous les dîners,
// par unité (« 3 c. à s. + 1 c. à c. » quand deux recettes ne mesurent pas pareil).
// Renvoie { rayon: [{ cle, nom, quantite, jours }] }, rayons et articles triés.
export function listeDeCourses(semaine, couverts) {
  const articles = new Map();
  semaine.forEach((recette, jour) => {
    for (const [q, unite, nom, rayon] of recette.ing) {
      const cle = nom.toLowerCase();
      if (!articles.has(cle)) articles.set(cle, { nom, rayon, unites: new Map(), jours: new Set() });
      const a = articles.get(cle);
      a.jours.add(jour);
      if (q == null) continue;
      const u = unite === "kg" ? "g" : unite;
      const v = unite === "kg" ? q * 1000 : q;
      a.unites.set(u, (a.unites.get(u) || 0) + v);
    }
  });

  const parRayon = {};
  for (const [cle, a] of articles) {
    const parts = [...a.unites].map(([u, q]) => formaterQuantite(ajuster(q, u, couverts), u));
    (parRayon[a.rayon] ||= []).push({
      cle,
      nom: a.unites.has("") ? nomPiece(a.nom, ajuster(a.unites.get(""), "", couverts)) : a.nom,
      quantite: parts.length ? parts.join(" + ") : "selon goût",
      jours: [...a.jours].sort((x, y) => x - y),
    });
  }
  const trie = {};
  for (const rayon of RAYONS) {
    if (parRayon[rayon]) trie[rayon] = parRayon[rayon].sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  }
  return trie;
}
