"""对话影响引擎 —— 插件化架构，所有规则从配置文件读取"""

import json
import random
from pathlib import Path
from typing import Any

from src.core.character import Character

CONFIG_PATH = Path(__file__).parent.parent / "data" / "configs" / "dialogue_effects.json"


class NPCRelationship:
    """单个 NPC 的关系状态"""

    def __init__(self, npc_id: str, config: dict):
        self.npc_id = npc_id
        self.value: int = config["relationship"]["initial_value"]
        self.mood: str = config["npc_mood"]["default"]
        self.min_val: int = config["relationship"]["min"]
        self.max_val: int = config["relationship"]["max"]
        self.levels: list[dict] = config["relationship"]["levels"]
        self.total_chats: int = 0

    def adjust(self, delta: int) -> int:
        """调整好感度，返回实际变化量"""
        old = self.value
        self.value = max(self.min_val, min(self.max_val, self.value + delta))
        return self.value - old

    def get_level(self) -> dict:
        """获取当前好感度等级"""
        for level in self.levels:
            low, high = level["range"]
            if low <= self.value <= high:
                return level
        return self.levels[3]  # 默认 "认识"

    def to_display(self) -> dict:
        level = self.get_level()
        return {
            "npc_id": self.npc_id,
            "value": self.value,
            "level_name": level["name"],
            "level_color": level["color"],
            "level_icon": level["icon"],
            "mood": self.mood,
            "total_chats": self.total_chats,
        }


class DialogueEffectEngine:
    """对话影响引擎 —— 管理所有 NPC 关系与对话效果计算

    插件化设计：
    - 所有规则从 dialogue_effects.json 读取
    - 修改配置文件即可改变游戏行为，无需改代码
    - 新增 NPC 只需在配置中添加 milestone 条目
    """

    def __init__(self):
        self.config = self._load_config()
        self.relationships: dict[str, NPCRelationship] = {}
        self.triggered_milestones: set[str] = set()

    def _load_config(self) -> dict:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    def reload_config(self):
        """热重载配置（开发时方便调试）"""
        self.config = self._load_config()

    def reset(self):
        """重置所有关系（新游戏时调用）"""
        self.relationships.clear()
        self.triggered_milestones.clear()

    def _get_relationship(self, npc_id: str) -> NPCRelationship:
        """获取或创建 NPC 关系对象"""
        if npc_id not in self.relationships:
            self.relationships[npc_id] = NPCRelationship(npc_id, self.config)
        return self.relationships[npc_id]

    # ========== 核心：处理对话影响 ==========

    def process_dialogue_effects(
        self,
        npc_id: str,
        effect_data: dict,
        character: Character,
    ) -> dict:
        """处理一次对话产生的所有影响

        Args:
            npc_id: NPC 标识
            effect_data: LLM 返回的影响数据，格式:
                {
                    "sentiment": "positive" | "negative" | ...,
                    "npc_mood": "愉快" | "平静" | ...,
                    "player_effects": {"health": 5, "hunger": -3, ...},
                    "reason": "对话原因简述"
                }
            character: 玩家角色对象

        Returns:
            处理结果字典，包含变化日志、好感度信息、里程碑触发等
        """
        rel = self._get_relationship(npc_id)
        rel.total_chats += 1
        logs: list[str] = []
        milestone_msgs: list[str] = []

        # 1. 好感度变化（基于情感分析）
        sentiment = effect_data.get("sentiment", "neutral")
        rel_delta = self._calc_relationship_delta(sentiment)
        if rel_delta != 0:
            actual_delta = rel.adjust(rel_delta)
            if actual_delta != 0:
                level = rel.get_level()
                direction = "↑" if actual_delta > 0 else "↓"
                logs.append(
                    f"{level['icon']} 好感度 {direction} {abs(actual_delta)}（{level['name']} · {rel.value}）"
                )

        # 2. NPC 情绪更新
        new_mood = effect_data.get("npc_mood", self.config["npc_mood"]["default"])
        if new_mood in self.config["npc_mood"]["values"]:
            rel.mood = new_mood

        # 3. 玩家属性影响
        player_effects = effect_data.get("player_effects", {})
        clamped_effects = self._clamp_player_effects(player_effects)
        if clamped_effects:
            effect_logs = character.apply_effect(clamped_effects)
            logs.extend(effect_logs)

        # 4. 检查里程碑触发
        milestone_msgs = self._check_milestones(npc_id, rel.value, character)
        logs.extend(milestone_msgs)

        # 5. 构造返回结果
        sentiment_desc = self.config["sentiment_rules"].get(
            sentiment, {}
        ).get("description", "")

        return {
            "relationship": rel.to_display(),
            "sentiment": sentiment,
            "sentiment_desc": sentiment_desc,
            "logs": logs,
            "milestone_triggered": len(milestone_msgs) > 0,
        }

    def _calc_relationship_delta(self, sentiment: str) -> int:
        """根据情感类型计算好感度变化值"""
        rules = self.config.get("sentiment_rules", {})
        rule = rules.get(sentiment)
        if not rule:
            return 0
        low, high = rule["relationship_delta"]
        return random.randint(min(low, high), max(low, high))

    def _clamp_player_effects(self, effects: dict) -> dict:
        """将玩家属性影响限制在配置允许的范围内"""
        rules = self.config.get("player_effect_rules", {})
        allowed = rules.get("allowed_attributes", [])
        max_ranges = rules.get("max_per_dialogue", {})
        clamped = {}
        for attr, val in effects.items():
            if attr not in allowed:
                continue
            if not isinstance(val, (int, float)):
                continue
            val = int(val)
            if attr in max_ranges:
                lo, hi = max_ranges[attr]
                val = max(lo, min(hi, val))
            if val != 0:
                clamped[attr] = val
        return clamped

    def _check_milestones(
        self, npc_id: str, current_value: int, character: Character
    ) -> list[str]:
        """检查是否触发好感度里程碑"""
        msgs = []
        milestones = self.config.get("relationship_thresholds", {}).get("milestones", [])
        for ms in milestones:
            if ms["npc_id"] != npc_id:
                continue
            ms_key = f"{ms['npc_id']}_{ms['threshold']}_{ms['direction']}"
            if ms.get("once") and ms_key in self.triggered_milestones:
                continue
            threshold = ms["threshold"]
            direction = ms["direction"]
            triggered = False
            if direction == "up" and current_value >= threshold:
                triggered = True
            elif direction == "down" and current_value <= threshold:
                triggered = True
            if triggered:
                self.triggered_milestones.add(ms_key)
                effect = ms.get("effect", {})
                if effect:
                    character.apply_effect(effect)
                msgs.append(f"★ {ms['message']}")
        return msgs

    # ========== 每日衰减 ==========

    def apply_daily_decay(self) -> list[str]:
        """每日好感度自然衰减"""
        decay_cfg = self.config.get("daily_relationship_decay", {})
        if not decay_cfg.get("enabled", False):
            return []

        rate = decay_cfg.get("decay_rate", 1)
        towards = decay_cfg.get("decay_towards", 0)
        min_abs = decay_cfg.get("min_abs_to_decay", 5)
        logs = []

        for npc_id, rel in self.relationships.items():
            if abs(rel.value - towards) < min_abs:
                continue
            if rel.value > towards:
                rel.adjust(-rate)
            elif rel.value < towards:
                rel.adjust(rate)

        return logs

    # ========== 状态导出 ==========

    def get_all_relationships(self) -> dict[str, dict]:
        """获取所有 NPC 关系状态（用于前端展示）"""
        return {
            npc_id: rel.to_display()
            for npc_id, rel in self.relationships.items()
        }

    def get_relationship_context(self, npc_id: str) -> str:
        """生成用于 LLM prompt 的关系上下文"""
        rel = self._get_relationship(npc_id)
        level = rel.get_level()
        return (
            f"你与对方的关系等级：{level['name']}（好感度 {rel.value}/{self.config['relationship']['max']}）。"
            f"你当前的情绪：{rel.mood}。"
            f"你们已经交谈过 {rel.total_chats} 次。"
            f"请根据这个关系程度调整你的态度和话语亲密程度。"
        )
