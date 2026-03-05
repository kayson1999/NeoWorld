"""世界引擎 - 游戏主循环与阶段管理"""

import json
from pathlib import Path

from src.core.character import Character
from src.core.event import EventManager, Event

WORLD_CONFIG_PATH = Path(__file__).parent.parent / "data" / "configs" / "world.json"


class WorldEngine:
    """游戏世界引擎，管理回合流程与状态"""

    def __init__(self):
        self.config = self._load_config()
        self.character: Character | None = None
        self.event_manager = EventManager()
        self.current_event: Event | None = None
        self.game_over = False
        self.game_log: list[dict] = []

    def _load_config(self) -> dict:
        with open(WORLD_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    def new_game(self, player_name: str = "") -> dict:
        """开始新游戏"""
        init = self.config["initial_character"].copy()
        if player_name:
            init["name"] = player_name
        self.character = Character(**init)
        self.event_manager.reset()
        self.game_over = False
        self.game_log = []

        return {
            "world_name": self.config["world_name"],
            "description": self.config["description"],
            "victory_condition": self.config["victory_condition"],
            "character": self.character.to_display(),
            "phase": self._get_current_phase(),
        }

    def get_current_phase(self) -> dict | None:
        return self._get_current_phase()

    def _get_current_phase(self) -> dict | None:
        if not self.character:
            return None
        for phase in self.config["phases"]:
            low, high = phase["day_range"]
            if low <= self.character.day <= high:
                return {"name": phase["name"], "description": phase["description"]}
        return None

    def start_new_day(self) -> dict:
        """开始新的一天：消耗资源 → 触发事件"""
        if not self.character or self.game_over:
            return {"error": "游戏未开始或已结束"}

        # 1. 每日消耗
        cost_logs = self.character.apply_daily_cost()

        # 2. 检查是否存活
        if not self.character.is_alive:
            self.game_over = True
            return self._build_game_over("你的身体再也撑不住了……倒在了冰冷的街头。", cost_logs)

        # 3. 检查是否胜利
        if self.character.day > self.config["max_days"]:
            self.game_over = True
            return self._build_victory(cost_logs)

        # 4. 触发事件
        event = self.event_manager.pick_event(self.character)
        self.current_event = event

        return {
            "day": self.character.day,
            "phase": self._get_current_phase(),
            "daily_logs": cost_logs,
            "character": self.character.to_display(),
            "event": self._event_to_dict(event) if event else None,
        }

    def make_choice(self, choice_index: int) -> dict:
        """玩家做出选择"""
        if not self.current_event or not self.character:
            return {"error": "当前没有需要决策的事件"}

        if choice_index < 0 or choice_index >= len(self.current_event.choices):
            return {"error": "无效的选择"}

        choice = self.current_event.choices[choice_index]
        effect_logs = self.character.apply_effect(choice.effect)

        result = {
            "choice_text": choice.text,
            "result": choice.result,
            "effect_logs": effect_logs,
            "character": self.character.to_display(),
        }

        # 检查选择后是否死亡
        if not self.character.is_alive:
            self.game_over = True
            result["game_over"] = True
            result["ending"] = "你没能熬过这一关……一切都结束了。"

        # 清除当前事件，推进天数
        self.current_event = None
        self.character.day += 1

        self.game_log.append(result)
        return result

    def get_state(self) -> dict:
        """获取当前游戏完整状态"""
        return {
            "game_over": self.game_over,
            "character": self.character.to_display() if self.character else None,
            "phase": self._get_current_phase(),
            "current_event": self._event_to_dict(self.current_event) if self.current_event else None,
        }

    def _event_to_dict(self, event: Event) -> dict:
        return {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "choices": [{"index": i, "text": c.text} for i, c in enumerate(event.choices)],
        }

    def _build_game_over(self, reason: str, logs: list[str]) -> dict:
        return {
            "day": self.character.day,
            "daily_logs": logs,
            "character": self.character.to_display(),
            "game_over": True,
            "ending": reason,
        }

    def _build_victory(self, logs: list[str]) -> dict:
        rep = self.character.reputation
        if rep >= 50:
            ending = f"你在工业围城活过了 {self.config['max_days']} 天，声望远扬，成了工人们的领袖。"
        elif rep >= 25:
            ending = f"你在工业围城活过了 {self.config['max_days']} 天，虽然平凡，但活了下来。"
        else:
            ending = f"你在工业围城活过了 {self.config['max_days']} 天，但没人记得你的名字。"
        return {
            "day": self.character.day,
            "daily_logs": logs,
            "character": self.character.to_display(),
            "game_over": True,
            "victory": True,
            "ending": ending,
        }
