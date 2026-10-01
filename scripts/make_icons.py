#!/usr/bin/env python3
"""生成坦克大战 PWA 图标（像素风坦克）。

用法：python3 scripts/make_icons.py
输出：public/icons/ 下的 icon-512.png、icon-192.png、icon-maskable-512.png、
      apple-touch-icon.png、favicon-48.png
依赖：Pillow（pip install pillow）
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)

TANK = [
    "TT......BB....TT",
    "TT......BB....TT",
    "TT......BB....TT",
    "TT..BBBBBBBB..TT",
    "TT.BBBBBBBBBB.TT",
    "TT.BBBBBBBBBB.TT",
    "TT.BBBBBBBBBB.TT",
    "TT.BBBBBBBBBB.TT",
    "TT.BBBBBBBBBB.TT",
    "TT.BBBBBBBBBB.TT",
    "TT.BBBBBBBBBB.TT",
    "TT.BBBBBBBBBB.TT",
    "TT..BBBBBBBB..TT",
    "TT..BBBBBBBB..TT",
    "TT............TT",
    "TT............TT",
]
COLORS = {
    "T": "#3f3f34",
    "t": "#6b6b58",
    "B": "#f5c93c",
    "b": "#d9a520",
}


def lerp(c1, c2, k):
    a = tuple(int(c1[i : i + 2], 16) for i in (1, 3, 5))
    b = tuple(int(c2[i : i + 2], 16) for i in (1, 3, 5))
    return "#" + "".join(f"{round(a[i] + (b[i] - a[i]) * k):02x}" for i in range(3))


def gradient(size, top, bottom):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(top, bottom, y / (size - 1)))
    return img


def draw_bricks(d, y0, height, size):
    """底部装饰砖墙"""
    bh = height // 2
    bw = size // 8
    for row in range(2):
        y = y0 + row * bh
        offset = (bw // 2) if row % 2 else 0
        for x in range(-bw, size + bw, bw):
            d.rectangle(
                [x + offset + 1, y + 1, x + offset + bw - 1, y + bh - 1],
                fill="#7a3b20",
                outline="#57280f",
            )


def draw_tank(d, ox, oy, px):
    """以(ox,oy)为左上角、px为像素尺寸绘制坦克"""
    dim = 16 * px
    # 车身底色（填补透明缝隙，一直到履带底部）
    d.rectangle([ox + 2 * px, oy + 3 * px, ox + 14 * px, oy + 15 * px - 1], fill="#d9a520")
    # 轮廓描边（提升暗色背景下的辨识度）
    d.rectangle([ox - 2, oy - 2, ox + dim + 1, oy + dim + 1], outline="#000000")
    for r, row in enumerate(TANK):
        for c, ch in enumerate(row):
            if ch in COLORS:
                d.rectangle(
                    [ox + c * px, oy + r * px, ox + (c + 1) * px - 1, oy + (r + 1) * px - 1],
                    fill=COLORS[ch],
                )
    # 圆形炮塔
    d.ellipse([ox + 6 * px, oy + 6 * px, ox + 10 * px, oy + 10 * px], fill="#d9a520")
    d.ellipse([ox + 7 * px, oy + 7 * px, ox + 9 * px, oy + 9 * px], fill="#b8860b")


def make_icon(size, px, tank_shift=0, maskable=False):
    img = gradient(size, "#141a26", "#0b0e14")
    d = ImageDraw.Draw(img)
    # 底部砖墙
    draw_bricks(d, size - int(size * 0.16), int(size * 0.16), size)
    # 地面阴影
    d.ellipse(
        [size * 0.2, size * 0.72 + tank_shift, size * 0.8, size * 0.84 + tank_shift],
        fill=(0, 0, 0, 120),
    )
    # 坦克
    dim = 16 * px
    ox = (size - dim) // 2
    oy = (size - dim) // 2 - size * 0.04 + tank_shift
    draw_tank(d, ox, oy, px)
    # 顶部斜光照
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.polygon(
        [(0, 0), (size, 0), (size, size * 0.07), (0, size * 0.04)],
        fill=(255, 255, 255, 16),
    )
    img = Image.alpha_composite(img.convert("RGBA"), overlay)
    return img.convert("RGB")


def main():
    # 主图标 512 / 192
    icon512 = make_icon(512, 26, tank_shift=-6)
    icon512.save(os.path.join(OUT, "icon-512.png"))
    icon512.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, "icon-192.png"))

    # 可遮罩图标：内容缩小、居中于安全区
    make_icon(512, 20, tank_shift=0, maskable=True).save(
        os.path.join(OUT, "icon-maskable-512.png")
    )

    # iOS 图标 180（不透明）
    icon512.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "apple-touch-icon.png"))

    # 小 favicon
    icon512.resize((48, 48), Image.LANCZOS).save(os.path.join(OUT, "favicon-48.png"))

    print("icons written to", os.path.abspath(OUT))
    print(sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
