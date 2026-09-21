import type {
  Activity,
  ActivityMode,
  AppSettings,
  AppState,
  ThemeMode,
  WorkoutPlan,
  WorkoutSessionLog,
  WorkoutLogStatus,
} from './types'

const STORAGE_KEY = 'workout-3-2-1-state'

const DEFAULT_REST_SECONDS = 30
const DEFAULT_START_COUNTDOWN = 5
const DEFAULT_PROMPT_START = 3

export function createId(prefix: string) {
  if ('randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function cloneActivities(activities: Activity[]) {
  return activities.map((activity) => ({ ...activity }))
}

export function countSets(routine: Activity[]) {
  return routine.reduce((total, activity) => total + activity.sets, 0)
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value)
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(numeric) ? numeric : fallback)))
}

function normalizeSets(value: unknown) {
  return clampInt(value, 1, 99, 1)
}

export function normalizeTarget(value: unknown) {
  return clampInt(value, 1, 999, 1)
}

function normalizeRestDuration(value: unknown, fallback = DEFAULT_REST_SECONDS) {
  return clampInt(value, 0, 600, fallback)
}

export function normalizeStartCountdown(value: unknown, fallback = DEFAULT_START_COUNTDOWN) {
  return clampInt(value, 0, 60, fallback)
}

export function normalizeCountdownPromptStart(value: unknown, fallback = DEFAULT_PROMPT_START) {
  return clampInt(value, 1, 30, fallback)
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeActivity(
  activity: Partial<Activity>,
  index: number,
  fallbackRestSeconds = DEFAULT_REST_SECONDS,
): Activity {
  const mode: ActivityMode = activity.mode === 'time' ? 'time' : 'reps'

  return {
    id: activity.id || createId(`activity-${index + 1}`),
    name: String(activity.name || `动作 ${index + 1}`),
    mode,
    sets: normalizeSets(activity.sets),
    target: normalizeTarget(activity.target),
    setRestSeconds: normalizeRestDuration(activity.setRestSeconds, fallbackRestSeconds),
    nextRestSeconds: normalizeRestDuration(activity.nextRestSeconds, fallbackRestSeconds),
  }
}

const defaultRoutine: Activity[] = [
  { id: 'squat', name: '深蹲', mode: 'reps', sets: 3, target: 15, setRestSeconds: 30, nextRestSeconds: 45 },
  { id: 'plank', name: '平板支撑', mode: 'time', sets: 2, target: 45, setRestSeconds: 30, nextRestSeconds: 45 },
  { id: 'pushup', name: '俯卧撑', mode: 'reps', sets: 1, target: 12, setRestSeconds: 30, nextRestSeconds: 45 },
  { id: 'mountain', name: '登山跑', mode: 'time', sets: 1, target: 30, setRestSeconds: 30, nextRestSeconds: 30 },
]

function normalizeRoutine(routine: unknown, fallbackRestSeconds = DEFAULT_REST_SECONDS): Activity[] {
  if (!Array.isArray(routine) || routine.length === 0) {
    return defaultRoutine.map((activity) => ({ ...activity }))
  }

  return routine.map((activity, index) =>
    normalizeActivity(activity as Partial<Activity>, index, fallbackRestSeconds),
  )
}

export function createPlan(
  name: string,
  routine: Activity[] = defaultRoutine,
  startCountdownSeconds = DEFAULT_START_COUNTDOWN,
): WorkoutPlan {
  return {
    id: createId('plan'),
    name,
    startCountdownSeconds: normalizeStartCountdown(startCountdownSeconds),
    routine: normalizeRoutine(cloneActivities(routine)),
  }
}

export function createActivity(): Activity {
  return {
    id: createId('activity'),
    name: '新动作',
    mode: 'reps',
    sets: 1,
    target: 10,
    setRestSeconds: DEFAULT_REST_SECONDS,
    nextRestSeconds: DEFAULT_REST_SECONDS,
  }
}

function normalizePlan(plan: Partial<WorkoutPlan>, index: number): WorkoutPlan {
  // Plans saved before per-activity rests existed carried one rest for the whole plan.
  const legacyRestSeconds = normalizeRestDuration((plan as { restSeconds?: unknown }).restSeconds)

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
      const snapshot = log.plan as Partial<WorkoutPlan> | undefined
      const legacyRestSeconds = normalizeRestDuration(
        (snapshot as { restSeconds?: unknown } | undefined)?.restSeconds,
      )
      const routine = normalizeRoutine(snapshot?.routine, legacyRestSeconds)
      const totalSets = Number.isFinite(Number(log.totalSets)) && Number(log.totalSets) > 0
        ? Math.round(Number(log.totalSets))
        : countSets(routine)

      const normalized: WorkoutSessionLog = {
        id: log.id || createId(`session-${index + 1}`),
        planId: String(log.planId || ''),
        planName: String(log.planName || snapshot?.name || '未命名计划'),
        startedAt,
        status,
        plan: {
          name: String(snapshot?.name || log.planName || '未命名计划'),
          startCountdownSeconds: normalizeStartCountdown(snapshot?.startCountdownSeconds, 0),
          routine,
        },
        // Sessions logged before set tracking existed report a full house when
        // they completed and nothing when they did not — the only honest guess.
        completedSets: clampInt(
          log.completedSets,
          0,
          totalSets,
          status === 'completed' ? totalSets : 0,
        ),
        totalSets,
      }

      if (completedAt) normalized.completedAt = completedAt
      return normalized
    })
    .filter((entry): entry is WorkoutSessionLog => entry !== null)
}

function defaultSettings(): AppSettings {
  return {
    voiceId: '',
    voiceEnabled: true,
    themeMode: 'system',
    countdownPromptStartSeconds: DEFAULT_PROMPT_START,
    keepAwake: true,
    hapticsEnabled: true,
  }
}

function defaultState(): AppState {
  const plan = createPlan('基础循环', defaultRoutine)
  return {
    activePlanId: plan.id,
    plans: [plan],
    history: [],
    settings: defaultSettings(),
  }
}

/** Anything ever written to localStorage by any version of this app. */
interface StoredShape {
  activePlanId?: string
  plans?: Partial<WorkoutPlan>[]
  history?: unknown
  settings?: Partial<AppSettings>
  voiceId?: string
  voiceEnabled?: boolean
  themeMode?: unknown
  countdownPromptStartSeconds?: unknown
  keepAwake?: unknown
  hapticsEnabled?: unknown
  startCountdownSeconds?: unknown
  restSeconds?: unknown
  routine?: unknown
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultState()

    const parsed = JSON.parse(saved) as StoredShape
    const savedPlans =
      Array.isArray(parsed.plans) && parsed.plans.length > 0
        ? parsed.plans
        : [
            createPlan(
              '基础循环',
              normalizeRoutine(parsed.routine, normalizeRestDuration(parsed.restSeconds)),
              normalizeStartCountdown(parsed.startCountdownSeconds),
            ),
          ]

    const plans = savedPlans.map((plan, index) => normalizePlan(plan, index))
    const activePlanId = plans.some((plan) => plan.id === parsed.activePlanId)
      ? String(parsed.activePlanId)
      : plans[0].id

    // Settings used to live at the top level; read either shape.
    const flat = parsed.settings ?? parsed

    return {
      activePlanId,
      plans,
      history: normalizeHistory(parsed.history),
      settings: {
        voiceId: String(flat.voiceId || ''),
        voiceEnabled: normalizeBoolean(flat.voiceEnabled, true),
        themeMode: normalizeThemeMode(flat.themeMode),
        countdownPromptStartSeconds: normalizeCountdownPromptStart(flat.countdownPromptStartSeconds),
        keepAwake: normalizeBoolean(flat.keepAwake, true),
        hapticsEnabled: normalizeBoolean(flat.hapticsEnabled, true),
      },
    }
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // A full or blocked storage quota must not take the workout down with it.
  }
}
