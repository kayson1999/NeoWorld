"""角色系统 - 管理角色属性、状态与每日消耗"""

from pydantic import BaseModel, Field


class Character(BaseModel):
    """玩家角色"""

    name: str = "无名者"
    health: int = Field(default=100, ge=0, le=100, description="生命值")
    hunger: int = Field(default=100, ge=0, le=100, description="饱食度")
    money: int = Field(default=50, ge=0, description="金钱")
    reputation: int = Field(default=10, ge=0, le=100, description="声望")
    day: int = Field(default=1, ge=1, description="当前天数")

    # 每日固定消耗
    daily_hunger_cost: int = Field(default=15, description="每日饱食度消耗")
    daily_money_cost: int = Field(default=5, description="每日生存开销（住所等）")

    @property
    def is_alive(self) -> bool:
        return self.health > 0

    @property
    def status_summary(self) -> str:
        if not self.is_alive:
            return "💀 已死亡"
        if self.health <= 20 or self.hunger <= 10:
            return "⚠️ 危险"
        if self.health <= 50 or self.hunger <= 30:
            return "😰 艰难"
        return "🟢 正常"

    def apply_daily_cost(self) -> list[str]:
        """结算每日固定消耗，返回事件日志"""
        logs = []

        self.hunger = max(0, self.hunger - self.daily_hunger_cost)
        if self.hunger == 0:
            self.health = max(0, self.health - 10)
            logs.append("你饿得头晕眼花，身体受到了损伤。（生命 -10）")
        else:
            logs.append(f"日常消耗：饱食度 -{self.daily_hunger_cost}")

        if self.money >= self.daily_money_cost:
            self.money -= self.daily_money_cost
            logs.append(f"支付了住所和基本开销。（金钱 -{self.daily_money_cost}）")
        else:
            self.money = 0
            self.health = max(0, self.health - 5)
            logs.append("付不起住所费用，你露宿街头，身体受损。（生命 -5）")

        return logs

    def apply_effect(self, effect: dict) -> list[str]:
        """应用一个效果字典，如 {"health": -10, "money": 20}"""
        logs = []
        for attr, delta in effect.items():
            if hasattr(self, attr):
                old_val = getattr(self, attr)
                if attr in ("health", "hunger", "reputation"):
                    new_val = max(0, min(100, old_val + delta))
                elif attr == "money":
                    new_val = max(0, old_val + delta)
                else:
                    new_val = old_val + delta
                setattr(self, attr, new_val)
                sign = "+" if delta > 0 else ""
                logs.append(f"{attr} {sign}{delta}（{old_val} → {new_val}）")
        return logs

    def to_display(self) -> dict:
        """返回用于前端展示的状态"""
        return {
            "name": self.name,
            "day": self.day,
            "status": self.status_summary,
            "health": self.health,
            "hunger": self.hunger,
            "money": self.money,
            "reputation": self.reputation,
            "is_alive": self.is_alive,
        }
