from __future__ import annotations

import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from sl2modgen.render import generate_project
from sl2modgen.spec import SpecError, analyze_support, validate_mod_spec
from sl2modgen.test_guide import build_test_guide, render_test_guide_markdown


ROOT = Path(__file__).resolve().parents[1]


class GeneratorTests(unittest.TestCase):
    def load(self, name: str) -> dict:
        return json.loads((ROOT / "examples" / name).read_text(encoding="utf-8"))

    def test_examples_are_valid(self) -> None:
        for name in (
            "card_burning.json",
            "card_search.json",
            "card_pile_actions.json",
            "card_discard_energy.json",
            "card_expanded_effects.json",
            "relic_block.json",
            "relic_card_play_hp_loss.json",
            "power_ward.json",
        ):
            result = analyze_support(self.load(name))
            self.assertTrue(result["supported"], result["reason"])

    def test_rejects_unknown_behavior(self) -> None:
        spec = self.load("card_burning.json")
        spec = deepcopy(spec)
        spec["content"]["card"]["behaviors"][0]["type"] = "RUN_ARBITRARY_CODE"
        result = analyze_support(spec)
        self.assertFalse(result["supported"])

    def test_generates_card_project(self) -> None:
        spec = self.load("card_burning.json")
        with tempfile.TemporaryDirectory() as directory:
            project = generate_project(spec, Path(directory) / "mod")
            self.assertTrue((project / "build" / "sl2t_burning_card.json").exists())
            self.assertTrue((project / "ModInitializer.cs").exists())
            self.assertIn(
                "<AssemblyName>sl2t_burning_card</AssemblyName>",
                (project / "sl2mod.csproj").read_text(encoding="utf-8"),
            )
            self.assertIn(
                'project/assembly_name="sl2t_burning_card"',
                (project / "project.godot").read_text(encoding="utf-8"),
            )
            self.assertTrue((project / "src" / "Core" / "Models" / "Cards" / "Burning_strike.cs").exists())
            card_code = (project / "src" / "Core" / "Models" / "Cards" / "Burning_strike.cs").read_text(encoding="utf-8")
            self.assertIn("CardKeyword.Exhaust", card_code)
            self.assertIn("AfterAutoPrePlayPhaseEnteredEarly", card_code)

    def test_rejects_damage_on_power(self) -> None:
        spec = self.load("power_ward.json")
        spec = deepcopy(spec)
        spec["content"]["power"]["triggers"][0]["effects"][0] = {
            "type": "DAMAGE",
            "amount": 6,
            "target": "OWNER",
        }
        with self.assertRaises(SpecError):
            validate_mod_spec(spec)

    def test_generates_relic_and_power_sources(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relic_project = generate_project(self.load("relic_block.json"), root / "relic")
            relic_code = (relic_project / "src" / "Core" / "Models" / "Cards" / "First_guard.cs").read_text(
                encoding="utf-8"
            )
            self.assertIn("BeforeCombatStart", relic_code)
            self.assertIn("RelicRarity.Common", relic_code)

            power_project = generate_project(self.load("power_ward.json"), root / "power")
            power_code = (power_project / "src" / "Core" / "Models" / "Cards" / "Ward_power.cs").read_text(
                encoding="utf-8"
            )
            test_card_code = (
                power_project / "src" / "Core" / "Models" / "Cards" / "Ward_power_test_card.cs"
            ).read_text(encoding="utf-8")
            self.assertIn("PowerStackType.Counter", power_code)
            self.assertIn("PowerCmd.Apply<Ward_power>", test_card_code)

    def test_generates_relic_all_enemy_hp_loss(self) -> None:
        spec = self.load("relic_card_play_hp_loss.json")
        with tempfile.TemporaryDirectory() as directory:
            project = generate_project(spec, Path(directory) / "relic-hp-loss")
            relic_code = (
                project
                / "src"
                / "Core"
                / "Models"
                / "Cards"
                / "Embers_echo.cs"
            ).read_text(encoding="utf-8")
            self.assertIn("AfterCardPlayed", relic_code)
            self.assertIn("HittableEnemies", relic_code)
            self.assertIn("DamageProps.nonCardHpLoss", relic_code)

    def test_builds_console_test_guide(self) -> None:
        card = build_test_guide(self.load("card_burning.json"))
        self.assertTrue(any("card BURNING_STRIKE hand" == item["command"] for item in card["commands"]))
        self.assertIn("card BURNING_STRIKE hand", render_test_guide_markdown(card))

        power = build_test_guide(self.load("power_ward.json"))
        self.assertTrue(any("power WARD_POWER 1 0" == item["command"] for item in power["commands"]))
        self.assertTrue(
            any("card WARD_POWER_TEST_CARD hand" == item["command"] for item in power["commands"])
        )

    def test_generates_card_search(self) -> None:
        spec = self.load("card_search.json")
        with tempfile.TemporaryDirectory() as directory:
            project = generate_project(spec, Path(directory) / "mod")
            card_code = (project / "src" / "Core" / "Models" / "Cards" / "Recover_strike.cs").read_text(
                encoding="utf-8"
            )
            self.assertIn("CardSelectCmd.FromCombatPile", card_code)
            self.assertIn("PileType.Discard", card_code)
            self.assertIn("CardType.Attack", card_code)
            localization = json.loads(
                (project / "sl2t_search_card" / "localization" / "zhs" / "cards.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertIn("RECOVER_STRIKE.selectionScreenPrompt", localization)

    def test_generates_pile_action_card(self) -> None:
        spec = self.load("card_pile_actions.json")
        with tempfile.TemporaryDirectory() as directory:
            project = generate_project(spec, Path(directory) / "mod")
            code = (project / "src" / "Core" / "Models" / "Cards" / "Pile_tactics.cs").read_text(
                encoding="utf-8"
            )
            self.assertIn("CardCmd.DiscardAndDraw", code)
            self.assertIn("CardCmd.Exhaust", code)
            self.assertIn("CardPileCmd.Add(putBackCards, PileType.Draw", code)

    def test_generates_expanded_effects(self) -> None:
        spec = self.load("card_expanded_effects.json")
        with tempfile.TemporaryDirectory() as directory:
            project = generate_project(spec, Path(directory) / "mod")
            code = (
                project / "src" / "Core" / "Models" / "Cards" / "Expanded_tactics.cs"
            ).read_text(encoding="utf-8")
            self.assertIn(".WithHitCount(2)", code)
            self.assertIn("CardCmd.Upgrade", code)
            self.assertIn("CreateClone", code)
            self.assertIn("CreatureCmd.GainMaxHp", code)
            self.assertIn("CreatureCmd.Damage", code)
            self.assertIn("DynamicVars.HpLoss", code)
            self.assertIn("PlayerCmd.GainGold", code)
            self.assertIn("PowerCmd.Apply<DoomPower>", code)

            lose_max_hp = deepcopy(spec)
            lose_max_hp["content"]["id"] = "LOSE_MAX_HP_TEST"
            lose_max_hp["content"]["card"]["effects"] = [
                {
                    "type": "LOSE_MAX_HP",
                    "amount": 2,
                }
            ]
            lose_project = generate_project(lose_max_hp, Path(directory) / "lose-max-hp")
            lose_code = (
                lose_project
                / "src"
                / "Core"
                / "Models"
                / "Cards"
                / "Lose_max_hp_test.cs"
            ).read_text(encoding="utf-8")
            self.assertIn("CreatureCmd.LoseMaxHp", lose_code)


if __name__ == "__main__":
    unittest.main()
