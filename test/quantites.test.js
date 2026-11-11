import { test } from "node:test";
import assert from "node:assert/strict";
import { ajuster, formaterQuantite, nomPiece, nomIngredient } from "../src/quantites.js";

test("ajuster garde la recette telle quelle pour 4 couverts", () => {
  assert.equal(ajuster(320, "g", 4), 320);
  assert.equal(ajuster(20, "cl", 4), 20);
  assert.equal(ajuster(3, "", 4), 3);
});

test("ajuster arrondit à des valeurs mesurables", () => {
  assert.equal(ajuster(320, "g", 6), 480);
  assert.equal(ajuster(40, "g", 3), 30);
  assert.equal(ajuster(3, "", 6), 4.5);
  assert.equal(ajuster(1, "", 1), 0.5);        // jamais zéro
  assert.equal(ajuster(1.2, "kg", 2), 0.6);
  assert.equal(ajuster(null, "", 6), null);
});

test("formaterQuantite écrit les unités à la française", () => {
  assert.equal(formaterQuantite(1200, "g"), "1,2 kg");
  assert.equal(formaterQuantite(450, "g"), "450 g");
  assert.equal(formaterQuantite(2, "gousse"), "2 gousses");
  assert.equal(formaterQuantite(1, "gousse"), "1 gousse");
  assert.equal(formaterQuantite(3, "c. à s."), "3 c. à s.");
  assert.equal(formaterQuantite(0.5, ""), "½");
  assert.equal(formaterQuantite(1.5, ""), "1 ½");
  assert.equal(formaterQuantite(null, ""), "selon goût");
});

test("nomPiece met au pluriel le premier mot", () => {
  assert.equal(nomPiece("oignon", 3), "oignons");
  assert.equal(nomPiece("poireau", 2), "poireaux");
  assert.equal(nomPiece("pavé de saumon", 4), "pavés de saumon");
  assert.equal(nomPiece("dos de cabillaud", 4), "dos de cabillaud");
  assert.equal(nomPiece("oignon", 1), "oignon");
  assert.equal(nomIngredient("œuf", "", 3, 4), "œufs");
  assert.equal(nomIngredient("jambon blanc", "tranche", 4, 4), "jambon blanc");
});
