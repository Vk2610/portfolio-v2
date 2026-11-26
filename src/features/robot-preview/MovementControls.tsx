type Setting = [
  key: string,
  label: string,
  initial: number,
  min: number,
  max: number,
  step: number,
]
type SettingGroup = 'motion' | 'physics' | 'tracking'

const motion: Setting[] = [
  ['walkSpeed', 'Walking speed', 0.55, 0.1, 1.5, 0.05],
  ['strideLength', 'Stride length', 0.4, 0.18, 0.55, 0.01],
  ['breathingIntensity', 'Breathing intensity', 1, 0, 2, 0.1],
  ['breathingPeriod', 'Breathing cycle (s)', 3.65, 2, 7, 0.05],
  [
    'jumpHeight',
    'Jump height (fraction of standing height)',
    0.19,
    0.1,
    0.32,
    0.01,
  ],
  ['transitionSpeed', 'Pose blend speed', 9, 3, 18, 0.5],
]
const physics: Setting[] = [
  ['dropHeight', 'Drop or platform height', 1.25, 0.3, 3, 0.05],
  ['gravity', 'Gravity', 9.81, 4, 24, 0.01],
  ['friction', 'Friction', 0.75, 0, 1.5, 0.05],
  ['restitution', 'Restitution', 0.2, 0, 0.65, 0.01],
  ['mass', 'Mass', 6, 1, 15, 0.1],
  ['damping', 'Damping', 0.68, 0.1, 2, 0.01],
]
const tracking: Setting[] = [
  ['yaw', 'Yaw limit (°)', 45, 0, 45, 1],
  ['pitch', 'Pitch limit (°)', 25, 0, 25, 1],
  ['responsiveness', 'Responsiveness', 9, 2, 22, 0.5],
  ['sensitivity', 'Sensitivity', 1, 0.2, 2, 0.1],
  ['deadZone', 'Dead zone (°)', 2.2, 0, 10, 0.1],
  ['inactivity', 'Inactivity timeout (ms)', 1800, 300, 8000, 100],
  ['returnSpeed', 'Return to neutral speed', 4.2, 1, 15, 0.1],
]

function Settings({
  group,
  values,
}: {
  group: SettingGroup
  values: Setting[]
}) {
  return values.map(([key, label, initial, min, max, step]) => (
    <label className="emotion-setting" key={key}>
      {label}
      <input
        {...{ [`data-${group}-setting`]: key }}
        type="number"
        defaultValue={initial}
        min={min}
        max={max}
        step={step}
        required
      />
    </label>
  ))
}

const moves = [
  ['idle', 'Idle / breathing'],
  ['stop', 'Stop walking'],
  ['walk-left', 'Walk left'],
  ['walk-right', 'Walk right'],
  ['turn-left', 'Turn body left'],
  ['turn-right', 'Turn body right'],
  ['jump', 'Happy jump'],
  ['fold', 'Fold arms'],
  ['dizzy', 'Dizzy reaction'],
  ['stand', 'Stand up'],
]
const falls = [
  ['balance', 'Lose balance'],
  ['fall', 'Fall from here'],
  ['drop', 'Drop test'],
  ['platform', 'Stand on platform'],
  ['fall-front', 'Forward fall'],
  ['fall-back', 'Backward fall'],
  ['fall-left', 'Left-side fall'],
  ['fall-right', 'Right-side fall'],
]

function Actions({ values }: { values: string[][] }) {
  return (
    <div className="presets">
      {values.map(([key, label]) => (
        <button key={key} type="button" data-movement-action={key}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function MovementControls() {
  return (
    <>
      <fieldset className="controls">
        <legend>Movement</legend>
        <Actions values={moves} />
        <div className="emotion-status">
          <span>Movement</span>
          <output data-movement-output="state">idle</output>
        </div>
        <div className="emotion-status">
          <span>Grounded</span>
          <output data-movement-output="grounded">Yes</output>
        </div>
        <div className="emotion-status">
          <span>Physics</span>
          <output data-movement-output="physics">Animation</output>
        </div>
        <div className="emotion-status">
          <span>Landing orientation</span>
          <output data-movement-output="rest">–</output>
        </div>
        <details className="emotion-timing">
          <summary>Movement settings</summary>
          <Settings group="motion" values={motion} />
        </details>
      </fieldset>
      <details className="emotion-timing">
        <summary>Fall and collision tests</summary>
        <Actions values={falls} />
        <label className="emotion-setting">
          Show physics colliders <input type="checkbox" data-robot-debug />
        </label>
        <Settings group="physics" values={physics} />
      </details>
      <details className="emotion-timing">
        <summary>Head tracking</summary>
        <label className="emotion-setting">
          Enable cursor tracking{' '}
          <input type="checkbox" data-tracking-toggle defaultChecked />
        </label>
        <div className="emotion-status">
          <span>
            Yaw <output data-movement-output="yaw">0°</output>
          </span>
          <span>
            Pitch <output data-movement-output="pitch">0°</output>
          </span>
        </div>
        <Settings group="tracking" values={tracking} />
      </details>
    </>
  )
}
