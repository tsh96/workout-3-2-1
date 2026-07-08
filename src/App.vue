<script setup lang="ts">
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  GripVertical,
  History,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-vue-next'
import {
  NButton,
  NConfigProvider,
  NInput,
  NInputNumber,
  NModal,
  NProgress,
  NSelect,
  NSwitch,
  NTooltip,
  darkTheme,
} from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ObjectDirective } from 'vue'

type ActivityMode = 'reps' | 'time'
type AppPage = 'workout' | 'settings' | 'history'
type SessionPhase = 'idle' | 'countdown' | 'action' | 'rest' | 'done'
type WorkoutLogStatus = 'started' | 'completed' | 'stopped'
type DeleteTargetKind = 'plan' | 'activity' | 'history'
type ThemeMode = 'system' | 'light' | 'dark'

interface Activity {
  id: string
  name: string
  mode: ActivityMode
  sets: number
  target: number
  setRestSeconds: number
  nextRestSeconds: number
}

interface WorkoutPlan {
  id: string
  name: string
  startCountdownSeconds: number
  routine: Activity[]
}

interface WorkoutPlanSnapshot {
  name: string
  startCountdownSeconds: number
  routine: Activity[]
}

interface WorkoutSessionLog {
  id: string
  planId: string
  planName: string
  startedAt: string
  completedAt?: string
  status: WorkoutLogStatus
  plan: WorkoutPlanSnapshot
}

interface StoredState {
  activePlanId?: string
  plans?: WorkoutPlan[]
  history?: WorkoutSessionLog[]
  voiceId?: string
  themeMode?: ThemeMode
  startCountdownSeconds?: number
  restSeconds?: number
  routine?: Activity[]
}

interface DeleteTarget {
  kind: DeleteTargetKind
  id: string
  title: string
  description: string
  confirmLabel: string
}

const STORAGE_KEY = 'workout-3-2-1-state'
const DEFAULT_REST_SECONDS = 30

const themeModeOptions = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

const modeOptions = [
  { label: '计次', value: 'reps' },
  { label: '计时', value: 'time' },
]

const defaultRoutine: Activity[] = [
  { id: 'squat', name: '深蹲', mode: 'reps', sets: 1, target: 15, setRestSeconds: 30, nextRestSeconds: 30 },
  { id: 'plank', name: '平板支撑', mode: 'time', sets: 1, target: 45, setRestSeconds: 30, nextRestSeconds: 30 },
  { id: 'pushup', name: '俯卧撑', mode: 'reps', sets: 1, target: 12, setRestSeconds: 30, nextRestSeconds: 30 },
  { id: 'mountain', name: '登山跑', mode: 'time', sets: 1, target: 30, setRestSeconds: 30, nextRestSeconds: 30 },
]

const stepperButtonHandlers = new WeakMap<HTMLButtonElement, EventListener>()

function bindStepperButtons(el: HTMLElement) {
  el.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if (stepperButtonHandlers.has(button)) return

    const handleMouseDown: EventListener = (event) => {
      event.preventDefault()
      event.stopPropagation()
      el.querySelector<HTMLInputElement>('input')?.blur()
    }

    stepperButtonHandlers.set(button, handleMouseDown)
    button.addEventListener('mousedown', handleMouseDown, { capture: true })
  })
}

function unbindStepperButtons(el: HTMLElement) {
  el.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const handler = stepperButtonHandlers.get(button)
    if (!handler) return

    button.removeEventListener('mousedown', handler, { capture: true })
    stepperButtonHandlers.delete(button)
  })
}

const vNoStepperFocus: ObjectDirective<HTMLElement> = {
  mounted: bindStepperButtons,
  updated: bindStepperButtons,
  unmounted: unbindStepperButtons,
}

function createId(prefix: string) {
  if ('randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cloneActivities(activities: Activity[]) {
  return activities.map((activity) => ({ ...activity }))
}

function normalizeSets(value: unknown) {
  return Math.max(1, Math.min(99, Math.round(Number(value) || 1)))
}

function normalizeRestDuration(value: unknown, fallback = 30) {
  const numeric = Number(value)
  const seconds = Number.isFinite(numeric) ? numeric : fallback
  return Math.max(0, Math.min(600, Math.round(seconds)))
}

function normalizeActivity(activity: Partial<Activity>, index: number, fallbackRestSeconds = 30): Activity {
  const mode: ActivityMode = activity.mode === 'time' ? 'time' : 'reps'

  return {
    id: activity.id || createId(`activity-${index + 1}`),
    name: String(activity.name || `动作 ${index + 1}`),
    mode,
    sets: normalizeSets(activity.sets),
    target: Math.max(1, Number(activity.target) || 1),
    setRestSeconds: normalizeRestDuration(activity.setRestSeconds, fallbackRestSeconds),
    nextRestSeconds: normalizeRestDuration(activity.nextRestSeconds, fallbackRestSeconds),
  }
}

function normalizeRoutine(routine: unknown, fallbackRestSeconds = 30): Activity[] {
  if (!Array.isArray(routine) || routine.length === 0) {
    return defaultRoutine.map((activity) => ({
      ...activity,
      setRestSeconds: fallbackRestSeconds,
      nextRestSeconds: fallbackRestSeconds,
    }))
  }

  return routine.map((activity, index) =>
    normalizeActivity(activity as Partial<Activity>, index, fallbackRestSeconds),
  )
}

function normalizeStartCountdown(value: unknown, fallback = 5) {
  const numeric = Number(value)
  const seconds = Number.isFinite(numeric) ? numeric : fallback
  return Math.max(0, Math.min(60, Math.round(seconds)))
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function createPlan(
  name: string,
  routine: Activity[] = defaultRoutine,
  startCountdownSeconds = 5,
): WorkoutPlan {
  return {
    id: createId('plan'),
    name,
    startCountdownSeconds: normalizeStartCountdown(startCountdownSeconds),
    routine: normalizeRoutine(routine, DEFAULT_REST_SECONDS),
  }
}

function normalizePlan(plan: Partial<WorkoutPlan>, index: number): WorkoutPlan {
  const legacyRestSeconds = normalizeRestDuration((plan as { restSeconds?: unknown }).restSeconds, DEFAULT_REST_SECONDS)

  return {
    id: plan.id || createId(`plan-${index + 1}`),
    name: String(plan.name || `计划 ${index + 1}`),
    startCountdownSeconds: normalizeStartCountdown(plan.startCountdownSeconds),
    routine: normalizeRoutine(plan.routine, legacyRestSeconds),
  }
}

function toIsoDate(value: unknown) {
  const timestamp = Date.parse(String(value || ''))
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function normalizeHistory(history: unknown): WorkoutSessionLog[] {
  if (!Array.isArray(history)) return []

  return history
    .map((entry, index): WorkoutSessionLog | null => {
      const log = entry as Partial<WorkoutSessionLog>
      const startedAt = toIsoDate(log.startedAt)
      if (!startedAt) return null

      const completedAt = toIsoDate(log.completedAt)
      const status: WorkoutLogStatus =
        log.status === 'completed' || log.status === 'stopped' ? log.status : 'started'
      const snapshot = log.plan as Partial<WorkoutPlanSnapshot> | undefined
      const legacyRestSeconds = normalizeRestDuration(
        (snapshot as { restSeconds?: unknown } | undefined)?.restSeconds,
        DEFAULT_REST_SECONDS,
      )

      const normalizedLog: WorkoutSessionLog = {
        id: log.id || createId(`session-${index + 1}`),
        planId: String(log.planId || ''),
        planName: String(log.planName || snapshot?.name || '未命名计划'),
        startedAt,
        status,
        plan: {
          name: String(snapshot?.name || log.planName || '未命名计划'),
          startCountdownSeconds: normalizeStartCountdown(snapshot?.startCountdownSeconds, 0),
          routine: normalizeRoutine(snapshot?.routine, legacyRestSeconds),
        },
      }

      if (completedAt) normalizedLog.completedAt = completedAt
      return normalizedLog
    })
    .filter((entry): entry is WorkoutSessionLog => entry !== null)
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      const defaultPlan = createPlan('基础循环', defaultRoutine)
      return { activePlanId: defaultPlan.id, plans: [defaultPlan], history: [], voiceId: '', themeMode: 'system' }
    }

    const parsed = JSON.parse(saved) as StoredState
    const savedPlans =
      Array.isArray(parsed.plans) && parsed.plans.length > 0
        ? parsed.plans
        : [
            createPlan(
              '基础循环',
              normalizeRoutine(parsed.routine, normalizeRestDuration(parsed.restSeconds, DEFAULT_REST_SECONDS)),
              parsed.startCountdownSeconds,
            ),
          ]
    const plans = savedPlans.map((plan, index) => normalizePlan(plan, index))
    const activePlanId = plans.some((plan) => plan.id === parsed.activePlanId)
      ? parsed.activePlanId
      : plans[0]?.id

    return {
      activePlanId: activePlanId ?? plans[0].id,
      plans,
      history: normalizeHistory(parsed.history),
      voiceId: String(parsed.voiceId || ''),
      themeMode: normalizeThemeMode(parsed.themeMode),
    }
  } catch {
    const defaultPlan = createPlan('基础循环', defaultRoutine)
    return { activePlanId: defaultPlan.id, plans: [defaultPlan], history: [], voiceId: '', themeMode: 'system' }
  }
}

const savedState = loadState()
const activePlanId = ref(savedState.activePlanId)
const plans = ref<WorkoutPlan[]>(savedState.plans)
const workoutHistory = ref<WorkoutSessionLog[]>(savedState.history)
const selectedVoiceId = ref(savedState.voiceId)
const themeMode = ref<ThemeMode>(normalizeThemeMode(savedState.themeMode))
const availableVoices = ref<SpeechSynthesisVoice[]>([])
const phase = ref<SessionPhase>('idle')
const currentPage = ref<AppPage>(getPageFromHash())
const isRunning = ref(false)
const currentIndex = ref(0)
const currentSetIndex = ref(0)
const secondsLeft = ref(0)
const currentRestSeconds = ref(0)
const currentRestLabel = ref('休息')
const voiceEnabled = ref(true)
const draggingActivityId = ref<string | null>(null)
const dragOverActivityId = ref<string | null>(null)
const activeWorkoutLogId = ref<string | null>(null)
const isCountdownTransitionPending = ref(false)
const isPlanNameModalOpen = ref(false)
const planNameDraft = ref('')
const editingPlanId = ref<string | null>(null)
const isDeleteConfirmOpen = ref(false)
const pendingDeleteTarget = ref<DeleteTarget | null>(null)
const systemPrefersDark = ref(false)

let timerId: number | undefined
let speechTimerId: number | undefined
let countdownTransitionTimerId: number | undefined
let colorSchemeMediaQuery: MediaQueryList | undefined

const themeOverrides = {
  common: {
    borderRadius: '8px',
    borderRadiusSmall: '8px',
    primaryColor: '#0f766e',
    primaryColorHover: '#115e59',
    primaryColorPressed: '#134e4a',
    primaryColorSuppl: '#14b8a6',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  Button: {
    heightLarge: '52px',
    borderRadiusLarge: '8px',
  },
}

const currentPlan = computed(() => plans.value.find((plan) => plan.id === activePlanId.value) ?? plans.value[0])
const planOptions = computed(() => plans.value.map((plan) => ({ label: plan.name || '未命名计划', value: plan.id })))
const resolvedThemeMode = computed<'light' | 'dark'>(() =>
  themeMode.value === 'system' ? (systemPrefersDark.value ? 'dark' : 'light') : themeMode.value,
)
const isDarkTheme = computed(() => resolvedThemeMode.value === 'dark')
const naiveTheme = computed(() => (isDarkTheme.value ? darkTheme : null))
const progressRailColor = computed(() => (isDarkTheme.value ? '#164e4a' : '#d7e8e3'))
const voiceOptions = computed(() => [
  { label: '自动选择', value: '' },
  ...availableVoices.value
    .filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
    .map((voice) => ({
      label: `${voice.name} · ${voice.lang}`,
      value: voice.voiceURI,
    })),
])
const canEditPlan = computed(() => phase.value === 'idle' || phase.value === 'done')
const startCountdownSeconds = computed({
  get: () => currentPlan.value?.startCountdownSeconds ?? 5,
  set: (value: number | null) => {
    if (!currentPlan.value) return
    currentPlan.value.startCountdownSeconds = normalizeStartCountdown(value)
  },
})
const routine = computed({
  get: () => currentPlan.value?.routine ?? [],
  set: (value: Activity[]) => {
    if (!currentPlan.value) return
    currentPlan.value.routine = value
  },
})
const currentActivity = computed(() => routine.value[currentIndex.value])
const currentSetNumber = computed(() => currentSetIndex.value + 1)
const currentSetTotal = computed(() => currentActivity.value?.sets ?? 1)
const currentProgressText = computed(() => {
  if (routine.value.length === 0) return '0/0'
  return `${currentIndex.value + 1}/${routine.value.length} · ${currentSetNumber.value}/${currentSetTotal.value} 组`
})
const totalForPhase = computed(() => {
  if (phase.value === 'countdown') return startCountdownSeconds.value
  if (phase.value === 'rest') return currentRestSeconds.value
  if (phase.value === 'action' && currentActivity.value?.mode === 'time') return currentActivity.value.target
  return 0
})

const progressPercentage = computed(() => {
  if (!totalForPhase.value) return phase.value === 'done' ? 100 : 0
  return Math.max(0, Math.min(100, Math.round((secondsLeft.value / totalForPhase.value) * 100)))
})

const displayNumber = computed(() => {
  if (phase.value === 'countdown') return secondsLeft.value
  if (phase.value === 'idle') return startCountdownSeconds.value
  if (phase.value === 'rest') return secondsLeft.value
  if (phase.value === 'action' && currentActivity.value?.mode === 'time') return secondsLeft.value
  if (phase.value === 'action') return currentActivity.value?.target ?? 0
  return 0
})

const displayUnit = computed(() => {
  if (phase.value === 'action' && currentActivity.value?.mode === 'reps') return '次'
  return '秒'
})

const statusTitle = computed(() => {
  if (phase.value === 'done') return '训练完成'
  if (phase.value === 'countdown') return '准备'
  if (phase.value === 'rest') return '休息'
  if (phase.value === 'action') return currentActivity.value?.name ?? '动作'
  return '准备开始'
})

const currentText = computed(() => {
  if (phase.value === 'countdown') {
    const activity = routine.value[0]
    return activity ? `即将开始 ${activity.name} · ${formatSetTarget(activity, 0)}` : '暂无动作'
  }
  if (phase.value === 'rest') return `${currentRestLabel.value} ${currentRestSeconds.value} 秒`
  if (phase.value === 'done') return '已完成'
  const activity = phase.value === 'idle' ? routine.value[0] : currentActivity.value
  return activity ? `${activity.name} · ${formatSetTarget(activity, phase.value === 'idle' ? 0 : currentSetIndex.value)}` : '暂无动作'
})

const nextText = computed(() => {
  const step =
    phase.value === 'countdown'
      ? { activity: routine.value[0], setIndex: 0 }
      : phase.value === 'idle'
        ? getNextWorkoutStep(0, 0)
        : getNextWorkoutStep(currentIndex.value, currentSetIndex.value)
  return step?.activity ? `${step.activity.name} · ${formatSetTarget(step.activity, step.setIndex)}` : '没有下一个动作'
})

const primaryLabel = computed(() => {
  if (phase.value === 'done') return '再来一轮'
  if (isRunning.value) return '暂停'
  if (phase.value === 'idle') return '开始'
  return '继续'
})

const sessionStateLabel = computed(() => {
  if (phase.value === 'idle') return '待开始'
  if (phase.value === 'done') return '完成'
  return isRunning.value ? '进行中' : '已暂停'
})

const canSkip = computed(() => phase.value === 'countdown' || phase.value === 'action' || phase.value === 'rest')
const isManualAction = computed(() => phase.value === 'action' && currentActivity.value?.mode === 'reps')
const timerLabel = computed(() => {
  if (phase.value === 'countdown' || phase.value === 'idle') return '开始倒计时'
  return isManualAction.value ? '目标' : '倒计时'
})
const isDraggingActivity = computed(() => draggingActivityId.value !== null)

watch(
  [activePlanId, plans, workoutHistory, selectedVoiceId, themeMode],
  () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activePlanId: activePlanId.value,
        plans: plans.value,
        history: workoutHistory.value,
        voiceId: selectedVoiceId.value,
        themeMode: themeMode.value,
        startCountdownSeconds: startCountdownSeconds.value,
      }),
    )
  },
  { deep: true },
)

watch(activePlanId, () => {
  resetSession()
})

watch(
  isDarkTheme,
  (enabled) => {
    document.documentElement.classList.toggle('dark', enabled)
    document.documentElement.style.colorScheme = enabled ? 'dark' : 'light'
  },
  { immediate: true },
)

function getPageFromHash(): AppPage {
  if (window.location.hash === '#settings') return 'settings'
  if (window.location.hash === '#history') return 'history'
  return 'workout'
}

function formatActionTarget(activity: Activity) {
  return `${activity.target} ${activity.mode === 'reps' ? '次' : '秒'}`
}

function formatSetTarget(activity: Activity, setIndex: number) {
  const setText = activity.sets > 1 ? `第 ${setIndex + 1}/${activity.sets} 组` : '第 1 组'
  return `${setText} · ${formatActionTarget(activity)}`
}

function formatActivityTarget(activity: Activity) {
  return `${activity.sets} 组 × ${formatActionTarget(activity)}`
}

function formatActivityRest(activity: Activity, isLastActivity: boolean) {
  const nextRestText = isLastActivity ? '动作间 -' : `动作间 ${activity.nextRestSeconds} 秒`
  return `组间 ${activity.setRestSeconds} 秒 · ${nextRestText}`
}

function getNextWorkoutStep(index: number, setIndex: number) {
  const activity = routine.value[index]
  if (!activity) return null

  if (setIndex + 1 < activity.sets) {
    return { activity, index, setIndex: setIndex + 1 }
  }

  const nextIndex = index + 1
  const nextActivityInRoutine = routine.value[nextIndex]
  if (!nextActivityInRoutine) return null

  return { activity: nextActivityInRoutine, index: nextIndex, setIndex: 0 }
}

function getRestTransition(index: number, setIndex: number) {
  const activity = routine.value[index]
  const nextStep = getNextWorkoutStep(index, setIndex)
  if (!activity || !nextStep) return null

  const isSetRest = nextStep.index === index
  return {
    nextStep,
    label: isSetRest ? '组间休息' : '动作间休息',
    seconds: isSetRest ? activity.setRestSeconds : activity.nextRestSeconds,
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(log: WorkoutSessionLog) {
  if (!log.completedAt) return '进行记录'

  const seconds = Math.max(0, Math.round((Date.parse(log.completedAt) - Date.parse(log.startedAt)) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes <= 0) return `${remainder} 秒`
  return `${minutes} 分 ${remainder} 秒`
}

function statusText(status: WorkoutLogStatus) {
  if (status === 'completed') return '已完成'
  if (status === 'stopped') return '已停止'
  return '已开始'
}

function syncPageFromHash() {
  currentPage.value = getPageFromHash()
  stopActivityDrag()
}

function openSettings() {
  stopActivityDrag()
  if (window.location.hash === '#settings') {
    currentPage.value = 'settings'
    return
  }

  window.location.hash = 'settings'
}

function openHistory() {
  stopActivityDrag()
  if (window.location.hash === '#history') {
    currentPage.value = 'history'
    return
  }

  window.location.hash = 'history'
}

function closePanel() {
  stopActivityDrag()
  currentPage.value = 'workout'

  if (window.location.hash === '#settings' || window.location.hash === '#history') {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
  }
}

function loadAvailableVoices() {
  if (!('speechSynthesis' in window)) return
  availableVoices.value = window.speechSynthesis.getVoices()
}

function scoreVoice(voice: SpeechSynthesisVoice) {
  const lang = voice.lang.toLowerCase()
  const name = voice.name.toLowerCase()
  let score = 0

  if (lang === 'zh-cn') score += 80
  else if (lang.includes('hans')) score += 70
  else if (lang === 'zh-sg') score += 60
  else if (lang === 'zh-tw') score += 45
  else if (lang === 'zh-hk') score += 30
  else if (lang.startsWith('zh')) score += 25

  if (name.includes('siri')) score += 45
  if (name.includes('yu-shu') || name.includes('yushu')) score += 40
  if (name.includes('google')) score += 35
  if (name.includes('ting-ting') || name.includes('tingting')) score += 30
  if (name.includes('mandarin') || name.includes('普通话') || name.includes('普通話')) score += 20
  if (name.includes('compact')) score -= 35
  if (voice.localService) score += 5

  return score
}

function getPreferredVoice() {
  const selectedVoice = availableVoices.value.find((voice) => voice.voiceURI === selectedVoiceId.value)
  if (selectedVoice) return selectedVoice

  const [bestVoice] = [...availableVoices.value]
    .filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
    .sort((first, second) => scoreVoice(second) - scoreVoice(first))

  return bestVoice
}

function speak(text: string, onDone?: () => void) {
  if (!voiceEnabled.value || !('speechSynthesis' in window)) {
    onDone?.()
    return
  }

  if (speechTimerId) window.clearTimeout(speechTimerId)

  const synth = window.speechSynthesis
  if (availableVoices.value.length === 0) loadAvailableVoices()

  const voice = getPreferredVoice()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice ?? null
  utterance.lang = voice?.lang ?? 'zh-CN'
  utterance.rate = 0.92
  utterance.pitch = 1.04
  utterance.volume = 1

  let hasFinished = false
  const finish = () => {
    if (hasFinished) return
    hasFinished = true
    onDone?.()
  }

  utterance.onend = finish
  utterance.onerror = finish

  const play = () => {
    synth.resume()
    synth.speak(utterance)
  }

  if (synth.speaking || synth.pending) {
    synth.cancel()
    speechTimerId = window.setTimeout(play, 80)
    return
  }

  play()
}

function clearCountdownTransition() {
  if (countdownTransitionTimerId) window.clearTimeout(countdownTransitionTimerId)
  countdownTransitionTimerId = undefined
  isCountdownTransitionPending.value = false
}

function finishAfterFinalCountdown(next: () => void) {
  secondsLeft.value = 0
  isCountdownTransitionPending.value = true

  const runNext = () => {
    if (!isCountdownTransitionPending.value) return
    clearCountdownTransition()
    if (isRunning.value) next()
  }

  speak('一', runNext)
  countdownTransitionTimerId = window.setTimeout(runNext, 1800)
}

function startTimer() {
  if (timerId) return

  timerId = window.setInterval(() => {
    if (!isRunning.value) return
    if (isCountdownTransitionPending.value) return

    if (phase.value === 'countdown') {
      if (secondsLeft.value <= 3 && secondsLeft.value > 1) {
        speak(String(secondsLeft.value))
      }

      if (secondsLeft.value > 1) {
        secondsLeft.value -= 1
      } else if (secondsLeft.value === 1) {
        finishAfterFinalCountdown(() => startAction(0, 0))
      } else {
        startAction(0, 0)
      }
      return
    }

    if (phase.value === 'rest') {
      if (secondsLeft.value <= 3 && secondsLeft.value > 1) {
        speak(String(secondsLeft.value))
      }

      if (secondsLeft.value > 1) {
        secondsLeft.value -= 1
      } else if (secondsLeft.value === 1) {
        finishAfterFinalCountdown(startNextStep)
      } else {
        startNextStep()
      }
      return
    }

    if (phase.value === 'action' && currentActivity.value?.mode === 'time') {
      if (secondsLeft.value <= 3 && secondsLeft.value > 1) {
        speak(String(secondsLeft.value))
      }

      if (secondsLeft.value > 1) {
        secondsLeft.value -= 1
      } else if (secondsLeft.value === 1) {
        finishAfterFinalCountdown(finishAction)
      } else {
        finishAction()
      }
    }
  }, 1000)
}

function togglePrimary() {
  if (phase.value === 'done') {
    resetSession()
    beginSession()
    return
  }

  if (phase.value === 'idle') {
    beginSession()
    return
  }

  isRunning.value = !isRunning.value
  if (isRunning.value) startTimer()
}

function beginSession() {
  if (routine.value.length === 0 || !currentPlan.value) return
  isRunning.value = true
  recordWorkoutStart()
  if (startCountdownSeconds.value > 0) {
    startStartCountdown()
  } else {
    startAction(0, 0)
  }
  startTimer()
}

function startStartCountdown() {
  clearCountdownTransition()
  const firstActivity = routine.value[0]
  if (!firstActivity) {
    completeSession()
    return
  }

  currentIndex.value = 0
  currentSetIndex.value = 0
  phase.value = 'countdown'
  secondsLeft.value = startCountdownSeconds.value
  speak(`准备，${startCountdownSeconds.value}秒后开始，第一个动作是${firstActivity.name}`)
}

function startAction(index: number, setIndex = 0) {
  clearCountdownTransition()
  const activity = routine.value[index]
  if (!activity) {
    completeSession()
    return
  }

  currentIndex.value = index
  currentSetIndex.value = Math.max(0, Math.min(activity.sets - 1, setIndex))
  phase.value = 'action'
  secondsLeft.value = activity.mode === 'time' ? activity.target : 0
  speak(`${activity.name}，第${currentSetIndex.value + 1}组，${formatActionTarget(activity)}`)
}

function startRest() {
  clearCountdownTransition()
  const transition = getRestTransition(currentIndex.value, currentSetIndex.value)
  if (!transition) {
    completeSession()
    return
  }

  if (transition.seconds <= 0) {
    startAction(transition.nextStep.index, transition.nextStep.setIndex)
    return
  }

  phase.value = 'rest'
  currentRestSeconds.value = transition.seconds
  currentRestLabel.value = transition.label
  secondsLeft.value = transition.seconds
  speak(
    `${transition.label}${transition.seconds}秒，下个动作是${transition.nextStep.activity.name}，第${transition.nextStep.setIndex + 1}组，${formatActionTarget(transition.nextStep.activity)}`,
  )
}

function startNextStep() {
  const nextStep = getNextWorkoutStep(currentIndex.value, currentSetIndex.value)
  if (nextStep) {
    startAction(nextStep.index, nextStep.setIndex)
  } else {
    completeSession()
  }
}

function finishAction() {
  startRest()
}

function skipCurrent() {
  if (phase.value === 'countdown') {
    startAction(0, 0)
    return
  }

  if (phase.value === 'action') {
    finishAction()
    return
  }

  if (phase.value === 'rest') {
    startNextStep()
  }
}

function resetSession() {
  clearCountdownTransition()
  stopActiveWorkoutLog('stopped')
  isRunning.value = false
  phase.value = 'idle'
  currentIndex.value = 0
  currentSetIndex.value = 0
  secondsLeft.value = 0
  currentRestSeconds.value = 0
  currentRestLabel.value = '休息'
  if (speechTimerId) window.clearTimeout(speechTimerId)
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

function completeSession() {
  isRunning.value = false
  phase.value = 'done'
  secondsLeft.value = 0
  stopActiveWorkoutLog('completed')
  speak('训练完成')
}

function recordWorkoutStart() {
  const plan = currentPlan.value
  if (!plan) return

  const log: WorkoutSessionLog = {
    id: createId('session'),
    planId: plan.id,
    planName: plan.name || '未命名计划',
    startedAt: new Date().toISOString(),
    status: 'started',
    plan: {
      name: plan.name || '未命名计划',
      startCountdownSeconds: plan.startCountdownSeconds,
      routine: cloneActivities(plan.routine),
    },
  }

  activeWorkoutLogId.value = log.id
  workoutHistory.value = [log, ...workoutHistory.value].slice(0, 100)
}

function stopActiveWorkoutLog(status: Exclude<WorkoutLogStatus, 'started'>) {
  const logId = activeWorkoutLogId.value
  if (!logId) return

  const log = workoutHistory.value.find((entry) => entry.id === logId)
  if (log && log.status === 'started') {
    log.status = status
    log.completedAt = new Date().toISOString()
  }

  activeWorkoutLogId.value = null
}

function addPlan() {
  const plan = createPlan(`计划 ${plans.value.length + 1}`)
  plans.value.push(plan)
  activePlanId.value = plan.id
}

function openPlanNameModal() {
  const plan = currentPlan.value
  if (!plan || !canEditPlan.value) return

  editingPlanId.value = plan.id
  planNameDraft.value = plan.name || ''
  isPlanNameModalOpen.value = true
}

function closePlanNameModal() {
  isPlanNameModalOpen.value = false
  editingPlanId.value = null
  planNameDraft.value = ''
}

function savePlanName() {
  if (!editingPlanId.value) return

  const plan = plans.value.find((entry) => entry.id === editingPlanId.value)
  if (!plan) {
    closePlanNameModal()
    return
  }

  plan.name = planNameDraft.value.trim() || '未命名计划'
  closePlanNameModal()
}

function duplicateCurrentPlan() {
  const plan = currentPlan.value
  if (!plan) return

  const duplicatedPlan = createPlan(
    `${plan.name || '未命名计划'} 副本`,
    plan.routine,
    plan.startCountdownSeconds,
  )
  plans.value.push(duplicatedPlan)
  activePlanId.value = duplicatedPlan.id
}

function openDeleteConfirm(target: DeleteTarget) {
  pendingDeleteTarget.value = target
  isDeleteConfirmOpen.value = true
}

function closeDeleteConfirm() {
  isDeleteConfirmOpen.value = false
  pendingDeleteTarget.value = null
}

function requestRemoveCurrentPlan() {
  if (plans.value.length <= 1 || !currentPlan.value || !canEditPlan.value) return

  openDeleteConfirm({
    kind: 'plan',
    id: currentPlan.value.id,
    title: '删除当前计划？',
    description: `计划「${currentPlan.value.name || '未命名计划'}」会被永久删除。`,
    confirmLabel: '删除计划',
  })
}

function removePlan(id: string) {
  if (plans.value.length <= 1) return

  const currentPlanIndex = plans.value.findIndex((plan) => plan.id === id)
  if (currentPlanIndex === -1) return

  plans.value = plans.value.filter((plan) => plan.id !== id)
  activePlanId.value = plans.value[Math.max(0, currentPlanIndex - 1)]?.id ?? plans.value[0]?.id
}

function addActivity() {
  routine.value = [
    ...routine.value,
    {
      id: createId('activity'),
      name: '新动作',
      mode: 'reps',
      sets: 1,
      target: 10,
      setRestSeconds: DEFAULT_REST_SECONDS,
      nextRestSeconds: DEFAULT_REST_SECONDS,
    },
  ]
}

function requestRemoveActivity(id: string) {
  if (routine.value.length <= 1) return
  const activity = routine.value.find((entry) => entry.id === id)
  if (!activity) return

  openDeleteConfirm({
    kind: 'activity',
    id,
    title: '删除动作？',
    description: `动作「${activity.name || '未命名动作'}」会从当前计划中删除。`,
    confirmLabel: '删除动作',
  })
}

function removeActivity(id: string) {
  if (routine.value.length <= 1) return
  routine.value = routine.value.filter((activity) => activity.id !== id)
  resetSession()
}

function requestDeleteHistoryEntry(id: string) {
  const log = workoutHistory.value.find((entry) => entry.id === id)
  if (!log) return

  openDeleteConfirm({
    kind: 'history',
    id,
    title: '删除训练记录？',
    description: `「${log.planName || '未命名计划'}」的这条训练记录会被永久删除。`,
    confirmLabel: '删除记录',
  })
}

function deleteHistoryEntry(id: string) {
  workoutHistory.value = workoutHistory.value.filter((entry) => entry.id !== id)
}

function confirmDelete() {
  const target = pendingDeleteTarget.value
  if (!target) return

  if (target.kind === 'plan') removePlan(target.id)
  else if (target.kind === 'activity') removeActivity(target.id)
  else deleteHistoryEntry(target.id)

  closeDeleteConfirm()
}

function startActivityDrag(event: PointerEvent, activityId: string) {
  if (!canEditPlan.value || routine.value.length <= 1) return

  event.preventDefault()
  draggingActivityId.value = activityId
  dragOverActivityId.value = activityId

  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    target.setPointerCapture?.(event.pointerId)
  }

  window.addEventListener('pointermove', handleActivityDragMove, { passive: false })
  window.addEventListener('pointerup', stopActivityDrag)
  window.addEventListener('pointercancel', stopActivityDrag)
}

function handleActivityDragMove(event: PointerEvent) {
  const draggingId = draggingActivityId.value
  if (!draggingId) return

  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-activity-id]')
  const targetId = target?.dataset.activityId
  if (!targetId || targetId === draggingId) return

  reorderActivity(draggingId, targetId)
  dragOverActivityId.value = targetId
}

function reorderActivity(draggingId: string, targetId: string) {
  const fromIndex = routine.value.findIndex((activity) => activity.id === draggingId)
  const toIndex = routine.value.findIndex((activity) => activity.id === targetId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

  const nextRoutine = [...routine.value]
  const [draggedActivity] = nextRoutine.splice(fromIndex, 1)
  if (!draggedActivity) return

  nextRoutine.splice(toIndex, 0, draggedActivity)
  routine.value = nextRoutine

  if (phase.value !== 'idle') resetSession()
}

function stopActivityDrag() {
  window.removeEventListener('pointermove', handleActivityDragMove)
  window.removeEventListener('pointerup', stopActivityDrag)
  window.removeEventListener('pointercancel', stopActivityDrag)
  draggingActivityId.value = null
  dragOverActivityId.value = null
}

function syncSystemThemePreference(event?: MediaQueryListEvent) {
  systemPrefersDark.value = event?.matches ?? colorSchemeMediaQuery?.matches ?? false
}

onMounted(() => {
  window.addEventListener('hashchange', syncPageFromHash)
  colorSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  syncSystemThemePreference()
  colorSchemeMediaQuery.addEventListener('change', syncSystemThemePreference)
  loadAvailableVoices()
  if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener('voiceschanged', loadAvailableVoices)
  }
})

onBeforeUnmount(() => {
  if (timerId) window.clearInterval(timerId)
  if (speechTimerId) window.clearTimeout(speechTimerId)
  clearCountdownTransition()
  if ('speechSynthesis' in window) {
    window.speechSynthesis.removeEventListener('voiceschanged', loadAvailableVoices)
  }
  colorSchemeMediaQuery?.removeEventListener('change', syncSystemThemePreference)
  window.removeEventListener('hashchange', syncPageFromHash)
  stopActivityDrag()
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <main class="min-h-screen bg-[#f7f8f5] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-[max(18px,env(safe-area-inset-top))]">
        <header v-if="currentPage === 'workout'" class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Workout 3-2-1</p>
            <h1 class="mt-1 truncate text-2xl font-black leading-tight">训练辅助器</h1>
          </div>

          <div class="flex items-center gap-2">
            <NTooltip trigger="hover">
              <template #trigger>
                <NButton circle secondary type="primary" aria-label="训练记录" @click="openHistory">
                  <History :size="19" />
                </NButton>
              </template>
              训练记录
            </NTooltip>

            <NTooltip trigger="hover">
              <template #trigger>
                <NButton circle secondary type="primary" aria-label="设置" @click="openSettings">
                  <Settings :size="19" />
                </NButton>
              </template>
              设置
            </NTooltip>

            <NTooltip trigger="hover">
              <template #trigger>
                <NButton circle secondary type="primary" aria-label="语音提示" @click="voiceEnabled = !voiceEnabled">
                  <Volume2 v-if="voiceEnabled" :size="19" />
                  <VolumeX v-else :size="19" />
                </NButton>
              </template>
              语音提示
            </NTooltip>
          </div>
        </header>

        <section v-if="currentPage === 'workout'" class="mt-4">
          <label class="text-sm font-bold text-slate-600 dark:text-slate-300" for="activePlan">训练计划</label>
          <NSelect
            id="activePlan"
            v-model:value="activePlanId"
            class="mt-2"
            :options="planOptions"
            :disabled="!canEditPlan"
          />
        </section>

        <section v-if="currentPage === 'workout'" class="mt-4 rounded-lg border border-teal-900/10 bg-white p-4 shadow-soft transition-colors dark:border-teal-300/10 dark:bg-slate-900">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-bold text-teal-700 dark:text-teal-300">
                {{ phase === 'countdown' ? '开始准备' : phase === 'rest' ? '当前休息' : '当前动作' }}
              </p>
              <h2 class="mt-1 truncate text-3xl font-black leading-none">{{ statusTitle }}</h2>
              <p class="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">{{ currentText }}</p>
            </div>

            <NProgress
              class="shrink-0"
              type="circle"
              :width="88"
              :stroke-width="10"
              :percentage="progressPercentage"
              :show-indicator="false"
              color="#0f766e"
              :rail-color="progressRailColor"
            />
          </div>

          <div class="mt-5 flex items-end justify-between rounded-lg bg-[#101827] px-4 py-4 text-white">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-teal-200">
                {{ timerLabel }}
              </p>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="text-6xl font-black tabular-nums leading-none">{{ displayNumber }}</span>
                <span class="text-xl font-black">{{ displayUnit }}</span>
              </div>
            </div>
            <div class="pb-1 text-right text-xs font-bold text-slate-300">
              <p>{{ currentProgressText }}</p>
              <p class="mt-1">{{ sessionStateLabel }}</p>
            </div>
          </div>

          <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition-colors dark:border-slate-800 dark:bg-slate-950/70">
            <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">下个动作</p>
            <p class="mt-1 truncate text-lg font-black">{{ nextText }}</p>
          </div>

          <div class="mt-5 grid grid-cols-[1fr_auto_auto] gap-2">
            <NButton size="large" type="primary" block @click="togglePrimary">
              <template #icon>
                <Pause v-if="isRunning" :size="20" />
                <Play v-else :size="20" />
              </template>
              {{ primaryLabel }}
            </NButton>

            <NTooltip trigger="hover">
              <template #trigger>
                <NButton size="large" aria-label="下一个" :disabled="!canSkip" @click="skipCurrent">
                  <template #icon>
                    <SkipForward :size="20" />
                  </template>
                </NButton>
              </template>
              下一个
            </NTooltip>

            <NTooltip trigger="hover">
              <template #trigger>
                <NButton size="large" aria-label="重置" @click="resetSession">
                  <template #icon>
                    <RotateCcw :size="20" />
                  </template>
                </NButton>
              </template>
              重置
            </NTooltip>
          </div>
        </section>

        <section v-else-if="currentPage === 'settings'" class="space-y-3">
          <header class="flex items-center justify-between">
            <div class="flex min-w-0 items-center gap-3">
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton circle aria-label="返回训练" @click="closePanel">
                    <ArrowLeft :size="19" />
                  </NButton>
                </template>
                返回训练
              </NTooltip>

              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Workout 3-2-1</p>
                <h1 class="mt-1 text-2xl font-black leading-tight">设置</h1>
              </div>
            </div>
          </header>

          <div class="flex items-center justify-between">
            <h2 class="text-base font-black">训练计划</h2>
            <div class="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
              <span>语音</span>
              <NSwitch v-model:value="voiceEnabled" size="small" />
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-3 transition-colors dark:border-slate-800 dark:bg-slate-900">
            <label class="text-sm font-bold text-slate-600 dark:text-slate-300" for="themeMode">外观</label>
            <NSelect
              id="themeMode"
              v-model:value="themeMode"
              class="mt-2"
              :options="themeModeOptions"
            />
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-3 transition-colors dark:border-slate-800 dark:bg-slate-900">
            <label class="text-sm font-bold text-slate-600 dark:text-slate-300" for="voiceSelect">语音声音</label>
            <NSelect
              id="voiceSelect"
              v-model:value="selectedVoiceId"
              class="mt-2"
              :options="voiceOptions"
              :disabled="!voiceEnabled"
            />
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-3 transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center justify-between gap-2">
              <label class="text-sm font-bold text-slate-600 dark:text-slate-300" for="planSelect">当前计划</label>
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton
                    quaternary
                    circle
                    size="small"
                    aria-label="修改当前计划名称"
                    :disabled="!canEditPlan"
                    @click="openPlanNameModal"
                  >
                    <Pencil :size="16" />
                  </NButton>
                </template>
                修改当前计划名称
              </NTooltip>
            </div>
            <NSelect
              id="planSelect"
              v-model:value="activePlanId"
              class="mt-2"
              :options="planOptions"
              :disabled="!canEditPlan"
            />

            <div class="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
              <NButton secondary type="primary" :disabled="!canEditPlan" @click="addPlan">
                <template #icon>
                  <Plus :size="18" />
                </template>
                新计划
              </NButton>

              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton aria-label="复制当前计划" :disabled="!canEditPlan" @click="duplicateCurrentPlan">
                    <template #icon>
                      <Copy :size="18" />
                    </template>
                  </NButton>
                </template>
                复制当前计划
              </NTooltip>

              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton
                    aria-label="删除当前计划"
                    :disabled="plans.length <= 1 || !canEditPlan"
                    @click="requestRemoveCurrentPlan"
                  >
                    <template #icon>
                      <Trash2 :size="18" />
                    </template>
                  </NButton>
                </template>
                删除当前计划
              </NTooltip>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-3 transition-colors dark:border-slate-800 dark:bg-slate-900">
            <label class="text-sm font-bold text-slate-600 dark:text-slate-300" for="startCountdownSeconds">开始倒计时</label>
            <NInputNumber
              id="startCountdownSeconds"
              v-no-stepper-focus
              v-model:value="startCountdownSeconds"
              class="mt-2 w-full"
              :min="0"
              :max="60"
              :step="1"
              button-placement="both"
              :disabled="!canEditPlan"
            />
          </div>

          <div class="space-y-2">
            <article
              v-for="(activity, index) in routine"
              :key="activity.id"
              class="rounded-lg border p-3 transition"
              :class="[
                draggingActivityId === activity.id
                  ? 'border-teal-600 bg-teal-50/80 shadow-soft dark:border-teal-300/70 dark:bg-teal-950/50'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                dragOverActivityId === activity.id && draggingActivityId !== activity.id
                  ? 'ring-2 ring-teal-500/40 dark:ring-teal-300/30'
                  : '',
              ]"
              :data-activity-id="activity.id"
            >
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="flex h-9 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-slate-400 transition enabled:cursor-grab enabled:hover:bg-slate-100 enabled:hover:text-teal-700 enabled:active:cursor-grabbing disabled:opacity-35 dark:text-slate-500 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-teal-300"
                  aria-label="拖动排序"
                  :disabled="!canEditPlan || routine.length <= 1"
                  @pointerdown="startActivityDrag($event, activity.id)"
                >
                  <GripVertical :size="18" />
                </button>
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 font-black text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                  {{ index + 1 }}
                </div>
                <NInput
                  v-model:value="activity.name"
                  placeholder="动作名称"
                  :disabled="!canEditPlan || isDraggingActivity"
                />
                <NButton
                  quaternary
                  circle
                  aria-label="删除动作"
                  :disabled="routine.length <= 1 || !canEditPlan || isDraggingActivity"
                  @click="requestRemoveActivity(activity.id)"
                >
                  <Trash2 :size="18" />
                </NButton>
              </div>

              <div class="mt-2 grid grid-cols-[minmax(82px,0.85fr)_minmax(88px,1fr)_minmax(104px,1.12fr)] gap-2">
                <div>
                  <label class="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-400">模式</label>
                  <NSelect
                    v-model:value="activity.mode"
                    :options="modeOptions"
                    :disabled="!canEditPlan || isDraggingActivity"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-400">组数</label>
                  <NInputNumber
                    v-no-stepper-focus
                    v-model:value="activity.sets"
                    :min="1"
                    :max="99"
                    :step="1"
                    :precision="0"
                    button-placement="both"
                    :disabled="!canEditPlan || isDraggingActivity"
                    @update:value="activity.sets = normalizeSets($event)"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-400">
                    {{ activity.mode === 'reps' ? '每组次数' : '每组秒数' }}
                  </label>
                  <NInputNumber
                    v-no-stepper-focus
                    v-model:value="activity.target"
                    :min="1"
                    :max="999"
                    :step="activity.mode === 'reps' ? 1 : 5"
                    button-placement="both"
                    :disabled="!canEditPlan || isDraggingActivity"
                  />
                </div>
              </div>

              <div class="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label class="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-400">组间休息</label>
                  <NInputNumber
                    v-no-stepper-focus
                    v-model:value="activity.setRestSeconds"
                    :min="0"
                    :max="600"
                    :step="5"
                    :precision="0"
                    button-placement="both"
                    :disabled="!canEditPlan || isDraggingActivity"
                    @update:value="activity.setRestSeconds = normalizeRestDuration($event)"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-400">动作间休息</label>
                  <NInputNumber
                    v-no-stepper-focus
                    v-model:value="activity.nextRestSeconds"
                    :min="0"
                    :max="600"
                    :step="5"
                    :precision="0"
                    button-placement="both"
                    :disabled="!canEditPlan || isDraggingActivity || index === routine.length - 1"
                    @update:value="activity.nextRestSeconds = normalizeRestDuration($event)"
                  />
                </div>
              </div>
            </article>
          </div>

          <NButton secondary type="primary" block :disabled="!canEditPlan" @click="addActivity">
            <template #icon>
              <Plus :size="18" />
            </template>
            添加动作
          </NButton>
        </section>

        <section v-else class="space-y-3">
          <header class="flex items-center justify-between">
            <div class="flex min-w-0 items-center gap-3">
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton circle aria-label="返回训练" @click="closePanel">
                    <ArrowLeft :size="19" />
                  </NButton>
                </template>
                返回训练
              </NTooltip>

              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Workout 3-2-1</p>
                <h1 class="mt-1 text-2xl font-black leading-tight">训练记录</h1>
              </div>
            </div>
          </header>

          <div v-if="workoutHistory.length === 0" class="rounded-lg border border-slate-200 bg-white p-4 text-center transition-colors dark:border-slate-800 dark:bg-slate-900">
            <p class="text-base font-black">暂无记录</p>
            <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">开始训练后会自动保存计划快照。</p>
          </div>

          <article
            v-for="log in workoutHistory"
            v-else
            :key="log.id"
            class="rounded-lg border border-slate-200 bg-white p-3 transition-colors dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">{{ statusText(log.status) }}</p>
                <h2 class="mt-1 truncate text-lg font-black">{{ log.planName }}</h2>
                <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {{ formatDateTime(log.startedAt) }} · {{ formatDuration(log) }}
                </p>
              </div>

              <NButton quaternary circle aria-label="删除记录" @click="requestDeleteHistoryEntry(log.id)">
                <Trash2 :size="18" />
              </NButton>
            </div>

            <div class="mt-3 rounded-lg bg-slate-50 px-3 py-2 transition-colors dark:bg-slate-950/70">
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                准备 {{ log.plan.startCountdownSeconds }} 秒
              </p>
              <ol class="mt-2 space-y-1">
                <li
                  v-for="(activity, index) in log.plan.routine"
                  :key="`${log.id}-${activity.id}`"
                  class="flex items-start justify-between gap-3 text-sm font-bold"
                >
                  <span class="min-w-0 truncate text-slate-800 dark:text-slate-200">{{ index + 1 }}. {{ activity.name }}</span>
                  <span class="shrink-0 text-right text-slate-500 dark:text-slate-400">
                    <span class="block">{{ formatActivityTarget(activity) }}</span>
                    <span class="block text-xs">{{ formatActivityRest(activity, index === log.plan.routine.length - 1) }}</span>
                  </span>
                </li>
              </ol>
            </div>
          </article>
        </section>

        <footer class="mt-auto flex items-center justify-center gap-1 pb-[max(0px,env(safe-area-inset-bottom))] pt-6 text-xs font-bold text-slate-400">
          <span>3</span>
          <ChevronRight :size="13" />
          <span>2</span>
          <ChevronRight :size="13" />
          <span>1</span>
        </footer>
      </div>
    </main>

    <NModal v-model:show="isPlanNameModalOpen" :mask-closable="false">
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <section class="w-full max-w-[360px] rounded-lg bg-white p-4 shadow-soft transition-colors dark:bg-slate-900">
          <h2 class="text-lg font-black text-slate-950 dark:text-slate-100">修改计划名称</h2>
          <label class="mt-4 block text-sm font-bold text-slate-600 dark:text-slate-300" for="planNameDraft">计划名称</label>
          <NInput
            id="planNameDraft"
            v-model:value="planNameDraft"
            class="mt-2"
            placeholder="计划名称"
            autofocus
            @keydown.enter.prevent="savePlanName"
          />
          <div class="mt-4 grid grid-cols-2 gap-2">
            <NButton @click="closePlanNameModal">取消</NButton>
            <NButton type="primary" @click="savePlanName">保存</NButton>
          </div>
        </section>
      </div>
    </NModal>

    <NModal v-model:show="isDeleteConfirmOpen" :mask-closable="false">
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <section class="w-full max-w-[360px] rounded-lg bg-white p-4 shadow-soft transition-colors dark:bg-slate-900">
          <h2 class="text-lg font-black text-slate-950 dark:text-slate-100">
            {{ pendingDeleteTarget ? pendingDeleteTarget.title : '确认删除？' }}
          </h2>
          <p class="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            {{ pendingDeleteTarget ? pendingDeleteTarget.description : '' }}
          </p>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <NButton @click="closeDeleteConfirm">取消</NButton>
            <NButton type="error" @click="confirmDelete">
              {{ pendingDeleteTarget ? pendingDeleteTarget.confirmLabel : '删除' }}
            </NButton>
          </div>
        </section>
      </div>
    </NModal>
  </NConfigProvider>
</template>
