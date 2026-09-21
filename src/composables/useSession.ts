import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { formatActionTarget } from '../lib/format'
import { HAPTIC_PATTERNS } from './useHaptics'
import type { Activity, PhaseAccent, SessionPhase, WorkoutStep } from '../lib/types'

export interface SessionHooks {
  speak: (text: string, onDone?: () => void) => void
  cancelSpeech: () => void
  vibrate: (pattern: number | readonly number[]) => void
  onSessionStart: () => void
  onSessionEnd: (status: 'completed' | 'stopped', completedSets: number) => void
}

/** How long the app waits for the spoken "一" before moving on, if speech never reports back. */
const FINAL_COUNT_TIMEOUT = 1800

export function useSession(
  routine: Ref<Activity[]>,
  startCountdownSeconds: Ref<number>,
  promptStartSeconds: Ref<number>,
  hooks: SessionHooks,
) {
  const phase = ref<SessionPhase>('idle')
  const isRunning = ref(false)
  const currentIndex = ref(0)
  const currentSetIndex = ref(0)
  const secondsLeft = ref(0)
  const restTotalSeconds = ref(0)
  const restLabel = ref('休息')
  const completedSets = ref(0)
  const elapsedSeconds = ref(0)
  const setElapsedSeconds = ref(0)

  let sessionActive = false
  let timerId: number | undefined
  let transitionTimerId: number | undefined
  const transitionPending = ref(false)

  const currentActivity = computed(() => routine.value[currentIndex.value])
  const totalSets = computed(() =>
    routine.value.reduce((total, activity) => total + activity.sets, 0),
  )
  const isManualAction = computed(
    () => phase.value === 'action' && currentActivity.value?.mode === 'reps',
  )
  const isActive = computed(() => phase.value !== 'idle')

  const accent = computed<PhaseAccent>(() => {
    if (phase.value === 'countdown') return 'prep'
    if (phase.value === 'rest') return 'rest'
    return 'work'
  })

  /** Fraction of the current phase still to run, 0–1. */
  const progress = computed(() => {
    if (phase.value === 'done') return 1
    const total =
      phase.value === 'countdown'
        ? startCountdownSeconds.value
        : phase.value === 'rest'
          ? restTotalSeconds.value
          : phase.value === 'action' && currentActivity.value?.mode === 'time'
            ? currentActivity.value.target
            : 0

    if (!total) return 0
    return Math.max(0, Math.min(1, secondsLeft.value / total))
  })

  function stepAt(index: number, setIndex: number): WorkoutStep | null {
    const activity = routine.value[index]
    if (!activity) return null

    if (setIndex + 1 < activity.sets) return { activity, index, setIndex: setIndex + 1 }

    const nextActivity = routine.value[index + 1]
    if (!nextActivity) return null
    return { activity: nextActivity, index: index + 1, setIndex: 0 }
  }

  const nextStep = computed(() => {
    if (phase.value === 'countdown' || phase.value === 'idle') {
      const first = routine.value[0]
      return first ? { activity: first, index: 0, setIndex: 0 } : null
    }
    return stepAt(currentIndex.value, currentSetIndex.value)
  })

  function restTransition(index: number, setIndex: number) {
    const activity = routine.value[index]
    const step = stepAt(index, setIndex)
    if (!activity || !step) return null

    const isSetRest = step.index === index
    return {
      step,
      label: isSetRest ? '组间休息' : '动作间休息',
      seconds: isSetRest ? activity.setRestSeconds : activity.nextRestSeconds,
    }
  }

  /** The rest that will follow the current set — shown as "下一步" while working. */
  const upcomingRest = computed(() => {
    if (phase.value !== 'action') return null
    return restTransition(currentIndex.value, currentSetIndex.value)
  })

  function shouldSpeakNumber(value: number) {
    return value <= promptStartSeconds.value && value > 1
  }

  function clearTransition() {
    if (transitionTimerId) window.clearTimeout(transitionTimerId)
    transitionTimerId = undefined
    transitionPending.value = false
  }

  function finishAfterFinalCountdown(next: () => void) {
    secondsLeft.value = 0
    transitionPending.value = true

    const run = () => {
      if (!transitionPending.value) return
      clearTransition()
      if (isRunning.value) next()
    }

    hooks.speak('一', run)
    transitionTimerId = window.setTimeout(run, FINAL_COUNT_TIMEOUT)
  }

  function countdownTick(onZero: () => void) {
    if (shouldSpeakNumber(secondsLeft.value)) hooks.speak(String(secondsLeft.value))

    if (secondsLeft.value > 1) secondsLeft.value -= 1
    else if (secondsLeft.value === 1) finishAfterFinalCountdown(onZero)
    else onZero()
  }

  function startTimer() {
    if (timerId) return

    timerId = window.setInterval(() => {
      if (!isRunning.value) return
      elapsedSeconds.value += 1
      if (phase.value === 'action') setElapsedSeconds.value += 1
      if (transitionPending.value) return

      if (phase.value === 'countdown') {
        countdownTick(() => startAction(0, 0))
        return
      }

      if (phase.value === 'rest') {
        countdownTick(startNextStep)
        return
      }

      if (phase.value === 'action' && currentActivity.value?.mode === 'time') {
        countdownTick(finishAction)
      }
    }, 1000)
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId)
    timerId = undefined
  }

  function startStartCountdown() {
    clearTransition()
    const first = routine.value[0]
    if (!first) {
      complete()
      return
    }

    currentIndex.value = 0
    currentSetIndex.value = 0
    phase.value = 'countdown'
    secondsLeft.value = startCountdownSeconds.value
    hooks.speak(`准备，${startCountdownSeconds.value}秒后开始，第一个动作是${first.name}`)
  }

  function startAction(index: number, setIndex = 0) {
    clearTransition()
    const activity = routine.value[index]
    if (!activity) {
      complete()
      return
    }

    currentIndex.value = index
    currentSetIndex.value = Math.max(0, Math.min(activity.sets - 1, setIndex))
    phase.value = 'action'
    setElapsedSeconds.value = 0
    secondsLeft.value = activity.mode === 'time' ? activity.target : 0
    hooks.vibrate(HAPTIC_PATTERNS.go)
    hooks.speak(
      `${activity.name}，第${currentSetIndex.value + 1}组，${formatActionTarget(activity)}`,
    )
  }

  function startRest() {
    clearTransition()
    const transition = restTransition(currentIndex.value, currentSetIndex.value)
    if (!transition) {
      complete()
      return
    }

    if (transition.seconds <= 0) {
      startAction(transition.step.index, transition.step.setIndex)
      return
    }

    phase.value = 'rest'
    restTotalSeconds.value = transition.seconds
    restLabel.value = transition.label
    secondsLeft.value = transition.seconds
    hooks.vibrate(HAPTIC_PATTERNS.ease)
    hooks.speak(
      `${transition.label}${transition.seconds}秒，下个动作是${transition.step.activity.name}，第${transition.step.setIndex + 1}组，${formatActionTarget(transition.step.activity)}`,
    )
  }

  function startNextStep() {
    const step = stepAt(currentIndex.value, currentSetIndex.value)
    if (step) startAction(step.index, step.setIndex)
    else complete()
  }

  function finishAction() {
    completedSets.value += 1
    startRest()
  }

  function complete() {
    stopTimer()
    isRunning.value = false
    phase.value = 'done'
    secondsLeft.value = 0
    hooks.vibrate(HAPTIC_PATTERNS.finish)
    if (sessionActive) {
      sessionActive = false
      hooks.onSessionEnd('completed', completedSets.value)
    }
    hooks.speak('训练完成')
  }

  function start() {
    if (routine.value.length === 0) return

    clearTransition()
    completedSets.value = 0
    elapsedSeconds.value = 0
    setElapsedSeconds.value = 0
    isRunning.value = true
    sessionActive = true
    hooks.onSessionStart()

    if (startCountdownSeconds.value > 0) startStartCountdown()
    else startAction(0, 0)

    startTimer()
  }

  /** Clears the session. Reports it as stopped if one was under way. */
  function reset() {
    clearTransition()
    stopTimer()
    if (sessionActive) {
      sessionActive = false
      hooks.onSessionEnd('stopped', completedSets.value)
    }
    isRunning.value = false
    phase.value = 'idle'
    currentIndex.value = 0
    currentSetIndex.value = 0
    secondsLeft.value = 0
    restTotalSeconds.value = 0
    restLabel.value = '休息'
    elapsedSeconds.value = 0
    setElapsedSeconds.value = 0
    hooks.cancelSpeech()
  }

  function togglePause() {
    if (phase.value === 'done') {
      reset()
      start()
      return
    }

    if (phase.value === 'idle') {
      start()
      return
    }

    isRunning.value = !isRunning.value
    if (isRunning.value) startTimer()
    else hooks.cancelSpeech()
  }

  function skip() {
    if (phase.value === 'countdown') {
      startAction(0, 0)
      return
    }
    if (phase.value === 'action') {
      finishAction()
      return
    }
    if (phase.value === 'rest') {
      clearTransition()
      startNextStep()
    }
  }

  /** Lengthen or shorten the rest you are currently in. */
  function adjustRest(delta: number) {
    if (phase.value !== 'rest') return
    clearTransition()
    const next = Math.max(0, Math.min(3600, secondsLeft.value + delta))
    secondsLeft.value = next
    restTotalSeconds.value = Math.max(restTotalSeconds.value, next)
    hooks.vibrate(HAPTIC_PATTERNS.tick)
  }

  onBeforeUnmount(() => {
    stopTimer()
    clearTransition()
  })

  return {
    phase,
    isRunning,
    isActive,
    accent,
    currentIndex,
    currentSetIndex,
    currentActivity,
    secondsLeft,
    restTotalSeconds,
    restLabel,
    completedSets,
    totalSets,
    elapsedSeconds,
    setElapsedSeconds,
    progress,
    nextStep,
    upcomingRest,
    isManualAction,
    start,
    reset,
    togglePause,
    skip,
    adjustRest,
  }
}
