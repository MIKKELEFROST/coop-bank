/* ---------------------------------------------------------------------------
   rhythm.js — timing primitives measured from the four reference films.

   Method: every frame of all four MP4s was decoded to 192x108 greyscale and
   the mean absolute frame-to-frame delta computed. Hard cuts were excluded
   (delta > 3x the 95th percentile), the remainder normalised by its 90th
   percentile. "Bursts" are runs above 85% of typical motion; "holds" are runs
   below 20%.

   Measured results
   ----------------------------------------------------------------
   film     bursts  median burst   holds  median hold
   Airbnb     10       0.17 s        12      0.68 s
   Notion     11       0.17 s        17      0.33 s
   Whop        8       0.20 s        16      0.60 s
   Apple      10       0.27 s        14      0.83 s
   ----------------------------------------------------------------

   The headline: a movement lasts 5-8 frames. The hold after it is 2-4x
   longer. 8-11 movements carry a whole 20-second film.
   --------------------------------------------------------------------------- */

export const FPS = 30;
export const F = 1 / FPS;

/** One movement. Measured median 0.17-0.27 s across all four references. */
export const MOVE = 6 * F; // 0.200 s

/** The landing after a movement. Measured median 0.33-0.83 s. */
export const HOLD = 18 * F; // 0.600 s

/** A long hold, for lines that need reading time (Apple's typography beats). */
export const HOLD_LONG = 36 * F; // 1.200 s

/**
 * The stop. Every reference drops to near-zero motion within 1-2 seconds of
 * its chaos peak — Apple goes from 1.00 to 0.00 in a single second. This is
 * the hinge of the whole form, not a gap between scenes. Non-negotiable.
 */
export const DEADSTOP = 30 * F; // 1.000 s

/**
 * Shortest legible beat. Notion's dark "clarity disappears" card and Whop's
 * shatter both run almost exactly one second.
 */
export const BEAT_MIN = 24 * F; // 0.800 s

/**
 * Easing. These are choices, not measurements — the reference easing curves
 * cannot be recovered from compressed video. They are picked to match the
 * observed shape: hard acceleration in, long settle, no overshoot on type.
 */
export const EASE = {
  /** Elements entering frame. Fast in, long tail. */
  in: "power3.out",
  /** Elements leaving frame. Slow start, fast exit. */
  out: "power2.in",
  /** Camera pushes and scale changes. Symmetric. */
  camera: "power2.inOut",
  /** Type. Slightly softer than elements so words never snap. */
  type: "power2.out",
  /** A card that grows to become the next composition. */
  becomes: "power3.inOut",
};

/**
 * Motion blur shutter, as a fraction of one frame's duration.
 * 0.5 = a 180-degree shutter, the film-standard default.
 */
export const SHUTTER = 0.5;

/** Frames -> seconds. */
export const f = (n) => n * F;

/** Seconds -> nearest whole frame time, so beats always land on a frame. */
export const snap = (t) => Math.round(t * FPS) / FPS;

/**
 * Sequence helper: walks a list of [duration, callback] pairs and returns the
 * timeline positions, so a beat list reads as rhythm rather than arithmetic.
 */
export function cue(start, steps) {
  let t = start;
  const out = [];
  for (const [dur, label] of steps) {
    out.push({ at: snap(t), dur, label });
    t += dur;
  }
  return out;
}
