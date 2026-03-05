/**
 * tilemap.js - 瓦片地图系统
 * 定义工业围城的场景地图
 */

const TILE_SIZE = 32; // 每个瓦片的像素大小（16像素 * 2倍缩放）

// 地图瓦片类型
const TILE = {
  GROUND: 0,
  ROAD: 1,
  WATER: 2,
  WALL: 3,
  FLOOR: 4,
};

// 瓦片是否可通行
const TILE_WALKABLE = {
  [TILE.GROUND]: true,
  [TILE.ROAD]: true,
  [TILE.WATER]: false,
  [TILE.WALL]: false,
  [TILE.FLOOR]: true,
};

const TILE_NAMES = {
  [TILE.GROUND]: 'tile_ground',
  [TILE.ROAD]: 'tile_road',
  [TILE.WATER]: 'tile_water',
  [TILE.WALL]: 'tile_wall',
  [TILE.FLOOR]: 'tile_floor',
};

// 工业围城地图 (30x20)
// 0=草地  1=路  2=水  3=墙  4=地板
const MAP_DATA = [
  [0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,3,3,3,3,3,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,3,4,4,4,3,0,0,0,1,0,0,1,0,0,3,3,3,3,3,0,0,0,0],
  [0,0,0,0,0,0,0,3,4,4,4,3,0,0,0,1,0,0,1,0,0,3,4,4,4,3,0,0,0,0],
  [0,0,0,0,0,0,0,3,4,4,4,3,0,0,0,1,0,0,1,0,0,3,4,4,4,3,0,0,0,0],
  [0,0,0,0,0,0,0,3,3,1,3,3,0,0,0,1,0,0,1,0,0,3,3,1,3,3,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,3,3,3,1,3,3,3,3,3,3,3,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,3,4,4,4,4,4,4,4,4,4,4,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,3,4,4,4,4,4,4,4,4,4,4,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,3,4,4,4,4,4,4,4,4,4,4,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,3,4,4,4,4,4,4,4,4,4,4,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,3,3,3,3,3,1,1,3,3,3,3,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const MAP_COLS = MAP_DATA[0].length;
const MAP_ROWS = MAP_DATA.length;

// 建筑/装饰物定义
const MAP_OBJECTS = [
  // 工厂（大建筑）
  { type: 'building_factory', x: 7, y: 11, name: '铁锤工厂', collision: { w: 2, h: 2, ox: 0, oy: 0 } },
  // 住所
  { type: 'building_house', x: 8, y: 2, name: '工人宿舍', collision: { w: 1.5, h: 1.2, ox: 0, oy: 0 } },
  // 集市
  { type: 'building_market', x: 22, y: 3, name: '镇集市', collision: { w: 1.5, h: 1, ox: 0, oy: 0 } },
  // 树
  { type: 'deco_tree', x: 1, y: 1 },
  { type: 'deco_tree', x: 0, y: 5 },
  { type: 'deco_tree', x: 1, y: 13 },
  { type: 'deco_tree', x: 27, y: 1 },
  { type: 'deco_tree', x: 28, y: 12 },
  { type: 'deco_tree', x: 26, y: 18 },
  { type: 'deco_tree', x: 4, y: 18 },
  // 路灯
  { type: 'deco_lamp', x: 5, y: 8 },
  { type: 'deco_lamp', x: 14, y: 8 },
  { type: 'deco_lamp', x: 20, y: 8 },
  { type: 'deco_lamp', x: 11, y: 17 },
];

class TileMap {
  constructor(app) {
    this.app = app;
    this.container = new PIXI.Container();
    this.objectContainer = new PIXI.Container();
    this.collisionObjects = [];
  }

  init() {
    // 绘制地砖层
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const tileType = MAP_DATA[y][x];
        const texName = TILE_NAMES[tileType];
        const tex = SpriteFactory.getTexture(this.app, texName);
        const sprite = new PIXI.Sprite(tex);
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
        this.container.addChild(sprite);
      }
    }

    // 绘制物体层
    for (const obj of MAP_OBJECTS) {
      const tex = SpriteFactory.getTexture(this.app, obj.type);
      const sprite = new PIXI.Sprite(tex);
      sprite.x = obj.x * TILE_SIZE;
      sprite.y = obj.y * TILE_SIZE;
      sprite.zIndex = obj.y * TILE_SIZE + 100;
      this.objectContainer.addChild(sprite);

      if (obj.collision) {
        this.collisionObjects.push({
          x: obj.x * TILE_SIZE,
          y: obj.y * TILE_SIZE,
          w: (obj.collision.w || 1) * TILE_SIZE,
          h: (obj.collision.h || 1) * TILE_SIZE,
        });
      }
    }

    this.objectContainer.sortableChildren = true;
  }

  isTileWalkable(tileX, tileY) {
    if (tileX < 0 || tileX >= MAP_COLS || tileY < 0 || tileY >= MAP_ROWS) return false;
    return TILE_WALKABLE[MAP_DATA[tileY][tileX]] !== false;
  }

  isPositionWalkable(px, py, charW = 20, charH = 10) {
    // 检查四角
    const points = [
      [px - charW / 2, py - charH / 2],
      [px + charW / 2, py - charH / 2],
      [px - charW / 2, py + charH / 2],
      [px + charW / 2, py + charH / 2],
    ];
    for (const [cx, cy] of points) {
      const tx = Math.floor(cx / TILE_SIZE);
      const ty = Math.floor(cy / TILE_SIZE);
      if (!this.isTileWalkable(tx, ty)) return false;
    }
    // 检查建筑碰撞
    for (const obj of this.collisionObjects) {
      if (px + charW / 2 > obj.x && px - charW / 2 < obj.x + obj.w &&
          py + charH / 2 > obj.y && py - charH / 2 < obj.y + obj.h) {
        return false;
      }
    }
    return true;
  }

  get pixelWidth() { return MAP_COLS * TILE_SIZE; }
  get pixelHeight() { return MAP_ROWS * TILE_SIZE; }
}
