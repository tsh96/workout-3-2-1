import { logDurationSeconds, startOfDay, WEEKDAY_LABELS } from './format'
import type { WorkoutSessionLog } from './types'

/** A day counts as trained once at least one set was finished; opening and quitting does not. */
function didTrain(log: WorkoutSessionLog) {
  return log.status !== 'started' && log.completedSets > 0
}

export interface WeekDay {
  key: string
  label: string
  dayOfMonth: number
  trained: boolean
  isToday: boolean
  isFuture: boolean
}

/** Monday-first, the way a Chinese calendar reads. */
export function buildWeekStrip(history: WorkoutSessionLog[], now = new Date()): WeekDay[] {
  const today = startOfDay(now)
  const mondayOffset = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - mondayOffset)

  const trainedDays = new Set(
    history.filter(didTrain).map((log) => startOfDay(new Date(log.startedAt)).getTime()),
  )

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)

    return {
      key: date.toISOString().slice(0, 10),
      label: WEEKDAY_LABELS[date.getDay()],
      dayOfMonth: date.getDate(),
      trained: trainedDays.has(date.getTime()),
      isToday: date.getTime() === today.getTime(),
      isFuture: date.getTime() > today.getTime(),
    }
  })
}

export interface HistoryStats {
  weekCount: number
  weekSeconds: number
  streakDays: number
}

export function summarizeHistory(history: WorkoutSessionLog[], now = new Date()): HistoryStats {
  const today = startOfDay(now)
  const mondayOffset = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - mondayOffset)

  const finished = history.filter((log) => log.status !== 'started')
  const thisWeek = finished.filter((log) => new Date(log.startedAt).getTime() >= monday.getTime())

  const trainedDays = new Set(
    history.filter(didTrain).map((log) => startOfDay(new Date(log.startedAt)).getTime()),
  )

  // A streak survives today being empty — it only breaks once yesterday is too.
  let streakDays = 0
  let cursor = new Date(today)
  if (!trainedDays.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1)
  while (trainedDays.has(cursor.getTime())) {
    streakDays += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    weekCount: thisWeek.filter((log) => log.status === 'completed').length,
    weekSeconds: thisWeek.reduce(
      (total, log) => total + logDurationSeconds(log.startedAt, log.completedAt),
      0,
    ),
    streakDays,
  }
}
