# PDI — Poderes de Intenção (Sistema de Buffs e Debuffs para Demologia RPG)

Documento de especificação e exportação do antigo sistema de **Perícias** adaptado para o RPG principal **Demologia**, agora chamado oficialmente de **PDI (Poderes de Intenção)**, atuando como **Buffs e Debuffs** sobre os 6 status oficiais do sistema.

---

## 1. Conceito Geral no Demologia RPG

Os **PDI (Poderes de Intenção)** representam impulsos, aptidões narrativas, traumas canalizados ou condições especiais ligadas à intenção do personagem.

- **Ativação por Toggle (Ligado / Desligado)**: Cada PDI possui uma condição descrita em texto (ex.: *"Quando nas sombras recebe buffs"*). Quando a condição acontece em cena, o jogador (ou o Mestre) liga o PDI na ficha; quando a condição cessa, desliga.
- **Permissão de Edição Exclusiva do Mestre**:
  - **Jogadores**: Podem apenas visualizar a descrição/modificadores e alternar o toggle (**Ligar / Desligar**) do PDI.
  - **Mestre**: Pode criar, editar nome/descrição, configurar todos os buffs e debuffs por atributo e remover PDIs, tanto na ficha de cada jogador (`MasterPlayersView`) quanto nas **Fichas Extras / NPCs** (`MasterExtrasView`).
- **Convivência com Tributos e Skills**:
  - Diferente do Carnamal (onde ficava no lugar dos Tributos), no **Demologia Hub** os **PDI (Poderes de Intenção)** coexistem com **Skills** e **Tributos** em uma seção própria na ficha (sem remover ou substituir Tributos).

---

## 2. Mapeamento para os 6 Status Oficiais do Demologia

Cada PDI pode aplicar **Buffs (+)** e/ou **Debuffs (-)** em qualquer combinação dos 6 atributos estabelecidos do Demologia:

| Sigla | Atributo Oficial | Papel nas Fórmulas & Rolagens do Demologia |
| :---: | :--- | :--- |
| **VIT** | Vitalidade | Resistência física e base de PV (`PV = 20 + VIT × 6`) |
| **AGL** | Agilidade | Iniciativa (`d20 + AGL`), Esquiva (`2d6 + AGL`), base de PE (`PE = 5 + AGL × 3 + SAN × 2`) |
| **FOR** | Força | Testes físicos, dano corpo a corpo e cargas |
| **OCU** | Ocultismo | Escala de **Tributos**, rituais e testes paranormais |
| **INT** | Intelecto | Investigação, conhecimento e critério de desempate na Iniciativa |
| **SAN** | Sanidade | Estabilidade mental, base de Sanidade (`30 + SAN × 4`) e parte do PE |

### Regra de Aplicação dos Buffs e Debuffs
Cada modificador de atributo dentro de um PDI pode ser configurado pelo Mestre em **dois formatos compatíveis com o motor `parseAndRoll`**:
1. **Modificador em Dados** (`1d4`, `1d6`, `1d8`, `1d10`, `1d12`, `1d20`):
   - **Buff**: soma o dado à rolagem que usar aquele status (ex.: `OCU +1D6` transforma `1D20+OCU` em `1D20+(OCU+1D6)`).
   - **Debuff**: subtrai o dado da rolagem que usar aquele status (ex.: `SAN -1D4` transforma `1D20+SAN` em `1D20+(SAN-1D4)`).
2. **Modificador Fixo (Opcional)**:
   - Permite também bônus ou penalidades fixas numéricas (ex.: `+2 AGL`, `-1 FOR`), somadas ou subtraídas diretamente nas rolagens do atributo.

> **Integridade das Fórmulas Base:** Por padrão, os PDIs alteram os **testes e rolagens** que referenciam os atributos (`VIT`, `AGL`, `FOR`, `OCU`, `INT`, `SAN`) sem corromper o valor base permanente salvo na ficha nem sobrescrever os máximos de PV/PE/Sanidade automaticamente quando o toggle é ligado/desligado. Os valores base continuam intactos e os buffs/debuffs ativos aparecem como badges visuais ao lado de cada atributo afetado.

---

## 3. Estrutura de Dados TypeScript (`src/types.ts`)

```ts
export type DemologiaStatKey = "VIT" | "AGL" | "FOR" | "OCU" | "INT" | "SAN";

export const DEMOLOGIA_STAT_KEYS: DemologiaStatKey[] = [
  "VIT",
  "AGL",
  "FOR",
  "OCU",
  "INT",
  "SAN",
];

export const DEMOLOGIA_STAT_LABELS: Record<DemologiaStatKey, string> = {
  VIT: "Vitalidade",
  AGL: "Agilidade",
  FOR: "Força",
  OCU: "Ocultismo",
  INT: "Intelecto",
  SAN: "Sanidade",
};

export const VALID_PDI_DICE = [
  "",
  "1d4",
  "1d6",
  "1d8",
  "1d10",
  "1d12",
  "1d20",
] as const;

export type PdiDiceValue = (typeof VALID_PDI_DICE)[number];

export interface PdiStatModifier {
  buffDice?: PdiDiceValue;   // Ex: "1d4" .. "1d20" (soma na rolagem do status)
  debuffDice?: PdiDiceValue; // Ex: "1d4" .. "1d20" (subtrai na rolagem do status)
  buffFlat?: number;         // Opcional: bônus numérico fixo (ex: +2)
  debuffFlat?: number;       // Opcional: penalidade numérica fixa (ex: -1)
}

export interface PdiItem {
  id: string;
  name: string;
  desc: string;
  active: boolean;
  modifiers: Partial<Record<DemologiaStatKey, PdiStatModifier>>;
}

export const DEFAULT_PDIS: PdiItem[] = [
  {
    id: "pdi_ladino",
    name: "Ladino",
    desc: "Quando nas sombras, recebe bônus de movimentação e furtividade.",
    active: false,
    modifiers: {
      AGL: { buffDice: "1d4" },
    },
  },
];

export function normalizePdis(
  raw: any,
  fallback: PdiItem[] = []
): PdiItem[] {
  if (!Array.isArray(raw)) {
    return fallback.map((item) => ({
      ...item,
      modifiers: { ...item.modifiers },
    }));
  }

  const validDiceSet = new Set<string>(VALID_PDI_DICE);
  const sanitizeDie = (val: any): PdiDiceValue => {
    if (typeof val !== "string") return "";
    const clean = val.trim().toLowerCase().replace(/^[+-]/, "");
    return validDiceSet.has(clean) ? (clean as PdiDiceValue) : "";
  };

  const sanitizeFlat = (val: any): number => {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  return raw
    .filter((item) => item && typeof item === "object")
    .map((item, idx) => {
      const normalizedMods: Partial<Record<DemologiaStatKey, PdiStatModifier>> = {};
      const rawMods = item.modifiers && typeof item.modifiers === "object" ? item.modifiers : {};

      for (const stat of DEMOLOGIA_STAT_KEYS) {
        const m = rawMods[stat];
        if (!m || typeof m !== "object") continue;

        const buffDice = sanitizeDie(m.buffDice);
        const debuffDice = sanitizeDie(m.debuffDice);
        const buffFlat = sanitizeFlat(m.buffFlat);
        const debuffFlat = sanitizeFlat(m.debuffFlat);

        if (buffDice || debuffDice || buffFlat > 0 || debuffFlat > 0) {
          normalizedMods[stat] = {
            ...(buffDice ? { buffDice } : {}),
            ...(debuffDice ? { debuffDice } : {}),
            ...(buffFlat > 0 ? { buffFlat } : {}),
            ...(debuffFlat > 0 ? { debuffFlat } : {}),
          };
        }
      }

      return {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : `pdi_${idx}_${Date.now()}`,
        name: typeof item.name === "string" ? item.name : "Novo PDI",
        desc: typeof item.desc === "string" ? item.desc : "",
        active: Boolean(item.active),
        modifiers: normalizedMods,
      };
    });
}
```

---

## 4. Integração com o Motor de Rolagens (`parseAndRoll` em `src/App.tsx`)

Quando uma rolagem ou fórmula de Skill/Teste/Esquiva/Iniciativa referencia qualquer um dos 6 status (`VIT`, `AGL`, `FOR`, `OCU`, `INT`, `SAN`), o motor expande automaticamente todos os **PDIs ativos (`active === true`)** que possuem buffs ou debuffs naquele status:

```ts
const activePdis = normalizePdis(state.pdis).filter((p) => p.active);

const buildStatFormulaWithPdis = (statKey: string, baseVal: any) => {
  const upper = statKey.trim().toUpperCase() as DemologiaStatKey;
  if (!DEMOLOGIA_STAT_KEYS.includes(upper)) return String(baseVal);

  const parts: string[] = [String(baseVal)];

  activePdis.forEach((pdi) => {
    const mod = pdi.modifiers?.[upper];
    if (!mod) return;
    if (mod.buffFlat && mod.buffFlat > 0) parts.push(`+${mod.buffFlat}`);
    if (mod.debuffFlat && mod.debuffFlat > 0) parts.push(`-${mod.debuffFlat}`);
    if (mod.buffDice) parts.push(`+${mod.buffDice}`);
    if (mod.debuffDice) parts.push(`-${mod.debuffDice}`);
  });

  return parts.length > 1 ? `(${parts.join("")})` : parts[0];
};
```

### Exemplos de Expansão Automática em Cena:
- Fórmula da Skill: `1D20+OCU`
  - Jogador tem `OCU = 3` e o PDI ativo **"Transe Ritualístico"** (`OCU: +1D6`, `SAN: -1D4`).
  - Fórmula expandida automaticamente: `1D20+(3+1D6)`
  - Log exibido: `OCU(3+1D6) | 1D20[14] | 1D6[5] → Resultado: 22`
- Fórmula de Esquiva: `2D6+AGL`
  - Jogador tem `AGL = 2` e o PDI ativo **"Ladino"** (`AGL: +1D4`).
  - Fórmula expandida automaticamente: `2D6+(2+1D4)`
- Fórmula de Iniciativa: `1D20+AGL`
  - Aplica automaticamente os buffs/debuffs ativos de `AGL` no resultado da rolagem (mantendo os critérios oficiais de desempate: maior `AGL`, depois maior `INT`).

---

## 5. Catálogo de Exemplos de PDIs para Demologia RPG

| Nome do PDI | Condição / Descrição | Buffs (+) | Debuffs (-) |
| :--- | :--- | :--- | :--- |
| **Ladino** | Quando oculto nas sombras ou fora do campo de visão do alvo | `AGL +1D4` | — |
| **Transe Ritualístico** | Ao canalizar um Tributo em ambiente de forte presença paranormal | `OCU +1D6` | `SAN -1D4` |
| **Adrenalina de Sobrevivência** | Quando está com menos de 50% de PV | `FOR +1D4`, `AGL +1D4` | `INT -1D4` |
| **Foco Investigativo** | Ao examinar cenas de crime, pistas ou arquivos classificados sem pressão de combate | `INT +1D6` | `AGL -1D4` |
| **Pele Calejada** | Quando suporta dor extrema ou dano contínuo sem recuar | `VIT +1D4` | — |
| **Mente Blindada** | Ao resistir diretamente a horrores psicológicos ou entidades | `SAN +1D6` | `OCU -1D4` |

---

## 6. Especificação de Interface e Sincronização (Demologia Hub)

### A. Na Ficha do Jogador (`src/App.tsx`)
1. **Badges nos Atributos (`VIT, AGL, FOR, OCU, INT, SAN`)**:
   - Quando um PDI estiver ligado (`active === true`), exibir badges discretas ao lado do atributo afetado:
     - Verde (`bg-emerald-950/50 border-emerald-500/50 text-emerald-300`): `+1D4 (Ladino)` ou `+2 (Nome)`.
     - Vermelho (`bg-red-950/50 border-red-500/50 text-red-300`): `-1D4 (Transe Ritualístico)`.
2. **Seção "PDI — Poderes de Intenção"**:
   - Lista vertical compacta com estilo clínico/industrial do Demologia Hub (bordas secas, fundo `#141118` quando desligado, destaque vermelho escuro `#8f171c` quando ligado).
   - Cada item mostra:
     - Nome do PDI em caixa alta (`font-mono font-bold`).
     - Descrição / condição de ativação.
     - Badges de todos os buffs/debuffs configurados por atributo (`AGL +1D4`, `SAN -1D4`, etc.).
     - **Switch Toggle (ON/OFF)** clicável pelo jogador e pelo Mestre.
     - Botão **Editar** visível **apenas para o Mestre** (`isMestreAuth || activeFichaId !== "main"`).

### B. No Painel do Mestre (`MasterPlayersView.tsx` e `MasterExtrasView.tsx`)
- O Mestre pode gerenciar os PDIs de cada **Jogador** e de cada **Ficha Extra (NPC/Ameaça)**:
  - Adicionar novo PDI (`+ PDI`).
  - Ligar / desligar o toggle do PDI remotamente.
  - Editar nome, descrição e selecionar Buff/Debuff (em dados `1d4`–`1d20` e/ou valor fixo) para qualquer um dos 6 status (`VIT`, `AGL`, `FOR`, `OCU`, `INT`, `SAN`).
  - Excluir PDI.

### C. Sincronização em Tempo Real (Supabase)
- Campo salvo no JSON da ficha (`public.players.data.pdis`).
- Evento de broadcast dedicado no canal `global_state_updates`:
  - `event: "pdis_update"` com `{ playerId, pdis }`.
- Também escutado via `postgres_changes` em `fetchOwnState` e `player_changes_${userUid}` (mesmo com `pendingUpdatesRef.current` ativo), garantindo que qualquer edição feita pelo Mestre apareça imediatamente na ficha do jogador.

---

## 7. Prompt Pronto para Implementar os PDIs no Demologia Hub Original

> Copie e cole o bloco abaixo no chat do projeto **Demologia Hub** original se quiser que a IA implemente o sistema de PDI automaticamente:

```markdown
Implemente o sistema de PDI (Poderes de Intenção) no Demologia Hub seguindo a especificação abaixo, preservando rigorosamente o design visual escuro/clínico do aplicativo, os Tributos, as Skills e os 6 atributos originais (VIT, AGL, FOR, OCU, INT, SAN) com suas fórmulas intactas:

1. ESTRUTURA DE DADOS (`src/types.ts`):
- Crie os tipos `DemologiaStatKey` ("VIT" | "AGL" | "FOR" | "OCU" | "INT" | "SAN"), `PdiStatModifier` (`buffDice`, `debuffDice` de 1d4 a 1d20, e `buffFlat`, `debuffFlat` opcionais), `PdiItem` (`id`, `name`, `desc`, `active`, `modifiers`) e a função `normalizePdis`.

2. FUNCIONAMENTO DOS PDIs NA FICHA (`src/App.tsx`):
- Adicione a seção "PDI — Poderes de Intenção" na ficha (coexistindo com Tributos e Skills, sem removê-los).
- Cada PDI funciona como toggle (ligado/desligado). O jogador pode apenas ligar/desligar o PDI quando a condição da descrição ocorrer em cena.
- Apenas o Mestre (`isMestreAuth`) pode criar, editar nome/descrição, configurar buffs e debuffs por atributo (VIT, AGL, FOR, OCU, INT, SAN) e remover PDIs.
- Exiba badges discretas ao lado dos atributos (VIT, AGL, FOR, OCU, INT, SAN) indicando os buffs/debuffs dos PDIs que estiverem ativos.
- No motor de rolagem (`parseAndRoll`), quando qualquer fórmula referenciar VIT, AGL, FOR, OCU, INT ou SAN, aplique automaticamente os buffs (+) e debuffs (-) de todos os PDIs ativos naquele atributo, registrando os detalhes no log de rolagem.

3. PAINEL DO MESTRE E FICHAS EXTRAS (`MasterPlayersView.tsx` e `MasterExtrasView.tsx`):
- Permita ao Mestre criar, editar, ligar/desligar e remover PDIs tanto nos cards dos jogadores quanto nas Fichas Extras (NPCs).
- Sincronize as alterações em tempo real via Supabase (`public.players.data.pdis` + broadcast `"pdis_update"` no canal `global_state_updates`).
```
