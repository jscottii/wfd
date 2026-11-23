// iPhone Live Activity for cook day: current step, progress and the soonest timer on the Lock Screen,
// Dynamic Island and Apple Watch Smart Stack. iOS 16.2+ in the phone app only; a no-op everywhere else.
import { isNative, platform } from './native.js';
const ID = 'wfd-cookday';
let running = false, plugin = null;
const get = async () => (plugin ||= (await import('capacitor-live-activity')).LiveActivity);
const ok = () => isNative() && platform() === 'ios';

/** state: { title, step, of, text, next, timerEnd (ms), timerLabel } */
export async function liveCookDay(state) {
  if (!ok()) return;
  const contentState = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v == null ? '' : String(v)]));
  try {
    const LA = await get();
    if (!running) {
      const { value } = await LA.isAvailable();
      if (!value) return;
      await LA.startActivity({ id: ID, attributes: { app: 'wfd' }, contentState });
      running = true;
    } else await LA.updateActivity({ id: ID, contentState });
  } catch { running = false; }
}
export async function endCookDay(final) {
  if (!ok() || !running) return;
  running = false;
  try { await (await get()).endActivity({ id: ID, contentState: final || { title: 'Cook day', text: 'All done — nice work.', step: '1', of: '1' }, dismissalDate: Date.now() + 15 * 60000 }); } catch {}
}
