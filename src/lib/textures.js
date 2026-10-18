/**
 * Procedural textures drawn with the 2D canvas API.
 *
 * Everything is generated at runtime so the prototype has no external image assets to
 * download (and therefore works offline / in a headless test run).
 */
import * as THREE from 'three'

const cache = new Map()

function canvas(size, draw) {
  const el = document.createElement('canvas')
  el.width = size
  el.height = size
  const ctx = el.getContext('2d')
  draw(ctx, size)
  return el
}

function cached(key, factory) {
  if (!cache.has(key)) cache.set(key, factory())
  return cache.get(key)
}

/** Random with a fixed seed so the city looks the same on every reload. */
export function seededRandom(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Window grid used as an emissive map on the building volumes. Dark cells are unlit
 * windows, light cells are lit ones; the tint swings between warm interior light and the
 * cold glow of the city.
 */
export function windowTexture() {
  return cached('windows', () => {
    const rand = seededRandom(7)
    const el = canvas(256, (ctx, size) => {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, size, size)
      const cols = 8
      const rows = 26
      const cw = size / cols
      const ch = size / rows
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (rand() > 0.42) continue
          const warm = rand() > 0.45
          const a = 0.35 + rand() * 0.65
          ctx.fillStyle = warm
            ? `rgba(255, 214, 160, ${a.toFixed(3)})`
            : `rgba(170, 214, 255, ${a.toFixed(3)})`
          const pad = cw * 0.22
          ctx.fillRect(x * cw + pad * 0.5, y * ch + ch * 0.28, cw - pad, ch * 0.42)
        }
      }
    })
    const tex = new THREE.CanvasTexture(el)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  })
}

/**
 * Detail map for CURLBY's shell: brushed streaks plus the dotted grip patch and the fine
 * engraved marking visible on the reference photo. Painted in greys so the material's
 * base colour (which switches per colourway) tints it.
 */
export function shellDetailTexture() {
  return cached('shell-detail', () => {
    const rand = seededRandom(23)
    const el = canvas(512, (ctx, size) => {
      ctx.fillStyle = '#f2f2f2'
      ctx.fillRect(0, 0, size, size)

      // subtle brushed streaks running around the body (u axis)
      for (let i = 0; i < 900; i++) {
        const y = rand() * size
        const w = 8 + rand() * 90
        const x = rand() * size
        ctx.strokeStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '170,170,170'}, ${(
          0.05 +
          rand() * 0.1
        ).toFixed(3)})`
        ctx.lineWidth = 0.5 + rand() * 1.4
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + w, y + (rand() - 0.5) * 3)
        ctx.stroke()
      }

      // dotted grip patch: u ~= 0 is the outward face of the body, v ~= 0.5..0.8 its lower half
      ctx.save()
      ctx.translate(size * 0.945, size * 0.63)
      ctx.rotate(-0.5)
      ctx.fillStyle = 'rgba(90, 90, 90, 0.95)'
      const step = 11
      for (let y = -70; y < 70; y += step) {
        for (let x = -46; x < 46; x += step) {
          ctx.beginPath()
          ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()

      // engraved micro marking
      ctx.save()
      ctx.translate(size * 1.0, size * 0.55)
      ctx.rotate(-0.42)
      ctx.fillStyle = 'rgba(120, 120, 120, 0.75)'
      ctx.font = '7px ui-monospace, monospace'
      for (let i = 0; i < 3; i++) ctx.fillText('111:11 : 1:1', 0, i * 9)
      ctx.restore()
    })
    const tex = new THREE.CanvasTexture(el)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  })
}

/** Grayscale roughness map that keeps the grip patch slightly less glossy than the shell. */
export function shellRoughnessTexture() {
  return cached('shell-rough', () => {
    const el = canvas(256, (ctx, size) => {
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(0, 0, size, size)
      ctx.save()
      ctx.translate(size * 0.945, size * 0.63)
      ctx.rotate(-0.5)
      ctx.fillStyle = '#8a8a8a'
      const step = 11
      for (let y = -70; y < 70; y += step) {
        for (let x = -46; x < 46; x += step) {
          ctx.beginPath()
          ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
    })
    const tex = new THREE.CanvasTexture(el)
    return tex
  })
}

/** Soft radial sprite used for the additive glows around the lens and in the HUD. */
export function glowTexture() {
  return cached('glow', () => {
    const el = canvas(256, (ctx, size) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.25, 'rgba(255,255,255,0.45)')
      g.addColorStop(0.55, 'rgba(255,255,255,0.12)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    })
    const tex = new THREE.CanvasTexture(el)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  })
}
