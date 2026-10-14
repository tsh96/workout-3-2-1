import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

function scoreVoice(voice: SpeechSynthesisVoice) {
  const lang = voice.lang.toLowerCase()
  const name = voice.name.toLowerCase()
  let score = 0

  if (lang === 'zh-cn') score += 80
  else if (lang.includes('hans')) score += 70
  else if (lang === 'zh-sg') score += 60
  else if (lang === 'zh-tw') score += 45
  else if (lang === 'zh-hk') score += 30
  else if (lang.startsWith('zh')) score += 25

  if (name.includes('siri')) score += 45
  if (name.includes('yu-shu') || name.includes('yushu')) score += 40
  if (name.includes('google')) score += 35
  if (name.includes('ting-ting') || name.includes('tingting')) score += 30
  if (name.includes('mandarin') || name.includes('普通话') || name.includes('普通話')) score += 20
  if (name.includes('compact')) score -= 35
  if (voice.localService) score += 5

  return score
}

export function useSpeech(enabled: Ref<boolean>, voiceId: Ref<string>) {
  const availableVoices = ref<SpeechSynthesisVoice[]>([])
  let speechTimerId: number | undefined

  function loadVoices() {
    if (!supported) return
    availableVoices.value = window.speechSynthesis.getVoices()
  }

  const chineseVoices = computed(() =>
    availableVoices.value.filter((voice) => voice.lang.toLowerCase().startsWith('zh')),
  )

  const voiceOptions = computed(() => [
    { label: '自动选择', value: '' },
    ...chineseVoices.value.map((voice) => ({
      label: `${voice.name} · ${voice.lang}`,
      value: voice.voiceURI,
    })),
  ])

  const selectedVoiceLabel = computed(() => {
    const match = voiceOptions.value.find((option) => option.value === voiceId.value)
    return match?.label ?? '自动选择'
  })

  function preferredVoice() {
    const chosen = availableVoices.value.find((voice) => voice.voiceURI === voiceId.value)
    if (chosen) return chosen

    return [...chineseVoices.value].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
  }

  function cancel() {
    if (speechTimerId) window.clearTimeout(speechTimerId)
    speechTimerId = undefined
    if (supported) window.speechSynthesis.cancel()
  }

  function speak(text: string, onDone?: () => void) {
    if (!enabled.value || !supported) {
      onDone?.()
      return
    }

    if (speechTimerId) window.clearTimeout(speechTimerId)

    const synth = window.speechSynthesis
    if (availableVoices.value.length === 0) loadVoices()

    const voice = preferredVoice()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice ?? null
    utterance.lang = voice?.lang ?? 'zh-CN'
    utterance.rate = 0.92
    utterance.pitch = 1.04
    utterance.volume = 1

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onDone?.()
    }

    utterance.onend = finish
    utterance.onerror = finish

    const play = () => {
      synth.resume()
      synth.speak(utterance)
    }

    // Chrome drops an utterance queued while another is mid-cancel.
    if (synth.speaking || synth.pending) {
      synth.cancel()
      speechTimerId = window.setTimeout(play, 80)
      return
    }

    play()
  }

  // Muting should silence the sentence already being read, not just the next one.
  watch(enabled, (isEnabled) => {
    if (!isEnabled) cancel()
  })

  onMounted(() => {
    loadVoices()
    if (supported) window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
  })

  onBeforeUnmount(() => {
    cancel()
    if (supported) window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  })

  return { supported, voiceOptions, selectedVoiceLabel, speak, cancel }
}
