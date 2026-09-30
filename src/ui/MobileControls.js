import { useTouchControls } from '../core/DeviceProfile.js';
import './mobile.css';

const MOVE_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];

// DOM thumb controls feed the same input path as the keyboard. Movement, look,
// and action fingers have independent pointer IDs, so none steals another.
export class MobileControls {
  constructor(ui, app) {
    this.ui = ui;
    this.app = app;
    this.enabled = useTouchControls();
    this.active = false;
    this.started = false;
    this._focused = true;
    this._pointers = new Map();
    this._ac = new AbortController();
    if (!this.enabled) return;

    this.el = document.createElement('div');
    this.el.className = 'island-mobile';
    this.el.hidden = true;
    this.el.innerHTML = `
      <nav class="island-mobile-nav tw-interactive" aria-label="漫游菜单">
        <button type="button" class="island-mobile-home" aria-label="回到步道入口">⌂ 入口</button>
        <button type="button" class="island-mobile-settings" aria-label="打开环境设置">设置</button>
        <button type="button" class="island-mobile-help" aria-label="打开漫游指南">指南</button>
      </nav>
      <div class="island-stick tw-interactive" role="group" aria-label="移动摇杆：拖动方向，松开停止">
        <span class="island-stick-ring" aria-hidden="true"></span>
        <span class="island-stick-thumb" aria-hidden="true"></span>
        <span class="island-stick-label" aria-hidden="true">移动</span>
      </div>
      <div class="island-touch-actions tw-interactive" role="group" aria-label="探索动作">
        <button type="button" class="island-touch-action island-touch-jump" data-key="Space" aria-label="跳跃，水中按住上浮"><span>跳跃</span><small>按住上浮</small></button>
        <button type="button" class="island-touch-action island-touch-dive" data-key="KeyC" aria-label="按住下潜">下潜</button>
        <button type="button" class="island-touch-action island-touch-interact" data-key="KeyE" aria-label="交互：登船、操舵或离船">交互</button>
      </div>`;
    ui.root.append(this.el);
    this.stick = this.el.querySelector('.island-stick');
    this.thumb = this.el.querySelector('.island-stick-thumb');
    const opts = { signal: this._ac.signal, passive: false };
    const listen = (target, type, fn) => target.addEventListener(type, fn, opts);

    for (const [selector, action] of [
      ['.island-mobile-home', () => ui.resetWalker()],
      ['.island-mobile-settings', () => ui.togglePanel(true)],
      ['.island-mobile-help', () => ui.toggleHelp(true)],
    ]) {
      const button = this.el.querySelector(selector);
      listen(button, 'pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        // A second touch does not reliably produce a compatibility click while
        // the first thumb holds the stick. Activate from its own pointer event.
        if (event.button > 0 || !this.sync()) return;
        app.audio?.resume();
        action();
        button.blur();
      });
      listen(button, 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        // Preserve keyboard/assistive activation, without repeating a pointer
        // action when the browser also emits a click after pointerdown.
        if (event.detail !== 0 || !this.sync()) return;
        action();
        button.blur();
      });
    }

    listen(this.stick, 'pointerdown', event => this._begin(event, 'move', this.stick));
    for (const button of this.el.querySelectorAll('.island-touch-action')) {
      listen(button, 'pointerdown', event => this._begin(event, button.dataset.key, button));
      // A pointer gesture is already handled on down/up; suppress its synthetic
      // click rather than turning a held swim button into a second key press.
      listen(button, 'click', event => {
        event.preventDefault();
        event.stopPropagation();
      });
    }
    listen(this.el, 'contextmenu', event => event.preventDefault());
    listen(window, 'pointermove', event => this._move(event));
    listen(window, 'pointerup', event => this._end(event));
    listen(window, 'pointercancel', event => {
      if (this._pointers.has(event.pointerId)) this.clear();
    });
    listen(window, 'lostpointercapture', event => this._end(event));
    listen(window, 'blur', () => {
      this._focused = false;
      this.sync();
      this.clear();
    });
    listen(window, 'focus', () => {
      this._focused = true;
      this.sync();
    });
    listen(document, 'visibilitychange', () => {
      this.clear();
      this.sync();
    });
    listen(window, 'resize', () => this.clear());
    listen(window, 'orientationchange', () => this.clear());
    if (window.visualViewport) listen(window.visualViewport, 'resize', () => this.clear());
    this.sync();
  }

  start() {
    this.started = true;
    this.sync();
  }

  // App.init creates Input after bindApp. Resolve it only when present; the
  // start overlay calls sync before its first user gesture can request lock.
  sync() {
    if (!this.enabled) return false;
    const input = this.app.input;
    if (input && input !== this.input) {
      this.input = input;
      input.touchMode = true;
      this._bindCanvas(input.dom);
    }
    const active = !!(this.started && input && this.app.player &&
      !this.ui._start && !this.ui.panelOpen && !this.ui.helpOpen &&
      !this.ui.photoMode && !document.hidden && this._focused);
    if (!active && (this.active || this._pointers.size)) this.clear();
    this.active = active;
    this.el.hidden = !active;
    if (input) input.enabled = active;
    return active;
  }

  _bindCanvas(canvas) {
    if (!canvas || canvas === this.canvas) return;
    this._canvasAC?.abort();
    this.canvas = canvas;
    this._canvasAC = new AbortController();
    const opts = { signal: this._canvasAC.signal, passive: false, capture: true };
    canvas.addEventListener('pointerdown', event => {
      if (!this.sync()) return;
      const bounds = canvas.getBoundingClientRect();
      if (event.clientX < bounds.left + bounds.width * 0.45) return;
      this._begin(event, 'look', canvas);
    }, opts);
    // Prevent native touch panning and compatibility mouse/click handlers.
    // The canvas remains the look surface; no transparent UI covers the bay.
    canvas.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, opts);
    canvas.style.touchAction = 'none';
  }

  _begin(event, kind, target) {
    if (!this.sync() || event.button > 0 || this._pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    if ((kind === 'move' || kind === 'look') && [...this._pointers.values()].some(p => p.kind === kind)) return;
    const pointer = { kind, target, x: event.clientX, y: event.clientY };
    if (kind === 'move') {
      const bounds = this.stick.getBoundingClientRect();
      pointer.cx = bounds.left + bounds.width / 2;
      pointer.cy = bounds.top + bounds.height / 2;
      pointer.radius = bounds.width * 0.32;
    }
    this._pointers.set(event.pointerId, pointer);
    try { target.setPointerCapture(event.pointerId); } catch { /* The pointer may already have been cancelled. */ }
    target.classList.add('is-held');
    this.app.audio?.resume();
    if (kind === 'move') this._joystick(pointer, event.clientX, event.clientY);
    else if (kind !== 'look') this.input.setVirtualKey(kind, true);
  }

  _move(event) {
    const pointer = this._pointers.get(event.pointerId);
    if (!pointer) return;
    if (!this.sync()) return;
    event.preventDefault();
    event.stopPropagation();
    if (pointer.kind === 'move') this._joystick(pointer, event.clientX, event.clientY);
    else if (pointer.kind === 'look') {
      this.input.addLook((event.clientX - pointer.x) * 1.25, (event.clientY - pointer.y) * 1.25);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
  }

  _joystick(pointer, x, y) {
    let dx = x - pointer.cx, dy = y - pointer.cy;
    const length = Math.hypot(dx, dy);
    if (length > pointer.radius) {
      dx *= pointer.radius / length;
      dy *= pointer.radius / length;
    }
    this.thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    const dead = pointer.radius * 0.22;
    this.input.setVirtualKey('KeyW', dy < -dead);
    this.input.setVirtualKey('KeyS', dy > dead);
    this.input.setVirtualKey('KeyA', dx < -dead);
    this.input.setVirtualKey('KeyD', dx > dead);
  }

  _end(event) {
    const pointer = this._pointers.get(event.pointerId);
    if (!pointer) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    this._pointers.delete(event.pointerId);
    if (pointer.kind === 'move') {
      for (const key of MOVE_KEYS) this.input?.setVirtualKey(key, false);
      this.thumb.style.transform = '';
    } else if (pointer.kind !== 'look' && ![...this._pointers.values()].some(p => p.kind === pointer.kind)) {
      this.input?.setVirtualKey(pointer.kind, false);
    }
    if (![...this._pointers.values()].some(p => p.target === pointer.target)) pointer.target.classList.remove('is-held');
    try { pointer.target.releasePointerCapture(event.pointerId); } catch { /* Already released by the browser. */ }
  }

  clear() {
    const pointers = [...this._pointers.entries()];
    this._pointers.clear();
    for (const [id, pointer] of pointers) {
      pointer.target.classList.remove('is-held');
      try { pointer.target.releasePointerCapture(id); } catch { /* Already released. */ }
    }
    if (this.thumb) this.thumb.style.transform = '';
    this.input?.clearVirtual();
    if (this.input?.look) this.input.look.x = this.input.look.y = 0;
  }

  dispose() {
    this.clear();
    this._ac.abort();
    this._canvasAC?.abort();
    if (this.input) this.input.enabled = true;
    this.el?.remove();
  }
}
