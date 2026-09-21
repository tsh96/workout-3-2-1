<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    class="flex h-11 w-[52px] shrink-0 items-center"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="flex h-8 w-[52px] items-center rounded-full p-[3px] transition-colors"
      :class="modelValue ? 'justify-end bg-work-fill' : 'justify-start bg-line'"
    >
      <span
        class="block h-[26px] w-[26px] rounded-full transition-colors"
        :class="modelValue ? 'bg-work-on' : 'bg-faint'"
      ></span>
    </span>
  </button>
</template>
