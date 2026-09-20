from __future__ import annotations


CARD_POOL_LABELS = {
    "ColorlessCardPool": "无色卡池",
    "IroncladCardPool": "铁甲战士卡池",
    "SilentCardPool": "静默猎手卡池",
    "DefectCardPool": "故障机器人卡池",
    "RegentCardPool": "储君卡池",
    "NecrobinderCardPool": "缚骨者卡池",
}

RELIC_POOL_LABELS = {
    "SharedRelicPool": "通用遗物池",
    "IroncladRelicPool": "铁甲战士专属遗物池",
    "SilentRelicPool": "静默猎手专属遗物池",
    "DefectRelicPool": "故障机器人专属遗物池",
    "RegentRelicPool": "储君专属遗物池",
    "NecrobinderRelicPool": "缚骨者专属遗物池",
}


def build_test_guide(spec: dict) -> dict:
    mod = spec["mod"]
    content = spec["content"]
    generation_version = spec.get("generationVersion", "unknown")
    kind = content["kind"]
    content_id = content["id"]
    steps = [
        "启动游戏并进入一局游戏。",
        "按 ` 键打开游戏控制台。",
    ]
    commands: list[dict[str, str]] = []
    notes: list[str] = []

    if kind == "CARD":
        pool = content["card"].get("pool", "ColorlessCardPool")
        commands.append(
            {
                "label": "将测试卡牌加入手牌",
                "command": f"card {content_id} hand",
                "description": "直接在战斗中将生成卡牌加入手牌。",
            }
        )
        commands.append(
            {
                "label": "将测试卡牌加入牌组",
                "command": f"card {content_id} deck",
                "description": "把卡牌加入当前牌组，用于查看卡图和升级效果。",
            }
        )
        notes.append("进入战斗后再执行 hand 命令；查看卡图可使用 deck 命令。")
        if pool == "ColorlessCardPool":
            notes.append("该卡已注册到无色卡池；商店无色卡位主要出现罕见或稀有卡，其他无色生成效果仍受各自规则影响。")
        else:
            notes.append(
                f"该卡已注册到{CARD_POOL_LABELS.get(pool, pool)}，会进入对应角色的常规奖励与商店。"
            )
        if any(effect.get("upgradeDelta") for effect in content["card"].get("effects", [])):
            notes.append("执行 card 命令后，再输入 upgrade 0 可将手牌最左侧的卡升级；实际位置不是最左时改为对应手牌索引。")
    elif kind == "RELIC":
        relics = content["relic"]
        pool = relics.get("pool", "SharedRelicPool")
        rarity = relics.get("rarity", "Common")
        commands.append(
            {
                "label": "获得测试遗物",
                "command": f"relic add {content_id}",
                "description": "直接获得生成的遗物并触发图鉴记录。",
            }
        )
        commands.append(
            {
                "label": "移除测试遗物",
                "command": f"relic remove {content_id}",
                "description": "测试结束后移除遗物。",
            }
        )
        if rarity == "Shop":
            notes.append(
                f"该遗物已注册到{RELIC_POOL_LABELS.get(pool, pool)}，稀有度为商店，正常运行时会进入商店遗物槽。"
            )
        else:
            notes.append(
                f"该遗物已注册到{RELIC_POOL_LABELS.get(pool, pool)}，会进入对应角色的随机遗物奖励抓取池；实际出现还受稀有度、解锁和现有遗物影响。"
            )
    else:
        commands.append(
            {
                "label": "直接施加测试 Buff",
                "command": f"power {content_id} 1 0",
                "description": "给玩家施加 1 层 Buff，0 表示玩家目标。",
            }
        )
        commands.append(
            {
                "label": "通过测试卡施加 Buff",
                "command": f"card {content_id}_TEST_CARD hand",
                "description": "将配套测试卡加入手牌，打出后施加该 Buff。",
            }
        )
        notes.append("移除 Buff、层数叠加和多回合持续效果需要在战斗流程中继续验证。")

    steps.extend(item["command"] for item in commands)
    return {
        "title": "快捷测试",
        "generationVersion": generation_version,
        "consoleKey": "`",
        "modId": mod["id"],
        "modName": mod["name"],
        "contentId": content_id,
        "steps": steps,
        "commands": commands,
        "notes": notes,
    }


def render_test_guide_markdown(guide: dict) -> str:
    lines = [
        f"# {guide['modName']} 快捷测试",
        "",
        f"MOD ID：`{guide['modId']}`",
        f"生成规则：`{guide.get('generationVersion', 'unknown')}`",
        "",
        "1. 启动游戏并进入一局游戏。",
        "2. 按 `` ` `` 键打开控制台。",
        "3. 依次执行下面的命令：",
        "",
    ]
    for item in guide["commands"]:
        lines.extend(
            [
                f"### {item['label']}",
                "",
                f"```text",
                item["command"],
                "```",
                "",
                item["description"],
                "",
            ]
        )
    if guide["notes"]:
        lines.append("## 注意")
        lines.append("")
        lines.extend(f"- {note}" for note in guide["notes"])
        lines.append("")
    return "\n".join(lines)
