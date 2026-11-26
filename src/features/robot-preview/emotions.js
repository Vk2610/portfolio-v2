const priority = { neutral: 0, happy: 1, angry: 2, dizzy: 3 }
export const emotionNames = ['neutral', 'happy', 'dizzy', 'angry']
export const emotionDefaults = {
  interactionWindow: 5000,
  happy: 2000,
  angry: 3000,
  dizzy: 3000,
  transition: 275,
}

const ease = (t) => t * t * (3 - 2 * t)
const clamp = (t) => Math.min(1, Math.max(0, t))

export function createEmotionController({
  now,
  random = Math.random,
  onChange = () => {},
}) {
  let settings = { ...emotionDefaults }
  let current = 'neutral'
  let previous = current
  let count = 0
  let windowStart = Infinity
  let endsAt = Infinity
  let transitionStarted = -Infinity
  let transitionDuration = settings.transition
  let weightsFrom = [1, 0, 0, 0]
  const nextBlink = (time) => time + 3200 + random() * 3600
  let blinkAt = nextBlink(now())

  function weights(time) {
    const amount = ease(clamp((time - transitionStarted) / transitionDuration))
    return emotionNames.map(
      (name, index) =>
        weightsFrom[index] * (1 - amount) + (name === current ? amount : 0),
    )
  }

  function change(emotion, time) {
    if (current !== emotion) {
      weightsFrom = weights(time)
      transitionStarted = time
      transitionDuration = settings.transition
      previous = current
      current = emotion
      if (emotion === 'neutral') blinkAt = nextBlink(time)
    }
    endsAt = emotion === 'neutral' ? Infinity : time + settings[emotion]
  }

  function tick(time) {
    if (time >= endsAt) change('neutral', time)
    if (time >= windowStart + settings.interactionWindow) {
      count = 0
      windowStart = Infinity
    }
    if (time >= blinkAt + 155) blinkAt = nextBlink(time)
  }

  function setEmotion(emotion, { override = false } = {}) {
    const time = now()
    tick(time)
    if (
      emotionNames.includes(emotion) &&
      (override || priority[emotion] >= priority[current])
    ) {
      change(emotion, time)
    }
    onChange()
  }

  function registerInteraction() {
    const time = now()
    tick(time)
    if (count === 0) windowStart = time
    count++
    if (current === 'dizzy') {
      onChange()
      return
    }
    if (count >= 7 || current === 'angry') change('angry', time)
    else if (count <= 2 || current === 'happy') change('happy', time)
    onChange()
  }

  function resetEmotion() {
    count = 0
    windowStart = Infinity
    change('neutral', now())
    onChange()
  }

  function frame(time = now(), reduced = false) {
    tick(time)
    const mix = reduced
      ? emotionNames.map((name) => Number(name === current))
      : weights(time)
    const blinkTime = time - blinkAt
    const blinking =
      !reduced && current === 'neutral' && blinkTime >= 0 && blinkTime < 155
    const blink = blinking
      ? 1 - 0.96 * Math.sin((Math.PI * blinkTime) / 155) ** 1.6
      : 1
    return {
      current,
      previous,
      count,
      mix,
      blink,
      moving:
        !reduced &&
        (blinking ||
          time < transitionStarted + transitionDuration ||
          mix[2] > 0),
      next: Math.min(
        endsAt,
        windowStart + settings.interactionWindow,
        !reduced && current === 'neutral' ? blinkAt : Infinity,
      ),
    }
  }

  return {
    setEmotion,
    registerInteraction,
    triggerDizzy: () => setEmotion('dizzy'),
    resetEmotion,
    getCurrentEmotion: () => frame().current,
    configure: (values) => {
      const time = now()
      tick(time)
      settings = { ...settings, ...values }
      tick(time)
      onChange()
    },
    frame,
  }
}
