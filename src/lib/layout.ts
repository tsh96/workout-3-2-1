/** The session ring's diameter, in one place so the numeral inside can track it. */
export const RING_MAX_PX = 288

export function ringDiameterCss(size = RING_MAX_PX) {
  return `min(${size}px, 70vw, 36vh)`
}

/**
 * Font size for the number drawn inside the ring. Two digits fill it nicely at
 * 45%; three ("120 秒") need to come down or they touch the stroke.
 */
export function ringNumeralCss(digits: number, size = RING_MAX_PX) {
  const ratio = digits >= 3 ? 0.3 : 0.45
  return `calc(${ringDiameterCss(size)} * ${ratio})`
}
