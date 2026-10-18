/**
 * Pure scene maths for the CURLBY prototype: easing, keyframe sampling and the poses of the
 * head, the device and the camera as a function of the scroll progress `p`.
 *
 * Everything here is plain arrays/numbers (no three.js import) so the choreography can be
 * reasoned about and tuned in one place.
 *
 * World units: 1 unit ~= 0.23 m (the head is ~1.06 units tall).
 * The head sits at the origin, faces +Z. The ear (and therefore CURLBY) is on the +X side.
 */

/* ------------------------------------------------------------------ easing helpers */

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6))
  return t * t * (3 - 2 * t)
}

export function easeInOutCubic(t) {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

export function easeOutCubic(t) {
  const x = clamp01(t)
  return 1 - Math.pow(1 - x, 3)
}

export function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

/** Quadratic bezier for the device's flight path onto the ear. */
export function quadBezier(p0, p1, p2, t) {
  const u = 1 - t
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2],
  ]
}

/* ------------------------------------------------------------------ scene constants */

/**
 * CURLBY is worn on the LEFT ear. In the modelled (local) frame the shell's outward face —
 * the one carrying the star — points along local +Z, and the sensor barrel along local +X.
 * With the ear rotation below (yaw -90°) the star faces away from the head while the sensor
 * looks straight ahead, which is both the physically sensible mount and the exact composition
 * of the reference photograph when seen from outside.
 */
export const HEAD = {
  radius: 0.5,
  scale: [0.92, 1.06, 1.0],
  /** where the head starts (off screen, to the left) before sliding into frame */
  slideFrom: [-1.9, -0.3, 0.35],
  slideRotationY: 0.55,
  /** scroll range of the slide */
  from: 0.0,
  to: 0.34,
}

/** Centre of the device's hook once it is worn (world space, matching the head's left ear). */
export const EAR = { x: -0.462, y: 0.048, z: -0.004 }

export const DEVICE = {
  /** local units -> world units (the modelled device is ~1.8 local units tall) */
  scale: 0.22,
  /**
   * Seated on the ear. X must be the same ear centre the rest of the scene uses (`EAR.x`,
   * which is also what the camera aims at in the framed keyframe) so CURLBY projects to the
   * middle of the viewport instead of sitting slightly to the left of it. The old -0.505 was
   * 0.043 units — and therefore a constant fraction of the viewport width, worse on narrow
   * screens — to the left of that axis. Y/Z are untouched, so the mount height is unchanged.
   */
  seatPosition: [EAR.x, 0.056, -0.004],
  seatRotation: [0.08, -Math.PI * 0.5 - 0.1, 0.06],
  /** where it waits, off screen, before the scroll carries it onto the ear */
  hoverPosition: [-3.15, 1.78, 1.05],
  hoverRotation: [1.18, 1.32, -0.42],
  /** bezier control point that makes it arc in over the shoulder before seating */
  flightControl: [-1.9, 1.18, 0.62],
  attachFrom: 0.3,
  attachTo: 0.62,
  /** drag distance (world units) that corresponds to a full "away" value */
  dragLimit: 0.95,
  /** how far the device may be pulled, as a soft maximum */
  dragMax: 1.5,
}

/**
 * Camera keyframes: wide on the arriving head, a tight portrait of the ear while CURLBY
 * settles, then a long pull-back that reveals the street the echoes are mapping.
 *
 * The first two keys aim at `EAR.x`, because the rig renders the device at the ear's world
 * position from the very first frame (see DeviceCanvas — it positions it at
 * `DEVICE.seatPosition` and only animates its rotation). Aiming at the head's origin instead
 * left CURLBY roughly 17% of the viewport width to the left of centre at the top of the page.
 */
export const CAMERA_KEYS = [
  { t: 0.0, pos: [-0.78, 0.24, 2.35], target: [EAR.x, 0.06, 0.0] },
  { t: 0.34, pos: [-0.9, 0.14, 2.3], target: [EAR.x, 0.03, -0.02] },
  { t: 0.6, pos: [-2.02, 0.14, 1.02], target: [-0.44, -0.02, -0.02] },
  { t: 1.0, pos: [-0.5, 0.52, 4.1], target: [0.12, 0.06, -2.2] },
]

/** Scroll range over which the blurred street resolves into the echo-lit city. */
export const REVEAL = { from: 0.42, to: 0.96 }

/**
 * Scroll range over which the camera yaws to keep CURLBY on its optical axis. Anything off
 * that axis renders off centre — by a share of the viewport width that grows as the viewport
 * narrows — so the aim has to follow the ear, not the street. It opens as the device comes to
 * rest on the ear (0.40, where the authored keys start aiming right of it) and is fully on by
 * 0.52, covering the rest of the dwell and the whole reveal.
 */
export const DEVICE_CENTRE = { from: 0.4, to: 0.52 }

/**
 * The load entrance. CURLBY starts a full `rise` below its seat — comfortably under the bottom
 * edge at any viewport size, since the rise and the model scale with the same camera distance —
 * and floats up into frame while the black curtain lifts off the city behind it. `settle` is the
 * small overshoot past the seat before it comes to rest; `blackHold`/`curtainOut` are the slice
 * of the timeline over which the curtain leaves.
 */
export const ENTRANCE = { duration: 2, rise: 1.2, settle: 0.035, blackHold: 0.1, curtainOut: 0.72 }

/**
 * How far up CURLBY has come: 0 = still below the frame, 1 = seated (a hair over 1 while it
 * settles). A soft start, a swift middle, a long glide — plus one gentle hump past the seat so
 * the model arrives rather than simply stopping.
 */
export function entranceRise(t) {
  const x = clamp01(t)
  const glide = easeInOutCubic(x)
  const u = clamp01((x - 0.62) / 0.38)
  return glide + Math.pow(Math.sin(Math.PI * u), 2) * ENTRANCE.settle
}

/** The black curtain's opacity: held for a beat, then lifted to reveal the city behind the model. */
export function entranceCurtain(t) {
  return 1 - smoothstep(ENTRANCE.blackHold, ENTRANCE.curtainOut, clamp01(t))
}

export const STAGE_BREAKS = [0.3, 0.56, 0.82]

/* ------------------------------------------------------------------ keyframe sampling */

function catmull(a, b, c, d, t) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  )
}

/**
 * Samples a keyframe list (each entry: { t, pos:[x,y,z], target:[x,y,z] }) with a
 * Catmull-Rom spline so camera motion stays smooth *through* the keys instead of
 * stopping at each one.
 */
export function sampleCameraKeys(keys, p) {
  const n = keys.length
  const t = p < keys[0].t ? keys[0].t : p > keys[n - 1].t ? keys[n - 1].t : p
  let i = 0
  while (i < n - 2 && t > keys[i + 1].t) i++
  const a = keys[i]
  const b = keys[i + 1]
  const span = b.t - a.t || 1e-6
  const local = clamp01((t - a.t) / span)
  const p0 = keys[i - 1] || a
  const p3 = keys[i + 2] || b
  const out = { pos: [0, 0, 0], target: [0, 0, 0] }
  for (let k = 0; k < 3; k++) {
    out.pos[k] = catmull(p0.pos[k], a.pos[k], b.pos[k], p3.pos[k], local)
    out.target[k] = catmull(p0.target[k], a.target[k], b.target[k], p3.target[k], local)
  }
  return out
}

/* ------------------------------------------------------------------ choreography */

/** 1 while the head is off screen, 0 once it has settled. */
export function headPose(p) {
  const settled = smoothstep(HEAD.from, HEAD.to, p)
  const k = 1 - easeOutCubic(settled)
  return {
    position: HEAD.slideFrom.map((v) => v * k),
    rotationY: HEAD.slideRotationY * k,
    settled,
  }
}

/** How worn the device is: 0 = floating off screen, 1 = seated on the ear. */
export function attachAmount(p) {
  return smoothstep(DEVICE.attachFrom, DEVICE.attachTo, p)
}

export function devicePose(p) {
  const att = attachAmount(p)
  const e = easeInOutCubic(att)
  const position = quadBezier(DEVICE.hoverPosition, DEVICE.flightControl, DEVICE.seatPosition, e)
  const rotation = lerp3(DEVICE.hoverRotation, DEVICE.seatRotation, e)
  return { position, rotation, attach: att, eased: e }
}

export function revealAmount(p) {
  return smoothstep(REVEAL.from, REVEAL.to, p)
}

export function stageIndex(p) {
  let stage = 0
  for (let i = 0; i < STAGE_BREAKS.length; i++) if (p >= STAGE_BREAKS[i]) stage = i + 1
  return stage
}

/**
 * Acoustic strength: 1 when CURLBY is seated on the ear, 0 when it has been pulled away.
 * This single number drives the city blur, the echo fade and the HUD read-out, which is
 * why the environment effect is continuous rather than a toggle.
 */
export function acousticStrength(away) {
  return 1 - clamp01(away)
}
