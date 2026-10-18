import { COLORWAYS } from '../lib/colorways.js'
import { ROLES } from '../lib/runtime.js'
import { STAGES } from '../lib/stages.js'

/**
 * The overlay. Deliberately dumb: everything that changes every frame (progress, signal,
 * the grab ring) is written imperatively by App's frame loop through the `data-role` hooks,
 * so scrolling never triggers a React render.
 */
export default function Hud({ colourIndex, onColour, onReturn }) {
  const colour = COLORWAYS[colourIndex]

  return (
    <div className="cb-hud">
      <header className="cb-top">
        <div className="cb-brand">
          <span className="cb-brand__mark">CURLBY</span>
          <span className="cb-brand__sub">Spatial hearing · acoustic echo</span>
        </div>

        <div className="cb-finish">
          <span className="cb-finish__label">Finish</span>
          <span className="cb-finish__name" data-role={ROLES.colourName} aria-live="polite">
            {colour.name}
          </span>
          <div className="cb-swatches" role="group" aria-label="Choose a finish">
            {COLORWAYS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className="cb-swatch"
                style={{ '--swatch': c.swatch, '--swatch-glow': c.ui }}
                data-active={i === colourIndex ? 'true' : 'false'}
                aria-pressed={i === colourIndex}
                aria-label={c.name}
                onClick={() => onColour(i)}
              >
                <span className="cb-swatch__dot" />
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="cb-stages">
        {STAGES.map((stage, i) => (
          <article className="cb-card" key={stage.title} data-role={ROLES.caption} data-active="false">
            <span className="cb-card__index">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h2 className="cb-card__title">{stage.title}</h2>
              <p className="cb-card__copy">{stage.copy}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="cb-rail" aria-hidden="true">
        <span className="cb-rail__value" data-role={ROLES.progressValue}>
          0%
        </span>
        <span className="cb-rail__track">
          <span className="cb-rail__fill" data-role={ROLES.progress} />
        </span>
        <span className="cb-rail__label">Scroll</span>
      </div>

      <div className="cb-signal">
        <span className="cb-signal__label">Acoustic link</span>
        <span className="cb-signal__track">
          <span className="cb-signal__fill" data-role={ROLES.signal} />
        </span>
        <span className="cb-signal__value" data-role={ROLES.signalValue}>
          100
        </span>
      </div>

      <button className="cb-return" type="button" data-role={ROLES.returnButton} onClick={onReturn}>
        <span>Return to ear</span>
        <kbd>R</kbd>
      </button>

      <div className="cb-hint" data-role={ROLES.hint}>
        <span className="cb-hint__drag">Drag CURLBY off the ear</span>
        <span className="cb-hint__sep">·</span>
        <span className="cb-hint__swipe">Swipe ← → or tap a finish</span>
      </div>

      <div className="cb-grab" data-role={ROLES.grabRing} aria-hidden="true">
        <span className="cb-grab__ring" />
        <span className="cb-grab__label">Drag</span>
      </div>
    </div>
  )
}
