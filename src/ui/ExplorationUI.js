import { UI } from './UI.js';
import { WORLD } from '../world/WorldLayout.js';
import { useTouchControls } from '../core/DeviceProfile.js';
import { MobileControls } from './MobileControls.js';
import './exploration.css';

// Keep the upstream controls and accessibility behavior; present only the
// exploration experience. Fishing/economy UI is never constructed by App.
export class ExplorationUI extends UI {
  constructor() {
    super();
    this.root.classList.add('is-exploration');
    this.touchMode = useTouchControls();
    this.root.classList.toggle('is-touch', this.touchMode);
    this.root.querySelector('.tw-brand-name').textContent = 'CRESCENT ISLE';
    this.startEl.querySelector('.tw-start-title').textContent = '月湾岛';
    const subtitle = document.createElement('p');
    subtitle.className = 'island-subtitle';
    subtitle.textContent = 'CRESCENT ISLE · 沿着海风，慢慢走';
    this.startEl.querySelector('.tw-start-title').after(subtitle);
    this.startEl.querySelector('.tw-start-cta span:last-child').textContent = '开始漫游';
    this.startEl.querySelector('.tw-start-keys').innerHTML = '<span><kbd>W A S D</kbd>行走</span><span><kbd>鼠标</kbd>环顾</span><span><kbd>Shift</kbd>快走</span><span><kbd>Esc</kbd>释放鼠标</span>';

    this.helpEl.querySelector('h2').textContent = '漫游指南';
    this.helpEl.querySelector('.tw-help-head p').textContent = '点击场景进入漫游；按 Esc 释放鼠标。';
    const section = (name, rows) => `<section><h3>${name}</h3>${rows.map(([key, text]) => `<div class="tw-help-row"><span class="tw-keys"><kbd>${key}</kbd></span><span class="tw-help-text">${text}</span></div>`).join('')}</section>`;
    this.helpEl.querySelector('.tw-help-grid').innerHTML =
      section('探索', [['W A S D', '行走'], ['鼠标', '环顾'], ['Shift', '快走'], ['Space', '跳跃 / 向上游'], ['C', '下潜']]) +
      section('视角', [['F', '自由相机 / 返回步行'], ['E', '登船 / 操舵 / 离船'], ['V', '船上视角'], ['Home', '回到步道入口']]) +
      section('环境', [['H', '海水、天空和画质设置'], ['T', '开始 / 暂停昼夜变化'], ['L', '手电筒'], ['M', '声音开关'], ['P', '隐藏界面'], ['F1', '本指南']]);
    this.helpEl.querySelector('.tw-help-guide').innerHTML = '<span>从木码头出发，沿坡道经过三间海边小屋，再走向林间小径。浅海可以游泳探索。</span><a href="./credits.html" target="_blank" rel="noopener">作品与素材来源 ↗</a>';
    if (this.touchMode) {
      this.startEl.querySelector('.tw-start-cta span:last-child').textContent = '轻触开始漫游';
      this.startEl.querySelector('.tw-start-keys').innerHTML = '<span><kbd>左摇杆</kbd>移动</span><span><kbd>右侧拖动</kbd>环顾</span>';
      this.helpEl.querySelector('.tw-help-head p').textContent = '左拇指控制方向，右侧空白画面拖动环顾；两手可以同时操作。';
      this.helpEl.querySelector('.tw-help-grid').innerHTML =
        section('行走与游泳', [['左摇杆', '拖动行走，松开停止'], ['右侧画面', '拖动环顾四周'], ['跳跃', '轻触跳跃；水中按住上浮'], ['下潜', '水中按住向下游']]) +
        section('探索与环境', [['交互', '靠近船只后登船、操舵或离船'], ['入口', '随时回到步道起点'], ['设置', '调整海水、天空和画质'], ['指南', '再次查看这些操作']]);
      this.helpEl.querySelector('.tw-help-close').setAttribute('aria-label', '关闭漫游指南');
      this.panel.querySelector('.tw-panel-title').textContent = '环境设置';
    }

    const home = document.createElement('button');
    home.className = 'island-home';
    home.type = 'button';
    home.textContent = '⌂ 回到入口';
    home.title = '回到步道入口（Home）';
    home.addEventListener('click', () => this.resetWalker());
    this.root.append(home);
    window.addEventListener('keydown', event => {
      if (event.code !== 'Home' || /INPUT|SELECT|TEXTAREA/.test(event.target?.tagName || '')) return;
      event.preventDefault();
      this.resetWalker();
    }, { signal: this._ac.signal });
  }

  bindApp(app) {
    this.app = app;
    this.mobileControls?.dispose();
    this.mobileControls = new MobileControls(this, app);
  }

  showStartOverlay(onStart) {
    const promise = super.showStartOverlay(() => {
      this.mobileControls?.start();
      onStart?.();
    });
    this.mobileControls?.sync();
    return promise;
  }

  togglePanel(force) {
    const open = super.togglePanel(force);
    this.mobileControls?.sync();
    return open;
  }

  toggleHelp(force) {
    const open = super.toggleHelp(force);
    this.mobileControls?.sync();
    return open;
  }

  setPhotoMode(on) {
    super.setPhotoMode(on);
    this.mobileControls?.sync();
  }

  setPrompt(key, text) {
    if (this.touchMode && key === 'E') key = '交互';
    if (this.touchMode && key === 'F') { key = '入口'; text = '返回步行'; }
    super.setPrompt(key, text);
  }

  resetWalker() {
    const app = this.app;
    if (!app?.player || !app.terrainData || !app.colliders) return;
    this.mobileControls?.clear();
    const player = app.player, start = WORLD.start;
    if (player.mode === 'boat') player.leaveHelm();
    app.setFreeCam(false);
    player.mode = 'walk';
    player.position.copy(start.position);
    player.position.y = Math.max(app.terrainData.heightAt(start.position.x, start.position.z), app.colliders.groundHeightAt(start.position.x, start.position.z, 50));
    player.velocity.set(0, 0, 0);
    player.yaw = start.yaw;
    player.pitch = -0.05;
    player.camOff = 0;
    player.camOffV = 0;
    player._camY = null;
    player.grounded = true;
    player.waterMean = null;
    player.waterH = 0;
    player.floating = true;
    app.input.keys.clear();
    app.input.pressed.clear();
    app.input.look.x = app.input.look.y = 0;
    // Returning home is a camera teleport; invalidate the upscaler's old view.
    if (app.post?.taau) app.post.taau._needsRestart = true;
    this.toast('已回到月湾步道入口');
  }

  dispose() {
    this.mobileControls?.dispose();
    super.dispose();
  }
}
