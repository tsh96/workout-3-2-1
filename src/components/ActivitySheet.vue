<script setup lang="ts">
import { Dumbbell, Timer, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import BottomSheet from './ui/BottomSheet.vue'
import NumberStepper from './ui/NumberStepper.vue'
import QuickChips from './ui/QuickChips.vue'
import SegmentedControl from './ui/SegmentedControl.vue'
import { normalizeTarget } from '../lib/storage'
import type { Activity, ActivityMode } from '../lib/types'

const props = defineProps<{
  open: boolean
  activity: Activity | null
  position: number
  isLast: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [activity: Activity]
  remove: [id: string]
}>()

const draft = ref<Activity | null>(null)

const MODE_OPTIONS = [
  { label: '计次', value: 'reps', icon: Dumbbell },
  { label: '计时', value: 'time', icon: Timer },
]

const REP_CHIPS = [8, 10, 12, 15, 20]
const TIME_CHIPS = [20, 30, 45, 60, 90]
const REST_CHIPS = [0, 15, 30, 45, 60]

watch(
  () => [props.open, props.activity] as const,
  ([open, activity]) => {
    draft.value = open && activity ? { ...activity } : null
  },
  { immediate: true },
)

const isReps = computed(() => draft.value?.mode === 'reps')
const targetLabel = computed(() => (isReps.value ? '每组次数' : '每组秒数'))
const targetChips = computed(() => (isReps.value ? REP_CHIPS : TIME_CHIPS))
const targetMax = computed(() => (isReps.value ? 200 : 900))
const targetStep = computed(() => (isReps.value ? 1 : 5))

function setMode(value: string) {
  if (!draft.value) return
  const mode = value as ActivityMode
  if (draft.value.mode === mode) return

  draft.value.mode = mode
  // A 15-rep set and a 15-second set are not the same exercise; re-seed sanely.
  draft.value.target = normalizeTarget(mode === 'reps' ? 12 : 30)
}

function save() {
  if (!draft.value) return
  emit('save', { ...draft.value, name: draft.value.name.trim() || '未命名动作' })
}
</script>

<template>
  <BottomSheet :open="open" title="编辑动作" @close="emit('close')">
    <template v-if="draft">
      <div class="flex h-11 shrink-0 items-center justify-between gap-3 px-5">
        <button
          type="button"
          class="h-11 text-[15px] font-bold text-muted transition active:opacity-60"
          @click="emit('close')"
        >
          取消
        </button>
        <h2 class="truncate text-[16px] font-black tracking-tight">编辑动作 · 第 {{ position }} 个</h2>
        <button
          type="button"
          aria-label="删除动作"
          class="flex h-11 w-11 items-center justify-end text-danger transition active:scale-95 disabled:opacity-30"
          :disabled="!canDelete"
          @click="emit('remove', draft.id)"
        >
          <Trash2 :size="19" :stroke-width="2.1" />
        </button>
      </div>

      <div class="min-h-0 flex-grow overflow-y-auto px-5 pt-3.5">
        <label for="activityName" class="block text-[11px] font-extrabold tracking-[0.14em] text-muted">
          动作名称
        </label>
        <input
          id="activityName"
          v-model="draft.name"
          type="text"
          maxlength="24"
          placeholder="动作名称"
          class="mt-2 h-[52px] w-full rounded-2xl border border-line bg-ground px-4 text-[17px] font-extrabold outline-none placeholder:font-bold placeholder:text-faint"
        />

        <p class="mt-4 text-[11px] font-extrabold tracking-[0.14em] text-muted">计量方式</p>
        <SegmentedControl
          :model-value="draft.mode"
          :options="MODE_OPTIONS"
          label="计量方式"
          class="mt-2"
          @update:model-value="setMode"
        />

        <div class="mt-4 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[15px] font-extrabold">组数</p>
            <p class="mt-0.5 text-[11px] font-semibold text-muted">这个动作重复几组</p>
          </div>
          <NumberStepper v-model="draft.sets" label="组数" :min="1" :max="99" />
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-[15px] font-extrabold">{{ targetLabel }}</p>
            <NumberStepper
              v-model="draft.target"
              :label="targetLabel"
              :min="1"
              :max="targetMax"
              :step="targetStep"
            />
          </div>
          <QuickChips
            v-model="draft.target"
            :values="targetChips"
            :label="targetLabel"
            class="mt-2"
          />
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[15px] font-extrabold">组间休息</p>
              <p class="mt-0.5 text-[11px] font-semibold text-muted">同一动作，两组之间</p>
            </div>
            <NumberStepper
              v-model="draft.setRestSeconds"
              label="组间休息"
              :min="0"
              :max="600"
              :step="5"
              suffix=" 秒"
              :value-width="58"
            />
          </div>
          <QuickChips
            v-model="draft.setRestSeconds"
            :values="REST_CHIPS"
            label="组间休息"
            accent="rest"
            class="mt-2"
          />
        </div>

        <div class="mt-4 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[15px] font-extrabold">动作间休息</p>
            <p class="mt-0.5 text-[11px] font-semibold text-muted">
              {{ isLast ? '这是最后一个动作，后面没有休息' : '做完这个动作，进入下一个前' }}
            </p>
          </div>
          <NumberStepper
            v-model="draft.nextRestSeconds"
            label="动作间休息"
            :min="0"
            :max="600"
            :step="5"
            suffix=" 秒"
            :value-width="58"
            :disabled="isLast"
          />
        </div>
      </div>

      <div class="shrink-0 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-3.5">
        <button
          type="button"
          class="flex h-[62px] w-full items-center justify-center rounded-[21px] bg-work-fill text-[18px] font-black text-work-on transition active:scale-[0.98]"
          @click="save"
        >
          保存动作
        </button>
      </div>
    </template>
  </BottomSheet>
</template>
