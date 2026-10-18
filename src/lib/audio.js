/**
 * CURLBY's sound: fuzzy radio static that resolves into a deep, reverberant echo field as the
 * hook travels onto the ear.
 *
 * The project ships no audio (public/ holds only the favicons), so both layers are synthesised
 * with the Web Audio API:
 *
 *  - the static: looping noise through a slowly drifting band-pass, with crackle baked into the
 *    buffer and a faint heterodyne carrier "between stations";
 *  - the echo: a low drone choir fed through a generated impulse response — that is what makes it
 *    spacious rather than dry — swelling slowly, with a wavefront ping on the same 0.2 Hz cycle
 *    as the contour waves the city shader draws.
 *
 * The mix is driven by the numbers the 3D scene already animates: `attachAmount(scroll)` for how
 * far the hook has travelled onto the ear and `runtime.away.current` for how far it has been
 * pulled off again. The crossfade *is* the scroll — no separate timeline, no timer, no switch.
 * The graph is built once and only ever re-tuned, and every level moves with `setTargetAtTime`,
 * so starting, stopping and scrolling never click.
 */

import { attachAmount } from './sceneMath.js'
import { ROLES, clamp, runtime } from './runtime.js'

const MASTER = 0.5
const FADE_IN = 0.9
const FADE_OUT = 0.25
const GLIDE = 0.12
const STEP = 0.002
const SUSPEND_AFTER = 450
const ARM_EVENTS = ['pointerdown', 'keydown', 'touchstart']

/** Equal-power crossfade between the two layers for a given "worn" amount (0 -> 1). */
export function mixLevels(worn) {
  const angle = clamp(worn) * Math.PI * 0.5
  return { staticLevel: Math.cos(angle), echoLevel: Math.sin(angle) }
}

/** How worn CURLBY is right now: its travel onto the ear, undone by any drag off the ear. */
export function wornAmount() {
  return attachAmount(runtime.scroll.current) * (1 - clamp(runtime.away.current))
}

/** Seeded noise with occasional crackle — the static itself, and the reverb's raw material. */
function noiseBuffer(ctx, seconds, crackle) {
  const frames = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate)
  let seed = 20261018
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    let burst = 0
    for (let i = 0; i < frames; i++) {
      let sample = (rand() * 2 - 1) * 0.55
      if (crackle && burst <= 0 && rand() < 0.00035) burst = (12 + rand() * 60) | 0
      if (burst > 0) {
        sample += (rand() * 2 - 1) * 1.5 * (burst / 72)
        burst--
      }
      data[i] = sample
    }
  }
  return buffer
}

/** A long, warm stereo tail: two cascaded one-poles under an exponential decay. */
function impulseBuffer(ctx, seconds) {
  const frames = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate)
  let seed = 7919
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    let soft = 0
    let softer = 0
    for (let i = 0; i < frames; i++) {
      soft += (rand() * 2 - 1 - soft) * 0.34
      softer += (soft - softer) * 0.34
      data[i] = softer * Math.pow(1 - i / frames, 2.2) * 0.9
    }
  }
  return buffer
}

/** A single narrow spike per cycle, so a plain oscillator can drive the wavefront ping. */
function pulseCurve(samples = 512) {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    curve[i] = Math.pow(Math.max(0, x), 14) * 0.3
  }
  return curve
}

/* ------------------------------------------------------------------ the graph */

/**
 * Builds every node exactly once. `ctx` may be an AudioContext or an OfflineAudioContext, which
 * is what lets the offline test render this same graph without touching the live one.
 */
export function buildCurlbyGraph(ctx) {
  const master = ctx.createGain()
  master.gain.value = 0
  const sources = []

  /* ---------------- the static: a radio between stations ---------------- */

  const staticLevel = ctx.createGain()
  staticLevel.gain.value = 0
  staticLevel.connect(master)

  // all static sources sit under `fuzz`, so the slow breathing LFO never fights the crossfade
  const fuzz = ctx.createGain()
  fuzz.gain.value = 0.9
  fuzz.connect(staticLevel)

  const noise = noiseBuffer(ctx, 2.6, true)

  const hiss = ctx.createBufferSource()
  hiss.buffer = noise
  hiss.loop = true
  const hissGate = ctx.createBiquadFilter()
  hissGate.type = 'highpass'
  hissGate.frequency.value = 320
  const hissBand = ctx.createBiquadFilter()
  hissBand.type = 'bandpass'
  hissBand.frequency.value = 1650
  hissBand.Q.value = 0.7
  hiss.connect(hissGate).connect(hissBand).connect(fuzz)

  const rumble = ctx.createBufferSource()
  rumble.buffer = noise
  rumble.loop = true
  const rumbleLow = ctx.createBiquadFilter()
  rumbleLow.type = 'lowpass'
  rumbleLow.frequency.value = 380
  const rumbleMix = ctx.createGain()
  rumbleMix.gain.value = 0.5
  rumble.connect(rumbleLow).connect(rumbleMix).connect(fuzz)

  const carrier = ctx.createOscillator()
  carrier.type = 'triangle'
  carrier.frequency.value = 1735
  const carrierMix = ctx.createGain()
  carrierMix.gain.value = 0.03
  carrier.connect(carrierMix).connect(fuzz)

  const wander = ctx.createOscillator() // the tuning drifts and the fuzz breathes
  wander.frequency.value = 0.061
  const wanderTune = ctx.createGain()
  wanderTune.gain.value = 240
  wander.connect(wanderTune).connect(hissBand.frequency)
  const wanderBody = ctx.createGain()
  wanderBody.gain.value = 0.12
  wander.connect(wanderBody).connect(fuzz.gain)

  /* ---------------- the echo: the acoustic field ---------------- */

  const echoLevel = ctx.createGain()
  echoLevel.gain.value = 0
  echoLevel.connect(master)

  const echo = ctx.createGain()
  echo.gain.value = 0.9
  echo.connect(echoLevel)

  const space = ctx.createConvolver()
  space.buffer = impulseBuffer(ctx, 2.8)

  const drones = ctx.createGain()
  drones.gain.value = 0.2
  const droneTone = ctx.createBiquadFilter()
  droneTone.type = 'lowpass'
  droneTone.frequency.value = 780
  droneTone.Q.value = 0.5
  drones.connect(droneTone)

  const VOICES = [
    [55, 'sine', 1], // A1
    [55.32, 'sine', 0.5], // its detuned twin: the field beats slowly
    [82.41, 'triangle', 0.55], // E2
    [110, 'sine', 0.42], // A2
    [164.81, 'sine', 0.16], // E3, a little air on top
  ]
  VOICES.forEach(([hz, type, level]) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = hz
    const gain = ctx.createGain()
    gain.gain.value = level
    osc.connect(gain).connect(drones)
    sources.push(osc)
  })

  const dry = ctx.createGain()
  dry.gain.value = 0.42
  const pan = ctx.createStereoPanner() // CURLBY is worn on the left ear
  pan.pan.value = -0.22
  droneTone.connect(dry).connect(pan).connect(echo)
  droneTone.connect(space)
  const wet = ctx.createGain()
  wet.gain.value = 0.8
  space.connect(wet).connect(echo)

  const swell = ctx.createOscillator() // the wave: level and tone moving slowly together
  swell.frequency.value = 0.083
  const swellDepth = ctx.createGain()
  swellDepth.gain.value = 0.1
  swell.connect(swellDepth).connect(echo.gain)
  const drift = ctx.createOscillator()
  drift.frequency.value = 0.052
  const driftDepth = ctx.createGain()
  driftDepth.gain.value = 230
  drift.connect(driftDepth).connect(droneTone.frequency)
  const room = ctx.createOscillator()
  room.frequency.value = 0.043
  const roomDepth = ctx.createGain()
  roomDepth.gain.value = 0.16
  room.connect(roomDepth).connect(pan.pan)

  /* The wavefront ping. A loud oscillator gated by a slow LFO through a spike curve: the repeat
     needs no scheduling, and its 0.2 Hz cycle is the same one the city's contour waves use. */
  const pulse = ctx.createOscillator()
  pulse.frequency.value = 0.2
  const spike = ctx.createWaveShaper()
  spike.curve = pulseCurve()
  const ping = ctx.createOscillator()
  ping.frequency.value = 330
  const pingLevel = ctx.createGain()
  pingLevel.gain.value = 0
  pulse.connect(spike).connect(pingLevel.gain)
  ping.connect(pingLevel).connect(space)
  sources.push(pulse, ping)

  sources.push(hiss, rumble, carrier, wander, swell, drift, room)
  sources.forEach((node) => node.start())

  return { master, staticLevel, echoLevel, fuzz, echo, sources }
}

/* ----------------------------------------------------------------- the engine */

/**
 * The page's audio engine. Nothing is created until `start()` runs inside a real user gesture
 * (browsers block sound otherwise), the graph is built once, and `update()` is called from the
 * existing frame loop — so the sound can never drift out of sync with the scroll.
 */
export function createCurlbyAudio() {
  let ctx = null
  let graph = null
  let want = true // the user's intent; the mix only follows it once the context can run
  let armed = false
  let hidden = false
  let suspendTimer = 0
  let applied = { staticLevel: -1, echoLevel: -1 }

  const supported = () =>
    typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)

  const api = {
    /** set by the page: called with 'ready' | 'on' | 'off' | 'unavailable' */
    onChange: null,
    update,
    start,
    startOnLoad,
    stop,
    toggle,
    isOn,
    arm,
    dispose,
    get context() {
      return ctx
    },
  }

  function report() {
    const state = !supported()
      ? 'unavailable'
      : !want
        ? 'off'
        : ctx && ctx.state === 'running'
          ? 'on'
          : 'ready'
    runtime.audio.available = supported()
    runtime.audio.on = state === 'on'
    if (api.onChange) api.onChange(state)
    return state
  }

  /** Ease the master in or out. Every start, stop and tab change goes through here. */
  function rampMaster(value, seconds) {
    if (!graph || !ctx) return
    const now = ctx.currentTime
    const gain = graph.master.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(hidden ? 0 : value, now + seconds)
  }

  /** Push a crossfade into the two layer gains — glided, or snapped when fading in from silence. */
  function applyMix(levels, immediate) {
    if (!graph || !ctx) return
    const now = ctx.currentTime
    const set = (param, value) =>
      immediate ? param.setValueAtTime(value, now) : param.setTargetAtTime(value, now, GLIDE)
    set(graph.staticLevel.gain, levels.staticLevel)
    set(graph.echoLevel.gain, levels.echoLevel)
  }

  /**
   * Called once per frame by App's loop. Both sides of the crossfade come from the values the 3D
   * scene is already animating: how far the hook has travelled onto the ear, and how far a drag
   * has pulled it off again.
   */
  function update() {
    const next = mixLevels(wornAmount())
    runtime.audio.staticLevel = next.staticLevel
    runtime.audio.echoLevel = next.echoLevel
    if (!runtime.audio.on) return
    // only touch the AudioParams while the mix is actually moving
    if (
      Math.abs(next.staticLevel - applied.staticLevel) < STEP &&
      Math.abs(next.echoLevel - applied.echoLevel) < STEP
    ) {
      return
    }
    applied = next
    applyMix(next, false)
  }

  function start() {
    if (!supported()) return report()
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext
      ctx = new Ctor({ latencyHint: 'playback' })
      graph = buildCurlbyGraph(ctx)
      graph.master.connect(ctx.destination)
      ctx.onstatechange = report
    }
    want = true
    clearTimeout(suspendTimer)
    // line the layers up with wherever the page already is, then fade the master up
    applied = mixLevels(wornAmount())
    applyMix(applied, true)
    if (ctx.state === 'suspended' && ctx.resume) {
      const resumed = ctx.resume()
      if (resumed && resumed.catch) resumed.catch(() => {}) // still blocked: the HUD keeps saying so
    }
    rampMaster(MASTER, FADE_IN)
    return report()
  }

  /**
   * Sound is on by default: the page calls this once as it mounts, so the static begins with the
   * entrance. Where autoplay is allowed the context starts straight away; where the browser
   * insists on a gesture it stays suspended — we report 'ready' (never a pretend "on") and the
   * first real interaction picks it up, because `arm` is already listening.
   */
  function startOnLoad() {
    const policy =
      typeof navigator !== 'undefined' && typeof navigator.getAutoplayPolicy === 'function'
        ? navigator.getAutoplayPolicy('audio-context')
        : 'allowed'
    // 'allowed-muted' would need the graph started muted, so anything but a plain 'allowed' waits
    // for the first interaction rather than creating a context the browser will only suspend.
    return policy === 'allowed' ? start() : report()
  }

  function stop() {
    want = false
    if (ctx) {
      rampMaster(0, FADE_OUT)
      clearTimeout(suspendTimer)
      // once the fade is done, park the context so a silent graph costs nothing
      suspendTimer = setTimeout(() => {
        if (!want && ctx && ctx.suspend) ctx.suspend().catch(() => {})
      }, SUSPEND_AFTER)
    }
    return report()
  }

  function toggle() {
    return isOn() ? stop() : start()
  }

  function isOn() {
    return !!ctx && !!want && ctx.state === 'running'
  }

  /** The first real gesture is allowed to unlock sound; the sound button handles its own clicks. */
  function onFirstGesture(event) {
    const target = event && event.target
    if (target && target.closest && target.closest(`[data-role="${ROLES.soundButton}"]`)) return
    ARM_EVENTS.forEach((type) => window.removeEventListener(type, onFirstGesture, true))
    if (want) start()
  }

  /** Never leave sound running in a tab nobody is looking at. */
  function onVisibility() {
    hidden = document.hidden
    rampMaster(hidden ? 0 : MASTER, hidden ? FADE_OUT : FADE_IN)
  }

  function arm() {
    if (armed || typeof window === 'undefined') return
    armed = true
    ARM_EVENTS.forEach((type) => window.addEventListener(type, onFirstGesture, true))
    document.addEventListener('visibilitychange', onVisibility)
  }

  function disarm() {
    if (!armed || typeof window === 'undefined') return
    armed = false
    ARM_EVENTS.forEach((type) => window.removeEventListener(type, onFirstGesture, true))
    document.removeEventListener('visibilitychange', onVisibility)
  }

  function dispose() {
    disarm()
    clearTimeout(suspendTimer)
    if (graph) {
      graph.sources.forEach((node) => {
        try {
          node.stop()
        } catch {
          /* already stopped */
        }
      })
      graph.master.disconnect()
    }
    if (ctx) {
      ctx.onstatechange = null
      if (ctx.close) ctx.close().catch(() => {})
    }
    ctx = null
    graph = null
    applied = { staticLevel: -1, echoLevel: -1 }
    runtime.audio.on = false
  }

  return api
}

/** One engine per page, mirroring `runtime`: the frame loop drives it imperatively. */
export const audio = createCurlbyAudio()


