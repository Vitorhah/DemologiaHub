# Caderno de Campo — UI Modernization & IRL Amethyst Styling

Transform the Caderno de Campo interface from rigid blocky containers into a modern, fluid card-based dossier with generous curved geometry, authentic Real L amethyst-purple colors for IRL mode, and touch-ergonomic controls optimized for Android WebView.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed in Phase 1 clarification:

- **Confirmed Decision 1 (Curvature & Geometry)**: Modern card style with generous curved corners (`rounded-xl` to `rounded-2xl`), eliminating harsh squared edges.
- **Confirmed Decision 2 (IRL Visual Palette)**: Real L amethyst purple with dark slate backgrounds (`#0c0a14`, `#161324`, `#1c1730`, `#a855f7`, `#c084fc`) and luminous violet accents.
- **Confirmed Decision 3 (WebView Usability)**: Touch-friendly cards with generous spacing, 44–48px hitboxes, and fluid mobile navigation transitions.

---

## 1. Overview & Core Concept

- **What It Does**: Redesigns the Caderno de Campo module to replace harsh rectangular boxes with tactile, elevated cards, styled with Real L's signature amethyst cyberpunk palette for immersion outside paranormal missions.
- **Target Experience**: Seamless touch navigation in Android WebView and modern desktop browsers, providing high-contrast readability, smooth rounded surfaces, and clear visual hierarchy.

---

## 2. User Experience & Visual Design

### Key Improvements

1. **Card Architecture & Curved Geometry ("Less Blocky")**:
   - Outer layout panels adopt softened transitions with rounded inner containers (`rounded-2xl` on cards, `rounded-xl` on inputs and buttons).
   - Case list items become distinct tactile cards with subtle elevation (`shadow-md`, `hover:translate-y-[-1px]`) and smooth element accent pills.
   - Evidence items in the checklist become rounded action rows with comfortable thumb spacing.
   - Lined field notepad transitions to a smooth rounded canvas with gentle ambient inner shadow.
2. **Real L Color System (IRL Mode)**:
   - **Canvas Background**: Atmospheric deep obsidian-slate `#0c0a14` with ambient radial amethyst glow.
   - **Surfaces**: Dark slate-violet cards `#161324` with hairline border `rgba(168, 85, 247, 0.22)` and inset highlight `rgba(255, 255, 255, 0.05)`.
   - **Primary Action Accent**: Luminous amethyst gradient (`#9333ea` to `#7e22ce`, hover `#a855f7`) with violet glow.
   - **Sigil & Badges**: Sigil SVG rendered in radiant amethyst `#c084fc`. Situation stamps rendered in refined rounded frames (`rounded-lg`).
   - **Destructive Actions**: Preserves explicit crimson alert styling (`#ef4444` / `#5a1219`) strictly for case deletion to prevent accidental loss.
3. **Android WebView & Touch Ergonomics**:
   - Hitbox size $\ge 44 \times 44\text{px}$ across all interactive elements (chips, checkboxes, back buttons, inputs).
   - Filter chips styled as smooth rounded capsules (`rounded-full`) with active violet rings.
   - Generous vertical padding (`py-3`) and touch expansion for mobile input fields.
   - Smooth slide-like view transition between case list and editor on mobile viewports.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Scoped IRL Theme vs. Global Overrides**
  - *Chosen Approach*: Apply Real L amethyst design tokens directly to `CadernoDeCampoView.tsx` with fallback `.theme-rl` CSS rules, ensuring the notebook looks native to IRL mode while remaining completely coherent with the app's overall design system.
  - *Why*: Direct tokenization guarantees pristine rendering regardless of parent container nesting or WebView rendering differences.
- **Decision 2: Modern Cards Without Visual Clutter**
  - *Chosen Approach*: Use subtle surface contrast ($<12\%$ delta), hairline violet borders, and soft 12–16px radii rather than heavy shadows or garish borders.
  - *Why*: Keeps the classified agency feel intact without falling into generic SaaS templates or over-embellished neon effects.

---

## 4. Technical Architecture & Component Structure

### Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CadernoDeCampoView.tsx                            │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Header: Luminous Amethyst Sigil · Title · Sync Tag · Count Badge │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐ │
│  │ Aside Panel (rounded-2xl card)│  │ Main Editor (rounded-2xl card) │ │
│  │ - + Novo Caso Button          │  │ - Dynamic Header & Stamp       │ │
│  │ - Search (rounded-xl)         │  │ - Title Input (rounded-xl)     │ │
│  │ - Filter Chips (rounded-full) │  │ - Metadata Grid (rounded-xl)   │ │
│  │ - Case Cards (rounded-xl)     │  │ - Lined Memo (rounded-xl)      │ │
│  │ - Import / Export Action Bar  │  │ - Clue Card Items (rounded-xl) │ │
│  └───────────────────────────────┘  └────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Affected Files

- `src/components/CadernoDeCampoView.tsx`: Complete UI restyle with curved card components, Real L color palette, and touch-optimized controls.
- `src/index.css`: Add supporting helper classes for Real L memo textarea and smooth scroll/focus behavior.
