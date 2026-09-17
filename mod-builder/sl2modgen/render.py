from __future__ import annotations

import json
from pathlib import Path

from .assets import generate_card_assets, generate_power_assets, generate_relic_assets
from .spec import namespace_for, pascal_case, validate_mod_spec


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def _keyword_list(keywords: list[str]) -> str:
    values = ", ".join(f"CardKeyword.{keyword[:1] + keyword[1:].lower()}" for keyword in keywords)
    return f"new List<CardKeyword> {{ {values} }}"


def _card_dynamic_vars(card: dict) -> list[str]:
    values: list[str] = []
    for effect in card["effects"]:
        effect_type = effect["type"]
        amount = effect["amount"]
        if effect_type == "DAMAGE":
            values.append(f"new DamageVar({amount}m, ValueProp.Move)")
        elif effect_type == "GAIN_BLOCK":
            values.append(f"new BlockVar({amount}m, ValueProp.Move)")
        elif effect_type == "DRAW":
            values.append(f"new CardsVar({amount})")
        elif effect_type == "GAIN_ENERGY":
            values.append(f"new EnergyVar({amount})")
        elif effect_type == "HEAL":
            values.append(f"new HealVar({amount}m)")
        elif effect_type == "APPLY_POWER":
            values.append(f'new PowerVar<{effect["power"]}>({effect["amount"]}m)')
    return values


def _card_effect_lines(effects: list[dict]) -> list[str]:
    lines: list[str] = []
    for effect in effects:
        effect_type = effect["type"]
        if effect_type == "DAMAGE":
            if effect.get("target", "CARD_TARGET") == "CARD_TARGET":
                lines.append('        ArgumentNullException.ThrowIfNull(cardPlay.Target, "cardPlay.Target");')
                lines.extend(
                    [
                        "        await DamageCmd.Attack(base.DynamicVars.Damage.BaseValue)",
                        "            .FromCard(this, cardPlay)",
                        "            .Targeting(cardPlay.Target)",
                        '            .WithHitFx("vfx/vfx_attack_slash")',
                        "            .Execute(choiceContext);",
                    ]
                )
            else:
                lines.extend(
                    [
                        "        await DamageCmd.Attack(base.DynamicVars.Damage.BaseValue)",
                        "            .FromCard(this, cardPlay)",
                        "            .TargetingAllOpponents(base.CombatState)",
                        '            .WithHitFx("vfx/vfx_attack_slash")',
                        "            .Execute(choiceContext);",
                    ]
                )
        elif effect_type == "GAIN_BLOCK":
            lines.append("        await CreatureCmd.GainBlock(base.Owner.Creature, base.DynamicVars.Block, cardPlay);")
        elif effect_type == "DRAW":
            lines.append("        await CardPileCmd.Draw(choiceContext, base.DynamicVars.Cards.IntValue, base.Owner);")
        elif effect_type == "GAIN_ENERGY":
            lines.append("        await PlayerCmd.GainEnergy(base.DynamicVars.Energy.IntValue, base.Owner);")
        elif effect_type == "HEAL":
            lines.append("        await CreatureCmd.Heal(base.Owner.Creature, base.DynamicVars.Heal.BaseValue);")
        elif effect_type == "APPLY_POWER":
            target = "base.Owner.Creature" if effect.get("target", "CARD_TARGET") == "OWNER" else "cardPlay.Target"
            if target == "cardPlay.Target":
                lines.append('        ArgumentNullException.ThrowIfNull(cardPlay.Target, "cardPlay.Target");')
            lines.append(
                f'        await PowerCmd.Apply<{effect["power"]}>(choiceContext, {target}, '
                f'base.DynamicVars["{effect["power"]}"].BaseValue, base.Owner.Creature, this);'
            )
    return lines


def render_card(namespace: str, content: dict) -> str:
    card = content["card"]
    class_name = pascal_case(content["id"])
    keywords = card.get("keywords", [])
    dynamic_vars = _card_dynamic_vars(card)
    effect_lines = _card_effect_lines(card["effects"])
    behaviors = card.get("behaviors", [])

    header = [
        "#nullable enable",
        "",
        "using System;",
        "using System.Collections.Generic;",
        "using System.Threading.Tasks;",
        "using MegaCrit.Sts2.Core.Commands;",
        "using MegaCrit.Sts2.Core.Entities.Cards;",
        "using MegaCrit.Sts2.Core.Entities.Players;",
        "using MegaCrit.Sts2.Core.GameActions.Multiplayer;",
        "using MegaCrit.Sts2.Core.Localization.DynamicVars;",
        "using MegaCrit.Sts2.Core.Models;",
        "using MegaCrit.Sts2.Core.Models.Powers;",
        "using MegaCrit.Sts2.Core.ValueProps;",
        "",
        f"namespace {namespace};",
        "",
        f"public sealed class {class_name} : CardModel",
        "{",
        f"    public {class_name}()",
        f'        : base({card.get("cost", 0)}, CardType.{card.get("type", "Skill")}, '
        f'CardRarity.{card.get("rarity", "Common")}, TargetType.{card.get("target", "Self")})',
        "    {",
        "    }",
    ]

    if keywords:
        header.extend(
            [
                "",
                f"    public override IEnumerable<CardKeyword> CanonicalKeywords => {_keyword_list(keywords)};",
            ]
        )

    header.extend(
        [
            "",
            "    protected override IEnumerable<DynamicVar> CanonicalVars => new DynamicVar[]",
            "    {",
            *[f"        {value}," for value in dynamic_vars],
            "    };",
            "",
            "    protected override async Task OnPlay(PlayerChoiceContext choiceContext, CardPlay cardPlay)",
            "    {",
            *effect_lines,
            "    }",
        ]
    )

    if any(behavior.get("type") == "AUTO_PLAY_FROM_EXHAUST" for behavior in behaviors):
        header.extend(
            [
                "",
                "    public override async Task AfterAutoPrePlayPhaseEnteredEarly(",
                "        PlayerChoiceContext choiceContext,",
                "        Player player)",
                "    {",
                "        CardPile? pile = Pile;",
                "        if (pile != null && pile.Type == PileType.Exhaust && player == Owner)",
                "        {",
                "            await CardCmd.AutoPlay(choiceContext, this, null);",
                "        }",
                "    }",
            ]
        )

    upgrades: list[str] = []
    for effect in card["effects"]:
        delta = effect.get("upgradeDelta")
        if delta is None:
            continue
        if effect["type"] in {"DAMAGE", "GAIN_BLOCK"}:
            upgrades.append(f"        base.DynamicVars.{'Damage' if effect['type'] == 'DAMAGE' else 'Block'}.UpgradeValueBy({delta}m);")
        elif effect["type"] == "DRAW":
            upgrades.append(f"        base.DynamicVars.Cards.UpgradeValueBy({delta});")
        elif effect["type"] == "GAIN_ENERGY":
            upgrades.append(f"        base.DynamicVars.Energy.UpgradeValueBy({delta});")

    header.extend(
        [
            "",
            "    protected override void OnUpgrade()",
            "    {",
            *upgrades,
            "    }",
            "}",
        ]
    )
    return "\n".join(header)


def _relic_effect_lines(effects: list[dict], context_name: str = "context") -> list[str]:
    lines: list[str] = []
    for effect in effects:
        effect_type = effect["type"]
        amount = effect["amount"]
        if effect_type == "GAIN_BLOCK":
            lines.append(f"        await CreatureCmd.GainBlock(Owner.Creature, {amount}m, ValueProp.Move, null, fast: true);")
        elif effect_type == "DRAW":
            lines.append(f"        await CardPileCmd.Draw({context_name}, {amount}, Owner);")
        elif effect_type == "GAIN_ENERGY":
            lines.append(f"        await PlayerCmd.GainEnergy({amount}, Owner);")
        elif effect_type == "HEAL":
            lines.append(f"        await CreatureCmd.Heal(Owner.Creature, {amount}m);")
        elif effect_type == "APPLY_POWER":
            lines.append(
                f'        await PowerCmd.Apply<{effect["power"]}>({context_name}, Owner.Creature, '
                f'{amount}m, Owner.Creature, null);'
            )
    return lines


def render_relic(namespace: str, content: dict) -> tuple[str, list[str], str]:
    relic = content["relic"]
    class_name = pascal_case(content["id"])
    methods: list[str] = []
    for trigger in relic["triggers"]:
        trigger_type = trigger["type"]
        effects = _relic_effect_lines(trigger["effects"])
        if trigger_type == "AFTER_OBTAINED":
            methods.extend(
                [
                    "    public override async Task AfterObtained()",
                    "    {",
                    "        Flash();",
                    *effects,
                    "    }",
                    "",
                ]
            )
        elif trigger_type == "BEFORE_COMBAT_START":
            methods.extend(
                [
                    "    public override async Task BeforeCombatStart()",
                    "    {",
                    "        Flash();",
                    *effects,
                    "    }",
                    "",
                ]
            )
        elif trigger_type == "AFTER_CARD_PLAYED":
            methods.extend(
                [
                    "    public override async Task AfterCardPlayed(PlayerChoiceContext context, CardPlay cardPlay)",
                    "    {",
                    "        if (cardPlay.Card.Owner.Creature != Owner.Creature)",
                    "        {",
                    "            return;",
                    "        }",
                    "        Flash();",
                    *effects,
                    "    }",
                    "",
                ]
            )
        elif trigger_type == "AFTER_TURN_END":
            methods.extend(
                [
                    "    public override async Task AfterSideTurnEnd(",
                    "        PlayerChoiceContext context,",
                    "        CombatSide side,",
                    "        IEnumerable<Creature> participants)",
                    "    {",
                    "        if (side != Owner.Creature.Side)",
                    "        {",
                    "            return;",
                    "        }",
                    "        Flash();",
                    *effects,
                    "    }",
                    "",
                ]
            )

    code = "\n".join(
        [
            "#nullable enable",
            "",
            "using System.Collections.Generic;",
            "using System.Threading.Tasks;",
            "using MegaCrit.Sts2.Core.Combat;",
            "using MegaCrit.Sts2.Core.Commands;",
            "using MegaCrit.Sts2.Core.Entities.Cards;",
            "using MegaCrit.Sts2.Core.Entities.Creatures;",
            "using MegaCrit.Sts2.Core.Entities.Relics;",
            "using MegaCrit.Sts2.Core.GameActions.Multiplayer;",
            "using MegaCrit.Sts2.Core.Models;",
            "using MegaCrit.Sts2.Core.Models.Powers;",
            "using MegaCrit.Sts2.Core.ValueProps;",
            "",
            f"namespace {namespace};",
            "",
            f"public sealed class {class_name} : RelicModel",
            "{",
            f"    public override RelicRarity Rarity => RelicRarity.{relic.get('rarity', 'Common')};",
            "",
            *methods,
            "}",
        ]
    )
    return code, [relic.get("pool", "EventRelicPool")], class_name


def _power_effect_lines(effects: list[dict], context_name: str = "context") -> list[str]:
    lines: list[str] = []
    for effect in effects:
        effect_type = effect["type"]
        if effect_type == "GAIN_BLOCK":
            lines.append("        await CreatureCmd.GainBlock(Owner, base.Amount, ValueProp.Unpowered, null, fast: true);")
        elif effect_type == "DRAW":
            lines.append(f"        await CardPileCmd.Draw({context_name}, base.Amount, Owner.Player);")
        elif effect_type == "GAIN_ENERGY":
            lines.append(f"        await PlayerCmd.GainEnergy(base.Amount, Owner.Player);")
        elif effect_type == "HEAL":
            lines.append("        await CreatureCmd.Heal(Owner, base.Amount);")
        elif effect_type == "APPLY_POWER":
            lines.append(
                f'        await PowerCmd.Apply<{effect["power"]}>({context_name}, Owner, '
                f'{effect["amount"]}m, Owner, null);'
            )
    return lines


def render_power(namespace: str, content: dict) -> tuple[str, str, str]:
    power = content["power"]
    class_name = pascal_case(content["id"])
    methods: list[str] = []
    for trigger in power["triggers"]:
        effects = _power_effect_lines(trigger["effects"])
        if trigger["type"] == "AFTER_CARD_PLAYED":
            methods.extend(
                [
                    "    public override async Task AfterCardPlayed(PlayerChoiceContext context, CardPlay cardPlay)",
                    "    {",
                    "        if (cardPlay.Card.Owner.Creature != Owner || Amount <= 0)",
                    "        {",
                    "            return;",
                    "        }",
                    "        Flash();",
                    *effects,
                    "    }",
                    "",
                ]
            )
        elif trigger["type"] == "AFTER_TURN_END":
            methods.extend(
                [
                    "    public override async Task AfterSideTurnEnd(",
                    "        PlayerChoiceContext context,",
                    "        CombatSide side,",
                    "        IEnumerable<Creature> participants)",
                    "    {",
                    "        if (side != Owner.Side || Amount <= 0)",
                    "        {",
                    "            return;",
                    "        }",
                    "        Flash();",
                    *effects,
                    "    }",
                    "",
                ]
            )

    code = "\n".join(
        [
            "#nullable enable",
            "",
            "using System.Collections.Generic;",
            "using System.Threading.Tasks;",
            "using MegaCrit.Sts2.Core.Combat;",
            "using MegaCrit.Sts2.Core.Commands;",
            "using MegaCrit.Sts2.Core.Entities.Cards;",
            "using MegaCrit.Sts2.Core.Entities.Creatures;",
            "using MegaCrit.Sts2.Core.Entities.Powers;",
            "using MegaCrit.Sts2.Core.GameActions.Multiplayer;",
            "using MegaCrit.Sts2.Core.Models;",
            "using MegaCrit.Sts2.Core.Models.Powers;",
            "using MegaCrit.Sts2.Core.ValueProps;",
            "",
            f"namespace {namespace};",
            "",
            f"public sealed class {class_name} : PowerModel",
            "{",
            f"    public override PowerType Type => PowerType.{power.get('type', 'Buff')};",
            f"    public override PowerStackType StackType => PowerStackType.{power.get('stackType', 'Counter')};",
            "",
            *methods,
            "}",
        ]
    )

    test_card_name = f"{class_name}TestCard"
    test_card = "\n".join(
        [
            "#nullable enable",
            "",
            "using System.Threading.Tasks;",
            "using MegaCrit.Sts2.Core.Commands;",
            "using MegaCrit.Sts2.Core.Entities.Cards;",
            "using MegaCrit.Sts2.Core.GameActions.Multiplayer;",
            "using MegaCrit.Sts2.Core.Models;",
            "",
            f"namespace {namespace};",
            "",
            f"public sealed class {test_card_name} : CardModel",
            "{",
            f"    public {test_card_name}()",
            "        : base(0, CardType.Skill, CardRarity.Token, TargetType.Self)",
            "    {",
            "    }",
            "",
            "    protected override async Task OnPlay(PlayerChoiceContext choiceContext, CardPlay cardPlay)",
            "    {",
            f"        await PowerCmd.Apply<{class_name}>(choiceContext, base.Owner.Creature, 1m, base.Owner.Creature, this);",
            "    }",
            "}",
        ]
    )
    return code, test_card, class_name


def render_mod_initializer(namespace: str, registrations: list[tuple[str, str]]) -> str:
    lines = [
        "using HarmonyLib;",
        "using MegaCrit.Sts2.Core.Modding;",
        "using MegaCrit.Sts2.Core.Models.CardPools;",
        "using MegaCrit.Sts2.Core.Models.RelicPools;",
        "",
        f"namespace {namespace};",
        "",
        "[ModInitializer(nameof(Initialize))]",
        "public static class ModInitializer",
        "{",
        "    public static void Initialize()",
        "    {",
    ]
    for pool, class_name in registrations:
        lines.append(f"        ModHelper.AddModelToPool(typeof({pool}), typeof({class_name}));")
    lines.extend(
        [
            "    }",
            "}",
        ]
    )
    return "\n".join(lines)


def render_project_files(project: Path, spec: dict) -> None:
    mod = spec["mod"]
    mod_id = mod["id"]
    namespace = mod["namespace"]

    _write(
        project / "sl2mod.csproj",
        f"""<Project Sdk="Godot.NET.Sdk/4.5.1">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <EnableDynamicLoading>true</EnableDynamicLoading>
    <AssemblyName>{mod_id}</AssemblyName>
  </PropertyGroup>
  <ItemGroup>
    <Reference Include="0Harmony">
      <HintPath>$(GameDir)/0Harmony.dll</HintPath>
      <Private>False</Private>
    </Reference>
    <Reference Include="GodotSharp">
      <HintPath>$(GameDir)/GodotSharp.dll</HintPath>
      <Private>False</Private>
    </Reference>
    <Reference Include="sts2">
      <HintPath>$(GameDir)/sts2.dll</HintPath>
      <Private>False</Private>
    </Reference>
  </ItemGroup>
</Project>""",
    )
    _write(
        project / "project.godot",
        f"""; Engine configuration file.
config_version=5

[application]
config/name="{mod_id}"
config/features=PackedStringArray("4.5", "C#")

[dotnet]
project/assembly_name="{mod_id}"
""",
    )
    _write(
        project / "export_presets.cfg",
        """[preset.0]
name="Windows Desktop"
platform="Windows Desktop"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter="addons/**"
export_path=""
patches=PackedStringArray()
encryption_include_filters=""
encryption_exclude_filters=""
seed=0
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.0.options]
custom_template/debug=""
custom_template/release=""
debug/export_console_wrapper=1
binary_format/embed_pck=false
texture_format/s3tc_bptc=true
texture_format/etc2_astc=false
shader_baker/enabled=false
binary_format/architecture="x86_64"
dotnet/include_scripts_content=false
dotnet/include_debug_symbols=false
dotnet/embed_build_outputs=false
""",
    )
    _write(
        project / "build" / f"{mod_id}.json",
        json.dumps(
            {
                "id": mod_id,
                "name": mod["name"],
                "author": mod["author"],
                "description": mod.get("description", ""),
                "version": mod["version"],
                "has_pck": True,
                "has_dll": True,
                "dependencies": [],
                "affects_gameplay": True,
            },
            ensure_ascii=False,
            indent=2,
        ),
    )
    _write(project / "namespace.txt", namespace)


def generate_project(spec: dict, output_dir: Path) -> Path:
    normalized = validate_mod_spec(spec)
    normalized["mod"]["namespace"] = normalized["mod"].get("namespace") or namespace_for(normalized["mod"]["id"])
    project = output_dir.resolve()
    if project.exists() and any(project.iterdir()):
        raise FileExistsError(f"输出目录不是空目录：{project}")
    project.mkdir(parents=True, exist_ok=True)

    render_project_files(project, normalized)
    namespace = normalized["mod"]["namespace"]
    content = normalized["content"]
    kind = content["kind"]
    class_name = pascal_case(content["id"])
    registrations: list[tuple[str, str]] = []
    localizations: dict[str, dict[str, str]] = {}

    if kind == "CARD":
        card = content["card"]
        _write(project / "src" / "Core" / "Models" / "Cards" / f"{class_name}.cs", render_card(namespace, content))
        registrations.append((card.get("pool", "ColorlessCardPool"), class_name))
        generate_card_assets(project, normalized["mod"]["id"], content)
        localizations["cards"] = {
            f"{content['id']}.title": content["name"],
            f"{content['id']}.description": content["description"],
        }
    elif kind == "RELIC":
        code, pools, class_name = render_relic(namespace, content)
        _write(project / "src" / "Core" / "Models" / "Cards" / f"{class_name}.cs", code)
        registrations.extend((pool, class_name) for pool in pools)
        generate_relic_assets(project, content)
        localizations["relics"] = {
            f"{content['id']}.title": content["name"],
            f"{content['id']}.description": content["description"],
            f"{content['id']}.flavor": content["description"],
        }
    else:
        code, test_card, class_name = render_power(namespace, content)
        _write(project / "src" / "Core" / "Models" / "Cards" / f"{class_name}.cs", code)
        _write(
            project / "src" / "Core" / "Models" / "Cards" / f"{class_name}TestCard.cs",
            test_card,
        )
        registrations.append(("TokenCardPool", f"{class_name}TestCard"))
        generate_power_assets(project, content)
        localizations["powers"] = {
            f"{content['id']}.title": content["name"],
            f"{content['id']}.description": content["description"],
            f"{content['id']}.smartDescription": content["description"],
        }
        localizations["cards"] = {
            f"{content['id']}_TEST_CARD.title": f"测试：{content['name']}",
            f"{content['id']}_TEST_CARD.description": f"获得1层{content['name']}。",
        }

    if registrations:
        _write(project / "ModInitializer.cs", render_mod_initializer(namespace, registrations))

    for table, values in localizations.items():
        _write(
            project / normalized["mod"]["id"] / "localization" / "zhs" / f"{table}.json",
            json.dumps(values, ensure_ascii=False, indent=2),
        )
    return project
