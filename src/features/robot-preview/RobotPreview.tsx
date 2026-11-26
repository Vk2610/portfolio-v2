import { useEffect, useRef } from 'react'
import { mountPreview } from './preview.js'
import './robot-preview.css'

export default function RobotPreview() {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    if (root.current) return mountPreview(root.current)
  }, [])
  return (
    <main className="robot-preview" ref={root}>
      <section className="viewer" aria-label="Interactive robot model">
        <div className="stage" id="stage"></div>
        <p
          id="render-status"
          className="render-status"
          role="status"
          hidden
        ></p>
        <p className="stage-hint">Drag to orbit · Scroll or pinch to zoom</p>
      </section>
      <aside className="panel" aria-label="Preview controls">
        <header>
          <p className="eyebrow">Character preview</p>
          <h1>H1 Classic</h1>
        </header>
        <fieldset className="controls">
          <legend>Emotions</legend>
          <p>Tap the robot to interact, or try a reaction below.</p>
          <div className="presets">
            <button type="button" data-emotion="neutral">
              Neutral
            </button>
            <button type="button" data-emotion="happy">
              Happy
            </button>
            <button type="button" data-emotion="dizzy">
              Dizzy
            </button>
            <button type="button" data-emotion="angry">
              Angry
            </button>
            <button type="button" data-emotion-action="tap">
              Simulate tap
            </button>
            <button type="button" data-emotion-action="impact">
              Simulate impact
            </button>
          </div>
          <button type="button" data-emotion-action="reset">
            Reset emotion
          </button>
          <p className="emotion-status">
            <span>
              Emotion <output data-emotion-state>Neutral</output>
            </span>
            <span>
              Taps <output data-emotion-count>0</output>
            </span>
          </p>
          <details className="emotion-timing">
            <summary>Timing settings</summary>
            {[
              [
                'interactionWindow',
                'Interaction window (ms)',
                5000,
                1000,
                20000,
                100,
              ],
              ['happy', 'Happy duration (ms)', 2000, 500, 10000, 100],
              ['dizzy', 'Dizzy duration (ms)', 3000, 500, 10000, 100],
              ['angry', 'Angry duration (ms)', 3000, 500, 10000, 100],
              ['transition', 'Transition duration (ms)', 275, 100, 600, 25],
            ].map(([key, label, value, min, max, step]) => (
              <label className="emotion-setting" key={key}>
                {label}
                <input
                  type="number"
                  data-emotion-setting={key}
                  defaultValue={value}
                  min={min}
                  max={max}
                  step={step}
                  required
                />
              </label>
            ))}
          </details>
        </fieldset>
        <fieldset className="controls">
          <legend>Camera view</legend>
          <div className="presets">
            <button type="button" data-view="front">
              Front
            </button>
            <button type="button" data-view="side">
              Side
            </button>
            <button type="button" data-view="back">
              Back
            </button>
            <button type="button" data-view="three-quarter">
              Three-quarter
            </button>
          </div>
          <div className="presets">
            <button type="button" data-view="high">
              High angle
            </button>
            <button type="button" data-view="low">
              Low angle
            </button>
            <button type="button" data-view="isometric">
              Isometric
            </button>
            <button type="button" data-view="close">
              Close three-quarter
            </button>
            <button type="button" data-view="top">
              Top
            </button>
            <button type="button" data-view="bottom">
              Bottom
            </button>
          </div>
          <label>
            <span>Turntable angle</span>
            <output id="turntable-angle" htmlFor="turntable">
              0°
            </output>
            <input
              id="turntable"
              type="range"
              min="0"
              max="337.5"
              step="22.5"
              defaultValue="0"
            />
          </label>
          <div className="zoom" role="group" aria-label="Zoom">
            <button type="button" id="zoom-out" aria-label="Zoom out">
              −
            </button>
            <output id="zoom-level" aria-label="Zoom level">
              100%
            </output>
            <button type="button" id="zoom-in" aria-label="Zoom in">
              +
            </button>
          </div>
          <div className="turn" role="group" aria-label="Rotate horizontally">
            <button type="button" id="turn-left">
              Rotate left
            </button>
            <button type="button" id="turn-right">
              Rotate right
            </button>
          </div>
        </fieldset>
        <fieldset className="controls">
          <legend>Proportions</legend>
          <label>
            <span>Head size</span>
            <output htmlFor="head">100%</output>
            <input
              id="head"
              type="range"
              min="70"
              max="135"
              step="1"
              defaultValue="100"
            />
          </label>
          <label>
            <span>Body size</span>
            <output htmlFor="body">60%</output>
            <input
              id="body"
              type="range"
              min="40"
              max="110"
              step="1"
              defaultValue="60"
            />
          </label>
          <label>
            <span>Overall scale</span>
            <output htmlFor="overall">100%</output>
            <input
              id="overall"
              type="range"
              min="65"
              max="125"
              step="1"
              defaultValue="100"
            />
          </label>
        </fieldset>
        <button type="button" id="reset">
          Reset preview
        </button>
      </aside>
    </main>
  )
}
