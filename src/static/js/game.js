/**
 * game.js - 游戏主入口
 * 初始化 PixiJS，组装所有模块，驱动游戏主循环
 */

let dialogue;

const game = {
  app: null,
  worldContainer: null,
  tilemap: null,
  player: null,
  npcManager: null,
  camera: null,
  hud: null,
  started: false,
  gameOver: false,

  SCREEN_W: 960,
  SCREEN_H: 640,

  async init() {
    // 创建 PixiJS 应用
    this.app = new PIXI.Application();
    await this.app.init({
      width: this.SCREEN_W,
      height: this.SCREEN_H,
      backgroundColor: 0x0a0a0f,
      antialias: false,
      roundPixels: true,
    });

    // Canvas 居中
    const canvas = this.app.canvas;
    canvas.id = 'game-canvas';
    document.getElementById('canvas-wrapper').appendChild(canvas);

    // 像素风格渲染：关闭平滑
    PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';

    // 世界容器
    this.worldContainer = new PIXI.Container();
    this.worldContainer.sortableChildren = true;
    this.app.stage.addChild(this.worldContainer);

    // 初始化地图
    this.tilemap = new TileMap(this.app);
    this.tilemap.init();
    this.worldContainer.addChild(this.tilemap.container);
    this.worldContainer.addChild(this.tilemap.objectContainer);

    // 初始化玩家
    this.player = new Player(this.app, this.tilemap);
    this.worldContainer.addChild(this.player.container);

    // 初始化 NPC
    this.npcManager = new NPCManager(this.app);
    this.npcManager.init();
    this.worldContainer.addChild(this.npcManager.container);

    // 初始化摄像机
    this.camera = new Camera(
      this.SCREEN_W, this.SCREEN_H,
      this.tilemap.pixelWidth, this.tilemap.pixelHeight
    );
    this.camera.centerOn(this.player.x, this.player.y);

    // 初始化 HUD
    this.hud = new HUD();
    this.hud.hide();

    // 初始化对话系统
    dialogue = new DialogueSystem();

    // 键盘事件
    window.addEventListener('keydown', (e) => this._onKey(e));

    // 游戏主循环
    this.app.ticker.add(() => this._gameLoop());
  },

  _gameLoop() {
    if (!this.started || this.gameOver) return;
    if (dialogue && dialogue.isOpen) return; // 对话中不更新

    this.player.update();
    this.npcManager.update(this.player.x, this.player.y);
    this.camera.follow(this.player.x, this.player.y);
    this.camera.applyTo(this.worldContainer);

    // 更新精灵排序
    this.player.container.zIndex = Math.round(this.player.y);
  },

  _onKey(e) {
    if (!this.started) return;
    if (dialogue && dialogue.isOpen) return;

    const key = e.key.toLowerCase();

    // E: 交互（靠近 NPC 时）— 自动判断固定剧情 / 自由对话
    if (key === 'e') {
      const npc = this.npcManager.getNearbyNPC(this.player.x, this.player.y);
      if (npc) {
        dialogue.startNPCInteraction(npc.def.id, npc.def.name);
      }
    }

    // N: 进入下一天
    if (key === 'n') {
      this.nextDay();
    }

    // F: 自由输入
    if (key === 'f') {
      dialogue.showFreeInput();
    }
  },

  // =========== API 调用 ===========

  async api(path, body = {}) {
    const res = await fetch(path, {
      method: path === '/api/state' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: path === '/api/state' ? undefined : JSON.stringify(body),
    });
    return res.json();
  },

  async startGame(playerName) {
    const data = await this.api('/api/new_game', { player_name: playerName || '' });
    this.started = true;
    this.gameOver = false;

    this.player.setName(playerName || data.character.name);
    this.hud.show();
    this.hud.update(data.character, data.phase);

    // 从 API 加载 NPC 定义（插件化：NPC 配置由服务端配置文件管理）
    try {
      const npcRes = await fetch('/api/npc_defs');
      const npcDefs = await npcRes.json();
      if (Array.isArray(npcDefs) && npcDefs.length > 0) {
        NPC_DEFS = npcDefs;
        // 重新初始化 NPC（清除旧的）
        this.worldContainer.removeChild(this.npcManager.container);
        this.npcManager = new NPCManager(this.app);
        this.npcManager.init(npcDefs);
        this.worldContainer.addChild(this.npcManager.container);
      }
    } catch (e) {
      console.warn('[NPC] 无法从 API 加载 NPC 定义，使用默认配置', e);
    }

    // 隐藏标题画面
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('canvas-wrapper').style.display = 'flex';

    return data;
  },

  async nextDay() {
    const data = await this.api('/api/next_day');
    if (data.error) return;

    this.hud.update(data.character, data.phase);

    if (data.game_over) {
      this.gameOver = true;
      dialogue.showEnding(data);
      return;
    }

    dialogue.showDailyReport(data);
  },

  async handleChoice(index) {
    const data = await this.api('/api/choice', { choice_index: index });
    if (data.error) return;

    this.hud.update(data.character);

    if (data.game_over) {
      this.gameOver = true;
      dialogue.close();
      setTimeout(() => dialogue.showEnding(data), 300);
      return;
    }

    dialogue.showResult(data);
  },

  async submitFreeInput() {
    const ta = document.getElementById('dlg-free-input');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;

    dialogue.close();
    const data = await this.api('/api/free_input', { text });
    if (data.error) return;

    this.hud.update(data.character);

    if (data.event) {
      dialogue.showEvent(data.event);
    }
  },
};

// 页面加载后初始化
window.addEventListener('DOMContentLoaded', () => {
  game.init();

  // 开始按钮
  document.getElementById('btn-start').addEventListener('click', () => {
    const name = document.getElementById('input-name').value.trim();
    game.startGame(name);
  });

  // Enter 快速开始
  document.getElementById('input-name').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const name = document.getElementById('input-name').value.trim();
      game.startGame(name);
    }
  });
});
