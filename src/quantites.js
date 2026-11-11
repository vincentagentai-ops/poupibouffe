// Mise à l'échelle et affichage des quantités. Les recettes sont écrites pour 4 personnes.
export const BASE_COUVERTS = 4;

const INVARIABLES = ["g", "kg", "cl", "c. à s.", "c. à c."];

// Quantité pour `couverts` personnes, arrondie à une valeur qu'on peut mesurer en cuisine.
export function ajuster(q, unite, couverts) {
  if (q == null) return null;
  const v = (q * couverts) / BASE_COUVERTS;
  if (unite === "g") return v >= 100 ? Math.round(v / 10) * 10 : Math.max(5, Math.round(v / 5) * 5);
  if (unite === "kg") return Math.round(v * 20) / 20;
  if (unite === "cl") return Math.max(1, Math.round(v));
  return Math.max(0.5, Math.round(v * 2) / 2);
}

function fraction(v) {
  const entier = Math.floor(v), reste = v - entier;
  const f = reste >= 0.75 ? "¾" : reste >= 0.5 ? "½" : reste >= 0.25 ? "¼" : "";
  if (!f) return String(entier);
  return entier === 0 ? f : `${entier} ${f}`;
}

const libelleUnite = (unite, v) =>
  !unite || INVARIABLES.includes(unite) || v <= 1 || unite.endsWith("s") ? unite : unite + "s";

// « 1,2 kg », « 2 gousses », « ½ », « selon goût »
export function formaterQuantite(q, unite) {
  if (q == null) return "selon goût";
  let v = q, u = unite;
  if (u === "g" && v >= 1000) { v = v / 1000; u = "kg"; }
  const n = u === "kg" ? String(Math.round(v * 100) / 100).replace(".", ",")
    : u === "g" || u === "cl" ? String(v)
    : fraction(v);
  return u ? `${n} ${libelleUnite(u, v)}` : n;
}

// Pluriel des articles comptés à la pièce : « 2 oignons », « 3 poireaux ».
export function nomPiece(nom, nombre) {
  if (nombre <= 1 || /[sx)]$/.test(nom)) return nom;
  return nom.replace(/^(\S+)/, mot => (/[sx]$/.test(mot) ? mot : /eau$/.test(mot) ? mot + "x" : mot + "s"));
}

export function nomIngredient(nom, unite, q, couverts) {
  return !unite && q != null ? nomPiece(nom, (q * couverts) / BASE_COUVERTS) : nom;
}
