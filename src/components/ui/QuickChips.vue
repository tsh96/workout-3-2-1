<script setup lang="ts">
defineProps<{
  modelValue: number
  values: number[]
  label: string
  accent?: 'work' | 'rest'
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<template>
  <div class="flex gap-[7px]" role="group" :aria-label="`${label}快捷值`">
    <button
      v-for="value in values"
      :key="value"
      type="button"
      class="tnum h-11 flex-grow rounded-[14px] border text-[14px] transition active:scale-95"
      :class="
        modelValue === value
          ? accent === 'rest'
            ? 'border-rest bg-rest-soft font-extrabold text-rest'
            : 'border-work bg-work-soft font-extrabold text-work'
          : 'border-line bg-ground font-bold text-muted'
      "
      :aria-pressed="modelValue === value"
      @click="emit('update:modelValue', value)"
    >
      {{ value }}
    </button>
  </div>
</template>
