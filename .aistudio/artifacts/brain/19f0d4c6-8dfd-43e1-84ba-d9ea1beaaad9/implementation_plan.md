# Fast Math Operations on Resource Bars (Demologia Tabletop)

Implement an inline mathematical expression evaluator for character resource bars (HP, PE, SM/Sanity) across the player HUD and Master panels, allowing relative (`+20`, `-15`, `*2`), binary (`70+20`, `70-15`, `70*2`), and direct (`45`) integer edits without mental calculation.

## User Review & Critical Decisions

> [!IMPORTANT]
> Key decisions confirmed during Phase 1 clarification:

- **Confirmed Decision 1 (Invalid Input Feedback)**: Show subtle red highlight with a brief, discreet tooltip badge that automatically fades after 2 seconds while preserving the original value.
- **Confirmed Decision 2 (Scope of Implementation)**: Applied across both the active player HUD resource bars and the Master's tabletop panels (MasterPlayersView and MasterExtrasView).
- **Confirmed Decision 3 (Strict Operator Constraints)**: Exclusively supports addition (`+`), subtraction (`-`), and multiplication (`*`). Rejects division (`/`), decimals (`.`, `,`), and letters. Zero usage of `eval()`.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades resource number editing inputs so users can type math operations directly into the field instead of calculating in their head.
- **Target Experience**: Fast, tactical flow during combat or stressful RP scenes. Typing `+15` heals 15, `-28` applies 28 damage, and `*2` doubles current resource, updating bars and peer sync instantly.

---

## 2. Mathematical Parser Specification (`src/utils/statMath.ts`)

A standalone, deterministic parser without `eval()`:

```typescript
export interface StatParseResult {
  success: boolean;
  value?: number;
  error?: string;
}

export function evaluateStatExpression(
  input: string,
  currentValue: number,
  options?: { min?: number }
): StatParseResult
```

### Parsing Rules

1. **Rejection Filter**:
   - If input is empty or whitespace $\rightarrow$ `"Campo vazio"`.
   - If input contains `/`, `.` or `,` $\rightarrow$ `"Divisões e decimais não permitidos"`.
   - If input contains letters or invalid symbols $\rightarrow$ `"Entrada inválida"`.
2. **Pattern A: Relative Operation (`+N`, `-N`, `*N`)**:
   - Matches `/^([+\-*])\s*(\d+)$/`.
   - Applies operand to `currentValue`.
   - Example: `70` with `+20` $\rightarrow$ `90`; `70` with `-15` $\rightarrow$ `55`; `70` with `*2` $\rightarrow$ `140`.
3. **Pattern B: Binary Operation (`A+B`, `A-B`, `A*B`)**:
   - Matches `/^(\d+)\s*([+\-*])\s*(\d+)$/`.
   - Evaluates left and right integer operands.
   - Example: `70+20` $\rightarrow$ `90`; `70-15` $\rightarrow$ `55`; `70*2` $\rightarrow$ `140`.
4. **Pattern C: Direct Integer (`N`)**:
   - Matches `/^(\d+)$/`.
   - Sets exact value directly.
   - Example: `45` $\rightarrow$ `45`.
5. **Clamping & Bounds**:
   - Lower bound clamped to $\ge 0$ (resources cannot be negative).
   - Operands and results are strictly integers (`Math.round`).

---

## 3. Component Architecture & UI Upgrades

### `src/components/StatMathInput.tsx` (Reusable Component)

Replaces and standardizes `MestreStatInput`:
- Uses `type="text"` to allow typing arithmetic operators without native browser number constraints.
- Shows current numeric value when unfocused.
- On Focus: allows editing with full cursor flexibility.
- On Enter or Blur:
  - Validates and calculates via `evaluateStatExpression`.
  - On Success: calls `onSave(result)` immediately, updates visual bar width and state, and formats field back to final integer.
  - On Error: shows subtle red border highlight and a compact floating error badge (`-top-6 left-1/2 -translate-x-1/2`) with the error reason, reverting field to previous value after 2 seconds.
- On Escape: reverts without saving.

### Integration Points

1. **Player HUD (`src/App.tsx`)**:
   - `HP: Current / Max`
   - `PE: Current / Max` (Demologia mode)
   - `SM: Current / Max` (Real L mode)
   - Custom Variables in Sheet
2. **Master Tabletop Panels**:
   - `src/components/MasterPlayersView.tsx`: Player HP, PE, SM current values in desktop table and mobile list cards.
   - `src/components/MasterExtrasView.tsx`: Extra NPC/Monster sheets HP, PE, SM current values.

---

## 4. Test Verification Matrix

| Current | Input | Expected Output | Status |
|---:|---|---:|:---:|
| 70 | `+20` | `90` | Valid Relative Addition |
| 70 | `-15` | `55` | Valid Relative Subtraction |
| 70 | `*2` | `140` | Valid Relative Multiplication |
| 70 | `70+20` | `90` | Valid Binary Addition |
| 70 | `70-15` | `55` | Valid Binary Subtraction |
| 70 | `70*2` | `140` | Valid Binary Multiplication |
| 70 | `45` | `45` | Valid Direct Assignment |
| 70 | `abc` | Rejected, keeps `70`, shows tooltip | Expected Rejection |
| 70 | `70/2` | Rejected, keeps `70`, shows tooltip | Expected Rejection |
| 70 | `70.5` | Rejected, keeps `70`, shows tooltip | Expected Rejection |
| 70 | `-100` | `0` (clamped min) | Lower Bound Guard |
