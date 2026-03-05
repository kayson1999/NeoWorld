# NeoWorld

> AI 驱动叙事的策略生存类游戏 — Real: Neo World

## 简介

**NeoWorld** 是一款以 AI 驱动叙事为核心的策略生存类游戏。玩家通过对话决策和情感输入，塑造角色的性格、行为与命运。游戏构建在自定义的世界模型之上，融合经济系统、生存法则与社交交互，支持多人协同游玩和插件化扩展。

## 核心特性

- **双线叙事引擎**
  - 被动故事线：游戏预设剧情分支，玩家决策驱动走向
  - 主动故事线：玩家输入真实情感/遭遇，LLM 分析后映射为游戏内事件，持续影响角色命运
- **自洽世界模型** — 经济系统、生存规则、社会关系构成完整闭环
- **AI 驱动** — LLM 对话、情感引擎、NPC 行为树、智能决策系统
- **多人协同** — 多玩家共存同一世界，实时状态同步与社交交互
- **插件化扩展** — 开放插件接口，支持自定义世界规则、NPC 行为、UI 组件等

## 项目结构

```
NeoWorld/
├── docs/                   # 项目文档与设计规范
├── src/
│   ├── core/               # 核心系统
│   │   ├── world/          #   世界模型 — 规则引擎、环境模拟、时间系统
│   │   ├── story/          #   故事引擎 — 剧情分支、叙事状态机
│   │   ├── economy/        #   经济模型 — 资源、交易、淘汰机制
│   │   └── character/      #   角色系统 — 属性、性格、状态、成长
│   ├── engine/             # 游戏引擎（渲染/物理/音频/输入）
│   ├── network/            # 多人网络（服务器/客户端/状态同步/协议）
│   ├── ai/                 # AI 系统（NPC/对话/情感/决策）
│   ├── gameplay/           # 玩法层（生存/社交/事件/任务）
│   ├── ui/                 # 用户界面（HUD/菜单/聊天/背包）
│   ├── data/               # 数据层（配置/模型定义/迁移/种子数据）
│   ├── plugins/            # 插件系统（基类接口/示例插件）
│   ├── tests/              # 测试（单元/集成/端到端）
│   └── scripts/            # 脚本工具（构建/部署/辅助）
└── assets/                 # 资源文件（图片/音频/动画/字体/地图）
```

## 快速开始

```bash
# 克隆项目
git clone https://github.com/kayson1999/NeoWorld.git
cd NeoWorld

# 安装依赖（待项目初始化后补充具体命令）
# pip install -r requirements.txt

# 运行开发服务器（待实现）
# python -m src.main
```

> 项目处于早期开发阶段，具体运行方式将在 Phase 1 完成后更新。

## 技术栈

| 领域 | 方案 |
|------|------|
| 语言 | Python + TypeScript |
| 游戏引擎 | Godot / Pygame（原型期） |
| 网络 | WebSocket + Protobuf |
| AI/LLM | OpenAI API / Claude API / Ollama |
| 数据库 | PostgreSQL + Redis |
| 前端 | React / Vue + Canvas/WebGL |

## 开发路线

| 阶段 | 内容 | 周期 |
|------|------|------|
| Phase 1 | 原型验证 — 世界模型、角色系统、LLM 对话、决策树 | 1-2 月 |
| Phase 2 | 核心系统 — 经济模型、情感引擎、事件系统、NPC AI | 2-3 月 |
| Phase 3 | 多人协同 — 网络架构、状态同步、社交系统 | 2-3 月 |
| Phase 4 | 体验增强 — 2D 渲染、音频、动画、UI 精细化 | 2-3 月 |
| Phase 5 | 扩展打磨 — 插件系统、性能优化、社区工具 | 持续 |

详细计划见 [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)。

## 协同开发

### Git 工作流

- `main` — 稳定版本
- `develop` — 开发集成
- `feature/*` — 功能分支
- `hotfix/*` — 紧急修复

### 贡献流程

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交代码：`git commit -m "feat: add your feature"`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 许可证

[MIT](LICENSE)
