<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    min?: number
    max?: number
    step?: number
    suffix?: string
    /** Width of the value readout; widen it when the number carries a unit. */
    valueWidth?: number
    compact?: boolean
    disabled?: boolean
  }>(),
  { min: 0, max: 999, step: 1, suffix: '', valueWidth: 46, compact: false, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const buttonSize = computed(() => (props.compact ? 'h-11 w-11' : 'h-12 w-12'))
const boxHeight = computed(() => (props.compact ? 'h-11' : 'h-12'))

function clamp(value: number) {
  return Math.max(props.min, Math.min(props.max, value))
}

function nudge(direction: 1 | -1) {
  if (props.disabled) return
  const next = clamp(props.modelValue + direction * props.step)
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<template>
  <div
    class="flex shrink-0 items-center overflow-hidden rounded-2xl border border-line bg-ground"
    :class="[boxHeight, disabled ? 'opacity-40' : '']"
  >
    <button
      type="button"
      class="flex items-center justify-center text-muted transition active:scale-95 disabled:opacity-40"
      :class="buttonSize"
      :aria-label="`减少${label}`"
      :disabled="disabled || modelValue <= min"
      @click="nudge(-1)"
    >
      <Minus :size="16" :stroke-width="2.8" />
    </button>
    <span
      class="tnum text-center text-[17px] font-black leading-none"
      :style="{ width: `${valueWidth}px` }"
      aria-live="off"
      >{{ modelValue }}{{ suffix }}</span
    >
    <button
      type="button"
      class="flex items-center justify-center text-muted transition active:scale-95 disabled:opacity-40"
      :class="buttonSize"
      :aria-label="`增加${label}`"
      :disabled="disabled || modelValue >= max"
      @click="nudge(1)"
    >
      <Plus :size="16" :stroke-width="2.8" />
    </button>
  </div>
</template>
