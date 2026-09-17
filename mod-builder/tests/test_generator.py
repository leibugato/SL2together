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
        for name in ("card_burning.json", "relic_block.json", "power_ward.json"):
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
            self.assertTrue((project / "src" / "Core" / "Models" / "Cards" / "BurningStrike.cs").exists())
            card_code = (project / "src" / "Core" / "Models" / "Cards" / "BurningStrike.cs").read_text(encoding="utf-8")
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
            relic_code = (relic_project / "src" / "Core" / "Models" / "Cards" / "FirstGuard.cs").read_text(
                encoding="utf-8"
            )
            self.assertIn("BeforeCombatStart", relic_code)
            self.assertIn("RelicRarity.Common", relic_code)

            power_project = generate_project(self.load("power_ward.json"), root / "power")
            power_code = (power_project / "src" / "Core" / "Models" / "Cards" / "WardPower.cs").read_text(
                encoding="utf-8"
            )
            test_card_code = (
                power_project / "src" / "Core" / "Models" / "Cards" / "WardPowerTestCard.cs"
            ).read_text(encoding="utf-8")
            self.assertIn("PowerStackType.Counter", power_code)
            self.assertIn("PowerCmd.Apply<WardPower>", test_card_code)

    def test_builds_console_test_guide(self) -> None:
        card = build_test_guide(self.load("card_burning.json"))
        self.assertTrue(any("card BURNING_STRIKE hand" == item["command"] for item in card["commands"]))
        self.assertIn("card BURNING_STRIKE hand", render_test_guide_markdown(card))

        power = build_test_guide(self.load("power_ward.json"))
        self.assertTrue(any("power WARD_POWER 1 0" == item["command"] for item in power["commands"]))
        self.assertTrue(
            any("card WARD_POWER_TEST_CARD hand" == item["command"] for item in power["commands"])
        )


if __name__ == "__main__":
    unittest.main()
