<script setup lang="ts">
import { BarChart3, ListChecks, Timer } from 'lucide-vue-next'
import type { AppTab } from '../../lib/types'

defineProps<{ active: AppTab }>()
const emit = defineEmits<{ change: [tab: AppTab] }>()

const tabs: { id: AppTab; label: string; icon: typeof Timer }[] = [
  { id: 'train', label: '训练', icon: Timer },
  { id: 'plan', label: '计划', icon: ListChecks },
  { id: 'history', label: '记录', icon: BarChart3 },
]
</script>

<template>
  <nav
    class="grid shrink-0 grid-cols-3 border-t border-line bg-ground px-2 pb-[max(20px,env(safe-area-inset-bottom))] pt-2.5"
    aria-label="主导航"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-1.5 transition"
      :class="active === tab.id ? 'text-work' : 'text-muted'"
      :aria-current="active === tab.id ? 'page' : undefined"
      @click="emit('change', tab.id)"
    >
      <component :is="tab.icon" :size="22" :stroke-width="2.1" />
      <span class="text-[11px] font-extrabold">{{ tab.label }}</span>
    </button>
  </nav>
</template>
