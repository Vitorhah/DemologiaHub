import type { CreationResizeHandle } from "../types/masterCreations";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  MIN_CREATION_ELEMENT_HEIGHT,
  MIN_CREATION_ELEMENT_WIDTH,
} from "./masterCreations";

export interface CreationRectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreationGuideReference extends CreationRectBox {
  id: string;
}

export type SmartGuideKind =
  | "page-center"
  | "page-edge"
  | "element-edge"
  | "element-center";

export interface SmartGuideLine {
  orientation: "vertical" | "horizontal";
  /** Posição no eixo perpendicular (X para vertical, Y para horizontal), em px A4 */
  position: number;
  /** Início do traço no eixo paralelo (Y1 para vertical, X1 para horizontal) */
  start: number;
  /** Fim do traço no eixo paralelo (Y2 para vertical, X2 para horizontal) */
  end: number;
  kind: SmartGuideKind;
}

export interface SmartSpacingGuide {
  orientation: "horizontal" | "vertical";
  /** Coordenada no eixo transversal onde a régua de distância é desenhada */
  crossPos: number;
  start: number;
  end: number;
  /** Distância arredondada em px */
  distance: number;
}

export interface SmartGuideResult {
  box: CreationRectBox;
  guides: SmartGuideLine[];
  spacingGuides: SmartSpacingGuide[];
}

export interface SmartGuidesOptions {
  /** Ativa ou desativa completamente a régua automática */
  enabled?: boolean;
  /**
   * Permite que o alinhamento aplique um leve auxílio magnético.
   * Quando false (ex.: segurando Alt), a posição nunca é ajustada.
   */
  assistSnap?: boolean;
  /** Raio suave de detecção em px A4 (padrão leve: 5px — auxilia sem prender) */
  threshold?: number;
  pageWidth?: number;
  pageHeight?: number;
  pageMargin?: number;
}

/** Raio padrão leve (5px na folha A4) para auxiliar no alinhamento sem prender o movimento */
export const DEFAULT_SMART_GUIDE_THRESHOLD_PX = 5;
export const DEFAULT_A4_GUIDE_MARGIN_PX = 36;

interface AxisTarget {
  value: number;
  spanStart: number;
  spanEnd: number;
  kind: SmartGuideKind;
  priority: number; // menor = maior prioridade em empates exatos
}

interface AxisAnchor {
  value: number;
  applyOffset: (delta: number, box: CreationRectBox) => CreationRectBox;
  isCenter: boolean;
}

function buildPageVerticalTargets(
  pageWidth: number,
  pageHeight: number,
  margin: number,
): AxisTarget[] {
  const targets: AxisTarget[] = [
    {
      value: pageWidth / 2,
      spanStart: 0,
      spanEnd: pageHeight,
      kind: "page-center",
      priority: 0,
    },
    {
      value: 0,
      spanStart: 0,
      spanEnd: pageHeight,
      kind: "page-edge",
      priority: 2,
    },
    {
      value: pageWidth,
      spanStart: 0,
      spanEnd: pageHeight,
      kind: "page-edge",
      priority: 2,
    },
  ];
  if (margin > 0 && margin * 2 < pageWidth) {
    targets.push(
      {
        value: margin,
        spanStart: margin,
        spanEnd: pageHeight - margin,
        kind: "page-edge",
        priority: 2,
      },
      {
        value: pageWidth - margin,
        spanStart: margin,
        spanEnd: pageHeight - margin,
        kind: "page-edge",
        priority: 2,
      },
    );
  }
  return targets;
}

function buildPageHorizontalTargets(
  pageWidth: number,
  pageHeight: number,
  margin: number,
): AxisTarget[] {
  const targets: AxisTarget[] = [
    {
      value: pageHeight / 2,
      spanStart: 0,
      spanEnd: pageWidth,
      kind: "page-center",
      priority: 0,
    },
    {
      value: 0,
      spanStart: 0,
      spanEnd: pageWidth,
      kind: "page-edge",
      priority: 2,
    },
    {
      value: pageHeight,
      spanStart: 0,
      spanEnd: pageWidth,
      kind: "page-edge",
      priority: 2,
    },
  ];
  if (margin > 0 && margin * 2 < pageHeight) {
    targets.push(
      {
        value: margin,
        spanStart: margin,
        spanEnd: pageWidth - margin,
        kind: "page-edge",
        priority: 2,
      },
      {
        value: pageHeight - margin,
        spanStart: margin,
        spanEnd: pageWidth - margin,
        kind: "page-edge",
        priority: 2,
      },
    );
  }
  return targets;
}

function buildSiblingVerticalTargets(
  siblings: readonly CreationGuideReference[],
): AxisTarget[] {
  const out: AxisTarget[] = [];
  for (const s of siblings) {
    const spanStart = s.y;
    const spanEnd = s.y + s.height;
    out.push(
      {
        value: s.x,
        spanStart,
        spanEnd,
        kind: "element-edge",
        priority: 1,
      },
      {
        value: s.x + s.width / 2,
        spanStart,
        spanEnd,
        kind: "element-center",
        priority: 1,
      },
      {
        value: s.x + s.width,
        spanStart,
        spanEnd,
        kind: "element-edge",
        priority: 1,
      },
    );
  }
  return out;
}

function buildSiblingHorizontalTargets(
  siblings: readonly CreationGuideReference[],
): AxisTarget[] {
  const out: AxisTarget[] = [];
  for (const s of siblings) {
    const spanStart = s.x;
    const spanEnd = s.x + s.width;
    out.push(
      {
        value: s.y,
        spanStart,
        spanEnd,
        kind: "element-edge",
        priority: 1,
      },
      {
        value: s.y + s.height / 2,
        spanStart,
        spanEnd,
        kind: "element-center",
        priority: 1,
      },
      {
        value: s.y + s.height,
        spanStart,
        spanEnd,
        kind: "element-edge",
        priority: 1,
      },
    );
  }
  return out;
}

function findBestAxisDelta(
  anchors: readonly AxisAnchor[],
  targets: readonly AxisTarget[],
  threshold: number,
): number | null {
  let bestDelta: number | null = null;
  let bestAbs = threshold + 0.0001;
  let bestPriority = Number.POSITIVE_INFINITY;

  for (const anchor of anchors) {
    for (const target of targets) {
      const diff = target.value - anchor.value;
      const abs = Math.abs(diff);
      if (abs > threshold) continue;
      if (
        abs < bestAbs - 0.25 ||
        (Math.abs(abs - bestAbs) <= 0.25 && target.priority < bestPriority)
      ) {
        bestAbs = abs;
        bestDelta = diff;
        bestPriority = target.priority;
      }
    }
  }

  return bestDelta;
}

function collectAlignedLines(
  orientation: "vertical" | "horizontal",
  anchorValues: readonly number[],
  boxSpanStart: number,
  boxSpanEnd: number,
  targets: readonly AxisTarget[],
  tolerance: number,
): SmartGuideLine[] {
  const byPosition = new Map<number, SmartGuideLine>();

  for (const anchorVal of anchorValues) {
    for (const target of targets) {
      if (Math.abs(target.value - anchorVal) > tolerance) continue;
      const posKey = Math.round(target.value * 2) / 2;
      const start =
        target.kind === "page-center" || target.kind === "page-edge"
          ? target.spanStart
          : Math.min(boxSpanStart, target.spanStart);
      const end =
        target.kind === "page-center" || target.kind === "page-edge"
          ? target.spanEnd
          : Math.max(boxSpanEnd, target.spanEnd);

      const existing = byPosition.get(posKey);
      if (!existing) {
        byPosition.set(posKey, {
          orientation,
          position: target.value,
          start,
          end,
          kind: target.kind,
        });
      } else {
        existing.start = Math.min(existing.start, start);
        existing.end = Math.max(existing.end, end);
        if (target.kind === "page-center") {
          existing.kind = "page-center";
        }
      }
    }
  }

  return Array.from(byPosition.values());
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 4;
}

/**
 * Detecta espaçamento igual estilo Canva (elemento centralizado entre dois vizinhos
 * ou mantendo distância igual à distância entre dois vizinhos adjacentes).
 */
function detectSpacingGuides(
  box: CreationRectBox,
  siblings: readonly CreationGuideReference[],
  threshold: number,
  allowSnapX: boolean,
  allowSnapY: boolean,
): {
  dx: number | null;
  dy: number | null;
  spacingGuides: SmartSpacingGuide[];
} {
  const spacingGuides: SmartSpacingGuide[] = [];
  let snapDx: number | null = null;
  let snapDy: number | null = null;

  // --- Eixo Horizontal (elementos na mesma faixa vertical) ---
  const rowSiblings = siblings
    .filter((s) => rangesOverlap(box.y, box.y + box.height, s.y, s.y + s.height))
    .sort((a, b) => a.x - b.x);

  const leftOfBox = rowSiblings.filter((s) => s.x + s.width <= box.x + threshold);
  const rightOfBox = rowSiblings.filter((s) => s.x >= box.x + box.width - threshold);

  const nearestLeft = leftOfBox.length > 0 ? leftOfBox[leftOfBox.length - 1] : null;
  const nearestRight = rightOfBox.length > 0 ? rightOfBox[0] : null;

  // Caso 1: elemento centralizado entre vizinho da esquerda e da direita
  if (nearestLeft && nearestRight) {
    const leftGap = box.x - (nearestLeft.x + nearestLeft.width);
    const rightGap = nearestRight.x - (box.x + box.width);
    const totalSpace = nearestRight.x - (nearestLeft.x + nearestLeft.width) - box.width;
    if (totalSpace >= 4 && Math.abs(leftGap - rightGap) <= threshold * 2) {
      const idealGap = totalSpace / 2;
      const delta = nearestLeft.x + nearestLeft.width + idealGap - box.x;
      if (Math.abs(delta) <= threshold) {
        const appliedDx = allowSnapX ? delta : 0;
        if (allowSnapX) snapDx = delta;
        const effX = box.x + appliedDx;
        const g1 = Math.round(effX - (nearestLeft.x + nearestLeft.width));
        const g2 = Math.round(nearestRight.x - (effX + box.width));
        if (g1 >= 2 && g2 >= 2 && Math.abs(g1 - g2) <= 1) {
          const crossY = Math.round(box.y + box.height / 2);
          spacingGuides.push(
            {
              orientation: "horizontal",
              crossPos: crossY,
              start: nearestLeft.x + nearestLeft.width,
              end: effX,
              distance: g1,
            },
            {
              orientation: "horizontal",
              crossPos: crossY,
              start: effX + box.width,
              end: nearestRight.x,
              distance: g2,
            },
          );
        }
      }
    }
  }

  // Caso 2: mesmo espaçamento de uma dupla adjacente à esquerda (A -> B -> [box])
  if (spacingGuides.length === 0 && leftOfBox.length >= 2) {
    const b = leftOfBox[leftOfBox.length - 1];
    const a = leftOfBox[leftOfBox.length - 2];
    const refGap = b.x - (a.x + a.width);
    if (refGap >= 4) {
      const curGap = box.x - (b.x + b.width);
      const delta = refGap - curGap;
      if (Math.abs(delta) <= threshold) {
        const appliedDx = allowSnapX ? delta : 0;
        if (allowSnapX) snapDx = delta;
        const effX = box.x + appliedDx;
        const crossY = Math.round(box.y + box.height / 2);
        spacingGuides.push(
          {
            orientation: "horizontal",
            crossPos: crossY,
            start: a.x + a.width,
            end: b.x,
            distance: Math.round(refGap),
          },
          {
            orientation: "horizontal",
            crossPos: crossY,
            start: b.x + b.width,
            end: effX,
            distance: Math.round(effX - (b.x + b.width)),
          },
        );
      }
    }
  }

  // Caso 3: mesmo espaçamento de uma dupla adjacente à direita ([box] -> A -> B)
  if (spacingGuides.length === 0 && rightOfBox.length >= 2) {
    const a = rightOfBox[0];
    const b = rightOfBox[1];
    const refGap = b.x - (a.x + a.width);
    if (refGap >= 4) {
      const curGap = a.x - (box.x + box.width);
      const delta = curGap - refGap;
      if (Math.abs(delta) <= threshold) {
        const appliedDx = allowSnapX ? delta : 0;
        if (allowSnapX) snapDx = delta;
        const effX = box.x + appliedDx;
        const crossY = Math.round(box.y + box.height / 2);
        spacingGuides.push(
          {
            orientation: "horizontal",
            crossPos: crossY,
            start: effX + box.width,
            end: a.x,
            distance: Math.round(a.x - (effX + box.width)),
          },
          {
            orientation: "horizontal",
            crossPos: crossY,
            start: a.x + a.width,
            end: b.x,
            distance: Math.round(refGap),
          },
        );
      }
    }
  }

  // --- Eixo Vertical (elementos na mesma coluna horizontal) ---
  const colSiblings = siblings
    .filter((s) => rangesOverlap(box.x, box.x + box.width, s.x, s.x + s.width))
    .sort((a, b) => a.y - b.y);

  const aboveBox = colSiblings.filter((s) => s.y + s.height <= box.y + threshold);
  const belowBox = colSiblings.filter((s) => s.y >= box.y + box.height - threshold);

  const nearestAbove = aboveBox.length > 0 ? aboveBox[aboveBox.length - 1] : null;
  const nearestBelow = belowBox.length > 0 ? belowBox[0] : null;

  let addedVertical = false;

  if (nearestAbove && nearestBelow) {
    const topGap = box.y - (nearestAbove.y + nearestAbove.height);
    const bottomGap = nearestBelow.y - (box.y + box.height);
    const totalSpace =
      nearestBelow.y - (nearestAbove.y + nearestAbove.height) - box.height;
    if (totalSpace >= 4 && Math.abs(topGap - bottomGap) <= threshold * 2) {
      const idealGap = totalSpace / 2;
      const delta = nearestAbove.y + nearestAbove.height + idealGap - box.y;
      if (Math.abs(delta) <= threshold) {
        const appliedDy = allowSnapY ? delta : 0;
        if (allowSnapY) snapDy = delta;
        const effY = box.y + appliedDy;
        const g1 = Math.round(effY - (nearestAbove.y + nearestAbove.height));
        const g2 = Math.round(nearestBelow.y - (effY + box.height));
        if (g1 >= 2 && g2 >= 2 && Math.abs(g1 - g2) <= 1) {
          const crossX = Math.round(box.x + box.width / 2);
          spacingGuides.push(
            {
              orientation: "vertical",
              crossPos: crossX,
              start: nearestAbove.y + nearestAbove.height,
              end: effY,
              distance: g1,
            },
            {
              orientation: "vertical",
              crossPos: crossX,
              start: effY + box.height,
              end: nearestBelow.y,
              distance: g2,
            },
          );
          addedVertical = true;
        }
      }
    }
  }

  if (!addedVertical && aboveBox.length >= 2) {
    const b = aboveBox[aboveBox.length - 1];
    const a = aboveBox[aboveBox.length - 2];
    const refGap = b.y - (a.y + a.height);
    if (refGap >= 4) {
      const curGap = box.y - (b.y + b.height);
      const delta = refGap - curGap;
      if (Math.abs(delta) <= threshold) {
        const appliedDy = allowSnapY ? delta : 0;
        if (allowSnapY) snapDy = delta;
        const effY = box.y + appliedDy;
        const crossX = Math.round(box.x + box.width / 2);
        spacingGuides.push(
          {
            orientation: "vertical",
            crossPos: crossX,
            start: a.y + a.height,
            end: b.y,
            distance: Math.round(refGap),
          },
          {
            orientation: "vertical",
            crossPos: crossX,
            start: b.y + b.height,
            end: effY,
            distance: Math.round(effY - (b.y + b.height)),
          },
        );
        addedVertical = true;
      }
    }
  }

  if (!addedVertical && belowBox.length >= 2) {
    const a = belowBox[0];
    const b = belowBox[1];
    const refGap = b.y - (a.y + a.height);
    if (refGap >= 4) {
      const curGap = a.y - (box.y + box.height);
      const delta = curGap - refGap;
      if (Math.abs(delta) <= threshold) {
        const appliedDy = allowSnapY ? delta : 0;
        if (allowSnapY) snapDy = delta;
        const effY = box.y + appliedDy;
        const crossX = Math.round(box.x + box.width / 2);
        spacingGuides.push(
          {
            orientation: "vertical",
            crossPos: crossX,
            start: effY + box.height,
            end: a.y,
            distance: Math.round(a.y - (effY + box.height)),
          },
          {
            orientation: "vertical",
            crossPos: crossX,
            start: a.y + a.height,
            end: b.y,
            distance: Math.round(refGap),
          },
        );
      }
    }
  }

  return { dx: snapDx, dy: snapDy, spacingGuides };
}

/**
 * Calcula guias automáticas de alinhamento e espaçamento durante o arraste.
 * Sempre avaliado a partir da posição livre do ponteiro — auxilia suavemente sem prender.
 */
export function computeDragSmartGuides(
  rawBox: CreationRectBox,
  siblings: readonly CreationGuideReference[],
  options: SmartGuidesOptions = {},
): SmartGuideResult {
  const enabled = options.enabled !== false;
  if (!enabled) {
    return { box: rawBox, guides: [], spacingGuides: [] };
  }

  const assistSnap = options.assistSnap !== false;
  const threshold = Math.max(
    1,
    options.threshold ?? DEFAULT_SMART_GUIDE_THRESHOLD_PX,
  );
  const pageWidth = options.pageWidth ?? A4_WIDTH_PX;
  const pageHeight = options.pageHeight ?? A4_HEIGHT_PX;
  const pageMargin = options.pageMargin ?? DEFAULT_A4_GUIDE_MARGIN_PX;

  const verticalTargets = [
    ...buildPageVerticalTargets(pageWidth, pageHeight, pageMargin),
    ...buildSiblingVerticalTargets(siblings),
  ];
  const horizontalTargets = [
    ...buildPageHorizontalTargets(pageWidth, pageHeight, pageMargin),
    ...buildSiblingHorizontalTargets(siblings),
  ];

  const vAnchors: AxisAnchor[] = [
    {
      value: rawBox.x,
      applyOffset: (d, b) => ({ ...b, x: b.x + d }),
      isCenter: false,
    },
    {
      value: rawBox.x + rawBox.width / 2,
      applyOffset: (d, b) => ({ ...b, x: b.x + d }),
      isCenter: true,
    },
    {
      value: rawBox.x + rawBox.width,
      applyOffset: (d, b) => ({ ...b, x: b.x + d }),
      isCenter: false,
    },
  ];

  const hAnchors: AxisAnchor[] = [
    {
      value: rawBox.y,
      applyOffset: (d, b) => ({ ...b, y: b.y + d }),
      isCenter: false,
    },
    {
      value: rawBox.y + rawBox.height / 2,
      applyOffset: (d, b) => ({ ...b, y: b.y + d }),
      isCenter: true,
    },
    {
      value: rawBox.y + rawBox.height,
      applyOffset: (d, b) => ({ ...b, y: b.y + d }),
      isCenter: false,
    },
  ];

  const deltaX = findBestAxisDelta(vAnchors, verticalTargets, threshold);
  const deltaY = findBestAxisDelta(hAnchors, horizontalTargets, threshold);

  let nextBox: CreationRectBox = {
    x: assistSnap && deltaX !== null ? Math.round(rawBox.x + deltaX) : rawBox.x,
    y: assistSnap && deltaY !== null ? Math.round(rawBox.y + deltaY) : rawBox.y,
    width: rawBox.width,
    height: rawBox.height,
  };

  // Detecta espaçamento igual nos eixos onde não houve alinhamento de borda/centro prioritário
  const spacing = detectSpacingGuides(
    nextBox,
    siblings,
    threshold,
    assistSnap && deltaX === null,
    assistSnap && deltaY === null,
  );

  if (spacing.dx !== null) {
    nextBox = { ...nextBox, x: Math.round(nextBox.x + spacing.dx) };
  }
  if (spacing.dy !== null) {
    nextBox = { ...nextBox, y: Math.round(nextBox.y + spacing.dy) };
  }

  // Coleta linhas ativas após o ajuste suave (ou quando o usuário passa em cima sem snap)
  const displayTol = assistSnap ? 0.75 : 1.5;
  const vGuides = collectAlignedLines(
    "vertical",
    [nextBox.x, nextBox.x + nextBox.width / 2, nextBox.x + nextBox.width],
    nextBox.y,
    nextBox.y + nextBox.height,
    verticalTargets,
    displayTol,
  );
  const hGuides = collectAlignedLines(
    "horizontal",
    [nextBox.y, nextBox.y + nextBox.height / 2, nextBox.y + nextBox.height],
    nextBox.x,
    nextBox.x + nextBox.width,
    horizontalTargets,
    displayTol,
  );

  return {
    box: nextBox,
    guides: [...vGuides, ...hGuides],
    spacingGuides: spacing.spacingGuides,
  };
}

/**
 * Calcula guias automáticas de alinhamento durante o redimensionamento.
 * Ajusta suavemente apenas a(s) borda(s) sendo arrastadas; quando `lockAspectRatio`
 * estiver ativo, preserva a proporção exata e exibe apenas as linhas visuais de apoio.
 */
export function computeResizeSmartGuides(
  rawBox: CreationRectBox,
  handle: CreationResizeHandle,
  siblings: readonly CreationGuideReference[],
  options: SmartGuidesOptions & {
    lockAspectRatio?: boolean;
    minWidth?: number;
    minHeight?: number;
  } = {},
): SmartGuideResult {
  const enabled = options.enabled !== false;
  if (!enabled) {
    return { box: rawBox, guides: [], spacingGuides: [] };
  }

  const assistSnap = options.assistSnap !== false && !options.lockAspectRatio;
  const threshold = Math.max(
    1,
    options.threshold ?? DEFAULT_SMART_GUIDE_THRESHOLD_PX,
  );
  const minW = options.minWidth ?? MIN_CREATION_ELEMENT_WIDTH;
  const minH = options.minHeight ?? MIN_CREATION_ELEMENT_HEIGHT;
  const pageWidth = options.pageWidth ?? A4_WIDTH_PX;
  const pageHeight = options.pageHeight ?? A4_HEIGHT_PX;
  const pageMargin = options.pageMargin ?? DEFAULT_A4_GUIDE_MARGIN_PX;

  const affectsWest = handle === "w" || handle === "nw" || handle === "sw";
  const affectsEast = handle === "e" || handle === "ne" || handle === "se";
  const affectsNorth = handle === "n" || handle === "nw" || handle === "ne";
  const affectsSouth = handle === "s" || handle === "sw" || handle === "se";

  const verticalTargets = [
    ...buildPageVerticalTargets(pageWidth, pageHeight, pageMargin),
    ...buildSiblingVerticalTargets(siblings),
  ];
  const horizontalTargets = [
    ...buildPageHorizontalTargets(pageWidth, pageHeight, pageMargin),
    ...buildSiblingHorizontalTargets(siblings),
  ];

  let nextBox: CreationRectBox = { ...rawBox };

  if (assistSnap) {
    if (affectsWest) {
      const d = findBestAxisDelta(
        [{ value: nextBox.x, applyOffset: (v, b) => ({ ...b, x: b.x + v }), isCenter: false }],
        verticalTargets,
        threshold,
      );
      if (d !== null) {
        const rightEdge = nextBox.x + nextBox.width;
        const snappedX = Math.round(nextBox.x + d);
        const snappedW = rightEdge - snappedX;
        if (snappedW >= minW) {
          nextBox = { ...nextBox, x: snappedX, width: snappedW };
        }
      }
    } else if (affectsEast) {
      const d = findBestAxisDelta(
        [
          {
            value: nextBox.x + nextBox.width,
            applyOffset: (v, b) => ({ ...b, width: b.width + v }),
            isCenter: false,
          },
        ],
        verticalTargets,
        threshold,
      );
      if (d !== null) {
        const snappedW = Math.round(nextBox.width + d);
        if (snappedW >= minW) {
          nextBox = { ...nextBox, width: snappedW };
        }
      }
    }

    if (affectsNorth) {
      const d = findBestAxisDelta(
        [{ value: nextBox.y, applyOffset: (v, b) => ({ ...b, y: b.y + v }), isCenter: false }],
        horizontalTargets,
        threshold,
      );
      if (d !== null) {
        const bottomEdge = nextBox.y + nextBox.height;
        const snappedY = Math.round(nextBox.y + d);
        const snappedH = bottomEdge - snappedY;
        if (snappedH >= minH) {
          nextBox = { ...nextBox, y: snappedY, height: snappedH };
        }
      }
    } else if (affectsSouth) {
      const d = findBestAxisDelta(
        [
          {
            value: nextBox.y + nextBox.height,
            applyOffset: (v, b) => ({ ...b, height: b.height + v }),
            isCenter: false,
          },
        ],
        horizontalTargets,
        threshold,
      );
      if (d !== null) {
        const snappedH = Math.round(nextBox.height + d);
        if (snappedH >= minH) {
          nextBox = { ...nextBox, height: snappedH };
        }
      }
    }
  }

  const displayTol = assistSnap ? 0.75 : 2;
  const activeVerticalAnchors: number[] = [];
  if (affectsWest) activeVerticalAnchors.push(nextBox.x);
  if (affectsEast) activeVerticalAnchors.push(nextBox.x + nextBox.width);

  const activeHorizontalAnchors: number[] = [];
  if (affectsNorth) activeHorizontalAnchors.push(nextBox.y);
  if (affectsSouth) activeHorizontalAnchors.push(nextBox.y + nextBox.height);

  const vGuides = collectAlignedLines(
    "vertical",
    activeVerticalAnchors,
    nextBox.y,
    nextBox.y + nextBox.height,
    verticalTargets,
    displayTol,
  );
  const hGuides = collectAlignedLines(
    "horizontal",
    activeHorizontalAnchors,
    nextBox.x,
    nextBox.x + nextBox.width,
    horizontalTargets,
    displayTol,
  );

  return {
    box: nextBox,
    guides: [...vGuides, ...hGuides],
    spacingGuides: [],
  };
}
