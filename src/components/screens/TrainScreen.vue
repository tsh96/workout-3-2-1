<script setup lang="ts">
import { Dumbbell, Pencil, Play, Settings, Timer } from 'lucide-vue-next'
import { computed } from 'vue'
import {
  countSets,
} from '../../lib/storage'
import { estimatePlanSeconds, formatActivityTarget, formatClock } from '../../lib/format'
import type { WorkoutPlan } from '../../lib/types'

const props = defineProps<{ plans: WorkoutPlan[]; plan: WorkoutPlan }>()

const emit = defineEmits<{
  selectPlan: [id: string]
  start: []
  openSettings: []
  editPlan: []
}>()

const totalSets = computed(() => countSets(props.plan.routine))
const estimate = computed(() => formatClock(estimatePlanSeconds(props.plan)))
</script>

<template>
  <div class="flex min-h-0 flex-grow flex-col">
    <header class="flex shrink-0 items-start justify-between gap-3 px-5 pt-[max(22px,env(safe-area-inset-top))]">
      <div class="min-w-0">
        <p class="text-[11px] font-extrabold tracking-[0.2em] text-muted">WORKOUT 3-2-1</p>
        <h1 class="mt-1 text-[28px] font-black leading-none tracking-tight">训练</h1>
      </div>
      <button
        type="button"
        aria-label="设置"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-line bg-surface transition active:scale-95"
        @click="emit('openSettings')"
      >
        <Settings :size="19" :stroke-width="1.9" />
      </button>
    </header>

    <div class="flex shrink-0 gap-2 overflow-x-auto px-5 pt-4" role="tablist" aria-label="切换计划">
      <button
        v-for="item in plans"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="item.id === plan.id"
        class="h-11 shrink-0 rounded-full px-4 text-[14px] transition active:scale-95"
        :class="
          item.id === plan.id
            ? 'bg-work-fill font-extrabold text-work-on'
            : 'border border-line bg-surface font-bold text-muted'
        "
        @click="emit('selectPlan', item.id)"
      >
        {{ item.name || '未命名计划' }}
      </button>
    </div>

    <section class="mx-5 mt-4 shrink-0 rounded-3xl border border-line bg-surface p-[18px]">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-extrabold tracking-[0.16em] text-muted">当前计划</p>
          <h2 class="mt-1 truncate text-[25px] font-black leading-tight tracking-tight">
            {{ plan.name || '未命名计划' }}
          </h2>
        </div>
        <button
          type="button"
          class="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-raised px-4 text-[13px] font-extrabold text-work transition active:scale-95"
          @click="emit('editPlan')"
        >
          <Pencil :size="14" :stroke-width="2.2" />
          编辑
        </button>
      </div>

      <dl class="mt-4 grid grid-cols-3 gap-2.5">
        <div>
          <dd class="tnum text-[24px] font-black leading-none tracking-tight">
            {{ plan.routine.length }}
          </dd>
          <dt class="mt-1.5 text-[11px] font-bold text-muted">动作</dt>
        </div>
        <div>
          <dd class="tnum text-[24px] font-black leading-none tracking-tight">{{ totalSets }}</dd>
          <dt class="mt-1.5 text-[11px] font-bold text-muted">总组数</dt>
        </div>
        <div>
          <dd class="tnum text-[24px] font-black leading-none tracking-tight text-work">
            {{ estimate }}
          </dd>
          <dt class="mt-1.5 text-[11px] font-bold text-muted">预计时长</dt>
        </div>
      </dl>
    </section>

    <div class="flex shrink-0 items-baseline justify-between gap-2.5 px-5 pt-[18px]">
      <p class="text-[12px] font-extrabold tracking-[0.14em] text-muted">动作顺序</p>
      <p class="text-[11px] font-bold text-faint">组数 · 目标 / 休息</p>
    </div>

    <ol class="flex min-h-0 flex-grow flex-col gap-2 overflow-y-auto px-5 pt-2.5">
      <li
        v-for="(activity, index) in plan.routine"
        :key="activity.id"
        class="flex h-14 shrink-0 items-center gap-3 rounded-[18px] border border-line bg-surface px-3.5"
      >
        <span class="tnum w-5 text-[13px] font-extrabold text-faint">{{
          String(index + 1).padStart(2, '0')
        }}</span>
        <Dumbbell v-if="activity.mode === 'reps'" :size="17" :stroke-width="2.1" class="shrink-0 text-work" />
        <Timer v-else :size="17" :stroke-width="2.1" class="shrink-0 text-rest" />
        <p class="min-w-0 flex-grow truncate text-[15px] font-bold">{{ activity.name }}</p>
        <div class="shrink-0 text-right">
          <p class="tnum text-[14px] font-extrabold">{{ formatActivityTarget(activity) }}</p>
          <p class="tnum mt-0.5 text-[11px] font-semibold text-muted">
            {{ activity.setRestSeconds }} /
            {{ index === plan.routine.length - 1 ? '—' : activity.nextRestSeconds }} 秒
          </p>
        </div>
      </li>
    </ol>

    <div
      class="mx-5 mt-3.5 flex h-[42px] shrink-0 items-center justify-between rounded-[15px] border border-dashed border-line px-4"
    >
      <span class="text-[13px] font-bold text-muted">开始前准备</span>
      <span class="tnum text-[14px] font-extrabold">{{ plan.startCountdownSeconds }} 秒</span>
    </div>

    <div class="shrink-0 px-5 pt-3.5">
      <button
        type="button"
        class="flex h-[66px] w-full items-center justify-center gap-2.5 rounded-[22px] bg-work-fill text-[19px] font-black text-work-on transition active:scale-[0.98] disabled:opacity-40"
        :disabled="plan.routine.length === 0"
        @click="emit('start')"
      >
        <Play :size="20" fill="currentColor" stroke="none" />
        开始训练
      </button>
    </div>
  </div>
</template>
