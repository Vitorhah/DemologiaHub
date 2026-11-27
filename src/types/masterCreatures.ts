import type { MasterLibrarySkillData } from "./masterLibrary";
import type { RitualAffiliationId, RitualItem } from "../utils/rituals";
import type { PdiItem } from "../utils/pdi";

export type CreatureAttributeKey = "VIT" | "AGL" | "FOR" | "OCU" | "INT" | "SAN";

export type CreatureVariables = Record<CreatureAttributeKey, number>;

export interface CreatureFolder {
  id: string;
  masterId: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Propriedade explícita da Skill na ficha de uma criatura:
 * - "exclusive": criada exclusivamente para esta criatura; excluída junto com ela.
 * - "linked": vinculada a uma Skill existente da Biblioteca; remover ou excluir
 *   a criatura nunca remove a Skill original da Biblioteca.
 */
export type CreatureSkillOwnership = "exclusive" | "linked";

export interface CreatureSkillEntry {
  id: string;
  ownership: CreatureSkillOwnership;
  /** Preenchido apenas quando ownership === "linked". */
  librarySkillId?: string | null;
  /**
   * Para "exclusive", é a fonte de verdade da Skill.
   * Para "linked", atua como snapshot de fallback caso a Skill original seja removida da Biblioteca.
   */
  skillData: MasterLibrarySkillData;
}

export interface ResolvedCreatureSkill {
  entry: CreatureSkillEntry;
  resolvedData: MasterLibrarySkillData;
  isLibraryMissing: boolean;
}

/**
 * Origem de um Ritual vinculado à criatura (sem duplicar o registro original):
 * - "library": item tipo "ritual" cadastrado na Biblioteca do Mestre.
 * - "player": ritual cadastrado em uma ficha de jogador (aba Player / sessão).
 */
export type CreatureRitualSource = "library" | "player";

export interface CreatureRitualRef {
  /** Identificador único deste vínculo na ficha da criatura. */
  id: string;
  source: CreatureRitualSource;
  /** ID do item na Biblioteca (`libraryItem.id`) ou ID do jogador (`player.id` / `"local_sheet"`). */
  sourceId: string;
  /** ID numérico do Ritual dentro da ficha do jogador (quando source === "player"). */
  ritualId?: number | null;
  /** Rótulo de origem exibido (ex: nome do jogador ou "Biblioteca"). */
  sourceLabel?: string;
  /** Snapshot leve de fallback caso o registro original não esteja carregado/tenha sido removido. */
  fallbackSnapshot?: RitualItem;
}

export interface CatalogRitualOption {
  /** Chave determinística para evitar duplicatas no seletor. */
  key: string;
  source: CreatureRitualSource;
  sourceId: string;
  ritualId?: number | null;
  sourceLabel: string;
  ritual: RitualItem;
}

export interface ResolvedCreatureRitual {
  ref: CreatureRitualRef;
  ritual: RitualItem;
  isSourceMissing: boolean;
  sourceLabel: string;
}

/**
 * Modo de Criatura — reutiliza integralmente a estrutura de PDI (`PdiItem`)
 * para Buffs, Debuffs e estado ativo/inativo, acrescido de notas livres opcionais.
 */
export interface CreatureModeItem extends PdiItem {
  notes?: string;
}

/**
 * Tipos de blocos disponíveis no editor modular de fichas dinâmicas de criaturas.
 */
export type CreatureBlockType =
  | "profile"
  | "status"
  | "skills"
  | "rituals"
  | "modes"
  | "text"
  | "table";

/**
 * Dados de planilha estilo Excel para o Bloco de Tabela nas fichas de criaturas.
 */
export interface CreatureTableData {
  /** Matriz retangular linhas × colunas de células de texto (suporta formatação rica). */
  rows: string[][];
  /** Quando true, a primeira linha (índice 0) é renderizada como cabeçalho da tabela. */
  hasHeaderRow: boolean;
}

/**
 * Bloco visual independente no documento flexível (Flexbox com flex-wrap).
 * Armazena apenas estrutura visual (posição, largura, altura, conteúdo livre);
 * dados mecânicos (LV, atributos, Skills, Rituais, Modos) vivem separados na criatura.
 */
export interface CreatureSheetBlock {
  id: string;
  type: CreatureBlockType;
  /** Porcentagem alvo de largura na linha (25..100). */
  widthPct: number;
  /** Altura mínima opcional em pixels (útil para blocos de texto/tabela / redimensionamento vertical). */
  minHeightPx?: number | null;
  /** Título opcional (usado nos Blocos de Texto e Tabela). */
  title?: string;
  /** Conteúdo livre com suporte à formatação especial (Bloco de Texto). */
  content?: string;
  /** Estrutura de células estilo planilha (Bloco de Tabela). */
  tableData?: CreatureTableData;
}

/**
 * Metadados usados na listagem de Criaturas (replicando o Bloco de Perfil + spoiler de HP/PE/SM).
 */
export interface CreatureSummary {
  id: string;
  masterId: string;
  name: string;
  folderId: string | null;
  description: string;
  descriptionPreview: string;
  /** Nível oficial da criatura (influencia limites e escalonamento do Bloco de Status). */
  lv: number;
  /** Afiliações vinculadas ao Perfil (reutiliza RitualAffiliationId oficial). */
  affiliations: RitualAffiliationId[];
  hpMax: number;
  peMax: number;
  smMax: number;
  skillsCount: number;
  legacyExtraId?: string | null;
  updatedAt: number;
}

/**
 * Ficha completa da Criatura (carregada sob demanda ao abrir visualização ou editor).
 */
export interface CreatureRecord extends CreatureSummary {
  variables: CreatureVariables;
  skills: CreatureSkillEntry[];
  /** Referências a Rituais existentes (Biblioteca ou fichas de Players). */
  rituals: CreatureRitualRef[];
  /** Modos da criatura (baseados na estrutura oficial de PDI). */
  modes: CreatureModeItem[];
  /** Composição modular de blocos da ficha dinâmica. */
  sheetBlocks: CreatureSheetBlock[];
  /** Versão da estrutura visual (1 = legado fixo, 2 = blocos dinâmicos). */
  sheetVersion: number;
  createdAt: number;
}
