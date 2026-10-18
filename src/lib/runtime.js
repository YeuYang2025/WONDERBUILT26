/**
 * Shared mutable runtime store.
 *
 * The page is driven by a continuous scroll value and by how far the device has been
 * dragged from the ear. Those values update every frame, so React state would be far too
 * expensive: instead the values live in this singleton which the render loop reads and
 * writes imperatively (React state is only used for discrete changes, like the colourway).
 *
 * Writers:
 *  - `App`         -> scroll.target / pointer / grab flags, colour index
 *  - `DeviceCanvas`-> away.current, deviceScreen, echo strength (needs the live camera)
 *  - `App` frame loop -> smooths scroll.current and applies it to the DOM overlay
 */

export const ROLES = {
  silhouettes: 'backdrop-silhouettes',
  glow: 'backdrop-glow',
  cityCanvas: 'city-canvas',
  deviceCanvas: 'device-canvas',
  colourName: 'colour-name',
  colourFill: 'colour-fill',
  progress: 'progress-line',
  progressValue: 'progress-value',
  signal: 'signal-meter',
  signalValue: 'signal-value',
  hint: 'scroll-hint',
  grabRing: 'grab-ring',
  returnButton: 'return-button',
  caption: 'caption',
}

export const STAGE_COUNT = 4

export function clamp(v, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Frame-rate independent exponential smoothing. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * Math.min(dt, 0.1)))
}

export function createRuntime() {
  return {
    /** scroll progress, 0 (top of page) -> 1 (bottom) */
    scroll: { target: 0, current: 0 },
    /** how far the device has been dragged from the ear, 0 -> 1 */
    away: { target: 0, current: 0 },
    /** 0 while the blurred street is on screen, 1 once the echo city is revealed */
    reveal: { current: 0 },
    /** pointer position in client pixels, plus normalised device coords for the parallax */
    pointer: { x: -9999, y: -9999, ndcX: 0, ndcY: 0, inside: false },
    /** drag bookkeeping */
    grab: {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      dx: 0,
      dy: 0,
      travelled: 0,
      startedAt: 0,
      dragging: false,
    },
    /** set by the HUD's "return to ear" control */
    returnRequested: false,
    /** projected device position, published by DeviceCanvas for hit-testing + the HUD ring */
    deviceScreen: { x: -9999, y: -9999, radius: 70, seated: 0, visible: false },
    /** the acoustic strength read-out shown in the HUD (1 = seated on the ear) */
    signal: 1,
    colour: { index: 0, current: 0 },
    /** whether the device is currently held by the pointer */
    held: false,
    time: 0,
    reducedMotion: false,
    /** set to true by DeviceCanvas once the WebGL context is live */
    ready: false,
  }
}

/** The single runtime instance for the page. */
export const runtime = createRuntime()

/** Small helper so components can read the live colourway transition (0,1,2 as a float-free index). */
export function currentColourIndex() {
  return runtime.colour.index
}
