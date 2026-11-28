// use:swipe={{ left, right }} — drag a row sideways past ~80px to act. Vertical scrolling still works.
// The row's parent gets data-swipe="left"/"right" while dragging far enough, so it can show what will happen.
export function swipe(node, opts) {
  let x0 = 0, y0 = 0, dx = 0, id = null, dragging = false, lock = null;
  const TH = 80;
  node.style.touchAction = 'pan-y';
  const hint = (v) => { const p = node.parentElement; if (!p) return; if (v) p.dataset.swipe = v; else delete p.dataset.swipe; };
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; dragging = true; lock = null;
  };
  const move = (e) => {
    if (!dragging || e.pointerId !== id) return;
    const ddx = e.clientX - x0, ddy = e.clientY - y0;
    if (!lock) {
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.3) { lock = 'x'; try { node.setPointerCapture(id); } catch {} }
      else if (Math.abs(ddy) > 10) { dragging = false; return; }
      else return;
    }
    if (ddx < 0 && !opts.left) return;
    if (ddx > 0 && !opts.right) return;
    dx = ddx;
    node.style.transition = 'none';
    node.style.transform = `translateX(${dx}px)`;
    hint(dx < -TH ? 'left' : dx > TH ? 'right' : dx < 0 ? 'left-soft' : 'right-soft');
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    node.style.transition = 'transform .18s ease';
    const act = dx < -TH ? opts.left : dx > TH ? opts.right : null;
    if (act) {
      node.style.transform = `translateX(${dx < 0 ? '-105%' : '105%'})`;
      setTimeout(() => { node.style.transition = 'none'; node.style.transform = ''; hint(null); act(); }, 170);
    } else { node.style.transform = ''; hint(null); }
    if (Math.abs(dx) > 8) {   // a drag isn't a tap
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      node.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => node.removeEventListener('click', stop, { capture: true }), 350);
    }
    dx = 0;
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return {
    update(o) { opts = o; },
    destroy() { node.removeEventListener('pointerdown', down); node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up); },
  };
}
