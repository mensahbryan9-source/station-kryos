// Entrées : clavier, souris (pointer lock), écran tactile et manette.
// Les touches utilisent event.code (position physique) : ZQSD sur AZERTY = WASD sur QWERTY.

export class Input {
  constructor(canvas, touchRoot) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDown = false;
    this.edges = { use: false, fire: false, weapon: null, next: 0 };
    this.sensitivity = 1;
    this.enabled = false;
    this.touch = { move: null, look: null, fire: false, lookDX: 0, mx: 0, my: 0 };
    this.onAction = () => {};

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (!this.enabled) return;
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') this.edges.use = true;
      if (/^Digit[1-5]$/.test(e.code)) this.edges.weapon = +e.code[5] - 1;
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.edges.fire = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== canvas && !this.isTouch) { this.lock(); return; }
      if (e.button === 0) { this.mouseDown = true; this.edges.fire = true; }
      if (e.button === 2) this.edges.use = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) this.mouseDX += e.movementX;
    });
    addEventListener('wheel', (e) => {
      if (this.enabled && document.pointerLockElement === canvas) this.edges.next = e.deltaY > 0 ? 1 : -1;
    }, { passive: true });

    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (touchRoot) this.setupTouch(touchRoot);
  }

  lock() {
    if (this.isTouch) return;
    try { const r = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => this.canvas.requestPointerLock()); }
    catch { this.canvas.requestPointerLock(); }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  setupTouch(root) {
    const stick = root.querySelector('.stick'), knob = root.querySelector('.knob');
    const T = this.touch;
    const zone = root.querySelector('.touch-zone');
    const btn = (sel, down, up) => {
      const el = root.querySelector(sel);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); down(e); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('on'); up && up(e); }, { passive: false });
      el.addEventListener('touchcancel', () => { el.classList.remove('on'); up && up(); });
      return el;
    };
    // Bouton de tir : maintenir pour tirer, glisser pour viser en même temps.
    const fireEl = btn('.b-fire', (e) => {
      T.fire = true; this.edges.fire = true;
      const t = e.changedTouches[0]; T.fireLook = { id: t.identifier, x: t.clientX };
    }, () => { T.fire = false; T.fireLook = null; });
    fireEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (T.fireLook && t.identifier === T.fireLook.id) { T.lookDX += t.clientX - T.fireLook.x; T.fireLook.x = t.clientX; }
    }, { passive: false });
    btn('.b-use', () => { this.edges.use = true; });
    btn('.b-next', () => { this.edges.next = 1; });
    btn('.b-map', () => this.onAction('map'));
    btn('.b-pause', () => this.onAction('pause'));

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const left = t.clientX < innerWidth * 0.45;
        if (left && !T.move) {
          T.move = { id: t.identifier, ox: t.clientX, oy: t.clientY };
          stick.style.left = t.clientX + 'px'; stick.style.top = t.clientY + 'px'; stick.classList.add('on');
          knob.style.transform = 'translate(-50%,-50%)';
        } else if (!left && !T.look) {
          T.look = { id: t.identifier, x: t.clientX };
        }
      }
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (T.move && t.identifier === T.move.id) {
          const R = 56;
          let dx = t.clientX - T.move.ox, dy = t.clientY - T.move.oy;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx *= R / l; dy *= R / l; }
          T.mx = dx / R; T.my = dy / R;
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else if (T.look && t.identifier === T.look.id) {
          T.lookDX += t.clientX - T.look.x; T.look.x = t.clientX;
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (T.move && t.identifier === T.move.id) { T.move = null; T.mx = T.my = 0; stick.classList.remove('on'); }
        if (T.look && t.identifier === T.look.id) T.look = null;
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  }

  gamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of pads) if (g && g.mapping === 'standard') return g;
    return null;
  }

  // Produit l'état des commandes pour une image.
  poll(dt) {
    const k = this.keys, T = this.touch;
    const has = (...c) => c.some((x) => k.has(x));
    let forward = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    let strafe = (has('KeyD') ? 1 : 0) - (has('KeyA') ? 1 : 0);
    const altStrafe = has('AltLeft', 'AltRight');
    let turnKeys = (has('ArrowRight') ? 1 : 0) - (has('ArrowLeft') ? 1 : 0);
    if (altStrafe) { strafe += turnKeys; turnKeys = 0; }
    let turn = turnKeys * 2.6 * dt + this.mouseDX * 0.0024 * this.sensitivity;
    this.mouseDX = 0;
    // tactile
    if (T.move) { forward += -T.my * 1.05; strafe += T.mx * 1.05; }
    turn += T.lookDX * 0.0065 * this.sensitivity; T.lookDX = 0;
    let fire = this.mouseDown || has('ControlLeft', 'ControlRight') || T.fire;
    let firePressed = this.edges.fire;
    const out = { forward: 0, strafe: 0, turn, run: has('ShiftLeft', 'ShiftRight'), fire, firePressed, use: this.edges.use, weapon: this.edges.weapon, nextWeapon: this.edges.next };
    // manette
    const g = this.gamepad();
    if (g) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      forward -= dz(g.axes[1]); strafe += dz(g.axes[0]);
      out.turn += dz(g.axes[2]) * 3 * dt * this.sensitivity;
      const prev = this.padPrev || [];
      const pressed = (i) => g.buttons[i] && g.buttons[i].pressed;
      const edge = (i) => pressed(i) && !prev[i];
      if (pressed(7) || pressed(6)) { out.fire = true; if (edge(7) || edge(6)) out.firePressed = true; }
      if (edge(0) || edge(2)) out.use = true;
      if (edge(5)) out.nextWeapon = 1;
      if (edge(4)) out.nextWeapon = -1;
      if (edge(9)) this.onAction('pause');
      if (edge(8)) this.onAction('map');
      if (pressed(10)) out.run = true;
      this.padPrev = g.buttons.map((b) => b.pressed);
    }
    out.forward = Math.max(-1, Math.min(1, forward));
    out.strafe = Math.max(-1, Math.min(1, strafe));
    this.edges = { use: false, fire: false, weapon: null, next: 0 };
    return out;
  }
}
