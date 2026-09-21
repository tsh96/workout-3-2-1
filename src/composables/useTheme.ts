import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { ThemeMode } from '../lib/types'

export function useTheme(themeMode: Ref<ThemeMode>) {
  const systemPrefersDark = ref(false)
  let query: MediaQueryList | undefined

  const isDark = computed(() =>
    themeMode.value === 'system' ? systemPrefersDark.value : themeMode.value === 'dark',
  )

  function sync(event?: MediaQueryListEvent) {
    systemPrefersDark.value = event?.matches ?? query?.matches ?? false
  }

  watch(
    isDark,
    (dark) => {
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    },
    { immediate: true },
  )

  onMounted(() => {
    query = window.matchMedia('(prefers-color-scheme: dark)')
    sync()
    query.addEventListener('change', sync)
  })

  onBeforeUnmount(() => query?.removeEventListener('change', sync))

  return { isDark }
}
