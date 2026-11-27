export type CreationElementType =
  | "text"
  | "image"
  | "line"
  | "divider"
  | "rect"
  | "profile"
  | "description"
  | "info";

export type CreationFontFamily = "mono" | "display" | "sans" | "serif";
export type CreationTextAlign = "left" | "center" | "right";
export type CreationLineStyle = "solid" | "dashed" | "dotted";
export type CreationLineOrientation = "horizontal" | "vertical";
export type CreationExportFormat = "jpg" | "png";

export interface CreationInfoField {
  id: string;
  label: string;
  value: string;
}

export interface CreationElement {
  id: string;
  type: CreationElementType;
  /** Nome editável exibido na lista de camadas (layers) */
  name: string;
  /** Posição e dimensões livres em coordenadas lógicas A4 (794×1123) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Ordem de empilhamento (0 = fundo, maior = frente) */
  zIndex: number;
  opacity: number;
  visible: boolean;
  locked: boolean;

  // Estilo visual individual (cores HEX + borda)
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  accentColor: string;
  strokeColor: string;
  strokeWidth: number;
  lineStyle: CreationLineStyle;
  lineOrientation: CreationLineOrientation;

  // Tipografia individual (aplicada somente a este elemento)
  textColor: string;
  fontSize: number;
  fontFamily: CreationFontFamily;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  textAlign: CreationTextAlign;
  lineHeight: number;
  letterSpacing: number;
  padding: number;

  // Conteúdo específico por bloco (estritamente documental — sem mecânicas de RPG)
  textContent: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageAspectRatio: number | null;
  lockAspectRatio: boolean;
  objectFit: "contain" | "cover";
  fields: CreationInfoField[];
}

export interface CreationDocument {
  id: string;
  masterId: string;
  title: string;
  pageBackground: string;
  pageBorderColor: string;
  elements: CreationElement[];
  createdAt: string;
  updatedAt: string;
}

export interface CreationDocumentSummary {
  id: string;
  masterId: string;
  title: string;
  pageBackground: string;
  elementsCount: number;
  updatedAt: string;
}

export interface CreationHistoryState {
  past: CreationDocument[];
  present: CreationDocument;
  future: CreationDocument[];
}

export type CreationResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";
