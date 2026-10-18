import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA_KEYS, sampleCameraKeys } from '../lib/sceneMath.js'
import { damp, runtime } from '../lib/runtime.js'

/**
 * Scroll-driven camera with a gentle pointer parallax.
 *
 * Both canvases mount their own instance of this rig, and because it reads only from the
 * shared runtime they stay perfectly in sync — which is what lets the blurred city layer
 * line up with the crisp head layer.
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
    target.set(key.target[0] + px * 0.4, key.target[1] + py * 0.3, key.target[2])
    camera.lookAt(target)
  })

  return null
}
