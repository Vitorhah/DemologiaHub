import test from "node:test";
import assert from "node:assert/strict";
import {
  clearInitiativeSelection,
  createInitialInitiativeFilterState,
  filterInitiativeParticipants,
  invertInitiativeSelection,
  reconcileInitiativeSelection,
  rollFilteredInitiatives,
  selectAllInitiativeParticipants,
  setInitiativeFilterActive,
  toggleInitiativeParticipant,
} from "./initiativeFilter";

test("reconcileInitiativeSelection auto-selects initial participants and prunes disconnected ones", () => {
  let state = createInitialInitiativeFilterState();
  state = reconcileInitiativeSelection(state, ["p1", "p2", "p3"]);
  assert.deepEqual(state.selectedIds, ["p1", "p2", "p3"]);
  assert.equal(state.hasCustomSelection, false);

  // New player joins while in default all-selected mode -> auto-selected
  state = reconcileInitiativeSelection(state, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(state.selectedIds, ["p1", "p2", "p3", "p4"]);

  // Player p2 disconnects -> pruned cleanly without stale IDs
  state = reconcileInitiativeSelection(state, ["p1", "p3", "p4"]);
  assert.deepEqual(state.selectedIds, ["p1", "p3", "p4"]);
});

test("custom selection is preserved independently when players join or leave", () => {
  let state = reconcileInitiativeSelection(createInitialInitiativeFilterState(), [
    "p1",
    "p2",
    "p3",
  ]);

  // Master unchecks p2
  state = toggleInitiativeParticipant(state, "p2", ["p1", "p2", "p3"]);
  assert.deepEqual(state.selectedIds, ["p1", "p3"]);
  assert.equal(state.hasCustomSelection, true);

  // New player p4 joins -> does NOT silently enter custom combat selection
  state = reconcileInitiativeSelection(state, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(state.selectedIds, ["p1", "p3"]);

  // p1 disconnects -> only p3 remains selected
  state = reconcileInitiativeSelection(state, ["p2", "p3", "p4"]);
  assert.deepEqual(state.selectedIds, ["p3"]);

  // Master selects all -> restores default all-selected state
  state = selectAllInitiativeParticipants(state, ["p2", "p3", "p4"]);
  assert.deepEqual(state.selectedIds, ["p2", "p3", "p4"]);
  assert.equal(state.hasCustomSelection, false);

  // Master clears selection -> 0 selected
  state = clearInitiativeSelection(state, ["p2", "p3", "p4"]);
  assert.deepEqual(state.selectedIds, []);
  assert.equal(state.hasCustomSelection, true);
});

test("invertInitiativeSelection flips partial, full, empty, and reconciled selections accurately", () => {
  const ids = ["p1", "p2", "p3"];
  let state = reconcileInitiativeSelection(createInitialInitiativeFilterState(), ids);

  // Partial selection [p1, p3] -> inverted to [p2]
  state = toggleInitiativeParticipant(state, "p2", ids);
  state = invertInitiativeSelection(state, ids);
  assert.deepEqual(state.selectedIds, ["p2"]);
  assert.equal(state.hasCustomSelection, true);

  // Invert again -> [p1, p3]
  state = invertInitiativeSelection(state, ids);
  assert.deepEqual(state.selectedIds, ["p1", "p3"]);
  assert.equal(state.hasCustomSelection, true);

  // Select all -> invert -> empty []
  state = selectAllInitiativeParticipants(state, ids);
  state = invertInitiativeSelection(state, ids);
  assert.deepEqual(state.selectedIds, []);
  assert.equal(state.hasCustomSelection, true);

  // Empty -> invert -> all selected (hasCustomSelection resets to false)
  state = invertInitiativeSelection(state, ids);
  assert.deepEqual(state.selectedIds, ["p1", "p2", "p3"]);
  assert.equal(state.hasCustomSelection, false);

  // Disconnected participant pruned cleanly before invert
  state = toggleInitiativeParticipant(state, "p2", ids); // selected: [p1, p3]
  state = invertInitiativeSelection(state, ["p1", "p2"]); // known: [p1, p2], selected was [p1] -> inverted: [p2]
  assert.deepEqual(state.selectedIds, ["p2"]);
});

test("filterInitiativeParticipants hides unselected players only when filter is active without mutating input", () => {
  const players = [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bruno" },
    { id: "p3", name: "Carla" },
  ];

  // Filter OFF -> everyone visible
  const allVisible = filterInitiativeParticipants(players, ["p1", "p3"], false);
  assert.deepEqual(
    allVisible.map((p) => p.id),
    ["p1", "p2", "p3"]
  );

  // Filter ON -> only selected visible in existing order
  const filtered = filterInitiativeParticipants(players, ["p1", "p3"], true);
  assert.deepEqual(
    filtered.map((p) => p.id),
    ["p1", "p3"]
  );

  // Original players array untouched
  assert.equal(players.length, 3);

  // Toggle filter state helper
  let state = createInitialInitiativeFilterState();
  state = setInitiativeFilterActive(state, true);
  assert.equal(state.filterActive, true);
  state = setInitiativeFilterActive(state, false);
  assert.equal(state.filterActive, false);
});

test("rollFilteredInitiatives rolls exclusively for selected participants using 1d20+AGL and skips unselected ones", () => {
  const participants = [
    { id: "p1", variables: { AGL: 4 }, pdis: [] },
    { id: "p2", variables: { AGL: 10 }, pdis: [] },
    { id: "p3", variables: { AGL: 2 }, pdis: [] },
  ];

  let rngCalls = 0;
  const fixedRng = () => {
    rngCalls += 1;
    return 0.5; // floor(0.5 * 20) + 1 = 11
  };

  const results = rollFilteredInitiatives(participants, ["p1", "p3"], fixedRng);

  // Only 2 participants rolled (p2 was skipped completely)
  assert.equal(rngCalls, 2);
  assert.deepEqual(Object.keys(results).sort(), ["p1", "p3"]);
  assert.equal(results["p1"], 11 + 4);
  assert.equal(results["p3"], 11 + 2);
  assert.equal(results["p2"], undefined);

  // Empty selection performs zero rolls
  rngCalls = 0;
  const emptyResults = rollFilteredInitiatives(participants, [], fixedRng);
  assert.equal(rngCalls, 0);
  assert.deepEqual(emptyResults, {});
});
