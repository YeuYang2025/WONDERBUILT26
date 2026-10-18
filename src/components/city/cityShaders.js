import * as THREE from 'three'
import { seededRandom } from '../../lib/textures.js'

/**
 * The acoustic city: building masses whose outlines are lit by sound waves travelling out
 * from the ear, over a wet street carrying echo ripples and a fog bank that swallows the
 * far end of the road.
 *
 * The sonar itself is computed in the fragment shaders from a single time uniform, so the
 * whole reveal costs almost nothing on a phone.
 *
 * `reveal` (scroll) drives how much of this world exists; `away` (drag) drives how much of
 * it dissolves back into blur.
 */

export const GROUND_Y = -1.35

/** Deterministic layout: two rows of blocks flanking a wide street, plus a far skyline. */
export function buildCity(seed = 91, count = 46) {
  const rand = seededRandom(seed)
  const out = []
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const lane = rand() * rand() // most blocks hug the street, a few sit further back
    out.push({
      x: side * (7.2 + lane * 13),
      z: -12 - rand() * 46,
      w: 1.8 + rand() * 3.6,
      d: 1.8 + rand() * 4.2,
      h: 3.4 + Math.pow(rand(), 1.4) * 17,
      lit: 0.45 + rand() * 0.55,
      tint: rand(),
    })
  }
  for (let i = 0; i < 10; i++) {
    out.push({
      x: (rand() - 0.5) * 72,
      z: -68 - rand() * 44,
      w: 5 + rand() * 8,
      d: 4 + rand() * 6,
      h: 9 + rand() * 26,
      lit: 0.4 + rand() * 0.5,
      tint: rand(),
    })
  }
  return out
}

export const CONTOUR_VERT = /* glsl */ `
  attribute float aDist;
  attribute float aTop;
  varying float vDist;
  varying float vTop;
  void main() {
    vDist = aDist;
    vTop = aTop;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const CONTOUR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uWarm;
  varying float vDist;
  varying float vTop;
  void main() {
    // outgoing wave, plus a faster and dimmer returning echo
    float phase = fract(uTime * 0.2 - vDist * 0.011);
    float wave = pow(max(0.0, 1.0 - abs(phase * 2.0 - 1.0)), 5.0);
    float back = fract(uTime * 0.33 - vDist * 0.011 + 0.5);
    float echo = pow(max(0.0, 1.0 - abs(back * 2.0 - 1.0)), 12.0);

    float intensity = 0.12 + wave * 1.25 + echo * 0.5;
    intensity *= mix(1.0, 0.35, smoothstep(0.55, 1.0, vTop));
    intensity *= exp(-vDist * 0.022);

    vec3 col = mix(uWarm, uColor, smoothstep(0.0, 0.85, vTop + wave * 0.25));
    gl_FragColor = vec4(col * intensity, intensity * uOpacity);
  }
`

export const GROUND_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const GROUND_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec3 vWorld;
  void main() {
    vec2 p = vWorld.xz;
    float d = length(p);

    float street = 1.0 - smoothstep(3.0, 13.0, abs(p.x));
    float reach = 1.0 - smoothstep(6.0, 46.0, d);

    float ripple = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float phase = fract(uTime * 0.2 + fi * 0.33 - d * 0.06);
      ripple += pow(max(0.0, 1.0 - abs(phase * 2.0 - 1.0)), 6.0);
    }

    float dash = step(0.45, fract(vWorld.z * 0.42)) * (1.0 - smoothstep(0.05, 0.16, abs(p.x)));
    float sheen = exp(-d * 0.55) * 0.5;

    float amount = (ripple * 0.85 + dash * 0.22 + sheen) * street * reach;
    gl_FragColor = vec4(uColor * amount * 1.35, amount * uOpacity);
  }
`

export function createContourMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: CONTOUR_VERT,
    fragmentShader: CONTOUR_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#a8c8ff') },
      uWarm: { value: new THREE.Color('#93a6c6') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function createGroundMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#a8c8ff') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}
