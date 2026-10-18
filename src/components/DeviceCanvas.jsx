import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { COLORWAYS } from '../lib/colorways.js'
import { clamp, damp, runtime } from '../lib/runtime.js'
import { DEVICE, devicePose, headPose } from '../lib/sceneMath.js'
import { glowTexture } from '../lib/textures.js'
import SceneCamera from './SceneCamera.jsx'
import HumanHead from './HumanHead.jsx'
import CurlbyDevice from './CurlbyDevice.jsx'
import { GROUND_Y } from './city/cityShaders.js'

/**
 * The head and device scene, rendered in its own canvas *above* the city so it can stay
 * sharp while the environment behind it blurs.
 *
 * This component also owns everything that needs the live camera: the world-space drag of
 * the device, the `away` value that drives the blur, and the projected screen position the
 * DOM layer uses for its grab affordance.
 */

/** Cached accent colours so the frame loop never allocates. */
const ACCENT_COLOURS = new Map()

function accentColour(hex) {
  let colour = ACCENT_COLOURS.get(hex)
  if (!colour) {
    colour = new THREE.Color(hex)
    ACCENT_COLOURS.set(hex, colour)
  }
  return colour
}

/**
 * A locally generated environment map (three's RoomEnvironment run through PMREM) gives the
 * polished shell something to reflect with no HDRI download. It is attached through R3F's
 * `attach`, so nothing here has to reach into the scene by hand.
 */
function EnvironmentMap() {
  const gl = useThree((state) => state.gl)

  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
    pmrem.dispose()
    return env.texture
  }, [gl])

  useEffect(() => () => texture.dispose(), [texture])

  return <primitive object={texture} attach="environment" />
}

/** Cinematic key/rim/fill plus an accent bounce that follows the colourway. */
function LightRig() {
  const accent = useRef(null)

  useFrame((_, delta) => {
    const light = accent.current
    if (!light) return
    const way = COLORWAYS[runtime.colour.index] ?? COLORWAYS[0]
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1))
    light.color.lerp(accentColour(way.accent), k)
    light.intensity = 0.35 + 0.75 * (1 - runtime.away.current)
  })

  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight position={[-2.4, 2.6, 2.8]} intensity={1.95} color="#fff1e2" />
      <directionalLight position={[2.8, 0.9, -2.4]} intensity={2.5} color="#6f9dff" />
      <directionalLight position={[0.4, -1.4, 1.2]} intensity={0.42} color="#ffbe8f" />
      <pointLight ref={accent} position={[-0.62, 0.06, 0.12]} intensity={0.7} distance={1.6} />
    </>
  )
}

/** Soft contact shadow so the figure sits on the street instead of floating. */
function ContactShadow() {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.5,
        alphaMap: glowTexture(),
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh material={material} rotation={[-Math.PI * 0.5, 0, 0]} position={[0, GROUND_Y + 0.006, 0]}>
      <planeGeometry args={[2.4, 1.7]} />
    </mesh>
  )
}

/** Every readable value needed by the rig, allocated once. */
function createRigState() {
  return {
    seat: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    baseOffset: new THREE.Vector3(),
    origin: new THREE.Vector3(),
    hit: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    world: new THREE.Vector3(),
    plane: new THREE.Plane(),
    ray: new THREE.Raycaster(),
    ndc: new THREE.Vector2(),
    euler: new THREE.Euler(),
    projected: new THREE.Vector3(),
    dragging: false,
  }
}

/** Unprojects a client-space point onto the frozen drag plane. */
function pickPoint(state, camera, size, clientX, clientY, out) {
  state.ndc.set((clientX / size.width) * 2 - 1, -(clientY / size.height) * 2 + 1)
  state.ray.setFromCamera(state.ndc, camera)
  return state.ray.ray.intersectPlane(state.plane, out) !== null
}

function Rig({ colourIndex }) {
  const headRef = useRef(null)
  const deviceRef = useRef(null)
  const haloRefs = useRef([])
  const earGlowRef = useRef(null)

  /* drag bookkeeping, owned by the frame loop rather than by render */
  const stateRef = useRef(null)
  useEffect(() => {
    stateRef.current = createRigState()
  }, [])

  useFrame(({ camera, clock, size }, delta) => {
    const state = stateRef.current
    if (!state) return
    const dt = Math.min(delta, 0.1)
    const t = clock.elapsedTime
    const p = runtime.scroll.current
    runtime.time = t

    /* ---------------- head: slides into frame over the first third of the scroll */
    const head = headRef.current
    if (head) {
      const pose = headPose(p)
      head.position.set(pose.position[0], pose.position[1], pose.position[2])
      head.rotation.y = pose.rotationY
    }

    /* ---------------- device: flight onto the ear, then drag */
    const pose = devicePose(p)
    const seat = state.seat.set(
      DEVICE.seatPosition[0],
      DEVICE.seatPosition[1],
      DEVICE.seatPosition[2],
    )
    const grab = runtime.grab

    if (grab.active && !state.dragging) {
      // freeze a plane through the seated device, facing the camera, for the whole gesture
      state.dragging = true
      camera.getWorldDirection(state.dir)
      state.plane.setFromNormalAndCoplanarPoint(state.dir, seat)
      if (pickPoint(state, camera, size, grab.startX, grab.startY, state.hit)) {
        state.origin.copy(state.hit)
      } else {
        state.origin.set(0, 0, 0)
      }
      state.baseOffset.copy(state.offset)
    }

    if (grab.active && state.dragging) {
      if (pickPoint(state, camera, size, runtime.pointer.x, runtime.pointer.y, state.hit)) {
        state.offset.copy(state.baseOffset).add(state.hit).sub(state.origin)
        if (state.offset.length() > DEVICE.dragMax) state.offset.setLength(DEVICE.dragMax)
      }
    } else if (!grab.active && state.dragging) {
      state.dragging = false
      if (state.offset.length() < 0.07) state.offset.set(0, 0, 0)
    }

    // the HUD's "return to ear" request eases the device home
    if (runtime.returnRequested) {
      state.offset.multiplyScalar(Math.max(0, 1 - dt * 3.4))
      if (state.offset.length() < 0.006) {
        state.offset.set(0, 0, 0)
        runtime.returnRequested = false
      }
    }

    runtime.away.target = clamp(state.offset.length() / DEVICE.dragLimit, 0, 1)
    runtime.away.current = damp(runtime.away.current, runtime.away.target, 7, dt)
    runtime.signal = 1 - runtime.away.current
    const away = runtime.away.current
    const home = clamp(1 - away * 1.6) // 1 while seated, 0 once pulled clear

    const device = deviceRef.current
    if (device) {
      state.world.copy(seat).add(state.offset)
      // a whisper of life while it is worn
      if (home > 0.001 && !state.dragging) {
        state.world.y += Math.sin(t * 1.05) * 0.0035 * home
        state.world.z += Math.cos(t * 0.87) * 0.002 * home
      }
      state.euler.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ')
      // it swings from the ear as it is pulled away, like something on a mount
      if (away > 0.001) {
        state.euler.x += -state.offset.y * 0.5
        state.euler.y += state.offset.z * 0.3
        state.euler.z += Math.sin(state.offset.x * 1.2) * 0.42
      } else if (home > 0.001) {
        state.euler.z += Math.sin(t * 0.7) * 0.012
      }
      device.position.copy(state.world)
      device.quaternion.setFromEuler(state.euler)

      /* ---------------- publish screen position so the DOM layer can hit-test it */
      state.projected.copy(state.world).project(camera)
      const dist = Math.max(0.4, camera.position.distanceTo(state.world))
      const visibleHeight = 2 * dist * Math.tan((camera.fov * Math.PI) / 360)
      runtime.deviceScreen.x = (state.projected.x * 0.5 + 0.5) * size.width
      runtime.deviceScreen.y = (-state.projected.y * 0.5 + 0.5) * size.height
      runtime.deviceScreen.radius = clamp((0.4 / visibleHeight) * size.height * 1.35, 46, 330)
      runtime.deviceScreen.seated = pose.attach
      runtime.deviceScreen.visible = pose.attach > 0.3 && state.projected.z < 1
    }

    /* ---------------- acoustic halo around the ear (stays sharp with the device) */
    const speech = home * pose.attach * (1 - clamp(away * 0.9))
    const accent = (COLORWAYS[runtime.colour.index] ?? COLORWAYS[0]).accent
    for (let i = 0; i < 3; i++) {
      const mesh = haloRefs.current[i]
      if (!mesh) continue
      mesh.material.color.set(accent)
      const phase = (t * 0.5 + i / 3) % 1
      mesh.scale.setScalar(0.28 + phase * 1.15)
      mesh.material.opacity = speech * Math.pow(1 - phase, 2) * 0.3
    }
    const earGlow = earGlowRef.current
    if (earGlow) {
      earGlow.material.opacity = speech * 0.1
      earGlow.material.color.set(accent)
      earGlow.quaternion.copy(camera.quaternion)
    }

    runtime.ready = true
  })

  return (
    <>
      <HumanHead groupRef={headRef} />
      <CurlbyDevice colourIndex={colourIndex} deviceRef={deviceRef} />

      {/* sound leaving the ear, as wavefronts in the plane of the ear */}
      <group position={[-0.46, 0.05, -0.02]} rotation={[0, Math.PI * 0.5, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            ref={(el) => {
              haloRefs.current[i] = el
            }}
          >
            <torusGeometry args={[0.46, 0.0035, 6, 72]} />
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

      <mesh ref={earGlowRef} position={[-0.46, 0.05, -0.02]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial
          color="#a8c8ff"
          map={glowTexture()}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

export default function DeviceCanvas({ colourIndex = 0 }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 0.05, far: 220, position: [-0.62, 0.16, 1.6] }}
      onCreated={({ gl }) => gl.setClearAlpha(0)}
    >
      <SceneCamera />
      <EnvironmentMap />
      <LightRig />
      <ContactShadow />
      <Rig colourIndex={colourIndex} />
    </Canvas>
  )
}
