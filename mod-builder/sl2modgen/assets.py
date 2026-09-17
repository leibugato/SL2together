from __future__ import annotations

import os
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None


def _font_path() -> str | None:
    configured = os.environ.get("STS2_MOD_FONT", "").strip()
    candidates = [
        configured,
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\msyh.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for character in text:
        candidate = current + character
        bounds = draw.textbbox((0, 0), candidate, font=font)
        if current and bounds[2] - bounds[0] > max_width:
            lines.append(current)
            current = character
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def _draw_centered_text(
    image: Image.Image,
    text: str,
    font_size: int,
    y: int,
    max_width: int,
    color: str = "#111111",
    line_gap: int = 8,
) -> int:
    draw = ImageDraw.Draw(image)
    font_path = _font_path()
    if not font_path:
        raise RuntimeError("找不到中文字体。请设置 STS2_MOD_FONT。")
    font = ImageFont.truetype(font_path, font_size)
    lines = _wrap_text(draw, text, font, max_width)
    cursor = y
    for line in lines:
        bounds = draw.textbbox((0, 0), line, font=font)
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        draw.text(((image.width - width) / 2, cursor), line, fill=color, font=font)
        cursor += height + line_gap
    return cursor


def _save_text_image(path: Path, width: int, height: int, title: str, subtitle: str = "") -> None:
    if Image is None:
        raise RuntimeError("缺少 Pillow，请运行 pip install -r mod-builder/requirements.txt")
    image = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(image)
    draw.rectangle((2, 2, width - 3, height - 3), outline="#202020", width=max(2, width // 80))
    title_size = max(28, min(82, width // 10))
    bottom = _draw_centered_text(image, title, title_size, int(height * 0.36), int(width * 0.82))
    if subtitle:
        _draw_centered_text(image, subtitle, max(20, title_size // 2), bottom + 22, int(width * 0.82), "#555555")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def write_atlas_texture(path: Path, image_resource_path: str, width: int, height: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(
            [
                '[gd_resource type="AtlasTexture" load_steps=2 format=3]',
                "",
                f'[ext_resource type="Texture2D" path="{image_resource_path}" id="1_texture"]',
                "",
                "[resource]",
                'atlas = ExtResource("1_texture")',
                f"region = Rect2(0, 0, {width}, {height})",
                "",
            ]
        ),
        encoding="utf-8",
    )


def generate_card_assets(project: Path, mod_id: str, content: dict) -> None:
    card = content["card"]
    pool_slug = card.get("pool", "ColorlessCardPool").removesuffix("CardPool").lower()
    card_slug = content["id"].lower()
    image_rel = f"res://images/packed/card_portraits/{pool_slug}/{card_slug}.png"
    image_path = project / "images" / "packed" / "card_portraits" / pool_slug / f"{card_slug}.png"
    _save_text_image(image_path, 1000, 760, content["name"], card.get("type", "Card"))
    atlas_path = project / "images" / "atlases" / "card_atlas.sprites" / pool_slug / f"{card_slug}.tres"
    write_atlas_texture(atlas_path, image_rel, 1000, 760)


def generate_relic_assets(project: Path, content: dict) -> None:
    relic_slug = content["id"].lower()
    normal = project / "images" / "relics" / f"{relic_slug}.png"
    outline = project / "images" / "relics" / f"{relic_slug}_outline.png"
    _save_text_image(normal, 256, 256, content["name"])
    _save_text_image(outline, 256, 256, content["name"])
    write_atlas_texture(
        project / "images" / "atlases" / "relic_atlas.sprites" / f"{relic_slug}.tres",
        f"res://images/relics/{relic_slug}.png",
        256,
        256,
    )
    write_atlas_texture(
        project / "images" / "atlases" / "relic_outline_atlas.sprites" / f"{relic_slug}.tres",
        f"res://images/relics/{relic_slug}_outline.png",
        256,
        256,
    )


def generate_power_assets(project: Path, content: dict) -> None:
    power_slug = content["id"].lower()
    _save_text_image(project / "images" / "powers" / f"{power_slug}.png", 256, 256, content["name"])
    write_atlas_texture(
        project / "images" / "atlases" / "power_atlas.sprites" / f"{power_slug}.tres",
        f"res://images/powers/{power_slug}.png",
        256,
        256,
    )
