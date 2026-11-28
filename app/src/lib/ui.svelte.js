// Small bits of screen state shared across pages.
export const ui = $state({
  cart: sessionStorage.getItem('wfd-cart') || 'home',   // 'home' | cart id | 'new'
  cartPicker: false,
  receipt: false,
  calendar: false,
  act: '',   // what the round WFD button asked this page to open
  greet: '',
  preview: null,   // { r, save? } — a recipe's quick view, from anywhere
});
export function openCart(id) { ui.cart = id; ui.cartPicker = false; try { sessionStorage.setItem('wfd-cart', id); } catch {} }
