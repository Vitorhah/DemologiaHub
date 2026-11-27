import React, { forwardRef, useImperativeHandle, useState } from "react";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "../../utils/masterCreations";
import type {
  SmartGuideLine,
  SmartSpacingGuide,
} from "../../utils/creationSmartGuides";

export interface CreationSmartGuidesOverlayHandle {
  setGuides: (
    guides: SmartGuideLine[],
    spacingGuides: SmartSpacingGuide[],
  ) => void;
  clear: () => void;
}

interface OverlayState {
  guides: SmartGuideLine[];
  spacingGuides: SmartSpacingGuide[];
}

const EMPTY_STATE: OverlayState = { guides: [], spacingGuides: [] };

/**
 * Overlay SVG isolado e orientado por ref para renderizar a régua automática
 * em 60fps durante arraste/redimensionamento sem re-renderizar o canvas pai.
 */
export const CreationSmartGuidesOverlay = forwardRef<
  CreationSmartGuidesOverlayHandle,
  { zoom: number }
>(function CreationSmartGuidesOverlay({ zoom }, ref) {
  const [state, setState] = useState<OverlayState>(EMPTY_STATE);

  useImperativeHandle(
    ref,
    () => ({
      setGuides(guides, spacingGuides) {
        setState((prev) => {
          if (
            prev.guides.length === 0 &&
            prev.spacingGuides.length === 0 &&
            guides.length === 0 &&
            spacingGuides.length === 0
          ) {
            return prev;
          }
          return { guides, spacingGuides };
        });
      },
      clear() {
        setState((prev) =>
          prev.guides.length === 0 && prev.spacingGuides.length === 0
            ? prev
            : EMPTY_STATE,
        );
      },
    }),
    [],
  );

  if (state.guides.length === 0 && state.spacingGuides.length === 0) {
    return null;
  }

  // Compensa o zoom para manter linhas sempre nítidas em ~1px real na tela
  const invScale = 1 / Math.max(0.3, zoom);
  const strokeW = Math.min(2.2, Math.max(0.85, invScale));
  const capHalf = 4 * invScale;
  const badgeFontSize = Math.round(10 * Math.min(1.5, Math.max(0.85, invScale)));
  const badgeH = Math.round(16 * Math.min(1.5, Math.max(0.85, invScale)));

  return (
    <svg
      data-testid="creation-smart-guides-overlay"
      aria-hidden="true"
      width={A4_WIDTH_PX}
      height={A4_HEIGHT_PX}
      viewBox={`0 0 ${A4_WIDTH_PX} ${A4_HEIGHT_PX}`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 990,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {/* Linhas de alinhamento (centro da página, margens e bordas/centros entre elementos) */}
      {state.guides.map((guide, idx) => {
        const isPageCenter = guide.kind === "page-center";
        const isPageEdge = guide.kind === "page-edge";
        const strokeColor = isPageCenter
          ? "#ef4444"
          : isPageEdge
            ? "#b91c1c"
            : "#f43f5e";
        const dash = isPageCenter
          ? undefined
          : isPageEdge
            ? `${3 * invScale} ${3 * invScale}`
            : `${4 * invScale} ${2.5 * invScale}`;

        if (guide.orientation === "vertical") {
          return (
            <g key={`v-${idx}-${guide.position}`}>
              <line
                x1={guide.position}
                y1={guide.start}
                x2={guide.position}
                y2={guide.end}
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeDasharray={dash}
                strokeOpacity={isPageCenter ? 0.92 : 0.85}
              />
              {!isPageCenter && !isPageEdge && (
                <>
                  <circle
                    cx={guide.position}
                    cy={guide.start}
                    r={2.2 * invScale}
                    fill={strokeColor}
                  />
                  <circle
                    cx={guide.position}
                    cy={guide.end}
                    r={2.2 * invScale}
                    fill={strokeColor}
                  />
                </>
              )}
            </g>
          );
        }

        return (
          <g key={`h-${idx}-${guide.position}`}>
            <line
              x1={guide.start}
              y1={guide.position}
              x2={guide.end}
              y2={guide.position}
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeDasharray={dash}
              strokeOpacity={isPageCenter ? 0.92 : 0.85}
            />
            {!isPageCenter && !isPageEdge && (
              <>
                <circle
                  cx={guide.start}
                  cy={guide.position}
                  r={2.2 * invScale}
                  fill={strokeColor}
                />
                <circle
                  cx={guide.end}
                  cy={guide.position}
                  r={2.2 * invScale}
                  fill={strokeColor}
                />
              </>
            )}
          </g>
        );
      })}

      {/* Réguas de espaçamento igual (distância sincronizada entre elementos) */}
      {state.spacingGuides.map((sg, idx) => {
        const label = `${sg.distance}`;
        const badgeW = Math.max(
          Math.round(22 * Math.min(1.5, Math.max(0.85, invScale))),
          Math.round((label.length * 7 + 10) * Math.min(1.5, Math.max(0.85, invScale))),
        );
        const mid = (sg.start + sg.end) / 2;

        if (sg.orientation === "horizontal") {
          return (
            <g key={`sh-${idx}`}>
              <line
                x1={sg.start}
                y1={sg.crossPos}
                x2={sg.end}
                y2={sg.crossPos}
                stroke="#ef4444"
                strokeWidth={strokeW}
              />
              <line
                x1={sg.start}
                y1={sg.crossPos - capHalf}
                x2={sg.start}
                y2={sg.crossPos + capHalf}
                stroke="#ef4444"
                strokeWidth={strokeW}
              />
              <line
                x1={sg.end}
                y1={sg.crossPos - capHalf}
                x2={sg.end}
                y2={sg.crossPos + capHalf}
                stroke="#ef4444"
                strokeWidth={strokeW}
              />
              <rect
                x={mid - badgeW / 2}
                y={sg.crossPos - badgeH / 2}
                width={badgeW}
                height={badgeH}
                fill="#991b1b"
                stroke="#f87171"
                strokeWidth={0.75 * invScale}
              />
              <text
                x={mid}
                y={sg.crossPos}
                fill="#ffffff"
                fontSize={badgeFontSize}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
            </g>
          );
        }

        return (
          <g key={`sv-${idx}`}>
            <line
              x1={sg.crossPos}
              y1={sg.start}
              x2={sg.crossPos}
              y2={sg.end}
              stroke="#ef4444"
              strokeWidth={strokeW}
            />
            <line
              x1={sg.crossPos - capHalf}
              y1={sg.start}
              x2={sg.crossPos + capHalf}
              y2={sg.start}
              stroke="#ef4444"
              strokeWidth={strokeW}
            />
            <line
              x1={sg.crossPos - capHalf}
              y1={sg.end}
              x2={sg.crossPos + capHalf}
              y2={sg.end}
              stroke="#ef4444"
              strokeWidth={strokeW}
            />
            <rect
              x={sg.crossPos - badgeW / 2}
              y={mid - badgeH / 2}
              width={badgeW}
              height={badgeH}
              fill="#991b1b"
              stroke="#f87171"
              strokeWidth={0.75 * invScale}
            />
            <text
              x={sg.crossPos}
              y={mid}
              fill="#ffffff"
              fontSize={badgeFontSize}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
