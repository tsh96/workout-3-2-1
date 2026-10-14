<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'

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

/* Stepping 5 s at a time is fine for small nudges, so the readout also takes a typed value. */
const typed = ref<string | null>(null)
const shown = computed(() => typed.value ?? String(props.modelValue))

function clamp(value: number) {
  return Math.max(props.min, Math.min(props.max, value))
}

function nudge(direction: 1 | -1) {
  if (props.disabled) return
  const next = clamp(props.modelValue + direction * props.step)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function beginTyping(event: FocusEvent) {
  typed.value = String(props.modelValue)
  const input = event.target as HTMLInputElement
  input.select()
}

function onType(event: Event) {
  const input = event.target as HTMLInputElement
  typed.value = input.value.replace(/\D/g, '').slice(0, String(props.max).length)
  input.value = typed.value
}

function commitTyping() {
  const parsed = Number.parseInt(typed.value ?? '', 10)
  typed.value = null
  if (Number.isNaN(parsed)) return

  const next = clamp(parsed)
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
    <label
      class="tnum flex h-full cursor-text items-center justify-center text-[17px] font-black leading-none transition-colors focus-within:bg-surface"
      :style="{ width: `${valueWidth}px` }"
    >
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        enterkeyhint="done"
        autocomplete="off"
        class="min-w-0 bg-transparent p-0 text-center outline-none disabled:cursor-default"
        :style="{ width: `${Math.max(shown.length, 1)}ch` }"
        :value="shown"
        :aria-label="label"
        :disabled="disabled"
        @focus="beginTyping"
        @input="onType"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @blur="commitTyping"
      />
      <span v-if="suffix" class="whitespace-pre" aria-hidden="true">{{ suffix }}</span>
    </label>
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
