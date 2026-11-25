import React from "react";
import {
  Bell,
  BellOff,
  Dices,
  Eye,
  RotateCcw,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  Type,
  Vibrate,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  MAX_NOTIFICATION_DURATION_SEC,
  MIN_NOTIFICATION_DURATION_SEC,
  PlayerSettings,
  PlayerTextScale,
  computeLocalEffectiveOutputPercent,
  computeNotificationDurationMs,
} from "../utils/playerSettings";
import type { UseWakeLockResult } from "../hooks/useWakeLock";

export interface PlayerSettingsViewProps {
  settings: PlayerSettings;
  onUpdateSettings: (patch: Partial<PlayerSettings>) => void;
  onResetSettings: () => void;
  wakeLock: UseWakeLockResult;
  currentOstVolume: number;
  isOstPlaying: boolean;
  isRlMode?: boolean;
  onTestSound: () => void;
  onTestNotification: () => void;
}

const VOLUME_PRESETS = [0, 0.25, 0.5, 0.75, 1] as const;
const NOTIFICATION_PRESETS = [
  { sec: 2, label: "2s · Curto" },
  { sec: 4, label: "4s · Padrão" },
  { sec: 7, label: "7s · Longo" },
  { sec: 10, label: "10s · Estendido" },
] as const;

const TEXT_SCALE_OPTIONS: { id: PlayerTextScale; label: string; hint: string }[] = [
  { id: "compact", label: "Compacto", hint: "94%" },
  { id: "normal", label: "Padrão", hint: "100%" },
  { id: "large", label: "Ampliado", hint: "108%" },
];

interface SettingToggleRowProps {
  id: string;
  testId: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  isRlMode: boolean;
  statusLabel?: string;
}

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  id,
  testId,
  icon,
  title,
  description,
  checked,
  onToggle,
  isRlMode,
  statusLabel,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 border flex items-center justify-center shrink-0 mt-0.5 ${
            checked
              ? isRlMode
                ? "bg-purple-950/50 border-purple-500/45 text-[#d8b4fe]"
                : "bg-[#1d090b] border-[var(--op-red)]/55 text-[var(--op-red-bright)]"
              : "bg-[#12121a] border-[#242430] text-[#747686]"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="block text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
          >
            {title}
          </label>
          <p className="text-[11px] font-sans text-[#8b8d9e] leading-snug mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={onToggle}
        className={`min-w-[68px] min-h-[40px] px-2.5 border text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer touch-manipulation shrink-0 ${
          checked
            ? isRlMode
              ? "bg-purple-950/60 border-purple-500/70 text-purple-100"
              : "bg-[#240a0e] border-[var(--op-red-bright)] text-white"
            : "bg-[#111118] border-[#262634] text-[#7c7e90] hover:text-white"
        }`}
      >
        {statusLabel || (checked ? "ATIVO" : "OFF")}
      </button>
    </div>
  );
};

export const PlayerSettingsView: React.FC<PlayerSettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  wakeLock,
  currentOstVolume,
  isOstPlaying,
  isRlMode = false,
  onTestSound,
  onTestNotification,
}) => {

  const appVolumePercent = settings.appMuted
    ? 0
    : Math.round(settings.appVolume * 100);
  const ostVolumePercent = Math.round(
    Math.max(0, Math.min(1, currentOstVolume)) * 100,
  );
  const effectiveLocalOutputPercent = computeLocalEffectiveOutputPercent(
    currentOstVolume,
    settings,
  );

  const rollMs = computeNotificationDurationMs(
    settings.notificationDurationSec,
    "roll",
  );
  const handoutMs = computeNotificationDurationMs(
    settings.notificationDurationSec,
    "handout",
  );

  const accentTopBorder = isRlMode
    ? "border-t-purple-500"
    : "border-t-[var(--op-red)]";
  const accentText = isRlMode
    ? "text-[#c084fc]"
    : "text-[var(--op-red-bright)]";
  const accentSlider = isRlMode ? "accent-purple-500" : "accent-blood-red";

  const handleToggleMute = () => {
    if (settings.appMuted) {
      onUpdateSettings({
        appMuted: false,
        appVolume: settings.appVolume <= 0 ? 1.0 : settings.appVolume,
      });
    } else {
      onUpdateSettings({ appMuted: true });
    }
  };

  return (
    <div
      className="w-full max-w-4xl mx-auto pt-14 lg:pt-6 pb-28 sm:pb-20 px-3 sm:px-5 font-mono text-gray-200 flex flex-col gap-4"
      data-testid="player-settings-view"
    >
      {/* CABEÇALHO */}
      <header
        className={`bg-[#0c0c10] border border-[#202028] border-t-2 ${accentTopBorder} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8e90a0]">
            Preferências Locais · Dispositivo do Jogador
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Settings size={18} className={`${accentText} shrink-0`} />
            <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider truncate">
              Configurações
            </h1>
          </div>
          <p className="text-[11px] font-sans text-[#8b8d9e] mt-1">
            Ajustes aplicados apenas neste navegador/dispositivo. Não alteram
            regras, ficha nem o estado da narrativa da mesa.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetSettings}
          data-testid="settings-reset-btn"
          className="min-h-[42px] px-3.5 bg-[#14141c] hover:bg-[#1d1d29] border border-[#2a2a38] text-zinc-300 hover:text-white text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors touch-manipulation shrink-0"
        >
          <RotateCcw size={13} />
          <span>Restaurar Padrões</span>
        </button>
      </header>

      {/* SEÇÃO 1: ÁUDIO DO APLICATIVO (ESCALA LOCAL SEM ALTERAR OST) */}
      <section
        aria-label="Áudio do Aplicativo"
        className="bg-[#0c0c10] border border-[#202028] p-4 sm:p-5 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1c1c25]">
          <div className="flex items-center gap-2">
            <Volume2 size={15} className={accentText} />
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Volume Geral do Aplicativo
            </h2>
          </div>

          <button
            type="button"
            onClick={onTestSound}
            data-testid="settings-test-sound-btn"
            className="min-h-[36px] px-3 bg-[#151520] hover:bg-[#1f1f2d] border border-[#2b2b3a] text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
          >
            <Dices size={13} className={accentText} />
            <span>Testar Som</span>
          </button>
        </div>

        {/* Controle de Volume Geral */}
        <div className="bg-[#08080c] border border-[#1e1e28] p-3.5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleMute}
              data-testid="settings-app-mute-btn"
              aria-label={
                settings.appMuted
                  ? "Restaurar volume do aplicativo"
                  : "Silenciar aplicativo"
              }
              aria-pressed={settings.appMuted}
              className={`w-11 h-11 border flex items-center justify-center shrink-0 cursor-pointer transition-colors touch-manipulation ${
                settings.appMuted || appVolumePercent === 0
                  ? "bg-red-950/50 border-[var(--op-red)] text-red-300"
                  : "bg-[#14141d] border-[#282836] text-white hover:border-[#3e3e52]"
              }`}
            >
              {settings.appMuted || appVolumePercent === 0 ? (
                <VolumeX size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <label
                  htmlFor="settings-app-volume-slider"
                  className="text-[11px] font-bold uppercase tracking-wider text-zinc-200"
                >
                  Saída Geral da Página
                </label>
                <span
                  data-testid="settings-app-volume-label"
                  className="text-sm font-bold text-white tabular-nums"
                >
                  {settings.appMuted ? "MUDO (0%)" : `${appVolumePercent}%`}
                </span>
              </div>

              <input
                id="settings-app-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.appMuted ? 0 : settings.appVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateSettings({
                    appVolume: val,
                    appMuted: val === 0,
                  });
                }}
                aria-label="Volume geral do aplicativo"
                data-testid="settings-app-volume-slider"
                className={`w-full h-2 ${accentSlider} cursor-pointer touch-manipulation`}
              />
            </div>
          </div>

          {/* Atalhos rápidos de volume */}
          <div className="grid grid-cols-5 gap-1.5">
            {VOLUME_PRESETS.map((preset) => {
              const pct = Math.round(preset * 100);
              const isSelected =
                (preset === 0 && (settings.appMuted || settings.appVolume === 0)) ||
                (!settings.appMuted && Math.round(settings.appVolume * 100) === pct);
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      appVolume: preset,
                      appMuted: preset === 0,
                    })
                  }
                  data-testid={`settings-vol-preset-${pct}`}
                  className={`min-h-[38px] text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer touch-manipulation tabular-nums ${
                    isSelected
                      ? isRlMode
                        ? "bg-purple-950/60 border-purple-500 text-white"
                        : "bg-[#240a0e] border-[var(--op-red-bright)] text-white"
                      : "bg-[#101018] border-[#22222f] text-[#8e90a0] hover:text-white hover:border-[#343446]"
                  }`}
                >
                  {pct}%
                </button>
              );
            })}
          </div>

          {/* Transparência técnica: OST do Mestre preservada */}
          <div
            data-testid="settings-ost-isolation-info"
            className="pt-2.5 border-t border-[#191924] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8f91a2]"
          >
            <span className="font-sans">
              Abaixa o volume geral da página (OSTs, Sound Boards e dados) sem
              alterar o volume configurado nas trilhas da mesa.
            </span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-300 bg-[#12121b] border border-[#242432] px-2 py-1 tabular-nums shrink-0">
              OST {isOstPlaying ? "(Ativa)" : ""}: {ostVolumePercent}% → Local:{" "}
              <strong className="text-white">
                {effectiveLocalOutputPercent}%
              </strong>
            </span>
          </div>
        </div>

        {/* Som de rolagem de dados */}
        <div className="divide-y divide-[#1a1a23]">
          <SettingToggleRow
            id="setting-dice-sound"
            testId="settings-toggle-dice-sound"
            icon={<Dices size={15} />}
            title="Som de Rolagem de Dados"
            description="Reproduz o efeito sonoro discreto ao rolar dados, ataques, skills e rituais."
            checked={settings.diceSoundEnabled}
            onToggle={() =>
              onUpdateSettings({ diceSoundEnabled: !settings.diceSoundEnabled })
            }
            isRlMode={isRlMode}
          />
        </div>
      </section>

      {/* SEÇÃO 2: NOTIFICAÇÕES */}
      <section
        aria-label="Notificações"
        className="bg-[#0c0c10] border border-[#202028] p-4 sm:p-5 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1c1c25]">
          <div className="flex items-center gap-2">
            <Bell size={15} className={accentText} />
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">
              Notificações na Tela
            </h2>
          </div>

          <button
            type="button"
            onClick={onTestNotification}
            data-testid="settings-test-notif-btn"
            className="min-h-[36px] px-3 bg-[#151520] hover:bg-[#1f1f2d] border border-[#2b2b3a] text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
          >
            <Bell size={13} className={accentText} />
            <span>Testar Notificação</span>
          </button>
        </div>

        {/* Controle de tempo das notificações */}
        <div className="bg-[#08080c] border border-[#1e1e28] p-3.5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="settings-notif-duration-slider"
              className="text-[11px] font-bold uppercase tracking-wider text-zinc-200"
            >
              Tempo de Exibição
            </label>
            <span
              data-testid="settings-notif-duration-label"
              className="text-sm font-bold text-white tabular-nums"
            >
              {settings.notificationDurationSec}s
            </span>
          </div>

          <input
            id="settings-notif-duration-slider"
            type="range"
            min={MIN_NOTIFICATION_DURATION_SEC}
            max={MAX_NOTIFICATION_DURATION_SEC}
            step="1"
            value={settings.notificationDurationSec}
            onChange={(e) =>
              onUpdateSettings({
                notificationDurationSec: parseInt(e.target.value, 10),
              })
            }
            aria-label="Tempo de exibição das notificações em segundos"
            data-testid="settings-notif-duration-slider"
            className={`w-full h-2 ${accentSlider} cursor-pointer touch-manipulation`}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {NOTIFICATION_PRESETS.map((preset) => {
              const isSelected = settings.notificationDurationSec === preset.sec;
              return (
                <button
                  key={preset.sec}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ notificationDurationSec: preset.sec })
                  }
                  data-testid={`settings-notif-preset-${preset.sec}`}
                  className={`min-h-[38px] px-2 text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer touch-manipulation ${
                    isSelected
                      ? isRlMode
                        ? "bg-purple-950/60 border-purple-500 text-white"
                        : "bg-[#240a0e] border-[var(--op-red-bright)] text-white"
                      : "bg-[#101018] border-[#22222f] text-[#8e90a0] hover:text-white hover:border-[#343446]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#191924] flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-[#7e8092]">
            <span>Rolagens: {(rollMs / 1000).toFixed(0)}s</span>
            <span>Handouts recebidos: {(handoutMs / 1000).toFixed(0)}s</span>
          </div>
        </div>

        <div className="divide-y divide-[#1a1a23]">
          <SettingToggleRow
            id="setting-show-roll-toasts"
            testId="settings-toggle-roll-toasts"
            icon={
              settings.showRollNotifications ? (
                <Bell size={15} />
              ) : (
                <BellOff size={15} />
              )
            }
            title="Notificações Pop-up de Rolagem"
            description="Exibe o aviso flutuante no canto superior ao rolar dados. Alertas críticos de Último Suspiro permanecem ativos."
            checked={settings.showRollNotifications}
            onToggle={() =>
              onUpdateSettings({
                showRollNotifications: !settings.showRollNotifications,
              })
            }
            isRlMode={isRlMode}
          />
        </div>
      </section>

      {/* SEÇÃO 3: CONFORTO VISUAL E DISPOSITIVO (NÃO-NARRATIVO) */}
      <section
        aria-label="Conforto Visual e Dispositivo"
        className="bg-[#0c0c10] border border-[#202028] p-4 sm:p-5 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-[#1c1c25]">
          <Eye size={15} className={accentText} />
          <h2 className="text-xs font-bold uppercase tracking-widest text-white">
            Conforto Visual e Dispositivo
          </h2>
        </div>

        {/* Escala de Texto */}
        <div className="bg-[#08080c] border border-[#1e1e28] p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Type size={14} className={accentText} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-200">
              Tamanho do Texto da Interface
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TEXT_SCALE_OPTIONS.map((opt) => {
              const selected = settings.textScale === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ textScale: opt.id })}
                  data-testid={`settings-text-scale-${opt.id}`}
                  aria-pressed={selected}
                  className={`min-h-[44px] px-2.5 py-2 border flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer touch-manipulation ${
                    selected
                      ? isRlMode
                        ? "bg-purple-950/60 border-purple-500 text-white"
                        : "bg-[#240a0e] border-[var(--op-red-bright)] text-white"
                      : "bg-[#101018] border-[#22222f] text-[#8e90a0] hover:text-white hover:border-[#343446]"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-[#7c7e90] tabular-nums">
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-[#1a1a23]">
          <SettingToggleRow
            id="setting-reduced-motion"
            testId="settings-toggle-reduced-motion"
            icon={<Sparkles size={15} />}
            title="Reduzir Animações"
            description="Desativa transições e movimentos contínuos da interface para maior conforto visual e economia de bateria."
            checked={settings.reducedMotion}
            onToggle={() =>
              onUpdateSettings({ reducedMotion: !settings.reducedMotion })
            }
            isRlMode={isRlMode}
          />

          <SettingToggleRow
            id="setting-screen-shake"
            testId="settings-toggle-screen-shake"
            icon={<Smartphone size={15} />}
            title="Tremor de Tela nas Rolagens"
            description="Aplica um leve impacto visual no terminal de dados quando uma rolagem é disparada."
            checked={settings.screenShakeEnabled}
            onToggle={() =>
              onUpdateSettings({
                screenShakeEnabled: !settings.screenShakeEnabled,
              })
            }
            isRlMode={isRlMode}
          />

          <SettingToggleRow
            id="setting-haptics"
            testId="settings-toggle-haptics"
            icon={<Vibrate size={15} />}
            title="Vibração Tátil (Mobile)"
            description="Ativa feedback tátil em celulares compatíveis durante rolagens e eventos de ficha."
            checked={settings.hapticsEnabled}
            onToggle={() =>
              onUpdateSettings({ hapticsEnabled: !settings.hapticsEnabled })
            }
            isRlMode={isRlMode}
          />

          <SettingToggleRow
            id="setting-wake-lock"
            testId="settings-toggle-wake-lock"
            icon={<Sun size={15} />}
            title="Manter Tela Acesa"
            description="Evita que a tela do dispositivo apague automaticamente durante sessões longas."
            checked={wakeLock.enabled}
            onToggle={() => {
              void wakeLock.toggle();
            }}
            isRlMode={isRlMode}
            statusLabel={
              wakeLock.enabled
                ? wakeLock.active
                  ? "ATIVA"
                  : wakeLock.waitingForGesture
                    ? "TOQUE"
                    : "ON"
                : "OFF"
            }
          />
          {wakeLock.errorMessage && (
            <div
              role="status"
              className="mt-2 px-2.5 py-1.5 text-[11px] font-mono text-[#ff8085] bg-[#16090b] border border-[#4a1418] leading-snug"
            >
              {wakeLock.errorMessage}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
