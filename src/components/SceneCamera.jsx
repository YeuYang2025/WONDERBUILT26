import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CAMERA_KEYS,
  DEVICE,
  DEVICE_CENTRE,
  sampleCameraKeys,
  smoothstep,
} from '../lib/sceneMath.js'
import { damp, lerp, runtime } from '../lib/runtime.js'

/**
 * Scroll-driven camera with a gentle pointer parallax.
 *
 * Both canvases mount their own instance of this rig, and because it reads only from the
 * shared runtime they stay perfectly in sync — which is what lets the blurred city layer
 * line up with the crisp head layer.
 *
 * This rig is also what decides where CURLBY lands on screen: the model is fixed to the ear,
 * so it can only be horizontally centred if it sits on the camera's optical axis. The authored
 * keyframes pan the aim off the ear as the camera pulls back, so once the device is worn the
 * aim is yawed onto it — same pitch, same look distance, same camera position, so its size and
 * vertical position are untouched and the fix holds at every aspect ratio.
 */
export default function SceneCamera() {
  const target = useMemo(() => new THREE.Vector3(), [])
  const smooth = useRef({ x: 0, y: 0 })

  useFrame(({ camera }, delta) => {
    const p = runtime.scroll.current
    const key = sampleCameraKeys(CAMERA_KEYS, p)
    const amp = runtime.reducedMotion ? 0 : 0.05
    smooth.current.x = damp(smooth.current.x, runtime.pointer.inside ? runtime.pointer.ndcX : 0, 3, delta)
    smooth.current.y = damp(smooth.current.y, runtime.pointer.inside ? runtime.pointer.ndcY : 0, 3, delta)
    const px = smooth.current.x * amp
    const py = smooth.current.y * amp

    camera.position.set(key.pos[0] + px, key.pos[1] + py * 0.6, key.pos[2] + Math.abs(px) * 0.12)

    let lookX = key.target[0] + px * 0.4
    let lookZ = key.target[2]

    /* Yaw the aim onto the device's bearing (a pure horizontal turn, so the framing height and
       the model's vertical position are preserved), pivoting on the authored camera position
       so the pointer parallax still moves the whole scene together. The rig renders the device
       at `DEVICE.seatPosition` from the first frame — it only animates its rotation — so that
       constant is what the aim has to track, not the unused flight position. Blended in over
       DEVICE_CENTRE so the opening shots keep their authored framing. */
    const worn = smoothstep(DEVICE_CENTRE.from, DEVICE_CENTRE.to, p)
    if (worn > 0) {
      const device = DEVICE.seatPosition
      const dx = device[0] - key.pos[0]
      const dz = device[2] - key.pos[2]
      const span = Math.hypot(dx, dz)
      if (span > 1e-4) {
        const reach = Math.hypot(lookX - key.pos[0], lookZ - key.pos[2]) / span
        lookX = lerp(lookX, key.pos[0] + dx * reach, worn)
        lookZ = lerp(lookZ, key.pos[2] + dz * reach, worn)
      }
    }

    target.set(lookX, key.target[1] + py * 0.3, lookZ)
    camera.lookAt(target)
  })

  return null
}
