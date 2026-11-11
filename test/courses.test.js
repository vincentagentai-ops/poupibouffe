import { test } from "node:test";
import assert from "node:assert/strict";
import { listeDeCourses } from "../src/courses.js";
import { RECETTES, RAYONS, SEMAINE_PAR_DEFAUT, recetteParId } from "../src/recettes.js";

const article = (liste, nom) => Object.values(liste).flat().find(a => a.cle === nom);

test("les recettes sont complètes et rangées dans des rayons connus", () => {
  const ids = new Set();
  for (const r of RECETTES) {
    assert.ok(!ids.has(r.id), `id en double : ${r.id}`);
    ids.add(r.id);
    assert.ok(r.ing.length > 0 && r.etapes.length > 0, r.id);
    for (const [, , nom, rayon] of r.ing) assert.ok(RAYONS.includes(rayon), `${r.id} : ${nom} → ${rayon}`);
  }
  assert.ok(RECETTES.length >= 14, "assez de recettes pour changer chaque soir");
  assert.equal(SEMAINE_PAR_DEFAUT.length, 7);
  assert.ok(SEMAINE_PAR_DEFAUT.every(recetteParId));
});

test("un même ingrédient est additionné sur la semaine", () => {
  const semaine = ["parmentier", "tartiflette"].map(recetteParId);
  const liste = listeDeCourses(semaine, 4);
  assert.equal(article(liste, "pommes de terre").quantite, "2 kg");
  assert.equal(article(liste, "oignon").quantite, "4");
  assert.equal(article(liste, "oignon").nom, "oignons");
  assert.deepEqual(article(liste, "oignon").jours, [0, 1]);
});

test("les unités différentes restent séparées", () => {
  const semaine = ["tortilla", "saucisses-lentilles"].map(recetteParId);
  assert.equal(article(listeDeCourses(semaine, 4), "moutarde de dijon").quantite, "1 c. à c. + 1 c. à s.");
});

test("kg et g s'additionnent", () => {
  const semaine = ["potimarron", "poulet-roti"].map(recetteParId);
  semaine[0] = { ...semaine[0], ing: [[0.5, "kg", "pommes de terre", "Fruits & légumes"]] };
  assert.equal(article(listeDeCourses(semaine, 4), "pommes de terre").quantite, "1,3 kg");
});

test("les quantités suivent le nombre de couverts", () => {
  const semaine = [recetteParId("chili")];
  assert.equal(article(listeDeCourses(semaine, 2), "bœuf haché").quantite, "250 g");
  assert.equal(article(listeDeCourses(semaine, 8), "bœuf haché").quantite, "1 kg");
});

test("les assaisonnements sans quantité restent « selon goût »", () => {
  const liste = listeDeCourses(SEMAINE_PAR_DEFAUT.map(recetteParId), 4);
  assert.equal(article(liste, "sel, poivre").quantite, "selon goût");
  assert.deepEqual(Object.keys(liste), RAYONS.filter(r => liste[r]));
});
