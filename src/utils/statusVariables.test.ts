import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATUS_KEYS,
  isDefaultStatusKey,
  canRemoveStatusVariable,
  canRenameStatusVariable,
} from "./statusVariables";

test("DEFAULT_STATUS_KEYS protects all 6 core Demologia attributes from deletion or rename", () => {
  assert.deepEqual([...DEFAULT_STATUS_KEYS], ["SAN", "AGL", "INT", "FOR", "VIT", "OCU"]);

  for (const key of DEFAULT_STATUS_KEYS) {
    assert.equal(isDefaultStatusKey(key), true);
    assert.equal(isDefaultStatusKey(key.toLowerCase()), true);
    assert.equal(canRemoveStatusVariable(key), false);
    assert.equal(canRenameStatusVariable(key), false);
  }
});

test("custom status variables remain removable and renameable", () => {
  for (const customKey of ["VAR1", "SORTE", "DEFESA", ""]) {
    assert.equal(isDefaultStatusKey(customKey), false);
    assert.equal(canRemoveStatusVariable(customKey), true);
    assert.equal(canRenameStatusVariable(customKey), true);
  }
});
