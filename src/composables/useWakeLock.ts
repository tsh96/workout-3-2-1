import { onBeforeUnmount, watch, type Ref } from 'vue'

interface WakeLockSentinelLike {
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

/**
 * Holds the screen awake while `active` is true. Browsers drop the lock when
 * the tab is hidden, so it is re-requested whenever the page comes back.
 */
export function useWakeLock(active: Ref<boolean>) {
  const api = (navigator as Navigator & WakeLockNavigator).wakeLock
  let sentinel: WakeLockSentinelLike | null = null

  async function acquire() {
    if (!api || sentinel) return
    try {
      sentinel = await api.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      // Denied (low battery, unsupported, not user-activated). Not fatal.
      sentinel = null
    }
  }

  function release() {
    void sentinel?.release().catch(() => undefined)
    sentinel = null
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && active.value) void acquire()
  }

  watch(
    active,
    (on) => {
      if (on) void acquire()
      else release()
    },
    { immediate: true },
  )

  document.addEventListener('visibilitychange', onVisibilityChange)

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    release()
  })

  return { supported: Boolean(api) }
}
