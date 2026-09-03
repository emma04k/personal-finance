from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def png_bytes(size: int) -> bytes:
    primary = (22, 100, 90, 255)
    white = (255, 255, 255, 255)
    pixels = bytearray()

    for y in range(size):
        pixels.append(0)
        for x in range(size):
            color = primary
            margin = size * 0.23
            inside = margin <= x <= size - margin and margin <= y <= size - margin
            top_bar = inside and size * 0.36 <= y <= size * 0.43
            middle_bar = inside and size * 0.49 <= y <= size * 0.56
            dot = (x - size * 0.67) ** 2 + (y - size * 0.68) ** 2 <= (size * 0.055) ** 2
            if top_bar or middle_bar or dot:
                color = white
            pixels.extend(color)

    def chunk(kind: bytes, data: bytes) -> bytes:
        payload = kind + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload))

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(
        b"IDAT", zlib.compress(bytes(pixels), 9)
    ) + chunk(b"IEND", b"")


PUBLIC.mkdir(exist_ok=True)
for filename, size in (
    ("apple-touch-icon.png", 180),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
):
    (PUBLIC / filename).write_bytes(png_bytes(size))
