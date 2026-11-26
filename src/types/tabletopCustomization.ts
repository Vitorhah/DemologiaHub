export type TabletopThemePresetId = "demologia" | "nirvana" | "profano" | "custom";

export type TabletopCornerRadius = "none" | "subtle" | "medium" | "rounded";
export type TabletopShadowIntensity = "none" | "subtle" | "medium" | "strong";
export type TabletopInterfaceDensity = "compact" | "normal" | "comfortable";
export type TabletopAnimationIntensity = "reduced" | "normal" | "expressive";

export interface TabletopBrandingConfig {
  /** Logo principal da plataforma (sidebar, cabeçalho). Vazio = logo oficial Demologia. */
  primaryLogoUrl: string;
  /** Logo secundária (emblema principal na ficha / selo da campanha). Vazio = logo oficial Demologia. */
  secondaryLogoUrl: string;
  /** Nome exibido no cabeçalho/sidebar. Vazio = "Demologya". */
  headerTitle: string;
  /** Subtítulo ou nome da temporada exibido sob o cabeçalho. */
  seasonSubtitle: string;
  /** Ícone visual da campanha (badge + favicon). */
  campaignIconUrl: string;
}

export interface TabletopColorsConfig {
  /** Cor principal (destaques estruturais, abas ativas, emblemas). */
  primary: string;
  /** Cor secundária (variação escura/suporte da cor principal). */
  secondary: string;
  /** Cor de destaque (acentos vivos, indicadores e foco). */
  accent: string;
  /** Cor de fundo geral da plataforma. */
  background: string;
  /** Cor de fundo dos painéis e cartões. */
  panel: string;
  /** Cor dos textos principais. */
  textPrimary: string;
  /** Cor dos textos secundários e rótulos. */
  textSecondary: string;
  /** Cor das bordas e divisórias. */
  border: string;
  /** Cor dos botões e elementos interativos principais. */
  interactive: string;
}

export type TabletopBackgroundMediaType = "default" | "image" | "gif" | "video";

export interface TabletopBackgroundConfig {
  /** URL do fundo personalizado (imagem, GIF ou MP4/WebM em loop). Vazio = fundo padrão. */
  url: string;
  mediaType: TabletopBackgroundMediaType;
  /** Escurecimento sobre o fundo personalizado em porcentagem (0 a 90). */
  overlayOpacity: number;
}

export interface TabletopInterfaceStyleConfig {
  cornerRadius: TabletopCornerRadius;
  shadowIntensity: TabletopShadowIntensity;
  /** Opacidade dos painéis em porcentagem (0 a 100; 0 = 100% transparente / painéis invisíveis). */
  panelOpacity: number;
  density: TabletopInterfaceDensity;
  animationIntensity: TabletopAnimationIntensity;
  /** Quando true, deixa apenas o painel de fundo (caixa/borda/sombra) de HP e PE invisível, preservando todos os elementos internos. */
  hideHpPePanelBackground: boolean;
  /** Escala de tamanho da logo em porcentagem (50 a 180; padrão 100). */
  logoScale: number;
  /** Espessura da outline (contorno) do nome da ficha em px (0 a 10; padrão 2.5). */
  sheetNameOutlineSize: number;
}

export interface TabletopCustomizationConfig {
  version: 1;
  roomId: string;
  presetId: TabletopThemePresetId;
  branding: TabletopBrandingConfig;
  background: TabletopBackgroundConfig;
  colors: TabletopColorsConfig;
  interfaceStyle: TabletopInterfaceStyleConfig;
  updatedAt: number;
}

export interface TabletopThemePresetDefinition {
  id: Exclude<TabletopThemePresetId, "custom">;
  name: string;
  tagline: string;
  description: string;
  colors: TabletopColorsConfig;
  interfaceStyle: TabletopInterfaceStyleConfig;
}

export type TabletopBrandImageSlot =
  | "primaryLogoUrl"
  | "secondaryLogoUrl"
  | "campaignIconUrl";

export interface TabletopCustomPreset {
  id: string;
  name: string;
  branding: TabletopBrandingConfig;
  background: TabletopBackgroundConfig;
  colors: TabletopColorsConfig;
  interfaceStyle: TabletopInterfaceStyleConfig;
  createdAt: number;
  updatedAt: number;
}

