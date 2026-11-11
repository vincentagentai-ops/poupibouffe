import { test } from "node:test";
import assert from "node:assert/strict";
import { fusionner, validerRecette, nouvelId } from "../src/catalogue.js";
import { RECETTES } from "../src/recettes.js";

const base = [{ id: "a", nom: "Alpha" }, { id: "b", nom: "Bêta" }, { id: "c", nom: "Gamma" }];

test("fusionner remplace, supprime et ajoute des recettes", () => {
  const liste = fusionner(base, { b: { id: "b", nom: "Bêta modifiée" }, c: null, z: { id: "z", nom: "Zêta" }, d: { id: "d", nom: "Delta" } });
  assert.deepEqual(liste.map(r => r.nom), ["Alpha", "Bêta modifiée", "Delta", "Zêta"]);
  assert.equal(fusionner(base).length, 3);
});

test("toutes les recettes de base passent la validation", () => {
  for (const r of RECETTES) assert.deepEqual(validerRecette(r), r, r.id);
});

test("validerRecette refuse les recettes incohérentes", () => {
  const ok = structuredClone(RECETTES[0]);
  assert.ok(validerRecette(ok));
  assert.equal(validerRecette({ ...ok, id: "../etc" }), null);
  assert.equal(validerRecette({ ...ok, nom: "  " }), null);
  assert.equal(validerRecette({ ...ok, temps: 0 }), null);
  assert.equal(validerRecette({ ...ok, ing: [] }), null);
  assert.equal(validerRecette({ ...ok, ing: [[1, "g", "sel", "Rayon inconnu"]] }), null);
  assert.equal(validerRecette({ ...ok, ing: [[-2, "g", "sel", ok.ing[0][3]]] }), null);
  assert.equal(validerRecette({ ...ok, etapes: [] }), null);
  assert.equal(validerRecette({ ...ok, photo: "https://ailleurs.example/x.jpg" }), null);
  assert.equal(validerRecette({ ...ok, photo: "/photos/potimarron.jpg?v=12" }).photo, "/photos/potimarron.jpg?v=12");
  assert.equal(validerRecette({ ...ok, nom: "  Velouté  " }).nom, "Velouté");
});

test("nouvelId tire un identifiant lisible et unique du nom", () => {
  assert.equal(nouvelId("Gratin de blettes à l'œuf", new Set()), "gratin-de-blettes-a-l-oeuf");
  assert.equal(nouvelId("Chili", new Set(["chili", "chili-2"])), "chili-3");
  assert.equal(nouvelId("!!!", new Set()), "recette");
});
