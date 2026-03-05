"""事件系统 - 事件加载、条件过滤与触发"""

import json
import random
from pathlib import Path
from pydantic import BaseModel

from src.core.character import Character

EVENTS_PATH = Path(__file__).parent.parent / "data" / "configs" / "events.json"


class Choice(BaseModel):
    text: str
    effect: dict[str, int]
    result: str


class Event(BaseModel):
    id: str
    title: str
    description: str
    conditions: dict = {}
    choices: list[Choice]


class EventManager:
    """管理事件池的加载、过滤与触发"""

    def __init__(self):
        self.all_events: list[Event] = []
        self.used_event_ids: set[str] = set()
        self._load_events()

    def _load_events(self):
        with open(EVENTS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        self.all_events = [Event(**e) for e in raw]

    def get_available_events(self, character: Character) -> list[Event]:
        """根据角色当前状态，筛选可触发的事件"""
        available = []
        for event in self.all_events:
            if event.id in self.used_event_ids:
                continue
            if not self._check_conditions(event, character):
                continue
            available.append(event)
        return available

    def _check_conditions(self, event: Event, character: Character) -> bool:
        conds = event.conditions
        if "min_day" in conds and character.day < conds["min_day"]:
            return False
        if "min_reputation" in conds and character.reputation < conds["min_reputation"]:
            return False
        if "min_money" in conds and character.money < conds["min_money"]:
            return False
        return True

    def pick_event(self, character: Character) -> Event | None:
        """随机选取一个可用事件"""
        available = self.get_available_events(character)
        if not available:
            return None
        event = random.choice(available)
        self.used_event_ids.add(event.id)
        return event

    def reset(self):
        """重置事件池（新游戏时调用）"""
        self.used_event_ids.clear()
