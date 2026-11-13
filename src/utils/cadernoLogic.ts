import {
  AffiliationType,
  CadernoCase,
  CadernoClue,
  CadernoConnection,
  CadernoSuspect,
  CadernoTheory,
  CadernoTimelineEvent,
  CaseDangerLevel,
  CaseStatus,
  ClueReliability,
  ClueType,
  PhenomenonDefinition,
  SuspectRole,
  TheoryStatus,
} from '../types/caderno';

export const CADERNO_PHENOMENA: PhenomenonDefinition[] = [
  {
    id: 'hemorragia_anomala',
    label: 'Hemorragia Anômala / Sangue Coagulado Quente',
    category: 'biologico',
    desc: 'Manchas ou poças sanguíneas que permanecem aquecidas ou formam padrões geométricos.',
    affinities: ['dor', 'corpo'],
    weight: 3,
  },
  {
    id: 'laceracoes_simetricas',
    label: 'Lacerações Simétricas / Trauma Impossível',
    category: 'biologico',
    desc: 'Cortes cirúrgicos ou marcas de garras que ignoram barreiras físicas ou armaduras.',
    affinities: ['dor'],
    weight: 3,
  },
  {
    id: 'queda_termica',
    label: 'Queda Brusca de Temperatura (< 0°C)',
    category: 'ambiental',
    desc: 'Formação súbita de geada em superfícies e condensação da respiração em ambiente fechado.',
    affinities: ['alma', 'medo'],
    weight: 3,
  },
  {
    id: 'frequencia_emf_vozes',
    label: 'Vozes em Rádio / Ruído Branco Estruturado',
    category: 'oculto',
    desc: 'Sussurros inteligíveis captados em gravadores analógicos, rádios ou telefones desligados.',
    affinities: ['alma'],
    weight: 3,
  },
  {
    id: 'sombras_estaticas',
    label: 'Sombras Estáticas / Escuridão Densa',
    category: 'ambiental',
    desc: 'Silhuetas projetadas contra a fonte de luz ou bolsões onde lanternas perdem alcance.',
    affinities: ['medo'],
    weight: 3,
  },
  {
    id: 'amnesia_panico',
    label: 'Amnésia Seletiva / Paralisia nas Testemunhas',
    category: 'psiquico',
    desc: 'Sobreviventes incapazes de recordar rostos ou horários específicos, acompanhado de terror agudo.',
    affinities: ['medo', 'membrana'],
    weight: 2,
  },
  {
    id: 'euforia_hipnotica',
    label: 'Euforia Delirante / Devoção Hipnótica',
    category: 'psiquico',
    desc: 'Vítimas ou suspeitos demonstram calma absoluta, sorrisos fixos e ausência de reflexo de dor.',
    affinities: ['nirvana'],
    weight: 3,
  },
  {
    id: 'luzes_fractais',
    label: 'Refração Luminosa / Padrões Fractais',
    category: 'oculto',
    desc: 'Distúrbios ópticos dourados ou iridescentes que causam vertigem e fascínio visual.',
    affinities: ['nirvana', 'membrana'],
    weight: 2,
  },
  {
    id: 'biomassa_mutacao',
    label: 'Resíduo de Biomassa / Hipertrofia Óssea',
    category: 'biologico',
    desc: 'Crescimento anormal de tecido muscular, quitina ou fibras orgânicas fundidas ao ambiente.',
    affinities: ['corpo'],
    weight: 3,
  },
  {
    id: 'regeneracao_esporos',
    label: 'Regeneração Tecidual / Esporos Luminescentes',
    category: 'biologico',
    desc: 'Cicatrização acelerada e presença de flora fúngica ou pólen bioativo na cena.',
    affinities: ['cura'],
    weight: 3,
  },
  {
    id: 'vitalidade_parasitaria',
    label: 'Sinais Vitais Hiperativos em Cadáveres',
    category: 'biologico',
    desc: 'Atividade celular persistente horas após o óbito clínico confirmado.',
    affinities: ['cura', 'corpo'],
    weight: 2,
  },
  {
    id: 'distorcao_cronologica',
    label: 'Falha em Relógios / Distorção de Tempo',
    category: 'oculto',
    desc: 'Relógios parados no mesmo minuto ou discrepância entre o tempo percebido e o tempo real.',
    affinities: ['membrana'],
    weight: 3,
  },
  {
    id: 'geometria_impossivel',
    label: 'Geometria Não-Euclidiana / Eco Espacial',
    category: 'ambiental',
    desc: 'Corredores mais longos por dentro do que por fora, portas que levam ao mesmo cômodo.',
    affinities: ['membrana', 'medo'],
    weight: 3,
  },
  {
    id: 'simbolos_esotericos',
    label: 'Sigilos de Transmutação / Ritualística',
    category: 'oculto',
    desc: 'Inscrições ocultas desenhadas com cinzas, sangue ou entalhadas em concreto.',
    affinities: ['dor', 'alma', 'membrana'],
    weight: 2,
  },
];

export interface FieldNoteTemplate {
  id: string;
  label: string;
  snippet: string;
}

export const FIELD_NOTE_TEMPLATES: FieldNoteTemplate[] = [
  {
    id: 'cena_crime',
    label: '+ Cena do Crime',
    snippet:
      '\n[INSPEÇÃO DE CENA]\n• Condição do Ambiente: \n• Ponto de Entrada/Saída: \n• Vestígios Físicos Localizados: \n• Anomalias Sensoriais: \n',
  },
  {
    id: 'interrogatorio',
    label: '+ Interrogatório',
    snippet:
      '\n[REGISTRO DE DEPOIMENTO]\n• Depoente / Cargo: \n• Álibi Declarado: \n• Comportamento / Reação: \n• Contradições Detectadas: \n',
  },
  {
    id: 'autopsia',
    label: '+ Exame Forense',
    snippet:
      '\n[LAUDO FORENSE / PERÍCIA]\n• Alvo / Amostra: \n• Hora Estimada do Evento: \n• Causa Aparente vs. Oculta: \n• Conclusão Técnica: \n',
  },
  {
    id: 'plano_acao',
    label: '+ Plano Tático',
    snippet:
      '\n[DIRETRIZ OPERACIONAL]\n• Hipótese Principal: \n• Equipamento Necessário: \n• Risco de Exposição: \n• Próximo Passo da Equipe: \n',
  },
];

const VALID_AFFILIATIONS: AffiliationType[] = [
  'none',
  'dor',
  'medo',
  'nirvana',
  'corpo',
  'cura',
  'alma',
  'membrana',
];

const VALID_STATUSES: CaseStatus[] = ['ativo', 'arquivado', 'critico'];
const VALID_DANGERS: CaseDangerLevel[] = ['baixo', 'medio', 'alto', 'extremo'];
const VALID_CLUE_TYPES: ClueType[] = ['fisica', 'testemunho', 'oculta', 'forense', 'documento', 'local'];
const VALID_RELIABILITIES: ClueReliability[] = ['confirmada', 'suspeita', 'falsa'];
const VALID_SUSPECT_ROLES: SuspectRole[] = ['suspeito', 'testemunha', 'vitima', 'aliado', 'culpado'];
const VALID_THEORY_STATUSES: TheoryStatus[] = ['aberta', 'comprovada', 'refutada'];

export function normalizeClue(raw: any, index: number, caseId: string): CadernoClue {
  const ok = Boolean(raw?.ok);
  const rawType = VALID_CLUE_TYPES.includes(raw?.type) ? (raw.type as ClueType) : 'fisica';
  const rawRel: ClueReliability = VALID_RELIABILITIES.includes(raw?.rel)
    ? (raw.rel as ClueReliability)
    : ok
      ? 'confirmada'
      : 'suspeita';

  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : `${caseId}_clue_${index}`,
    t: typeof raw?.t === 'string' ? raw.t : '',
    ok,
    type: rawType,
    rel: rawRel,
    loc: typeof raw?.loc === 'string' ? raw.loc : '',
    foundBy: typeof raw?.foundBy === 'string' ? raw.foundBy : '',
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    createdAt: typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
}

export function normalizeSuspect(raw: any, index: number, caseId: string): CadernoSuspect {
  const role: SuspectRole = VALID_SUSPECT_ROLES.includes(raw?.role) ? raw.role : 'suspeito';
  const rawSuspicion = typeof raw?.suspicion === 'number' ? raw.suspicion : 50;
  const suspicion = Math.max(0, Math.min(100, Math.round(rawSuspicion)));

  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : `${caseId}_susp_${index}`,
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name : 'Indivíduo Não Identificado',
    role,
    suspicion,
    alibi: typeof raw?.alibi === 'string' ? raw.alibi : '',
    motive: typeof raw?.motive === 'string' ? raw.motive : '',
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    linkedClueIds: Array.isArray(raw?.linkedClueIds)
      ? raw.linkedClueIds.filter((id: any) => typeof id === 'string')
      : [],
  };
}

export function normalizeTimelineEvent(raw: any, index: number, caseId: string): CadernoTimelineEvent {
  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : `${caseId}_time_${index}`,
    time: typeof raw?.time === 'string' && raw.time.trim() ? raw.time : '00:00',
    title: typeof raw?.title === 'string' ? raw.title : 'Evento registrado',
    desc: typeof raw?.desc === 'string' ? raw.desc : '',
    verified: Boolean(raw?.verified),
  };
}

export function normalizeConnection(raw: any, index: number, caseId: string): CadernoConnection {
  const validColors = ['red', 'amber', 'emerald', 'cyan'] as const;
  const color = validColors.includes(raw?.color) ? raw.color : 'red';
  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : `${caseId}_conn_${index}`,
    fromId: typeof raw?.fromId === 'string' ? raw.fromId : '',
    toId: typeof raw?.toId === 'string' ? raw.toId : '',
    label: typeof raw?.label === 'string' && raw.label.trim() ? raw.label : 'Vínculo Direto',
    color,
  };
}

export function normalizeTheory(raw: any, index: number, caseId: string): CadernoTheory {
  const status: TheoryStatus = VALID_THEORY_STATUSES.includes(raw?.status) ? raw.status : 'aberta';
  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : `${caseId}_theo_${index}`,
    statement: typeof raw?.statement === 'string' ? raw.statement : '',
    status,
    createdAt: typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
}

export function normalizeCase(raw: any): CadernoCase {
  const id = typeof raw?.id === 'string' && raw.id.trim() ? raw.id : `case_${Date.now()}`;
  const status: CaseStatus = VALID_STATUSES.includes(raw?.status) ? raw.status : 'ativo';
  const danger: CaseDangerLevel = VALID_DANGERS.includes(raw?.danger) ? raw.danger : 'medio';
  const aff: AffiliationType = VALID_AFFILIATIONS.includes(raw?.aff) ? raw.aff : 'none';

  const clues: CadernoClue[] = Array.isArray(raw?.clues)
    ? raw.clues
        .filter((c: any) => c && typeof c.t === 'string')
        .map((c: any, idx: number) => normalizeClue(c, idx, id))
    : [];

  const suspects: CadernoSuspect[] = Array.isArray(raw?.suspects)
    ? raw.suspects
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any, idx: number) => normalizeSuspect(s, idx, id))
    : [];

  const timeline: CadernoTimelineEvent[] = Array.isArray(raw?.timeline)
    ? raw.timeline
        .filter((t: any) => t && typeof t === 'object')
        .map((t: any, idx: number) => normalizeTimelineEvent(t, idx, id))
    : [];

  const connections: CadernoConnection[] = Array.isArray(raw?.connections)
    ? raw.connections
        .filter((conn: any) => conn && typeof conn.fromId === 'string' && typeof conn.toId === 'string')
        .map((conn: any, idx: number) => normalizeConnection(conn, idx, id))
    : [];

  const phenomena: string[] = Array.isArray(raw?.phenomena)
    ? raw.phenomena.filter((p: any) => typeof p === 'string')
    : [];

  const theories: CadernoTheory[] = Array.isArray(raw?.theories)
    ? raw.theories
        .filter((th: any) => th && typeof th.statement === 'string')
        .map((th: any, idx: number) => normalizeTheory(th, idx, id))
    : [];

  return {
    id,
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title : 'Caso Sem Título',
    status,
    danger,
    aff,
    loc: typeof raw?.loc === 'string' ? raw.loc : '',
    lead: typeof raw?.lead === 'string' ? raw.lead : '',
    date: typeof raw?.date === 'string' ? raw.date : '',
    desc: typeof raw?.desc === 'string' ? raw.desc : '',
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    clues,
    suspects,
    timeline,
    connections,
    phenomena,
    theories,
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

export interface ElementDeductionResult {
  element: AffiliationType;
  score: number;
  confidence: number; // 0 to 100
  matchedLabels: string[];
}

export function deduceElementFromPhenomena(phenomenaIds: string[]): ElementDeductionResult[] {
  if (!Array.isArray(phenomenaIds) || phenomenaIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(phenomenaIds));
  const scores: Record<Exclude<AffiliationType, 'none'>, { score: number; matchedLabels: string[] }> = {
    dor: { score: 0, matchedLabels: [] },
    medo: { score: 0, matchedLabels: [] },
    nirvana: { score: 0, matchedLabels: [] },
    corpo: { score: 0, matchedLabels: [] },
    cura: { score: 0, matchedLabels: [] },
    alma: { score: 0, matchedLabels: [] },
    membrana: { score: 0, matchedLabels: [] },
  };

  let totalWeightPossible = 0;

  for (const id of uniqueIds) {
    const def = CADERNO_PHENOMENA.find((p) => p.id === id);
    if (!def) continue;
    totalWeightPossible += def.weight;
    for (const aff of def.affinities) {
      if (aff !== 'none' && scores[aff]) {
        scores[aff].score += def.weight;
        scores[aff].matchedLabels.push(def.label);
      }
    }
  }

  if (totalWeightPossible === 0) return [];

  const results: ElementDeductionResult[] = (Object.keys(scores) as Exclude<AffiliationType, 'none'>[])
    .filter((el) => scores[el].score > 0)
    .map((el) => {
      // Max reasonable score for a single element is around 8-9 points (3 phenomena * weight 3)
      const normConfidence = Math.min(100, Math.round((scores[el].score / Math.max(6, totalWeightPossible * 0.75)) * 100));
      return {
        element: el,
        score: scores[el].score,
        confidence: normConfidence,
        matchedLabels: scores[el].matchedLabels,
      };
    })
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  return results;
}

export interface CaseProgressMetrics {
  solvabilityPercent: number;
  confirmedClues: number;
  activeClues: number;
  falseClues: number;
  highSuspicionCount: number;
  verifiedEvents: number;
  connectionsCount: number;
  provenTheories: number;
  topElement: AffiliationType;
  topConfidence: number;
  rankCode: string;
  statusSummary: string;
}

export function calculateCaseProgress(rawCase: CadernoCase): CaseProgressMetrics {
  const c = normalizeCase(rawCase);

  const falseClues = c.clues.filter((cl) => cl.rel === 'falsa').length;
  const validClues = c.clues.filter((cl) => cl.rel !== 'falsa');
  const activeClues = validClues.length;
  const confirmedClues = validClues.filter((cl) => cl.ok || cl.rel === 'confirmada').length;

  const highSuspicionCount = c.suspects.filter((s) => s.suspicion >= 70 || s.role === 'culpado').length;
  const verifiedEvents = c.timeline.filter((e) => e.verified).length;
  const connectionsCount = c.connections.length;
  const provenTheories = c.theories.filter((t) => t.status === 'comprovada').length;

  const deductions = deduceElementFromPhenomena(c.phenomena);
  const topDeduction = deductions[0];
  const topElement: AffiliationType = topDeduction ? topDeduction.element : c.aff;
  const topConfidence = topDeduction ? topDeduction.confidence : c.aff !== 'none' ? 40 : 0;

  // Weighted investigative progress calculation (0 - 100%)
  let points = 0;
  // Clues contribution (up to 45 pts)
  if (activeClues > 0) {
    const clueRatio = confirmedClues / activeClues;
    points += Math.min(45, Math.round(clueRatio * 35) + Math.min(10, confirmedClues * 3));
  }
  // Connections / Mindboard contribution (up to 15 pts)
  points += Math.min(15, connectionsCount * 5);
  // Suspects dossier contribution (up to 15 pts)
  if (c.suspects.length > 0) {
    points += Math.min(15, c.suspects.length * 3 + highSuspicionCount * 4);
  }
  // Timeline & Phenomena deduction contribution (up to 15 pts)
  points += Math.min(8, verifiedEvents * 4);
  points += Math.min(7, c.phenomena.length * 2);
  // Theories & Field Notes contribution (up to 10 pts)
  if (c.notes.trim().length > 30) points += 4;
  points += Math.min(6, provenTheories * 6 + c.theories.length * 2);

  const solvabilityPercent = c.status === 'arquivado' ? 100 : Math.max(0, Math.min(99, points));

  let rankCode = 'D-INK';
  let statusSummary = 'Coleta Preliminar';
  if (solvabilityPercent >= 85) {
    rankCode = 'S-VERITAS';
    statusSummary = 'Pronto para Conclusão';
  } else if (solvabilityPercent >= 65) {
    rankCode = 'A-NEXUS';
    statusSummary = 'Padrão Oculto Mapeado';
  } else if (solvabilityPercent >= 40) {
    rankCode = 'B-RASTRO';
    statusSummary = 'Conexões em Formação';
  } else if (solvabilityPercent >= 20) {
    rankCode = 'C-CAMPO';
    statusSummary = 'Triagem de Vestígios';
  }

  return {
    solvabilityPercent,
    confirmedClues,
    activeClues,
    falseClues,
    highSuspicionCount,
    verifiedEvents,
    connectionsCount,
    provenTheories,
    topElement,
    topConfidence,
    rankCode,
    statusSummary,
  };
}

export function resolveNodeLabel(
  c: CadernoCase,
  nodeId: string
): { id: string; kind: 'clue' | 'suspect'; label: string; badge: string } | null {
  const clueIdx = c.clues.findIndex((cl) => cl.id === nodeId);
  if (clueIdx !== -1) {
    const cl = c.clues[clueIdx];
    return {
      id: cl.id,
      kind: 'clue',
      label: cl.t,
      badge: `PISTA #${String(clueIdx + 1).padStart(2, '0')}`,
    };
  }
  const susp = c.suspects.find((s) => s.id === nodeId);
  if (susp) {
    return {
      id: susp.id,
      kind: 'suspect',
      label: susp.name,
      badge: susp.role.toUpperCase(),
    };
  }
  return null;
}

export function buildStarterCase(): CadernoCase {
  const caseId = 'case_estacao_subsolo_04';
  return normalizeCase({
    id: caseId,
    title: 'Operação Subsolo 04 — Estação Vespera',
    status: 'ativo',
    danger: 'alto',
    aff: 'alma',
    loc: 'Setor Ferroviário Desativado, Nível -3',
    lead: 'Unidade de Investigação Tática',
    date: '14/10 · 23:40',
    desc: 'Três engenheiros de manutenção desapareceram após relatarem vozes metálicas no túnel de ventilação norte. Os relógios de pulso encontrados na plataforma pararam exatamente às 23:17.',
    notes:
      '[INSPEÇÃO DE CENA]\n• Condição do Ambiente: Neblina densa no trilho secundário; queda térmica severa próxima à casa de máquinas.\n• Ponto de Entrada/Saída: Porta corta-fogo do Setor B trancada por dentro com corrente derretida.\n• Anomalias Sensoriais: Rádios comunicadores captam sussurros repetindo coordenadas da antiga linha férrea.',
    clues: [
      {
        id: `${caseId}_clue_0`,
        t: 'Relógio analógico parado às 23:17 com vidro trincado por frio extremo',
        ok: true,
        type: 'fisica',
        rel: 'confirmada',
        loc: 'Plataforma Norte',
        foundBy: 'Equipe Alfa',
        notes: 'Coberto por cristais de gelo apesar da temperatura externa de 22°C.',
      },
      {
        id: `${caseId}_clue_1`,
        t: 'Gravação de áudio no walkie-talkie do supervisor Artur',
        ok: true,
        type: 'forense',
        rel: 'confirmada',
        loc: 'Cabine de Controle',
        foundBy: 'Perícia',
        notes: 'Espectro sonoro revela duas vozes sobrepostas em frequência de 412 Hz.',
      },
      {
        id: `${caseId}_clue_2`,
        t: 'Cartão de acesso magnético usado às 23:05 no gerador auxiliar',
        ok: false,
        type: 'documento',
        rel: 'suspeita',
        loc: 'Subestação Elétrica',
        foundBy: 'Sistema Central',
        notes: 'Registrado em nome de Helena V., que afirma ter saído às 21:00.',
      },
      {
        id: `${caseId}_clue_3`,
        t: 'Sigilo circular traçado em carvão atrás do painel de alta tensão',
        ok: false,
        type: 'oculta',
        rel: 'suspeita',
        loc: 'Sala de Máquinas',
        foundBy: 'Equipe Alfa',
        notes: 'Padrão compatível com rituais de ancoragem espectral.',
      },
    ],
    suspects: [
      {
        id: `${caseId}_susp_0`,
        name: 'Helena Vasconcelos (Chefe de Turno)',
        role: 'suspeito',
        suspicion: 78,
        alibi: 'Afirma que deixou a estação às 21:00 após assinar o livro de ponto.',
        motive: 'Seu crachá foi utilizado às 23:05 para desligar a ventilação do Setor B.',
        notes: 'Apresentou nervosismo extremo ao ser questionada sobre a chave da sala de máquinas.',
        linkedClueIds: [`${caseId}_clue_2`, `${caseId}_clue_3`],
      },
      {
        id: `${caseId}_susp_1`,
        name: 'Artur Mendes (Engenheiro Sênior)',
        role: 'vitima',
        suspicion: 15,
        alibi: 'Estava realizando inspeção de rotina nos dutos quando o sinal caiu.',
        motive: 'Nenhum motivo aparente; último a transmitir pedido de socorro.',
        notes: 'Seu walkie-talkie foi achado no chão da cabine sem bateria.',
        linkedClueIds: [`${caseId}_clue_0`, `${caseId}_clue_1`],
      },
    ],
    timeline: [
      {
        id: `${caseId}_time_0`,
        time: '21:00',
        title: 'Troca oficial de turno na guarita',
        desc: 'Helena registra saída no protocolo físico, mas câmeras do corredor estavam com interferência.',
        verified: true,
      },
      {
        id: `${caseId}_time_1`,
        time: '23:05',
        title: 'Desligamento do exaustor principal',
        desc: 'Acesso via cartão magnético na Subestação Elétrica.',
        verified: true,
      },
      {
        id: `${caseId}_time_2`,
        time: '23:17',
        title: 'Colapso térmico e perda de contato com a equipe',
        desc: 'Horário exato em que todos os relógios analógicos da plataforma pararam.',
        verified: true,
      },
    ],
    connections: [
      {
        id: `${caseId}_conn_0`,
        fromId: `${caseId}_susp_0`,
        toId: `${caseId}_clue_2`,
        label: 'Crachá usado após horário do álibi (23:05)',
        color: 'red',
      },
      {
        id: `${caseId}_conn_1`,
        fromId: `${caseId}_clue_0`,
        toId: `${caseId}_clue_1`,
        label: 'Mesmo instante da interferência de rádio',
        color: 'amber',
      },
    ],
    phenomena: ['queda_termica', 'frequencia_emf_vozes', 'distorcao_cronologica'],
    theories: [
      {
        id: `${caseId}_theo_0`,
        statement: 'O desligamento da subestação às 23:05 foi deliberado para enfraquecer a Membrana no túnel norte.',
        status: 'comprovada',
        createdAt: Date.now() - 3600000,
      },
      {
        id: `${caseId}_theo_1`,
        statement: 'A entidade manifestada responde a frequências sonoras de 412 Hz emitidas pelo gerador.',
        status: 'aberta',
        createdAt: Date.now() - 1800000,
      },
    ],
  });
}
