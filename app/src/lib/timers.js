// Cook-day timer alerts: sound, vibration, notification, and keeping the screen awake.
import { nativeAwake, isNative } from './native.js';
import { sendUpdate } from './notify.js';
let ctx = null, lock = null;

/** Call from a tap so iPhone allows sound later. */
export function unlockAudio() {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch {}
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
}

export function alarm(label) {
  try {
    if (ctx) {
      const t = ctx.currentTime;
      [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach((d) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
        o.start(t + d); o.stop(t + d + 0.3);
      });
    }
  } catch {}
  try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch {}
  if (!isNative()) sendUpdate('⏰ Timer done', label, 'wfd-timer-' + label);   // phone + watch (the native app schedules its own)
}

/** Keep the screen on while timers run (cook day). */
export async function keepAwake(on) {
  if (await nativeAwake(on)) return;
  try {
    if (on && !lock && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => (lock = null)); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch {}
}

/** Hold the screen awake until the returned function is called; re-takes the lock when you come back to the app. */
export function holdAwake() {
  if (isNative()) { nativeAwake(true); return () => nativeAwake(false); }
  let l = null, live = true;
  const take = async () => { try { if (live && document.visibilityState === 'visible' && 'wakeLock' in navigator && !l) { l = await navigator.wakeLock.request('screen'); l.addEventListener('release', () => (l = null)); } } catch {} };
  const vis = () => take();
  take(); document.addEventListener('visibilitychange', vis);
  return () => { live = false; document.removeEventListener('visibilitychange', vis); try { l?.release(); } catch {} l = null; };
}
