/**
 * hud.js - 像素风格 HUD 状态栏
 */

class HUD {
  constructor() {
    this.element = null;
    this.tipElement = null;
    this._init();
  }

  _init() {
    // 顶部 HUD
    this.element = document.createElement('div');
    this.element.id = 'pixel-hud';
    this.element.innerHTML = `
      <div class="hud-stat" id="hud-day"><span class="hud-icon">☀</span> <span class="hud-label">天数</span> <span class="hud-val" id="hv-day">1</span></div>
      <div class="hud-stat" id="hud-health"><span class="hud-icon">♥</span> <span class="hud-label">生命</span> <span class="hud-bar"><span class="hud-bar-fill" id="hb-health"></span></span> <span class="hud-val" id="hv-health">100</span></div>
      <div class="hud-stat" id="hud-hunger"><span class="hud-icon">🍖</span> <span class="hud-label">饱食</span> <span class="hud-bar"><span class="hud-bar-fill" id="hb-hunger"></span></span> <span class="hud-val" id="hv-hunger">100</span></div>
      <div class="hud-stat" id="hud-money"><span class="hud-icon">💰</span> <span class="hud-label">金钱</span> <span class="hud-val" id="hv-money">50</span></div>
      <div class="hud-stat" id="hud-rep"><span class="hud-icon">⭐</span> <span class="hud-label">声望</span> <span class="hud-bar"><span class="hud-bar-fill" id="hb-rep"></span></span> <span class="hud-val" id="hv-rep">10</span></div>
    `;
    document.body.appendChild(this.element);

    // 底部操作提示
    this.tipElement = document.createElement('div');
    this.tipElement.id = 'pixel-tip';
    this.tipElement.textContent = 'WASD 移动 | E 交互 | N 下一天 | F 自由输入';
    document.body.appendChild(this.tipElement);

    // 阶段栏
    this.phaseElement = document.createElement('div');
    this.phaseElement.id = 'pixel-phase';
    document.body.appendChild(this.phaseElement);
  }

  update(char, phase) {
    if (!char) return;

    document.getElementById('hv-day').textContent = char.day;
    this._updateStat('health', char.health, 100);
    this._updateStat('hunger', char.hunger, 100);
    document.getElementById('hv-money').textContent = char.money;
    this._updateStat('rep', char.reputation, 100);

    if (phase) {
      this.phaseElement.textContent = `${phase.name} — ${phase.description}`;
      this.phaseElement.style.display = 'block';
    }
  }

  _updateStat(name, value, max) {
    const valEl = document.getElementById(`hv-${name}`);
    const barEl = document.getElementById(`hb-${name}`);
    if (valEl) valEl.textContent = value;
    if (barEl) {
      const pct = Math.max(0, Math.min(100, (value / max) * 100));
      barEl.style.width = pct + '%';
      barEl.className = 'hud-bar-fill';
      if (pct <= 20) barEl.classList.add('bar-danger');
      else if (pct <= 50) barEl.classList.add('bar-warning');
      else barEl.classList.add('bar-good');
    }
  }

  setTip(text) {
    this.tipElement.textContent = text;
  }

  show() {
    this.element.style.display = 'flex';
    this.tipElement.style.display = 'block';
  }

  hide() {
    this.element.style.display = 'none';
    this.tipElement.style.display = 'none';
    this.phaseElement.style.display = 'none';
  }
}
