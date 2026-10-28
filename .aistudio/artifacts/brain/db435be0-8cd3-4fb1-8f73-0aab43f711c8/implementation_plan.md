# Demologya ~ Hub — Refinamento de UI/UX & Responsividade (Mobile-First + Desktop)

Aprimoramento da camada visual, ergonomia de toque e arquitetura responsiva do **Demologya ~ Hub** para celulares (360px–430px), tablets (768px+) e computadores (1024px–1440px+), preservando 100% da identidade sombria/industrial do sistema (modos **Demologia** e **Real L**) e toda a lógica, fórmulas e sincronização via Supabase.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo foram confirmadas e orientam todas as melhorias visuais sem alterar nenhuma regra de negócio, fórmula de RPG ou integração de banco de dados.

- **Navegação Mobile Confirmada**: Manter exclusivamente o gatilho superior de menu gaveta (sem barra inferior adicional), refinando a área de toque para `44×44px`, respeitando `safe-area-inset-top` e liberando o máximo de espaço vertical (`100dvh`) para a ficha e terminais.
- **Layout Desktop Confirmado (`1024px+`)**: A barra lateral de navegação (`NavigationSidebar`) passa a ficar **fixa/ancorada à esquerda** em telas grandes (`lg:`), enquanto o conteúdo principal se expande à direita em layout multicoluna equilibrado para Ficha, Oráculo de Dados, Chat e Painel do Mestre.
- **Padrão de Modais Confirmado**: Todos os modais interativos (Rolagem de Habilidades, Senha do Mestre, Troca de Modo de Jogo, Confirmação de Desconexão e Logs) assumem formato **Bottom Sheet deslizante** no celular (ancorados na base com alça visual e `safe-area-inset-bottom`) e permanecem **centralizados** no PC.

---

## 1. Overview & Core Concept

- **O Que Faz**: Refina toda a interface do **Demologya ~ Hub** para oferecer leitura imediata, alvos de toque ergonômicos (`≥ 44×44px`), inputs sem zoom indesejado no iOS (`≥ 16px`), prevenção total de overflow horizontal e aproveitamento inteligente de telas widescreen no PC.
- **Público-Alvo & Contexto**: Jogadores acompanhando suas fichas pelo celular ou Android WebView durante a sessão e o Mestre gerenciando múltiplos agentes, iniciativas, trilhas sonoras (OST) e grid tático no computador ou tablet.
- **Valor Principal**: Experiência tátil fluida no celular e painel de controle de alta densidade no desktop, mantendo intacta a atmosfera confidencial de investigação paranormal.

---

## 2. User Experience & Visual Design

### Fluxos de Uso & Ergonomia
1. **Acesso Mobile (`360px–430px`)**:
   - Botão superior do menu gaveta e atalho do Caderno de Campo dimensionados em `44×44px` com espaçamento seguro e suporte a `env(safe-area-inset-top)`.
   - Na **Ficha**, os controles de HP, PE/SM, atributos (`VIT`, `AGL`, `FOR`, `OCU`, `INT`, `SAN`), skills em papel rasgado, tributo e inventário fluem em coluna única sem cortes laterais, com inputs de `16px` (`1rem`) para evitar auto-zoom no iOS/Android.
   - Ao acionar uma Skill, Autenticação do Mestre ou Seleção de Modo no celular, o modal desliza a partir da base da tela (**Bottom Sheet**) na zona natural do polegar.
2. **Operação Desktop (`1024px–1440px+`)**:
   - A `NavigationSidebar` fica permanentemente visível na coluna esquerda (`280px`), permitindo alternar instantaneamente entre **Ficha**, **Rolar Dados**, **Chat da Mesa**, **Conexão**, **Caderno de Campo** e **Mestre**.
   - Na **Ficha**, o painel esquerdo exibe o HUD e Habilidades/Tributo, enquanto a coluna direita agrupa Variáveis de Status, Inventário e Sistema em grade estruturada.
   - No **Oráculo de Dados**, o painel de Dados Rápidos + Multiplicador e o Terminal de Rolagem + Atalhos de Fórmulas são dispostos lado a lado em 2 colunas no desktop.

### Identidade Visual & Tema (Preservação Estrita)
- **Direção Estética**: Sistema operacional confidencial de agência paranormal, industrial, clínico e opressivo, com cantos retos (`border-radius: 0`), divisórias técnicas e contraste rigoroso.
- **Paleta de Cores & Variáveis CSS (`:root`)**:
  - **Modo Demologia**: Fundo preto/grafite profundo (`#0b0b0d`, `#111114`, `#151518`), acento vermelho sangue (`#8f171c`, `#b52a30`), azul de esforço (`#00a8ff`), barras de papel envelhecido (`--paper-bg`) e carmesim de Tributo (`--tributo-bg`).
  - **Modo Real L (`.theme-rl`)**: Atmosfera roxa/prata (`#a855f7`, `#c084fc`, `#e2e8f0`) com preservação das barras de status e ocultação de elementos paranormais.
  - **Novos Tokens de Escala & Espaçamento**: Escala padronizada (`--space-1: 4px` a `--space-8: 32px`), alturas de toque (`--touch-target: 44px`), sombras e transições suaves (`--transition-fast: 150ms`, `--transition-base: 220ms`).
- **Tipografia & Hierarquia**:
  - Preservação das famílias `Blur Light Regular`, `JetBrains Mono`, `Cinzel`, `Oswald` e `Special Elite`.
  - Uso de `tabular-nums` em todos os contadores de HP, PE, SM, iniciativas e resultados de dados para alinhamento vertical perfeito.
  - Uso de `clamp()` em títulos e contadores do HUD para escalar sem quebrar em telas de `360px`.
- **Feedback Interativo & Acessibilidade**:
  - Estados claros de `:hover` (PC), `:active` (escala tátil suave no toque), `:focus-visible` (contorno nítido para teclado) e `:disabled`.
  - Suporte integral a `@media (prefers-reduced-motion: reduce)` para desativar animações contínuas ou transições pesadas quando solicitado pelo sistema operacional.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Sidebar Fixa no Desktop (`lg:`) vs. Gaveta Deslizante no Mobile**
  - *Abordagem Escolhida*: Em viewports `< 1024px`, a `NavigationSidebar` atua como gaveta modal com backdrop e suporte à tecla `Esc`; em viewports `≥ 1024px`, ela se ancora estaticamente à esquerda do layout principal (`100dvh sticky top-0`).
  - *Por quê*: Elimina cliques extras para trocar entre Ficha, Dados, Chat e Mestre no PC, aproveitando monitores widescreen sem alterar o comportamento compacto que o usuário prefere no celular.
- **Decisão 2: Modais Híbridos (Bottom Sheet Mobile / Dialog Centralizado Desktop)**
  - *Abordagem Escolhida*: Uso de utilitários responsivos (`items-end sm:items-center`, `p-0 sm:p-4`, alça superior `sm:hidden` e `pb-[ max(1rem, env(safe-area-inset-bottom)) ]`) nos modais existentes.
  - *Por quê*: Facilita o alcance com uma só mão no celular mantendo a estética quadrada e industrial da Demologia, sem criar componentes duplicados.
- **Decisão 3: Inputs a `16px` e Alvos de Toque `44×44px` Sem Alterar a Lógica**
  - *Abordagem Escolhida*: Ajuste de `font-size: 16px` (`text-base`) e `min-h-[44px] min-w-[44px]` nos campos de texto, seletores de variável, botões de deletar/editar skill e controles de HP/PE/SM.
  - *Por quê*: Impede o zoom forçado do Safari/WebView ao focar em inputs no celular e evita toques acidentais em botões próximos.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Arquitetura Visual & Hierarquia de Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         VIEWPORT SHELL (min-h-100dvh)                        │
├────────────────────────┬─────────────────────────────────────────────────────┤
│   NAVIGATION SIDEBAR   │                MAIN WORKSPACE CANVAS                │
│                        │                                                     │
│  • Mobile (<1024px):   │  ┌───────────────────────────────────────────────┐  │
│    Top Button (44×44)  │  │ 1. FICHA DO AGENTE / EXTRA                    │  │
│    + Slide-Over Drawer │  │    • Mobile: 1 Coluna fluida                  │  │
│                        │  │    • Desktop: Grid 2 Colunas (HUD+Skills /    │  │
│  • Desktop (≥1024px):  │  │      Variáveis+Inventário+Sistema)            │  │
│    Sidebar Fixa 280px  │  ├───────────────────────────────────────────────┤  │
│    (Sticky 100dvh)     │  │ 2. ORÁCULO DE DADOS                           │  │
│                        │  │    • Mobile: Empilhado                        │  │
│  Rotas & Ações:        │  │    • Desktop: 2 Colunas (Dados Rápidos /      │  │
│  ├─ Início / HUD       │  │      Terminal de Rolagem + Atalhos)           │  │
│  ├─ Técnicas & Inv.    │  ├───────────────────────────────────────────────┤  │
│  ├─ Rolar Dados        │  │ 3. CHAT DA MESA & CADERNO DE CAMPO            │  │
│  ├─ Chat da Mesa       │  │    • Container 100dvh com safe-area e inputs  │  │
│  ├─ Conexão Supabase   │  │      ≥16px sem overflow horizontal            │  │
│  ├─ Caderno (Modo RL)  │  ├───────────────────────────────────────────────┤  │
│  ├─ Painel do Mestre   │  │ 4. PAINEL DO MESTRE (Jogadores, OST, Extras)  │  │
│  └─ Backup JSON & Logs │  │    • Header responsivo + Tabelas/Cards 44px   │  │
│                        │  └───────────────────────────────────────────────┘  │
├────────────────────────┴─────────────────────────────────────────────────────┤
│          HYBRID MODAL LAYER (Bottom Sheet no Mobile / Center no PC)          │
│     [ Rolagem de Skill ]  [ Senha Mestre ]  [ Modos ]  [ Kick ]  [ Logs ]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento de Componentes & Preservação de Estado
- **Tokens Globais e Responsividade**:
  - Expansão das variáveis `:root` para escala de espaçamento, tipografia fluida com `clamp()`, `100dvh`, `tabular-nums`, alvos mínimos de `44×44px` e `@media (prefers-reduced-motion: reduce)`.
- **Shell Principal & Navegação**:
  - Ajuste do container raiz para flex-row no desktop (`lg:flex-row`) acomodando a sidebar fixa de `280px` e o `<main className="flex-1 min-w-0">`.
  - Conversão dos modais inline (uso de skill, confirmação de desconexão, histórico de atualizações) para o padrão Bottom Sheet no mobile e centralizado no PC.
  - Em `Oráculo`, disposição responsiva em grid de 2 colunas no desktop (`lg:grid-cols-12`) unindo `QuickDiceSection` e `RollingTerminal` + `FormulaShortcutsSection`.
- **Modais e Componentes de Toque**:
  - `PasswordAuthModal` e `MasterGameModeModal`: suporte a Bottom Sheet no mobile com alça superior, botões de `min-h-[44px]` e inputs de `16px`.
  - `MasterHeaderBar`, `MasterPlayersView`, `QuickDiceSection`, `RollingTerminal` e `FormulaShortcutsSection`: ajuste de alvos clicáveis para `≥ 44×44px`, inputs em `16px` e prevenção de truncamento ou rolagem horizontal em telas de `360px`.
