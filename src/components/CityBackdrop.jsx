import { ROLES } from '../lib/runtime.js'

/**
 * The blurred street CURLBY is auditioning at the top of the page: pure CSS, so it costs
 * nothing, needs no assets and can be blurred/faded continuously by the frame loop
 * (`backdrop-silhouettes` opacity + blur radius) as the scroll reveals the echo city
 * behind it — and again whenever the device is pulled away from the ear.
 */
export default function CityBackdrop() {
  return (
    <div className="cb-backdrop" aria-hidden="true">
      <div className="cb-backdrop__sky" />
      <div className="cb-backdrop__glow" data-role={ROLES.glow} />

      <div className="cb-backdrop__silhouettes" data-role={ROLES.silhouettes}>
        <div className="cb-backdrop__buildings cb-backdrop__buildings--far" />
        <div className="cb-backdrop__buildings cb-backdrop__buildings--near" />
        <div className="cb-backdrop__people">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="cb-backdrop__street" />
      </div>

      <div className="cb-backdrop__vignette" />
      <div className="cb-backdrop__grain" />
    </div>
  )
}
