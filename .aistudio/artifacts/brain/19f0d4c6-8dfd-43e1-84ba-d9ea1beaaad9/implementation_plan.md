# Sistema de Áudio Sincronizado para Mesas de RPG (Demologia Hub)

Implementação completa em TypeScript de um sistema de sincronização musical para mesas de RPG online utilizando **Supabase (PostgreSQL + Realtime + Storage)** e a **API nativa de áudio do navegador** (`HTMLAudioElement`), sem bibliotecas externas. Substitui totalmente o sistema legado baseado em base64 e eventos pontuais na tabela `players`.

---

## Revisão e Decisões Confirmadas

> [!IMPORTANT]
> Decisões alinhadas na Fase de Clarificação:
> - **Bucket de Armazenamento**: Nomeado como `audio-tracks` no Supabase Storage com acesso público de leitura.
> - **Escopo de Sala**: Identificador padrão `default-table`, com suporte arquitetural completo a múltiplas salas simultâneas via parâmetro de URL (`?room=id`) ou configuração de sessão.
> - **Políticas de RLS e Permissão**: Políticas de `SELECT` abertas para todos os participantes da mesa via chave `anon`. Políticas de gravação (`INSERT`, `UPDATE`, `DELETE`) concedidas para `anon` e `authenticated`, com a trava operacional e autorização de controle restrita no aplicativo através da autenticação de Mestre (`isMestreAuth`).

---

## 1. Visão Geral e Conceito Central

- **O que faz**: O Mestre controla a trilha sonora da mesa (reproduzir, pausar, retomar, parar, trocar de faixa, regular volume e ativar repetição/loop). Todos os jogadores conectados na mesa escutam exatamente o mesmo trecho da música, milimetricamente sincronizados através do relógio do servidor, com correção de drift e desbloqueio silencioso de autoplay.
- **Público-alvo**: O Mestre de jogo gerencia a biblioteca e a atmosfera; os Jogadores desfrutam da trilha sonora imersiva sem qualquer necessidade de interação visual, botões ou pop-ups intrusivos.
- **Valor Principal**: Eliminação da limitação de arquivos de 2.5MB e lag de base64 no banco; reprodução instantânea com suporte a upload de arquivos ilimitados (mp3, ogg, wav, m4a) ou links diretos, tolerância a oscilações de rede e recuperação automática de conexão.

---

## 2. Experiência do Usuário e Design Visual

### Fluxos do Mestre (Painel OST no Demologia Hub)
- **Aba "OST" no Painel do Mestre**:
  - Estética industrial e classificada de agência paranormal: tons `#0b0b0d` e `#151518`, acentos em carmesim (`#8f171c`), tipografia monoespaçada técnica (`JetBrains Mono`).
  - **Reprodutor em Destaque**: Exibição da faixa atual, barra de progresso em tempo real, botões de ação tátil (Play/Pause, Stop, Loop, Slider de Volume 0-100%).
  - **Biblioteca de Faixas**:
    - Upload direto (áudios `.mp3`, `.ogg`, `.wav`, `.m4a`) com envio em tempo real para o bucket `audio-tracks`.
    - Adição por Link Direto (URL HTTP/HTTPS).
    - Ações por faixa: Reproduzir agora, Renomear, Excluir (com remoção física no Storage se for upload).
    - Busca e filtragem rápida por nome.

### Fluxo dos Jogadores (Silencioso e Invisível)
- Nenhum componente visual, banner ou popup é exibido para os jogadores.
- Ao entrar na mesa (`joinRoom`), o motor busca o `playback_state` atual e calcula o deslocamento temporal entre o cliente e o servidor via `server_now()`.
- Se o áudio estiver tocando, inicia imediatamente na posição calculada: `(Date.now() + offset - started_at) / 1000`.
- Se o navegador bloquear o autoplay (`NotAllowedError`), o sistema registra listeners silenciosos (`pointerdown`, `keydown`, `touchstart`) em `document` com `{ once: true }`. No primeiro clique ou toque do jogador no tabuleiro ou na ficha, a música começa a tocar sincronizada e os listeners são descartados.
- Checagem a cada 60s de recalibração de relógio; se a diferença do áudio local para a posição ideal ultrapassar 0.3s, ajusta suavemente `audio.currentTime`.

---

## 3. Decisões de Engenharia e Trade-Offs

- **Sincronização por Timestamp do Servidor (`started_at`) vs Streaming Contínuo**:
  - *Abordagem Escolhida*: Armazenar o instante de início (`started_at`) e a posição de pausa (`paused_position`), permitindo que cada cliente compute localmente sua posição via Web Audio API.
  - *Por que*: Consome largura de banda insignificante no banco, elimina latência de WebRTC/servidor de streaming e garante sincronia com tolerância a drift de 0.3s.
- **Ntp-Lite para Sincronia de Relógio**:
  - *Abordagem Escolhida*: Medição do tempo de ida e volta (RTT) na chamada RPC `server_now()`, definindo `offset = serverTime - (tReq + tResp) / 2`.
  - *Por que*: Neutraliza diferenças de fuso horário, relógio do sistema operacional do jogador descalibrado e latência de rede.
- **Preload Inteligente**:
  - *Abordagem Escolhida*: Configuração de `audio.preload = 'auto'` e buffer prévio da faixa ativa para transições rápidas.

---

## 4. Arquitetura Técnica e Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE POSTGRESQL                             │
│  ┌───────────────────────┐             ┌─────────────────────────────┐ │
│  │     tracks            │             │       playback_state        │ │
│  │ (id, room_id, name,   │             │ (id, room_id, track_url,    │ │
│  │  url, source, etc.)   │             │  started_at, is_playing,    │ │
│  └───────────┬───────────┘             │  paused_pos, volume, loop)  │ │
│              │                         └──────────────┬──────────────┘ │
│              │ Realtime Broadcast                     │ Realtime       │
└──────────────┼────────────────────────────────────────┼────────────────┘
               │                                        │
               ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 CLIENT ENGINE (src/services/musicSync.ts)               │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         MusicSync Class                          │  │
│  │  - joinRoom(roomId, isMaster)                                    │  │
│  │  - syncClock(): RPC server_now() com compensação de RTT          │  │
│  │  - Realtime Channel ('room_audio_<roomId>')                      │  │
│  │  - HTMLAudioElement único + Autoplay Blocker Handler             │  │
│  │  - Drift Correction Loop (tolerância: 0.3s)                      │  │
│  │  - Métodos do Mestre: playTrack, pause, resume, stop, etc.       │  │
│  └───────────────────▲──────────────────────────────▲───────────────┘  │
│                      │                              │                  │
│       Controle do    │                              │ Sincronização    │
│       Mestre         │                              │ Silenciosa       │
│                      │                              │                  │
│  ┌───────────────────┴───────────────┐  ┌───────────┴───────────────┐  │
│  │      MasterOstPanel.tsx           │  │      App.tsx (Raiz)       │  │
│  │  - Lista de faixas & Busca        │  │  - Inicializa MusicSync   │  │
│  │  - Upload Storage (sem limite)    │  │  - Todos os jogadores     │  │
│  │  - Link externo (.mp3/.ogg)       │  │  - Sem UI para jogador    │  │
│  │  - Controles (Play/Stop/Vol/Loop) │  │  - Resiliente e invisível │  │
│  └───────────────────────────────────┘  └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Plano de Execução em Fases

1. **Geração do Script SQL Completo (`supabase_music_sync.sql`)**:
   - `DROP` das estruturas legadas de música.
   - Criação da tabela `playback_state` e `tracks` com índices e restrições.
   - Criação da função RPC `server_now()`.
   - Habilitação no `supabase_realtime` publication.
   - Políticas RLS para `playback_state`, `tracks` e bucket do Supabase Storage `audio-tracks`.
2. **Construção do Módulo Central (`src/services/musicSync.ts`)**:
   - Tipagem estrita de `PlaybackState`, `Track`, `MusicSyncOptions`.
   - Classe `MusicSync` encapsulando conexão, sincronia de relógio a cada 60s, manipulação de `HTMLAudioElement`, listeners de autoplay desbloqueado e reconexão automática.
   - Métodos do Mestre com tratamento de erro e `try/catch`.
   - Comentários detalhados em português.
3. **Criação do Novo Painel do Mestre (`src/components/MasterOstPanel.tsx`)**:
   - Interface renovada na estética de agência confidencial do Demologia Hub.
   - Integração com `MusicSync` para upload sem limites no bucket `audio-tracks`, cadastro de links externos, play/pause/stop/volume/loop e exclusão.
4. **Limpeza do Sistema Legado e Integração Global no `src/App.tsx`**:
   - Remover métodos antigos de manipulação de base64 e listeners `ost_update` manuais no canal de broadcast.
   - Inicializar a instância de `MusicSync` conectada à sala atual para todos os usuários (jogadores e mestre).
   - Manter reprodução de fundo contínua e desacoplada da navegação de abas.
5. **Verificação e Testes**:
   - Verificação de tipos via `lint_applet` e compilação com `compile_applet`.
   - Validação de que não há bibliotecas adicionais externas de áudio.
