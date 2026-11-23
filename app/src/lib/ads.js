// Phone-app ads (AdMob). The web uses AdSense instead (AdSlot / AnchorAd). Everything here is a no-op on the web.
import { isNative, platform } from './native.js';
import { ADMOB_BANNER_IOS, ADMOB_BANNER_ANDROID } from './config.js';
// Google's public test banner units — used until the real IDs are filled in, so nothing earns (or gets flagged) by accident
const TEST = { ios: 'ca-app-pub-3940256099942544/2435281174', android: 'ca-app-pub-3940256099942544/9214589741' };
let ready = null, showing = false, wanted = false;

async function init() {
  const { AdMob, AdmobConsentStatus } = await import('@capacitor-community/admob');
  await AdMob.initialize();
  // EU/UK consent form when required, then Apple's "allow tracking?" prompt (ads still show if they say no — just not personalized)
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
  } catch {}
  if (platform() === 'ios') { try { await AdMob.requestTrackingAuthorization(); } catch {} }
  return AdMob;
}
/** Pin a banner just above the tab bar. */
export async function showNativeBanner() {
  if (!isNative()) return;
  wanted = true;
  try {
    const AdMob = await (ready ||= init());
    if (!wanted || showing) return;
    const { BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
    const real = platform() === 'ios' ? ADMOB_BANNER_IOS : ADMOB_BANNER_ANDROID;
    await AdMob.showBanner({ adId: real || TEST[platform()] || TEST.android, isTesting: !real, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin: 64 });
    showing = true;
  } catch { /* no ad available right now — fine */ }
}
export async function hideNativeBanner() {
  wanted = false;
  if (!isNative() || !showing) return;
  try { const AdMob = await ready; await AdMob.removeBanner(); } catch {}
  showing = false;
}
