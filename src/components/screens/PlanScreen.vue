<script setup lang="ts">
import {
  ChevronRight,
  Copy,
  Dumbbell,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Timer,
  Trash2,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import BottomSheet from '../ui/BottomSheet.vue'
import NumberStepper from '../ui/NumberStepper.vue'
import { countSets } from '../../lib/storage'
import { estimatePlanSeconds, formatActivitySummary, formatClock } from '../../lib/format'
import type { WorkoutPlan } from '../../lib/types'

const props = defineProps<{ plans: WorkoutPlan[]; plan: WorkoutPlan }>()

const emit = defineEmits<{
  selectPlan: [id: string]
  addPlan: []
  renamePlan: []
  duplicatePlan: []
  deletePlan: []
  updateCountdown: [seconds: number]
  editActivity: [id: string]
  addActivity: []
  reorder: [fromId: string, toId: string]
}>()

const isActionsOpen = ref(false)
const draggingId = ref<string | null>(null)

const totalSets = computed(() => countSets(props.plan.routine))
const estimate = computed(() => formatClock(estimatePlanSeconds(props.plan)))

const listEl = ref<HTMLElement | null>(null)
let pointerY = 0
let scrollFrame = 0

/** How close to the list's top or bottom edge a dragged row has to be before the list scrolls. */
const AUTO_SCROLL_EDGE = 36
const AUTO_SCROLL_MAX_STEP = 10

function reorderUnderPointer() {
  const from = draggingId.value
  const list = listEl.value
  if (!from || !list) return

  // Hit-test down the middle of the list, clamped inside it, so a finger that
  // has slid past the edge still targets the row at that edge.
  const rect = list.getBoundingClientRect()
  const y = Math.min(Math.max(pointerY, rect.top + 1), rect.bottom - 1)
  const target = document
    .elementFromPoint(rect.left + rect.width / 2, y)
    ?.closest<HTMLElement>('[data-activity-id]')
  const to = target?.dataset.activityId
  if (!to || to === from) return

  emit('reorder', from, to)
}

/** Keep scrolling while the dragged row is held near (or past) the top or bottom of the list. */
function autoScroll() {
  const list = listEl.value
  if (!draggingId.value || !list) return

  const rect = list.getBoundingClientRect()
  let speed = 0
  if (pointerY < rect.top + AUTO_SCROLL_EDGE) {
    speed = -Math.min(1, (rect.top + AUTO_SCROLL_EDGE - pointerY) / AUTO_SCROLL_EDGE)
  } else if (pointerY > rect.bottom - AUTO_SCROLL_EDGE) {
    speed = Math.min(1, (pointerY - rect.bottom + AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE)
  }

  if (speed !== 0) {
    const before = list.scrollTop
    list.scrollTop += speed * AUTO_SCROLL_MAX_STEP
    if (list.scrollTop !== before) reorderUnderPointer()
  }

  scrollFrame = requestAnimationFrame(autoScroll)
}

function onDragMove(event: PointerEvent) {
  if (!draggingId.value) return

  event.preventDefault()
  pointerY = event.clientY
  reorderUnderPointer()
}

function stopDrag() {
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
  draggingId.value = null
}

function startDrag(event: PointerEvent, id: string) {
  if (props.plan.routine.length <= 1) return

  event.preventDefault()
  draggingId.value = id
  pointerY = event.clientY
  scrollFrame = requestAnimationFrame(autoScroll)
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  window.addEventListener('pointermove', onDragMove, { passive: false })
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}

function duplicateAndClose() {
  isActionsOpen.value = false
  emit('duplicatePlan')
}

function deleteAndClose() {
  isActionsOpen.value = false
  emit('deletePlan')
}

onBeforeUnmount(stopDrag)
</script>

<template>
  <div class="flex min-h-0 flex-grow flex-col">
    <header class="flex shrink-0 items-start justify-between gap-3 px-5 pt-[max(22px,env(safe-area-inset-top))]">
      <div class="min-w-0">
        <p class="tnum text-[11px] font-extrabold tracking-[0.2em] text-muted">
          {{ plans.length }} 个计划
        </p>
        <h1 class="mt-1 text-[28px] font-black leading-none tracking-tight">计划</h1>
      </div>
      <button
        type="button"
        aria-label="计划操作"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-line bg-surface transition active:scale-95"
        @click="isActionsOpen = true"
      >
        <MoreVertical :size="19" :stroke-width="2.2" />
      </button>
    </header>

    <div class="flex shrink-0 items-center gap-2 overflow-x-auto px-5 pt-4">
      <button
        v-for="item in plans"
        :key="item.id"
        type="button"
        :aria-pressed="item.id === plan.id"
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
      <button
        type="button"
        aria-label="新建计划"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-work transition active:scale-95"
        @click="emit('addPlan')"
      >
        <Plus :size="16" :stroke-width="2.6" />
      </button>
    </div>

    <section class="mx-5 mt-4 shrink-0 rounded-[22px] border border-line bg-surface p-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="min-w-0 truncate text-[22px] font-black tracking-tight">
          {{ plan.name || '未命名计划' }}
        </h2>
        <button
          type="button"
          aria-label="重命名计划"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-raised text-work transition active:scale-95"
          @click="emit('renamePlan')"
        >
          <Pencil :size="16" :stroke-width="2.2" />
        </button>
      </div>

      <div class="my-3.5 h-px bg-line"></div>

      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[14px] font-bold">开始前准备</p>
          <p class="mt-0.5 text-[11px] font-semibold text-muted">第一个动作前的倒数</p>
        </div>
        <NumberStepper
          :model-value="plan.startCountdownSeconds"
          label="准备秒数"
          :min="0"
          :max="60"
          :step="1"
          suffix=" 秒"
          :value-width="58"
          compact
          @update:model-value="emit('updateCountdown', $event)"
        />
      </div>
    </section>

    <div class="flex shrink-0 items-baseline justify-between gap-2.5 px-5 pt-[18px]">
      <p class="tnum text-[12px] font-extrabold tracking-[0.14em] text-muted">
        动作 · {{ plan.routine.length }} · {{ totalSets }} 组
      </p>
      <p class="tnum text-[12px] font-extrabold text-work">预计 {{ estimate }}</p>
    </div>

    <!-- No scroll anchoring: it would undo the auto-scroll every time a dragged row hops up past the anchor. -->
    <ol
      ref="listEl"
      class="flex min-h-0 flex-grow flex-col gap-2 overflow-y-auto px-5 pt-2.5 [overflow-anchor:none]"
    >
      <li
        v-for="(activity, index) in plan.routine"
        :key="activity.id"
        :data-activity-id="activity.id"
        class="flex h-[74px] shrink-0 items-center overflow-hidden rounded-[20px] border transition"
        :class="
          draggingId === activity.id
            ? 'border-work bg-work-soft'
            : 'border-line bg-surface'
        "
      >
        <button
          type="button"
          :aria-label="`拖动排序：${activity.name}`"
          class="flex h-[74px] w-11 shrink-0 touch-none items-center justify-center text-faint disabled:opacity-30"
          :disabled="plan.routine.length <= 1"
          @pointerdown="startDrag($event, activity.id)"
        >
          <GripVertical :size="18" :stroke-width="2.2" />
        </button>
        <button
          type="button"
          class="flex h-[74px] min-w-0 flex-grow items-center gap-3 pr-3.5 text-left transition active:opacity-70"
          @click="emit('editActivity', activity.id)"
        >
          <span
            class="tnum flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl text-[13px] font-black"
            :class="
              draggingId === activity.id
                ? 'bg-work-fill text-work-on'
                : 'bg-work-soft text-work'
            "
            >{{ index + 1 }}</span
          >
          <span class="min-w-0 flex-grow">
            <span class="flex items-center gap-1.5">
              <Dumbbell
                v-if="activity.mode === 'reps'"
                :size="14"
                :stroke-width="2.2"
                class="shrink-0 text-muted"
              />
              <Timer v-else :size="14" :stroke-width="2.2" class="shrink-0 text-muted" />
              <span class="truncate text-[16px] font-extrabold">{{ activity.name }}</span>
            </span>
            <span class="tnum mt-1 block truncate text-[12px] font-semibold text-muted">
              {{ formatActivitySummary(activity, index === plan.routine.length - 1) }}
            </span>
          </span>
          <ChevronRight :size="18" :stroke-width="2.4" class="shrink-0 text-faint" />
        </button>
      </li>
    </ol>

    <div class="shrink-0 px-5 pt-3">
      <button
        type="button"
        class="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[18px] border border-dashed border-line text-[15px] font-extrabold text-work transition active:scale-[0.98]"
        @click="emit('addActivity')"
      >
        <Plus :size="18" :stroke-width="2.6" />
        添加动作
      </button>
    </div>

    <BottomSheet :open="isActionsOpen" title="计划操作" @close="isActionsOpen = false">
      <div class="flex flex-col gap-2 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-1">
        <h2 class="pb-2 text-[16px] font-black">{{ plan.name || '未命名计划' }}</h2>
        <button
          type="button"
          class="flex h-14 items-center gap-3 rounded-[18px] bg-ground px-4 text-[15px] font-bold transition active:scale-[0.98]"
          @click="duplicateAndClose"
        >
          <Copy :size="18" :stroke-width="2.2" class="text-muted" />
          复制这个计划
        </button>
        <button
          type="button"
          class="flex h-14 items-center gap-3 rounded-[18px] bg-ground px-4 text-[15px] font-bold text-danger transition active:scale-[0.98] disabled:opacity-40"
          :disabled="plans.length <= 1"
          @click="deleteAndClose"
        >
          <Trash2 :size="18" :stroke-width="2.2" />
          删除这个计划
        </button>
        <p v-if="plans.length <= 1" class="px-1 pt-1 text-[12px] font-semibold text-muted">
          至少要保留一个计划。
        </p>
      </div>
    </BottomSheet>
  </div>
</template>
