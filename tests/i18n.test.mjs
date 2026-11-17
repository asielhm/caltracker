import { test } from "node:test";
import assert from "node:assert/strict";
import { translateText } from "../dist/i18n.js";
import { foodIcon } from "../dist/ui.js";
test("UI copy switches both ways and preserves unknown user content", () => {
  assert.equal(translateText("Breakfast", "es"), "Desayuno");
  assert.equal(translateText("Breakfast", "en"), "Breakfast");
  assert.equal(
    translateText("My personal recipe 123", "es"),
    "My personal recipe 123",
  );
  assert.equal(translateText("  Save note  ", "es"), "  Guardar nota  ");
});
test("dynamic counts and diagnostic values survive translation", () => {
  assert.equal(
    translateText("2 foods logged", "es"),
    "2 alimentos registrados",
  );
  assert.equal(
    translateText(
      "Database read and write: OK. Saved days: 19. Revision: 21.",
      "es",
    ),
    "Lectura y escritura: OK. Días guardados: 19. Revisión: 21.",
  );
});
test("custom food icons cover the real library categories", () => {
  assert.equal(foodIcon({ category: "Drinks" }), "mate");
  assert.equal(foodIcon({ category: "Protein" }), "protein");
  assert.equal(foodIcon({ category: "Fruit & veg" }), "fruit");
  assert.equal(foodIcon({ category: "My foods" }), "plate");
});

test("wrapped static HTML copy still translates", () => {
  assert.equal(
    translateText(
      "A personal space for your meals, your movement\n     and the little habits that add up.",
      "es",
    ),
    "Un espacio para tus comidas, tu movimiento y esos pequeños hábitos que suman.",
  );
});
