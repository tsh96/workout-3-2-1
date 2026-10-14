<script setup lang="ts">
import { ArrowLeft, ChevronRight, Download, Monitor, Moon, Sun, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import AppToggle from '../ui/AppToggle.vue'
import NumberStepper from '../ui/NumberStepper.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import type { AppSettings } from '../../lib/types'

const props = defineProps<{
  settings: AppSettings
  voiceOptions: { label: string; value: string }[]
  selectedVoiceLabel: string
  speechSupported: boolean
  wakeLockSupported: boolean
  hapticsSupported: boolean
  version: string
  hasHistory: boolean
}>()

const emit = defineEmits<{
  back: []
  update: [patch: Partial<AppSettings>]
  exportData: []
  clearHistory: []
}>()

/** Both of these only shape what gets spoken, so they go quiet along with the voice. */
const isVoiceOff = computed(() => !props.settings.voiceEnabled)
const isVoicePickerDisabled = computed(() => isVoiceOff.value || props.voiceOptions.length <= 1)

const THEME_OPTIONS = [
  { label: '跟随系统', value: 'system', icon: Monitor },
  { label: '浅色', value: 'light', icon: Sun },
  { label: '深色', value: 'dark', icon: Moon },
]
</script>

<template>
  <div class="flex h-[100dvh] flex-col overflow-y-auto bg-ground px-5">
    <header class="flex shrink-0 items-center gap-3 pt-[max(20px,env(safe-area-inset-top))]">
      <button
        type="button"
        aria-label="返回"
        class="flex h-11 w-11 items-center justify-center rounded-[15px] border border-line bg-surface transition active:scale-95"
        @click="emit('back')"
      >
        <ArrowLeft :size="19" :stroke-width="2.4" />
      </button>
      <h1 class="text-[26px] font-black tracking-tight">设置</h1>
    </header>

    <h2 class="shrink-0 pb-2 pl-1 pt-6 text-[11px] font-extrabold tracking-[0.16em] text-muted">
      语音提示
    </h2>
    <section class="shrink-0 rounded-[20px] border border-line bg-surface px-4">
      <div class="flex h-[62px] items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[15px] font-bold">训练语音</p>
          <p class="mt-0.5 text-[11px] font-semibold text-muted">
            {{ speechSupported ? '播报动作、组数与倒数' : '这个浏览器不支持语音合成' }}
          </p>
        </div>
        <AppToggle
          :model-value="settings.voiceEnabled"
          label="训练语音"
          @update:model-value="emit('update', { voiceEnabled: $event })"
        />
      </div>

      <div class="h-px bg-line"></div>

      <div
        class="relative flex h-[62px] items-center justify-between gap-3 transition-opacity"
        :class="isVoicePickerDisabled ? 'opacity-40' : ''"
      >
        <div class="min-w-0">
          <p class="text-[15px] font-bold">语音声音</p>
          <p class="mt-0.5 truncate text-[11px] font-semibold text-muted">
            {{ selectedVoiceLabel }}
          </p>
        </div>
        <ChevronRight :size="18" :stroke-width="2.4" class="shrink-0 text-faint" />
        <select
          class="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
          aria-label="语音声音"
          :value="settings.voiceId"
          :disabled="isVoicePickerDisabled"
          @change="emit('update', { voiceId: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="option in voiceOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="h-px bg-line"></div>

      <div class="py-3.5">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 transition-opacity" :class="isVoiceOff ? 'opacity-40' : ''">
            <p class="text-[15px] font-bold">倒数提示</p>
            <p class="mt-0.5 text-[11px] font-semibold text-muted">结束前从第几秒开始报数</p>
          </div>
          <NumberStepper
            :model-value="settings.countdownPromptStartSeconds"
            label="倒数秒数"
            :min="1"
            :max="30"
            :value-width="42"
            compact
            :disabled="isVoiceOff"
            @update:model-value="emit('update', { countdownPromptStartSeconds: $event })"
          />
        </div>
        <p
          class="tnum mt-2.5 text-[12px] font-semibold leading-relaxed text-faint transition-opacity"
          :class="isVoiceOff ? 'opacity-40' : ''"
        >
          现在会从 {{ settings.countdownPromptStartSeconds }} 开始报数，然后进入下一步。
        </p>
      </div>
    </section>

    <h2 class="shrink-0 pb-2 pl-1 pt-5 text-[11px] font-extrabold tracking-[0.16em] text-muted">
      训练时
    </h2>
    <section class="shrink-0 rounded-[20px] border border-line bg-surface px-4">
      <div class="flex h-[62px] items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[15px] font-bold">屏幕常亮</p>
          <p class="mt-0.5 text-[11px] font-semibold text-muted">
            {{ wakeLockSupported ? '训练中不自动锁屏' : '这个浏览器不支持屏幕常亮' }}
          </p>
        </div>
        <AppToggle
          :model-value="settings.keepAwake"
          label="屏幕常亮"
          @update:model-value="emit('update', { keepAwake: $event })"
        />
      </div>

      <div class="h-px bg-line"></div>

      <div class="flex h-[62px] items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[15px] font-bold">震动反馈</p>
          <p class="mt-0.5 text-[11px] font-semibold text-muted">
            {{ hapticsSupported ? '切换动作与休息时震动' : '这个设备不支持震动' }}
          </p>
        </div>
        <AppToggle
          :model-value="settings.hapticsEnabled"
          label="震动反馈"
          @update:model-value="emit('update', { hapticsEnabled: $event })"
        />
      </div>
    </section>

    <h2 class="shrink-0 pb-2 pl-1 pt-5 text-[11px] font-extrabold tracking-[0.16em] text-muted">
      外观
    </h2>
    <SegmentedControl
      :model-value="settings.themeMode"
      :options="THEME_OPTIONS"
      label="外观"
      class="shrink-0"
      @update:model-value="emit('update', { themeMode: $event as AppSettings['themeMode'] })"
    />

    <h2 class="shrink-0 pb-2 pl-1 pt-5 text-[11px] font-extrabold tracking-[0.16em] text-muted">
      数据
    </h2>
    <section class="shrink-0 rounded-[20px] border border-line bg-surface px-4">
      <button
        type="button"
        class="flex h-[58px] w-full items-center justify-between gap-3 text-left transition active:opacity-60"
        @click="emit('exportData')"
      >
        <span class="text-[15px] font-bold">导出计划与记录</span>
        <Download :size="18" :stroke-width="2.2" class="shrink-0 text-faint" />
      </button>
      <div class="h-px bg-line"></div>
      <button
        type="button"
        class="flex h-[58px] w-full items-center justify-between gap-3 text-left transition active:opacity-60 disabled:opacity-40"
        :disabled="!hasHistory"
        @click="emit('clearHistory')"
      >
        <span class="text-[15px] font-bold text-danger">清空全部训练记录</span>
        <Trash2 :size="18" :stroke-width="2.2" class="shrink-0 text-danger" />
      </button>
    </section>

    <div class="min-h-6 flex-grow"></div>

    <p
      class="shrink-0 pb-[max(26px,env(safe-area-inset-bottom))] pt-4 text-center text-[11px] font-bold tracking-[0.14em] text-faint"
    >
      WORKOUT 3-2-1 · {{ version }}
    </p>
  </div>
</template>
