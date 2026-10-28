<script setup lang="ts">
import { ChevronDown, ChevronLeft, ChevronRight, MoreVertical, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import BottomSheet from '../ui/BottomSheet.vue'
import { formatActivityTarget, formatClock, formatLogDate, logDurationSeconds, statusText } from '../../lib/format'
import {
  buildMonthGrid,
  CALENDAR_WEEKDAY_LABELS,
  compareMonths,
  earliestLogMonth,
  monthOf,
  shiftMonth,
  summarizeHistory,
} from '../../lib/stats'
import type { WorkoutSessionLog } from '../../lib/types'

const props = defineProps<{ history: WorkoutSessionLog[] }>()

const emit = defineEmits<{ deleteEntry: [id: string]; clearAll: [] }>()

const expandedId = ref<string | null>(null)
const isActionsOpen = ref(false)

const stats = computed(() => summarizeHistory(props.history))

const currentMonth = monthOf(new Date())
const viewMonth = ref(currentMonth)
const calendar = computed(() => buildMonthGrid(props.history, viewMonth.value))
const isCurrentMonth = computed(() => compareMonths(viewMonth.value, currentMonth) === 0)
const canGoBack = computed(
  () => compareMonths(viewMonth.value, earliestLogMonth(props.history)) > 0,
)
const monthTitle = computed(() => `${viewMonth.value.year} 年 ${viewMonth.value.month + 1} 月`)

function goToMonth(delta: number) {
  if (delta < 0 && !canGoBack.value) return
  if (delta > 0 && isCurrentMonth.value) return
  viewMonth.value = shiftMonth(viewMonth.value, delta)
}

/* A horizontal swipe across the calendar pages months, like a phone's own calendar. */
let swipeStart: { x: number; y: number } | null = null

function onSwipeStart(event: TouchEvent) {
  const touch = event.touches[0]
  swipeStart = { x: touch.clientX, y: touch.clientY }
}

function onSwipeEnd(event: TouchEvent) {
  if (!swipeStart) return
  const touch = event.changedTouches[0]
  const dx = touch.clientX - swipeStart.x
  const dy = touch.clientY - swipeStart.y
  swipeStart = null
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  goToMonth(dx > 0 ? -1 : 1)
}

function onSwipeCancel() {
  swipeStart = null
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function clearAll() {
  isActionsOpen.value = false
  emit('clearAll')
}

function statusTone(status: WorkoutSessionLog['status']) {
  if (status === 'completed') return 'bg-work-soft text-work'
  if (status === 'stopped') return 'bg-prep-soft text-prep'
  return 'bg-rest-soft text-rest'
}
</script>

<template>
  <div class="flex min-h-0 flex-grow flex-col">
    <header class="flex shrink-0 items-start justify-between gap-3 px-5 pt-[max(22px,env(safe-area-inset-top))]">
      <div class="min-w-0">
        <p class="text-[11px] font-extrabold tracking-[0.2em] text-muted">训练历史</p>
        <h1 class="mt-1 text-[28px] font-black leading-none tracking-tight">记录</h1>
      </div>
      <button
        type="button"
        aria-label="记录操作"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-line bg-surface transition active:scale-95 disabled:opacity-35"
        :disabled="history.length === 0"
        @click="isActionsOpen = true"
      >
        <MoreVertical :size="19" :stroke-width="2.2" />
      </button>
    </header>

    <div class="flex min-h-0 flex-grow flex-col overflow-y-auto pb-2">
      <section class="mx-5 mt-4 shrink-0 rounded-[22px] border border-line bg-surface p-4">
        <dl class="grid grid-cols-3 gap-2.5">
          <div>
            <dd class="tnum text-[26px] font-black leading-none tracking-tight text-work">
              {{ stats.weekCount }}
            </dd>
            <dt class="mt-1.5 text-[11px] font-bold text-muted">本周完成</dt>
          </div>
          <div>
            <dd class="tnum text-[26px] font-black leading-none tracking-tight">
              {{ stats.streakDays }} 天
            </dd>
            <dt class="mt-1.5 text-[11px] font-bold text-muted">连续训练</dt>
          </div>
          <div>
            <dd class="tnum text-[26px] font-black leading-none tracking-tight">
              {{ formatClock(stats.weekSeconds) }}
            </dd>
            <dt class="mt-1.5 text-[11px] font-bold text-muted">本周时长</dt>
          </div>
        </dl>

        <div
          class="mt-4 border-t border-line pt-3.5"
          @touchstart.passive="onSwipeStart"
          @touchend="onSwipeEnd"
          @touchcancel="onSwipeCancel"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <h2 class="tnum text-[16px] font-black leading-tight tracking-tight">{{ monthTitle }}</h2>
              <p class="tnum mt-0.5 text-[11px] font-bold text-muted">
                训练 {{ calendar.trainedDayCount }} 天
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                v-if="!isCurrentMonth"
                type="button"
                class="flex h-9 items-center rounded-xl bg-raised px-3 text-[13px] font-extrabold text-muted transition active:scale-95"
                @click="viewMonth = currentMonth"
              >
                本月
              </button>
              <button
                type="button"
                aria-label="上个月"
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-line transition active:scale-95 disabled:opacity-30"
                :disabled="!canGoBack"
                @click="goToMonth(-1)"
              >
                <ChevronLeft :size="18" :stroke-width="2.4" />
              </button>
              <button
                type="button"
                aria-label="下个月"
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-line transition active:scale-95 disabled:opacity-30"
                :disabled="isCurrentMonth"
                @click="goToMonth(1)"
              >
                <ChevronRight :size="18" :stroke-width="2.4" />
              </button>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-7 gap-1.5 text-center" aria-hidden="true">
            <span
              v-for="label in CALENDAR_WEEKDAY_LABELS"
              :key="label"
              class="text-[11px] font-bold text-faint"
            >
              {{ label }}
            </span>
          </div>

          <ol class="mt-1.5 grid grid-cols-7 gap-1.5" :aria-label="`${monthTitle}训练日`">
            <li v-for="(day, index) in calendar.cells" :key="day?.key ?? `blank-${index}`">
              <span
                v-if="day"
                class="tnum flex h-[34px] items-center justify-center rounded-xl text-[13px]"
                :class="[
                  day.isToday && day.trained
                    ? 'bg-work-fill font-black text-work-on'
                    : day.trained
                      ? 'bg-work-soft font-extrabold text-work'
                      : 'border border-line font-bold text-faint',
                  day.isFuture ? 'opacity-40' : '',
                  day.isToday && !day.trained ? 'border-work text-work' : '',
                ]"
              >
                {{ day.dayOfMonth }}
                <span v-if="day.trained" class="sr-only">已训练</span>
              </span>
            </li>
          </ol>
        </div>
      </section>

      <p class="shrink-0 px-5 pt-[18px] text-[12px] font-extrabold tracking-[0.14em] text-muted">
        最近训练
      </p>

      <div class="flex flex-col gap-2 px-5 pt-2.5">
        <p
          v-if="history.length === 0"
          class="rounded-[20px] border border-dashed border-line px-4 py-8 text-center text-[14px] font-bold text-muted"
        >
          还没有训练记录。<br />开始一次训练后会自动保存。
        </p>

        <article
          v-for="log in history"
          :key="log.id"
          class="shrink-0 rounded-[20px] border border-line bg-surface px-4 py-3.5"
        >
          <div class="flex items-center justify-between gap-2.5">
            <p class="tnum text-[12px] font-bold text-muted">{{ formatLogDate(log.startedAt) }}</p>
            <span
              class="flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-extrabold"
              :class="statusTone(log.status)"
            >
              {{ statusText(log.status) }}
            </span>
          </div>

          <div class="mt-2 flex items-end justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-[19px] font-black tracking-tight">{{ log.planName }}</h2>
              <p class="tnum mt-1 text-[12px] font-semibold text-muted">
                {{ log.plan.routine.length }} 动作 · 完成 {{ log.completedSets }} /
                {{ log.totalSets }} 组
              </p>
            </div>
            <p
              class="tnum shrink-0 text-[19px] font-black tracking-tight"
              :class="log.status === 'completed' ? 'text-work' : ''"
            >
              {{ formatClock(logDurationSeconds(log.startedAt, log.completedAt)) }}
            </p>
          </div>

          <div v-if="expandedId === log.id" class="mt-3 border-t border-line pt-3">
            <ol class="flex flex-col gap-1.5">
              <li
                v-for="(activity, index) in log.plan.routine"
                :key="`${log.id}-${activity.id}`"
                class="flex items-baseline justify-between gap-3"
              >
                <span class="min-w-0 truncate text-[13px] font-bold">
                  {{ index + 1 }}. {{ activity.name }}
                </span>
                <span class="tnum shrink-0 text-[12px] font-bold text-muted">
                  {{ formatActivityTarget(activity) }}
                </span>
              </li>
            </ol>
            <button
              type="button"
              class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-danger-soft text-[14px] font-extrabold text-danger transition active:scale-[0.98]"
              @click="emit('deleteEntry', log.id)"
            >
              <Trash2 :size="15" :stroke-width="2.3" />
              删除这条记录
            </button>
          </div>

          <button
            type="button"
            class="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-[14px] bg-raised text-[14px] font-extrabold text-muted transition active:scale-[0.98]"
            :aria-expanded="expandedId === log.id"
            @click="toggle(log.id)"
          >
            {{ expandedId === log.id ? '收起' : '查看动作' }}
            <ChevronDown
              :size="15"
              :stroke-width="2.6"
              class="transition-transform"
              :class="expandedId === log.id ? 'rotate-180' : ''"
            />
          </button>
        </article>
      </div>
    </div>

    <BottomSheet :open="isActionsOpen" title="记录操作" @close="isActionsOpen = false">
      <div class="flex flex-col gap-2 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-1">
        <h2 class="tnum pb-2 text-[16px] font-black">共 {{ history.length }} 条记录</h2>
        <button
          type="button"
          class="flex h-14 items-center gap-3 rounded-[18px] bg-ground px-4 text-[15px] font-bold text-danger transition active:scale-[0.98]"
          @click="clearAll"
        >
          <Trash2 :size="18" :stroke-width="2.2" />
          清空全部训练记录
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
