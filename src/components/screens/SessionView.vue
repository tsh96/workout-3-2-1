<script setup lang="ts">
import {
  Check,
  ChevronRight,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-vue-next'
import { computed } from 'vue'
import ProgressRing from '../ui/ProgressRing.vue'
import { formatActionTarget, formatClock } from '../../lib/format'
import { ringNumeralCss } from '../../lib/layout'
import type { Activity, PhaseAccent, SessionPhase, WorkoutStep } from '../../lib/types'

const props = defineProps<{
  planName: string
  phase: SessionPhase
  accent: PhaseAccent
  isRunning: boolean
  isManualAction: boolean
  secondsLeft: number
  progress: number
  startCountdownSeconds: number
  currentActivity: Activity | undefined
  currentSetIndex: number
  restLabel: string
  restTotalSeconds: number
  completedSets: number
  totalSets: number
  elapsedSeconds: number
  setElapsedSeconds: number
  nextStep: WorkoutStep | null
  upcomingRest: { label: string; seconds: number; step: WorkoutStep } | null
  voiceEnabled: boolean
  activityCount: number
}>()

const emit = defineEmits<{
  stop: []
  togglePause: []
  skip: []
  adjustRest: [delta: number]
  restart: []
  toggleVoice: []
  viewHistory: []
}>()

/*
 * `bar`, `pill` and `ring` are indicators, so they use the toned token, which
 * stays readable in light mode. `solid` is for filled controls, which keep the
 * loud brand colour in both themes. In dark mode the two tokens are the same
 * value, so the phase reads as one colour either way.
 */
const ACCENTS = {
  work: {
    bar: 'bg-work',
    text: 'text-work',
    pill: 'bg-work-soft text-work',
    solid: 'bg-work-fill text-work-on',
    ring: 'var(--c-work)',
  },
  rest: {
    bar: 'bg-rest',
    text: 'text-rest',
    pill: 'bg-rest-soft text-rest',
    solid: 'bg-rest-fill text-rest-on',
    ring: 'var(--c-rest)',
  },
  prep: {
    bar: 'bg-prep',
    text: 'text-prep',
    pill: 'bg-prep-soft text-prep',
    solid: 'bg-prep-fill text-prep-on',
    ring: 'var(--c-prep)',
  },
} as const

const tone = computed(() => ACCENTS[props.accent])

const phaseLabel = computed(() => {
  if (props.phase === 'countdown') return '准 备 开 始'
  if (props.phase === 'rest') return props.restLabel
  return props.currentActivity?.mode === 'reps' ? '计次动作 · 自己掌握节奏' : '计时动作'
})

const setCount = computed(() => props.currentActivity?.sets ?? 1)

/** What the big number in the ring means right now. */
const readout = computed(() => {
  if (props.phase === 'countdown') return { value: props.secondsLeft, caption: '秒 后 开 始' }
  if (props.phase === 'rest') return { value: props.secondsLeft, caption: '秒 后 继 续' }
  if (props.isManualAction) return { value: props.currentActivity?.target ?? 0, caption: '次 一 组' }
  return { value: props.secondsLeft, caption: '秒 剩 余' }
})

const readoutFontSize = computed(() => ringNumeralCss(String(readout.value.value).length))

const subReadout = computed(() => {
  if (props.phase === 'countdown') return `共 ${props.startCountdownSeconds} 秒`
  if (props.phase === 'rest') return `共 ${props.restTotalSeconds} 秒`
  if (props.isManualAction) return `本组已用 ${formatClock(props.setElapsedSeconds)}`
  return `目标 ${props.currentActivity?.target ?? 0} 秒`
})

/** Rest names what is coming next, not the set you just finished. */
const headingName = computed(() => {
  if (props.phase === 'rest') return ''
  if (props.phase === 'countdown') return props.nextStep?.activity.name ?? ''
  return props.currentActivity?.name ?? ''
})

const setLine = computed(() => {
  if (props.phase === 'countdown' && props.nextStep) {
    const { activity, setIndex } = props.nextStep
    return `第 ${setIndex + 1} / ${activity.sets} 组 · ${formatActionTarget(activity)}`
  }
  if (props.phase === 'action' && props.currentActivity) {
    return `单组 · ${formatActionTarget(props.currentActivity)}`
  }
  return ''
})

/**
 * Reps and rests are the two phases you actively leave, so there the wide
 * button advances and pause shrinks to a square.
 */
const advanceIsPrimary = computed(() => props.isManualAction || props.phase === 'rest')
const advanceLabel = computed(() => (props.isManualAction ? '完成这组' : '跳过休息'))

const nextStepText = computed(() => {
  if (props.upcomingRest) {
    const { label, seconds, step } = props.upcomingRest
    return `${label} ${seconds} 秒 → ${step.activity.name} 第 ${step.setIndex + 1} 组`
  }
  if (props.phase === 'action') return '这是最后一组，之后就完成了'
  return ''
})

const restPercent = computed(() =>
  props.totalSets > 0 ? Math.round((props.completedSets / props.totalSets) * 100) : 0,
)
</script>

<template>
  <div class="flex h-[100dvh] flex-col bg-ground text-ink">
    <div class="h-1 shrink-0 transition-colors" :class="tone.bar"></div>

    <!-- Completion summary -->
    <template v-if="phase === 'done'">
      <header class="flex h-[60px] shrink-0 items-center justify-end px-4">
        <button
          type="button"
          aria-label="关闭"
          class="flex h-11 w-11 items-center justify-center rounded-[15px] bg-raised transition active:scale-95"
          @click="emit('stop')"
        >
          <X :size="17" :stroke-width="2.6" />
        </button>
      </header>

      <main
        class="flex flex-grow flex-col items-center justify-center gap-7 overflow-y-auto px-6 py-2"
      >
        <ProgressRing :size="168" :stroke="10" :progress="1" color="var(--c-work)">
          <Check :size="76" :stroke-width="2.3" class="text-work" />
        </ProgressRing>

        <div class="text-center">
          <h1 class="text-[36px] font-black leading-tight tracking-tight">训练完成</h1>
          <p class="mt-2.5 text-[15px] font-bold text-muted">{{ planName }}</p>
        </div>

        <div class="grid w-full grid-cols-2 gap-2.5">
          <div class="rounded-[20px] border border-line bg-surface p-4">
            <p class="text-[11px] font-extrabold tracking-[0.14em] text-muted">总用时</p>
            <p class="tnum mt-2 text-[30px] font-black leading-none tracking-tight text-work">
              {{ formatClock(elapsedSeconds) }}
            </p>
          </div>
          <div class="rounded-[20px] border border-line bg-surface p-4">
            <p class="text-[11px] font-extrabold tracking-[0.14em] text-muted">完成组数</p>
            <p class="tnum mt-2 text-[30px] font-black leading-none tracking-tight">
              {{ completedSets }} / {{ totalSets }}
            </p>
          </div>
          <div class="rounded-[20px] border border-line bg-surface p-4">
            <p class="text-[11px] font-extrabold tracking-[0.14em] text-muted">动作</p>
            <p class="tnum mt-2 text-[30px] font-black leading-none tracking-tight">
              {{ activityCount }}
            </p>
          </div>
          <div class="rounded-[20px] border border-line bg-surface p-4">
            <p class="text-[11px] font-extrabold tracking-[0.14em] text-muted">完成率</p>
            <p class="tnum mt-2 text-[30px] font-black leading-none tracking-tight text-rest">
              {{ restPercent }}%
            </p>
          </div>
        </div>

        <div class="flex w-full items-center gap-2.5">
          <span class="h-px flex-grow bg-line"></span>
          <span class="text-[11px] font-extrabold tracking-[0.16em] text-faint">已保存到记录</span>
          <span class="h-px flex-grow bg-line"></span>
        </div>
      </main>

      <footer
        class="flex shrink-0 flex-col gap-2.5 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-3"
      >
        <button
          type="button"
          class="flex h-[66px] items-center justify-center gap-2.5 rounded-[22px] bg-work-fill text-[19px] font-black text-work-on transition active:scale-[0.98]"
          @click="emit('restart')"
        >
          <Repeat :size="20" :stroke-width="2.6" />
          再来一轮
        </button>
        <button
          type="button"
          class="flex h-14 items-center justify-center rounded-[20px] bg-raised text-[16px] font-extrabold transition active:scale-[0.98]"
          @click="emit('viewHistory')"
        >
          查看训练记录
        </button>
      </footer>
    </template>

    <!-- Countdown, work and rest -->
    <template v-else>
      <header class="flex h-[60px] shrink-0 items-center justify-between px-4">
        <button
          type="button"
          aria-label="结束训练"
          class="flex h-11 w-11 items-center justify-center rounded-[15px] bg-raised transition active:scale-95"
          @click="emit('stop')"
        >
          <X :size="17" :stroke-width="2.6" />
        </button>
        <div class="flex min-w-0 flex-col items-center gap-0.5">
          <span class="max-w-[190px] truncate text-[14px] font-extrabold">{{ planName }}</span>
          <span class="tnum text-[11px] font-bold tracking-[0.1em] text-muted">
            {{ completedSets }} / {{ totalSets }} 组完成
          </span>
        </div>
        <button
          type="button"
          :aria-label="voiceEnabled ? '关闭语音提示' : '开启语音提示'"
          class="flex h-11 w-11 items-center justify-center rounded-[15px] bg-raised transition active:scale-95"
          @click="emit('toggleVoice')"
        >
          <Volume2 v-if="voiceEnabled" :size="19" :stroke-width="2" />
          <VolumeX v-else :size="19" :stroke-width="2" class="text-muted" />
        </button>
      </header>

      <div class="shrink-0 px-6 pt-1.5 text-center">
        <p
          class="inline-flex h-7 items-center rounded-full px-3.5 text-[11px] font-extrabold tracking-[0.16em] transition-colors"
          :class="tone.pill"
        >
          {{ phaseLabel }}
        </p>

        <h1
          v-if="headingName"
          class="mt-3 truncate text-[clamp(27px,4.6vh,38px)] font-black leading-tight tracking-tight"
        >
          {{ headingName }}
        </h1>

        <div
          v-if="phase === 'action' && setCount > 1"
          class="mt-3 flex items-center justify-center gap-2.5"
        >
          <span class="flex gap-1.5" aria-hidden="true">
            <span
              v-for="index in setCount"
              :key="index"
              class="block h-[5px] w-[30px] rounded-full transition-colors"
              :class="index <= currentSetIndex + 1 ? 'bg-work' : 'bg-line'"
            ></span>
          </span>
          <span class="tnum text-[13px] font-extrabold text-ink"
            >第 {{ currentSetIndex + 1 }} / {{ setCount }} 组</span
          >
        </div>
        <p v-else-if="setLine" class="tnum mt-2.5 text-[13px] font-extrabold text-muted">
          {{ setLine }}
        </p>
      </div>

      <main class="flex min-h-0 flex-grow items-center justify-center px-5">
        <ProgressRing
          :size="288"
          fluid
          :progress="progress"
          :color="tone.ring"
          track="var(--c-line)"
          :segments="isManualAction ? setCount : 0"
          :segments-done="currentSetIndex + 1"
        >
          <span
            class="tnum font-black leading-[0.82] tracking-[-0.05em] transition-colors"
            :class="isManualAction ? 'text-ink' : tone.text"
            :style="{ fontSize: readoutFontSize }"
            role="timer"
            aria-live="off"
            >{{ readout.value }}</span
          >
          <span class="mt-3.5 text-[12px] font-extrabold tracking-[0.28em] text-muted">
            {{ readout.caption }}
          </span>
          <span class="tnum mt-1.5 text-[13px] font-bold text-faint">{{ subReadout }}</span>
        </ProgressRing>
      </main>

      <!-- Rest gets its quick adjustments and a loud "what's next" card -->
      <template v-if="phase === 'rest'">
        <div class="flex shrink-0 gap-2.5 px-5">
          <button
            type="button"
            class="tnum flex h-[50px] flex-grow items-center justify-center gap-1.5 rounded-[17px] border border-line bg-surface text-[15px] font-extrabold transition active:scale-95"
            @click="emit('adjustRest', -10)"
          >
            <Minus :size="16" :stroke-width="2.8" class="text-rest" />
            10 秒
          </button>
          <button
            type="button"
            class="tnum flex h-[50px] flex-grow items-center justify-center gap-1.5 rounded-[17px] border border-line bg-surface text-[15px] font-extrabold transition active:scale-95"
            @click="emit('adjustRest', 20)"
          >
            <Plus :size="16" :stroke-width="2.8" class="text-rest" />
            20 秒
          </button>
        </div>

        <div
          v-if="nextStep"
          class="mx-5 mt-3 flex shrink-0 items-center gap-3.5 rounded-[22px] bg-rest-fill px-[18px] py-4 text-rest-on"
        >
          <div class="min-w-0 flex-grow">
            <p class="text-[11px] font-black tracking-[0.18em] opacity-70">接 下 来</p>
            <p class="mt-1.5 truncate text-[23px] font-black leading-tight tracking-tight">
              {{ nextStep.activity.name }}
            </p>
            <p class="tnum mt-1 text-[13px] font-extrabold opacity-80">
              第 {{ nextStep.setIndex + 1 }} / {{ nextStep.activity.sets }} 组 ·
              {{ formatActionTarget(nextStep.activity) }}
            </p>
          </div>
          <ChevronRight :size="24" :stroke-width="2.6" class="shrink-0" />
        </div>
      </template>

      <!-- Work and countdown get a quiet one-liner -->
      <div
        v-else-if="phase === 'action'"
        class="mx-5 flex h-[66px] shrink-0 items-center gap-3 rounded-[20px] border border-line bg-surface px-4"
      >
        <div class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-rest-soft">
          <RotateCcw :size="17" :stroke-width="2.2" class="text-rest" />
        </div>
        <div class="min-w-0 flex-grow">
          <p class="text-[11px] font-extrabold tracking-[0.14em] text-muted">下一步</p>
          <p class="tnum mt-0.5 truncate text-[14px] font-bold">{{ nextStepText }}</p>
        </div>
      </div>

      <footer
        class="flex shrink-0 gap-2.5 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-3.5"
      >
        <template v-if="advanceIsPrimary">
          <button
            type="button"
            :aria-label="isRunning ? '暂停' : '继续'"
            class="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[22px] bg-raised transition active:scale-95"
            @click="emit('togglePause')"
          >
            <Play v-if="!isRunning" :size="19" fill="currentColor" stroke="none" />
            <Pause v-else :size="19" fill="currentColor" stroke="none" />
          </button>
          <button
            type="button"
            class="flex h-[68px] flex-grow items-center justify-center gap-2.5 rounded-[22px] text-[19px] font-black transition active:scale-[0.98]"
            :class="tone.solid"
            @click="emit('skip')"
          >
            <Check v-if="isManualAction" :size="22" :stroke-width="2.8" />
            <SkipForward v-else :size="20" fill="currentColor" stroke="currentColor" :stroke-width="2.4" />
            {{ advanceLabel }}
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            class="flex h-[68px] flex-grow items-center justify-center gap-2.5 rounded-[22px] bg-raised text-[18px] font-extrabold transition active:scale-[0.98]"
            @click="emit('togglePause')"
          >
            <Play v-if="!isRunning" :size="19" fill="currentColor" stroke="none" />
            <Pause v-else :size="19" fill="currentColor" stroke="none" />
            {{ isRunning ? '暂停' : '继续' }}
          </button>
          <button
            type="button"
            aria-label="跳到下一步"
            class="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[22px] transition active:scale-95"
            :class="tone.solid"
            @click="emit('skip')"
          >
            <SkipForward :size="22" fill="currentColor" stroke="currentColor" :stroke-width="2.4" />
          </button>
        </template>
      </footer>
    </template>
  </div>
</template>
