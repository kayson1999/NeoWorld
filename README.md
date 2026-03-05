# NeoWorld

> AI 驱动叙事的策略生存类游戏 — Real: Neo World

## 简介

**NeoWorld** 是一款以 AI 驱动叙事为核心的策略生存类游戏。玩家通过对话决策和情感输入，塑造角色的性格、行为与命运。游戏构建在自洽的世界模型之上，融合经济系统、生存法则与社交交互。

当前版本为**雏形阶段（v0.1）**，已实现：
- 基于 FastAPI 的 Web 游戏服务器
- 2D 像素风格前端（Canvas 渲染）
- 双线叙事引擎（固定剧情 + 自由对话）
- LLM 驱动的 NPC 智能对话（通义千问 / OpenAI 兼容接口）
- 对话影响系统（好感度、情感分析、属性变化）
- 主动故事线（玩家自由输入生成游戏事件）
- 世界背景：**工业围城**

## 核心特性

- **双线叙事引擎**
  - 被动故事线：预设剧情分支，玩家决策驱动走向
  - 主动故事线：玩家自由输入文本，LLM 分析后映射为游戏事件，持续影响角色命运
- **AI 驱动 NPC 对话** — LLM 生成上下文相关回复，支持结构化效果输出（好感度/属性变化）
- **对话影响系统** — 情感分析、好感度追踪、关系里程碑、属性安全校验
- **自洽世界模型** — 经济系统、生存规则、社会关系构成完整闭环

## 项目结构

```
NeoWorld/
├── docs/                      # 项目文档与计划
├── src/
│   ├── app.py                 # FastAPI 主服务（游戏 API）
│   ├── ai/
│   │   └── llm_client.py      # LLM 客户端（NPC 对话/事件生成/情感分析）
│   ├── core/
│   │   ├── character.py       # 角色系统（属性/状态/效果应用）
│   │   ├── dialogue_effect.py # 对话影响引擎（好感度/情感/里程碑）
│   │   ├── event.py           # 事件系统（事件/选择/效果）
│   │   └── world.py           # 世界引擎（游戏核心逻辑）
│   ├── data/configs/          # 数据配置
│   │   ├── npcs.json          # NPC 定义（人设/剧情/兜底回复）
│   │   ├── story.json         # 故事配置
│   │   ├── events.json        # 事件配置
│   │   ├── world.json         # 世界参数
│   │   └── dialogue_effects.json  # 对话影响规则
│   ├── static/js/             # 前端 JavaScript
│   │   ├── game.js            # 游戏主逻辑
│   │   ├── dialogue.js        # 对话系统 UI
│   │   ├── hud.js             # 状态面板
│   │   ├── sprites.js         # 精灵图系统
│   │   ├── tilemap.js         # 瓦片地图
│   │   ├── player.js          # 玩家渲染
│   │   ├── npc.js             # NPC 渲染
│   │   └── camera.js          # 摄像机
│   └── templates/
│       └── index.html         # 游戏主页面
├── assets/                    # 资源文件（精灵图/音频/动画/字体/地图）
├── .env.example               # 环境变量模板
├── requirements.txt           # Python 依赖
└── README.md
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/kayson1999/NeoWorld.git
cd NeoWorld
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置 LLM

复制环境变量模板并填入你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置 LLM 服务：

```env
# 支持 OpenAI / 通义千问 / Claude 等兼容接口
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
```

> 如果不配置 API Key，游戏仍可运行，NPC 对话将使用兜底回复（fallback）。

### 4. 启动服务器

```bash
python -m uvicorn src.app:app --host 0.0.0.0 --port 8080
```

### 5. 访问游戏

浏览器打开 `http://localhost:8080`

## API 接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 游戏主页面 |
| `/api/new_game` | POST | 开始新游戏 |
| `/api/npc_defs` | GET | 获取 NPC 定义列表 |
| `/api/npc_interact` | POST | NPC 交互入口（自动判断固定剧情/自由对话） |
| `/api/npc_script_choice` | POST | 固定剧情选择 |
| `/api/npc_chat` | POST | NPC 自由对话（LLM 驱动） |
| `/api/next_day` | POST | 进入下一天 |
| `/api/choice` | POST | 事件决策 |
| `/api/free_input` | POST | 主动故事线：自由输入生成事件 |
| `/api/relationships` | GET | 获取 NPC 关系状态 |
| `/api/state` | GET | 获取当前游戏状态 |

## 技术栈

| 领域 | 当前方案 |
|------|----------|
| 后端 | Python + FastAPI |
| 前端 | 原生 JavaScript + Canvas 2D |
| AI/LLM | OpenAI 兼容接口（通义千问 qwen-plus） |
| 模板引擎 | Jinja2 |
| 数据存储 | 内存（雏形阶段） |

## 开发路线

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0 | 雏形验证 — 基础世界引擎、角色系统、NPC 对话、对话影响系统 | ✅ 已完成 |
| Phase 1 | 原型完善 — 完整事件系统、经济模型、NPC 行为树 | 进行中 |
| Phase 2 | 核心系统 — 情感引擎、主动故事线增强、任务系统 | 待开始 |
| Phase 3 | 多人协同 — 网络架构、状态同步、社交系统 | 待开始 |
| Phase 4 | 体验增强 — 画面升级、音频、动画、UI 精细化 | 待开始 |
| Phase 5 | 扩展打磨 — 插件系统、性能优化、社区工具 | 待开始 |

详细计划见 [docs/plan1.0.md](docs/plan1.0.md) 和 [docs/plan0.md](docs/plan0.md)。

## Git 工作流

- `main` — 稳定版本
- `develop` — 开发集成
- `feature/*` — 功能分支
- `hotfix/*` — 紧急修复

## 许可证

[MIT](LICENSE)
