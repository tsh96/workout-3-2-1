export type ActivityMode = 'reps' | 'time'
export type AppTab = 'train' | 'plan' | 'history'
export type SessionPhase = 'idle' | 'countdown' | 'action' | 'rest' | 'done'
export type WorkoutLogStatus = 'started' | 'completed' | 'stopped'
export type ThemeMode = 'system' | 'light' | 'dark'

/** Which colour language a screen speaks: green = work, cyan = rest, amber = get ready. */
export type PhaseAccent = 'work' | 'rest' | 'prep'

export interface Activity {
  id: string
  name: string
  mode: ActivityMode
  sets: number
  target: number
  /** Pause between two sets of this same activity. */
  setRestSeconds: number
  /** Pause after this activity's last set, before the next activity. */
  nextRestSeconds: number
}

export interface WorkoutPlan {
  id: string
  name: string
  startCountdownSeconds: number
  routine: Activity[]
}

export interface WorkoutPlanSnapshot {
  name: string
  startCountdownSeconds: number
  routine: Activity[]
}

export interface WorkoutSessionLog {
  id: string
  planId: string
  planName: string
  startedAt: string
  completedAt?: string
  status: WorkoutLogStatus
  plan: WorkoutPlanSnapshot
  /** Sets actually finished, so a stopped session can say how far it got. */
  completedSets: number
  totalSets: number
}

export interface AppSettings {
  voiceId: string
  voiceEnabled: boolean
  themeMode: ThemeMode
  countdownPromptStartSeconds: number
  keepAwake: boolean
  hapticsEnabled: boolean
}

export interface AppState {
  activePlanId: string
  plans: WorkoutPlan[]
  history: WorkoutSessionLog[]
  settings: AppSettings
}

export type DeleteTargetKind = 'plan' | 'activity' | 'history' | 'history-all'

export interface DeleteTarget {
  kind: DeleteTargetKind
  id: string
  title: string
  description: string
  confirmLabel: string
}

/** One step of a routine: a specific set of a specific activity. */
export interface WorkoutStep {
  activity: Activity
  index: number
  setIndex: number
}
