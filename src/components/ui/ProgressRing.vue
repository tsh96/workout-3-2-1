<script setup lang="ts">
import { computed } from 'vue'
import { ringDiameterCss } from '../../lib/layout'

const props = withDefaults(
  defineProps<{
    size?: number
    stroke?: number
    /** Fraction still remaining, 0–1. Ignored when `segments` is set. */
    progress?: number
    color?: string
    track?: string
    /** Draws one arc per set instead of a continuous sweep. */
    segments?: number
    segmentsDone?: number
    /** Shrinks with the viewport so the ring survives short and narrow phones. */
    fluid?: boolean
  }>(),
  {
    size: 288,
    stroke: 13,
    progress: 0,
    color: 'var(--c-work)',
    track: 'var(--c-line)',
    segments: 0,
    segmentsDone: 0,
    fluid: false,
  },
)

const SEGMENT_GAP = 14

const wrapperStyle = computed(() =>
  props.fluid
    ? { width: ringDiameterCss(props.size), aspectRatio: '1' }
    : { width: `${props.size}px`, height: `${props.size}px` },
)

const radius = computed(() => props.size / 2 - props.stroke / 2 - 8)
const circumference = computed(() => 2 * Math.PI * radius.value)

const dashOffset = computed(
  () => circumference.value * (1 - Math.max(0, Math.min(1, props.progress))),
)

const arcs = computed(() => {
  if (props.segments < 1) return []

  const gap = props.segments > 1 ? SEGMENT_GAP : 0
  const length = (circumference.value - gap * props.segments) / props.segments

  return Array.from({ length: props.segments }, (_, index) => ({
    key: index,
    dash: `${length} ${circumference.value - length}`,
    offset: -index * (length + gap),
    done: index < props.segmentsDone,
  }))
})
</script>

<template>
  <div class="relative shrink-0" :style="wrapperStyle">
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      class="block h-full w-full -rotate-90"
      aria-hidden="true"
      focusable="false"
    >
      <template v-if="arcs.length">
        <circle
          v-for="arc in arcs"
          :key="arc.key"
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="arc.done ? color : track"
          :stroke-width="stroke"
          stroke-linecap="round"
          :stroke-dasharray="arc.dash"
          :stroke-dashoffset="arc.offset"
        />
      </template>
      <template v-else>
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="track"
          :stroke-width="stroke"
        />
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="color"
          :stroke-width="stroke"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          class="transition-[stroke-dashoffset] duration-700 ease-linear"
        />
      </template>
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <slot />
    </div>
  </div>
</template>
