import { useCallback, useEffect, useRef, useState } from 'react'
import Experience from './components/Experience.jsx'
import Hud from './components/Hud.jsx'
import { COLORWAYS, DEFAULT_COLOUR, wrapColour } from './lib/colorways.js'
import { ROLES, clamp, damp, runtime } from './lib/runtime.js'
import { revealAmount, stageIndex } from './lib/sceneMath.js'
import './curlby.css'

/**
 * CURLBY — a scroll-through, interactive product prototype.
 *
 * What lives here:
 *  - the page's scroll position, which is the single source of playback truth,
 *  - one frame loop turning scroll + drag distance into every *continuous* DOM effect
 *    (backdrop blur, city fade, progress rail, signal meter, grab ring),
 *  - the pointer gestures: drag CURLBY off the ear, or swipe the background to change finish,
 *  - the finish itself, the only piece of React state that changes.
 * Both WebGL canvases read the same shared runtime, so scrolling never causes a re-render.
 */

export default function App() {
  const [colourIndex, setColourIndex] = useState(DEFAULT_COLOUR)
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const targets = useRef({})

  const stepColour = useCallback((delta) => {
    setColourIndex((i) => wrapColour(i + delta))
  }, [])

  const selectColour = useCallback((index) => {
    setColourIndex(wrapColour(index))
  }, [])

  const returnHome = useCallback(() => {
    runtime.returnRequested = true
    runtime.held = false
  }, [])

  /* ---------------- preferences + colourway, pushed into the imperative layers */
  useEffect(() => {
    runtime.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    const root = rootRef.current
    const colour = COLORWAYS[colourIndex]
    runtime.colour.index = colourIndex
    if (!root) return
    root.style.setProperty('--cb-accent', colour.ui)
    root.style.setProperty('--cb-accent-soft', colour.accentSoft)
  }, [colourIndex])

  /* ---------------- cache the overlay nodes the frame loop writes to */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const map = { captions: Array.from(root.querySelectorAll(`[data-role="${ROLES.caption}"]`)) }
    Object.entries(ROLES).forEach(([key, role]) => {
      map[key] = root.querySelector(`[data-role="${role}"]`)
    })
    targets.current = map
  }, [])

  /* ---------------- scroll + the single frame loop */
  useEffect(() => {
    const readScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      runtime.scroll.target = clamp(window.scrollY / max, 0, 1)
    }

    const cache = { sil: '', glow: '', city: '', rail: '', signal: '', grab: '', ret: '', hint: '', stage: -1 }
    let raf = 0
    let last = performance.now()

    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now

      runtime.scroll.current = damp(runtime.scroll.current, runtime.scroll.target, 5.5, dt)
      const p = runtime.scroll.current
      runtime.reveal.current = revealAmount(p)
      const reveal = runtime.reveal.current
      const away = runtime.away.current
      const t = targets.current
      if (!t || !t.silhouettes) return

      /* the blurred street: indistinct at the top, dissolving as the echo city arrives,
         and flooding back — blurrier — while the device is off the ear */
      const silOpacity = Math.max(0.92 * (1 - reveal * 1.15), away * 0.72)
      const silBlur = 7 + (1 - reveal) * 7 + away * 30
      const silKey = `${silOpacity.toFixed(3)}|${silBlur.toFixed(1)}`
      if (silKey !== cache.sil) {
        cache.sil = silKey
        t.silhouettes.style.opacity = silOpacity.toFixed(3)
        t.silhouettes.style.filter = `blur(${silBlur.toFixed(1)}px)`
      }

      const glowOpacity = 0.55 - reveal * 0.25 + away * 0.3
      const glowKey = glowOpacity.toFixed(3)
      if (glowKey !== cache.glow) {
        cache.glow = glowKey
        if (t.glow) t.glow.style.opacity = glowKey
      }

      /* the echo city: blurred continuously by how far the device has travelled */
      const cityOpacity = clamp(reveal * (1 - away * 0.9) * 1.02)
      const cityBlur = away * 9
      const cityKey = `${cityOpacity.toFixed(3)}|${cityBlur.toFixed(2)}`
      if (cityKey !== cache.city) {
        cache.city = cityKey
        if (t.cityCanvas) {
          t.cityCanvas.style.opacity = cityOpacity.toFixed(3)
          t.cityCanvas.style.filter = cityBlur > 0.008 ? `blur(${cityBlur.toFixed(2)}px)` : 'none'
        }
      }

      /* progress rail, acoustic meter and the small state affordances */
      const railKey = Math.round(p * 1000)
      if (railKey !== cache.rail) {
        cache.rail = railKey
        if (t.progress) t.progress.style.transform = `scaleY(${p.toFixed(4)})`
        if (t.progressValue) t.progressValue.textContent = `${Math.round(p * 100)}%`
      }

      const signal = runtime.signal
      const signalKey = Math.round(signal * 100)
      if (signalKey !== cache.signal) {
        cache.signal = signalKey
        if (t.signal) t.signal.style.transform = `scaleX(${signal.toFixed(3)})`
        if (t.signalValue) t.signalValue.textContent = String(signalKey)
      }

      const stage = stageIndex(p)
      if (stage !== cache.stage) {
        cache.stage = stage
        ;(t.captions || []).forEach((el, i) => {
          el.setAttribute('data-active', i === stage ? 'true' : 'false')
        })
      }

      const retVisible = away > 0.18 ? 'true' : 'false'
      if (retVisible !== cache.ret) {
        cache.ret = retVisible
        if (t.returnButton) t.returnButton.setAttribute('data-visible', retVisible)
      }

      const hintOpacity = clamp(0.9 - p * 3.4)
      const hintKey = hintOpacity.toFixed(2)
      if (hintKey !== cache.hint) {
        cache.hint = hintKey
        if (t.hint) t.hint.style.opacity = hintKey
      }

      /* the grab ring tracks the device in screen space and brightens while it is held */
      const d = runtime.deviceScreen
      const pointerNear =
        d.visible &&
        runtime.pointer.inside &&
        Math.hypot(runtime.pointer.x - d.x, runtime.pointer.y - d.y) < d.radius * 1.6
      const grabOpacity = !d.visible || d.seated <= 0.35 ? 0 : runtime.held ? 0.8 : pointerNear ? 0.45 : 0.12
      const grabKey = `${grabOpacity.toFixed(2)}|${Math.round(d.x)}|${Math.round(d.y)}|${Math.round(d.radius)}`
      if (grabKey !== cache.grab) {
        cache.grab = grabKey
        if (t.grabRing) {
          t.grabRing.style.opacity = grabOpacity.toFixed(2)
          t.grabRing.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`
          t.grabRing.style.setProperty('--grab-size', `${Math.round(d.radius * 2.1)}px`)
        }
      }
    }

    readScroll()
    window.addEventListener('scroll', readScroll, { passive: true })
    window.addEventListener('resize', readScroll)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', readScroll)
      window.removeEventListener('resize', readScroll)
    }
  }, [])

  /* ---------------- gestures: drag the device, swipe the background for a new finish */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const onPointerDown = (e) => {
      const grab = runtime.grab
      const d = runtime.deviceScreen
      grab.pointerId = e.pointerId
      grab.startX = e.clientX
      grab.startY = e.clientY
      grab.dx = 0
      grab.dy = 0
      grab.startedAt = performance.now()
      const onDevice =
        d.visible && d.seated > 0.5 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < d.radius
      grab.active = onDevice
      runtime.held = onDevice
      if (onDevice) {
        stage.style.touchAction = 'none'
        try {
          stage.setPointerCapture(e.pointerId)
        } catch {
          /* pointer capture is a bonus, not a requirement */
        }
      }
    }

    const onPointerMove = (e) => {
      runtime.pointer.x = e.clientX
      runtime.pointer.y = e.clientY
      runtime.pointer.ndcX = (e.clientX / window.innerWidth) * 2 - 1
      runtime.pointer.ndcY = -(e.clientY / window.innerHeight) * 2 + 1
      runtime.pointer.inside = true
      const grab = runtime.grab
      grab.dx = e.clientX - grab.startX
      grab.dy = e.clientY - grab.startY
    }

    const onPointerUp = (e) => {
      const grab = runtime.grab
      const wasDragging = grab.dragging
      const elapsed = performance.now() - grab.startedAt
      const { dx, dy } = grab
      grab.active = false
      grab.pointerId = null
      runtime.held = false
      stage.style.touchAction = ''
      try {
        stage.releasePointerCapture(e.pointerId)
      } catch {
        /* nothing was captured */
      }
      // a horizontal swipe across the background — never a grab — changes the finish
      if (!wasDragging && Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.15 && elapsed < 900) {
        stepColour(dx > 0 ? 1 : -1)
      }
    }

    const onPointerLeave = () => {
      runtime.pointer.inside = false
    }

    // while the device is held, vertical panning must not steal the gesture
    const stopTouchScroll = (e) => {
      if (runtime.grab.active) e.preventDefault()
    }

    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerleave', onPointerLeave)
    stage.addEventListener('touchmove', stopTouchScroll, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return () => {
      stage.removeEventListener('pointerdown', onPointerDown)
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerleave', onPointerLeave)
      stage.removeEventListener('touchmove', stopTouchScroll)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [stepColour])


  /* ---------------- keyboard: ← → pick a finish, R returns CURLBY to the ear */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') {
        stepColour(1)
      } else if (e.key === 'ArrowLeft') {
        stepColour(-1)
      } else if (e.key === 'r' || e.key === 'R') {
        returnHome()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepColour, returnHome])

  /* ---------------- small bridge used by the smoke tests (harmless in production) */
  useEffect(() => {
    window.__CURLBY__ = {
      get state() {
        return {
          progress: runtime.scroll.current,
          target: runtime.scroll.target,
          reveal: runtime.reveal.current,
          away: runtime.away.current,
          signal: runtime.signal,
          colour: runtime.colour.index,
          held: runtime.held,
          ready: runtime.ready,
          device: { ...runtime.deviceScreen },
        }
      },
      setColour: selectColour,
      returnHome,
      scrollTo(progress) {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
        window.scrollTo(0, clamp(progress, 0, 1) * max)
      },
    }
    return () => {
      delete window.__CURLBY__
    }
  }, [selectColour, returnHome])

  return (
    <div className="cb-root" ref={rootRef}>
      <Experience colourIndex={colourIndex} />
      {/* the interaction layer: full screen, above the canvases, below the UI */}
      <div className="cb-pointer-layer" ref={stageRef} />
      <Hud colourIndex={colourIndex} onColour={selectColour} onReturn={returnHome} />
      {/* gives the page its scroll length; the stage itself is fixed */}
      <div className="cb-scroll-space" aria-hidden="true" />
    </div>
  )
}
