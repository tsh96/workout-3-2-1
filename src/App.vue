<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ActivitySheet from './components/ActivitySheet.vue'
import HistoryScreen from './components/screens/HistoryScreen.vue'
import PlanScreen from './components/screens/PlanScreen.vue'
import SessionView from './components/screens/SessionView.vue'
import SettingsScreen from './components/screens/SettingsScreen.vue'
import TrainScreen from './components/screens/TrainScreen.vue'
import ModalDialog from './components/ui/ModalDialog.vue'
import TabBar from './components/ui/TabBar.vue'
import { useHaptics } from './composables/useHaptics'
import { useSession } from './composables/useSession'
import { useSpeech } from './composables/useSpeech'
import { useTheme } from './composables/useTheme'
import { useWakeLock } from './composables/useWakeLock'
import {
  cloneActivities,
  countSets,
  createId,
  createActivity,
  createPlan,
  loadState,
  normalizeCountdownPromptStart,
  normalizeStartCountdown,
  saveState,
} from './lib/storage'
import type { Activity, AppSettings, AppTab, DeleteTarget, WorkoutSessionLog } from './lib/types'

const appVersion = __APP_VERSION__

const saved = loadState()
const plans = ref(saved.plans)
const history = ref(saved.history)
const settings = ref<AppSettings>(saved.settings)
const activePlanId = ref(saved.activePlanId)

const currentTab = ref<AppTab>('train')
const isSettingsOpen = ref(false)
const editingActivityId = ref<string | null>(null)
const renameDraft = ref('')
const isRenameOpen = ref(false)
const pendingDelete = ref<DeleteTarget | null>(null)

const currentPlan = computed(
  () => plans.value.find((plan) => plan.id === activePlanId.value) ?? plans.value[0],
)
const routine = computed(() => currentPlan.value.routine)
const startCountdownSeconds = computed(() => currentPlan.value.startCountdownSeconds)
const promptStartSeconds = computed(() => settings.value.countdownPromptStartSeconds)
const voiceEnabled = computed(() => settings.value.voiceEnabled)
const hapticsEnabled = computed(() => settings.value.hapticsEnabled)
const themeMode = computed(() => settings.value.themeMode)
const voiceId = computed(() => settings.value.voiceId)

useTheme(themeMode)
const speech = useSpeech(voiceEnabled, voiceId)
const haptics = useHaptics(hapticsEnabled)

let activeLogId: string | null = null

function recordStart() {
  const plan = currentPlan.value
  const log: WorkoutSessionLog = {
    id: createId('session'),
    planId: plan.id,
    planName: plan.name || '未命名计划',
    startedAt: new Date().toISOString(),
    status: 'started',
    plan: {
      name: plan.name || '未命名计划',
      startCountdownSeconds: plan.startCountdownSeconds,
      routine: cloneActivities(plan.routine),
    },
    completedSets: 0,
    totalSets: countSets(plan.routine),
  }

  activeLogId = log.id
  history.value = [log, ...history.value].slice(0, 100)
}

function recordEnd(status: 'completed' | 'stopped', completedSets: number) {
  const log = history.value.find((entry) => entry.id === activeLogId)
  activeLogId = null
  if (!log || log.status !== 'started') return

  // Quitting before a single set is done is a false start, not a workout worth keeping.
  if (status === 'stopped' && completedSets === 0) {
    history.value = history.value.filter((entry) => entry.id !== log.id)
    return
  }

  log.status = status
  log.completedAt = new Date().toISOString()
  log.completedSets = Math.min(completedSets, log.totalSets)
}

const session = useSession(routine, startCountdownSeconds, promptStartSeconds, {
  speak: speech.speak,
  cancelSpeech: speech.cancel,
  vibrate: haptics.vibrate,
  onSessionStart: recordStart,
  onSessionEnd: recordEnd,
})

const keepScreenAwake = computed(
  () => settings.value.keepAwake && session.isActive.value && session.isRunning.value,
)
const wakeLock = useWakeLock(keepScreenAwake)

// An added activity stays out of the routine until it is saved, so cancelling leaves nothing behind.
const newActivity = ref<Activity | null>(null)
const isAddingActivity = computed(
  () => newActivity.value !== null && newActivity.value.id === editingActivityId.value,
)

const editingActivity = computed(() =>
  isAddingActivity.value
    ? newActivity.value
    : (routine.value.find((activity) => activity.id === editingActivityId.value) ?? null),
)
const editingIndex = computed(() =>
  isAddingActivity.value
    ? routine.value.length
    : routine.value.findIndex((activity) => activity.id === editingActivityId.value),
)

watch(editingActivityId, (id) => {
  if (newActivity.value && newActivity.value.id !== id) newActivity.value = null
})

watch(
  [plans, history, settings, activePlanId],
  () => {
    saveState({
      activePlanId: activePlanId.value,
      plans: plans.value,
      history: history.value,
      settings: settings.value,
    })
  },
  { deep: true },
)

/* ---- Routing: one hash per tab, so the back button works ---- */

const TAB_HASHES: Record<AppTab, string> = { train: '', plan: '#plan', history: '#history' }

function syncFromHash() {
  const hash = window.location.hash

  // Sheets and dialogs belong to the screen that opened them; leaving it
  // (including via the browser's back button) must take them with it.
  editingActivityId.value = null
  isRenameOpen.value = false
  pendingDelete.value = null

  isSettingsOpen.value = hash === '#settings'
  if (hash === '#plan') currentTab.value = 'plan'
  else if (hash === '#history') currentTab.value = 'history'
  else if (hash !== '#settings') currentTab.value = 'train'
}

function navigate(hash: string) {
  if (window.location.hash === hash) {
    syncFromHash()
    return
  }
  if (hash) window.location.hash = hash
  else window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
  syncFromHash()
}

function selectTab(tab: AppTab) {
  haptics.vibrate(12)
  navigate(TAB_HASHES[tab])
}

function closeSettings() {
  navigate(TAB_HASHES[currentTab.value])
}

/* ---- Plans ---- */

function selectPlan(id: string) {
  if (id === activePlanId.value) return
  activePlanId.value = id
  session.reset()
}

function addPlan() {
  const plan = createPlan(`计划 ${plans.value.length + 1}`)
  plans.value.push(plan)
  activePlanId.value = plan.id
  navigate(TAB_HASHES.plan)
}

function duplicatePlan() {
  const plan = currentPlan.value
  const copy = createPlan(
    `${plan.name || '未命名计划'} 副本`,
    plan.routine,
    plan.startCountdownSeconds,
  )
  plans.value.push(copy)
  activePlanId.value = copy.id
}

const renameInput = ref<HTMLInputElement | null>(null)

async function openRename() {
  renameDraft.value = currentPlan.value.name
  isRenameOpen.value = true
  // Opening the dialog is asking to type, so put the cursor there with the old name selected.
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

function saveRename() {
  currentPlan.value.name = renameDraft.value.trim() || '未命名计划'
  isRenameOpen.value = false
}

function removePlan(id: string) {
  if (plans.value.length <= 1) return

  const index = plans.value.findIndex((plan) => plan.id === id)
  if (index === -1) return

  plans.value = plans.value.filter((plan) => plan.id !== id)
  activePlanId.value = plans.value[Math.max(0, index - 1)].id
}

function updateCountdown(seconds: number) {
  currentPlan.value.startCountdownSeconds = normalizeStartCountdown(seconds)
}

/* ---- Activities ---- */

function addActivity() {
  const activity = createActivity()
  newActivity.value = activity
  editingActivityId.value = activity.id
}

function saveActivity(activity: Activity) {
  const index = routine.value.findIndex((entry) => entry.id === activity.id)
  if (index !== -1) currentPlan.value.routine.splice(index, 1, activity)
  else if (activity.id === newActivity.value?.id) currentPlan.value.routine.push(activity)
  editingActivityId.value = null
}

function removeActivity(id: string) {
  if (routine.value.length <= 1) return
  currentPlan.value.routine = routine.value.filter((activity) => activity.id !== id)
}

function reorderActivity(fromId: string, toId: string) {
  const from = routine.value.findIndex((activity) => activity.id === fromId)
  const to = routine.value.findIndex((activity) => activity.id === toId)
  if (from < 0 || to < 0 || from === to) return

  const next = [...routine.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  currentPlan.value.routine = next
  haptics.vibrate(12)
}

/* ---- Deletion, confirmed ---- */

function confirmDelete() {
  const target = pendingDelete.value
  pendingDelete.value = null
  if (!target) return

  if (target.kind === 'plan') removePlan(target.id)
  else if (target.kind === 'activity') {
    removeActivity(target.id)
    editingActivityId.value = null
  } else if (target.kind === 'history') {
    history.value = history.value.filter((entry) => entry.id !== target.id)
  } else {
    history.value = []
  }
}

function askDeletePlan() {
  if (plans.value.length <= 1) return
  pendingDelete.value = {
    kind: 'plan',
    id: currentPlan.value.id,
    title: '删除这个计划？',
    description: `计划「${currentPlan.value.name || '未命名计划'}」会被永久删除。`,
    confirmLabel: '删除计划',
  }
}

function askDeleteActivity(id: string) {
  const activity = routine.value.find((entry) => entry.id === id)
  if (!activity || routine.value.length <= 1) return
  pendingDelete.value = {
    kind: 'activity',
    id,
    title: '删除这个动作？',
    description: `动作「${activity.name || '未命名动作'}」会从当前计划中删除。`,
    confirmLabel: '删除动作',
  }
}

function askDeleteHistory(id: string) {
  const log = history.value.find((entry) => entry.id === id)
  if (!log) return
  pendingDelete.value = {
    kind: 'history',
    id,
    title: '删除这条记录？',
    description: `「${log.planName}」的这次训练记录会被永久删除。`,
    confirmLabel: '删除记录',
  }
}

function askClearHistory() {
  if (history.value.length === 0) return
  pendingDelete.value = {
    kind: 'history-all',
    id: '',
    title: '清空全部记录？',
    description: `${history.value.length} 条训练记录会被永久删除，计划不受影响。`,
    confirmLabel: '全部删除',
  }
}

/* ---- Settings ---- */

function updateSettings(patch: Partial<AppSettings>) {
  const next = { ...settings.value, ...patch }
  if (patch.countdownPromptStartSeconds !== undefined) {
    next.countdownPromptStartSeconds = normalizeCountdownPromptStart(
      patch.countdownPromptStartSeconds,
    )
  }
  settings.value = next
}

function exportData() {
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: appVersion,
      plans: plans.value,
      history: history.value,
    },
    null,
    2,
  )

  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `workout-3-2-1-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/* ---- Session controls ---- */

function startSession() {
  haptics.vibrate(20)
  session.start()
}

function stopSession() {
  session.reset()
}

/* One stray tap on ✕ shouldn't throw a workout away, so mid-session it asks first, on a paused clock. */
const isStopConfirmOpen = ref(false)
let resumeAfterStopConfirm = false

function requestStop() {
  const phase = session.phase.value
  if (phase === 'done' || phase === 'countdown') {
    stopSession()
    return
  }

  resumeAfterStopConfirm = session.isRunning.value
  if (resumeAfterStopConfirm) session.togglePause()
  isStopConfirmOpen.value = true
}

function cancelStop() {
  isStopConfirmOpen.value = false
  if (resumeAfterStopConfirm && session.isActive.value && !session.isRunning.value) {
    session.togglePause()
  }
  resumeAfterStopConfirm = false
}

function confirmStop() {
  isStopConfirmOpen.value = false
  resumeAfterStopConfirm = false
  stopSession()
}

function restartSession() {
  session.reset()
  session.start()
}

function finishAndViewHistory() {
  session.reset()
  navigate(TAB_HASHES.history)
}

onMounted(() => {
  syncFromHash()
  window.addEventListener('hashchange', syncFromHash)
  window.addEventListener('popstate', syncFromHash)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncFromHash)
  window.removeEventListener('popstate', syncFromHash)
})
</script>

<template>
  <!-- A running session owns the whole screen: no tabs, no chrome, one decision at a time. -->
  <SessionView
    v-if="session.isActive.value"
    :plan-name="currentPlan.name || '未命名计划'"
    :phase="session.phase.value"
    :accent="session.accent.value"
    :is-running="session.isRunning.value"
    :is-manual-action="session.isManualAction.value"
    :seconds-left="session.secondsLeft.value"
    :progress="session.progress.value"
    :start-countdown-seconds="startCountdownSeconds"
    :current-activity="session.currentActivity.value"
    :current-set-index="session.currentSetIndex.value"
    :rest-label="session.restLabel.value"
    :rest-total-seconds="session.restTotalSeconds.value"
    :completed-sets="session.completedSets.value"
    :total-sets="session.totalSets.value"
    :elapsed-seconds="session.elapsedSeconds.value"
    :set-elapsed-seconds="session.setElapsedSeconds.value"
    :next-step="session.nextStep.value"
    :upcoming-rest="session.upcomingRest.value"
    :voice-enabled="settings.voiceEnabled"
    :activity-count="routine.length"
    @stop="requestStop"
    @toggle-pause="session.togglePause"
    @skip="session.skip"
    @adjust-rest="session.adjustRest"
    @restart="restartSession"
    @toggle-voice="updateSettings({ voiceEnabled: !settings.voiceEnabled })"
    @view-history="finishAndViewHistory"
  />

  <SettingsScreen
    v-else-if="isSettingsOpen"
    :settings="settings"
    :voice-options="speech.voiceOptions.value"
    :selected-voice-label="speech.selectedVoiceLabel.value"
    :speech-supported="speech.supported"
    :wake-lock-supported="wakeLock.supported"
    :haptics-supported="haptics.supported"
    :version="appVersion"
    :has-history="history.length > 0"
    @back="closeSettings"
    @update="updateSettings"
    @export-data="exportData"
    @clear-history="askClearHistory"
  />

  <main v-else class="flex h-[100dvh] flex-col bg-ground text-ink">
    <TrainScreen
      v-if="currentTab === 'train'"
      :plans="plans"
      :plan="currentPlan"
      @select-plan="selectPlan"
      @start="startSession"
      @open-settings="navigate('#settings')"
      @edit-plan="navigate(TAB_HASHES.plan)"
    />

    <PlanScreen
      v-else-if="currentTab === 'plan'"
      :plans="plans"
      :plan="currentPlan"
      @select-plan="selectPlan"
      @add-plan="addPlan"
      @rename-plan="openRename"
      @duplicate-plan="duplicatePlan"
      @delete-plan="askDeletePlan"
      @update-countdown="updateCountdown"
      @edit-activity="editingActivityId = $event"
      @add-activity="addActivity"
      @reorder="reorderActivity"
    />

    <HistoryScreen
      v-else
      :history="history"
      @delete-entry="askDeleteHistory"
      @clear-all="askClearHistory"
    />

    <TabBar :active="currentTab" @change="selectTab" />
  </main>

  <ActivitySheet
    :open="editingActivity !== null"
    :activity="editingActivity"
    :position="editingIndex + 1"
    :is-last="editingIndex >= routine.length - 1"
    :can-delete="!isAddingActivity && routine.length > 1"
    @close="editingActivityId = null"
    @save="saveActivity"
    @remove="askDeleteActivity"
  />

  <ModalDialog :open="isRenameOpen" title="重命名计划" @close="isRenameOpen = false">
    <h2 class="text-[18px] font-black">重命名计划</h2>
    <label for="planName" class="mt-4 block text-[11px] font-extrabold tracking-[0.14em] text-muted">
      计划名称
    </label>
    <input
      id="planName"
      ref="renameInput"
      v-model="renameDraft"
      type="text"
      maxlength="24"
      placeholder="计划名称"
      class="mt-2 h-[52px] w-full rounded-2xl border border-line bg-ground px-4 text-[17px] font-extrabold outline-none placeholder:font-bold placeholder:text-faint"
      @keydown.enter.prevent="saveRename"
    />
    <div class="mt-4 grid grid-cols-2 gap-2.5">
      <button
        type="button"
        class="h-[52px] rounded-[18px] bg-raised text-[15px] font-extrabold transition active:scale-[0.98]"
        @click="isRenameOpen = false"
      >
        取消
      </button>
      <button
        type="button"
        class="h-[52px] rounded-[18px] bg-work-fill text-[15px] font-black text-work-on transition active:scale-[0.98]"
        @click="saveRename"
      >
        保存
      </button>
    </div>
  </ModalDialog>

  <ModalDialog
    :open="pendingDelete !== null"
    :title="pendingDelete?.title ?? '确认删除'"
    @close="pendingDelete = null"
  >
    <h2 class="text-[18px] font-black">{{ pendingDelete?.title }}</h2>
    <p class="mt-2.5 text-[14px] font-semibold leading-relaxed text-muted">
      {{ pendingDelete?.description }}
    </p>
    <div class="mt-5 grid grid-cols-2 gap-2.5">
      <button
        type="button"
        class="h-[52px] rounded-[18px] bg-raised text-[15px] font-extrabold transition active:scale-[0.98]"
        @click="pendingDelete = null"
      >
        取消
      </button>
      <button
        type="button"
        class="h-[52px] rounded-[18px] bg-danger text-[15px] font-black text-white transition active:scale-[0.98]"
        @click="confirmDelete"
      >
        {{ pendingDelete?.confirmLabel }}
      </button>
    </div>
  </ModalDialog>

  <ModalDialog :open="isStopConfirmOpen" title="结束训练" @close="cancelStop">
    <h2 class="text-[18px] font-black">结束这次训练？</h2>
    <p class="mt-2.5 text-[14px] font-semibold leading-relaxed text-muted">
      {{
        session.completedSets.value > 0
          ? `已完成 ${session.completedSets.value} / ${session.totalSets.value} 组，会保存到记录。`
          : '还没有完成任何一组，这次不会留下记录。'
      }}
    </p>
    <div class="mt-5 grid grid-cols-2 gap-2.5">
      <button
        type="button"
        class="h-[52px] rounded-[18px] bg-raised text-[15px] font-extrabold transition active:scale-[0.98]"
        @click="cancelStop"
      >
        继续训练
      </button>
      <button
        type="button"
        class="h-[52px] rounded-[18px] bg-danger text-[15px] font-black text-white transition active:scale-[0.98]"
        @click="confirmStop"
      >
        结束训练
      </button>
    </div>
  </ModalDialog>
</template>
