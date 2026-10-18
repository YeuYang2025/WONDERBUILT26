/**
 * CURLBY colourways.
 *
 * `body`   – base colour of the polished shell (fed to the metal/clearcoat material)
 * `accent` – emitted-acoustic colour: the echo waves, city contours and sensor glow
 * `ui`     – CSS colour used by the overlay UI so the page stays in sync with the device
 *
 * Colours are derived from the three finishes in the product brief:
 * Jet Black, Sonic Blue and Soft Violet.
 */
export const COLORWAYS = [
  {
    id: 'jet-black',
    name: 'Jet Black',
    body: '#0d0e12',
    rim: '#4a5162',
    accent: '#a8c8ff',
    accentSoft: 'rgba(168, 200, 255, 0.55)',
    ui: '#a8c8ff',
    swatch: 'radial-gradient(120% 120% at 30% 25%, #565b68 0%, #17181d 55%, #090a0d 100%)',
  },
  {
    id: 'sonic-blue',
    name: 'Sonic Blue',
    body: '#123fd8',
    rim: '#4d7bff',
    accent: '#5fe4ff',
    accentSoft: 'rgba(95, 228, 255, 0.55)',
    ui: '#5fe4ff',
    swatch: 'radial-gradient(120% 120% at 30% 25%, #7fa8ff 0%, #1b46e0 55%, #0a1f7a 100%)',
  },
  {
    id: 'soft-violet',
    name: 'Soft Violet',
    body: '#6d46d8',
    rim: '#a888ff',
    accent: '#d9b7ff',
    accentSoft: 'rgba(217, 183, 255, 0.55)',
    ui: '#d9b7ff',
    swatch: 'radial-gradient(120% 120% at 30% 25%, #c9a8ff 0%, #7b4fe0 55%, #35206e 100%)',
  },
]

export const DEFAULT_COLOUR = 0

export function wrapColour(index) {
  const n = COLORWAYS.length
  return ((index % n) + n) % n
}
