import test from "node:test";
import assert from "node:assert/strict";
import {
  clearMasterAuthFailures,
  computeMasterLockoutMs,
  constantTimeEqual,
  getMasterLockoutRemainingSeconds,
  isValidModeConfigPayload,
  isValidTargetBroadcastPayload,
  readMasterAuthThrottle,
  recordMasterAuthFailure,
  sanitizeImportedSheetJson,
  sanitizeRollHistoryHtml,
} from "./security";

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

test("sanitizeRollHistoryHtml preserves legitimate Demologia roll formatting", () => {
  const safe =
    '<span style="color: #ff4444; font-weight: bold;">CRÍTICO!</span> 2d6+AGL = <b>14</b><br>Detalhe';
  const out = sanitizeRollHistoryHtml(safe);
  assert.match(out, /<span style="color: #ff4444; font-weight: bold">CRÍTICO!<\/span>/);
  assert.match(out, /<b>14<\/b>/);
  assert.match(out, /<br \/>Detalhe/);
});

test("sanitizeRollHistoryHtml neutralizes script tags, img onerror, svg, and malicious styles", () => {
  const xss1 = '<script>alert("xss")</script><span>Roll: 12</span>';
  assert.equal(sanitizeRollHistoryHtml(xss1), "<span>Roll: 12</span>");

  const xss2 = '<img src=x onerror="fetch(\'https://evil.test\')"><b>OK</b>';
  const out2 = sanitizeRollHistoryHtml(xss2);
  assert.ok(!out2.includes("<img"));
  assert.ok(!out2.includes("onerror"));
  assert.equal(out2, "<b>OK</b>");

  const xss3 =
    '<span onclick="alert(1)" style="color: #fff; background: url(javascript:alert(1))">Texto</span>';
  const out3 = sanitizeRollHistoryHtml(xss3);
  assert.ok(!out3.includes("onclick"));
  assert.ok(!out3.includes("javascript:"));
  assert.ok(!out3.includes("url("));
  assert.equal(out3, "<span>Texto</span>");

  const xss4 = '<svg onload="alert(1)"><script>bad()</script></svg>Limpo';
  assert.equal(sanitizeRollHistoryHtml(xss4), "Limpo");
});

test("sanitizeRollHistoryHtml auto-closes unclosed tags safely", () => {
  const out = sanitizeRollHistoryHtml('<span style="color: #ffaa00;">Aviso sem fechar');
  assert.equal(out, '<span style="color: #ffaa00">Aviso sem fechar</span>');
});

test("sanitizeImportedSheetJson blocks oversized files, prototype pollution, and XSS in history", () => {
  const tooLarge = "x".repeat(600 * 1024);
  const resLarge = sanitizeImportedSheetJson(tooLarge);
  assert.equal(resLarge.ok, false);

  const rawMalicious =
    '{"hp":{"current":20,"max":26},"pe":{"current":10,"max":10},"__proto__":{"polluted":true},"history":["<img src=x onerror=alert(1)><b>10</b>","<script>evil()</script>"]}';
  const res = sanitizeImportedSheetJson(rawMalicious);
  assert.equal(res.ok, true);
  assert.ok(res.sheet);
  assert.equal(Object.prototype.hasOwnProperty.call(res.sheet, "__proto__"), false);
  assert.equal(({} as any).polluted, undefined);
  assert.deepEqual(res.sheet.history, ["<b>10</b>"]);
});

test("broadcast payload validators reject malformed or unexpected payloads", () => {
  assert.equal(isValidModeConfigPayload({ globalMode: "demologia" }), true);
  assert.equal(
    isValidModeConfigPayload({ globalMode: "rl", playerModes: { p1: "demologia" }, skipTransition: true }),
    true
  );
  assert.equal(
    isValidModeConfigPayload({ globalMode: "rl", skipTransition: "true" as unknown as boolean }),
    false
  );
  assert.equal(isValidModeConfigPayload({ globalMode: "hacked" }), false);
  assert.equal(
    isValidModeConfigPayload({ globalMode: "demologia", playerModes: { p1: "invalid" } }),
    false
  );

  assert.equal(isValidTargetBroadcastPayload({ playerId: "player-123", lv: 2 }), true);
  assert.equal(isValidTargetBroadcastPayload({ playerId: "" }), false);
  assert.equal(isValidTargetBroadcastPayload(null), false);
});

test("constantTimeEqual verifies exact strings accurately", () => {
  assert.equal(constantTimeEqual("segredo123", "segredo123"), true);
  assert.equal(constantTimeEqual("segredo123", "segredo124"), false);
  assert.equal(constantTimeEqual("segredo", "segredo123"), false);
  assert.equal(constantTimeEqual("", ""), true);
});

test("Master auth progressive lockout escalates at 3, 4, and 5+ failed attempts and resets on clear", () => {
  const storage = createMemoryStorage();
  const baseTime = 1_000_000;

  assert.equal(computeMasterLockoutMs(1), 0);
  assert.equal(computeMasterLockoutMs(2), 0);
  assert.equal(computeMasterLockoutMs(3), 5_000);
  assert.equal(computeMasterLockoutMs(4), 15_000);
  assert.equal(computeMasterLockoutMs(5), 30_000);

  let st = recordMasterAuthFailure(baseTime, storage);
  assert.equal(st.failedAttempts, 1);
  assert.equal(getMasterLockoutRemainingSeconds(st, baseTime), 0);

  st = recordMasterAuthFailure(baseTime, storage);
  assert.equal(st.failedAttempts, 2);
  assert.equal(getMasterLockoutRemainingSeconds(st, baseTime), 0);

  st = recordMasterAuthFailure(baseTime, storage);
  assert.equal(st.failedAttempts, 3);
  assert.equal(getMasterLockoutRemainingSeconds(st, baseTime), 5);
  assert.equal(getMasterLockoutRemainingSeconds(st, baseTime + 5_001), 0);

  st = recordMasterAuthFailure(baseTime + 6_000, storage);
  assert.equal(st.failedAttempts, 4);
  assert.equal(getMasterLockoutRemainingSeconds(st, baseTime + 6_000), 15);

  clearMasterAuthFailures(storage);
  assert.deepEqual(readMasterAuthThrottle(storage), { failedAttempts: 0, lockedUntil: 0 });
});
