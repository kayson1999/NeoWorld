/**
 * player.js - 玩家角色控制
 */

class Player {
  constructor(app, tilemap) {
    this.app = app;
    this.tilemap = tilemap;
    this.speed = 2.5;
    this.x = 9 * TILE_SIZE + TILE_SIZE / 2;  // 出生在路上
    this.y = 9 * TILE_SIZE + TILE_SIZE / 2;
    this.direction = 'down';
    this.moving = false;
    this.animTimer = 0;
    this.animFrame = 0;

    // 加载方向精灵
    this.textures = {
      down: SpriteFactory.getTexture(app, 'player_down'),
      up: SpriteFactory.getTexture(app, 'player_up'),
      left: SpriteFactory.getTexture(app, 'player_left'),
      right: SpriteFactory.getTexture(app, 'player_right'),
    };

    this.sprite = new PIXI.Sprite(this.textures.down);
    this.sprite.anchor.set(0.5, 0.8);

    // 名字标签
    this.nameLabel = new PIXI.Text({ text: '', style: {
      fontFamily: 'monospace',
      fontSize: 10,
      fill: '#ffffff',
      stroke: { color: '#000000', width: 2 },
    }});
    this.nameLabel.anchor.set(0.5, 1);

    this.container = new PIXI.Container();
    this.container.addChild(this.sprite);
    this.container.addChild(this.nameLabel);
    this.container.sortableChildren = true;

    // 键盘状态
    this.keys = {};
    window.addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
  }

  setName(name) {
    this.nameLabel.text = name || '';
  }

  update() {
    let dx = 0, dy = 0;
    if (this.keys['w'] || this.keys['arrowup']) dy = -1;
    if (this.keys['s'] || this.keys['arrowdown']) dy = 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx = -1;
    if (this.keys['d'] || this.keys['arrowright']) dx = 1;

    // 归一化对角移动
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    this.moving = dx !== 0 || dy !== 0;

    if (this.moving) {
      // 方向判断
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? 'right' : 'left';
      } else {
        this.direction = dy > 0 ? 'down' : 'up';
      }

      const newX = this.x + dx * this.speed;
      const newY = this.y + dy * this.speed;

      // 分轴碰撞检测
      if (this.tilemap.isPositionWalkable(newX, this.y)) this.x = newX;
      if (this.tilemap.isPositionWalkable(this.x, newY)) this.y = newY;

      // 行走动画（简单的抖动效果）
      this.animTimer += 0.15;
      this.sprite.y = Math.sin(this.animTimer * 3) * 1.5;
    } else {
      this.sprite.y = 0;
      this.animTimer = 0;
    }

    // 切换方向精灵
    this.sprite.texture = this.textures[this.direction];

    // 更新容器位置
    this.container.x = Math.round(this.x);
    this.container.y = Math.round(this.y);
    this.container.zIndex = Math.round(this.y);

    // 名字标签位置
    this.nameLabel.x = 0;
    this.nameLabel.y = -this.sprite.height * 0.5 - 4;
  }
}
