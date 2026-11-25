import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENE_DIRECTOR_MASTER_RECORD_ID,
  SCENE_DIRECTOR_SHARED_RECORD_ID,
  advanceCombatTurn,
  advanceTensionClock,
  buildPublicSceneDirectorPayload,
  computeBatchStatValue,
  createInitialCombatTurnState,
  isTensionClockComplete,
  normalizeNarrativeScene,
  normalizePublicSceneDirectorState,
  normalizeSceneDirectorMasterState,
  normalizeTensionClock,
  reconcileCombatTurnState,
  resetTensionClock,
  setTensionClockFilled,
  startCombatRounds,
  stopCombatRounds,
} from "./sceneDirector";
import { isSystemRecordId } from "./handoutsLogic";

test("isSystemRecordId recognizes Scene Director system records so they never appear as player cards", () => {
  assert.equal(isSystemRecordId(SCENE_DIRECTOR_MASTER_RECORD_ID), true);
  assert.equal(isSystemRecordId(SCENE_DIRECTOR_SHARED_RECORD_ID), true);
});

test("buildPublicSceneDirectorPayload strictly strips private Master notes and hidden scenes/clocks", () => {
  const visibleScene = normalizeNarrativeScene({
    id: "s1",
    title: "Subsolo do Sanatório",
    atmosphere: "Cheiro de ozônio e lâmpadas piscando.",
    escalation: "horror",
    privateNotes: "SEGREDO: o diretor está possuído.",
    visibleToPlayers: true,
    updatedAt: 1000,
  });
  const hiddenScene = normalizeNarrativeScene({
    id: "s2",
    title: "Emboscada Oculta",
    atmosphere: "Silêncio absoluto",
    escalation: "ameaca",
    privateNotes: "SEGREDO 2",
    visibleToPlayers: false,
    updatedAt: 2000,
  });

  const publicClock = normalizeTensionClock({
    id: "c1",
    title: "Ritual do Culto",
    category: "ritual",
    segments: 6,
    filled: 3,
    visibleToPlayers: true,
    privateNote: "Quando encher, a entidade manifesta.",
  });
  const hiddenClock = normalizeTensionClock({
    id: "c2",
    title: "Chegada da Polícia",
    category: "evento",
    segments: 4,
    filled: 2,
    visibleToPlayers: false,
    privateNote: "Só o Mestre sabe.",
  });

  const payloadWhenVisible = buildPublicSceneDirectorPayload(
    {
      scenes: [visibleScene, hiddenScene],
      activeSceneId: "s1",
      clocks: [publicClock, hiddenClock],
      updatedAt: 3000,
    },
    3000,
  );

  assert.equal(payloadWhenVisible.activeScene?.title, "Subsolo do Sanatório");
  assert.equal(payloadWhenVisible.activeScene?.escalation, "horror");
  assert.equal("privateNotes" in (payloadWhenVisible.activeScene as any), false);
  assert.equal(payloadWhenVisible.visibleClocks.length, 1);
  assert.equal(payloadWhenVisible.visibleClocks[0].id, "c1");
  assert.equal(
    "privateNote" in (payloadWhenVisible.visibleClocks[0] as any),
    false,
  );

  const payloadWhenHidden = buildPublicSceneDirectorPayload(
    {
      scenes: [visibleScene, hiddenScene],
      activeSceneId: "s2",
      clocks: [publicClock, hiddenClock],
      updatedAt: 4000,
    },
    4000,
  );
  assert.equal(payloadWhenHidden.activeScene, null);
  assert.equal(payloadWhenHidden.visibleClocks.length, 1);
});

test("TensionClock helpers clamp segments strictly within 0..segments and detect completion", () => {
  const clock = normalizeTensionClock({
    id: "clk1",
    title: "Instabilidade",
    segments: 6,
    filled: 4,
  });

  assert.equal(isTensionClockComplete(clock), false);

  const atSix = advanceTensionClock(clock, 5, 5000);
  assert.equal(atSix.filled, 6);
  assert.equal(isTensionClockComplete(atSix), true);

  const atZero = advanceTensionClock(atSix, -99, 6000);
  assert.equal(atZero.filled, 0);
  assert.equal(isTensionClockComplete(atZero), false);

  const clicked = setTensionClockFilled(atZero, 5, 7000);
  assert.equal(clicked.filled, 5);

  const cleared = resetTensionClock(clicked, 8000);
  assert.equal(cleared.filled, 0);
});

test("Combat round & turn tracker cycles cleanly, increments/decrements rounds, and reconciles removals", () => {
  const order = ["p1", "p2", "p3"];
  const init = createInitialCombatTurnState();
  assert.equal(init.active, false);

  let state = startCombatRounds(order, true);
  assert.equal(state.active, true);
  assert.equal(state.round, 1);
  assert.equal(state.activeParticipantId, "p1");

  state = advanceCombatTurn(state, order, 1);
  assert.equal(state.activeParticipantId, "p2");
  assert.equal(state.round, 1);

  state = advanceCombatTurn(state, order, 1);
  assert.equal(state.activeParticipantId, "p3");
  assert.equal(state.round, 1);

  // Wrap around to Round 2
  state = advanceCombatTurn(state, order, 1);
  assert.equal(state.activeParticipantId, "p1");
  assert.equal(state.round, 2);

  // Step backward returns to p3 on Round 1
  state = advanceCombatTurn(state, order, -1);
  assert.equal(state.activeParticipantId, "p3");
  assert.equal(state.round, 1);

  // Removing active participant reconciles safely to first remaining
  const reconciled = reconcileCombatTurnState(state, ["p1", "p2"]);
  assert.equal(reconciled.activeParticipantId, "p1");

  // Stepping back at Round 1 index 0 stays at Round 1 index 0
  const clampedBack = advanceCombatTurn(reconciled, ["p1", "p2"], -1);
  assert.equal(clampedBack.round, 1);
  assert.equal(clampedBack.activeParticipantId, "p1");

  const stopped = stopCombatRounds(clampedBack);
  assert.equal(stopped.active, false);
  assert.equal(stopped.activeParticipantId, null);
});

test("computeBatchStatValue clamps damage to 0 and healing to max", () => {
  assert.equal(computeBatchStatValue(12, 26, -5), 7);
  assert.equal(computeBatchStatValue(3, 26, -10), 0);
  assert.equal(computeBatchStatValue(22, 26, 10), 26);
  assert.equal(computeBatchStatValue(10, 0, 5), 15);
});

test("Master and public state normalizers safely recover from malformed inputs", () => {
  const master = normalizeSceneDirectorMasterState({
    scenes: [{ id: "a", title: "Teste", escalation: "invalid" }],
    activeSceneId: "non_existent",
    clocks: [{ id: "k1", title: "Relógio", segments: 99, filled: 50 }],
  });
  assert.equal(master.scenes.length, 1);
  assert.equal(master.scenes[0].escalation, "investigacao");
  assert.equal(master.activeSceneId, null);
  assert.equal(master.clocks[0].segments, 12);
  assert.equal(master.clocks[0].filled, 12);

  const pub = normalizePublicSceneDirectorState({
    activeScene: { id: "a", title: "   " },
    visibleClocks: [{ id: "c", title: "Ok", segments: 6, filled: -3 }],
  });
  assert.equal(pub.activeScene, null);
  assert.equal(pub.visibleClocks.length, 1);
  assert.equal(pub.visibleClocks[0].filled, 0);
});
