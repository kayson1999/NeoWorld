"""LLM 对话客户端 - 主动故事线的 AI 引擎 & NPC 对话

插件化设计：
- NPC 设定从 npcs.json 加载
- 叙事 prompt 从 story.json 加载
- 对话记忆窗口从 story.json 配置
"""

import os
import json
import random
from pathlib import Path
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# 配置文件路径
CONFIGS_DIR = Path(__file__).parent.parent / "data" / "configs"
NPC_CONFIG_PATH = CONFIGS_DIR / "npcs.json"
STORY_CONFIG_PATH = CONFIGS_DIR / "story.json"
WORLD_CONFIG_PATH = CONFIGS_DIR / "world.json"


class LLMClient:
    """LLM 客户端，用于主动故事线的事件生成 & NPC 对话

    插件化设计：
    - 所有 NPC 角色设定、台词、剧情从 npcs.json 读取
    - 叙事 prompt、对话模板从 story.json 读取
    - 新增/修改 NPC 只需编辑配置文件，无需改代码
    """

    def __init__(self):
        api_key = os.getenv("LLM_API_KEY", "")
        base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.enabled = bool(api_key and api_key != "your-api-key-here")

        if self.enabled:
            self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        else:
            self.client = None

        # 加载配置
        self.npc_config = self._load_json(NPC_CONFIG_PATH)
        self.story_config = self._load_json(STORY_CONFIG_PATH)
        self.world_config = self._load_json(WORLD_CONFIG_PATH)

        # NPC 对话历史（按 npc_id 存储）—— 滑动窗口
        self.npc_chat_history: dict[str, list[dict]] = {}

        # NPC 交互计数（用于固定剧情触发判断）
        self.npc_chat_counts: dict[str, int] = {}

        # 已触发的固定剧情 ID
        self.triggered_scripts: set[str] = set()

    @staticmethod
    def _load_json(path: Path) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def reload_configs(self):
        """热重载所有配置（开发调试用）"""
        self.npc_config = self._load_json(NPC_CONFIG_PATH)
        self.story_config = self._load_json(STORY_CONFIG_PATH)
        self.world_config = self._load_json(WORLD_CONFIG_PATH)

    @property
    def _max_history_messages(self) -> int:
        """最大历史消息条数（滑动窗口大小）"""
        return self.story_config.get("chat_history", {}).get("max_messages", 20)

    # ========== NPC 配置查询 ==========

    def get_npc_config(self, npc_id: str) -> dict | None:
        """获取 NPC 配置（供前后端共用）"""
        return self.npc_config.get("npcs", {}).get(npc_id)

    def get_all_npc_ids(self) -> list[str]:
        """获取所有 NPC ID"""
        return list(self.npc_config.get("npcs", {}).keys())

    def get_npc_defs_for_frontend(self) -> list[dict]:
        """导出前端需要的 NPC 定义列表"""
        defs = []
        for npc_id, cfg in self.npc_config.get("npcs", {}).items():
            defs.append({
                "id": npc_id,
                "name": cfg["name"],
                "sprite": cfg["sprite"],
                "x": cfg["position"]["x"],
                "y": cfg["position"]["y"],
                "interactable": cfg.get("interactable", True),
                "greeting": cfg.get("greeting", "……"),
            })
        return defs

    # ========== 固定剧情（脚本式对话） ==========

    def check_scripted_dialogue(
        self, npc_id: str, character_state: dict
    ) -> dict | None:
        """检查是否有可触发的固定剧情

        Returns:
            若有可用剧情返回脚本数据，否则返回 None
        """
        npc_cfg = self.get_npc_config(npc_id)
        if not npc_cfg:
            return None

        scripts = npc_cfg.get("scripted_dialogues", [])
        chat_count = self.npc_chat_counts.get(npc_id, 0)

        for script in scripts:
            script_id = script["id"]

            # 已触发过且设置了 once
            if script.get("once") and script_id in self.triggered_scripts:
                continue

            trigger = script.get("trigger", {})

            # 检查对话次数条件
            min_chats = trigger.get("min_chats", 0)
            max_chats = trigger.get("max_chats", float("inf"))
            if chat_count < min_chats or chat_count > max_chats:
                continue

            # 检查条件表达式（简单的属性条件）
            condition = trigger.get("condition")
            if condition and not self._eval_condition(condition, character_state):
                continue

            # 条件满足，返回此剧情
            return script

        return None

    def mark_script_triggered(self, script_id: str):
        """标记固定剧情已触发"""
        self.triggered_scripts.add(script_id)

    def increment_chat_count(self, npc_id: str):
        """递增 NPC 交互计数"""
        self.npc_chat_counts[npc_id] = self.npc_chat_counts.get(npc_id, 0) + 1

    @staticmethod
    def _eval_condition(condition: str, state: dict) -> bool:
        """评估简单条件表达式，如 'reputation >= 25'"""
        try:
            parts = condition.split()
            if len(parts) != 3:
                return True
            attr, op, val = parts[0], parts[1], int(parts[2])
            actual = state.get(attr, 0)
            if op == ">=":
                return actual >= val
            if op == "<=":
                return actual <= val
            if op == ">":
                return actual > val
            if op == "<":
                return actual < val
            if op == "==":
                return actual == val
            return True
        except (ValueError, IndexError):
            return True

    # ========== 自由对话（LLM 驱动） ==========

    async def chat_with_npc(
        self,
        npc_id: str,
        player_message: str,
        character_state: dict,
        relationship_context: str = "",
    ) -> dict:
        """玩家与 NPC 自由对话，返回 NPC 回复 + 结构化影响数据

        使用滑动窗口保留最近 N 轮对话记忆。

        Returns:
            {
                "reply": "NPC 的回复文本",
                "effects": {
                    "sentiment": "positive",
                    "npc_mood": "愉快",
                    "player_effects": {"hunger": 5},
                    "reason": "简述原因"
                }
            }
        """
        npc_cfg = self.get_npc_config(npc_id)
        if not npc_cfg:
            return {
                "reply": "……（这个人似乎不想说话）",
                "effects": {
                    "sentiment": "neutral",
                    "npc_mood": "平静",
                    "player_effects": {},
                    "reason": "",
                },
            }

        if not self.enabled:
            return self._fallback_npc_reply(npc_id)

        # 从配置构建 system prompt
        chat_prompt_template = self.story_config.get("npc_chat_prompt", "")
        world_name = self.world_config.get("world_name", "工业围城")
        world_desc = self.story_config.get("world_description", "")

        system_prompt = chat_prompt_template.format(
            persona=npc_cfg["persona"],
            world_name=world_name,
            world_description=world_desc,
            player_name=character_state.get("name", "无名者"),
            health=character_state.get("health", 100),
            hunger=character_state.get("hunger", 100),
            money=character_state.get("money", 50),
            reputation=character_state.get("reputation", 10),
            day=character_state.get("day", 1),
            relationship_context=relationship_context,
        )

        # 获取/初始化对话历史
        if npc_id not in self.npc_chat_history:
            self.npc_chat_history[npc_id] = []

        history = self.npc_chat_history[npc_id]
        max_msgs = self._max_history_messages

        # 构建消息列表：system + 滑动窗口历史 + 当前消息
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history[-max_msgs:])
        messages.append({"role": "user", "content": player_message})

        raw = ""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.85,
                max_tokens=350,
            )
            raw = response.choices[0].message.content or ""
            raw = raw.strip()

            # 解析 JSON
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            data = json.loads(raw)
            reply = data.get("reply", "……")
            effects = data.get("effects", {})

            # 确保 effects 格式正确
            effects.setdefault("sentiment", "neutral")
            effects.setdefault("npc_mood", "平静")
            effects.setdefault("player_effects", {})
            effects.setdefault("reason", "")

            # 记录对话历史（保存完整的 user/assistant 对）
            history.append({"role": "user", "content": player_message})
            history.append({"role": "assistant", "content": reply})

            # 滑动窗口裁剪
            if len(history) > max_msgs:
                self.npc_chat_history[npc_id] = history[-max_msgs:]

            return {"reply": reply, "effects": effects}

        except (json.JSONDecodeError, KeyError) as e:
            print(f"[LLM NPC Parse Error] {e}, raw: {raw[:200]}")
            if raw and not raw.startswith("{"):
                return {
                    "reply": raw[:200],
                    "effects": {
                        "sentiment": "neutral",
                        "npc_mood": "平静",
                        "player_effects": {},
                        "reason": "",
                    },
                }
            return self._fallback_npc_reply(npc_id)
        except Exception as e:
            print(f"[LLM NPC Chat Error] {e}")
            return self._fallback_npc_reply(npc_id)

    def _fallback_npc_reply(self, npc_id: str) -> dict:
        """LLM 不可用时的 NPC 兜底回复（从配置文件读取）"""
        npc_cfg = self.get_npc_config(npc_id)
        if npc_cfg:
            replies = npc_cfg.get("fallback_replies", ["……"])
        else:
            replies = ["……"]

        sentiments = ["neutral", "positive", "negative"]
        moods = ["平静", "愉快", "烦躁"]
        return {
            "reply": random.choice(replies),
            "effects": {
                "sentiment": random.choice(sentiments),
                "npc_mood": random.choice(moods),
                "player_effects": {},
                "reason": "",
            },
        }

    def clear_npc_history(self, npc_id: str | None = None):
        """清除 NPC 对话历史（新游戏时调用）"""
        if npc_id:
            self.npc_chat_history.pop(npc_id, None)
            self.npc_chat_counts.pop(npc_id, None)
        else:
            self.npc_chat_history.clear()
            self.npc_chat_counts.clear()
            self.triggered_scripts.clear()

    def get_chat_count(self, npc_id: str) -> int:
        """获取与某 NPC 的交互次数"""
        return self.npc_chat_counts.get(npc_id, 0)

    # ========== 自由故事线：事件生成 ==========

    async def generate_event(self, user_input: str, character_state: dict) -> dict | None:
        """根据玩家自由输入生成一个事件"""
        if not self.enabled:
            return self._fallback_event(user_input)

        # 从配置加载叙事 prompt 模板
        prompt_template = self.story_config.get("narrator_prompt", "")
        world_name = self.world_config.get("world_name", "工业围城")
        world_desc = self.story_config.get("world_description", "")

        system_prompt = prompt_template.format(
            world_name=world_name,
            world_description=world_desc,
            **character_state,
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input},
                ],
                temperature=0.8,
                max_tokens=500,
            )
            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(content)
        except Exception as e:
            print(f"[LLM Error] {e}")
            return self._fallback_event(user_input)

    def _fallback_event(self, user_input: str) -> dict:
        """LLM 不可用时的兜底事件（从配置读取）"""
        fallback = self.story_config.get("fallback_event", {})
        desc_template = fallback.get(
            "description_template",
            "你站在工厂的角落，心里想着：「{input}」。",
        )
        return {
            "title": fallback.get("title", "内心独白"),
            "description": desc_template.format(input=user_input[:50]),
            "choices": fallback.get("choices", [
                {
                    "text": "继续",
                    "effect": {},
                    "result": "你继续前行。",
                }
            ]),
        }
