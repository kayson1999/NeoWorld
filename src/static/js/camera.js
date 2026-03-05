/**
 * camera.js - 摄像机跟随系统
 */

class Camera {
  constructor(screenW, screenH, worldW, worldH) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.worldW = worldW;
    this.worldH = worldH;
    this.x = 0;
    this.y = 0;
    this.lerp = 0.08; // 平滑跟随速度
  }

  follow(targetX, targetY) {
    const idealX = targetX - this.screenW / 2;
    const idealY = targetY - this.screenH / 2;

    this.x += (idealX - this.x) * this.lerp;
    this.y += (idealY - this.y) * this.lerp;

    // 限制边界
    this.x = Math.max(0, Math.min(this.x, this.worldW - this.screenW));
    this.y = Math.max(0, Math.min(this.y, this.worldH - this.screenH));
  }

  applyTo(container) {
    container.x = -Math.round(this.x);
    container.y = -Math.round(this.y);
  }

  centerOn(x, y) {
    this.x = x - this.screenW / 2;
    this.y = y - this.screenH / 2;
    this.x = Math.max(0, Math.min(this.x, this.worldW - this.screenW));
    this.y = Math.max(0, Math.min(this.y, this.worldH - this.screenH));
  }
}
