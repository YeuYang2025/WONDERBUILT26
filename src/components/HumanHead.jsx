import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * A stylised-but-plausible human head, built from primitives.
 *
 * - Faces +Z, sits at the origin, ~1.06 units tall (~23 cm at the scene's scale, i.e. 1 unit
 *   is roughly a quarter of a metre).
 * - The left ear (-X) is where CURLBY mounts, so its proportions follow real anatomy
 *   (an ear is about a quarter of the head's height).
 * - Lighting does the heavy lifting for realism: a warm key, a cold rim and a very soft
 *   environment give the skin sheen without needing scanned geometry.
 */

const EAR_SIDE = -1 // CURLBY is worn on the left ear

function useSkinMaterial() {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#c98f6d',
        roughness: 0.62,
        metalness: 0,
        sheen: 0.9,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color('#ff8a5c'),
        clearcoat: 0.18,
        clearcoatRoughness: 0.7,
        envMapIntensity: 0.7,
      }),
    [],
  )
}

function Ear({ side }) {
  // mirror the ear assembly for the other side of the head
  const x = side * 0.438
  const spin = side === EAR_SIDE ? 0.167 : -1.92
  const yaw = side * Math.PI * 0.5
  return (
    <group position={[x, -0.025, -0.022]} rotation={[0, yaw, 0]}>
      {/* helix: the rim of the ear, open towards the front */}
      <mesh rotation={[0, 0, spin]}>
        <torusGeometry args={[0.088, 0.019, 10, 30, 4.9]} />
        <meshStandardMaterial color="#c1866a" roughness={0.72} />
      </mesh>
      {/* concha + antihelix ridge */}
      <mesh rotation={[0, 0, spin]} position={[0, 0, -0.008]}>
        <torusGeometry args={[0.05, 0.017, 8, 22, 3.4]} />
        <meshStandardMaterial color="#b87a5e" roughness={0.78} />
      </mesh>
      <mesh position={[-0.004, -0.012, -0.018]}>
        <sphereGeometry args={[0.03, 18, 14]} />
        <meshStandardMaterial color="#6d3f2c" roughness={0.9} />
      </mesh>
      {/* canal */}
      <mesh position={[0.002, -0.03, -0.02]} rotation={[Math.PI * 0.5, 0, 0]}>
        <cylinderGeometry args={[0.019, 0.014, 0.05, 16, 1, true]} />
        <meshStandardMaterial color="#2b140c" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* tragus + lobe */}
      <mesh position={[0, -0.062, 0.016]}>
        <sphereGeometry args={[0.026, 16, 12]} />
        <meshStandardMaterial color="#c98f6d" roughness={0.7} />
      </mesh>
      <mesh position={[0.004, -0.098, 0.004]}>
        <sphereGeometry args={[0.033, 18, 14]} />
        <meshStandardMaterial color="#c98f6d" roughness={0.7} />
      </mesh>
    </group>
  )
}

export default function HumanHead({ groupRef }) {
  const skin = useSkinMaterial()
  const hairMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#151113', roughness: 0.85, metalness: 0.05 }),
    [],
  )
  const clothMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#191b21', roughness: 0.92, metalness: 0.02 }),
    [],
  )

  useEffect(() => {
    return () => {
      skin.dispose()
      hairMat.dispose()
      clothMat.dispose()
    }
  }, [skin, hairMat, clothMat])

  const eyeX = 0.15

  return (
    <group ref={groupRef}>
      {/* cranium, cheeks and jaw */}
      <mesh material={skin} position={[0, 0.03, 0]} scale={[0.92, 1.05, 1.0]}>
        <sphereGeometry args={[0.5, 64, 48]} />
      </mesh>
      <mesh material={skin} position={[0, -0.17, 0.17]} scale={[0.84, 1.02, 0.92]}>
        <sphereGeometry args={[0.34, 48, 40]} />
      </mesh>
      <mesh material={skin} position={[0, -0.36, 0.15]} scale={[0.86, 0.94, 1.0]}>
        <sphereGeometry args={[0.26, 40, 32]} />
      </mesh>
      <mesh material={skin} position={[0, -0.45, 0.29]} scale={[0.95, 0.85, 0.9]}>
        <sphereGeometry args={[0.13, 32, 24]} />
      </mesh>

      {/* brow ridge, nose, lips */}
      <mesh material={skin} position={[0, 0.13, 0.33]} scale={[2.2, 0.42, 0.85]}>
        <sphereGeometry args={[0.13, 32, 24]} />
      </mesh>
      <mesh material={skin} position={[0, -0.09, 0.41]} scale={[0.58, 1.0, 1.0]}>
        <sphereGeometry args={[0.1, 32, 24]} />
      </mesh>
      <mesh material={skin} position={[0, -0.185, 0.455]} scale={[1.5, 0.9, 1.0]}>
        <sphereGeometry args={[0.045, 24, 18]} />
      </mesh>
      <mesh material={skin} position={[0, -0.285, 0.425]} rotation={[0, 0, Math.PI * 0.5]} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[0.03, 0.1, 6, 20]} />
      </mesh>
      <mesh material={skin} position={[0, -0.33, 0.415]} rotation={[0, 0, Math.PI * 0.5]} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[0.026, 0.09, 6, 20]} />
      </mesh>

      {/* eyes: recessed socket + soft upper lid, read as eyes without the uncanny stare */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={skin} position={[s * eyeX, 0.075, 0.345]} scale={[1.05, 0.5, 0.8]}>
            <sphereGeometry args={[0.085, 28, 20]} />
          </mesh>
          <mesh position={[s * eyeX, 0.0, 0.365]} scale={[1, 0.42, 0.55]} rotation={[0.1, 0, 0]}>
            <sphereGeometry args={[0.075, 28, 20]} />
            <meshPhysicalMaterial color="#2c1b16" roughness={0.28} clearcoat={0.6} metalness={0.05} />
          </mesh>
          <mesh material={skin} position={[s * eyeX, 0.028, 0.36]} scale={[1.12, 0.62, 0.7]} rotation={[0.22, 0, 0]}>
            <sphereGeometry args={[0.078, 28, 20]} />
          </mesh>
          <mesh material={skin} position={[s * eyeX * 1.02, 0.115, 0.315]} rotation={[0, 0, s * 0.14]} scale={[1, 1, 0.75]}>
            <capsuleGeometry args={[0.019, 0.085, 6, 16]} />
          </mesh>
        </group>
      ))}

      <Ear side={-1} />
      <Ear side={1} />

      {/* hair: short crop over the back and top only, so the face and ears stay clear */}
      <mesh material={hairMat} position={[0, 0.05, -0.03]} scale={[0.97, 1.07, 1.03]}>
        <sphereGeometry args={[0.5, 56, 40, Math.PI * 0.42, Math.PI * 1.16, 0, 1.78]} />
      </mesh>
      <mesh material={hairMat} position={[0, -0.13, -0.24]} scale={[0.88, 0.95, 0.86]}>
        <sphereGeometry args={[0.34, 40, 28]} />
      </mesh>

      {/* neck and a suggestion of shoulders, kept dark so the head stays the subject */}
      <mesh material={skin} position={[0, -0.62, -0.02]} rotation={[-0.06, 0, 0]}>
        <cylinderGeometry args={[0.185, 0.225, 0.42, 36, 1]} />
      </mesh>
      <mesh material={clothMat} position={[0, -1.0, 0.0]} scale={[1.55, 0.62, 0.85]}>
        <sphereGeometry args={[0.52, 44, 30]} />
      </mesh>
    </group>
  )
}

