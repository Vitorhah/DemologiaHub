import test from "node:test";
import assert from "node:assert/strict";
import {
  arePlaybackStatesEqual,
  computeSignedDrift,
  computeSynchronizedPosition,
  createVolumeFade,
  decideDriftCorrection,
  evaluateVolumeFade,
  getNextFadeDuration,
  isStalePlaybackState,
  normalizeFadeDuration,
  normalizeTrackUrl,
  PlaybackState,
  selectBestClockOffset,
  updateVolumeFadeTarget,
} from "../services/ostUtils";

const baseState: PlaybackState = {
  room_id: "mesa-1",
  track_url: "https://example.com/ost.mp3",
  started_at: "2026-11-14T10:00:00.000Z",
  is_playing: true,
  paused_position: 0,
  volume: 0.8,
  loop: false,
  updated_at: "2026-11-14T10:00:00.000Z",
};

test("selectBestClockOffset prefers lowest-RTT samples to avoid network spikes", () => {
  const offset = selectBestClockOffset([
    { offsetMs: 650, rttMs: 900 },
    { offsetMs: 120, rttMs: 40 },
    { offsetMs: 140, rttMs: 55 },
  ]);
  assert.equal(offset, 130);
});

test("computeSynchronizedPosition handles paused, playing, non-loop clamp, and loop wrap", () => {
  const pausedPos = computeSynchronizedPosition({
    state: { ...baseState, is_playing: false, paused_position: 42.5 },
    serverNowMs: Date.parse("2026-11-14T10:02:00.000Z"),
    durationSeconds: 100,
  });
  assert.equal(pausedPos, 42.5);

  const clampedPos = computeSynchronizedPosition({
    state: baseState,
    serverNowMs: Date.parse("2026-11-14T10:03:00.000Z"),
    durationSeconds: 100,
  });
  assert.equal(clampedPos, 100);

  const loopedPos = computeSynchronizedPosition({
    state: { ...baseState, loop: true },
    serverNowMs: Date.parse("2026-11-14T10:02:15.000Z"),
    durationSeconds: 100,
  });
  assert.equal(loopedPos, 35);
});

test("computeSignedDrift uses shortest circular path across loop boundary", () => {
  // Audio at 99.8s, target wrapped to 0.1s on a 100s looped track -> only +0.3s behind, not -99.7s!
  const drift = computeSignedDrift({
    currentTime: 99.8,
    targetTime: 0.1,
    durationSeconds: 100,
    loop: true,
  });
  assert.ok(Math.abs(drift - 0.3) < 0.0001);
});

test("decideDriftCorrection avoids hard-seek loops by using micro playbackRate adjustments and cooldown", () => {
  // Small jitter -> do nothing
  assert.deepEqual(
    decideDriftCorrection({
      signedDrift: 0.2,
      isBuffering: false,
      isSeeking: false,
      lastHardSeekAtMs: 0,
      nowMs: 10_000,
    }),
    { action: "none", playbackRate: 1.0 },
  );

  // Moderate lag (0.8s behind) -> gentle speed-up without seeking backward
  assert.deepEqual(
    decideDriftCorrection({
      signedDrift: 0.8,
      isBuffering: false,
      isSeeking: false,
      lastHardSeekAtMs: 0,
      nowMs: 10_000,
    }),
    { action: "rate", playbackRate: 1.04 },
  );

  // Large lag (5s behind) outside cooldown -> single hard seek
  assert.deepEqual(
    decideDriftCorrection({
      signedDrift: 5.0,
      isBuffering: false,
      isSeeking: false,
      lastHardSeekAtMs: 0,
      nowMs: 10_000,
    }),
    { action: "seek", playbackRate: 1.0 },
  );

  // Large lag inside 3s cooldown -> falls back to rate instead of thrashing seeks
  assert.deepEqual(
    decideDriftCorrection({
      signedDrift: 5.0,
      isBuffering: false,
      isSeeking: false,
      lastHardSeekAtMs: 8_500,
      nowMs: 10_000,
    }),
    { action: "rate", playbackRate: 1.04 },
  );

  // Never correct while buffering
  assert.deepEqual(
    decideDriftCorrection({
      signedDrift: 5.0,
      isBuffering: true,
      isSeeking: false,
      lastHardSeekAtMs: 0,
      nowMs: 10_000,
    }),
    { action: "none", playbackRate: 1.0 },
  );
});

test("arePlaybackStatesEqual and isStalePlaybackState ignore duplicate or older echoes", () => {
  const normalizedSame: PlaybackState = {
    ...baseState,
    track_url: " https://example.com/ost.mp3 ",
  };
  assert.equal(normalizeTrackUrl(normalizedSame.track_url), "https://example.com/ost.mp3");
  assert.equal(arePlaybackStatesEqual(baseState, normalizedSame), true);

  const newer: PlaybackState = {
    ...baseState,
    is_playing: false,
    paused_position: 12,
    updated_at: "2026-11-14T10:01:00.000Z",
  };
  assert.equal(isStalePlaybackState(newer, baseState), true);
  assert.equal(isStalePlaybackState(baseState, newer), false);
});

test("getNextFadeDuration cycles 0 -> 2 -> 5 -> 10 -> 0 and normalizes invalid inputs", () => {
  assert.equal(getNextFadeDuration(0), 2);
  assert.equal(getNextFadeDuration(2), 5);
  assert.equal(getNextFadeDuration(5), 10);
  assert.equal(getNextFadeDuration(10), 0);
  assert.equal(normalizeFadeDuration("5"), 5);
  assert.equal(normalizeFadeDuration(99), 0);
});

test("evaluateVolumeFade linearly interpolates independent of frame rate and supports mid-fade target updates", () => {
  const fadeIn = createVolumeFade({
    direction: "in",
    currentVolume: 0,
    targetVolume: 0.8,
    durationSeconds: 10,
    nowMs: 1000,
  });

  // At t=2.5s (25%), volume is linearly 0.2
  const quarter = evaluateVolumeFade(fadeIn, 3500);
  assert.ok(Math.abs(quarter.volume - 0.2) < 0.0001);
  assert.equal(quarter.completed, false);

  // At t=5.0s (50%), volume is 0.4; update timeline target to 0.6 -> stays 0.4 at instant t=5.0s (no jump!)
  const half = evaluateVolumeFade(fadeIn, 6000);
  assert.ok(Math.abs(half.volume - 0.4) < 0.0001);

  const updated = updateVolumeFadeTarget(fadeIn, 0.6, 6000);
  const rightAfterUpdate = evaluateVolumeFade(updated, 6000);
  assert.ok(Math.abs(rightAfterUpdate.volume - 0.4) < 0.0001);

  // Halfway through remaining 5s -> 0.5; end -> 0.6
  const halfwayRemaining = evaluateVolumeFade(updated, 8500);
  assert.ok(Math.abs(halfwayRemaining.volume - 0.5) < 0.0001);
  const done = evaluateVolumeFade(updated, 11000);
  assert.ok(Math.abs(done.volume - 0.6) < 0.0001);
  assert.equal(done.completed, true);

  // Reversing mid-fade into fade-out starts from current interpolated volume (0.5)
  const reversedOut = createVolumeFade({
    direction: "out",
    currentVolume: halfwayRemaining.volume,
    targetVolume: 0,
    durationSeconds: 5,
    nowMs: 8500,
    finishAction: "pause",
  });
  const startOut = evaluateVolumeFade(reversedOut, 8500);
  assert.ok(Math.abs(startOut.volume - 0.5) < 0.0001);
  const endOut = evaluateVolumeFade(reversedOut, 13500);
  assert.equal(endOut.volume, 0);
  assert.equal(endOut.completed, true);
  assert.equal(reversedOut.finishAction, "pause");
});

