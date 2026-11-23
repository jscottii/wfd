// Cook-day updates as phone notifications. iPhone forwards these to a paired Apple Watch whenever the phone
// is locked or asleep (Android forwards them to Wear OS watches the same way).
// Web: needs the app added to the Home Screen on iPhone (iOS 16.4+); desktop browsers work in a tab.
import { isNative } from './native.js';

export function canNotify() {
  if (isNative()) return true;
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}
export function notifyStatus() {
  if (isNative()) return 'native';
  if (!canNotify()) return /iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone ? 'needs-home-screen' : 'unsupported';
  return Notification.permission;   // 'granted' | 'denied' | 'default'
}
/** Ask permission (call from a tap). Returns true when updates can be sent. */
export async function enableUpdates() {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  }
  if (!canNotify()) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}
let nid = 900000;
/** Show an update now. tag: a later update with the same tag replaces it (keeps the watch tidy). */
export async function sendUpdate(title, body, tag = 'wfd-prep') {
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({ notifications: [{ id: ++nid % 2147483000, title, body, schedule: { at: new Date(Date.now() + 500) }, threadIdentifier: tag, group: tag }] });
      return;
    }
    if (!canNotify() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, renotify: true, icon: './pwa-192.png', badge: './pwa-192.png' });
    else new Notification(title, { body, tag });
  } catch { /* updates are a nice-to-have */ }
}
