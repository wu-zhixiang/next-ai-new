#!/usr/bin/env python3
import math
import struct
import zlib
from pathlib import Path

SIZE = 162
SCALE = 4
CANVAS = SIZE * SCALE
NORMAL = (95, 94, 94, 255)
ACTIVE = (49, 104, 92, 255)
OUT_DIR = Path(__file__).resolve().parents[1] / "src/assets/tabbar"


def blank():
    return [[(0, 0, 0, 0) for _ in range(CANVAS)] for _ in range(CANVAS)]


def blend(dst, src):
    sr, sg, sb, sa = src
    if sa == 255:
        return src
    dr, dg, db, da = dst
    a = sa / 255
    ia = 1 - a
    return (
        round(sr * a + dr * ia),
        round(sg * a + dg * ia),
        round(sb * a + db * ia),
        round(sa + da * ia),
    )


def set_px(img, x, y, color):
    if 0 <= x < CANVAS and 0 <= y < CANVAS:
        img[y][x] = blend(img[y][x], color)


def s(value):
    return value * SCALE


def draw_disc(img, cx, cy, radius, color):
    cx, cy, radius = s(cx), s(cy), s(radius)
    left = max(0, math.floor(cx - radius))
    right = min(CANVAS - 1, math.ceil(cx + radius))
    top = max(0, math.floor(cy - radius))
    bottom = min(CANVAS - 1, math.ceil(cy + radius))
    r2 = radius * radius
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                set_px(img, x, y, color)


def draw_line(img, x1, y1, x2, y2, width, color):
    x1, y1, x2, y2, width = s(x1), s(y1), s(x2), s(y2), s(width)
    radius = width / 2
    left = max(0, math.floor(min(x1, x2) - radius))
    right = min(CANVAS - 1, math.ceil(max(x1, x2) + radius))
    top = max(0, math.floor(min(y1, y2) - radius))
    bottom = min(CANVAS - 1, math.ceil(max(y1, y2) + radius))
    dx = x2 - x1
    dy = y2 - y1
    length2 = dx * dx + dy * dy
    r2 = radius * radius
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if length2:
                t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / length2))
                px = x1 + t * dx
                py = y1 + t * dy
            else:
                px, py = x1, y1
            if (x - px) ** 2 + (y - py) ** 2 <= r2:
                set_px(img, x, y, color)


def draw_polyline(img, points, width, color):
    for index in range(len(points) - 1):
        draw_line(img, *points[index], *points[index + 1], width, color)


def draw_rect_outline(img, x1, y1, x2, y2, width, color):
    draw_line(img, x1, y1, x2, y1, width, color)
    draw_line(img, x2, y1, x2, y2, width, color)
    draw_line(img, x2, y2, x1, y2, width, color)
    draw_line(img, x1, y2, x1, y1, width, color)


def draw_circle_outline(img, cx, cy, radius, width, color):
    cx, cy, radius, width = s(cx), s(cy), s(radius), s(width)
    outer = radius + width / 2
    inner = radius - width / 2
    left = max(0, math.floor(cx - outer))
    right = min(CANVAS - 1, math.ceil(cx + outer))
    top = max(0, math.floor(cy - outer))
    bottom = min(CANVAS - 1, math.ceil(cy + outer))
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            dist = math.hypot(x - cx, y - cy)
            if inner <= dist <= outer:
                set_px(img, x, y, color)


def draw_arc(img, cx, cy, radius, width, start, end, color):
    cx, cy, radius, width = s(cx), s(cy), s(radius), s(width)
    outer = radius + width / 2
    inner = radius - width / 2
    left = max(0, math.floor(cx - outer))
    right = min(CANVAS - 1, math.ceil(cx + outer))
    top = max(0, math.floor(cy - outer))
    bottom = min(CANVAS - 1, math.ceil(cy + outer))
    start %= math.tau
    end %= math.tau
    wraps = end < start
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            dist = math.hypot(x - cx, y - cy)
            if not inner <= dist <= outer:
                continue
            angle = math.atan2(y - cy, x - cx) % math.tau
            if (start <= angle <= end) or (wraps and (angle >= start or angle <= end)):
                set_px(img, x, y, color)


def downsample(img):
    rows = []
    area = SCALE * SCALE
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            total = [0, 0, 0, 0]
            for yy in range(y * SCALE, (y + 1) * SCALE):
                for xx in range(x * SCALE, (x + 1) * SCALE):
                    px = img[yy][xx]
                    for channel in range(4):
                        total[channel] += px[channel]
            row.extend(round(value / area) for value in total)
        rows.append(bytes(row))
    return rows


def write_png(path, rows):
    raw = b"".join(b"\x00" + row for row in rows)
    compressed = zlib.compress(raw, 9)

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    data = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )
    path.write_bytes(data)


def icon_news(color):
    img = blank()
    draw_rect_outline(img, 45, 34, 117, 128, 10, color)
    draw_line(img, 59, 63, 103, 63, 9, color)
    draw_line(img, 59, 84, 103, 84, 9, color)
    draw_line(img, 59, 105, 95, 105, 9, color)
    return img


def icon_records(color):
    img = blank()
    draw_rect_outline(img, 43, 38, 119, 127, 10, color)
    draw_line(img, 63, 33, 99, 33, 10, color)
    draw_line(img, 59, 52, 103, 52, 8, color)
    for y in (73, 94, 115):
        draw_disc(img, 59, y, 4.5, color)
        draw_line(img, 73, y, 102, y, 8, color)
    return img


def icon_invite(color):
    img = blank()
    draw_rect_outline(img, 39, 65, 123, 128, 10, color)
    draw_line(img, 35, 65, 127, 65, 10, color)
    draw_line(img, 81, 54, 81, 128, 10, color)
    draw_line(img, 40, 88, 122, 88, 8, color)
    draw_arc(img, 66, 52, 18, 9, math.radians(115), math.radians(348), color)
    draw_arc(img, 96, 52, 18, 9, math.radians(192), math.radians(425), color)
    draw_line(img, 72, 62, 81, 65, 8, color)
    draw_line(img, 90, 62, 81, 65, 8, color)
    return img


def icon_member(color):
    img = blank()
    draw_circle_outline(img, 81, 80, 48, 10, color)
    draw_circle_outline(img, 81, 65, 17, 10, color)
    draw_arc(img, 81, 107, 31, 10, math.radians(205), math.radians(335), color)
    return img


def icon_tools(color):
    img = blank()

    # A
    draw_line(img, 35, 113, 60, 46, 14, color)
    draw_line(img, 60, 46, 86, 113, 14, color)
    draw_line(img, 47, 89, 74, 89, 11, color)

    # I
    draw_line(img, 100, 50, 128, 50, 14, color)
    draw_line(img, 114, 50, 114, 111, 14, color)
    draw_line(img, 100, 111, 128, 111, 14, color)
    return img


ICONS = {
    "news": icon_news,
    "records": icon_records,
    "invite": icon_invite,
    "member": icon_member,
    "tools": icon_tools,
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, factory in ICONS.items():
        write_png(OUT_DIR / f"{name}.png", downsample(factory(NORMAL)))
        write_png(OUT_DIR / f"{name}-active.png", downsample(factory(ACTIVE)))


if __name__ == "__main__":
    main()
