"""Render original Stockfish Coach Play listing art from simple vector shapes."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "play-listing"
OUT.mkdir(exist_ok=True)
SCALE = 2


def font(size: int, bold: bool = False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size * SCALE)


def background(size):
    width, height = size
    image = Image.new("RGB", (width * SCALE, height * SCALE))
    pixels = image.load()
    for y in range(height * SCALE):
        for x in range(width * SCALE):
            t = x / (width * SCALE) * 0.52 + y / (height * SCALE) * 0.48
            pixels[x, y] = (round(16 + 13 * t), round(39 + 39 * t), round(48 + 29 * t))
    return image


def rook(draw, left, top, scale, color="#BDF3D3"):
    points = [
        (34, 27), (42, 27), (42, 34), (50, 34), (50, 27),
        (58, 27), (58, 34), (66, 34), (66, 27), (74, 27),
        (74, 43), (68, 49), (65, 71), (72, 77), (72, 83),
        (36, 83), (36, 77), (43, 71), (40, 49), (34, 43),
    ]
    converted = [(round((left + x * scale) * SCALE), round((top + y * scale) * SCALE)) for x, y in points]
    draw.polygon(converted, fill=color)
    inner = [(42, 43), (66, 43), (64, 47), (44, 47)]
    base = [(45, 73), (63, 73), (67, 77), (41, 77)]
    for item in (inner, base):
        draw.polygon([(round((left + x * scale) * SCALE), round((top + y * scale) * SCALE)) for x, y in item], fill="#1B4540")


icon = background((512, 512)).convert("RGBA")
overlay = Image.new("RGBA", icon.size)
layer = ImageDraw.Draw(overlay)
for row in range(5):
    for col in range(5):
        if (row + col) % 2 == 0:
            x = (80 + col * 112) * SCALE
            y = (72 + row * 112) * SCALE
            layer.rounded_rectangle((x, y, x + 92 * SCALE, y + 92 * SCALE), radius=10 * SCALE, fill=(156, 223, 190, 13))
layer.ellipse((66 * SCALE, 66 * SCALE, 446 * SCALE, 446 * SCALE), outline=(125, 211, 168, 83), width=4 * SCALE)
icon = Image.alpha_composite(icon, overlay)
draw = ImageDraw.Draw(icon)
rook(draw, 0, 0, 4.74)
draw.rounded_rectangle((172 * SCALE, 411 * SCALE, 340 * SCALE, 417 * SCALE), radius=3 * SCALE, fill="#E5BB7A")
play_icon = icon.resize((512, 512), Image.Resampling.LANCZOS)
play_icon.save(OUT / "icon-512.png")

for density, side in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    folder = ROOT / "android/app/src/main/res" / f"mipmap-{density}"
    launcher = play_icon.resize((side, side), Image.Resampling.LANCZOS)
    launcher.save(folder / "ic_launcher.png")
    mask = Image.new("L", (side * SCALE, side * SCALE))
    ImageDraw.Draw(mask).ellipse((0, 0, side * SCALE - 1, side * SCALE - 1), fill=255)
    round_icon = launcher.copy()
    round_icon.putalpha(mask.resize((side, side), Image.Resampling.LANCZOS))
    round_icon.save(folder / "ic_launcher_round.png")

feature = background((1024, 500))
draw = ImageDraw.Draw(feature)
for row in range(6):
    for col in range(7):
        x = (636 + col * 82) * SCALE
        y = (-45 + row * 82) * SCALE
        if (row + col) % 2 == 0:
            draw.rounded_rectangle((x, y, x + 75 * SCALE, y + 75 * SCALE), radius=9 * SCALE, fill="#315D60")
draw.rounded_rectangle((96 * SCALE, 103 * SCALE, 252 * SCALE, 139 * SCALE), radius=18 * SCALE, fill="#2B765B")
draw.text((114 * SCALE, 108 * SCALE), "CHESS COACH", font=font(16, True), fill="#D0F9DF")
draw.text((90 * SCALE, 161 * SCALE), "Understand your", font=font(48, True), fill="#F1F7F4")
draw.text((90 * SCALE, 228 * SCALE), "next move", font=font(58, True), fill="#BDF3D3")
draw.text((94 * SCALE, 326 * SCALE), "Play  ·  Learn  ·  Solve", font=font(24), fill="#D4E8E1")
draw.rounded_rectangle((90 * SCALE, 390 * SCALE, 431 * SCALE, 396 * SCALE), radius=3 * SCALE, fill="#E5BB7A")
rook(draw, 524, 1, 5.6, "#D4F7DF")
feature.resize((1024, 500), Image.Resampling.LANCZOS).save(OUT / "feature-graphic-1024x500.png")

print("Generated Play icon and feature graphic in", OUT)
