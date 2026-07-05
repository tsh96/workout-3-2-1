<script setup lang="ts">
import {
  ArrowLeft,
  ChevronRight,
  GripVertical,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-vue-next'
import {
  NButton,
  NConfigProvider,
  NInput,
  NInputNumber,
  NProgress,
  NSelect,
  NSwitch,
  NTooltip,
} from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type ActivityMode = 'reps' | 'time'
type AppPage = 'workout' | 'settings'
type SessionPhase = 'idle' | 'action' | 'rest' | 'done'

interface Activity {
  id: string
  name: string
  mode: ActivityMode
  target: number
}

const STORAGE_KEY = 'workout-3-2-1-state'

const modeOptions = [
  { label: '计次', value: 'reps' },
  { label: '计时', value: 'time' },
]

const defaultRoutine: Activity[] = [
  { id: 'squat', name: '深蹲', mode: 'reps', target: 15 },
  { id: 'plank', name: '平板支撑', mode: 'time', target: 45 },
  { id: 'pushup', name: '俯卧撑', mode: 'reps', target: 12 },
  { id: 'mountain', name: '登山跑', mode: 'time', target: 30 },
]

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { restSeconds: 30, routine: defaultRoutine }

    const parsed = JSON.parse(saved) as { restSeconds?: number; routine?: Activity[] }
    const routine = Array.isArray(parsed.routine) && parsed.routine.length > 0 ? parsed.routine : defaultRoutine
    return {
      restSeconds: Math.max(3, Number(parsed.restSeconds) || 30),
      routine: routine.map((activity) => ({
        ...activity,
        target: Math.max(1, Number(activity.target) || 1),
      })),
    }
  } catch {
    return { restSeconds: 30, routine: defaultRoutine }
  }
}

const savedState = loadState()
const restSeconds = ref(savedState.restSeconds)
const routine = ref<Activity[]>(savedState.routine)
const phase = ref<SessionPhase>('idle')
const currentPage = ref<AppPage>(window.location.hash === '#settings' ? 'settings' : 'workout')
const isRunning = ref(false)
const currentIndex = ref(0)
const secondsLeft = ref(0)
const voiceEnabled = ref(true)
const draggingActivityId = ref<string | null>(null)
const dragOverActivityId = ref<string | null>(null)

let timerId: number | undefined

const themeOverrides = {
  common: {
    borderRadius: '8px',
    borderRadiusSmall: '8px',
    primaryColor: '#0f766e',
    primaryColorHover: '#115e59',
    primaryColorPressed: '#134e4a',
    primaryColorSuppl: '#14b8a6',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  Button: {
    heightLarge: '52px',
    borderRadiusLarge: '8px',
  },
}

const currentActivity = computed(() => routine.value[currentIndex.value])
const nextActivity = computed(() => {
  if (phase.value === 'idle') return routine.value[1]
  const nextIndex = phase.value === 'rest' ? currentIndex.value + 1 : currentIndex.value + 1
  return routine.value[nextIndex]
})

const totalForPhase = computed(() => {
  if (phase.value === 'rest') return restSeconds.value
  if (phase.value === 'action' && currentActivity.value?.mode === 'time') return currentActivity.value.target
  return 0
})

const progressPercentage = computed(() => {
  if (!totalForPhase.value) return phase.value === 'done' ? 100 : 0
  return Math.max(0, Math.min(100, Math.round((secondsLeft.value / totalForPhase.value) * 100)))
})

const displayNumber = computed(() => {
  if (phase.value === 'rest') return secondsLeft.value
  if (phase.value === 'action' && currentActivity.value?.mode === 'time') return secondsLeft.value
  if (phase.value === 'action') return currentActivity.value?.target ?? 0
  return restSeconds.value
})

const displayUnit = computed(() => {
  if (phase.value === 'action' && currentActivity.value?.mode === 'reps') return '次'
  return '秒'
})

const statusTitle = computed(() => {
  if (phase.value === 'done') return '训练完成'
  if (phase.value === 'rest') return '休息'
  if (phase.value === 'action') return currentActivity.value?.name ?? '动作'
  return '准备开始'
})

const currentText = computed(() => {
  if (phase.value === 'rest') return `休息 ${restSeconds.value} 秒`
  if (phase.value === 'done') return '已完成'
  const activity = phase.value === 'idle' ? routine.value[0] : currentActivity.value
  return activity ? `${activity.name} · ${formatActionTarget(activity)}` : '暂无动作'
})

const nextText = computed(() => {
  const activity = nextActivity.value
  return activity ? `${activity.name} · ${formatActionTarget(activity)}` : '没有下一个动作'
})

const primaryLabel = computed(() => {
  if (phase.value === 'done') return '再来一轮'
  if (isRunning.value) return '暂停'
  if (phase.value === 'idle') return '开始'
  return '继续'
})

const sessionStateLabel = computed(() => {
  if (phase.value === 'idle') return '待开始'
  if (phase.value === 'done') return '完成'
  return isRunning.value ? '进行中' : '已暂停'
})

const canSkip = computed(() => phase.value === 'action' || phase.value === 'rest')
const isManualAction = computed(() => phase.value === 'action' && currentActivity.value?.mode === 'reps')
const isDraggingActivity = computed(() => draggingActivityId.value !== null)

watch(
  [restSeconds, routine],
  () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        restSeconds: restSeconds.value,
        routine: routine.value,
      }),
    )
  },
  { deep: true },
)

function formatActionTarget(activity: Activity) {
  return `${activity.target} ${activity.mode === 'reps' ? '次' : '秒'}`
}

function syncPageFromHash() {
  currentPage.value = window.location.hash === '#settings' ? 'settings' : 'workout'
  stopActivityDrag()
}

function openSettings() {
  stopActivityDrag()
  if (window.location.hash === '#settings') {
    currentPage.value = 'settings'
    return
  }

  window.location.hash = 'settings'
}

function closeSettings() {
  stopActivityDrag()
  currentPage.value = 'workout'

  if (window.location.hash === '#settings') {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
  }
}

function speak(text: string) {
  if (!voiceEnabled.value || !('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1
  utterance.pitch = 1
  window.speechSynthesis.speak(utterance)
}

function startTimer() {
  if (timerId) return

  timerId = window.setInterval(() => {
    if (!isRunning.value) return

    if (phase.value === 'rest') {
      if (secondsLeft.value <= 3 && secondsLeft.value > 0) {
        speak(String(secondsLeft.value))
      }

      if (secondsLeft.value > 1) {
        secondsLeft.value -= 1
      } else {
        startAction(currentIndex.value + 1)
      }
      return
    }

    if (phase.value === 'action' && currentActivity.value?.mode === 'time') {
      if (secondsLeft.value > 1) {
        secondsLeft.value -= 1
      } else {
        finishAction()
      }
    }
  }, 1000)
}

function togglePrimary() {
  if (phase.value === 'done') {
    resetSession()
    beginSession()
    return
  }

  if (phase.value === 'idle') {
    beginSession()
    return
  }

  isRunning.value = !isRunning.value
  if (isRunning.value) startTimer()
}

function beginSession() {
  if (routine.value.length === 0) return
  isRunning.value = true
  startAction(0)
  startTimer()
}

function startAction(index: number) {
  const activity = routine.value[index]
  if (!activity) {
    completeSession()
    return
  }

  currentIndex.value = index
  phase.value = 'action'
  secondsLeft.value = activity.mode === 'time' ? activity.target : 0
  speak(`${activity.name}，${formatActionTarget(activity)}`)
}

function startRest() {
  const upcoming = routine.value[currentIndex.value + 1]
  if (!upcoming) {
    completeSession()
    return
  }

  phase.value = 'rest'
  secondsLeft.value = restSeconds.value
  speak(`开始休息${restSeconds.value}秒，下个动作是${upcoming.name}，${formatActionTarget(upcoming)}`)
}

function finishAction() {
  startRest()
}

function skipCurrent() {
  if (phase.value === 'action') {
    finishAction()
    return
  }

  if (phase.value === 'rest') {
    startAction(currentIndex.value + 1)
  }
}

function resetSession() {
  isRunning.value = false
  phase.value = 'idle'
  currentIndex.value = 0
  secondsLeft.value = 0
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

function completeSession() {
  isRunning.value = false
  phase.value = 'done'
  secondsLeft.value = 0
  speak('训练完成')
}

function addActivity() {
  routine.value.push({
    id: crypto.randomUUID(),
    name: '新动作',
    mode: 'reps',
    target: 10,
  })
}

function removeActivity(id: string) {
  if (routine.value.length <= 1) return
  routine.value = routine.value.filter((activity) => activity.id !== id)
  resetSession()
}

function startActivityDrag(event: PointerEvent, activityId: string) {
  if (isRunning.value || routine.value.length <= 1) return

  event.preventDefault()
  draggingActivityId.value = activityId
  dragOverActivityId.value = activityId

  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    target.setPointerCapture?.(event.pointerId)
  }

  window.addEventListener('pointermove', handleActivityDragMove, { passive: false })
  window.addEventListener('pointerup', stopActivityDrag)
  window.addEventListener('pointercancel', stopActivityDrag)
}

function handleActivityDragMove(event: PointerEvent) {
  const draggingId = draggingActivityId.value
  if (!draggingId) return

  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-activity-id]')
  const targetId = target?.dataset.activityId
  if (!targetId || targetId === draggingId) return

  reorderActivity(draggingId, targetId)
  dragOverActivityId.value = targetId
}

function reorderActivity(draggingId: string, targetId: string) {
  const fromIndex = routine.value.findIndex((activity) => activity.id === draggingId)
  const toIndex = routine.value.findIndex((activity) => activity.id === targetId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

  const nextRoutine = [...routine.value]
  const [draggedActivity] = nextRoutine.splice(fromIndex, 1)
  if (!draggedActivity) return

  nextRoutine.splice(toIndex, 0, draggedActivity)
  routine.value = nextRoutine

  if (phase.value !== 'idle') resetSession()
}

function stopActivityDrag() {
  window.removeEventListener('pointermove', handleActivityDragMove)
  window.removeEventListener('pointerup', stopActivityDrag)
  window.removeEventListener('pointercancel', stopActivityDrag)
  draggingActivityId.value = null
  dragOverActivityId.value = null
}

onMounted(() => {
  window.addEventListener('hashchange', syncPageFromHash)
})

onBeforeUnmount(() => {
  if (timerId) window.clearInterval(timerId)
  window.removeEventListener('hashchange', syncPageFromHash)
  stopActivityDrag()
})
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <main class="min-h-screen bg-[#f7f8f5] text-slate-950">
      <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-[max(18px,env(safe-area-inset-top))]">
        <header v-if="currentPage === 'workout'" class="flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Workout 3-2-1</p>
            <h1 class="mt-1 text-2xl font-black leading-tight">训练辅助器</h1>
          </div>

          <div class="flex items-center gap-2">
            <NTooltip trigger="hover">
              <template #trigger>
                <NButton circle secondary type="primary" aria-label="设置" @click="openSettings">
                  <Settings :size="19" />
                </NButton>
              </template>
              设置
            </NTooltip>

            <NTooltip trigger="hover">
              <template #trigger>
                <NButton circle secondary type="primary" aria-label="语音提示" @click="voiceEnabled = !voiceEnabled">
                  <Volume2 v-if="voiceEnabled" :size="19" />
                  <VolumeX v-else :size="19" />
                </NButton>
              </template>
              语音提示
            </NTooltip>
          </div>
        </header>

        <section v-if="currentPage === 'workout'" class="mt-5 rounded-lg border border-teal-900/10 bg-white p-4 shadow-soft">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-bold text-teal-700">{{ phase === 'rest' ? '当前休息' : '当前动作' }}</p>
              <h2 class="mt-1 truncate text-3xl font-black leading-none">{{ statusTitle }}</h2>
              <p class="mt-3 text-sm font-semibold text-slate-500">{{ currentText }}</p>
            </div>

            <NProgress
              class="shrink-0"
              type="circle"
              :width="88"
              :stroke-width="10"
              :percentage="progressPercentage"
              :show-indicator="false"
              color="#0f766e"
              rail-color="#d7e8e3"
            />
          </div>

          <div class="mt-5 flex items-end justify-between rounded-lg bg-[#101827] px-4 py-4 text-white">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.14em] text-teal-200">
                {{ isManualAction ? '目标' : '倒计时' }}
              </p>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="text-6xl font-black tabular-nums leading-none">{{ displayNumber }}</span>
                <span class="text-xl font-black">{{ displayUnit }}</span>
              </div>
            </div>
            <div class="pb-1 text-right text-xs font-bold text-slate-300">
              <p>{{ currentIndex + 1 }}/{{ routine.length }}</p>
              <p class="mt-1">{{ sessionStateLabel }}</p>
            </div>
          </div>

          <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">下个动作</p>
            <p class="mt-1 truncate text-lg font-black">{{ nextText }}</p>
          </div>

          <div class="mt-5 grid grid-cols-[1fr_auto_auto] gap-2">
            <NButton size="large" type="primary" block @click="togglePrimary">
              <template #icon>
                <Pause v-if="isRunning" :size="20" />
                <Play v-else :size="20" />
              </template>
              {{ primaryLabel }}
            </NButton>

            <NTooltip trigger="hover">
              <template #trigger>
                <NButton size="large" aria-label="下一个" :disabled="!canSkip" @click="skipCurrent">
                  <template #icon>
                    <SkipForward :size="20" />
                  </template>
                </NButton>
              </template>
              下一个
            </NTooltip>

            <NTooltip trigger="hover">
              <template #trigger>
                <NButton size="large" aria-label="重置" @click="resetSession">
                  <template #icon>
                    <RotateCcw :size="20" />
                  </template>
                </NButton>
              </template>
              重置
            </NTooltip>
          </div>
        </section>

        <section v-else class="space-y-3">
          <header class="flex items-center justify-between">
            <div class="flex min-w-0 items-center gap-3">
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton circle aria-label="返回训练" @click="closeSettings">
                    <ArrowLeft :size="19" />
                  </NButton>
                </template>
                返回训练
              </NTooltip>

              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Workout 3-2-1</p>
                <h1 class="mt-1 text-2xl font-black leading-tight">设置</h1>
              </div>
            </div>
          </header>

          <div class="flex items-center justify-between">
            <h2 class="text-base font-black">训练参数</h2>
            <div class="flex items-center gap-2 text-sm font-bold text-slate-600">
              <span>语音</span>
              <NSwitch v-model:value="voiceEnabled" size="small" />
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <label class="text-sm font-bold text-slate-600" for="restSeconds">休息秒数</label>
            <NInputNumber
              id="restSeconds"
              v-model:value="restSeconds"
              class="mt-2 w-full"
              :min="3"
              :max="600"
              :step="5"
              button-placement="both"
              :disabled="isRunning"
            />
          </div>

          <div class="space-y-2">
            <article
              v-for="(activity, index) in routine"
              :key="activity.id"
              class="rounded-lg border p-3 transition"
              :class="[
                draggingActivityId === activity.id
                  ? 'border-teal-600 bg-teal-50/80 shadow-soft'
                  : 'border-slate-200 bg-white',
                dragOverActivityId === activity.id && draggingActivityId !== activity.id
                  ? 'ring-2 ring-teal-500/40'
                  : '',
              ]"
              :data-activity-id="activity.id"
            >
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="flex h-9 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-slate-400 transition enabled:cursor-grab enabled:hover:bg-slate-100 enabled:hover:text-teal-700 enabled:active:cursor-grabbing disabled:opacity-35"
                  aria-label="拖动排序"
                  :disabled="isRunning || routine.length <= 1"
                  @pointerdown="startActivityDrag($event, activity.id)"
                >
                  <GripVertical :size="18" />
                </button>
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 font-black text-teal-700">
                  {{ index + 1 }}
                </div>
                <NInput
                  v-model:value="activity.name"
                  placeholder="动作名称"
                  :disabled="isRunning || isDraggingActivity"
                />
                <NButton
                  quaternary
                  circle
                  aria-label="删除动作"
                  :disabled="routine.length <= 1 || isRunning || isDraggingActivity"
                  @click="removeActivity(activity.id)"
                >
                  <Trash2 :size="18" />
                </NButton>
              </div>

              <div class="mt-2 grid grid-cols-[minmax(96px,1fr)_minmax(112px,1fr)] gap-2">
                <NSelect
                  v-model:value="activity.mode"
                  :options="modeOptions"
                  :disabled="isRunning || isDraggingActivity"
                />
                <NInputNumber
                  v-model:value="activity.target"
                  :min="1"
                  :max="999"
                  :step="activity.mode === 'reps' ? 1 : 5"
                  button-placement="both"
                  :disabled="isRunning || isDraggingActivity"
                />
              </div>
            </article>
          </div>

          <NButton secondary type="primary" block :disabled="isRunning" @click="addActivity">
            <template #icon>
              <Plus :size="18" />
            </template>
            添加动作
          </NButton>
        </section>

        <footer class="mt-auto flex items-center justify-center gap-1 pb-[max(0px,env(safe-area-inset-bottom))] pt-6 text-xs font-bold text-slate-400">
          <span>3</span>
          <ChevronRight :size="13" />
          <span>2</span>
          <ChevronRight :size="13" />
          <span>1</span>
        </footer>
      </div>
    </main>
  </NConfigProvider>
</template>
