// Page « Recettes » : chercher dans le catalogue, modifier, ajouter ou supprimer une recette.
import { RAYONS, RECETTES, photo } from "./recettes.js";
import { validerRecette, nouvelId } from "./catalogue.js";

const UNITES = ["", "g", "kg", "cl", "c. à s.", "c. à c.", "gousse", "tranche", "botte", "brin", "cube", "boîte", "feuille", "pincée", "rouleau", "dose"];
const FILTRES = ["végé", "rapide", "poisson", "four", "mijoté", "de saison", "épicé"];
const IDS_BASE = new Set(RECETTES.map(r => r.id));

const echapper = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const simplifier = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").toLowerCase();
const nombre = q => (q == null ? "" : String(q).replace(".", ","));

// Une photo de téléphone pèse plusieurs Mo : on la réduit à 1200 px de large en JPEG avant l'envoi.
async function reduirePhoto(fichier) {
  const image = await createImageBitmap(fichier);
  const echelle = Math.min(1, 1200 / image.width);
  const toile = Object.assign(document.createElement("canvas"), { width: Math.round(image.width * echelle), height: Math.round(image.height * echelle) });
  toile.getContext("2d").drawImage(image, 0, 0, toile.width, toile.height);
  return new Promise(ok => toile.toBlob(ok, "image/jpeg", 0.85));
}

// opts : { racine, dialogue, catalogue(), modifs(), enregistrer(recette), supprimer(id, retablir), envoyerPhoto(id, blob) }
export function pageRecettes(opts) {
  const { racine, dialogue } = opts;
  let recherche = "", filtre = "";

  racine.innerHTML = `
    <div class="lib-head">
      <div>
        <div class="eyebrow" id="libCount"></div>
        <h2>Toutes les recettes</h2>
      </div>
      <div class="shop-actions">
        <button class="btn ghost" id="libRestore" hidden></button>
        <button class="btn" id="libNew">Nouvelle recette</button>
      </div>
    </div>
    <input class="lib-search" id="libSearch" type="search" placeholder="Chercher un plat, un ingrédient…" aria-label="Chercher une recette" autocomplete="off">
    <div class="lib-filters" id="libFilters">${["", ...FILTRES].map(f =>
      `<button class="chip" data-filtre="${echapper(f)}" aria-pressed="${f === ""}">${f || "Toutes"}</button>`).join("")}</div>
    <div class="lib-grid" id="libGrid"></div>`;
  const $ = sel => racine.querySelector(sel);

  function correspond(r) {
    if (filtre && !r.tags.includes(filtre)) return false;
    if (!recherche) return true;
    const texte = simplifier([r.nom, ...r.tags, ...r.ing.map(i => i[2])].join(" "));
    return simplifier(recherche).split(/\s+/).filter(Boolean).every(mot => texte.includes(mot));
  }

  function afficherGrille() {
    const modifs = opts.modifs();
    const liste = opts.catalogue().filter(correspond).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    $("#libCount").textContent = `${liste.length} recette${liste.length > 1 ? "s" : ""} sur ${opts.catalogue().length}`;
    const supprimees = Object.keys(modifs).filter(id => modifs[id] === null);
    $("#libRestore").hidden = !supprimees.length;
    $("#libRestore").textContent = `Rétablir ${supprimees.length > 1 ? `les ${supprimees.length} recettes supprimées` : "la recette supprimée"}`;
    $("#libGrid").innerHTML = liste.length ? liste.map(r => `
      <button class="rcard" data-id="${r.id}">
        <img src="${photo(r)}" alt="" width="800" height="600" loading="lazy">
        <span class="rcard-body"><b>${echapper(r.nom)}</b>
          <span class="meta"><span class="num">${r.temps} min</span>${r.tags.map(t => `<span class="tag ${t === "végé" ? "veg" : ""}">${echapper(t)}</span>`).join("")}
          ${!IDS_BASE.has(r.id) ? '<span class="tag mine">ajoutée</span>' : r.id in modifs ? '<span class="tag mine">modifiée</span>' : ""}</span>
        </span>
      </button>`).join("") : `<p class="hint">Aucune recette ne correspond.</p>`;
  }

  $("#libSearch").addEventListener("input", e => { recherche = e.target.value; afficherGrille(); });
  $("#libFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-filtre]"); if (!b) return;
    filtre = b.dataset.filtre;
    racine.querySelectorAll("[data-filtre]").forEach(x => x.setAttribute("aria-pressed", x === b));
    afficherGrille();
  });
  $("#libGrid").addEventListener("click", e => {
    const carte = e.target.closest("[data-id]");
    if (carte) ouvrir(opts.catalogue().find(r => r.id === carte.dataset.id));
  });
  $("#libNew").onclick = () => ouvrir(null);
  $("#libRestore").onclick = async () => {
    for (const id of Object.keys(opts.modifs()).filter(id => opts.modifs()[id] === null)) await opts.supprimer(id, true).catch(() => {});
  };

  // Éditeur
  const ligneIngredient = ([q, u, n, rayon] = [null, "", "", RAYONS[0]]) => `
    <div class="ing-row">
      <input class="q" inputmode="decimal" value="${echapper(nombre(q))}" placeholder="selon goût" aria-label="Quantité pour 4">
      <input class="u" list="edUnites" value="${echapper(u)}" placeholder="pièce" aria-label="Unité" maxlength="12">
      <input class="n" list="edNoms" value="${echapper(n)}" placeholder="ingrédient" aria-label="Ingrédient" maxlength="60" required>
      <select class="r" aria-label="Rayon">${RAYONS.map(x => `<option ${x === rayon ? "selected" : ""}>${echapper(x)}</option>`).join("")}</select>
      <button type="button" class="round del" aria-label="Retirer cet ingrédient">×</button>
    </div>`;

  function ouvrir(r) {
    const nouvelle = !r;
    const modifiee = r && IDS_BASE.has(r.id) && r.id in opts.modifs();
    let fichierPhoto = null;
    const noms = [...new Set(opts.catalogue().flatMap(x => x.ing.map(i => i[2])))].sort((a, b) => a.localeCompare(b, "fr"));
    dialogue.innerHTML = `
      <form class="ed" novalidate>
        <div class="ed-head">
          <h2>${nouvelle ? "Nouvelle recette" : "Modifier la recette"}</h2>
          <button type="button" class="round" data-fermer aria-label="Fermer">×</button>
        </div>
        <div class="ed-photo">
          <img id="edImg" src="${r ? photo(r) : "/plats/sans-photo.svg"}" alt="">
          <label class="btn ghost">Changer la photo<input type="file" id="edFile" accept="image/jpeg,image/png,image/webp" hidden></label>
        </div>
        <label class="ed-field">Nom<input id="edNom" value="${echapper(r?.nom)}" maxlength="120" required></label>
        <div class="ed-two">
          <label class="ed-field">Temps total (min)<input id="edTemps" type="number" min="1" max="1440" value="${r?.temps ?? 30}" required></label>
          <label class="ed-field">Étiquettes<input id="edTags" value="${echapper(r?.tags.join(", "))}" placeholder="végé, rapide, four…"></label>
        </div>
        <label class="ed-field">Astuce<textarea id="edAstuce" rows="2" maxlength="300">${echapper(r?.astuce)}</textarea></label>
        <fieldset class="ed-ing">
          <legend>Ingrédients <span class="hint">pour 4 personnes</span></legend>
          <div id="edIng">${(r?.ing ?? [undefined]).map(ligneIngredient).join("")}</div>
          <button type="button" class="btn ghost" id="edAddIng">+ Ingrédient</button>
        </fieldset>
        <label class="ed-field">Préparation <span class="hint">une étape par ligne</span><textarea id="edEtapes" rows="8">${echapper(r?.etapes.join("\n"))}</textarea></label>
        <p class="ed-err" id="edErr" role="alert"></p>
        <div class="ed-actions">
          ${nouvelle ? "" : '<button type="button" class="btn danger" id="edDel">Supprimer</button>'}
          ${modifiee ? '<button type="button" class="btn ghost" id="edReset">Rétablir l\'original</button>' : ""}
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-fermer>Annuler</button>
          <button type="submit" class="btn" id="edSave">Enregistrer</button>
        </div>
        <datalist id="edUnites">${UNITES.filter(Boolean).map(u => `<option value="${echapper(u)}">`).join("")}</datalist>
        <datalist id="edNoms">${noms.map(n => `<option value="${echapper(n)}">`).join("")}</datalist>
      </form>`;
    const d = sel => dialogue.querySelector(sel);
    const erreur = msg => (d("#edErr").textContent = msg);

    dialogue.querySelectorAll("[data-fermer]").forEach(b => (b.onclick = () => dialogue.close()));
    d("#edAddIng").onclick = () => { d("#edIng").insertAdjacentHTML("beforeend", ligneIngredient()); d("#edIng .ing-row:last-child .n").focus(); };
    d("#edIng").addEventListener("click", e => { if (e.target.closest(".del") && d("#edIng").children.length > 1) e.target.closest(".ing-row").remove(); });
    d("#edFile").onchange = e => {
      fichierPhoto = e.target.files[0] || null;
      if (fichierPhoto) d("#edImg").src = URL.createObjectURL(fichierPhoto);
    };

    const lire = () => ({
      id: r?.id ?? nouvelId(d("#edNom").value, new Set(opts.catalogue().map(x => x.id))),
      nom: d("#edNom").value,
      temps: Number(d("#edTemps").value),
      tags: d("#edTags").value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean),
      astuce: d("#edAstuce").value,
      ing: [...d("#edIng").children].map(l => {
        const brut = l.querySelector(".q").value.trim().replace(",", ".");
        return [brut ? Number(brut) : null, l.querySelector(".u").value.trim(), l.querySelector(".n").value.trim(), l.querySelector(".r").value];
      }).filter(i => i[2]),
      etapes: d("#edEtapes").value.split("\n").map(e => e.trim()).filter(Boolean),
      ...(r?.photo ? { photo: r.photo } : {}),
    });

    dialogue.querySelector("form").onsubmit = async e => {
      e.preventDefault();
      const brouillon = lire();
      if (brouillon.ing.some(i => i[0] !== null && !(i[0] > 0))) return erreur("Une quantité n'est pas un nombre (laisser vide pour « selon goût »).");
      if (!validerRecette(brouillon)) return erreur("Vérifiez la recette : un nom, un temps entre 1 et 1440 min, au moins un ingrédient et une étape.");
      d("#edSave").disabled = true;
      try {
        if (fichierPhoto) brouillon.photo = await opts.envoyerPhoto(brouillon.id, await reduirePhoto(fichierPhoto));
        await opts.enregistrer(validerRecette(brouillon));
        dialogue.close();
      } catch (err) {
        erreur(err.message || "Enregistrement impossible : le serveur ne répond pas.");
      } finally {
        d("#edSave").disabled = false;
      }
    };
    if (!nouvelle) d("#edDel").onclick = async () => {
      if (!confirm(`Supprimer « ${r.nom} » du catalogue ?`)) return;
      try { await opts.supprimer(r.id, false); dialogue.close(); } catch (err) { erreur(err.message); }
    };
    if (modifiee) d("#edReset").onclick = async () => {
      if (!confirm("Revenir à la recette d'origine ? Les modifications seront perdues.")) return;
      try { await opts.supprimer(r.id, true); dialogue.close(); } catch (err) { erreur(err.message); }
    };
    dialogue.showModal();
    if (nouvelle) d("#edNom").focus();
  }

  return { afficher: afficherGrille };
}
