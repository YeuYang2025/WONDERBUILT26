import { COLORWAYS } from '../lib/colorways.js'
import { ROLES } from '../lib/runtime.js'
import { STAGES } from '../lib/stages.js'

/** The sound control in the HUD's own voice — 'ready' means the browser has not allowed audio yet. */
const SOUND_LABELS = {
  ready: 'Enable sound',
  on: 'Sound on',
  off: 'Sound off',
  unavailable: 'No audio',
}

/**
 * The overlay. Deliberately dumb: everything that changes every frame (progress, signal,
 * the grab ring) is written imperatively by App's frame loop through the `data-role` hooks,
 * so scrolling never triggers a React render.
 */
export default function Hud({ colourIndex, onColour, onReturn, soundState, onToggleSound }) {
  const colour = COLORWAYS[colourIndex]

  return (
    <div className="cb-hud" data-role={ROLES.hud}>
      <header className="cb-top">
        <div className="cb-brand">
          <span className="cb-brand__mark">CURLBY</span>
          <span className="cb-brand__sub">Spatial hearing · acoustic echo</span>
          {/* sound: 'ready' means the browser has not been allowed to play audio yet */}
          <button
            className="cb-sound"
            type="button"
            data-role={ROLES.soundButton}
            data-state={soundState}
            aria-pressed={soundState === 'on'}
            title={soundState === 'on' ? 'Turn sound off' : 'Turn sound on'}
            onClick={onToggleSound}
          >
            <span className="cb-sound__icon" aria-hidden="true">
              <svg viewBox="0 0 16 14" width="15" height="13">
                <path className="cb-sound__body" d="M1.2 5.1h2.3L7.1 1.6v10.8L3.5 8.9H1.2z" />
                <path className="cb-sound__wave" d="M9.3 4.6a3.4 3.4 0 0 1 0 4.8" />
                <path className="cb-sound__wave cb-sound__wave--far" d="M11.3 2.6a6.1 6.1 0 0 1 0 8.8" />
                <path className="cb-sound__slash" d="M1.6 12.4 14.4 1.6" />
              </svg>
            </span>
            <span className="cb-sound__label">{SOUND_LABELS[soundState]}</span>
          </button>
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

      {/* the product introduction: revealed while the pointer is over the worn device itself.
          Its position in the DOM matters — the stage captions fade back via the sibling rule. */}
      <aside className="cb-intro" data-role={ROLES.intro} data-visible="false">
        <p className="cb-intro__eyebrow">CURLBY</p>
        <h2 className="cb-intro__title">Hear beyond the silence.</h2>
        <p className="cb-intro__lead">A new way to experience the world.</p>
        <p className="cb-intro__copy">
          CURLBY is a fashion-forward sensory wearable designed to help blind and visually impaired
          people interpret their surroundings. It uses echolocation-inspired sound processing to
          transform environmental sounds into spatial information, delivered through vibrations
          around the mastoid bone.
        </p>
      </aside>

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
