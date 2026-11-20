import test from "node:test";
import assert from "node:assert/strict";
import {
  WAKE_LOCK_PREF_KEY,
  WakeLockController,
  WakeLockSentinelLike,
  detectWakeLockMode,
  readWakeLockPreference,
  writeWakeLockPreference,
} from "./wakeLock";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function createFakeDoc() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState: "visible" as DocumentVisibilityState,
    body: {
      appendChild() {},
    } as unknown as HTMLElement,
    createElement() {
      return {
        setAttribute() {},
        removeAttribute() {},
        load() {},
        pause() {},
        play: async () => {},
        style: {},
        parentNode: null,
      } as unknown as HTMLVideoElement;
    },
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

function createFakeWin() {
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

test("WakeLockController acquires native lock, saves preference, and reacquires on visibilitychange", async () => {
  const storage = createMemoryStorage();
  const doc = createFakeDoc();
  const win = createFakeWin();

  let requestCount = 0;
  let releaseCount = 0;
  let releaseHandler: (() => void) | null = null;

  const nav = {
    wakeLock: {
      request: async (): Promise<WakeLockSentinelLike> => {
        requestCount += 1;
        return {
          release: async () => {
            releaseCount += 1;
          },
          addEventListener: (_type, fn) => {
            releaseHandler = fn;
          },
          removeEventListener: () => {
            releaseHandler = null;
          },
        };
      },
    },
  };

  assert.equal(detectWakeLockMode(nav, true), "native");

  const ctrl = new WakeLockController({ nav, doc, win, storage });
  ctrl.attach();

  // Enable via user toggle
  const stateOn = await ctrl.toggle();
  assert.equal(stateOn.enabled, true);
  assert.equal(stateOn.active, true);
  assert.equal(stateOn.mode, "native");
  assert.equal(requestCount, 1);
  assert.equal(storage.getItem(WAKE_LOCK_PREF_KEY), "1");
  assert.equal(readWakeLockPreference(storage), true);

  // Simulate OS releasing wake lock when tab goes to background
  doc.visibilityState = "hidden";
  releaseHandler?.();
  assert.equal(ctrl.getState().active, false);

  // Return to foreground -> auto reacquires
  doc.visibilityState = "visible";
  doc.dispatch("visibilitychange");
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(requestCount, 2);
  assert.equal(ctrl.getState().active, true);

  // Toggle off -> releases lock and updates storage
  const stateOff = await ctrl.toggle();
  assert.equal(stateOff.enabled, false);
  assert.equal(stateOff.active, false);
  assert.equal(releaseCount, 1);
  assert.equal(storage.getItem(WAKE_LOCK_PREF_KEY), "0");

  ctrl.detach();
});

test("WakeLockController falls back cleanly when navigator.wakeLock is unavailable", async () => {
  const storage = createMemoryStorage();
  const doc = createFakeDoc();
  const win = createFakeWin();

  writeWakeLockPreference(false, storage);
  assert.equal(detectWakeLockMode({}, true), "fallback");
  assert.equal(detectWakeLockMode({}, false), "unsupported");

  const ctrl = new WakeLockController({
    nav: {},
    doc,
    win,
    storage,
    enableVideoFallback: true,
  });
  ctrl.attach();

  const res = await ctrl.setEnabled(true);
  assert.equal(res.enabled, true);
  assert.equal(res.active, true);
  assert.equal(res.mode, "fallback");

  await ctrl.setEnabled(false);
  assert.equal(ctrl.getState().active, false);
  ctrl.detach();
});

test("WakeLockController resets enabled to false and reports error when OS blocks both native and fallback", async () => {
  const storage = createMemoryStorage();
  const doc = createFakeDoc();
  const win = createFakeWin();

  const ctrl = new WakeLockController({
    nav: {
      wakeLock: {
        request: async () => {
          throw new Error("OS battery saver blocked wake lock");
        },
      },
    },
    doc,
    win,
    storage,
    enableVideoFallback: false,
  });
  ctrl.attach();

  const res = await ctrl.toggle();
  assert.equal(res.enabled, false);
  assert.equal(res.active, false);
  assert.ok(res.errorMessage && res.errorMessage.length > 0);
  assert.equal(readWakeLockPreference(storage), false);
  ctrl.detach();
});
