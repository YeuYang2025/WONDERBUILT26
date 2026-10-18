import CityBackdrop from './CityBackdrop.jsx'
import CityCanvas from './CityCanvas.jsx'
import DeviceCanvas from './DeviceCanvas.jsx'
import { ROLES } from '../lib/runtime.js'

/**
 * The 3D stage: a CSS street, the echo city in one WebGL canvas, and the head + CURLBY in a
 * second canvas on top. Two canvases because the city has to be blurrable on its own — the
 * blur must never touch the product.
 *
 * The stage owns the pointer events (the canvases are `pointer-events: none`), which is how
 * one gesture handler can serve both the drag and the colour swipes.
 */
export default function Experience({ colourIndex }) {
  return (
    <div className="cb-stage" aria-hidden="true">
      <CityBackdrop />
      <div className="cb-layer" data-role={ROLES.cityCanvas}>
        <CityCanvas />
      </div>
      <div className="cb-layer cb-layer--device" data-role={ROLES.deviceCanvas}>
        <DeviceCanvas colourIndex={colourIndex} />
      </div>
    </div>
  )
}
