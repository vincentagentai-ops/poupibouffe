import "./style.css";
import { RECETTES, RAYONS, PLACARD, SEMAINE_PAR_DEFAUT, recetteParId } from "./recettes.js";
import { ajuster, formaterQuantite, nomIngredient } from "./quantites.js";
import { listeDeCourses } from "./courses.js";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const CLE_LOCALE = "poupibouffe-v1";

// État partagé par toute la maison : enregistré sur le serveur (/api/etat),
// avec une copie dans le navigateur si le serveur ne répond pas.
const etat = { semaine: SEMAINE_PAR_DEFAUT.map(recetteParId), couverts: 4, coches: {}, courant: 0 };

const versJson = () => ({ semaine: etat.semaine.map(r => r.id), couverts: etat.couverts, coches: etat.coches });
function appliquer(donnees) {
  if (!donnees) return false;
  const semaine = Array.isArray(donnees.semaine) ? donnees.semaine.map(recetteParId) : [];
  if (semaine.length !== 7 || semaine.some(r => !r)) return false;
  etat.semaine = semaine;
  etat.couverts = Number.isInteger(donnees.couverts) ? Math.min(10, Math.max(1, donnees.couverts)) : 4;
  etat.coches = donnees.coches && typeof donnees.coches === "object" ? donnees.coches : {};
  return true;
}
const lireLocal = () => { try { return JSON.parse(localStorage.getItem(CLE_LOCALE) || "null"); } catch { return null; } };
const ecrireLocal = v => { try { localStorage.setItem(CLE_LOCALE, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

async function charger() {
  try {
    const rep = await fetch("/api/etat", { cache: "no-store" });
    if (rep.ok && appliquer(await rep.json())) return;
  } catch { /* serveur absent : copie locale */ }
  appliquer(lireLocal());
}
let envoi = null;
function enregistrer() {
  const v = versJson();
  ecrireLocal(v);
  clearTimeout(envoi);
  envoi = setTimeout(() => {
    fetch("/api/etat", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }).catch(() => {});
  }, 250);
}

// Dates : semaine en cours, du lundi au dimanche
const lundi = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
const dateDuJour = i => { const d = new Date(lundi); d.setDate(d.getDate() + i); return d; };
const formaterJour = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

const echapper = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = id => document.getElementById(id);
const personnes = n => `${n} personne${n > 1 ? "s" : ""}`;

function melanger(liste) {
  const l = [...liste];
  for (let k = l.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [l[k], l[j]] = [l[j], l[k]]; }
  return l;
}
const autresRecettes = n => melanger(RECETTES.filter(r => !etat.semaine.some(s => s.id === r.id))).slice(0, n);

// Soirs
const ICONE_CHANGER = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M13 5.5A5.5 5.5 0 0 0 3.2 4M3 10.5A5.5 5.5 0 0 0 12.8 12"/><path d="M3 1.5V4.5H6M13 14.5V11.5H10"/></svg>';
function afficherSoirs() {
  $("days").innerHTML = etat.semaine.map((r, i) => `
    <div class="day" role="button" tabindex="0" data-i="${i}" aria-current="${i === etat.courant}">
      <div class="when"><b>${JOURS[i].slice(0, 3)}.</b><span class="num">${dateDuJour(i).getDate()}</span></div>
      <div class="dish"><b>${echapper(r.nom)}</b>
        <div class="meta"><span class="num">${r.temps} min</span>${r.tags.map(t => `<span class="tag ${t === "végé" ? "veg" : ""}">${echapper(t)}</span>`).join("")}</div>
      </div>
      <button class="swap" data-changer="${i}" aria-label="Changer le menu de ${JOURS[i]}">${ICONE_CHANGER}Changer</button>
    </div>`).join("");
}
$("days").addEventListener("click", e => {
  const bouton = e.target.closest("[data-changer]");
  if (bouton) { const [autre] = autresRecettes(1); if (autre) remplacer(+bouton.dataset.changer, autre); return; }
  const soir = e.target.closest(".day");
  if (soir) choisir(+soir.dataset.i);
});
$("days").addEventListener("keydown", e => {
  const soir = e.target.closest(".day");
  if (soir && e.target === soir && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); choisir(+soir.dataset.i); }
});

function choisir(i) { etat.courant = i; afficherSoirs(); afficherRecette(); }
function remplacer(i, recette) {
  etat.semaine[i] = recette; etat.courant = i; enregistrer();
  toutAfficher();
  document.querySelector(`.day[data-i="${i}"]`)?.classList.add("flash");
}

// Fiche recette
const propositions = {};
function afficherRecette() {
  const i = etat.courant, r = etat.semaine[i];
  if (!propositions[i] || propositions[i].some(a => etat.semaine.some(s => s.id === a.id))) propositions[i] = autresRecettes(3);
  $("recipe").innerHTML = `
    <div class="recipe-head">
      <div class="eyebrow">${JOURS[i]} ${formaterJour(dateDuJour(i))} · dîner</div>
      <h2>${echapper(r.nom)}</h2>
      <p class="blurb">${echapper(r.astuce)}</p>
      <div class="facts"><span>Temps total <b class="num">${r.temps} min</b></span><span>Pour <b class="num">${personnes(etat.couverts)}</b></span><span>${r.tags.map(echapper).join(" · ")}</span></div>
    </div>
    <div class="cols">
      <div><h3>Ingrédients</h3><ul class="ing">${r.ing.map(([q, u, n]) =>
        `<li><span class="q">${echapper(formaterQuantite(ajuster(q, u, etat.couverts), u))}</span><span>${echapper(nomIngredient(n, u, q, etat.couverts))}</span></li>`).join("")}</ul></div>
      <div><h3>Préparation</h3><ol class="steps">${r.etapes.map(s => `<li><span>${echapper(s)}</span></li>`).join("")}</ol></div>
    </div>
    <div class="replace">
      <h3>Remplacer ce dîner par…</h3>
      <div class="alts">${propositions[i].map(a => `<button class="alt" data-autre="${a.id}">${echapper(a.nom)}</button>`).join("")}</div>
    </div>
    <div class="actions">
      <button class="btn" id="printRecipe">Imprimer la recette</button>
    </div>`;
  $("recipe").querySelectorAll("[data-autre]").forEach(b => (b.onclick = () => remplacer(i, recetteParId(b.dataset.autre))));
  $("printRecipe").onclick = () => imprimer("recette");
}

// Liste de courses
function afficherCourses() {
  const liste = listeDeCourses(etat.semaine, etat.couverts);
  $("shopSub").textContent = `Pour ${personnes(etat.couverts)} · 7 dîners · du ${formaterJour(dateDuJour(0))} au ${formaterJour(dateDuJour(6))}`;
  $("printWeek").innerHTML = etat.semaine.map((r, i) => `<li><b>${JOURS[i]}</b> ${echapper(r.nom)}</li>`).join("");
  $("aisles").innerHTML = RAYONS.filter(rayon => liste[rayon]).map(rayon => `
    <div class="aisle ${rayon === PLACARD ? "pantry" : ""}">
      <h3>${rayon === PLACARD ? "Placard · à vérifier" : rayon}<span class="num">${liste[rayon].length}</span></h3>
      ${liste[rayon].map(a => `<label class="item ${etat.coches[a.cle] ? "done" : ""}">
        <input type="checkbox" data-cle="${echapper(a.cle)}" ${etat.coches[a.cle] ? "checked" : ""}>
        <span class="name">${echapper(a.nom)}<span class="for">${a.jours.map(j => JOURS[j].slice(0, 3) + ".").join(" ")}</span></span>
        <span class="q">${echapper(a.quantite)}</span></label>`).join("")}
    </div>`).join("");
}
$("aisles").addEventListener("change", e => {
  const cle = e.target.dataset.cle; if (!cle) return;
  if (e.target.checked) etat.coches[cle] = true; else delete etat.coches[cle];
  e.target.closest(".item").classList.toggle("done", e.target.checked);
  enregistrer();
});
$("uncheck").onclick = () => { etat.coches = {}; enregistrer(); afficherCourses(); };
$("printList").onclick = () => imprimer("courses");

// Impression : on n'imprime que la partie demandée
function imprimer(partie) {
  document.body.dataset.print = partie;
  window.print();
}
window.addEventListener("afterprint", () => delete document.body.dataset.print);

// Couverts et nouvelle semaine
function changerCouverts(n) { etat.couverts = Math.min(10, Math.max(1, n)); enregistrer(); toutAfficher(); }
$("minus").onclick = () => changerCouverts(etat.couverts - 1);
$("plus").onclick = () => changerCouverts(etat.couverts + 1);
$("newWeek").onclick = () => {
  etat.semaine = melanger(RECETTES).slice(0, 7); etat.coches = {}; etat.courant = 0;
  enregistrer(); toutAfficher();
};

function toutAfficher() {
  $("weekLabel").textContent = `Semaine du ${formaterJour(dateDuJour(0))} au ${formaterJour(dateDuJour(6))}`;
  $("servings").textContent = etat.couverts;
  afficherSoirs(); afficherRecette(); afficherCourses();
}

// Démarrage, puis resynchronisation quand on revient sur l'onglet (un autre appareil a pu changer le menu)
toutAfficher();
charger().then(toutAfficher);
document.addEventListener("visibilitychange", () => { if (!document.hidden) charger().then(toutAfficher); });
