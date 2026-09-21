<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  modelValue: string
  options: { label: string; value: string; icon?: Component }[]
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div
    class="flex h-[54px] gap-1 rounded-2xl border border-line bg-ground p-1"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="flex flex-grow items-center justify-center gap-1.5 rounded-xl text-[14px] transition"
      :class="
        modelValue === option.value
          ? 'bg-work-fill font-extrabold text-work-on'
          : 'font-bold text-muted active:bg-raised'
      "
      @click="emit('update:modelValue', option.value)"
    >
      <component :is="option.icon" v-if="option.icon" :size="15" :stroke-width="2.3" />
      {{ option.label }}
    </button>
  </div>
</template>
