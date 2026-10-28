import { logDurationSeconds, startOfDay, WEEKDAY_LABELS } from './format'
import type { WorkoutSessionLog } from './types'

/** A day counts as trained once at least one set was finished; opening and quitting does not. */
function didTrain(log: WorkoutSessionLog) {
  return log.status !== 'started' && log.completedSets > 0
}

/** Monday-first, the way a Chinese calendar reads. */
export const CALENDAR_WEEKDAY_LABELS = [1, 2, 3, 4, 5, 6, 0].map((day) => WEEKDAY_LABELS[day])

/** A calendar month, with `month` zero-based like `Date#getMonth`. */
export interface CalendarMonth {
  year: number
  month: number
}

export interface CalendarDay {
  key: string
  dayOfMonth: number
  trained: boolean
  isToday: boolean
  isFuture: boolean
}

export interface MonthGrid {
  /** Monday-first cells, whole weeks only; `null` pads the days of the neighbouring months. */
  cells: (CalendarDay | null)[]
  trainedDayCount: number
}

export function monthOf(value: Date): CalendarMonth {
  return { year: value.getFullYear(), month: value.getMonth() }
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  return monthOf(new Date(year, month + delta, 1))
}

export function compareMonths(a: CalendarMonth, b: CalendarMonth) {
  return a.year - b.year || a.month - b.month
}

/** The month of the oldest log, so the calendar does not page back into nothing. */
export function earliestLogMonth(history: WorkoutSessionLog[], now = new Date()): CalendarMonth {
  const oldest = history.reduce(
    (min, log) => Math.min(min, Date.parse(log.startedAt)),
    now.getTime(),
  )
  return monthOf(new Date(oldest))
}

export function buildMonthGrid(
  history: WorkoutSessionLog[],
  { year, month }: CalendarMonth,
  now = new Date(),
): MonthGrid {
  const today = startOfDay(now)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7

  const trainedDays = new Set(
    history.filter(didTrain).map((log) => startOfDay(new Date(log.startedAt)).getTime()),
  )

  const cells: (CalendarDay | null)[] = Array.from({ length: leadingBlanks }, () => null)
  let trainedDayCount = 0

  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    const time = new Date(year, month, dayOfMonth).getTime()
    const trained = trainedDays.has(time)
    if (trained) trainedDayCount += 1

    cells.push({
      key: `${year}-${month + 1}-${dayOfMonth}`,
      dayOfMonth,
      trained,
      isToday: time === today.getTime(),
      isFuture: time > today.getTime(),
    })
  }

  while (cells.length % 7 !== 0) cells.push(null)

  return { cells, trainedDayCount }
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
