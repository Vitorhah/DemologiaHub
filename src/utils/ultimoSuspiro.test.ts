import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceUltimoSuspiroTurn,
  applySurvivalTestResult,
  canCharacterAct,
  canTriggerSurvivalTest,
  createDefaultUltimoSuspiroState,
  evaluateTimingOverlap,
  extractVitAttribute,
  formatUltimoSuspiroNotification,
  normalizeUltimoSuspiroState,
  protectUltimoSuspiroOnSave,
  reconcileHpChangeForUltimoSuspiro,
  resolveLastChanceCoinFlip,
  resolveMasterFinalizeDeath,
  resolveMasterRevive,
  rollVitalitySurvivalTest,
  TIMING_RING_CONFIG,
} from "./ultimoSuspiro";

test("auto-activates Último Suspiro when HP drops to 0 or negative", () => {
  const alive = createDefaultUltimoSuspiroState(1000);
  const resZero = reconcileHpChangeForUltimoSuspiro({
    prevUltimoSuspiro: alive,
    prevHp: 12,
    nextHp: 0,
    maxHp: 26,
    now: 2000,
  });

  assert.equal(resZero.ultimoSuspiro.status, "dying");
  assert.equal(resZero.ultimoSuspiro.failures, 0);
  assert.equal(resZero.hpCurrent, 0);
  assert.deepEqual(resZero.events, ["entered"]);

  const resNegative = reconcileHpChangeForUltimoSuspiro({
    prevUltimoSuspiro: alive,
    prevHp: 8,
    nextHp: -15,
    maxHp: 26,
    now: 3000,
  });

  assert.equal(resNegative.ultimoSuspiro.status, "dying");
  assert.equal(resNegative.ultimoSuspiro.failures, 0);
  assert.equal(resNegative.hpCurrent, 0);
  assert.deepEqual(resNegative.events, ["entered"]);
});

test("subsequent 0 HP edits while already dying do not reset death counter or duplicate entered event", () => {
  const dyingWithTwo = {
    status: "dying" as const,
    failures: 2,
    maxFailures: 3 as const,
    updatedAt: 1000,
  };
  const res = reconcileHpChangeForUltimoSuspiro({
    prevUltimoSuspiro: dyingWithTwo,
    prevHp: 0,
    nextHp: 0,
    maxHp: 26,
  });

  assert.equal(res.ultimoSuspiro.status, "dying");
  assert.equal(res.ultimoSuspiro.failures, 2);
  assert.deepEqual(res.events, []);
});

test("extractVitAttribute reads VIT case-insensitively and defaults to 0", () => {
  assert.equal(extractVitAttribute({ VIT: 4, FOR: 2 }), 4);
  assert.equal(extractVitAttribute({ vit: 3 }), 3);
  assert.equal(extractVitAttribute({ FOR: 2 }), 0);
  assert.equal(extractVitAttribute(null), 0);
});

test("critical success happens exclusively on doubles [1,1]..[6,6] when timing hits", () => {
  for (let face = 1; face <= 6; face++) {
    const roll = rollVitalitySurvivalTest({
      vit: 5,
      timingHit: true,
      diceRoller: () => face,
      now: 1234,
    });
    assert.equal(roll.isCritical, true, `Doubles [${face},${face}] should be critical`);
    assert.equal(roll.diceSum, face * 2);
    assert.equal(roll.total, face * 2 + 5);
    assert.equal(roll.healedHp, face * 2);
  }
});

test("non-doubles always fail even with high VIT and timing hit", () => {
  const seq = [5, 6];
  let idx = 0;
  const roll = rollVitalitySurvivalTest({
    vit: 15,
    timingHit: true,
    diceRoller: () => seq[idx++],
  });

  assert.equal(roll.isCritical, false);
  assert.equal(roll.total, 26); // 5 + 6 + 15
  assert.equal(roll.healedHp, 0);
});

test("timing miss forces failure even if dice would be doubles", () => {
  const roll = rollVitalitySurvivalTest({
    vit: 4,
    timingHit: false,
    diceRoller: () => 6,
  });

  assert.equal(roll.timingHit, false);
  assert.equal(roll.isCritical, false);
  assert.equal(roll.healedHp, 0);
});

test("critical success automatically restores PV = d1 + d2 (clamped to maxHp) and resets death counter", () => {
  const dying = {
    status: "dying" as const,
    failures: 2,
    maxFailures: 3 as const,
    updatedAt: 1000,
  };
  const critRoll = rollVitalitySurvivalTest({
    vit: 3,
    timingHit: true,
    diceRoller: () => 5, // [5, 5] => heals 10 PV
  });

  const outcome = applySurvivalTestResult({
    prevUltimoSuspiro: dying,
    currentHp: 0,
    maxHp: 38,
    testResult: critRoll,
    turnToken: "turn-1",
    now: 2000,
  });

  assert.equal(outcome.ignored, false);
  assert.equal(outcome.ultimoSuspiro.status, "alive");
  assert.equal(outcome.ultimoSuspiro.failures, 0);
  assert.equal(outcome.nextHp, 10);
  assert.deepEqual(outcome.events, ["critical_success"]);

  // Clamped to maxHp when dice sum exceeds maxHp
  const clampedOutcome = applySurvivalTestResult({
    prevUltimoSuspiro: dying,
    currentHp: 0,
    maxHp: 8,
    testResult: critRoll,
    turnToken: "turn-2",
  });
  assert.equal(clampedOutcome.nextHp, 8);
});

test("failure progression increments 0->1->2 (imminent_death)->3 (permanent_death) and prevents duplicate turnToken", () => {
  const failSeq = [2, 5];
  const makeFail = () => {
    let i = 0;
    return rollVitalitySurvivalTest({
      vit: 2,
      timingHit: true,
      diceRoller: () => failSeq[i++],
    });
  };

  let state = {
    status: "dying" as const,
    failures: 0,
    maxFailures: 3 as const,
    updatedAt: 1000,
  };

  // Turn 1 -> 1/3
  const t1 = applySurvivalTestResult({
    prevUltimoSuspiro: state,
    currentHp: 0,
    maxHp: 26,
    testResult: makeFail(),
    turnToken: "turn-1",
  });
  assert.equal(t1.ultimoSuspiro.failures, 1);
  assert.equal(t1.ultimoSuspiro.status, "dying");
  assert.equal(t1.nextHp, 0);
  assert.deepEqual(t1.events, ["failure"]);

  // Duplicate click / same turnToken must be ignored
  const dup = applySurvivalTestResult({
    prevUltimoSuspiro: t1.ultimoSuspiro,
    currentHp: 0,
    maxHp: 26,
    testResult: makeFail(),
    turnToken: "turn-1",
  });
  assert.equal(dup.ignored, true);
  assert.equal(dup.ultimoSuspiro.failures, 1);

  // Turn 2 -> 2/3 (MORTE IMINENTE)
  const t2 = applySurvivalTestResult({
    prevUltimoSuspiro: t1.ultimoSuspiro,
    currentHp: 0,
    maxHp: 26,
    testResult: makeFail(),
    turnToken: "turn-2",
  });
  assert.equal(t2.ultimoSuspiro.failures, 2);
  assert.equal(t2.ultimoSuspiro.status, "dying");
  assert.deepEqual(t2.events, ["failure", "imminent_death"]);

  // Turn 3 -> 0 turns left unlocks Última Chance coin flip (not immediately dead)
  const t3 = applySurvivalTestResult({
    prevUltimoSuspiro: t2.ultimoSuspiro,
    currentHp: 0,
    maxHp: 26,
    testResult: makeFail(),
    turnToken: "turn-3",
  });
  assert.equal(t3.ultimoSuspiro.failures, 3);
  assert.equal(t3.ultimoSuspiro.status, "dying");
  assert.equal(t3.ultimoSuspiro.coinFlipPending, true);
  assert.equal(t3.coinFlipAvailable, true);
  assert.equal(t3.nextHp, 0);
  assert.deepEqual(t3.events, ["failure", "coin_flip_available"]);
  assert.equal(canTriggerSurvivalTest(t3.ultimoSuspiro, true), true);

  // While coin flip is pending, normal survival tests are blocked
  const blockedWhileCoinPending = applySurvivalTestResult({
    prevUltimoSuspiro: t3.ultimoSuspiro,
    currentHp: 0,
    maxHp: 26,
    testResult: makeFail(),
    turnToken: "turn-3b",
  });
  assert.equal(blockedWhileCoinPending.ignored, true);

  // Winning the coin flip grants +1 extra turn (back to 2/3) and marks coinFlipUsed
  const coinWin = resolveLastChanceCoinFlip({
    prevUltimoSuspiro: t3.ultimoSuspiro,
    choice: "cara",
    coinRoller: () => "cara",
    now: 3000,
  });
  assert.equal(coinWin.ignored, false);
  assert.equal(coinWin.won, true);
  assert.equal(coinWin.ultimoSuspiro.status, "dying");
  assert.equal(coinWin.ultimoSuspiro.failures, 2);
  assert.equal(coinWin.ultimoSuspiro.coinFlipPending, false);
  assert.equal(coinWin.ultimoSuspiro.coinFlipUsed, true);
  assert.deepEqual(coinWin.events, ["coin_flip_won"]);

  // Failing the extra turn after using the coin flip results in immediate MORTE DEFINITIVA
  const t4 = applySurvivalTestResult({
    prevUltimoSuspiro: coinWin.ultimoSuspiro,
    currentHp: 0,
    maxHp: 26,
    testResult: makeFail(),
    turnToken: "turn-4",
  });
  assert.equal(t4.ultimoSuspiro.failures, 3);
  assert.equal(t4.ultimoSuspiro.status, "dead");
  assert.equal(t4.coinFlipAvailable, false);
  assert.deepEqual(t4.events, ["failure", "permanent_death"]);
  assert.equal(canCharacterAct(t4.ultimoSuspiro), false);
  assert.equal(canTriggerSurvivalTest(t4.ultimoSuspiro, true), false);

  // Losing the coin flip directly causes immediate MORTE DEFINITIVA
  const coinLose = resolveLastChanceCoinFlip({
    prevUltimoSuspiro: t3.ultimoSuspiro,
    choice: "cara",
    coinRoller: () => "coroa",
    now: 4000,
  });
  assert.equal(coinLose.won, false);
  assert.equal(coinLose.ultimoSuspiro.status, "dead");
  assert.equal(coinLose.ultimoSuspiro.failures, 3);
  assert.deepEqual(coinLose.events, ["coin_flip_lost", "permanent_death"]);

  // Second coin flip attempt on an already-used/dead state is ignored
  const secondFlip = resolveLastChanceCoinFlip({
    prevUltimoSuspiro: coinWin.ultimoSuspiro,
    choice: "coroa",
    coinRoller: () => "coroa",
  });
  assert.equal(secondFlip.ignored, true);
});

test("permanent death blocks normal healing and player state tampering; only Master can revive", () => {
  const dead = {
    status: "dead" as const,
    failures: 3,
    maxFailures: 3 as const,
    updatedAt: 5000,
  };

  // Normal HP increase cannot reverse permanent death
  const healAttempt = reconcileHpChangeForUltimoSuspiro({
    prevUltimoSuspiro: dead,
    prevHp: 0,
    nextHp: 20,
    maxHp: 26,
    isMaster: false,
  });
  assert.equal(healAttempt.ultimoSuspiro.status, "dead");
  assert.equal(healAttempt.hpCurrent, 0);
  assert.equal(healAttempt.blockedDeadEdit, true);

  // Player save protection keeps dead status locked
  const tampered = protectUltimoSuspiroOnSave(
    {
      name: "Agente",
      hp: { current: 26, max: 26 },
      ultimoSuspiro: createDefaultUltimoSuspiroState(),
    },
    dead,
    false,
  );
  assert.equal(tampered.hp.current, 0);
  assert.equal(tampered.ultimoSuspiro.status, "dead");

  // Non-master cannot call Master revive or finalize
  assert.equal(resolveMasterRevive({ isMaster: false, maxHp: 26, targetHp: 10 }).ok, false);
  assert.equal(resolveMasterFinalizeDeath({ isMaster: false }).ok, false);

  // Master revive succeeds and sets PV
  const revived = resolveMasterRevive({ isMaster: true, maxHp: 26, targetHp: 12 });
  assert.equal(revived.ok, true);
  assert.equal(revived.ultimoSuspiro?.status, "alive");
  assert.equal(revived.ultimoSuspiro?.failures, 0);
  assert.equal(revived.hpCurrent, 12);
  assert.deepEqual(revived.events, ["resurrection"]);

  // Master finalize transitions directly to dead 3/3
  const finalized = resolveMasterFinalizeDeath({ isMaster: true });
  assert.equal(finalized.ok, true);
  assert.equal(finalized.ultimoSuspiro?.status, "dead");
  assert.equal(finalized.ultimoSuspiro?.failures, 3);
  assert.equal(finalized.hpCurrent, 0);
  assert.deepEqual(finalized.events, ["permanent_death"]);
});

test("evaluateTimingOverlap matches outer and center concentric tolerances precisely", () => {
  const { targetRadius, tolerance, centerTolerance, durationMs } = TIMING_RING_CONFIG;

  // Minigame is faster than the initial 1750ms baseline
  assert.ok(durationMs <= 1300 && durationMs >= 900);

  // Exact center and within centerTolerance => centerHit
  const exact = evaluateTimingOverlap(targetRadius);
  assert.equal(exact.hit, true);
  assert.equal(exact.centerHit, true);
  assert.equal(exact.quality, "center");

  assert.equal(evaluateTimingOverlap(targetRadius + centerTolerance).quality, "center");
  assert.equal(evaluateTimingOverlap(targetRadius - centerTolerance).quality, "center");

  // Between centerTolerance and outer tolerance => outer hit (not center)
  const outer = evaluateTimingOverlap(targetRadius + centerTolerance + 1);
  assert.equal(outer.hit, true);
  assert.equal(outer.centerHit, false);
  assert.equal(outer.quality, "outer");

  assert.equal(evaluateTimingOverlap(targetRadius + tolerance).quality, "outer");
  assert.equal(evaluateTimingOverlap(targetRadius - tolerance).quality, "outer");

  // Outside tolerance => miss
  assert.equal(evaluateTimingOverlap(targetRadius + tolerance + 0.5).quality, "miss");
  assert.equal(evaluateTimingOverlap(targetRadius - tolerance - 0.5).quality, "miss");
});

test("center hit grants bonus 2d6 attempts (~42% crit chance) without breaking doubles rule", () => {
  // Sequence: 2 non-doubles then 3rd roll [4, 4] (double)
  const seqWinOnBonus = [2, 5, 1, 3, 4, 4];
  let idx1 = 0;
  const centerWin = rollVitalitySurvivalTest({
    vit: 3,
    timingHit: true,
    centerHit: true,
    diceRoller: () => seqWinOnBonus[idx1++],
  });
  assert.equal(centerWin.isCritical, true);
  assert.equal(centerWin.centerHit, true);
  assert.equal(centerWin.attemptsUsed, 3);
  assert.equal(centerWin.d1, 4);
  assert.equal(centerWin.d2, 4);
  assert.equal(centerWin.healedHp, 8);
  assert.equal(centerWin.critChancePct, 42);

  // Outer hit with same sequence stops after 1 roll and fails
  let idx2 = 0;
  const outerFail = rollVitalitySurvivalTest({
    vit: 3,
    timingHit: true,
    centerHit: false,
    diceRoller: () => seqWinOnBonus[idx2++],
  });
  assert.equal(outerFail.isCritical, false);
  assert.equal(outerFail.centerHit, false);
  assert.equal(outerFail.attemptsUsed, 1);
  assert.equal(outerFail.healedHp, 0);
  assert.equal(outerFail.critChancePct, 17);

  // Center hit still fails honestly when none of the 3 attempts rolls doubles
  const seqAllMiss = [1, 2, 4, 6, 2, 5];
  let idx3 = 0;
  const centerFail = rollVitalitySurvivalTest({
    vit: 5,
    timingHit: true,
    centerHit: true,
    diceRoller: () => seqAllMiss[idx3++],
  });
  assert.equal(centerFail.isCritical, false);
  assert.equal(centerFail.centerHit, true);
  assert.equal(centerFail.attemptsUsed, 3);
  assert.equal(centerFail.healedHp, 0);
  // Keeps highest non-double roll [4, 6] for display
  assert.equal(centerFail.d1, 4);
  assert.equal(centerFail.d2, 6);
  assert.equal(centerFail.total, 15);
});

test("advanceUltimoSuspiroTurn and normalizeUltimoSuspiroState handle legacy & turn progression safely", () => {
  const legacyZeroHp = normalizeUltimoSuspiroState(undefined, 0);
  assert.equal(legacyZeroHp.status, "dying");
  assert.equal(legacyZeroHp.failures, 0);

  const step1 = advanceUltimoSuspiroTurn({
    prevUltimoSuspiro: legacyZeroHp,
    turnToken: "master-turn-1",
  });
  assert.equal(step1.ultimoSuspiro.failures, 1);

  const step2 = advanceUltimoSuspiroTurn({
    prevUltimoSuspiro: step1.ultimoSuspiro,
    turnToken: "master-turn-2",
  });
  assert.equal(step2.ultimoSuspiro.failures, 2);
  assert.deepEqual(step2.events, ["imminent_death"]);

  const step3 = advanceUltimoSuspiroTurn({
    prevUltimoSuspiro: step2.ultimoSuspiro,
    turnToken: "master-turn-3",
  });
  assert.equal(step3.ultimoSuspiro.status, "dying");
  assert.equal(step3.ultimoSuspiro.failures, 3);
  assert.equal(step3.ultimoSuspiro.coinFlipPending, true);
  assert.deepEqual(step3.events, ["coin_flip_available"]);

  // Advancing again when coin flip was already pending finalizes permanent death
  const step4 = advanceUltimoSuspiroTurn({
    prevUltimoSuspiro: step3.ultimoSuspiro,
    turnToken: "master-turn-4",
  });
  assert.equal(step4.ultimoSuspiro.status, "dead");
  assert.equal(step4.ultimoSuspiro.failures, 3);
  assert.deepEqual(step4.events, ["permanent_death"]);
});

test("formatUltimoSuspiroNotification covers all 7 required event types", () => {
  const entered = formatUltimoSuspiroNotification("entered", "Kael");
  assert.equal(entered.title, "ÚLTIMO SUSPIRO");
  assert.match(entered.message, /Kael/);

  const attempting = formatUltimoSuspiroNotification("attempting", "Kael", { failures: 1 });
  assert.equal(attempting.title, "RESISTÊNCIA À MORTE");

  const failure = formatUltimoSuspiroNotification("failure", "Kael", { failures: 1 });
  assert.equal(failure.title, "FALHA");

  const crit = formatUltimoSuspiroNotification("critical_success", "Kael", { healedHp: 8 });
  assert.equal(crit.title, "SUCESSO CRÍTICO");
  assert.match(crit.message, /\+8 PV/);

  const imminent = formatUltimoSuspiroNotification("imminent_death", "Kael", { failures: 2 });
  assert.equal(imminent.title, "MORTE IMINENTE");

  const dead = formatUltimoSuspiroNotification("permanent_death", "Kael", { failures: 3 });
  assert.equal(dead.title, "MORTE DEFINITIVA");

  const revive = formatUltimoSuspiroNotification("resurrection", "Kael", { healedHp: 10 });
  assert.equal(revive.title, "RESSURREIÇÃO");
  assert.match(revive.message, /\+10 PV/);
});
