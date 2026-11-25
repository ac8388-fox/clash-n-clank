// Press-and-hold controls (Build Spec → Controls).
// A choice commits only after a one-second hold; a bar fills inside the
// button while you hold; letting go early cancels. Works with touch, mouse,
// and keyboard (arrow keys or WASD, held for one second).

export const HOLD_MS = 1000;

// Make a button commit after a one-second hold.
// The button needs a child element with class "fill" for the progress bar.
export function attachHold(button, onCommit, { duration = HOLD_MS } = {}) {
  let start = 0, raf = 0, active = false, startX = 0, startY = 0;
  const fill = button.querySelector('.fill');

  const setFill = (f) => { if (fill) fill.style.transform = `scaleX(${f})`; };
  const stop = () => {
    active = false;
    cancelAnimationFrame(raf);
    setFill(0);
    button.classList.remove('holding');
  };
  const tick = () => {
    if (!active) return;
    const f = Math.min(1, (performance.now() - start) / duration);
    setFill(f);
    if (f >= 1) { stop(); onCommit(); return; }
    raf = requestAnimationFrame(tick);
  };
  const begin = (x = 0, y = 0) => {
    if (button.disabled || active) return;
    active = true; start = performance.now(); startX = x; startY = y;
    button.classList.add('holding');
    raf = requestAnimationFrame(tick);
  };

  button.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { button.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    begin(e.clientX, e.clientY);
  });
  button.addEventListener('pointermove', (e) => {
    // Moving a finger far (a swipe) cancels the hold.
    if (active && Math.hypot(e.clientX - startX, e.clientY - startY) > 24) stop();
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(ev, stop);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  // A plain click (or double click) does nothing on its own.
  button.addEventListener('click', (e) => e.preventDefault());

  return { begin: () => begin(), cancel: stop, isActive: () => active };
}

// Keyboard: hold an arrow key or WASD for one second to choose that
// direction. getHold(dir) returns the hold controller for that direction.
export function attachKeyboard({ getHold, onPage, onBack, onLucky }) {
  const KEYS = {
    ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
    w: 'up', d: 'right', s: 'down', a: 'left', W: 'up', D: 'right', S: 'down', A: 'left',
  };
  let held = null;
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const dir = KEYS[e.key];
    if (dir) {
      e.preventDefault();
      if (e.repeat || held) return;
      const h = getHold(dir);
      if (h) { held = { key: e.key, h }; h.begin(); }
      return;
    }
    if (e.key === 'q' || e.key === 'Q') onPage && onPage(-1);
    else if (e.key === 'e' || e.key === 'E') onPage && onPage(1);
    else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onBack && onBack(); }
    else if (e.key === 'l' || e.key === 'L') onLucky && onLucky();
  });
  window.addEventListener('keyup', (e) => {
    if (held && held.key === e.key) { held.h.cancel(); held = null; }
  });
  window.addEventListener('blur', () => { if (held) { held.h.cancel(); held = null; } });
}

// Swipes on an area: left / right pages, down goes back.
export function attachSwipes(el, { onPage, onBack }) {
  let x0 = 0, y0 = 0, tracking = false;
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; tracking = true;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onPage && onPage(dx < 0 ? 1 : -1);
    else if (dy > 70 && dy > Math.abs(dx) * 1.5) onBack && onBack();
  }, { passive: true });
  // Mouse wheel pages the carousel on desktop (one page per flick).
  let lastWheel = 0;
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 20 && Math.abs(e.deltaX) < 20) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheel < 400) return;
    lastWheel = now;
    onPage && onPage((e.deltaY || e.deltaX) > 0 ? 1 : -1);
  }, { passive: false });
}
