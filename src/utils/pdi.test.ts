import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStatFormulaWithPdis,
  DEFAULT_PDIS,
  DEMOLOGIA_STAT_KEYS,
  formatPdiModifierChips,
  getActivePdiBadgesForStat,
  normalizePdis,
  PdiItem,
  protectPlayerPdisOnSave,
  removePdiItem,
  togglePdiActive,
  upsertPdiItem,
} from "./pdi";
import { evaluateDiceFormula } from "./diceFormula";

test("normalizePdis sanitizes valid/invalid dice, flat values, and fallback cleanly", () => {
  assert.equal(DEMOLOGIA_STAT_KEYS.length, 6);
  const fromFallback = normalizePdis(undefined, DEFAULT_PDIS);
  assert.equal(fromFallback.length, 1);
  assert.equal(fromFallback[0].id, "pdi_ladino");

  const sanitized = normalizePdis([
    {
      id: "p1",
      name: "  Transe Ritualístico  ",
      desc: "  Em presença paranormal forte ",
      active: true,
      modifiers: {
        OCU: { buffDice: "+1D6", buffFlat: 2 },
        SAN: { debuffDice: "-1d4", debuffFlat: 1 },
        AGL: { buffDice: "99d100", buffFlat: -5 }, // invalid -> dropped
        FAKE_STAT: { buffDice: "1d6" }, // unknown stat -> ignored
      },
    },
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].name, "Transe Ritualístico");
  assert.equal(sanitized[0].modifiers.OCU?.buffDice, "1d6");
  assert.equal(sanitized[0].modifiers.OCU?.buffFlat, 2);
  assert.equal(sanitized[0].modifiers.SAN?.debuffDice, "1d4");
  assert.equal(sanitized[0].modifiers.SAN?.debuffFlat, 1);
  assert.equal(sanitized[0].modifiers.AGL, undefined);
});

test("buildStatFormulaWithPdis and getActivePdiBadgesForStat only reflect active PDIs", () => {
  const pdis: PdiItem[] = [
    {
      id: "pdi_transe",
      name: "Transe Ritualístico",
      desc: "Presença forte",
      active: true,
      modifiers: {
        OCU: { buffDice: "1d6", buffFlat: 1 },
        SAN: { debuffDice: "1d4" },
      },
    },
    {
      id: "pdi_off",
      name: "Desligado",
      desc: "Inativo",
      active: false,
      modifiers: {
        OCU: { buffDice: "1d20" },
      },
    },
  ];

  assert.equal(buildStatFormulaWithPdis("OCU", 3, pdis), "(3+1+1D6)");
  assert.equal(buildStatFormulaWithPdis("SAN", 2, pdis), "(2-1D4)");
  assert.equal(buildStatFormulaWithPdis("FOR", 4, pdis), "4");

  const ocuBadges = getActivePdiBadgesForStat("OCU", pdis);
  assert.equal(ocuBadges.length, 2);
  assert.equal(ocuBadges[0].label, "+1");
  assert.equal(ocuBadges[1].label, "+1D6");

  const chips = formatPdiModifierChips(pdis[0].modifiers);
  assert.equal(chips.length, 3);
});

test("evaluateDiceFormula applies active PDI buffs and debuffs without falsely triggering base 1d4 crit", () => {
  const activeLadino: PdiItem[] = [
    {
      id: "pdi_ladino",
      name: "Ladino",
      desc: "Nas sombras",
      active: true,
      modifiers: {
        AGL: { buffDice: "1d4", buffFlat: 1 },
      },
    },
  ];

  // Sequence: first rng call is PDI 1d4 (rolls 4 -> max on 1d4),
  // next two rng calls are base 2d6 (rolls 2 and 5 -> non-double normal roll).
  const seq = [0.99, 0.2, 0.75];
  let idx = 0;
  const res = evaluateDiceFormula("2d6+AGL", { AGL: 2 }, () => seq[idx++], activeLadino);
  assert.ok(res);
  // Base 2d6 (2 + 5 = 7) + AGL(2) + flat(1) + PDI 1d4(4) = 14
  assert.equal(res.result, 14);
  // Crucial: PDI 1d4 rolling 4 must NOT trigger base 1d4 +5 crit on a 2d6 dodge roll!
  assert.equal(res.critical, "normal");
  assert.equal(res.critBonus, 0);
  assert.match(res.details, /AGL\(2\+1\+1D4\)/);
  assert.match(res.details, /PDI\(Ladino\) \+1D4\[4\]/);
});

test("evaluateDiceFormula subtracts active PDI debuff dice and flat penalties accurately", () => {
  const debuffPdi: PdiItem[] = [
    {
      id: "pdi_transe",
      name: "Transe",
      desc: "Debuff em SAN",
      active: true,
      modifiers: {
        SAN: { debuffDice: "1d4", debuffFlat: 1 },
      },
    },
  ];

  // PDI 1d4 rolls 3 (0.6 -> floor(2.4)+1 = 3), base 1d20 rolls 15 (0.7 -> floor(14)+1 = 15)
  const seq = [0.6, 0.7];
  let idx = 0;
  const res = evaluateDiceFormula("1d20+SAN", { SAN: 4 }, () => seq[idx++], debuffPdi);
  assert.ok(res);
  // 15 + (4 - 1 - 3) = 15
  assert.equal(res.result, 15);
  assert.match(res.details, /SAN\(4-1-1D4\)/);
  assert.match(res.details, /PDI\(Transe\) -1D4\[3\]/);
});

test("protectPlayerPdisOnSave lets players toggle active but blocks non-Master structural tampering", () => {
  const auth: PdiItem[] = [
    {
      id: "pdi_1",
      name: "Ladino",
      desc: "Nas sombras",
      active: false,
      modifiers: { AGL: { buffDice: "1d4" } },
    },
  ];

  // Player toggles active=true AND tries to tamper with buffDice & add a fake PDI
  const tamperedCandidate = {
    name: "Agente",
    pdis: [
      {
        id: "pdi_1",
        name: "Hacker",
        desc: "Alterado",
        active: true,
        modifiers: { AGL: { buffDice: "1d20", buffFlat: 50 } },
      },
      {
        id: "pdi_fake",
        name: "Deus",
        desc: "Fake",
        active: true,
        modifiers: { FOR: { buffFlat: 99 } },
      },
    ],
  };

  const protectedForPlayer = protectPlayerPdisOnSave(tamperedCandidate, auth, false);
  assert.equal(protectedForPlayer.pdis.length, 1);
  assert.equal(protectedForPlayer.pdis[0].name, "Ladino");
  assert.equal(protectedForPlayer.pdis[0].modifiers.AGL?.buffDice, "1d4");
  assert.equal(protectedForPlayer.pdis[0].modifiers.AGL?.buffFlat, undefined);
  // Player's active toggle IS preserved!
  assert.equal(protectedForPlayer.pdis[0].active, true);

  // Master edits are allowed through cleanly
  const masterSaved = protectPlayerPdisOnSave(tamperedCandidate, auth, true);
  assert.equal(masterSaved.pdis.length, 2);
  assert.equal(masterSaved.pdis[0].modifiers.AGL?.buffDice, "1d20");
});

test("togglePdiActive, upsertPdiItem, and removePdiItem update PDI lists immutably", () => {
  const toggled = togglePdiActive(DEFAULT_PDIS, "pdi_ladino");
  assert.equal(toggled[0].active, true);
  assert.equal(DEFAULT_PDIS[0].active, false);

  const added = upsertPdiItem(toggled, {
    id: "pdi_foco",
    name: "Foco Investigativo",
    desc: "Examinando pistas",
    active: false,
    modifiers: { INT: { buffDice: "1d6" }, AGL: { debuffDice: "1d4" } },
  });
  assert.equal(added.length, 2);

  const removed = removePdiItem(added, "pdi_ladino");
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, "pdi_foco");
});
