/**
 * npc.js - NPC 系统（插件化：NPC 定义从服务器配置加载）
 */

// NPC 定义：初始为空，游戏开始时从 API 加载
let NPC_DEFS = [];

class NPC {
  constructor(app, def) {
    this.app = app;
    this.def = def;
    this.x = def.x * TILE_SIZE + TILE_SIZE / 2;
    this.y = def.y * TILE_SIZE + TILE_SIZE / 2;
    this.interactRange = TILE_SIZE * 2;

    const tex = SpriteFactory.getTexture(app, def.sprite);
    this.sprite = new PIXI.Sprite(tex);
    this.sprite.anchor.set(0.5, 0.8);

    // NPC 名字
    this.nameLabel = new PIXI.Text({ text: def.name, style: {
      fontFamily: 'monospace',
      fontSize: 9,
      fill: '#ffdd88',
      stroke: { color: '#000000', width: 2 },
    }});
    this.nameLabel.anchor.set(0.5, 1);

    // 感叹号标记
    this.marker = null;
    if (def.interactable) {
      const markerTex = SpriteFactory.getTexture(app, 'interact_marker');
      this.marker = new PIXI.Sprite(markerTex);
      this.marker.anchor.set(0.5, 1);
      this.marker.visible = false;
    }

    this.container = new PIXI.Container();
    this.container.addChild(this.sprite);
    this.container.addChild(this.nameLabel);
    if (this.marker) this.container.addChild(this.marker);

    this.container.x = Math.round(this.x);
    this.container.y = Math.round(this.y);
    this.container.zIndex = Math.round(this.y);
    this.container.sortableChildren = true;

    // 标签定位
    this.nameLabel.x = 0;
    this.nameLabel.y = -this.sprite.height * 0.5 - 4;
    if (this.marker) {
      this.marker.x = 0;
      this.marker.y = -this.sprite.height * 0.5 - 20;
    }

    // NPC 简单的idle动画
    this.idleTimer = Math.random() * Math.PI * 2;
  }

  update(playerX, playerY) {
    // idle 呼吸动画
    this.idleTimer += 0.03;
    this.sprite.y = Math.sin(this.idleTimer) * 1;

    // 感叹号显示/隐藏
    if (this.marker) {
      const dist = Math.hypot(this.x - playerX, this.y - playerY);
      this.marker.visible = dist < this.interactRange;
      if (this.marker.visible) {
        this.marker.y = -this.sprite.height * 0.5 - 20 + Math.sin(this.idleTimer * 3) * 2;
      }
    }
  }

  isInRange(playerX, playerY) {
    return Math.hypot(this.x - playerX, this.y - playerY) < this.interactRange;
  }
}

class NPCManager {
  constructor(app) {
    this.app = app;
    this.npcs = [];
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
  }

  /**
   * 初始化 NPC（从 API 加载配置后调用）
   * @param {Array} defs - NPC 定义数组，若为空则使用全局 NPC_DEFS
   */
  init(defs) {
    const npcDefs = defs || NPC_DEFS;
    for (const def of npcDefs) {
      const npc = new NPC(this.app, def);
      this.npcs.push(npc);
      this.container.addChild(npc.container);
    }
  }

  update(playerX, playerY) {
    for (const npc of this.npcs) {
      npc.update(playerX, playerY);
    }
  }

  getNearbyNPC(playerX, playerY) {
    for (const npc of this.npcs) {
      if (npc.def.interactable && npc.isInRange(playerX, playerY)) {
        return npc;
      }
    }
    return null;
  }
}
