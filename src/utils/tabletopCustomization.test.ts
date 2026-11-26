import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMOLOGIA_ORIGINAL_COLORS,
  MAX_SAVED_CUSTOM_PRESETS,
  TABLETOP_THEME_PRESETS,
  applyCustomPresetToConfig,
  applyPresetToConfig,
  areTabletopCustomizationsEqual,
  buildThemeCssVariables,
  createCustomPresetFromConfig,
  createDefaultTabletopCustomization,
  deleteSavedCustomPreset,
  detectMatchingPresetId,
  getTabletopThemeRecordId,
  isDefaultTabletopCustomization,
  matchesCustomPreset,
  normalizeHexColor,
  normalizeSavedCustomPresets,
  normalizeTabletopCustomization,
  resolveCustomizationForAppearanceAction,
  resolveEffectiveBranding,
  sanitizeCustomImageUrl,
  sanitizeSvgContent,
  upsertSavedCustomPreset,
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
        panelOpacity: -15, // below minimum 0 -> clamped to 0
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
  assert.equal(normalized.interfaceStyle.panelOpacity, 0);
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

test("logoScale, sheetNameOutlineSize, and 100% transparent panels normalize, export CSS vars, and mark customized", () => {
  const base = createDefaultTabletopCustomization("mesa-visual");
  assert.equal(base.interfaceStyle.logoScale, 100);
  assert.equal(base.interfaceStyle.sheetNameOutlineSize, 2.5);
  assert.equal(base.interfaceStyle.panelOpacity, 100);
  assert.equal(isDefaultTabletopCustomization(base), true);

  const customized = normalizeTabletopCustomization(
    {
      ...base,
      interfaceStyle: {
        ...base.interfaceStyle,
        logoScale: 240, // clamped to 180
        sheetNameOutlineSize: 6.3, // rounded to 6.5
        panelOpacity: 0, // 100% transparent (panels vanish)
      },
    },
    "mesa-visual",
  );

  assert.equal(customized.interfaceStyle.logoScale, 180);
  assert.equal(customized.interfaceStyle.sheetNameOutlineSize, 6.5);
  assert.equal(customized.interfaceStyle.panelOpacity, 0);
  assert.equal(isDefaultTabletopCustomization(customized), false);

  const vars = buildThemeCssVariables(customized);
  assert.equal(vars["--ct-logo-scale"], "1.8");
  assert.equal(vars["--ct-name-outline"], "6.5px");
  assert.equal(vars["--ct-name-outline-shadow"], "3.9px");
  assert.equal(vars["--ct-panel-rgba"], "rgba(21, 21, 24, 0)");
  assert.equal(vars["--ct-panel-border-rgba"], "rgba(48, 48, 54, 0)");
  assert.equal(vars["--ct-shadow-panel"], "none");

  const zeroOutline = normalizeTabletopCustomization(
    {
      ...base,
      interfaceStyle: {
        ...base.interfaceStyle,
        logoScale: 20, // clamped to 50
        sheetNameOutlineSize: 0,
      },
    },
    "mesa-visual",
  );
  assert.equal(zeroOutline.interfaceStyle.logoScale, 50);
  assert.equal(zeroOutline.interfaceStyle.sheetNameOutlineSize, 0);
  assert.equal(isDefaultTabletopCustomization(zeroOutline), false);
});

test("custom saved presets create, upsert, overwrite, apply, match, delete, and cap properly", () => {
  const base = createDefaultTabletopCustomization("mesa-custom");
  const nirvana = applyPresetToConfig(base, "nirvana");
  const styled = normalizeTabletopCustomization(
    {
      ...nirvana,
      branding: {
        ...nirvana.branding,
        headerTitle: "Catedral",
        seasonSubtitle: "Ato II",
      },
      background: {
        url: "https://cdn.example.com/catedral.webp",
        mediaType: "image",
        overlayOpacity: 60,
      },
      interfaceStyle: {
        ...nirvana.interfaceStyle,
        panelOpacity: 0,
        logoScale: 135,
        sheetNameOutlineSize: 4,
        hideHpPePanelBackground: true,
      },
    },
    "mesa-custom",
  );

  // Rejects empty/whitespace name
  assert.equal(createCustomPresetFromConfig("   ", styled), null);

  const created = createCustomPresetFromConfig("Catedral Sombria", styled, "preset_cat", 1000);
  assert.ok(created);
  assert.equal(created.id, "preset_cat");
  assert.equal(created.name, "Catedral Sombria");
  assert.equal(created.branding.headerTitle, "Catedral");
  assert.equal(created.background.url, "https://cdn.example.com/catedral.webp");
  assert.equal(created.interfaceStyle.panelOpacity, 0);
  assert.equal(created.interfaceStyle.logoScale, 135);
  assert.equal(created.interfaceStyle.sheetNameOutlineSize, 4);
  assert.equal(created.interfaceStyle.hideHpPePanelBackground, true);

  let list = upsertSavedCustomPreset([], created);
  assert.equal(list.length, 1);

  // Overwrite preserves original createdAt
  const updated = createCustomPresetFromConfig(
    "Catedral Sombria",
    { ...styled, colors: { ...styled.colors, primary: "#aa2233" } },
    "preset_cat",
    2000,
  );
  assert.ok(updated);
  list = upsertSavedCustomPreset(list, updated);
  assert.equal(list.length, 1);
  assert.equal(list[0].createdAt, 1000);
  assert.equal(list[0].updatedAt, 2000);
  assert.equal(list[0].colors.primary, "#aa2233");

  // Apply custom preset onto default config restores full visual configuration
  const applied = applyCustomPresetToConfig(base, list[0]);
  assert.equal(applied.presetId, "custom");
  assert.equal(applied.colors.primary, "#aa2233");
  assert.equal(applied.branding.headerTitle, "Catedral");
  assert.equal(applied.interfaceStyle.panelOpacity, 0);
  assert.equal(matchesCustomPreset(applied, list[0]), true);
  assert.equal(matchesCustomPreset(base, list[0]), false);

  // Delete removes preset cleanly
  list = deleteSavedCustomPreset(list, "preset_cat");
  assert.equal(list.length, 0);

  // Cap at MAX_SAVED_CUSTOM_PRESETS
  const many = Array.from({ length: MAX_SAVED_CUSTOM_PRESETS + 5 }, (_, i) => ({
    id: `p_${i}`,
    name: `Preset ${i}`,
    updatedAt: 100 + i,
  }));
  const normalizedMany = normalizeSavedCustomPresets(many);
  assert.equal(normalizedMany.length, MAX_SAVED_CUSTOM_PRESETS);
});

test("resolveCustomizationForAppearanceAction resolves reset, built-in presets, and custom presets", () => {
  const base = createDefaultTabletopCustomization("mesa-scene");
  const customPreset = createCustomPresetFromConfig(
    "Ritual Rubro",
    {
      ...applyPresetToConfig(base, "profano"),
      branding: { ...base.branding, headerTitle: "Ritual" },
      interfaceStyle: { ...base.interfaceStyle, panelOpacity: 20, logoScale: 140 },
    },
    "preset_ritual",
    5000,
  )!;

  // Reset restores clean Demologia Original
  const resetRes = resolveCustomizationForAppearanceAction("reset", "demologia", [customPreset], "mesa-scene", 6000);
  assert.ok(resetRes);
  assert.equal(isDefaultTabletopCustomization(resetRes.config), true);
  assert.equal(resetRes.clearSceneBackground, true);

  // Built-in preset (Nirvana) applies clean Nirvana colors/interface
  const nirvanaRes = resolveCustomizationForAppearanceAction("preset", "nirvana", [customPreset], "mesa-scene", 6100);
  assert.ok(nirvanaRes);
  assert.equal(nirvanaRes.config.presetId, "nirvana");
  assert.equal(nirvanaRes.config.colors.primary, "#c59b3c");
  assert.equal(nirvanaRes.clearSceneBackground, true);

  // Custom saved preset applies full saved config
  const customRes = resolveCustomizationForAppearanceAction("preset", "preset_ritual", [customPreset], "mesa-scene", 6200);
  assert.ok(customRes);
  assert.equal(customRes.config.presetId, "custom");
  assert.equal(customRes.config.branding.headerTitle, "Ritual");
  assert.equal(customRes.config.interfaceStyle.panelOpacity, 20);
  assert.equal(customRes.config.interfaceStyle.logoScale, 140);

  // Unknown preset returns null safely
  const missingRes = resolveCustomizationForAppearanceAction("preset", "non_existent", [customPreset], "mesa-scene", 6300);
  assert.equal(missingRes, null);
});


