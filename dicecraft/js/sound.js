// The sound of dice finding the table.
//
// Synthesised rather than sampled: a handful of short filtered noise taps with
// a fast decay. That is a few lines against several hundred kilobytes of audio
// files, and nothing has to be fetched — which matters on a published page
// that may only load its own origin.

const TAP_LENGTH = 0.075;

let context = null;
let noiseBuffer = null;
let muted = false;

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}

function audio() {
  if (context) return context;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

function noise(ac) {
  if (noiseBuffer) return noiseBuffer;
  const frames = Math.ceil(ac.sampleRate * TAP_LENGTH);
  noiseBuffer = ac.createBuffer(1, frames, ac.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// One die meeting the table: a band of noise, struck and gone.
function tap(ac, at, loudness) {
  const source = ac.createBufferSource();
  source.buffer = noise(ac);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 850 + Math.random() * 1700;
  band.Q.value = 1.1 + Math.random();
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.14 * loudness), at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + TAP_LENGTH);
  source.connect(band).connect(gain).connect(ac.destination);
  source.start(at);
  source.stop(at + TAP_LENGTH);
}

// More dice, more clatter — spread over roughly the time a throw takes to
// settle, thinning out as it goes.
export function playRoll(dice = 5) {
  if (muted) return false;
  const ac = audio();
  if (!ac) return false;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  const taps = Math.min(11, Math.max(3, Math.round(dice * 1.4)));
  const now = ac.currentTime;
  for (let i = 0; i < taps; i++) {
    const spread = (i / taps) ** 1.4;
    tap(ac, now + 0.02 + spread * 0.62 + Math.random() * 0.06, 1 - spread * 0.6);
  }
  return true;
}
