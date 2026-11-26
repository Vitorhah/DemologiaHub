import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMOLOGIA_ORIGINAL_COLORS,
  TABLETOP_THEME_PRESETS,
  applyPresetToConfig,
  areTabletopCustomizationsEqual,
  buildThemeCssVariables,
  createDefaultTabletopCustomization,
  detectMatchingPresetId,
  getTabletopThemeRecordId,
  isDefaultTabletopCustomization,
  normalizeHexColor,
  normalizeTabletopCustomization,
  resolveEffectiveBranding,
  sanitizeCustomImageUrl,
  sanitizeSvgContent,
  validateCustomBrandImageFile,
} from "./tabletopCustomization";
import { isSystemRecordId } from "./handoutsLogic";
import { DEMOLOGIA_LOGO_URL } from "../constants/branding";

test("TABLETOP_THEME_ record IDs are treated as system records and excluded from players list", () => {
  const id = getTabletopThemeRecordId("mesa-alfa");
  assert.equal(id, "TABLETOP_THEME_mesa-alfa");
  assert.equal(isSystemRecordId(id), true);
  assert.equal(isSystemRecordId(getTabletopThemeRecordId("default-table")), true);
});

test("default customization is recognized as untouched Demologia Original", () => {
  const def = createDefaultTabletopCustomization("mesa-1");
  assert.equal(def.presetId, "demologia");
  assert.equal(isDefaultTabletopCustomization(def), true);

  const effective = resolveEffectiveBranding(def);
  assert.equal(effective.primaryLogo, DEMOLOGIA_LOGO_URL);
  assert.equal(effective.secondaryLogo, DEMOLOGIA_LOGO_URL);
  assert.equal(effective.headerTitle, "Demologya");
  assert.equal(effective.seasonSubtitle, "");
  assert.equal(effective.campaignIcon, "");
});

test("presets (Demologia Original, Nirvana, Profano) apply cleanly and remain editable into custom", () => {
  assert.equal(TABLETOP_THEME_PRESETS.length, 3);
  const base = createDefaultTabletopCustomization("mesa-1");

  const nirvana = applyPresetToConfig(base, "nirvana");
  assert.equal(nirvana.presetId, "nirvana");
  assert.equal(isDefaultTabletopCustomization(nirvana), false);
  assert.equal(
    detectMatchingPresetId(nirvana.colors, nirvana.interfaceStyle),
    "nirvana",
  );

  const profano = applyPresetToConfig(base, "profano");
  assert.equal(profano.presetId, "profano");
  assert.equal(profano.colors.background, "#040405");
  assert.equal(
    detectMatchingPresetId(profano.colors, profano.interfaceStyle),
    "profano",
  );

  const tweaked = {
    ...nirvana,
    colors: { ...nirvana.colors, accent: "#123456" },
  };
  assert.equal(
    detectMatchingPresetId(tweaked.colors, tweaked.interfaceStyle),
    "custom",
  );
});

test("normalizeHexColor accepts #RGB and #RRGGBB and falls back safely on invalid values", () => {
  assert.equal(normalizeHexColor("#ABC", "#000000"), "#aabbcc");
  assert.equal(normalizeHexColor("8F171C", "#000000"), "#8f171c");
  assert.equal(normalizeHexColor("not-a-hex", "#151518"), "#151518");
  assert.equal(normalizeHexColor(null, "#151518"), "#151518");
});

test("sanitizeCustomImageUrl allows safe HTTPS and image data URLs while blocking XSS schemes", () => {
  assert.equal(
    sanitizeCustomImageUrl("https://cdn.example.com/logo.webp"),
    "https://cdn.example.com/logo.webp",
  );
  assert.equal(
    sanitizeCustomImageUrl("data:image/png;base64,iVBORw0KGgo="),
    "data:image/png;base64,iVBORw0KGgo=",
  );
  assert.equal(sanitizeCustomImageUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeCustomImageUrl("data:text/html;base64,PHNjcmlwdD4="), "");
  assert.equal(sanitizeCustomImageUrl("vbscript:msgbox(1)"), "");
});

test("sanitizeSvgContent strips scripts, event handlers, foreignObject, and javascript hrefs", () => {
  const dirty =
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject><a href="javascript:evil()"><circle cx="10" cy="10" r="8" fill="#c59b3c" onclick="bad()"/></a></svg>';
  const clean = sanitizeSvgContent(dirty);
  assert.equal(clean.includes("<script"), false);
  assert.equal(clean.includes("onload="), false);
  assert.equal(clean.includes("onclick="), false);
  assert.equal(clean.includes("foreignObject"), false);
  assert.equal(clean.includes("javascript:"), false);
  assert.equal(clean.includes("<circle"), true);
});

test("validateCustomBrandImageFile validates PNG/JPG/JPEG/WebP/SVG and enforces 5MB limit", () => {
  assert.equal(
    validateCustomBrandImageFile({ name: "logo.png", type: "image/png", size: 1024 }).ok,
    true,
  );
  assert.equal(
    validateCustomBrandImageFile({ name: "crest.svg", type: "image/svg+xml", size: 512 }).ok,
    true,
  );
  assert.equal(
    validateCustomBrandImageFile({ name: "banner.webp", type: "image/webp", size: 2048 }).ok,
    true,
  );
  assert.equal(
    validateCustomBrandImageFile({ name: "script.js", type: "text/javascript", size: 200 }).ok,
    false,
  );
  assert.equal(
    validateCustomBrandImageFile({
      name: "huge.png",
      type: "image/png",
      size: 6 * 1024 * 1024,
    }).ok,
    false,
  );
});

test("normalizeTabletopCustomization clamps panelOpacity and sanitizes invalid payload fields", () => {
  const normalized = normalizeTabletopCustomization(
    {
      presetId: "nirvana",
      branding: {
        headerTitle: "  Ordem do Eclipse \u0000 ",
        seasonSubtitle: "Temporada II",
        primaryLogoUrl: "javascript:alert(1)",
        campaignIconUrl: "https://example.com/icon.png",
      },
      colors: {
        primary: "#c59b3c",
        background: "INVALID",
      },
      interfaceStyle: {
        cornerRadius: "rounded",
        shadowIntensity: "strong",
        panelOpacity: 15, // below minimum 60 -> clamped to 60
        density: "compact",
        animationIntensity: "reduced",
      },
      updatedAt: 1700000000,
    },
    "mesa-teste",
  );

  assert.equal(normalized.branding.headerTitle, "Ordem do Eclipse");
  assert.equal(normalized.branding.primaryLogoUrl, "");
  assert.equal(normalized.branding.campaignIconUrl, "https://example.com/icon.png");
  assert.equal(normalized.colors.primary, "#c59b3c");
  assert.equal(normalized.colors.background, DEMOLOGIA_ORIGINAL_COLORS.background);
  assert.equal(normalized.interfaceStyle.panelOpacity, 60);
  assert.equal(normalized.interfaceStyle.cornerRadius, "rounded");
  assert.equal(normalized.interfaceStyle.animationIntensity, "reduced");
});

test("buildThemeCssVariables generates expected tokens for panel opacity, radius, shadow, and motion", () => {
  const nirvana = applyPresetToConfig(createDefaultTabletopCustomization("r1"), "nirvana");
  nirvana.interfaceStyle.panelOpacity = 80;
  nirvana.interfaceStyle.cornerRadius = "medium";
  nirvana.interfaceStyle.animationIntensity = "reduced";

  const vars = buildThemeCssVariables(nirvana);
  assert.equal(vars["--op-red"], "#c59b3c");
  assert.equal(vars["--op-bg"], "#0c0b09");
  assert.equal(vars["--ct-radius"], "8px");
  assert.equal(vars["--ct-panel-rgba"], "rgba(23, 20, 16, 0.8)");
  assert.equal(vars["--transition-fast"], "0ms linear");
  assert.equal(vars["--ct-interactive-text"], "#ffffff");
  assert.equal(areTabletopCustomizationsEqual(nirvana, createDefaultTabletopCustomization("r1")), false);

  const bright = { ...nirvana, colors: { ...nirvana.colors, interactive: "#f5e16c" } };
  assert.equal(buildThemeCssVariables(bright)["--ct-interactive-text"], "#09090b");
});

test("hideHpPePanelBackground and custom background normalize cleanly and mark config as customized", () => {
  const base = createDefaultTabletopCustomization("mesa-bg");
  assert.equal(base.interfaceStyle.hideHpPePanelBackground, false);
  assert.equal(base.background.url, "");
  assert.equal(base.background.mediaType, "default");
  assert.equal(isDefaultTabletopCustomization(base), true);

  const hiddenHud = normalizeTabletopCustomization(
    {
      ...base,
      interfaceStyle: { ...base.interfaceStyle, hideHpPePanelBackground: true },
    },
    "mesa-bg",
  );
  assert.equal(hiddenHud.interfaceStyle.hideHpPePanelBackground, true);
  assert.equal(isDefaultTabletopCustomization(hiddenHud), false);

  const withVideoBg = normalizeTabletopCustomization(
    {
      ...base,
      background: {
        url: "https://cdn.example.com/rain-loop.mp4",
        overlayOpacity: 120,
      },
    },
    "mesa-bg",
  );
  assert.equal(withVideoBg.background.mediaType, "video");
  assert.equal(withVideoBg.background.overlayOpacity, 90);
  assert.equal(isDefaultTabletopCustomization(withVideoBg), false);

  const withGifBg = normalizeTabletopCustomization(
    {
      ...base,
      background: {
        url: "https://cdn.example.com/fog.gif",
        overlayOpacity: -10,
      },
    },
    "mesa-bg",
  );
  assert.equal(withGifBg.background.mediaType, "gif");
  assert.equal(withGifBg.background.overlayOpacity, 0);
});
