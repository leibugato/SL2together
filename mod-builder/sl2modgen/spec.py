from __future__ import annotations

import re
from copy import deepcopy


CONTENT_KINDS = {"CARD", "RELIC", "POWER"}

BUILTIN_KEYWORDS = {
    "EXHAUST",
    "ETHEREAL",
    "INNATE",
    "UNPLAYABLE",
    "RETAIN",
    "SLY",
    "ETERNAL",
}

SUPPORTED_BEHAVIORS = {
    "AUTO_PLAY_FROM_EXHAUST": {
        "description": "卡牌进入消耗堆后，在自动出牌阶段自动打出。",
        "timing": "AFTER_AUTO_PRE_PLAY_PHASE_EARLY",
    }
}

CARD_TYPES = {"Attack", "Skill", "Power", "Status", "Curse", "Quest"}
TARGET_TYPES = {"AnyEnemy", "AllEnemies", "Self", "None"}
CARD_RARITIES = {"Basic", "Common", "Uncommon", "Rare", "Ancient", "Event", "Token"}
RELIC_RARITIES = {"Starter", "Common", "Uncommon", "Rare", "Shop", "Event", "Ancient"}
POWER_TYPES = {"Buff", "Debuff"}
POWER_STACK_TYPES = {"Counter", "Single"}

CARD_POOLS = {
    "ColorlessCardPool",
    "IroncladCardPool",
    "SilentCardPool",
    "DefectCardPool",
    "NecrobinderCardPool",
    "RegentCardPool",
    "EventCardPool",
    "TokenCardPool",
}

RELIC_POOLS = {
    "SharedRelicPool",
    "EventRelicPool",
    "FallbackRelicPool",
    "DeprecatedRelicPool",
}

SUPPORTED_POWERS = {
    "WeakPower",
    "VulnerablePower",
    "FrailPower",
    "StrengthPower",
    "DexterityPower",
    "PoisonPower",
    "ThornsPower",
    "VigorPower",
}

EFFECTS = {
    "DAMAGE",
    "GAIN_BLOCK",
    "DRAW",
    "GAIN_ENERGY",
    "HEAL",
    "APPLY_POWER",
}

RELIC_TRIGGERS = {
    "AFTER_OBTAINED",
    "BEFORE_COMBAT_START",
    "AFTER_CARD_PLAYED",
    "AFTER_TURN_END",
}

POWER_TRIGGERS = {
    "AFTER_CARD_PLAYED",
    "AFTER_TURN_END",
}

TRIGGER_EFFECTS = {
    "AFTER_OBTAINED": {"HEAL"},
    "BEFORE_COMBAT_START": {"GAIN_BLOCK"},
    "AFTER_CARD_PLAYED": EFFECTS - {"DAMAGE"},
    "AFTER_TURN_END": EFFECTS - {"DAMAGE"},
}


class SpecError(ValueError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise SpecError(message)


def _positive_int(value: object, field: str, maximum: int = 99) -> int:
    _require(isinstance(value, int) and not isinstance(value, bool), f"{field} 必须是整数。")
    _require(1 <= value <= maximum, f"{field} 必须在 1 到 {maximum} 之间。")
    return value


def pascal_case(identifier: str) -> str:
    parts = re.split(r"[^A-Za-z0-9]+|_+", identifier)
    value = "".join(part[:1].upper() + part[1:].lower() for part in parts if part)
    if not value:
        raise SpecError("无法从 ID 生成 C# 类名。")
    if value[0].isdigit():
        value = "Mod" + value
    return value


def namespace_for(mod_id: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_]", "_", mod_id)
    if not value or value[0].isdigit():
        value = "mod_" + value
    return value


def _validate_effect(effect: dict, kind: str, index: int) -> None:
    _require(isinstance(effect, dict), f"effects[{index}] 必须是对象。")
    effect_type = effect.get("type")
    _require(effect_type in EFFECTS, f"不支持的效果类型：{effect_type}")

    if effect_type == "APPLY_POWER":
        _require(effect.get("power") in SUPPORTED_POWERS, "APPLY_POWER 只能使用白名单内 Power。")
        _positive_int(effect.get("amount"), f"effects[{index}].amount", 20)
        target = effect.get("target", "CARD_TARGET")
        _require(target in {"CARD_TARGET", "OWNER"}, "APPLY_POWER 目标只能是 CARD_TARGET 或 OWNER。")
        return

    if effect_type == "DAMAGE":
        _require(kind == "CARD", "第一版只允许卡牌直接造成伤害。")
        target = effect.get("target", "CARD_TARGET")
        _require(target in {"CARD_TARGET", "ALL_ENEMIES"}, "DAMAGE 目标只能是 CARD_TARGET 或 ALL_ENEMIES。")
        _positive_int(effect.get("amount"), f"effects[{index}].amount", 999)
    elif effect_type in {"GAIN_BLOCK", "HEAL"}:
        if kind == "POWER":
            return
        _positive_int(effect.get("amount"), f"effects[{index}].amount", 999)
    elif effect_type in {"DRAW", "GAIN_ENERGY"}:
        if kind == "POWER":
            return
        _positive_int(effect.get("amount"), f"effects[{index}].amount", 10)
    else:
        raise SpecError(f"不支持的效果类型：{effect_type}")

    if effect.get("upgradeDelta") is not None:
        _require(kind == "CARD", "只有卡牌效果可以设置 upgradeDelta。")
        _require(effect_type in {"DAMAGE", "GAIN_BLOCK", "DRAW", "GAIN_ENERGY"}, f"{effect_type} 暂不支持升级变化。")
        _positive_int(effect["upgradeDelta"], f"effects[{index}].upgradeDelta", 20)


def _validate_card(content: dict) -> None:
    card = content.get("card")
    _require(isinstance(card, dict), "CARD 缺少 card 配置。")
    _require(card.get("type") in CARD_TYPES, "卡牌类型不在白名单内。")
    _require(card.get("target", "Self") in TARGET_TYPES, "卡牌目标不在白名单内。")
    _require(card.get("rarity", "Common") in CARD_RARITIES, "卡牌稀有度不在白名单内。")
    _require(card.get("pool", "ColorlessCardPool") in CARD_POOLS, "卡牌池不在白名单内。")
    cost = card.get("cost", 0)
    _require(isinstance(cost, int) and not isinstance(cost, bool) and 0 <= cost <= 9, "卡牌费用必须在 0 到 9 之间。")

    keywords = card.get("keywords", [])
    _require(isinstance(keywords, list), "card.keywords 必须是数组。")
    _require(all(keyword in BUILTIN_KEYWORDS for keyword in keywords), "card.keywords 包含不支持的关键词。")

    effects = card.get("effects", [])
    _require(isinstance(effects, list) and effects, "卡牌至少需要一个效果。")
    for index, effect in enumerate(effects):
        _validate_effect(effect, "CARD", index)

    seen_single = set()
    seen_power = set()
    for effect in effects:
        if effect["type"] == "APPLY_POWER":
            _require(effect["power"] not in seen_power, f"同一个 Power 只能出现一次：{effect['power']}")
            seen_power.add(effect["power"])
            continue
        _require(effect["type"] not in seen_single, f"第一版每种基础效果只能出现一次：{effect['type']}")
        seen_single.add(effect["type"])

    behaviors = card.get("behaviors", [])
    _require(isinstance(behaviors, list), "card.behaviors 必须是数组。")
    for behavior in behaviors:
        _require(isinstance(behavior, dict), "card.behaviors 项必须是对象。")
        _require(behavior.get("type") in SUPPORTED_BEHAVIORS, "card.behaviors 包含不支持的行为。")


def _validate_relic(content: dict) -> None:
    relic = content.get("relic")
    _require(isinstance(relic, dict), "RELIC 缺少 relic 配置。")
    _require(relic.get("rarity", "Common") in RELIC_RARITIES, "遗物稀有度不在白名单内。")
    _require(relic.get("pool", "EventRelicPool") in RELIC_POOLS, "遗物池不在白名单内。")
    triggers = relic.get("triggers")
    _require(isinstance(triggers, list) and triggers, "遗物至少需要一个触发方式。")
    for trigger in triggers:
        _require(isinstance(trigger, dict), "relic.triggers 项必须是对象。")
        trigger_type = trigger.get("type")
        _require(trigger_type in RELIC_TRIGGERS, f"不支持遗物触发方式：{trigger_type}")
        effects = trigger.get("effects")
        _require(isinstance(effects, list) and effects, f"遗物触发 {trigger_type} 缺少 effects。")
        for index, effect in enumerate(effects):
            _validate_effect(effect, "RELIC", index)
            _require(
                effect["type"] in TRIGGER_EFFECTS[trigger_type],
                f"遗物触发 {trigger_type} 不支持效果 {effect['type']}。",
            )


def _validate_power(content: dict) -> None:
    power = content.get("power")
    _require(isinstance(power, dict), "POWER 缺少 power 配置。")
    _require(power.get("type", "Buff") in POWER_TYPES, "Power 类型不在白名单内。")
    _require(power.get("stackType", "Counter") in POWER_STACK_TYPES, "Power 叠加类型不在白名单内。")
    triggers = power.get("triggers")
    _require(isinstance(triggers, list) and triggers, "Power 至少需要一个触发方式。")
    for trigger in triggers:
        _require(isinstance(trigger, dict), "power.triggers 项必须是对象。")
        trigger_type = trigger.get("type")
        _require(trigger_type in POWER_TRIGGERS, f"不支持 Power 触发方式：{trigger_type}")
        effects = trigger.get("effects")
        _require(isinstance(effects, list) and effects, f"Power 触发 {trigger_type} 缺少 effects。")
        for index, effect in enumerate(effects):
            _validate_effect(effect, "POWER", index)
            _require(effect["type"] != "DAMAGE", "第一版 Power 不允许直接造成伤害。")


def validate_mod_spec(spec: dict) -> dict:
    _require(isinstance(spec, dict), "ModSpec 必须是对象。")
    _require(spec.get("schemaVersion") == 1, "只支持 schemaVersion 1。")

    mod = spec.get("mod")
    _require(isinstance(mod, dict), "缺少 mod 配置。")
    mod_id = mod.get("id")
    _require(isinstance(mod_id, str) and re.fullmatch(r"[a-z][a-z0-9_]{2,47}", mod_id), "mod.id 格式不正确。")
    for field in ("name", "author", "version"):
        value = mod.get(field)
        _require(isinstance(value, str) and value.strip(), f"mod.{field} 不能为空。")

    content = spec.get("content")
    _require(isinstance(content, dict), "缺少 content 配置。")
    kind = content.get("kind")
    _require(kind in CONTENT_KINDS, f"不支持的内容类型：{kind}")
    content_id = content.get("id")
    _require(
        isinstance(content_id, str) and re.fullmatch(r"[A-Z][A-Z0-9_]{2,63}", content_id),
        "content.id 格式不正确。",
    )
    _require(isinstance(content.get("name"), str) and content["name"].strip(), "content.name 不能为空。")
    _require(
        isinstance(content.get("description"), str) and content["description"].strip(),
        "content.description 不能为空。",
    )

    if kind == "CARD":
        _validate_card(content)
    elif kind == "RELIC":
        _validate_relic(content)
    else:
        _validate_power(content)

    return deepcopy(spec)


def analyze_support(spec: dict) -> dict:
    try:
        validate_mod_spec(spec)
    except SpecError as error:
        return {
            "supported": False,
            "reason": str(error),
        }
    return {
        "supported": True,
        "reason": "",
    }


def whitelist_summary() -> dict:
    return {
        "contentKinds": sorted(CONTENT_KINDS),
        "keywords": sorted(BUILTIN_KEYWORDS),
        "effects": sorted(EFFECTS),
        "relicTriggers": sorted(RELIC_TRIGGERS),
        "powerTriggers": sorted(POWER_TRIGGERS),
        "behaviors": sorted(SUPPORTED_BEHAVIORS),
    }
