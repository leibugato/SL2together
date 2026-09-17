from __future__ import annotations


def build_test_guide(spec: dict) -> dict:
    mod = spec["mod"]
    content = spec["content"]
    kind = content["kind"]
    content_id = content["id"]
    steps = [
        "启动游戏并进入一局游戏。",
        "按 ` 键打开游戏控制台。",
    ]
    commands: list[dict[str, str]] = []
    notes: list[str] = []

    if kind == "CARD":
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
    elif kind == "RELIC":
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
