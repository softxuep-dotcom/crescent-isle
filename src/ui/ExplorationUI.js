import { UI } from './UI.js';
import { WORLD } from '../world/WorldLayout.js';
import './exploration.css';

// Keep the upstream controls and accessibility behavior; present only the
// exploration experience. Fishing/economy UI is never constructed by App.
export class ExplorationUI extends UI {
  constructor() {
    super();
    this.root.classList.add('is-exploration');
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

  bindApp(app) { this.app = app; }

  resetWalker() {
    const app = this.app;
    if (!app?.player || !app.terrainData || !app.colliders) return;
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
}
