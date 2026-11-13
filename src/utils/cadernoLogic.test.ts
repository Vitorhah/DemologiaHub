import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCase,
  deduceElementFromPhenomena,
  calculateCaseProgress,
  resolveNodeLabel,
  buildStarterCase,
} from './cadernoLogic';

test('normalizeCase safely upgrades legacy v1 cases with missing arrays and fields', () => {
  const legacyRaw = {
    id: 'legacy_1',
    title: 'Caso Antigo',
    status: 'ativo',
    aff: 'dor',
    loc: 'Hospital Velho',
    lead: 'Agente K',
    date: '10/05',
    desc: 'Relato antigo',
    notes: 'Anotação simples',
    clues: [
      { t: 'Bisturi enferrujado', ok: true },
      { t: 'Pegada na lama', ok: false },
    ],
  };

  const normalized = normalizeCase(legacyRaw);
  assert.equal(normalized.id, 'legacy_1');
  assert.equal(normalized.clues.length, 2);
  assert.equal(normalized.clues[0].id, 'legacy_1_clue_0');
  assert.equal(normalized.clues[0].rel, 'confirmada');
  assert.equal(normalized.clues[0].type, 'fisica');
  assert.equal(normalized.clues[1].rel, 'suspeita');
  assert.deepEqual(normalized.suspects, []);
  assert.deepEqual(normalized.timeline, []);
  assert.deepEqual(normalized.connections, []);
  assert.deepEqual(normalized.phenomena, []);
  assert.deepEqual(normalized.theories, []);
});

test('deduceElementFromPhenomena ranks paranormal elements accurately by observed signs', () => {
  const emptyResult = deduceElementFromPhenomena([]);
  assert.deepEqual(emptyResult, []);

  // Signs pointing strongly to Alma ('queda_termica' + 'frequencia_emf_vozes')
  const almaDeduction = deduceElementFromPhenomena(['queda_termica', 'frequencia_emf_vozes']);
  assert.ok(almaDeduction.length > 0);
  assert.equal(almaDeduction[0].element, 'alma');
  assert.equal(almaDeduction[0].score, 6);
  assert.ok(almaDeduction[0].confidence >= 80);

  // Signs pointing strongly to Dor ('hemorragia_anomala' + 'laceracoes_simetricas')
  const dorDeduction = deduceElementFromPhenomena(['hemorragia_anomala', 'laceracoes_simetricas']);
  assert.equal(dorDeduction[0].element, 'dor');
  assert.equal(dorDeduction[0].score, 6);
});

test('calculateCaseProgress computes solvability, false clues exclusion, and rank code', () => {
  const starter = buildStarterCase();
  const metrics = calculateCaseProgress(starter);

  assert.equal(metrics.activeClues, 4);
  assert.equal(metrics.confirmedClues, 2);
  assert.equal(metrics.falseClues, 0);
  assert.equal(metrics.highSuspicionCount, 1);
  assert.equal(metrics.verifiedEvents, 3);
  assert.equal(metrics.connectionsCount, 2);
  assert.equal(metrics.topElement, 'alma');
  assert.ok(metrics.solvabilityPercent >= 50 && metrics.solvabilityPercent <= 99);

  // Archived case always reports 100% solvability
  const archived = normalizeCase({ ...starter, status: 'arquivado' });
  const archivedMetrics = calculateCaseProgress(archived);
  assert.equal(archivedMetrics.solvabilityPercent, 100);
  assert.equal(archivedMetrics.rankCode, 'S-VERITAS');
});

test('resolveNodeLabel resolves both clue and suspect endpoints for Mindboard connections', () => {
  const starter = buildStarterCase();
  const clueNode = resolveNodeLabel(starter, starter.clues[0].id);
  assert.ok(clueNode);
  assert.equal(clueNode.kind, 'clue');
  assert.equal(clueNode.badge, 'PISTA #01');

  const suspectNode = resolveNodeLabel(starter, starter.suspects[0].id);
  assert.ok(suspectNode);
  assert.equal(suspectNode.kind, 'suspect');
  assert.equal(suspectNode.label, 'Helena Vasconcelos (Chefe de Turno)');

  const missingNode = resolveNodeLabel(starter, 'non_existent_id');
  assert.equal(missingNode, null);
});
