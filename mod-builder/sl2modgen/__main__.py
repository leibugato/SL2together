from __future__ import annotations

import argparse
import json
from pathlib import Path

from .build import build_project, default_game_dir, default_godot_bin
from .render import generate_project
from .spec import SpecError, analyze_support, whitelist_summary


def _read_spec(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(prog="sl2modgen")
    subparsers = parser.add_subparsers(dest="command", required=True)

    whitelist_parser = subparsers.add_parser("whitelist")
    whitelist_parser.set_defaults(handler="whitelist")

    analyze_parser = subparsers.add_parser("analyze")
    analyze_parser.add_argument("spec", type=Path)
    analyze_parser.set_defaults(handler="analyze")

    generate_parser = subparsers.add_parser("generate")
    generate_parser.add_argument("spec", type=Path)
    generate_parser.add_argument("output", type=Path)
    generate_parser.set_defaults(handler="generate")

    build_parser = subparsers.add_parser("build")
    build_parser.add_argument("spec", type=Path)
    build_parser.add_argument("output", type=Path)
    build_parser.add_argument("--game-dir", type=Path)
    build_parser.add_argument("--godot", type=Path)
    build_parser.add_argument("--preset", default="Windows Desktop")
    build_parser.set_defaults(handler="build")

    args = parser.parse_args()
    try:
        if args.handler == "whitelist":
            print(json.dumps(whitelist_summary(), ensure_ascii=False, indent=2))
            return 0

        spec = _read_spec(args.spec)
        if args.handler == "analyze":
            result = analyze_support(spec)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["supported"] else 2

        if args.handler == "generate":
            project = generate_project(spec, args.output)
            print(project)
            return 0

        result = build_project(
            spec,
            args.output,
            args.game_dir or default_game_dir(),
            args.godot or default_godot_bin(),
            args.preset,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (SpecError, RuntimeError, FileExistsError, subprocess.CalledProcessError) as error:
        print(f"error: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
