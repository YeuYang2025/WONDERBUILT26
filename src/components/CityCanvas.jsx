import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORWAYS } from '../lib/colorways.js'
import { runtime } from '../lib/runtime.js'
import SceneCamera from './SceneCamera.jsx'
import {
  buildCity,
  createContourMaterial,
  createGroundMaterial,
  GROUND_Y,
} from './city/cityShaders.js'
import { Buildings, ContourLines, Street } from './city/CityParts.jsx'
import { useCityMaterials } from './city/useCityMaterials.js'

/**
 * The city scene. Lives in its own WebGL canvas *behind* the head so the whole environment
 * can be blurred/faded with CSS while the head and the device stay razor sharp — that is what
 * makes the "walk away and the world loses definition" effect continuous instead of a toggle.
 */

function CityWorld() {
  const buildings = useMemo(() => buildCity(), [])
  const { box, materials } = useCityMaterials(buildings)
  const contourMaterial = useMemo(() => createContourMaterial(), [])
  const groundMaterial = useMemo(() => createGroundMaterial(), [])

  /* The frame loop owns the city's look. It reaches those imperative objects through a ref
     (filled in after mount) so nothing created during render is mutated mid-frame. */
  const handles = useRef(null)
  useEffect(() => {
    handles.current = { contour: contourMaterial, ground: groundMaterial, windows: materials, accent: new THREE.Color() }
    return () => {
      contourMaterial.dispose()
      groundMaterial.dispose()
      handles.current = null
    }
  }, [contourMaterial, groundMaterial, materials])

  useFrame(({ clock }) => {
    const h = handles.current
    if (!h) return
    const t = clock.elapsedTime
    const reveal = runtime.reveal.current
    const away = runtime.away.current
    const speech = (0.25 + 0.75 * reveal) * (1 - 0.92 * away)
    h.accent.set((COLORWAYS[runtime.colour.index] ?? COLORWAYS[0]).accent)

    h.contour.uniforms.uTime.value = t
    h.contour.uniforms.uOpacity.value = speech * 0.95
    h.contour.uniforms.uColor.value.copy(h.accent)

    h.ground.uniforms.uTime.value = t
    h.ground.uniforms.uOpacity.value = speech * 0.85
    h.ground.uniforms.uColor.value.copy(h.accent)

    // the same wavefront that lights the outlines lifts the lit windows as it passes
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i]
      const dist = Math.hypot(b.x + 0.46, b.z)
      const phase = (t * 0.2 - dist * 0.011) % 1
      const wrapped = phase < 0 ? phase + 1 : phase
      const pulse = Math.pow(Math.max(0, 1 - Math.abs(wrapped * 2 - 1)), 4)
      h.windows[i].emissiveIntensity = b.lit * (0.28 + 1.7 * pulse) * speech
    }
  })

  return (
    <>
      <ContourLines buildings={buildings} material={contourMaterial} />
      <Buildings buildings={buildings} box={box} materials={materials} />
      <Street />
      <mesh
        material={groundMaterial}
        rotation={[-Math.PI * 0.5, 0, 0]}
        position={[0, GROUND_Y + 0.004, -18]}
      >
        <planeGeometry args={[130, 170, 1, 1]} />
      </mesh>
    </>
  )
}

/** Vertical wavefronts radiating from the ear, sweeping out across the street. */
function EchoBurst() {
  const refs = useRef([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const speech = (0.25 + 0.75 * runtime.reveal.current) * (1 - 0.92 * runtime.away.current)
    const accent = (COLORWAYS[runtime.colour.index] ?? COLORWAYS[0]).accent
    for (let i = 0; i < 3; i++) {
      const mesh = refs.current[i]
      if (!mesh) continue
      // geometry and material belong to the mesh, which R3F creates and disposes
      mesh.material.color.set(accent)
      const phase = (t * 0.22 + i / 3) % 1
      mesh.scale.setScalar(0.5 + phase * 6.5)
      mesh.material.opacity = speech * Math.pow(1 - phase, 2) * 0.85
    }
  })

  return (
    <group position={[-0.46, 0.05, -0.2]} rotation={[0, Math.PI * 0.5, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
        >
          <torusGeometry args={[0.55, 0.006, 6, 96]} />
          <meshBasicMaterial
            color="#a8c8ff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function CityCanvas() {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 0.05, far: 220, position: [-0.62, 0.16, 1.6] }}
      onCreated={({ gl }) => gl.setClearAlpha(0)}
    >
      <fogExp2 attach="fog" args={['#070b14', 0.026]} />
      <ambientLight intensity={0.24} color="#41527a" />
      <directionalLight position={[-5, 7, 5]} intensity={0.6} color="#93aad8" />
      <SceneCamera />
      <CityWorld />
      <EchoBurst />
    </Canvas>
  )
}
