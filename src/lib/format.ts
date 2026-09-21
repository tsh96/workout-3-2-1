import type { Activity, WorkoutLogStatus, WorkoutPlan, WorkoutPlanSnapshot } from './types'

/**
 * How long one rep is assumed to take when estimating a plan's length.
 * Reps are self-paced, so any total involving them is an estimate, not a clock.
 */
const SECONDS_PER_REP = 3

export function formatActionTarget(activity: Activity) {
  return `${activity.target} ${activity.mode === 'reps' ? '次' : '秒'}`
}

/** "3 组 × 15 次" — the shape of an activity at a glance. */
export function formatActivityTarget(activity: Activity) {
  return `${activity.sets} 组 × ${formatActionTarget(activity)}`
}

export function formatActivitySummary(activity: Activity, isLast: boolean) {
  const rests = isLast
    ? `休息 ${activity.setRestSeconds} 秒 · 最后一个`
    : `休息 ${activity.setRestSeconds} / ${activity.nextRestSeconds} 秒`
  return `${formatActivityTarget(activity)} · ${rests}`
}

/** Seconds as mm:ss, or h:mm:ss once it runs past an hour. */
export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(rest)}`
  return `${minutes}:${pad(rest)}`
}

function estimateActivitySeconds(activity: Activity, isLast: boolean) {
  const perSet = activity.mode === 'time' ? activity.target : activity.target * SECONDS_PER_REP
  const work = perSet * activity.sets
  const setRests = activity.setRestSeconds * Math.max(0, activity.sets - 1)
  const nextRest = isLast ? 0 : activity.nextRestSeconds
  return work + setRests + nextRest
}

export function estimatePlanSeconds(plan: WorkoutPlan | WorkoutPlanSnapshot) {
  return plan.routine.reduce(
    (total, activity, index) =>
      total + estimateActivitySeconds(activity, index === plan.routine.length - 1),
    plan.startCountdownSeconds,
  )
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000)
}

/** "今天 19:42" / "昨天 07:15" / "09-19 周五 20:03". */
export function formatLogDate(iso: string, now = new Date()) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const distance = daysBetween(date, now)

  if (distance === 0) return `今天 ${time}`
  if (distance === 1) return `昨天 ${time}`

  const day = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day} 周${WEEKDAY_LABELS[date.getDay()]} ${time}`
}

export function logDurationSeconds(startedAt: string, completedAt?: string) {
  if (!completedAt) return 0
  return Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000))
}

export function statusText(status: WorkoutLogStatus) {
  if (status === 'completed') return '已完成'
  if (status === 'stopped') return '已停止'
  return '进行中'
}

export { WEEKDAY_LABELS, startOfDay, daysBetween }
