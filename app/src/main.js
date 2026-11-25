import { mount } from 'svelte';
import './app.css';
import './lib/install.svelte.js';
import App from './App.svelte';
// an invite link (…/wfd/#join=ABC123): remember the code through sign-in, then clean the address bar
{ const m = location.hash.match(/^#join=([A-Za-z0-9-]{4,20})/); if (m) { try { localStorage.setItem('wfd-join', m[1]); } catch {} history.replaceState(null, '', location.pathname); } }
import { nativeStart } from './lib/native.js';
// The home page (in index.html) shows until you sign in, create an account or try it as a guest.
// Anyone already signed in, opening an invite, or heading to a screen of the app goes straight in.
const landing = document.getElementById('landing');
const APP_LINK = /^#(login|signup|guest|plan|trip|prep|pantry|recipes|more|prices|admin|receipt|contact)\b/;
const signedIn = () => { try { return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)) || !!localStorage.getItem('wfd-join'); } catch { return false; } };
function startApp() {
  landing?.remove();
  mount(App, { target: document.getElementById('app') });
  nativeStart();
}
if (!landing || signedIn() || APP_LINK.test(location.hash)) startApp();
else {
  const f = () => { if (APP_LINK.test(location.hash)) { removeEventListener('hashchange', f); startApp(); window.scrollTo(0, 0); } };
  addEventListener('hashchange', f);
}
