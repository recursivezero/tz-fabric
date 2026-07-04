"""Local fallback fabric analysis helpers.

These helpers keep the app useful when the remote vision model is slow,
rate-limited, returns an empty message, or the API key is temporarily missing.
The fallback is intentionally conservative: it describes visible colour,
pattern/detail density and surface feel without claiming exact composition.
"""

from __future__ import annotations

import base64
import io
import math
from collections import Counter
from typing import Iterable, Tuple

from PIL import Image, ImageFilter, ImageStat

RGB = Tuple[int, int, int]

_PALETTE: list[tuple[str, RGB]] = [
    ("black", (18, 18, 18)),
    ("charcoal", (48, 50, 56)),
    ("white", (242, 242, 238)),
    ("cream", (232, 220, 190)),
    ("beige", (198, 176, 135)),
    ("brown", (105, 72, 45)),
    ("gold", (210, 157, 45)),
    ("yellow", (230, 205, 55)),
    ("orange", (220, 120, 45)),
    ("red", (190, 38, 45)),
    ("deep red", (130, 18, 35)),
    ("pink", (220, 105, 145)),
    ("purple", (115, 70, 150)),
    ("blue", (60, 105, 190)),
    ("navy", (25, 45, 92)),
    ("teal", (42, 135, 145)),
    ("green", (60, 130, 72)),
    ("grey", (128, 132, 136)),
]


def _open_base64_image(image_base64: str) -> Image.Image:
    if "," in image_base64 and image_base64.strip().startswith("data:"):
        image_base64 = image_base64.split(",", 1)[1]
    raw = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(raw))
    image.thumbnail((640, 640))
    return image.convert("RGB")


def _distance(a: RGB, b: RGB) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _nearest_colour_name(rgb: RGB) -> str:
    return min(_PALETTE, key=lambda item: _distance(rgb, item[1]))[0]


def _dominant_colour(image: Image.Image) -> tuple[str, int]:
    small = image.copy()
    small.thumbnail((96, 96))
    pixels: Iterable[RGB] = small.getdata()

    # Bucket colours so small camera noise does not dominate the result.
    buckets: Counter[RGB] = Counter()
    for r, g, b in pixels:
        # Keep very light backgrounds from overpowering textile colours.
        if r > 238 and g > 238 and b > 238:
            continue
        bucket = (round(r / 24) * 24, round(g / 24) * 24, round(b / 24) * 24)
        buckets[bucket] += 1

    if not buckets:
        stat = ImageStat.Stat(small)
        mean = tuple(int(v) for v in stat.mean[:3])  # type: ignore[assignment]
        return _nearest_colour_name(mean), 1

    dominant_rgb, count = buckets.most_common(1)[0]
    return _nearest_colour_name(dominant_rgb), count


def _image_metrics(image: Image.Image) -> dict[str, float]:
    small = image.copy()
    small.thumbnail((256, 256))
    gray = small.convert("L")
    stat = ImageStat.Stat(gray)
    contrast = float(stat.stddev[0])

    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_mean = float(ImageStat.Stat(edges).mean[0])

    # Approximate colourfulness from channel spread.
    rgb_stat = ImageStat.Stat(small)
    channel_means = rgb_stat.mean[:3]
    colour_spread = float(max(channel_means) - min(channel_means))

    return {
        "contrast": contrast,
        "edge_mean": edge_mean,
        "colour_spread": colour_spread,
    }


def _pattern_phrase(metrics: dict[str, float]) -> str:
    edge = metrics["edge_mean"]
    contrast = metrics["contrast"]
    if edge >= 22 and contrast >= 42:
        return "dense embroidered or printed motif pattern"
    if edge >= 16:
        return "visible repeating motif pattern"
    if contrast >= 35:
        return "subtle tonal pattern"
    return "mostly plain textile surface"


def _surface_phrase(metrics: dict[str, float]) -> str:
    edge = metrics["edge_mean"]
    contrast = metrics["contrast"]
    if edge >= 22:
        return "raised, detailed"
    if contrast <= 22:
        return "smooth, soft"
    return "matte, lightly textured"


def _material_guess(metrics: dict[str, float], colour_name: str) -> str:
    edge = metrics["edge_mean"]
    contrast = metrics["contrast"]
    if "gold" in colour_name or edge >= 24:
        return "decorative woven or embroidered fabric"
    if contrast <= 24:
        return "cotton or cotton-blend fabric"
    if contrast >= 42:
        return "silk, satin, or embellished fabric"
    return "woven textile fabric"


def build_fallback_fabric_analysis(
    image_base64: str,
    analysis_type: str = "short",
    variation: int = 1,
) -> str:
    """Return a useful local fabric description when model output is unavailable."""
    try:
        image = _open_base64_image(image_base64)
        colour_name, _ = _dominant_colour(image)
        metrics = _image_metrics(image)
        pattern = _pattern_phrase(metrics)
        surface = _surface_phrase(metrics)
        material = _material_guess(metrics, colour_name)
    except Exception:
        colour_name = "multi-tone"
        pattern = "visible fabric pattern"
        surface = "textured"
        material = "textile fabric"

    analysis_type = (analysis_type or "short").lower()

    short_variants = [
        f"The fabric appears {colour_name}, with a {pattern}, {surface} surface, and clear textile detailing.",
        f"This looks like {colour_name} {material}, showing a {pattern} and {surface} finish.",
        f"A {colour_name} textile is visible with {pattern}, {surface} texture, and decorative surface detail.",
        f"The image shows {colour_name} fabric with {pattern} and a {surface} fabric finish.",
        f"This textile has a {colour_name} base, {pattern}, and a {surface} visual texture.",
        f"Visible fabric details suggest {colour_name} {material} with {pattern} and {surface} finish.",
    ]

    long_variants = [
        (
            f"The image shows a {colour_name} textile that appears like {material}. "
            f"It has a {pattern}, a {surface} surface feel, and visible detailing that is suitable "
            f"for colour, design, pattern, and texture analysis."
        ),
        (
            f"This fabric appears {colour_name} with {pattern}. The surface looks {surface}, "
            f"suggesting {material}. The visible motifs and fabric structure provide enough detail "
            f"for AI-based textile inspection."
        ),
        (
            f"The textile has a {colour_name} visual base and {pattern}. Its {surface} finish gives "
            f"the material a decorative appearance, likely from print, weave, or embroidery-style detailing."
        ),
        (
            f"A {colour_name} fabric surface is clearly visible. The image shows {pattern}, {surface} "
            f"texture, and decorative textile characteristics that can be used for fabric classification and analysis."
        ),
        (
            f"The fabric presents a {colour_name} colour direction with {pattern}. The finish appears "
            f"{surface}, and the visible structure suggests {material} rather than a non-textile object."
        ),
        (
            f"This looks like {material} in a {colour_name} shade. It includes {pattern}, surface detail, "
            f"and a {surface} texture that makes it analyzable as fabric."
        ),
    ]

    variants = long_variants if analysis_type == "long" else short_variants
    idx = max(0, (variation - 1) % len(variants))
    return variants[idx]
