import musicUrl from '../assets/audio/PartaniaTrack1.mp3'
import sfxUrl from '../assets/audio/SciFiButtonSFX.wav'

/**
 * Tiny audio engine for the experience.
 *
 *   • Background music (PartaniaTrack1) — looped, fades in, and is gated on TWO
 *     conditions: the scene has finished loading (`ready`) AND the user has
 *     interacted at least once (browsers block audio before a gesture). So it
 *     never blares before everything is in.
 *   • SFX (SciFiButtonSFX) — decoded once via the Web Audio API so it can fire
 *     instantly and overlap on rapid clicks.
 *   • A single global mute that silences both.
 */

const MUSIC_VOLUME = 0.32
const SFX_VOLUME = 0.6
const FADE_MS = 1800

let music = null
let ctx = null
let sfxBuffer = null
let sfxPromise = null

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
    fadeMusicTo(MUSIC_VOLUME)
  }
  if (p && typeof p.then === 'function') p.then(onPlaying).catch(() => {})
  else onPlaying()
}

/** Decode the SFX up front so the first click is instant. */
export function loadSfx() {
  if (sfxPromise) return sfxPromise
  const c = ensureCtx()
  if (!c) return Promise.resolve()
  sfxPromise = fetch(sfxUrl)
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
    .then((buf) => {
      sfxBuffer = buf
    })
    .catch(() => {})
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
}

export function isMusicStarted() {
  return started
}
