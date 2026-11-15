import test from "node:test";
import assert from "node:assert/strict";
import {
  arePlaybackStatesEqual,
  computeSignedDrift,
  computeSynchronizedPosition,
  decideDriftCorrection,
  isStalePlaybackState,
  normalizeTrackUrl,
  PlaybackState,
  selectBestClockOffset,
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
