import musicUrl from '../assets/audio/PartaniaTrack1.mp3'
import sfxUrl from '../assets/audio/SciFiButtonSFX.wav'
import typingUrl from '../assets/audio/Sci-FiTyping.wav'

/**
 * Tiny audio engine for the experience.
 *
 *   • Background music (PartaniaTrack1) — looped, fades in, and is gated on TWO
 *     conditions: the scene has finished loading (`ready`) AND the user has
 *     interacted at least once (browsers block audio before a gesture). So it
 *     never blares before everything is in.
 *   • SFX (SciFiButtonSFX) — decoded once via the Web Audio API so it can fire
 *     instantly and overlap on rapid clicks.
 *   • Typing SFX (Sci-FiTyping) — looped while the hero copy types in.
 *   • A single global mute that silences both.
 */

const MUSIC_VOLUME = 0.32
const SFX_VOLUME = 0.6
const TYPING_VOLUME = 0.45
const FADE_MS = 1800

let music = null
let ctx = null
let sfxBuffer = null
let typingBuffer = null
let sfxPromise = null
let typingSource = null
let musicSource = null
let musicAnalyser = null
let musicBins = null
let musicEnergy = 0
let kickFloor = 0.025
let prevKickBand = 0

let ready = false
let interacted = false
let muted = false
let started = false
let fadeRAF = 0

function ensureMusic() {
  if (!music) {
    music = new Audio(musicUrl)
    music.loop = true
    music.preload = 'auto'
    music.volume = 0
  }
  return music
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) ctx = new AC()
  }
  return ctx
}

function ensureMusicAnalyser() {
  const c = ensureCtx()
  const m = ensureMusic()
  if (!c || musicAnalyser) return musicAnalyser

  musicSource = c.createMediaElementSource(m)
  musicAnalyser = c.createAnalyser()
  musicAnalyser.fftSize = 2048
  musicAnalyser.smoothingTimeConstant = 0.18
  musicBins = new Uint8Array(musicAnalyser.frequencyBinCount)

  musicSource.connect(musicAnalyser)
  musicAnalyser.connect(c.destination)
  return musicAnalyser
}

function fadeMusicTo(target) {
  if (!music) return
  cancelAnimationFrame(fadeRAF)
  const from = music.volume
  const t0 = performance.now()
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / FADE_MS)
    music.volume = from + (target - from) * k
    if (k < 1) fadeRAF = requestAnimationFrame(tick)
  }
  fadeRAF = requestAnimationFrame(tick)
}

function tryStartMusic() {
  // Both gates must be satisfied before a single note plays.
  if (started || !ready || !interacted) return
  const m = ensureMusic()
  m.muted = muted
  const p = m.play()
  const onPlaying = () => {
    started = true
    ensureMusicAnalyser()
    fadeMusicTo(MUSIC_VOLUME)
  }
  if (p && typeof p.then === 'function') p.then(onPlaying).catch(() => {})
  else onPlaying()
}

function decodeBuffer(url) {
  const c = ensureCtx()
  if (!c) return Promise.resolve()
  return fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
}

/** Decode SFX up front so the first click / typing cue is instant. */
export function loadSfx() {
  if (sfxPromise) return sfxPromise
  const c = ensureCtx()
  if (!c) return Promise.resolve()
  sfxPromise = Promise.all([
    decodeBuffer(sfxUrl).then((buf) => {
      sfxBuffer = buf
    }),
    decodeBuffer(typingUrl).then((buf) => {
      typingBuffer = buf
    }),
  ]).catch(() => {})
  return sfxPromise
}

export function playSfx() {
  if (muted) return
  const c = ensureCtx()
  if (!c || !sfxBuffer) return
  if (c.state === 'suspended') c.resume()
  const src = c.createBufferSource()
  src.buffer = sfxBuffer
  const gain = c.createGain()
  gain.gain.value = SFX_VOLUME
  src.connect(gain).connect(c.destination)
  src.start(0)
}

/** Looped typing bed for the hero typewriter (call `stopTypingSfx` when done). */
export function playTypingSfx() {
  if (muted) return
  const c = ensureCtx()
  if (!c || !typingBuffer) return
  if (c.state === 'suspended') c.resume()
  stopTypingSfx()
  typingSource = c.createBufferSource()
  typingSource.buffer = typingBuffer
  typingSource.loop = true
  const gain = c.createGain()
  gain.gain.value = TYPING_VOLUME
  typingSource.connect(gain).connect(c.destination)
  typingSource.start(0)
}

export function stopTypingSfx() {
  if (!typingSource) return
  try {
    typingSource.stop(0)
  } catch {
    /* already stopped */
  }
  typingSource.disconnect()
  typingSource = null
}

export function setReady(value) {
  ready = value
  tryStartMusic()
}

/** Called on the first user gesture — unlocks audio playback. */
export function markInteracted() {
  interacted = true
  const c = ensureCtx()
  if (c && c.state === 'suspended') c.resume()
  tryStartMusic()
}

export function setMuted(value) {
  muted = value
  if (music) music.muted = value
  if (muted) stopTypingSfx()
}

export function isMusicStarted() {
  return started
}

/**
 * Per-band music levels (0→1) for an equalizer visual. Returns `null` when the
 * track isn't audible (not started or muted) so the UI can show an "off" state.
 * Bands are log-spaced across the musical range so lows/mids/highs each move.
 */
export function getMusicLevels(bandCount = 7) {
  if (!started || muted || !musicAnalyser || !musicBins) return null

  musicAnalyser.getByteFrequencyData(musicBins)
  const usable = Math.floor(musicBins.length * 0.55) // ignore the airy top end
  const out = new Array(bandCount)

  for (let b = 0; b < bandCount; b++) {
    const lo = Math.floor(Math.pow(b / bandCount, 1.7) * usable) + 1
    const hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / bandCount, 1.7) * usable))
    let sum = 0
    let n = 0
    for (let i = lo; i < hi && i < musicBins.length; i++) {
      sum += musicBins[i]
      n++
    }
    const avg = n ? sum / n / 255 : 0
    out[b] = Math.min(1, Math.pow(avg, 0.78) * 1.45)
  }
  return out
}

let musicWave = null

/**
 * Time-domain waveform for an oscilloscope visual: `count` samples in roughly
 * [-1, 1]. Returns `null` when the track isn't audible (not started or muted) so
 * the UI can show an "off" state.
 */
export function getMusicWaveform(count = 128) {
  if (!started || muted || !musicAnalyser) return null

  const size = musicAnalyser.fftSize
  if (!musicWave || musicWave.length !== size) musicWave = new Uint8Array(size)
  musicAnalyser.getByteTimeDomainData(musicWave)

  const out = new Array(count)
  const step = size / count
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(i * step)
    out[i] = (musicWave[idx] - 128) / 128
  }
  return out
}

/**
 * Current kick energy, normalised 0→1 and smoothed for visuals.
 * Called from the render loop, so it does not touch React state.
 */
export function getMusicEnergy() {
  if (!started || muted || !musicAnalyser || !musicBins) {
    musicEnergy *= 0.9
    return musicEnergy
  }

  musicAnalyser.getByteFrequencyData(musicBins)

  // Kick detector: favor the punch range, but keep enough low-end bandwidth for
  // compressed tracks whose kick fundamental is not isolated in one bin.
  const binHz = ctx.sampleRate / musicAnalyser.fftSize
  const start = Math.max(1, Math.floor(35 / binHz))
  const end = Math.min(musicBins.length, Math.ceil(210 / binHz))
  let weighted = 0
  let weightTotal = 0
  for (let i = start; i < end; i++) {
    const bin = musicBins[i] / 255
    const hz = i * binHz
    const distanceFromPunch = Math.abs(hz - 95) / 115
    const weight = Math.max(0.55, 1.55 - distanceFromPunch)
    weighted += bin * weight
    weightTotal += weight
  }

  const kickBand = weightTotal ? weighted / weightTotal : 0
  kickFloor += (kickBand - kickFloor) * 0.004

  const onset = Math.max(0, kickBand - prevKickBand * 0.82)
  const aboveFloor = Math.max(0, kickBand - kickFloor * 0.72)
  prevKickBand = kickBand

  const shaped = Math.min(1, Math.pow(onset * 13 + aboveFloor * 5.5 + kickBand * 1.35, 0.9))
  const smoothing = shaped > musicEnergy ? 0.96 : 0.12
  musicEnergy += (shaped - musicEnergy) * smoothing
  return musicEnergy
}
