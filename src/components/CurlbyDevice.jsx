import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { COLORWAYS } from '../lib/colorways.js'
import { glowTexture, shellDetailTexture, shellRoughnessTexture } from '../lib/textures.js'

/**
 * CURLBY, modelled procedurally to the proportions of the reference photograph.
 *
 * Local frame (1 unit = the coil's centreline radius, the whole model is ~1.8 units tall):
 *   - the ribbed hook is a coil of stacked rings in the XY plane centred on the origin
 *     (R = 0.43) running from -88deg, where it enters the shell, to 148deg at the smooth tip,
 *     so the opening faces local -X;
 *   - the shell hangs below that end, tilted ~18deg, tapering into the spike;
 *   - local +Z is the outward face (star + dotted grip patch), local +X carries the lens.
 */

const DEG = Math.PI / 180

const COIL = {
  radius: 0.43,
  ring: 0.031,
  wire: 0.017,
  ribs: 44,
  from: -88 * DEG,
  to: 148 * DEG,
}

const BODY = {
  /** bottom -> top: lathe profiles must run upwards so the faces point outwards */
  profile: [
    [0.0, -0.585],
    [0.045, -0.5],
    [0.098, -0.44],
    [0.155, -0.375],
    [0.208, -0.305],
    [0.25, -0.225],
    [0.278, -0.14],
    [0.29, -0.04],
    [0.286, 0.06],
    [0.268, 0.155],
    [0.235, 0.235],
    [0.19, 0.3],
    [0.14, 0.345],
    [0.075, 0.375],
    [0.0, 0.4],
  ],
  /** flattened across the head so the shell reads as a slim ear-piece */
  flatten: 0.72,
  tilt: -0.31,
  position: [-0.107, -0.781, 0],
}

function coilGeometry() {
  const unit = new THREE.TorusGeometry(COIL.ring, COIL.wire, 6, 16)
  const rib = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const m = new THREE.Matrix4()
  const zAxis = new THREE.Vector3(0, 0, 1)
  const one = new THREE.Vector3(1, 1, 1)
  const parts = []

  for (let i = 0; i < COIL.ribs; i++) {
    const t = i / (COIL.ribs - 1)
    const th = COIL.from + (COIL.to - COIL.from) * t
    // slight taper where the coil leaves the shell and where it meets the smooth tip
    const near0 = Math.max(0, (0.14 - t) / 0.14)
    const near1 = Math.max(0, (t - 0.78) / 0.22)
    const taper = 1 - 0.16 * near0 * near0 - 0.2 * near1 * near1

    const g = unit.clone()
    if (taper !== 1) g.scale(taper, taper, taper)
    rib.set(Math.cos(th) * COIL.radius, Math.sin(th) * COIL.radius, 0)
    tangent.set(-Math.sin(th), Math.cos(th), 0).normalize()
    q.setFromUnitVectors(zAxis, tangent)
    m.compose(rib, q, one)
    g.applyMatrix4(m)
    parts.push(g)
  }

  unit.dispose()
  const merged = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  return merged
}

function shellGeometry() {
  const points = BODY.profile.map(([x, y]) => new THREE.Vector2(Math.max(x, 1e-4), y))
  const g = new THREE.LatheGeometry(points, 72)
  g.scale(1, 1, BODY.flatten)
  g.computeVertexNormals()
  return g
}

/** Four point sparkle: tips at radius 1 with concave sides bowing in to 0.3. */
function starGeometry() {
  const shape = new THREE.Shape()
  const tips = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ]
  const ctrl = 0.3
  shape.moveTo(tips[0][0], tips[0][1])
  for (let i = 0; i < 4; i++) {
    const a = tips[i]
    const b = tips[(i + 1) % 4]
    const mx = (a[0] + b[0]) * 0.5
    const my = (a[1] + b[1]) * 0.5
    const len = Math.hypot(mx, my) || 1
    shape.quadraticCurveTo((mx / len) * ctrl, (my / len) * ctrl, b[0], b[1])
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 14,
    steps: 1,
  })
  g.center()
  return g
}

export default function CurlbyDevice({ colourIndex = 0, deviceRef }) {
  const geometries = useMemo(
    () => ({
      coil: coilGeometry(),
      shell: shellGeometry(),
      star: starGeometry(),
      tip: new THREE.CapsuleGeometry(0.061, 0.15, 6, 20),
      collar: new THREE.CylinderGeometry(0.086, 0.102, 0.17, 32, 1, true),
      collarRing: new THREE.TorusGeometry(0.1, 0.014, 10, 32),
      barrel: new THREE.CylinderGeometry(0.086, 0.1, 0.16, 32),
      bezel: new THREE.CylinderGeometry(0.106, 0.118, 0.05, 40),
      bezelInner: new THREE.TorusGeometry(0.092, 0.012, 10, 40),
      lens: new THREE.SphereGeometry(0.088, 40, 24, 0, Math.PI * 2, 0, 0.95),
      ring1: new THREE.TorusGeometry(0.056, 0.007, 8, 34),
      ring2: new THREE.TorusGeometry(0.032, 0.006, 8, 28),
      pupil: new THREE.SphereGeometry(0.02, 20, 16),
      halo: new THREE.TorusGeometry(0.132, 0.006, 8, 48),
      glow: new THREE.PlaneGeometry(0.5, 0.5),
    }),
    [],
  )

  const materials = useMemo(() => {
    const shell = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(COLORWAYS[0].body),
      metalness: 1,
      roughness: 0.13,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.6,
      map: shellDetailTexture(),
      roughnessMap: shellRoughnessTexture(),
    })
    return {
      shell,
      dark: new THREE.MeshPhysicalMaterial({
        color: '#05060a',
        metalness: 0.85,
        roughness: 0.3,
        clearcoat: 0.7,
        envMapIntensity: 1.1,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#080b14',
        metalness: 0.4,
        roughness: 0.03,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 2.4,
        transparent: true,
        opacity: 0.92,
      }),
      iris: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#2a49c8'),
        metalness: 0.2,
        roughness: 0.05,
        envMapIntensity: 2,
      }),
      /** the star emblem: polished, a touch brighter than the shell so it reads on black */
      star: new THREE.MeshPhysicalMaterial({
        color: '#b9c2d4',
        metalness: 1,
        roughness: 0.19,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 2.2,
      }),
      accent: new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLORWAYS[0].accent),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      glow: new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLORWAYS[0].accent),
        map: glowTexture(),
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose())
      Object.values(materials).forEach((m) => m.dispose())
    }
  }, [geometries, materials])

  const targetBody = useMemo(() => new THREE.Color(), [])
  const targetAccent = useMemo(() => new THREE.Color(), [])

  // colourway cross-fade: the shell, the sensor halo and the lens glow all move together
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const way = COLORWAYS[colourIndex] ?? COLORWAYS[0]
    const k = 1 - Math.exp(-7 * dt)
    materials.shell.color.lerp(targetBody.set(way.body), k)
    materials.accent.color.lerp(targetAccent.set(way.accent), k)
    materials.glow.color.copy(materials.accent.color)
  })

  const g = geometries
  const m = materials
  const tipAngle = COIL.to

  return (
    <group ref={deviceRef} scale={0.235}>
      {/* ribbed hook + smooth tip cap */}
      <mesh geometry={g.coil} material={m.shell} />
      <group
        position={[Math.cos(tipAngle) * COIL.radius, Math.sin(tipAngle) * COIL.radius, 0]}
        rotation={[0, 0, tipAngle + Math.PI * 0.5]}
      >
        <mesh geometry={g.tip} material={m.shell} position={[0, 0.075, 0]} />
      </group>

      {/* shell, star, and the collar where the coil enters the shell */}
      <group position={BODY.position} rotation={[0, 0, BODY.tilt]}>
        <mesh geometry={g.shell} material={m.shell} />
        <mesh geometry={g.collar} material={m.dark} position={[-0.015, 0.32, 0]} />
        <mesh
          geometry={g.collarRing}
          material={m.shell}
          position={[-0.015, 0.4, 0]}
          rotation={[Math.PI * 0.5, 0, 0]}
        />
        <mesh
          geometry={g.star}
          material={m.star}
          position={[0.043, -0.182, 0.192]}
          rotation={[0.05, 0.117, 0.12]}
          scale={0.15}
        />
      </group>

      {/* sensor barrel: shell shoulder -> bezel -> coated lens.
          Child of the shell group so it inherits the 18deg tilt. */}
      <SensorAssembly shellPosition={BODY.position} tilt={BODY.tilt} g={g} m={m} />
    </group>
  )
}

function SensorAssembly({ shellPosition, tilt, g, m }) {
  // placed in the shell's local space: right hand shoulder, so it lands facing local +X
  const parent = [shellPosition[0], shellPosition[1], shellPosition[2]]
  return (
    <group position={parent} rotation={[0, 0, tilt]}>
      <group position={[0.2, 0.25, 0]} rotation={[0, 0, -Math.PI * 0.5]}>
        <mesh geometry={g.barrel} material={m.dark} position={[0, 0.1, 0]} />
        <mesh geometry={g.bezel} material={m.dark} position={[0, 0.21, 0]} />
        <mesh
          geometry={g.bezelInner}
          material={m.iris}
          position={[0, 0.215, 0]}
          rotation={[Math.PI * 0.5, 0, 0]}
        />
        <mesh
          geometry={g.halo}
          material={m.accent}
          position={[0, 0.235, 0]}
          rotation={[Math.PI * 0.5, 0, 0]}
        />
        <mesh geometry={g.lens} material={m.glass} position={[0, 0.2, 0]} scale={[1, 1, 0.6]} />
        <mesh geometry={g.ring1} material={m.dark} position={[0, 0.24, 0]} rotation={[Math.PI * 0.5, 0, 0]} />
        <mesh geometry={g.ring2} material={m.dark} position={[0, 0.248, 0]} rotation={[Math.PI * 0.5, 0, 0]} />
        <mesh geometry={g.pupil} material={m.dark} position={[0, 0.255, 0]} />
        <mesh geometry={g.glow} material={m.glow} position={[0, 0.32, 0]} />
      </group>
    </group>
  )
}
