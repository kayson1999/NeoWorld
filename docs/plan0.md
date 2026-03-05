# NeoWorld — Phase 0 雏形计划总结

> 本文档记录 NeoWorld 项目雏形阶段（Phase 0）的开发内容、已完成功能和架构决策。

---

## 一、阶段目标

验证核心玩法可行性：以"工业围城"为世界背景，实现一个可运行的 Web 端游戏雏形，包含：

- 基础世界引擎与角色系统
- NPC 固定剧情 + LLM 驱动自由对话
- 对话影响系统（好感度/情感/属性变化）
- 主动故事线（玩家自由输入生成事件）
- 2D 像素风格前端

---

## 二、已完成功能

### 2.1 后端架构

- **技术选型**：Python + FastAPI，uvicorn 作为 ASGI 服务器
- **游戏服务**：`src/app.py` 提供 11 个 API 接口，覆盖游戏全流程
- **数据存储**：内存存储（雏形阶段，单玩家）

### 2.2 核心系统

| 模块 | 文件 | 功能 |
|------|------|------|
| 世界引擎 | `src/core/world.py` | 游戏核心逻辑、新游戏/新一天/事件处理/状态管理 |
| 角色系统 | `src/core/character.py` | 角色属性（生命/饥饿/金钱/声望）、效果应用、状态序列化 |
| 事件系统 | `src/core/event.py` | 事件定义、选择分支、效果触发 |
| 对话影响引擎 | `src/core/dialogue_effect.py` | 好感度追踪、情感分析、关系里程碑、属性安全校验（白名单+数值钳制） |

### 2.3 AI 系统

| 功能 | 说明 |
|------|------|
| LLM 客户端 | `src/ai/llm_client.py`，支持 OpenAI 兼容接口（通义千问 qwen-plus） |
| NPC 对话 | LLM 生成上下文相关回复 + 结构化效果（sentiment/player_effects/npc_mood） |
| 事件生成 | 主动故事线：玩家自由输入 → LLM 生成游戏事件（标题/描述/选择） |
| 兜底机制 | LLM 不可用时，从 `fallback_replies` 随机抽取回复 |
| 滑动窗口记忆 | 保留最近 N 轮对话历史作为 LLM 上下文 |

### 2.4 数据配置

- `npcs.json`：NPC 定义（人设、固定剧情、兜底回复、系统提示词）
- `story.json`：NPC 对话提示词模板（含 system/user prompt）
- `events.json`：随机/定时事件配置
- `world.json`：世界参数
- `dialogue_effects.json`：对话影响规则（好感度阈值/情感权重/衰减率）

### 2.5 前端

- **渲染**：原生 JavaScript + Canvas 2D
- **模块**：game.js（主逻辑）、dialogue.js（对话 UI）、hud.js（状态面板）、sprites.js（精灵图）、tilemap.js（瓦片地图）、player.js、npc.js、camera.js
- **交互**：固定剧情选项选择 + 自由文本输入对话
- **UI 反馈**：好感度变化动画、属性变化日志、NPC 情绪表情

---

## 三、关键技术决策

### 3.1 LLM 集成方案

- 使用 OpenAI 兼容接口，便于切换不同 LLM 提供商
- API 配置通过 `.env` 文件管理，不入版本控制
- LLM 返回结构化 JSON（回复文本 + 效果数据），非纯文本

### 3.2 对话影响系统

- **情感分析**：LLM 判断对话情感（positive/neutral/negative/very_negative）
- **好感度机制**：基于情感的好感度变化 + 每日衰减 + 关系里程碑
- **属性安全校验**：
  - 白名单：仅允许 `health/hunger/money/reputation`
  - 数值钳制：单次变化限制在 `[-20, +20]`
  - 由 `dialogue_effect.py` 统一处理，避免重复 apply

### 3.3 双模式 NPC 交互

- **固定剧情模式**（scripted）：预设对话 + 选项，效果确定性
- **自由对话模式**（free_chat）：LLM 驱动，效果由模型判断
- 自动检测：优先触发未完成的固定剧情，否则进入自由对话

---

## 四、已修复的问题

| 问题 | 原因 | 修复方案 |
|------|------|----------|
| NPC 自由对话与输入无关 | `.env` 文件缺失，LLM 未启用，走兜底回复 | 创建 `.env` 并配置 API Key |
| 自由对话中"花钱"未触发金钱扣减 | `app.py` 未将 LLM 返回的 `player_effects` 应用到角色 | `dialogue_effect.py` 已有处理逻辑，确认链路通畅 |
| 金钱被双重扣减 | `app.py` 和 `dialogue_effect.py` 各 apply 一次 | 移除 `app.py` 中重复的 `apply_effect`，统一由 `dialogue_effect.py` 处理 |

---

## 五、后续计划（Phase 1）

- [ ] 完善事件系统（链式事件、条件触发）
- [ ] 经济模型实现（资源交易、工资发放、生存消耗）
- [ ] NPC 行为树（主动互动、日程安排）
- [ ] 情感引擎（PAD 模型、跨会话记忆）
- [ ] 更多 NPC 和固定剧情内容
- [ ] 持久化存储（SQLite / PostgreSQL）
- [ ] 测试覆盖

---

> **当前状态**：Phase 0 雏形已跑通核心对话 + 影响系统闭环，可作为后续开发的基础。
