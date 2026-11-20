import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlayersRevisionSignature,
  createVisibilityPoller,
} from "./visibilityPolling";

function createFakeEventTarget() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener(type: string, fn: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type: string) {
      listeners.get(type)?.forEach((fn) => fn());
    },
  };
}

test("createVisibilityPoller pauses when hidden and re-syncs once on returning to foreground", () => {
  const docTarget = createFakeEventTarget();
  const winTarget = createFakeEventTarget();
  const doc = {
    hidden: false,
    addEventListener: docTarget.addEventListener,
    removeEventListener: docTarget.removeEventListener,
  };
  const win = {
    addEventListener: winTarget.addEventListener,
    removeEventListener: winTarget.removeEventListener,
  };
  const nav = { onLine: true };

  let currentTime = 10_000;
  let calls = 0;

  const poller = createVisibilityPoller(
    () => {
      calls += 1;
    },
    {
      intervalMs: 60_000,
      minWakeGapMs: 2_000,
      runImmediately: true,
      doc,
      win,
      nav,
      now: () => currentTime,
    }
  );

  assert.equal(calls, 1, "should run immediately when visible & online");

  // Hide page -> should not run
  doc.hidden = true;
  docTarget.dispatch("visibilitychange");
  assert.equal(calls, 1);

  // Return to visible within minWakeGapMs -> coalesced (skipped)
  currentTime += 500;
  doc.hidden = false;
  docTarget.dispatch("visibilitychange");
  assert.equal(calls, 1);

  // Hide and return after minWakeGapMs -> triggers single foreground re-sync
  doc.hidden = true;
  docTarget.dispatch("visibilitychange");
  currentTime += 3_000;
  doc.hidden = false;
  docTarget.dispatch("visibilitychange");
  assert.equal(calls, 2);

  // Going offline blocks triggerNow until online again
  nav.onLine = false;
  winTarget.dispatch("offline");
  poller.triggerNow();
  assert.equal(calls, 2);

  currentTime += 3_000;
  nav.onLine = true;
  winTarget.dispatch("online");
  assert.equal(calls, 3);

  poller.stop();
});

test("buildPlayersRevisionSignature detects relevant changes without full JSON.stringify", () => {
  const base = [
    {
      id: "p1",
      name: "Agente A",
      hp: { current: 20, max: 26 },
      pe: { current: 10, max: 10 },
      sm: { current: 34, max: 34 },
      ep: 15,
      lv: 2,
      variables: { VIT: 1, SAN: 1 },
      statusEffects: [{ id: "e1", label: "Sangrando" }],
      history: ["<b>12</b>"],
    },
  ];

  const sig1 = buildPlayersRevisionSignature(base);
  const sigSame = buildPlayersRevisionSignature([
    {
      ...base[0],
      hp: { current: 20, max: 26 },
    },
  ]);
  assert.equal(sig1, sigSame);

  const sigLvChanged = buildPlayersRevisionSignature([
    {
      ...base[0],
      lv: 3,
    },
  ]);
  assert.notEqual(sig1, sigLvChanged);

  const sigHistoryChanged = buildPlayersRevisionSignature([
    {
      ...base[0],
      history: ["<b>18</b>"],
    },
  ]);
  assert.notEqual(sig1, sigHistoryChanged);
});
