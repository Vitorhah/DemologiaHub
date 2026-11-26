import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExecutionSchedule,
  computeBlackoutTotalSec,
  computeTimelineDurationSec,
  createDefaultSceneNode,
  duplicateSceneNode,
  normalizeSceneBuilderNodes,
  normalizeSceneFadeCuePayload,
  parseImportedSceneBuilderNodes,
  removeSceneNode,
  resolveFadeEasingCss,
  sampleEasingCurve,
  serializeSceneBuilderNodes,
  shiftNodeStartTime,
  summarizeSceneNode,
} from "./sceneBuilder";
import { buildPublicSceneDirectorPayload, normalizeSceneDirectorMasterState } from "./sceneDirector";

test("Scene Builder normalizes, clamps, deduplicates, and sorts nodes chronologically", () => {
  const nodes = normalizeSceneBuilderNodes([
    {
      id: "n2",
      type: "sfx",
      startTimeSec: 3.24,
      durationSec: 1.5,
      params: { effectId: "fx-1", effectName: "Porta", volume: 1.8 },
    },
    {
      id: "n1",
      type: "ost",
      startTimeSec: -5,
      durationSec: 0.1,
      params: { ostAction: "play", trackUrl: "https://ex/a.mp3", fadeSeconds: 20 },
    },
    {
      id: "n1",
      type: "mode",
      startTimeSec: 1,
      params: { targetMode: "rl" },
    },
    {
      id: "bad",
      type: "invalid_type",
      startTimeSec: 2,
    },
  ]);

  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].id, "n1");
  assert.equal(nodes[0].startTimeSec, 0);
  assert.equal(nodes[0].durationSec, 0.5);
  assert.equal(nodes[0].params.fadeSeconds, 10);
  assert.equal(nodes[1].id, "n2");
  assert.equal(nodes[1].startTimeSec, 3.2);
  assert.equal(nodes[1].params.volume, 1);
});

test("createDefaultSceneNode auto-advances startTimeSec and respects delay blocks", () => {
  const n1 = createDefaultSceneNode("ost", []);
  assert.equal(n1.startTimeSec, 0);

  const n2 = createDefaultSceneNode("delay", [n1], { waitSeconds: 3 });
  assert.equal(n2.startTimeSec, 1.5);

  const n3 = createDefaultSceneNode("sfx", [n1, n2]);
  assert.equal(n3.startTimeSec, 4.5);
});

test("buildExecutionSchedule sorts enabled executable nodes and omits disabled/delay entries", () => {
  const nodes = normalizeSceneBuilderNodes([
    { id: "a", type: "ost", startTimeSec: 0, durationSec: 2, enabled: true, params: { ostAction: "play" } },
    { id: "b", type: "delay", startTimeSec: 1.5, durationSec: 2, enabled: true, params: { waitSeconds: 2 } },
    { id: "c", type: "sfx", startTimeSec: 3.5, durationSec: 1.5, enabled: true, params: { effectName: "Trovão" } },
    { id: "d", type: "mode", startTimeSec: 2.0, durationSec: 1.5, enabled: false, params: { targetMode: "rl" } },
    {
      id: "e",
      type: "blackout",
      startTimeSec: 5.0,
      enabled: true,
      params: { fadeInSec: 1.2, holdSeconds: 2.5, fadeOutSec: 0.8, easingStyle: "exponential", easingDirection: "out" },
    },
  ]);

  const schedule = buildExecutionSchedule(nodes);
  assert.equal(schedule.length, 3);
  assert.equal(schedule[0].node.id, "a");
  assert.equal(schedule[0].executeAtMs, 0);
  assert.equal(schedule[1].node.id, "c");
  assert.equal(schedule[1].executeAtMs, 3500);
  assert.equal(schedule[2].node.id, "e");
  assert.equal(schedule[2].executeAtMs, 5000);
});

test("shiftNodeStartTime, duplicateSceneNode, removeSceneNode, and duration math work cleanly", () => {
  const n1 = createDefaultSceneNode("ost", []);
  const n2 = createDefaultSceneNode("clock", [n1], { clockTitle: "Aproximação", amount: 2 });
  let list = [n1, n2];

  list = shiftNodeStartTime(list, n2.id, -5);
  assert.equal(list.find((n) => n.id === n2.id)?.startTimeSec, 0);

  const dup = duplicateSceneNode(list, n1.id);
  assert.ok(dup.created);
  assert.equal(dup.nodes.length, 3);
  assert.equal(dup.created.startTimeSec, 1.5);

  const afterRemove = removeSceneNode(dup.nodes, n2.id);
  assert.equal(afterRemove.length, 2);
  assert.ok(computeTimelineDurationSec(afterRemove) >= 4);
});

test("Fade node keeps only Penumbra, legacy blackout migrates cleanly, and Blackout computes full timing & easing", () => {
  const penumbra = createDefaultSceneNode("fade", [], { opacity: 0.55, holdSeconds: 3 });
  assert.equal(penumbra.params.fadeStyle, "dim");
  assert.equal(summarizeSceneNode(penumbra), "PENUMBRA · 55% (3.0s)");

  // Legacy fade node with fadeStyle: "blackout" migrates to dedicated blackout node
  const migrated = normalizeSceneBuilderNodes([
    { id: "legacy-bo", type: "fade", startTimeSec: 1, params: { fadeStyle: "blackout", holdSeconds: 2 } },
    { id: "legacy-clear", type: "fade", startTimeSec: 2, params: { fadeStyle: "clear", holdSeconds: 1.5 } },
  ]);
  assert.equal(migrated[0].type, "blackout");
  assert.equal(migrated[0].params.holdSeconds, 2);
  assert.equal(migrated[0].durationSec, 3.4); // 0.7 + 2 + 0.7
  assert.equal(migrated[1].type, "fade");
  assert.equal(migrated[1].params.fadeStyle, "dim");

  const bo = createDefaultSceneNode("blackout", [], {
    fadeInSec: 1.5,
    holdSeconds: 3.0,
    fadeOutSec: 0.5,
    easingStyle: "exponential",
    easingDirection: "in",
  });
  assert.equal(computeBlackoutTotalSec(bo.params), 5.0);
  assert.equal(bo.durationSec, 5.0);
  assert.equal(summarizeSceneNode(bo), "BLACKOUT · 1.5/3.0/0.5s · Exp In");

  assert.equal(resolveFadeEasingCss("linear", "in"), "linear");
  assert.equal(resolveFadeEasingCss("quad", "in"), "cubic-bezier(0.11, 0, 0.5, 0)");
  assert.equal(resolveFadeEasingCss("quad", "out"), "cubic-bezier(0.5, 1, 0.89, 1)");
  assert.equal(resolveFadeEasingCss("quad", "inout"), "cubic-bezier(0.45, 0, 0.55, 1)");
  assert.equal(resolveFadeEasingCss("exponential", "in"), "cubic-bezier(0.7, 0, 0.84, 0)");
  assert.equal(resolveFadeEasingCss("exponential", "out"), "cubic-bezier(0.16, 1, 0.3, 1)");
  assert.equal(resolveFadeEasingCss("exponential", "inout"), "cubic-bezier(0.87, 0, 0.13, 1)");

  assert.equal(sampleEasingCurve("linear", "inout", 0.5), 0.5);
  assert.ok(sampleEasingCurve("quad", "in", 0.5) < 0.5);
  assert.ok(sampleEasingCurve("quad", "out", 0.5) > 0.5);
  assert.ok(sampleEasingCurve("exponential", "in", 0.5) < sampleEasingCurve("quad", "in", 0.5));

  const cue = normalizeSceneFadeCuePayload({
    mode: "blackout",
    fadeInSec: 1.2,
    holdSeconds: 2.5,
    fadeOutSec: 0.8,
    easingStyle: "exponential",
    easingDirection: "out",
  });
  assert.deepEqual(cue, {
    mode: "blackout",
    opacity: 1,
    fadeInSec: 1.2,
    holdSeconds: 2.5,
    fadeOutSec: 0.8,
    easingStyle: "exponential",
    easingDirection: "out",
  });
});

test("JSON export/import round-trips cleanly and rejects malformed payloads", () => {
  const n1 = createDefaultSceneNode("blackout", [], {
    fadeInSec: 1.0,
    holdSeconds: 3.0,
    fadeOutSec: 1.0,
    easingStyle: "quad",
    easingDirection: "inout",
  });
  const n2 = createDefaultSceneNode("handout", [n1], { handoutTitle: "Dossiê #04" });
  const raw = serializeSceneBuilderNodes([n1, n2]);

  const imported = parseImportedSceneBuilderNodes(raw);
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.nodes.length, 2);
    assert.equal(
      summarizeSceneNode(imported.nodes[0]),
      "BLACKOUT · 1.0/3.0/1.0s · Quad InOut",
    );
    assert.equal(summarizeSceneNode(imported.nodes[1]), "HANDOUT · Dossiê #04");
  }

  const bad = parseImportedSceneBuilderNodes("{not-json");
  assert.equal(bad.ok, false);
});

test("Scene Builder timelineNodes remain strictly private and never leak into public payload", () => {
  const master = normalizeSceneDirectorMasterState({
    activeSceneId: "scene-secret",
    scenes: [
      {
        id: "scene-secret",
        title: "Porão",
        atmosphere: "Escuro",
        visibleToPlayers: true,
        privateNotes: "Segredo",
        timelineNodes: [
          {
            id: "node-1",
            type: "sfx",
            startTimeSec: 1.5,
            params: { effectName: "Grito Oculto" },
          },
        ],
      },
    ],
    clocks: [],
  });

  const pub = buildPublicSceneDirectorPayload(master);
  assert.equal(JSON.stringify(pub).includes("Grito Oculto"), false);
  assert.equal(JSON.stringify(pub).includes("timelineNodes"), false);
});

test("OST stop node supports Fade Out duration (0..15s) only in stop summary and preserves it across JSON export/import", async () => {
  const { clampCustomFadeSeconds, createVolumeFade } = await import("../services/ostUtils");

  const stopImmediate = createDefaultSceneNode("ost", [], { ostAction: "stop" });
  assert.equal(stopImmediate.params.ostFadeOutSeconds, 0);
  assert.equal(summarizeSceneNode(stopImmediate), "OST · Parar trilha");

  const stopFade = createDefaultSceneNode("ost", [], {
    ostAction: "stop",
    ostFadeOutSeconds: 3.5,
  });
  assert.equal(stopFade.params.ostFadeOutSeconds, 3.5);
  assert.equal(summarizeSceneNode(stopFade), "OST · Parar trilha (Fade Out 3.5s)");

  const stopClamped = createDefaultSceneNode("ost", [], {
    ostAction: "stop",
    ostFadeOutSeconds: 99,
  });
  assert.equal(stopClamped.params.ostFadeOutSeconds, 15);
  assert.equal(summarizeSceneNode(stopClamped), "OST · Parar trilha (Fade Out 15s)");

  const playNode = createDefaultSceneNode("ost", [], {
    ostAction: "play",
    trackName: "Subsolo",
    ostFadeOutSeconds: 5,
  });
  assert.equal(summarizeSceneNode(playNode), "OST · Subsolo");

  const imported = parseImportedSceneBuilderNodes(serializeSceneBuilderNodes([stopFade]));
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.nodes[0].params.ostFadeOutSeconds, 3.5);
  }

  assert.equal(clampCustomFadeSeconds(3.5), 3.5);
  assert.equal(clampCustomFadeSeconds(-2), 0);
  const fade = createVolumeFade({
    direction: "out",
    currentVolume: 0.8,
    targetVolume: 0,
    durationSeconds: 3.5,
    nowMs: 1000,
    finishAction: "stop",
  });
  assert.equal(fade.durationMs, 3500);
  assert.equal(fade.targetVolume, 0);
});

test("Background node supports Link/Upload, detects GIF/MP4/WebM/Image, handles Default mode, and round-trips JSON", async () => {
  const {
    MAX_BACKGROUND_UPLOAD_BYTES,
    SCENE_BACKGROUND_RECORD_ID,
    detectBackgroundMediaType,
    normalizeSceneBackgroundPayload,
    sanitizeBackgroundUrl,
    validateBackgroundUploadFile,
  } = await import("./sceneBuilder");
  const { isSystemRecordId } = await import("./handoutsLogic");

  // System record guard ensures SCENE_BACKGROUND_STATE never appears as a player card
  assert.equal(isSystemRecordId(SCENE_BACKGROUND_RECORD_ID), true);

  // URL sanitization
  assert.equal(
    sanitizeBackgroundUrl("  https://cdn.example.com/corredor.mp4?token=1 "),
    "https://cdn.example.com/corredor.mp4?token=1",
  );
  assert.equal(sanitizeBackgroundUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeBackgroundUrl("ftp://invalid.host/bg.png"), "");
  assert.equal(
    sanitizeBackgroundUrl("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  );

  // Media type detection
  assert.equal(detectBackgroundMediaType("https://ex.com/rain.mp4?v=2"), "video");
  assert.equal(detectBackgroundMediaType("https://ex.com/loop.WEBM"), "video");
  assert.equal(detectBackgroundMediaType("https://ex.com/fog.gif#loop"), "gif");
  assert.equal(detectBackgroundMediaType("https://ex.com/sanatorio.webp"), "image");
  assert.equal(detectBackgroundMediaType("data:video/mp4;base64,AAAA"), "video");
  assert.equal(detectBackgroundMediaType("data:image/gif;base64,AAAA"), "gif");

  // Upload file validation
  assert.deepEqual(
    validateBackgroundUploadFile({ name: "chuva.mp4", type: "video/mp4", size: 4_000_000 }),
    { ok: true, mediaType: "video" },
  );
  assert.deepEqual(
    validateBackgroundUploadFile({ name: "nevoa.gif", type: "image/gif", size: 1_200_000 }),
    { ok: true, mediaType: "gif" },
  );
  assert.equal(
    validateBackgroundUploadFile({ name: "script.exe", type: "application/octet-stream", size: 512 }).ok,
    false,
  );
  assert.equal(
    validateBackgroundUploadFile({ name: "gigante.mp4", type: "video/mp4", size: MAX_BACKGROUND_UPLOAD_BYTES + 1 }).ok,
    false,
  );

  // Default & Custom node creation + summaries
  const bgVideo = createDefaultSceneNode("background", [], {
    backgroundAction: "custom",
    backgroundSource: "link",
    backgroundUrl: "https://cdn.example.com/chuva.mp4",
    backgroundName: "Chuva no Pátio",
  });
  assert.equal(bgVideo.params.backgroundMediaType, "video");
  assert.equal(summarizeSceneNode(bgVideo), "FUNDO · Chuva no Pátio (MP4 · Loop)");

  const bgGif = createDefaultSceneNode("background", [bgVideo], {
    backgroundAction: "custom",
    backgroundSource: "upload",
    backgroundUrl: "https://cdn.example.com/estatica.gif",
  });
  assert.equal(bgGif.params.backgroundMediaType, "gif");
  assert.equal(summarizeSceneNode(bgGif), "FUNDO · GIF · Loop");

  const bgDefault = createDefaultSceneNode("background", [bgVideo, bgGif], {
    backgroundAction: "default",
  });
  assert.equal(summarizeSceneNode(bgDefault), "FUNDO · Default (Padrão do Modo)");

  // JSON round-trip preserves background nodes
  const imported = parseImportedSceneBuilderNodes(
    serializeSceneBuilderNodes([bgVideo, bgDefault]),
  );
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.nodes.length, 2);
    assert.equal(imported.nodes[0].type, "background");
    assert.equal(imported.nodes[0].params.backgroundUrl, "https://cdn.example.com/chuva.mp4");
    assert.equal(imported.nodes[0].params.backgroundMediaType, "video");
    assert.equal(imported.nodes[1].params.backgroundAction, "default");
  }

  // Background payload normalization
  const normalizedCustom = normalizeSceneBackgroundPayload({
    mode: "custom",
    url: "https://cdn.example.com/portal.mp4",
    name: "Portal",
    updatedAt: 1700000000000,
  });
  assert.deepEqual(normalizedCustom, {
    mode: "custom",
    url: "https://cdn.example.com/portal.mp4",
    mediaType: "video",
    name: "Portal",
    updatedAt: 1700000000000,
  });

  const normalizedDefault = normalizeSceneBackgroundPayload({
    mode: "default",
    updatedAt: 1700000000100,
  });
  assert.deepEqual(normalizedDefault, {
    mode: "default",
    url: null,
    mediaType: null,
    name: "",
    updatedAt: 1700000000100,
  });
});

test("Appearance node supports built-in presets, custom saved presets, reset to original, scheduling, and JSON round-trip", () => {
  const builtinNode = createDefaultSceneNode("appearance", [], {
    appearanceAction: "preset",
    appearancePresetId: "nirvana",
    appearancePresetName: "Nirvana",
  });
  assert.equal(builtinNode.type, "appearance");
  assert.equal(builtinNode.params.appearanceAction, "preset");
  assert.equal(builtinNode.params.appearancePresetId, "nirvana");
  assert.equal(summarizeSceneNode(builtinNode), "APARÊNCIA · Nirvana");

  const customNode = createDefaultSceneNode("appearance", [builtinNode], {
    appearanceAction: "preset",
    appearancePresetId: "preset_catedral",
    appearancePresetName: "Catedral Sombria",
  });
  const lookup = {
    appearancePresetNameById: new Map([["preset_catedral", "Catedral Dourada"]]),
  };
  assert.equal(summarizeSceneNode(customNode), "APARÊNCIA · Catedral Sombria");
  assert.equal(summarizeSceneNode(customNode, lookup), "APARÊNCIA · Catedral Dourada");

  const resetNode = createDefaultSceneNode("appearance", [builtinNode, customNode], {
    appearanceAction: "reset",
  });
  assert.equal(resetNode.params.appearanceAction, "reset");
  assert.equal(resetNode.params.appearancePresetId, "demologia");
  assert.equal(summarizeSceneNode(resetNode), "APARÊNCIA · Original (Reset)");

  const schedule = buildExecutionSchedule([builtinNode, customNode, resetNode]);
  assert.equal(schedule.length, 3);
  assert.equal(schedule[0].node.type, "appearance");
  assert.equal(schedule[2].node.params.appearanceAction, "reset");

  const imported = parseImportedSceneBuilderNodes(
    serializeSceneBuilderNodes([builtinNode, customNode, resetNode]),
  );
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.equal(imported.nodes.length, 3);
    assert.equal(imported.nodes[0].params.appearancePresetId, "nirvana");
    assert.equal(imported.nodes[1].params.appearancePresetId, "preset_catedral");
    assert.equal(imported.nodes[2].params.appearanceAction, "reset");
  }
});


