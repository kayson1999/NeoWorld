"""NeoWorld 游戏服务器"""

from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.core.world import WorldEngine
from src.core.event import Event, Choice
from src.core.dialogue_effect import DialogueEffectEngine
from src.ai.llm_client import LLMClient

app = FastAPI(title="NeoWorld - 工业围城")

# 挂载静态资源目录
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# 游戏实例（雏形阶段用内存存储，单玩家）
engine = WorldEngine()
llm = LLMClient()
dialogue_engine = DialogueEffectEngine()


class NewGameRequest(BaseModel):
    player_name: str = ""


class ChoiceRequest(BaseModel):
    choice_index: int


class FreeInputRequest(BaseModel):
    text: str


class NPCChatRequest(BaseModel):
    npc_id: str
    message: str


class ScriptChoiceRequest(BaseModel):
    npc_id: str
    script_id: str
    choice_index: int


@app.get("/", response_class=HTMLResponse)
async def index():
    """返回游戏主页面"""
    html_path = Path(__file__).parent / "templates" / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


@app.post("/api/new_game")
async def new_game(req: NewGameRequest):
    """开始新游戏"""
    result = engine.new_game(req.player_name)
    result["llm_enabled"] = llm.enabled
    # 清除 NPC 对话历史和关系
    llm.clear_npc_history()
    dialogue_engine.reset()
    return result


@app.get("/api/npc_defs")
async def get_npc_defs():
    """获取 NPC 定义列表（前端用，从配置文件加载）"""
    return llm.get_npc_defs_for_frontend()


@app.post("/api/npc_interact")
async def npc_interact(req: NPCChatRequest):
    """NPC 交互入口：自动判断固定剧情 or 自由对话

    返回 mode: "scripted" | "free_chat"
    - scripted: 返回固定剧情脚本数据
    - free_chat: 返回 NPC 开场白，前端进入自由聊天模式
    """
    if not engine.character:
        return {"error": "游戏未开始"}

    npc_id = req.npc_id
    char_state = engine.character.to_display()

    # 检查是否有可触发的固定剧情
    script = llm.check_scripted_dialogue(npc_id, char_state)

    if script:
        return {
            "mode": "scripted",
            "script": {
                "id": script["id"],
                "lines": script["lines"],
                "choices": [
                    {"index": i, "text": c["text"]}
                    for i, c in enumerate(script["choices"])
                ],
            },
        }

    # 无固定剧情，进入自由对话模式
    npc_cfg = llm.get_npc_config(npc_id)
    greeting = npc_cfg["greeting"] if npc_cfg else "……"

    return {
        "mode": "free_chat",
        "greeting": greeting,
    }


@app.post("/api/npc_script_choice")
async def npc_script_choice(req: ScriptChoiceRequest):
    """固定剧情选择：玩家在固定剧情中做出选择"""
    if not engine.character:
        return {"error": "游戏未开始"}

    npc_id = req.npc_id
    npc_cfg = llm.get_npc_config(npc_id)
    if not npc_cfg:
        return {"error": "NPC 不存在"}

    # 查找对应的剧情脚本
    script = None
    for s in npc_cfg.get("scripted_dialogues", []):
        if s["id"] == req.script_id:
            script = s
            break

    if not script:
        return {"error": "剧情不存在"}

    if req.choice_index < 0 or req.choice_index >= len(script["choices"]):
        return {"error": "无效选择"}

    choice = script["choices"][req.choice_index]

    # 标记剧情已触发、递增交互计数
    llm.mark_script_triggered(script["id"])
    llm.increment_chat_count(npc_id)

    # 应用属性效果
    effect = choice.get("effect", {})
    effect_logs = []
    if effect:
        effect_logs = engine.character.apply_effect(effect)

    # 通过影响引擎处理好感度（固定剧情默认 positive 情感）
    sentiment = "positive" if any(v > 0 for v in effect.values()) else "neutral"
    effect_data = {
        "sentiment": sentiment,
        "npc_mood": "平静",
        "player_effects": {},
        "reason": "剧情选择",
    }
    effect_result = dialogue_engine.process_dialogue_effects(
        npc_id, effect_data, engine.character
    )

    return {
        "npc_id": npc_id,
        "reply": choice.get("reply", "……"),
        "effect_logs": effect_logs,
        "character": engine.character.to_display(),
        "effects": {
            "sentiment": effect_result["sentiment"],
            "sentiment_desc": effect_result["sentiment_desc"],
            "relationship": effect_result["relationship"],
            "logs": effect_result["logs"],
            "milestone_triggered": effect_result["milestone_triggered"],
        },
    }


@app.post("/api/npc_chat")
async def npc_chat(req: NPCChatRequest):
    """与 NPC 自由对话（含影响系统 + 滑动窗口记忆）"""
    if not engine.character:
        return {"error": "游戏未开始"}

    npc_id = req.npc_id
    char_state = engine.character.to_display()

    # 递增交互计数
    llm.increment_chat_count(npc_id)

    # 获取关系上下文（注入 LLM prompt）
    rel_context = dialogue_engine.get_relationship_context(npc_id)

    # 调用 LLM 获取回复 + 结构化影响数据
    result = await llm.chat_with_npc(
        npc_id, req.message, char_state, rel_context
    )

    reply = result["reply"]
    effects = result["effects"]

    # 通过影响引擎处理效果（内部已包含 player_effects 的安全校验和 apply）
    effect_result = dialogue_engine.process_dialogue_effects(
        npc_id, effects, engine.character
    )

    return {
        "npc_id": npc_id,
        "reply": reply,
        "character": engine.character.to_display(),
        "effects": {
            "sentiment": effect_result["sentiment"],
            "sentiment_desc": effect_result["sentiment_desc"],
            "relationship": effect_result["relationship"],
            "logs": effect_result["logs"],
            "milestone_triggered": effect_result["milestone_triggered"],
        },
    }


@app.post("/api/next_day")
async def next_day():
    """进入下一天"""
    # 应用好感度每日衰减
    dialogue_engine.apply_daily_decay()
    return engine.start_new_day()


@app.post("/api/choice")
async def make_choice(req: ChoiceRequest):
    """做出选择"""
    return engine.make_choice(req.choice_index)


@app.post("/api/free_input")
async def free_input(req: FreeInputRequest):
    """主动故事线：自由输入"""
    if not engine.character:
        return {"error": "游戏未开始"}

    char_state = engine.character.to_display()
    event_data = await llm.generate_event(req.text, char_state)

    if not event_data:
        return {"error": "无法生成事件"}

    # 将 LLM 生成的事件注入引擎
    choices = [Choice(**c) for c in event_data["choices"]]
    event = Event(
        id=f"evt_llm_{engine.character.day}",
        title=event_data["title"],
        description=event_data["description"],
        choices=choices,
    )
    engine.current_event = event

    return {
        "event": engine._event_to_dict(event),
        "character": engine.character.to_display(),
        "source": "llm" if llm.enabled else "fallback",
    }


@app.get("/api/relationships")
async def get_relationships():
    """获取所有 NPC 关系状态"""
    return dialogue_engine.get_all_relationships()


@app.get("/api/state")
async def get_state():
    """获取当前游戏状态"""
    return engine.get_state()
