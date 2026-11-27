import React, { useState } from "react";
import { Check } from "lucide-react";
import {
  RITUAL_AFFILIATION_LIST,
  RITUAL_TEST_FORMULA,
  RitualItem,
  RitualLevel,
  toggleRitualAffiliation,
} from "../utils/rituals";
import {
  MasterLibrarySkillData,
  MasterLibraryTributoData,
} from "../types/masterLibrary";
import { DEFAULT_STATUS_KEYS } from "../utils/statusVariables";
import {
  CreatureRichInlineText,
  CreatureRichText,
  CreatureRichTextQuickBar,
} from "./CreatureRichText";

function appendRichSnippet(current: string, snippet: string): string {
  const base = current || "";
  if (!base) return snippet.trimStart();
  return `${base}${base.endsWith(" ") || snippet.startsWith("\n") ? "" : " "}${snippet}`;
}

const RITUAL_LEVELS: readonly RitualLevel[] = [1, 2, 3, 4];

// ============================================================================
// RITUAL FORM FIELDS (Mesma estrutura e controles do sistema de Rituais)
// ============================================================================

export interface RitualFormFieldsProps {
  ritual: RitualItem;
  onChange: <K extends keyof RitualItem>(field: K, value: RitualItem[K] | string) => void;
}

export const RitualFormFields: React.FC<RitualFormFieldsProps> = ({
  ritual,
  onChange,
}) => {
  const [showDescPreview, setShowDescPreview] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8]">
          Nome do Ritual
        </label>
        <input
          type="text"
          className="input-dark mb-0"
          placeholder="Ex: **Sussurro** da #(Membrana)"
          aria-label="Nome do Ritual"
          value={ritual.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
        <CreatureRichTextQuickBar
          compact
          showDivider={false}
          label="Nome:"
          onInsertSnippet={(snippet) =>
            onChange("name", appendRichSnippet(ritual.name, snippet))
          }
        />
        {(ritual.name.includes("**") ||
          ritual.name.includes("^^") ||
          ritual.name.includes("#(")) && (
          <div className="px-2.5 py-1.5 bg-[#0a0a10] border border-[#222230] text-xs font-bold text-white uppercase tracking-wide">
            <CreatureRichInlineText
              text={ritual.name}
              tone="dark"
              interactiveAffiliations={false}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Nível (1 a 4)
          </label>
          <div
            className="grid grid-cols-4 gap-1"
            role="group"
            aria-label="Nível do Ritual"
          >
            {RITUAL_LEVELS.map((lvl) => {
              const selected = ritual.level === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`ritual-level-btn-${lvl}`}
                  onClick={() => onChange("level", lvl)}
                  className={`min-h-[40px] font-mono font-bold text-xs border rounded-none transition-colors cursor-pointer touch-manipulation ${
                    selected
                      ? "bg-[#7a1419] border-[#e11d48] text-white"
                      : "bg-[#121218] border-[#2a2a36] text-[#9b9caa] hover:border-[#525264] hover:text-white"
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Dificuldade
          </label>
          <input
            type="number"
            min={0}
            max={99}
            className="input-dark mb-0"
            placeholder="Ex: 8"
            aria-label="Dificuldade do Ritual"
            value={ritual.difficulty}
            onChange={(e) => onChange("difficulty", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Custo PE
          </label>
          <input
            type="number"
            min={0}
            className="input-dark mb-0"
            placeholder="0"
            aria-label="Custo PE do Ritual"
            value={ritual.cost}
            onChange={(e) => onChange("cost", e.target.value)}
          />
        </div>
      </div>

      <div className="px-2.5 py-2 bg-[#111118] border border-[#242432] font-mono text-[10px] text-[#b4b5c2] flex flex-wrap items-center justify-between gap-2">
        <span>
          TESTE PADRÃO:{" "}
          <strong className="text-white">{RITUAL_TEST_FORMULA}</strong>
        </span>
        <span className="text-[#ef4444]">
          SUCESSO SE &gt; {ritual.difficulty}
        </span>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1.5">
          Afiliações
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RITUAL_AFFILIATION_LIST.map((aff) => {
            const selected = ritual.affiliations.includes(aff.id);
            return (
              <button
                key={aff.id}
                type="button"
                data-testid={`ritual-aff-toggle-${aff.id}`}
                aria-pressed={selected}
                onClick={() =>
                  onChange(
                    "affiliations",
                    toggleRitualAffiliation(ritual.affiliations, aff.id)
                  )
                }
                className={`inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider border rounded-none transition-[opacity,transform] duration-150 cursor-pointer touch-manipulation ${
                  selected
                    ? "opacity-100 ring-1 ring-white/85 scale-[1.02]"
                    : "opacity-45 hover:opacity-80"
                }`}
                style={{
                  background: aff.background,
                  color: aff.textColor,
                  borderColor: selected ? "#ffffff" : aff.borderColor,
                  textShadow: aff.textShadow,
                }}
              >
                {selected && <Check size={11} strokeWidth={3} />}
                <span>{aff.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8]">
          Descrição
        </label>
        <CreatureRichTextQuickBar
          compact
          showPreview={showDescPreview}
          onTogglePreview={() => setShowDescPreview((p) => !p)}
          onInsertSnippet={(snippet) =>
            onChange("desc", appendRichSnippet(ritual.desc, snippet))
          }
        />
        {showDescPreview ? (
          <div className="min-h-[76px] bg-[#0a0a10] border border-[#242432] p-2.5">
            <CreatureRichText
              text={ritual.desc}
              emptyText="Digite a descrição para visualizar a formatação."
              tone="dark"
            />
          </div>
        ) : (
          <textarea
            className="input-dark mb-0"
            placeholder="Efeito, alcance, duração... Suporta **negrito**, ^^itálico^^ e #(Afiliação)"
            aria-label="Descrição do Ritual"
            rows={3}
            value={ritual.desc}
            onChange={(e) => onChange("desc", e.target.value)}
          />
        )}
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
          Fórmula de Dano / Efeito (Opcional)
        </label>
        <input
          type="text"
          className="input-dark mb-1"
          placeholder="Ex: 2D6+OCU"
          aria-label="Fórmula de Dano do Ritual"
          value={ritual.damage}
          onChange={(e) => onChange("damage", e.target.value)}
        />
        <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={ritual.needsTest}
            onChange={(e) => onChange("needsTest", e.target.checked)}
            className="bg-black border-gray-700 accent-[#b52a30]"
          />
          Exigir sucesso no teste ({RITUAL_TEST_FORMULA} &gt;{" "}
          {ritual.difficulty}) antes de rolar dano
        </label>
      </div>
    </div>
  );
};

// ============================================================================
// SKILL FORM FIELDS (Mesma estrutura e campos completos da ficha)
// ============================================================================

export interface SkillFormFieldsProps {
  skill: MasterLibrarySkillData;
  variableNames?: string[];
  onChange: <K extends keyof MasterLibrarySkillData>(
    field: K,
    value: MasterLibrarySkillData[K] | string | number | boolean
  ) => void;
}

export const SkillFormFields: React.FC<SkillFormFieldsProps> = ({
  skill,
  variableNames,
  onChange,
}) => {
  const [showDescPreview, setShowDescPreview] = useState(false);

  const vars = Array.from(
    new Set([
      ...(variableNames && variableNames.length > 0
        ? variableNames
        : [...DEFAULT_STATUS_KEYS]),
      ...(skill.testVar ? [skill.testVar] : []),
      ...(skill.damageVar ? [skill.damageVar] : []),
      ...(skill.testPostVar ? [skill.testPostVar] : []),
      ...(skill.damagePostVar ? [skill.damagePostVar] : []),
    ])
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <div className="sm:col-span-3 space-y-1.5">
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8]">
            Nome da Skill
          </label>
          <input
            type="text"
            className="input-dark mb-0"
            placeholder="Nome da Skill (suporta **negrito**, ^^itálico^^, #(Afiliação))"
            aria-label="Nome da Skill"
            value={skill.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
          <CreatureRichTextQuickBar
            compact
            showDivider={false}
            label="Nome:"
            onInsertSnippet={(snippet) =>
              onChange("name", appendRichSnippet(skill.name, snippet))
            }
          />
          {(skill.name.includes("**") ||
            skill.name.includes("^^") ||
            skill.name.includes("#(")) && (
            <div className="px-2.5 py-1.5 bg-[#0a0a10] border border-[#222230] text-xs font-bold text-white uppercase tracking-wide">
              <CreatureRichInlineText
                text={skill.name}
                tone="dark"
                interactiveAffiliations={false}
              />
            </div>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Custo PE
          </label>
          <input
            type="number"
            min={0}
            className="input-dark mb-0"
            placeholder="Custo PE"
            aria-label="Custo PE da Skill"
            value={skill.cost}
            onChange={(e) => onChange("cost", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8]">
          Descrição
        </label>
        <CreatureRichTextQuickBar
          compact
          showPreview={showDescPreview}
          onTogglePreview={() => setShowDescPreview((p) => !p)}
          onInsertSnippet={(snippet) =>
            onChange("desc", appendRichSnippet(skill.desc, snippet))
          }
        />
        {showDescPreview ? (
          <div className="min-h-[64px] bg-[#0a0a10] border border-[#242432] p-2.5">
            <CreatureRichText
              text={skill.desc}
              emptyText="Digite a descrição para visualizar a formatação."
              tone="dark"
            />
          </div>
        ) : (
          <textarea
            className="input-dark mb-0"
            placeholder="Descrição (suporta **negrito**, ^^itálico^^ e #(Afiliação))"
            aria-label="Descrição da Skill"
            rows={2}
            value={skill.desc}
            onChange={(e) => onChange("desc", e.target.value)}
          />
        )}
      </div>

      <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(skill.needsTest)}
          onChange={(e) => onChange("needsTest", e.target.checked)}
          className="bg-black border-gray-700 accent-[#b52a30]"
        />
        Necessita Teste (Exige Rolar Teste antes de Dano)
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Fórmula de Teste
          </label>
          <input
            type="text"
            className="input-dark mb-0"
            placeholder="Ex: 1D20+OCU"
            aria-label="Fórmula de Teste da Skill"
            value={skill.test}
            onChange={(e) => onChange("test", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Fórmula de Dano
          </label>
          <input
            type="text"
            className="input-dark mb-0"
            placeholder="Ex: 1D8+FOR"
            aria-label="Fórmula de Dano da Skill"
            value={skill.damage}
            onChange={(e) => onChange("damage", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Salvar Teste Em Var: (Opcional)
          </label>
          <select
            className="input-dark mb-0"
            aria-label="Salvar Teste Em Variável"
            value={skill.testVar || ""}
            onChange={(e) => onChange("testVar", e.target.value)}
          >
            <option value="">-- Nenhuma --</option>
            {vars.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Salvar Dano Em Var: (Opcional)
          </label>
          <select
            className="input-dark mb-0"
            aria-label="Salvar Dano Em Variável"
            value={skill.damageVar || ""}
            onChange={(e) => onChange("damageVar", e.target.value)}
          >
            <option value="">-- Nenhuma --</option>
            {vars.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Após Teste Setar Var:
          </label>
          <select
            className="input-dark mb-1"
            aria-label="Após Teste Setar Variável"
            value={skill.testPostVar || ""}
            onChange={(e) => onChange("testPostVar", e.target.value)}
          >
            <option value="">-- Nenhuma --</option>
            {vars.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="input-dark mb-0"
            placeholder="Fórmula (Ex: AD-AD)"
            aria-label="Fórmula Pós Teste"
            value={skill.testPostFormula || ""}
            onChange={(e) => onChange("testPostFormula", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Após Dano Setar Var:
          </label>
          <select
            className="input-dark mb-1"
            aria-label="Após Dano Setar Variável"
            value={skill.damagePostVar || ""}
            onChange={(e) => onChange("damagePostVar", e.target.value)}
          >
            <option value="">-- Nenhuma --</option>
            {vars.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="input-dark mb-0"
            placeholder="Fórmula (Ex: AD-AD)"
            aria-label="Fórmula Pós Dano"
            value={skill.damagePostFormula || ""}
            onChange={(e) => onChange("damagePostFormula", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TRIBUTO FORM FIELDS (Mesma estrutura do Tributo na ficha)
// ============================================================================

export interface TributoFormFieldsProps {
  tributo: MasterLibraryTributoData;
  onChange: <K extends keyof MasterLibraryTributoData>(
    field: K,
    value: string
  ) => void;
}

export const TributoFormFields: React.FC<TributoFormFieldsProps> = ({
  tributo,
  onChange,
}) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
          Nome do Tributo
        </label>
        <input
          type="text"
          className="input-dark mb-0"
          placeholder="Ex: Sinfonia de Robert"
          aria-label="Nome do Tributo"
          value={tributo.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
          Descrição
        </label>
        <textarea
          className="input-dark mb-0"
          rows={2}
          placeholder="Resumo do Tributo..."
          aria-label="Descrição do Tributo"
          value={tributo.desc}
          onChange={(e) => onChange("desc", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Efeito Passivo
          </label>
          <textarea
            className="input-dark mb-0"
            rows={3}
            placeholder="Efeito passivo..."
            aria-label="Efeito Passivo do Tributo"
            value={tributo.passivo}
            onChange={(e) => onChange("passivo", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1">
            Efeito Ativo
          </label>
          <textarea
            className="input-dark mb-0"
            rows={3}
            placeholder="Efeito ativo..."
            aria-label="Efeito Ativo do Tributo"
            value={tributo.ativo}
            onChange={(e) => onChange("ativo", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
