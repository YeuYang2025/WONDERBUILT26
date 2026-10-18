import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { seededRandom, windowTexture } from '../../lib/textures.js'

/**
 * One merged unit-box geometry plus a window material per block: the city's window lights
 * are driven per building, so each one needs its own emissive intensity. This lives apart
 * from the components so the module can stay components-only for fast refresh.
 */
export function useCityMaterials(buildings) {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  const materials = useMemo(() => {
    const source = windowTexture()
    const rand = seededRandom(41)
    return buildings.map((b) => {
      const map = source.clone()
      map.needsUpdate = true
      map.repeat.set(Math.max(1, Math.round(b.w * 0.62)), Math.max(2, Math.round(b.h * 0.36)))
      map.offset.set(0, rand() * 0.5)
      return new THREE.MeshStandardMaterial({
        color: b.tint > 0.6 ? '#0a0d16' : '#070911',
        roughness: 0.86,
        metalness: 0.24,
        emissive: new THREE.Color(b.tint > 0.5 ? '#ffd7a0' : '#cfe4ff'),
        emissiveMap: map,
        emissiveIntensity: 0,
      })
    })
  }, [buildings])

  useEffect(
    () => () => {
      materials.forEach((m) => {
        if (m.emissiveMap) m.emissiveMap.dispose()
        m.dispose()
      })
      box.dispose()
    },
    [materials, box],
  )

  return { box, materials }
}
