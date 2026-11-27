import React from "react";
import { Image as ImageIcon, User } from "lucide-react";
import type { CreationElement } from "../../types/masterCreations";
import { resolveCreationFontCss } from "../../utils/masterCreations";
import {
  CreatureRichInlineText,
  CreatureRichText,
} from "../CreatureRichText";

export interface CreationElementRendererProps {
  element: CreationElement;
  readOnly?: boolean;
  /** Permite edição inline rápida em blocos de texto ao dar duplo clique */
  isInlineEditing?: boolean;
  onInlineTextChange?: (nextText: string) => void;
  onInlineEditEnd?: () => void;
}

export const CreationElementRenderer: React.FC<CreationElementRendererProps> =
  React.memo(function CreationElementRenderer({
    element,
    readOnly = false,
    isInlineEditing = false,
    onInlineTextChange,
    onInlineEditEnd,
  }) {
    const fontFamilyCss = resolveCreationFontCss(element.fontFamily);
    const baseTextStyle: React.CSSProperties = {
      color: element.textColor,
      fontSize: `${element.fontSize}px`,
      fontFamily: fontFamilyCss,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      textDecoration: element.textDecoration,
      textAlign: element.textAlign,
      lineHeight: element.lineHeight,
      letterSpacing: `${element.letterSpacing}px`,
    };

    const boxStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      opacity: element.opacity,
      backgroundColor: element.backgroundColor,
      border:
        element.borderWidth > 0
          ? `${element.borderWidth}px solid ${element.borderColor}`
          : "none",
      borderRadius: `${element.borderRadius}px`,
      boxSizing: "border-box",
      overflow: "hidden",
    };

    if (element.type === "rect") {
      return <div style={boxStyle} data-creation-render="rect" />;
    }

    if (element.type === "line") {
      const isVertical = element.lineOrientation === "vertical";
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: element.opacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
          data-creation-render="line"
        >
          <div
            style={
              isVertical
                ? {
                    height: "100%",
                    width: 0,
                    borderLeft: `${element.strokeWidth}px ${element.lineStyle} ${element.strokeColor}`,
                  }
                : {
                    width: "100%",
                    height: 0,
                    borderTop: `${element.strokeWidth}px ${element.lineStyle} ${element.strokeColor}`,
                  }
            }
          />
        </div>
      );
    }

    if (element.type === "divider") {
      const hasLabel = element.title.trim().length > 0;
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: element.opacity,
            display: "flex",
            alignItems: "center",
            gap: hasLabel ? "10px" : "0px",
            boxSizing: "border-box",
          }}
          data-creation-render="divider"
        >
          <span
            style={{
              flex: 1,
              height: 0,
              borderTop: `${element.strokeWidth}px ${element.lineStyle} ${element.strokeColor}`,
            }}
          />
          {hasLabel && (
            <span
              style={{
                ...baseTextStyle,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <CreatureRichInlineText
                text={element.title}
                tone="inherit"
                interactiveAffiliations={false}
              />
            </span>
          )}
          <span
            style={{
              flex: 1,
              height: 0,
              borderTop: `${element.strokeWidth}px ${element.lineStyle} ${element.strokeColor}`,
            }}
          />
        </div>
      );
    }

    if (element.type === "image") {
      return (
        <div
          style={{
            ...boxStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          data-creation-render="image"
        >
          {element.imageUrl ? (
            <img
              src={element.imageUrl}
              alt={element.name || "Imagem"}
              draggable={false}
              crossOrigin="anonymous"
              style={{
                width: "100%",
                height: "100%",
                objectFit: element.objectFit,
                display: "block",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 text-[#757788] text-[11px] font-mono text-center px-3 select-none">
              <ImageIcon size={24} className="text-[#8f171c]/80" />
              <span className="uppercase tracking-wider">
                {readOnly ? "Sem imagem" : "Importe ou arraste um PNG"}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (element.type === "text") {
      return (
        <div
          style={{
            ...boxStyle,
            padding: `${element.padding}px`,
            ...baseTextStyle,
          }}
          data-creation-render="text"
        >
          {!readOnly && isInlineEditing ? (
            <textarea
              autoFocus
              value={element.textContent}
              onChange={(e) => onInlineTextChange?.(e.target.value)}
              onBlur={() => onInlineEditEnd?.()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onInlineEditEnd?.();
                }
              }}
              aria-label="Editar texto do bloco"
              className="w-full h-full bg-transparent border-0 outline-none resize-none"
              style={{
                ...baseTextStyle,
                padding: 0,
                margin: 0,
              }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", wordBreak: "break-word" }}>
              <CreatureRichText
                text={element.textContent}
                emptyText={readOnly ? "" : "Duplo clique para editar texto..."}
                tone="inherit"
                interactiveAffiliations={false}
                className="!text-[length:inherit] !leading-[inherit]"
              />
            </div>
          )}
        </div>
      );
    }

    if (element.type === "profile") {
      return (
        <div
          style={{
            ...boxStyle,
            padding: `${element.padding}px`,
            borderLeft: `3px solid ${element.accentColor}`,
            display: "flex",
            gap: "14px",
            alignItems: "stretch",
            fontFamily: fontFamilyCss,
            color: element.textColor,
          }}
          data-creation-render="profile"
        >
          <div
            style={{
              width: "92px",
              minWidth: "92px",
              alignSelf: "stretch",
              maxHeight: "140px",
              backgroundColor: "rgba(0,0,0,0.32)",
              border: `1px solid ${element.borderColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {element.imageUrl ? (
              <img
                src={element.imageUrl}
                alt={element.title || "Retrato"}
                draggable={false}
                crossOrigin="anonymous"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <User size={28} style={{ color: element.accentColor, opacity: 0.7 }} />
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "4px",
              textAlign: element.textAlign,
            }}
          >
            <div
              style={{
                fontSize: `${Math.round(element.fontSize * 1.45)}px`,
                fontWeight: "bold",
                letterSpacing: `${Math.max(0.5, element.letterSpacing)}px`,
                lineHeight: 1.15,
                color: element.textColor,
                textDecoration: element.textDecoration,
                fontStyle: element.fontStyle,
                wordBreak: "break-word",
              }}
            >
              <CreatureRichInlineText
                text={element.title || "SUJEITO SEM NOME"}
                tone="inherit"
                interactiveAffiliations={false}
              />
            </div>

            {element.subtitle.trim() !== "" && (
              <div
                style={{
                  fontSize: `${Math.max(10, Math.round(element.fontSize * 0.82))}px`,
                  color: element.accentColor,
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  lineHeight: 1.25,
                }}
              >
                <CreatureRichInlineText
                  text={element.subtitle}
                  tone="inherit"
                  interactiveAffiliations={false}
                />
              </div>
            )}

            <div
              style={{
                height: "1px",
                backgroundColor: element.borderColor,
                margin: "4px 0",
                opacity: 0.8,
              }}
            />

            <div
              style={{
                ...baseTextStyle,
                fontWeight: element.fontWeight,
              }}
            >
              <CreatureRichText
                text={element.textContent}
                emptyText=""
                tone="inherit"
                interactiveAffiliations={false}
                className="!text-[length:inherit] !leading-[inherit]"
              />
            </div>
          </div>
        </div>
      );
    }

    if (element.type === "description") {
      return (
        <div
          style={{
            ...boxStyle,
            padding: `${element.padding}px`,
            borderTop: `2px solid ${element.accentColor}`,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            fontFamily: fontFamilyCss,
            color: element.textColor,
          }}
          data-creation-render="description"
        >
          {element.title.trim() !== "" && (
            <div
              style={{
                fontSize: `${Math.max(11, Math.round(element.fontSize * 0.92))}px`,
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "1.4px",
                color: element.accentColor,
                borderBottom: `1px solid ${element.borderColor}`,
                paddingBottom: "6px",
                textAlign: element.textAlign,
              }}
            >
              <CreatureRichInlineText
                text={element.title}
                tone="inherit"
                interactiveAffiliations={false}
              />
            </div>
          )}

          <div
            style={{
              ...baseTextStyle,
              flex: 1,
              wordBreak: "break-word",
            }}
          >
            <CreatureRichText
              text={element.textContent}
              emptyText={readOnly ? "" : "Sem texto registrado."}
              tone="inherit"
              interactiveAffiliations={false}
              className="!text-[length:inherit] !leading-[inherit]"
            />
          </div>
        </div>
      );
    }

    // element.type === "info"
    return (
      <div
        style={{
          ...boxStyle,
          padding: `${element.padding}px`,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontFamily: fontFamilyCss,
          color: element.textColor,
        }}
        data-creation-render="info"
      >
        {element.title.trim() !== "" && (
          <div
            style={{
              fontSize: `${Math.max(10, Math.round(element.fontSize * 0.92))}px`,
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1.4px",
              color: element.accentColor,
              borderBottom: `1px solid ${element.borderColor}`,
              paddingBottom: "6px",
              textAlign: element.textAlign,
            }}
          >
            <CreatureRichInlineText
              text={element.title}
              tone="inherit"
              interactiveAffiliations={false}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {element.fields.length === 0 ? (
            <div
              style={{
                fontSize: "11px",
                opacity: 0.6,
                fontStyle: "italic",
              }}
            >
              {readOnly ? "" : "Adicione campos no painel direito."}
            </div>
          ) : (
            element.fields.map((field) => (
              <div
                key={field.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "10px",
                  borderBottom: `1px solid ${element.borderColor}`,
                  paddingBottom: "4px",
                  fontSize: `${element.fontSize}px`,
                  lineHeight: element.lineHeight,
                  letterSpacing: `${element.letterSpacing}px`,
                }}
              >
                <span
                  style={{
                    fontSize: `${Math.max(10, Math.round(element.fontSize * 0.85))}px`,
                    textTransform: "uppercase",
                    letterSpacing: "0.9px",
                    opacity: 0.72,
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  {field.label || "CAMPO"}
                </span>
                <span
                  style={{
                    color: element.textColor,
                    fontWeight: element.fontWeight,
                    fontStyle: element.fontStyle,
                    textDecoration: element.textDecoration,
                    textAlign: "right",
                    wordBreak: "break-word",
                  }}
                >
                  <CreatureRichInlineText
                    text={field.value || "—"}
                    tone="inherit"
                    interactiveAffiliations={false}
                  />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  });
