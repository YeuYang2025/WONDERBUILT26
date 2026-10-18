import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GROUND_Y } from './cityShaders.js'

/**
 * Building outlines merged into a single draw call. Each vertex carries its distance from
 * the ear (`aDist`) and its height ratio (`aTop`) so the wavefront can be evaluated entirely
 * in the fragment shader — one object, thousands of glowing edges, no per-frame CPU work.
 */
export function ContourLines({ buildings, material }) {
  const geometry = useMemo(() => {
    const positions = []
    const dists = []
    const tops = []
    const push = (p, top) => {
      positions.push(p[0], p[1], p[2])
      dists.push(Math.hypot(p[0] + 0.46, p[2]))
      tops.push(top)
    }
    const edge = (a, b) => {
      push(a, a[3])
      push(b, b[3])
    }

    buildings.forEach((b) => {
      const x0 = b.x - b.w * 0.5
      const x1 = b.x + b.w * 0.5
      const z0 = b.z - b.d * 0.5
      const z1 = b.z + b.d * 0.5
      const y0 = GROUND_Y
      const y1 = GROUND_Y + b.h
      const bottom = [
        [x0, y0, z0, 0],
        [x1, y0, z0, 0],
        [x1, y0, z1, 0],
        [x0, y0, z1, 0],
      ]
      const top = [
        [x0, y1, z0, 1],
        [x1, y1, z0, 1],
        [x1, y1, z1, 1],
        [x0, y1, z1, 1],
      ]
      for (let i = 0; i < 4; i++) {
        edge(bottom[i], bottom[(i + 1) % 4])
        edge(top[i], top[(i + 1) % 4])
        edge(bottom[i], top[i])
      }
    })

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(dists, 1))
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(tops, 1))
    g.computeBoundingSphere()
    return g
  }, [buildings])

  useEffect(() => () => geometry.dispose(), [geometry])

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />
}

export function Buildings({ buildings, box, materials }) {
  return (
    <group>
      {buildings.map((b, i) => (
        <mesh
          key={`${b.x.toFixed(2)}:${b.z.toFixed(2)}:${i}`}
          geometry={box}
          material={materials[i]}
          position={[b.x, GROUND_Y + b.h * 0.5, b.z]}
          scale={[b.w, b.h, b.d]}
        />
      ))}
    </group>
  )
}

/** Dark, faintly wet street so the additive ripples have something to sit on. */
export function Street() {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#05070d',
        roughness: 0.42,
        metalness: 0.35,
        envMapIntensity: 0.6,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh material={material} rotation={[-Math.PI * 0.5, 0, 0]} position={[0, GROUND_Y - 0.01, -18]}>
      <planeGeometry args={[130, 170, 1, 1]} />
    </mesh>
  )
}
