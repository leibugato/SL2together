from __future__ import annotations

import json
import os
import shutil
import subprocess
import zipfile
from pathlib import Path

from .render import generate_project


def _run(command: list[str], cwd: Path) -> None:
    print("$ " + " ".join(command))
    subprocess.run(command, cwd=cwd, check=True)


def _zip_directory(
    source: Path,
    destination: Path,
    arc_root: str,
    excluded_directories: set[str] | None = None,
    excluded_suffixes: set[str] | None = None,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    excluded_directories = excluded_directories or set()
    excluded_suffixes = excluded_suffixes or set()
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in source.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(source)
            if relative.parts and relative.parts[0] in excluded_directories:
                continue
            if path.suffix.lower() in excluded_suffixes:
                continue
            if path.resolve() == destination.resolve():
                continue
            archive.write(path, Path(arc_root) / relative)


def build_project(
    spec: dict,
    output_dir: Path,
    game_dir: Path,
    godot_bin: Path,
    preset: str = "Windows Desktop",
) -> dict:
    project = generate_project(spec, output_dir)
    mod_id = spec["mod"]["id"]
    build_dir = project / "build"

    _run(["dotnet", "build", str(project / "sl2mod.csproj"), f"-p:GameDir={game_dir}", "--nologo"], project)
    compiled_dll = project / ".godot" / "mono" / "temp" / "bin" / "Debug" / "sl2mod.dll"
    if not compiled_dll.exists():
        raise RuntimeError(f"dotnet build 未生成 DLL：{compiled_dll}")
    shutil.copyfile(compiled_dll, build_dir / f"{mod_id}.dll")

    pck_path = build_dir / f"{mod_id}.pck"
    _run(
        [
            str(godot_bin),
            "--headless",
            "--path",
            str(project),
            "--export-pack",
            preset,
            str(pck_path),
        ],
        project,
    )
    if not pck_path.exists():
        raise RuntimeError(f"Godot 未生成 PCK：{pck_path}")

    dist = project / "dist"
    mod_folder = dist / mod_id
    if mod_folder.exists():
        shutil.rmtree(mod_folder)
    mod_folder.mkdir(parents=True)
    for filename in (f"{mod_id}.json", f"{mod_id}.dll", f"{mod_id}.pck"):
        shutil.copyfile(build_dir / filename, mod_folder / filename)

    mod_zip = dist / f"{mod_id}.zip"
    source_zip = dist / f"{mod_id}-source.zip"
    _zip_directory(mod_folder, mod_zip, "mods")
    _zip_directory(
        project,
        source_zip,
        mod_id,
        excluded_directories={"dist", ".godot"},
        excluded_suffixes={".dll", ".pck"},
    )

    return {
        "project": str(project),
        "modZip": str(mod_zip),
        "sourceZip": str(source_zip),
        "manifest": json.loads((build_dir / f"{mod_id}.json").read_text(encoding="utf-8")),
    }


def default_game_dir() -> Path:
    value = os.environ.get("STS2_DLL_DIR", "").strip()
    if not value:
        raise RuntimeError("缺少 STS2_DLL_DIR 或 --game-dir。")
    return Path(value)


def default_godot_bin() -> Path:
    value = os.environ.get("GODOT_BIN", "").strip()
    if not value:
        raise RuntimeError("缺少 GODOT_BIN 或 --godot。")
    return Path(value)
