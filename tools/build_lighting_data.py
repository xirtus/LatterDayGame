#!/usr/bin/env python3
"""Build the chapter lighting dataset and staging-studio presets.

The weather history is deliberately conservative:
  * "reported" means a period source explicitly describes sky/heat/cold.
  * "climate" means a modern climate normal is used as the seasonal baseline.
  * "staged" means a designed colour/lighting choice, not a weather claim.

Outputs:
  game/content/lighting-presets.json
  docs/weather-lighting-report.html   (from docs/weather-lighting-report.template.html)
"""
from __future__ import annotations

import json
import math
from copy import deepcopy
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS_PATH = ROOT / "game/content/chapters.json"
OUT_JSON = ROOT / "game/content/lighting-presets.json"
OUT_CUES = ROOT / "game/content/scene-cues.json"
TEMPLATE = ROOT / "docs/weather-lighting-report.template.html"
REPORT = ROOT / "docs/weather-lighting-report.html"


def hexc(value: str) -> str:
    return value if value.startswith("#") else "#" + value


def deep_merge(base: dict, patch: dict) -> dict:
    out = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = deepcopy(value)
    return out


def moon_phase(day: date) -> float:
    """Approximate synodic phase, 0=new, .5=full."""
    ref = date(2000, 1, 6)
    days = (day - ref).days + 18.234 / 24
    phase = (days % 29.530588853) / 29.530588853
    return round(phase, 4)


def moon_illumination(phase: float) -> float:
    return round((1 - math.cos(2 * math.pi * phase)) / 2, 3)


def solar_position(day: date, hour: float, lat: float, lon: float, tz: float):
    """NOAA-style solar position. Azimuth is degrees clockwise from north."""
    doy = day.timetuple().tm_yday
    ut = hour - tz
    gamma = 2 * math.pi / 365 * (doy - 1 + (ut - 12) / 24)
    eqtime = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )
    decl = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )
    tst = (ut * 60 + eqtime + 4 * lon) % 1440
    ha = math.radians(tst / 4 - 180)
    latr = math.radians(lat)
    alt = math.asin(
        math.sin(latr) * math.sin(decl)
        + math.cos(latr) * math.cos(decl) * math.cos(ha)
    )
    az = 180 + math.degrees(
        math.atan2(
            math.sin(ha),
            math.cos(ha) * math.sin(latr) - math.tan(decl) * math.cos(latr),
        )
    )
    return round((az % 360), 1), round(math.degrees(alt), 1)


DEFAULT = {
    "sky": {
        "top": "#6f9bb5",
        "horizon": "#e4dcc4",
        "cloudTint": "#d8d4c8",
        "cloudCover": 0.30,
        "haze": 0.20,
        "stars": 0.0,
        "moon": 0.0,
        "moonPhase": 0.5,
    },
    "sun": {"azimuth": 220, "elevation": 35, "color": "#ffe0a8", "intensity": 2.6, "shadows": 1.0},
    "ambient": {"sky": "#c0d2d0", "ground": "#6b6a4b", "intensity": 0.60},
    "fog": {"color": "#d5ded5", "density": 0.009},
    "fill": {"azimuth": 300, "elevation": 20, "color": "#a7c2d2", "intensity": 0.25},
    "rim": {"azimuth": 120, "elevation": 30, "color": "#ffe9bd", "intensity": 0.50},
    "practical": {"lamp": 0.0, "lampColor": "#ffd08a", "torch": 0.0, "torchCount": 0, "torchColor": "#ff8a3c"},
    "grade": {
        "exposure": 1.0,
        "contrast": 1.03,
        "saturation": 1.0,
        "temperature": 0.02,
        "tint": 0.0,
        "lift": 0.0,
        "gamma": 1.0,
        "gain": 1.0,
        "shadowColor": "#39434a",
        "shadowStrength": 0.15,
        "vignette": 0.30,
        "grain": 0.06,
        "bloom": 0.15,
        "bloomThreshold": 0.85,
        "chromatic": 0.0,
        "letterbox": 0.0,
    },
    "fx": {
        "rain": 0.0,
        "snow": 0.0,
        "dust": 0.0,
        "embers": 0.0,
        "motes": 0.0,
        "mist": 0.0,
        "groundFog": 0.0,
        "wind": 0.15,
        "lightning": 0.0,
        "godRays": 0.0,
    },
    "palette": {"foliage": "#7d8f5e", "ground": "#9a9274", "shadow": "#3b4347", "accent": "#c49a52"},
    "groundWash": {"color": "#8a8a5f", "opacity": 0.06},
    "mob": {"enabled": False, "count": 0, "torches": 0.0, "pitchforks": 0.0, "guns": 0.0, "muzzle": 0.0, "silhouette": True, "distance": 10, "spread": 1.0},
    "camera": {"distance": 18, "azimuth": 35, "elevation": 18, "fov": 46, "targetHeight": 1.4, "targetX": 0, "targetZ": 0, "roll": 0},
    "interior": False,
}

PROFILES = {
    "spring_morning": {
        "sky": {"top": "#7aa7bd", "horizon": "#e7ead6", "cloudTint": "#e7e4d4", "cloudCover": 0.18, "haze": 0.12},
        "sun": {"color": "#fff0c4", "intensity": 2.8},
        "ambient": {"sky": "#c9ded8", "ground": "#77784e", "intensity": 0.62},
        "fog": {"color": "#dbe7da", "density": 0.006},
        "fill": {"color": "#aed0dc", "intensity": 0.25},
        "rim": {"color": "#fff3cb", "intensity": 0.55},
        "grade": {"exposure": 1.06, "contrast": 1.05, "saturation": 1.04, "temperature": 0.02, "vignette": 0.22},
        "fx": {"godRays": 0.12},
        "groundWash": {"color": "#93a064", "opacity": 0.04},
    },
    "clear_morning": {
        "sky": {"top": "#6b9fc4", "horizon": "#dfe9df", "cloudCover": 0.12, "haze": 0.08},
        "sun": {"color": "#fff1c9", "intensity": 3.0},
        "ambient": {"sky": "#cfe2e1", "ground": "#78784e", "intensity": 0.60},
        "fog": {"color": "#d9e6dc", "density": 0.005},
        "fill": {"color": "#a8ccdd", "intensity": 0.22},
        "rim": {"color": "#fff4ce", "intensity": 0.5},
        "grade": {"exposure": 1.03, "contrast": 1.06, "saturation": 1.02, "temperature": 0.01, "vignette": 0.2},
        "fx": {"godRays": 0.08},
    },
    "summer_noon": {
        "sky": {"top": "#4f92bc", "horizon": "#d9e6df", "cloudTint": "#eee9db", "cloudCover": 0.28, "haze": 0.18},
        "sun": {"color": "#fff5d8", "intensity": 3.3},
        "ambient": {"sky": "#d3e7e7", "ground": "#828357", "intensity": 0.65},
        "fog": {"color": "#dbe6dd", "density": 0.006},
        "fill": {"color": "#b4d4e4", "intensity": 0.18},
        "rim": {"color": "#fff6da", "intensity": 0.38},
        "grade": {"exposure": 1.0, "contrast": 1.08, "saturation": 1.02, "temperature": 0.03, "vignette": 0.18},
    },
    "golden": {
        "sky": {"top": "#5d7e9d", "horizon": "#f2b781", "cloudTint": "#e3b79e", "cloudCover": 0.30, "haze": 0.24},
        "sun": {"color": "#ffb365", "intensity": 2.45},
        "ambient": {"sky": "#bcc6c7", "ground": "#5f513b", "intensity": 0.48},
        "fog": {"color": "#d8b18d", "density": 0.012},
        "fill": {"color": "#7f9fbc", "intensity": 0.30},
        "rim": {"color": "#ffc47e", "intensity": 0.95},
        "grade": {"exposure": 1.08, "contrast": 1.08, "saturation": 1.04, "temperature": 0.10, "tint": 0.02, "vignette": 0.36, "bloom": 0.24},
    },
    "dusk": {
        "sky": {"top": "#354b6b", "horizon": "#e18d6b", "cloudTint": "#b58d86", "cloudCover": 0.38, "haze": 0.28},
        "sun": {"color": "#ff9a62", "intensity": 1.15},
        "ambient": {"sky": "#7f94ad", "ground": "#403f39", "intensity": 0.36},
        "fog": {"color": "#7e7b77", "density": 0.016},
        "fill": {"color": "#607fa6", "intensity": 0.34},
        "rim": {"color": "#ff9f6c", "intensity": 0.72},
        "grade": {"exposure": 1.10, "contrast": 1.10, "saturation": 0.92, "temperature": 0.08, "vignette": 0.42, "grain": 0.08, "bloom": 0.30},
        "sky": {"top": "#354b6b", "horizon": "#e18d6b", "cloudTint": "#b58d86", "cloudCover": 0.38, "haze": 0.28},
    },
    "dawn": {
        "sky": {"top": "#4a607e", "horizon": "#f0b28a", "cloudTint": "#c9a7a1", "cloudCover": 0.32, "haze": 0.18},
        "sun": {"color": "#ffb07a", "intensity": 1.55},
        "ambient": {"sky": "#a6b6c8", "ground": "#4b4a3f", "intensity": 0.55},
        "fog": {"color": "#c9b7aa", "density": 0.012},
        "fill": {"color": "#8aa6c4", "intensity": 0.25},
        "rim": {"color": "#ffcf9a", "intensity": 0.7},
        "grade": {"exposure": 1.05, "contrast": 1.02, "saturation": 0.95, "temperature": 0.06, "tint": 0.02, "vignette": 0.25, "grain": 0.05, "bloom": 0.15},
        "fx": {"mist": 0.15, "godRays": 0.2},
    },
    "bluehour": {
        "sky": {"top": "#16243f", "horizon": "#6f7f95", "cloudTint": "#55657b", "cloudCover": 0.34, "haze": 0.18, "stars": 0.25},
        "sun": {"color": "#a8bfe0", "intensity": 0.45},
        "ambient": {"sky": "#5a7092", "ground": "#20241f", "intensity": 0.30},
        "fog": {"color": "#35445a", "density": 0.017},
        "fill": {"color": "#4d6b93", "intensity": 0.30},
        "rim": {"color": "#9dbce8", "intensity": 0.55},
        "grade": {"exposure": 1.16, "contrast": 1.08, "saturation": 0.78, "temperature": -0.05, "vignette": 0.46, "grain": 0.08, "bloom": 0.28},
    },
    "night": {
        "sky": {"top": "#050b18", "horizon": "#182437", "cloudTint": "#26364b", "cloudCover": 0.18, "haze": 0.10, "stars": 0.92, "moon": 0.85},
        "sun": {"color": "#a9c7ff", "intensity": 0.55},
        "ambient": {"sky": "#3e557a", "ground": "#12140f", "intensity": 0.20},
        "fog": {"color": "#101a25", "density": 0.020},
        "fill": {"color": "#3d5b86", "intensity": 0.18},
        "rim": {"color": "#7fa8e8", "intensity": 0.50},
        "grade": {"exposure": 1.25, "contrast": 1.12, "saturation": 0.72, "temperature": -0.08, "vignette": 0.55, "grain": 0.12, "bloom": 0.34},
    },
    "moonlit": {
        "sky": {"top": "#081426", "horizon": "#233a54", "cloudTint": "#31465f", "cloudCover": 0.12, "haze": 0.08, "stars": 0.96, "moon": 1.0},
        "sun": {"color": "#bcd4ff", "intensity": 0.90},
        "ambient": {"sky": "#4d668c", "ground": "#131711", "intensity": 0.52},
        "fog": {"color": "#1b2a3a", "density": 0.017},
        "fill": {"color": "#4b6b9e", "intensity": 0.25},
        "rim": {"color": "#a7c8ff", "intensity": 0.62},
        "grade": {"exposure": 1.20, "contrast": 1.12, "saturation": 0.76, "temperature": -0.06, "vignette": 0.50, "grain": 0.10, "bloom": 0.30},
    },
    "winter_lamp": {
        "sky": {"top": "#1a2438", "horizon": "#3b4452", "cloudTint": "#3b4554", "cloudCover": 0.72, "haze": 0.14, "stars": 0.18},
        "sun": {"color": "#b9c9df", "intensity": 0.25},
        "ambient": {"sky": "#6d6152", "ground": "#292119", "intensity": 0.60},
        "fog": {"color": "#20242a", "density": 0.022},
        "fill": {"color": "#6c5a49", "intensity": 0.25},
        "rim": {"color": "#ffcf8a", "intensity": 0.30},
        "practical": {"lamp": 1.0, "lampColor": "#ffcf8a"},
        "grade": {"exposure": 1.14, "contrast": 1.07, "saturation": 0.96, "temperature": 0.09, "vignette": 0.46, "grain": 0.09, "bloom": 0.22},
        "fx": {"snow": 0.35},
        "interior": True,
    },
    "candle": {
        "sky": {"top": "#0d1118", "horizon": "#1d1a16", "cloudCover": 0.2, "haze": 0.08, "stars": 0.3},
        "sun": {"color": "#b8c9e0", "intensity": 0.18},
        "ambient": {"sky": "#5d4d3d", "ground": "#1d1711", "intensity": 0.52},
        "fog": {"color": "#17120e", "density": 0.024},
        "fill": {"color": "#6f4b32", "intensity": 0.18},
        "rim": {"color": "#f7b25f", "intensity": 0.35},
        "practical": {"lamp": 0.85, "lampColor": "#ffbe72"},
        "grade": {"exposure": 1.24, "contrast": 1.12, "saturation": 0.9, "temperature": 0.10, "vignette": 0.58, "grain": 0.12, "bloom": 0.30},
        "interior": True,
    },
    "night_room": {
        "sky": {"top": "#0a1222", "horizon": "#1b2a3d", "cloudCover": 0.15, "haze": 0.08, "stars": 0.7, "moon": 0.7},
        "sun": {"color": "#b7ccf0", "intensity": 0.32},
        "ambient": {"sky": "#425b7e", "ground": "#17150f", "intensity": 0.50},
        "fog": {"color": "#141d29", "density": 0.021},
        "fill": {"color": "#3f5d88", "intensity": 0.2},
        "rim": {"color": "#9fc4ff", "intensity": 0.45},
        "practical": {"lamp": 0.35, "lampColor": "#ffc978"},
        "grade": {"exposure": 1.2, "contrast": 1.12, "saturation": 0.82, "temperature": -0.04, "vignette": 0.54, "grain": 0.11, "bloom": 0.32},
        "interior": True,
    },
    "overcast": {
        "sky": {"top": "#78848a", "horizon": "#c4c8bf", "cloudTint": "#c9cec6", "cloudCover": 0.86, "haze": 0.22},
        "sun": {"color": "#d9dad2", "intensity": 0.55},
        "ambient": {"sky": "#b8c2be", "ground": "#666756", "intensity": 0.76},
        "fog": {"color": "#c7ccc2", "density": 0.017},
        "fill": {"color": "#aebbb8", "intensity": 0.30},
        "rim": {"color": "#e3e1d4", "intensity": 0.22},
        "grade": {"exposure": 1.0, "contrast": 0.94, "saturation": 0.74, "temperature": -0.02, "vignette": 0.34, "grain": 0.08, "bloom": 0.08},
    },
    "foggy": {
        "sky": {"top": "#8a9593", "horizon": "#d3d6cb", "cloudTint": "#d4d7cc", "cloudCover": 0.95, "haze": 0.55},
        "sun": {"color": "#ddded6", "intensity": 0.38},
        "ambient": {"sky": "#c1ccc8", "ground": "#6b6a5a", "intensity": 0.72},
        "fog": {"color": "#c8cdc5", "density": 0.042},
        "fill": {"color": "#b5c2bf", "intensity": 0.24},
        "rim": {"color": "#e6e3d6", "intensity": 0.18},
        "grade": {"exposure": 1.0, "contrast": 0.9, "saturation": 0.66, "temperature": -0.02, "vignette": 0.42, "grain": 0.08},
        "fx": {"mist": 0.45},
    },
    "rain": {
        "sky": {"top": "#53656f", "horizon": "#9fa9a4", "cloudTint": "#9da8a4", "cloudCover": 0.92, "haze": 0.30},
        "sun": {"color": "#c8cecd", "intensity": 0.35},
        "ambient": {"sky": "#8ea1a1", "ground": "#4b4d42", "intensity": 0.60},
        "fog": {"color": "#89958f", "density": 0.026},
        "fill": {"color": "#7f989c", "intensity": 0.32},
        "rim": {"color": "#c6cfc7", "intensity": 0.2},
        "grade": {"exposure": 0.98, "contrast": 1.0, "saturation": 0.68, "temperature": -0.04, "vignette": 0.4, "grain": 0.12},
        "fx": {"rain": 0.6, "wind": 0.35},
    },
    "storm": {
        "sky": {"top": "#2c3a40", "horizon": "#6d7773", "cloudTint": "#596764", "cloudCover": 1.0, "haze": 0.35},
        "sun": {"color": "#9fa8a8", "intensity": 0.35},
        "ambient": {"sky": "#66787a", "ground": "#2f342b", "intensity": 0.50},
        "fog": {"color": "#55615e", "density": 0.028},
        "fill": {"color": "#526a72", "intensity": 0.35},
        "rim": {"color": "#a8b6b0", "intensity": 0.30},
        "grade": {"exposure": 0.95, "contrast": 1.18, "saturation": 0.64, "temperature": -0.05, "vignette": 0.55, "grain": 0.16, "bloom": 0.12},
        "fx": {"rain": 0.85, "wind": 0.6, "lightning": 0.45},
    },
    "winter_grey": {
        "sky": {"top": "#6c7b8a", "horizon": "#c2c8cd", "cloudTint": "#c6ccd1", "cloudCover": 0.9, "haze": 0.24},
        "sun": {"color": "#d8e2ef", "intensity": 0.42},
        "ambient": {"sky": "#b4c3d2", "ground": "#6a6d6c", "intensity": 0.70},
        "fog": {"color": "#c3ccd1", "density": 0.020},
        "fill": {"color": "#a9bccd", "intensity": 0.28},
        "rim": {"color": "#eaf2fa", "intensity": 0.24},
        "grade": {"exposure": 1.0, "contrast": 0.96, "saturation": 0.58, "temperature": -0.05, "vignette": 0.35, "grain": 0.07},
        "fx": {"snow": 0.25},
    },
    "highdesert": {
        "sky": {"top": "#4a86b8", "horizon": "#e8dcc4", "cloudTint": "#efe6d6", "cloudCover": 0.10, "haze": 0.14},
        "sun": {"color": "#fff2d0", "intensity": 3.05},
        "ambient": {"sky": "#cfe0e8", "ground": "#8a7a58", "intensity": 0.66},
        "fog": {"color": "#d8cfbb", "density": 0.005},
        "fill": {"color": "#a8c8dc", "intensity": 0.18},
        "rim": {"color": "#fff4d8", "intensity": 0.4},
        "grade": {"exposure": 1.0, "contrast": 1.07, "saturation": 0.98, "temperature": 0.05, "vignette": 0.18},
    },
    "urban_gaslight": {
        "sky": {"top": "#1b2230", "horizon": "#5c4a3a", "cloudTint": "#4b4644", "cloudCover": 0.55, "haze": 0.30, "stars": 0.18},
        "sun": {"color": "#b98a5f", "intensity": 0.22},
        "ambient": {"sky": "#5b5f6e", "ground": "#231c17", "intensity": 0.34},
        "fog": {"color": "#2a2a2e", "density": 0.021},
        "fill": {"color": "#48586e", "intensity": 0.25},
        "rim": {"color": "#ffb46a", "intensity": 0.52},
        "practical": {"lamp": 0.65, "lampColor": "#ffc170"},
        "grade": {"exposure": 1.15, "contrast": 1.1, "saturation": 0.82, "temperature": 0.08, "tint": 0.02, "vignette": 0.54, "grain": 0.13, "bloom": 0.30},
        "fx": {"mist": 0.12},
    },
    "industrial": {
        "sky": {"top": "#5b6565", "horizon": "#a9a08e", "cloudTint": "#9d978b", "cloudCover": 0.78, "haze": 0.38},
        "sun": {"color": "#d4b28b", "intensity": 0.55},
        "ambient": {"sky": "#9aa3a0", "ground": "#4b453b", "intensity": 0.62},
        "fog": {"color": "#8f8a7e", "density": 0.026},
        "fill": {"color": "#8b9698", "intensity": 0.3},
        "rim": {"color": "#d5b48c", "intensity": 0.28},
        "grade": {"exposure": 1.0, "contrast": 1.02, "saturation": 0.62, "temperature": 0.02, "vignette": 0.42, "grain": 0.14, "bloom": 0.08},
        "fx": {"dust": 0.2, "mist": 0.15, "wind": 0.2},
    },
    "supernatural": {
        "sky": {"top": "#0a1226", "horizon": "#314a63", "cloudTint": "#40566d", "cloudCover": 0.28, "haze": 0.18, "stars": 0.8, "moon": 0.5},
        "sun": {"color": "#cfe6ff", "intensity": 0.70},
        "ambient": {"sky": "#6c8bb3", "ground": "#1b211c", "intensity": 0.35},
        "fog": {"color": "#293f53", "density": 0.015},
        "fill": {"color": "#4f7fb4", "intensity": 0.30},
        "rim": {"color": "#bfe6ff", "intensity": 1.20},
        "grade": {"exposure": 1.10, "contrast": 1.05, "saturation": 0.86, "temperature": -0.04, "tint": 0.04, "vignette": 0.50, "grain": 0.08, "bloom": 0.60},
        "fx": {"motes": 0.55, "godRays": 0.7, "mist": 0.1},
    },
    "celestial": {
        "sky": {"top": "#6b7fc4", "horizon": "#f6d9b0", "cloudTint": "#f0d9e0", "cloudCover": 0.20, "haze": 0.12, "stars": 0.30, "moon": 0.25},
        "sun": {"color": "#fff0c0", "intensity": 2.45},
        "ambient": {"sky": "#ffe9cf", "ground": "#8d7f5f", "intensity": 0.82},
        "fog": {"color": "#d9c8e0", "density": 0.006},
        "fill": {"color": "#b8d8ff", "intensity": 0.35},
        "rim": {"color": "#fff2c4", "intensity": 1.10},
        "grade": {"exposure": 1.05, "contrast": 1.0, "saturation": 1.12, "temperature": 0.04, "tint": 0.02, "vignette": 0.20, "grain": 0.03, "bloom": 0.55},
        "fx": {"motes": 0.5, "godRays": 0.8, "mist": 0.05},
    },
    "apocalypse": {
        "sky": {"top": "#2a1412", "horizon": "#b24a2e", "cloudTint": "#6e2f22", "cloudCover": 0.85, "haze": 0.55},
        "sun": {"color": "#ff7a3c", "intensity": 0.80},
        "ambient": {"sky": "#7a4a3f", "ground": "#2b1b18", "intensity": 0.40},
        "fog": {"color": "#7b3f2c", "density": 0.030},
        "fill": {"color": "#5f3a33", "intensity": 0.30},
        "rim": {"color": "#ff8c4a", "intensity": 0.80},
        "grade": {"exposure": 0.95, "contrast": 1.25, "saturation": 0.76, "temperature": 0.12, "tint": -0.06, "vignette": 0.65, "grain": 0.20, "bloom": 0.35},
        "fx": {"embers": 0.8, "dust": 0.65, "lightning": 0.1, "wind": 0.5},
    },
    "fluorescent": {
        "sky": {"top": "#8a9998", "horizon": "#aeb7b2", "cloudCover": 0.0, "haze": 0.06},
        "sun": {"color": "#d8f0e8", "intensity": 0.45},
        "ambient": {"sky": "#c4d6d2", "ground": "#6b706b", "intensity": 0.80},
        "fog": {"color": "#b4bdb8", "density": 0.012},
        "fill": {"color": "#b8d8d2", "intensity": 0.25},
        "rim": {"color": "#e8f4ee", "intensity": 0.20},
        "grade": {"exposure": 1.0, "contrast": 0.95, "saturation": 0.60, "temperature": -0.06, "tint": 0.03, "vignette": 0.25, "grain": 0.06, "bloom": 0.05},
        "interior": True,
    },
}


def make_profile(name: str) -> dict:
    if name not in PROFILES:
        raise KeyError(name)
    return deep_merge(DEFAULT, PROFILES[name])


# Chapter-specific research and staging choices. Titles/dates/places come from
# game/content/chapters.json so this file stays aligned with the game.
INFO = {
    "01": dict(season="winter", time=19.5, weather="snow outside; firelit room", profile="winter_lamp",
               confidence="climate + art direction", mood=["intimate", "cold", "tender"],
               note="Vermont/New Hampshire winter. The room is the whole world: low child eye height, firelight, deep blue window, snow at the glass. No heroic key light; the father's hand is the brightest thing in frame.",
               palette=("#e7d3aa", "#7b6a50", "#25344a", "#b9783e"),
               overrides={"camera": {"distance": 5.4, "azimuth": 28, "elevation": 12, "fov": 52}, "fx": {"snow": 0.32}, "practical": {"lamp": 1.15, "lampColor": "#ffc176"}}),
    "02": dict(season="summer (1816: failed)", time=10.0, weather="volcanic cold, low cloud, then revival heat", profile="overcast",
               confidence="documented 1816 anomaly + climate", mood=["austere", "searching", "grey"],
               note="The Year Without a Summer is the environmental fact behind the chapter. Start with a cold, veiled 1816 sky and grey-green fields; let the later revival meetings warm slightly, but never into a postcard summer.",
               palette=("#9aa98a", "#7d8064", "#4a5050", "#b7a46e"),
               overrides={"sky": {"top": "#707d80", "horizon": "#c2c8bd", "cloudCover": 0.82, "haze": 0.34}, "sun": {"intensity": 0.5}, "grade": {"saturation": 0.72, "temperature": -0.03}, "fx": {"mist": 0.12, "wind": 0.3}}),
    "03": dict(season="spring", time=9.0, weather="clear morning", profile="clear_morning",
               confidence="reported: 'beautiful, clear day'", mood=["sacred", "luminous", "hopeful"],
               note="Joseph Smith—History 1:14 gives the only secure weather sentence in the whole campaign: a beautiful, clear morning early in the spring of 1820. Build the grove as a cathedral of green and gold, then let the pillar of light out-brighten the sun.",
               palette=("#6f9b4f", "#7f8458", "#4f5f4a", "#d8b267"),
               overrides={"sky": {"top": "#6fa3bd", "horizon": "#e6e8cf", "cloudCover": 0.12, "haze": 0.08}, "sun": {"elevation": 37, "intensity": 3.3}, "ambient": {"intensity": 0.42}, "fx": {"godRays": 0.65, "motes": 0.12}, "grade": {"exposure": 0.98, "contrast": 1.1, "saturation": 1.1, "bloom": 0.32}}),
    "04": dict(season="autumn", time=23.0, weather="clear full-moon night", profile="moonlit",
               confidence="reported night + computed moon (≈95% full)", mood=["awe", "fear-to-peace", "supernatural"],
               note="The visit is at night, and 21 September 1823 was close to full moon. Let blue moonlight define the room, then let the messenger's light become the key: 'lighter than at noonday' (JS-H 1:30). The palette moves from indigo to silver-white.",
               palette=("#9cb6d8", "#3a4658", "#e8eef5", "#d6b26c"),
               overrides={"sky": {"moonPhase": moon_phase(date(1823, 9, 21)), "moon": 1.0, "stars": 0.95}, "ambient": {"intensity": 0.58}, "practical": {"lamp": 1.2}, "fx": {"motes": 0.35, "godRays": 0.1}, "grade": {"exposure": 1.45, "bloom": 0.4}, "camera": {"distance": 5.5, "azimuth": 30, "elevation": 10, "fov": 50, "targetHeight": 4.35}}),
    "05": dict(season="autumn", time=6.45, weather="dawn mist", profile="golden",
               confidence="climate + September setting", mood=["longing", "preparation", "quiet"],
               note="The hill chapters are years of return visits; use a low September sun, ground mist, and a cool blue shadow side. Gold on the hilltop, not a warm hearth.",
               palette=("#b7a86b", "#7b7054", "#4a5560", "#c99b51"),
               overrides={"sky": {"top": "#6f8497", "horizon": "#e3c19a", "cloudCover": 0.35}, "sun": {"azimuth": 100, "elevation": 8, "intensity": 2.2}, "fx": {"mist": 0.4}, "grade": {"temperature": 0.06, "vignette": 0.4}}),
    "06": dict(season="autumn", time=15.0, weather="rain showers", profile="rain",
               confidence="climate + journey", mood=["secretive", "anxious", "journey"],
               note="A hand-to-hand journey with a guarded record. Wet brown roads, slate sky, one warm lantern; keep faces half-lit and the horizon closed in.",
               palette=("#8d8b62", "#6f5f48", "#434c54", "#b48a4e"),
               overrides={"practical": {"lamp": 0.35}, "camera": {"distance": 8, "elevation": 12}}),
    "07": dict(season="summer", time=14.0, weather="humid, still", profile="overcast",
               confidence="climate", mood=["studious", "anxious", "close"],
               note="Harmony in summer is humid and close. Use a green-gold exterior and a dim interior lit by one window; the lost manuscript chapter should feel airless rather than rainy.",
               palette=("#8fa06a", "#776147", "#4a4b40", "#b49155"),
               overrides={"sky": {"top": "#87968f", "horizon": "#d3d3bd", "cloudCover": 0.66, "haze": 0.28}, "sun": {"intensity": 0.7}, "fx": {"mist": 0.08}, "camera": {"distance": 7, "elevation": 14}}),
    "08": dict(season="spring", time=10.0, weather="bright spring", profile="spring_morning",
               confidence="climate", mood=["diligent", "hopeful", "bright"],
               note="April to June in Harmony and Fayette: new leaves, clean light, work that fills the frame. Let the palette be fresher and higher-key than the lost-manuscript chapter.",
               palette=("#a9c47a", "#7e7d55", "#6b7a58", "#d8b267"),
               overrides={"fx": {"godRays": 0.2}}),
    "09": dict(season="spring", time=10.0, weather="river mist clearing", profile="spring_morning",
               confidence="climate + river setting", mood=["sacred", "cool", "renewal"],
               note="The Susquehanna in May is high, cold, and silver. Use a pale sky, river mist, and a cool key with warm faces; the water should be the brightest horizontal band.",
               palette=("#9dbb85", "#6f7564", "#b9cfd2", "#c9b06e"),
               overrides={"sky": {"top": "#93b2bd", "horizon": "#e2e8dc", "cloudCover": 0.4, "haze": 0.2}, "fog": {"color": "#c7d3cc", "density": 0.012}, "fx": {"mist": 0.3}, "camera": {"distance": 12, "elevation": 10}}),
    "10": dict(season="late winter", time=11.0, weather="grey thaw", profile="winter_grey",
               confidence="climate", mood=["expectant", "contentious", "cold"],
               note="Witnesses and the printed book sit at the turn from winter to spring in western New York. Grey snowmelt, warm ink and paper, a low sun through cloud. The book is the colour event.",
               palette=("#b8b59a", "#7d7561", "#6f7c88", "#c8a25e"),
               overrides={"fx": {"snow": 0.18, "mist": 0.12}, "camera": {"distance": 10, "elevation": 14}}),
    "11": dict(season="spring", time=16.0, weather="clearing spring", profile="spring_morning",
               confidence="climate", mood=["communal", "tender", "young"],
               note="Fayette and Colesville in 1830: orchards, mud, new grass, a community finding its feet. Use a lower, warmer afternoon key than the Fayette translation scenes.",
               palette=("#a7bf79", "#7b7554", "#5d6a54", "#d1a65e"),
               overrides={"sun": {"elevation": 25, "intensity": 2.6}, "grade": {"temperature": 0.05}}),
    "12": dict(season="autumn", time=15.0, weather="crisp lake-effect air", profile="golden",
               confidence="climate", mood=["gathering", "hope", "crisp"],
               note="Kirtland's first gathering: northeast Ohio autumn, hard blue sky, yellow leaves, white frame buildings. Use a clean, cool shadow side against warm wood.",
               palette=("#b7a45e", "#7e6d4c", "#4d5c6a", "#c79a4d"),
               overrides={"sky": {"top": "#5f8db5", "horizon": "#e8d5b0", "cloudCover": 0.28}, "grade": {"temperature": 0.06}}),
    "13": dict(season="summer", time=14.0, weather="hot, humid, storm on the horizon", profile="summer_noon",
               confidence="climate", mood=["striving", "tense", "prairie"],
               note="Independence in summer is hot, wet, and enormous. Tallgrass green, bleached dust, a bruised storm wall on the horizon; the light should feel too large for the people in it.",
               palette=("#9caf62", "#8b7a58", "#4c5865", "#c59b55"),
               overrides={"sky": {"top": "#577f9d", "horizon": "#d8cfb4", "cloudCover": 0.52}, "sun": {"elevation": 62, "intensity": 3.0}, "fx": {"dust": 0.22, "wind": 0.32}}),
    "14": dict(season="winter", time=22.0, weather="snow, night, vision light", profile="night_room",
               confidence="climate + reported night vision", mood=["revelation", "awe", "winter"],
               note="The February 1832 vision in Hiram: a winter night room, ordinary oil light, then a glory that makes the lamp irrelevant. Keep the room dark enough for the vision to read.",
               palette=("#cfd8e4", "#6d6256", "#1b2a41", "#e0b569"),
               overrides={"practical": {"lamp": 1.1}, "fx": {"snow": 0.4, "motes": 0.28}, "grade": {"exposure": 1.34, "bloom": 0.34}}),
    "15": dict(season="winter", time=23.5, weather="cold, clear, moon setting", profile="night",
               confidence="reported night + climate + computed moon (43%)", mood=["terror", "grief", "violent"],
               note="The mob attack at Hiram is a night of cold air, lanterns, firearms, tar, and feathers. Use a cold blue exterior, a warm violent burst at the door, and desaturated skin. Do not make it picturesque.",
               palette=("#8fa4bf", "#4a3f38", "#141a24", "#b64a32"),
               overrides={"sky": {"moonPhase": moon_phase(date(1832, 3, 25)), "moon": 0.45, "stars": 0.8}, "fx": {"snow": 0.12, "wind": 0.35}, "mob": {"enabled": True, "count": 8, "torches": 0.55, "guns": 0.7, "pitchforks": 0.25, "muzzle": 0.25, "distance": 8}, "camera": {"distance": 7, "elevation": 12}}),
    "N1": dict(season="autumn", time=17.5, weather="gaslit dusk, river haze", profile="urban_gaslight",
               confidence="climate + period city lighting", mood=["urban", "reform", "unease"],
               note="Lower Manhattan in October 1832: early gaslight, wet stone, coal smoke, the Pearl Street house. Use warm gas pools inside a blue-grey street; the city should feel newly, unevenly lit.",
               palette=("#8c8f78", "#6e5c48", "#2b3441", "#d59a53"),
               overrides={"fx": {"mist": 0.25, "rain": 0.1}, "camera": {"distance": 10, "elevation": 14}}),
    "16": dict(season="spring", time=10.0, weather="clear, cold ground", profile="clear_morning",
               confidence="climate", mood=["industrious", "reverent", "school"],
               note="The Whitney store and school of the prophets: plain, bright, utilitarian. Whitewash, brown wood, green outside; light should be even and legible, not mystical.",
               palette=("#9bb173", "#8b7457", "#61706a", "#c9a35b"),
               overrides={"camera": {"distance": 7, "elevation": 12}}),
    "17": dict(season="autumn", time=19.0, weather="cold dusk, letters from violence", profile="dusk",
               confidence="climate + historical news", mood=["grief", "resolve", "distance"],
               note="Kirtland hears of the Jackson County expulsions. Use a warm interior against a cold blue window; the letter paper is the brightest object, the faces are tired.",
               palette=("#a89566", "#6d5a48", "#39485b", "#b4673f"),
               overrides={"practical": {"lamp": 0.9}, "camera": {"distance": 6, "elevation": 10}}),
    "18": dict(season="late spring", time=14.0, weather="heat, dust, thunderstorms", profile="storm",
               confidence="climate + campaign accounts", mood=["endurance", "dust", "tension"],
               note="Zion's Camp across Ohio, Indiana, and Missouri: sun-bleached dust, sudden prairie storms, tired animals. Use a wide, low-contrast dusty key and a bruised sky; rain only as a passing wall.",
               palette=("#9c956b", "#8a7658", "#4a5155", "#b37a45"),
               overrides={"sky": {"cloudCover": 0.62}, "fx": {"dust": 0.55, "rain": 0.2, "wind": 0.55, "lightning": 0.15}, "camera": {"distance": 16, "elevation": 8}}),
    "19": dict(season="summer", time=11.0, weather="bright, warm", profile="summer_noon",
               confidence="climate", mood=["commissioning", "hope", "open"],
               note="1835 Kirtland: the Twelve and Seventy are called; the town is growing. High summer light, white limestone, deep green; a public, outdoor brightness.",
               palette=("#9fb76b", "#8f7854", "#5b6b66", "#cfa65c"),
               overrides={"camera": {"distance": 12, "elevation": 16}}),
    "20": dict(season="early spring", time=8.0, weather="cold, bright spring morning", profile="clear_morning",
               confidence="climate + dated dedication", mood=["sacred", "pentecostal", "cold-light"],
               note="Kirtland Temple, 27 March–3 April 1836. The dedication was an early-morning gathering in a cold Ohio spring. Use pale gold sun through high windows, cold blue shadow, and a distinct supernatural layer for the day of Pentecost.",
               palette=("#9bb86b", "#8b8465", "#4f6170", "#e2c06d"),
               overrides={"sun": {"elevation": 20, "intensity": 2.6, "color": "#ffe6b0"}, "ambient": {"intensity": 0.45}, "fog": {"density": 0.01}, "fx": {"godRays": 0.5, "motes": 0.25}, "grade": {"exposure": 0.98, "contrast": 1.12, "saturation": 0.98, "temperature": -0.02, "bloom": 0.3}, "camera": {"distance": 30, "azimuth": 35, "elevation": 16, "fov": 48, "targetHeight": 2.5, "targetX": -55, "targetZ": -52}}),
    "21": dict(season="winter", time=16.0, weather="grey snow, bank crisis", profile="winter_grey",
               confidence="climate + historical context", mood=["anxiety", "loss", "cold"],
               note="Kirtland 1837–38: financial collapse, leaving, snow. Use a bleached grey palette, low contrast, cold hands; the warm windows are few and far between.",
               palette=("#b1b09b", "#7a7364", "#65717d", "#a9774e"),
               overrides={"fx": {"snow": 0.32}, "grade": {"saturation": 0.5, "contrast": 0.95}}),
    "22": dict(season="autumn", time=15.0, weather="smoke, tension, militia", profile="storm",
               confidence="climate + historical conflict", mood=["conflict", "fear", "smoke"],
               note="Far West and northern Missouri in 1838: armed tension, burnt-out farms, autumn smoke. Use a dirty amber key, low grey cloud, and deep red-brown shadows; avoid a clean heroic battlefield look.",
               palette=("#9b8557", "#6c5844", "#3f4142", "#a64d32"),
               overrides={"sky": {"cloudCover": 0.7}, "fx": {"dust": 0.35, "embers": 0.08, "wind": 0.4}, "mob": {"enabled": True, "count": 6, "guns": 0.6, "torches": 0.15, "pitchforks": 0.1, "distance": 12}, "camera": {"distance": 14, "elevation": 12}}),
    "23": dict(season="winter", time=21.0, weather="freezing, stone cell", profile="candle",
               confidence="climate + reported winter imprisonment", mood=["anguish", "hope", "frozen"],
               note="Liberty Jail, winter 1838–39: cold stone, poor food, a low cellar light. Keep the frame almost monochrome blue-grey, with one candle-warm pool on hands and paper. The voice of the chapter is hope inside a cold cell.",
               palette=("#a9b0b5", "#6e6256", "#2b3542", "#d49a54"),
               overrides={"ambient": {"intensity": 0.5}, "practical": {"lamp": 1.4}, "fx": {"snow": 0.18, "mist": 0.08}, "grade": {"exposure": 1.38, "saturation": 0.56, "temperature": -0.06, "contrast": 1.1}, "camera": {"distance": 5.4, "azimuth": 30, "elevation": 10, "fov": 52, "targetHeight": 1.4}}),
    "24": dict(season="spring", time=10.0, weather="river spring, clearing", profile="spring_morning",
               confidence="climate", mood=["building", "hope", "river"],
               note="Nauvoo rising by the Mississippi: wet spring ground, limestone and brick, river light. Use broad, clean daylight with a cool river band and warm masonry.",
               palette=("#9db77c", "#9a7b59", "#6f8a92", "#c9a35c"),
               overrides={"camera": {"distance": 16, "elevation": 14}}),
    "25": dict(season="spring", time=21.0, weather="lamplit upper room", profile="candle",
               confidence="climate + interior practicals", mood=["sacred", "secret", "solemn"],
               note="The Red Brick Store upper room, 15–16 March 1842: oil lamps, washing, anointing, a small enclosed world. Use warm lamp pools against deep brown shadow; almost no sky.",
               palette=("#d8bc83", "#7d6046", "#241c18", "#e0b166"),
               overrides={"practical": {"lamp": 1.15}, "fx": {"motes": 0.12}, "camera": {"distance": 5, "elevation": 9}}),
    "26": dict(season="summer", time=14.0, weather="humid river summer", profile="summer_noon",
               confidence="climate", mood=["communal", "complicated", "warm"],
               note="Nauvoo 1842–43: Relief Society, family, politics, heat. Use a lush but heavy green, brick red, Mississippi haze; the beauty should have weight.",
               palette=("#8fae6c", "#9a7453", "#617f8a", "#c39a55"),
               overrides={"fx": {"mist": 0.12}, "grade": {"saturation": 0.95, "temperature": 0.05}}),
    "B1": dict(season="autumn", time=15.0, weather="mill smoke, low sun", profile="industrial",
               confidence="climate + industrial setting", mood=["documentary", "dignity", "smoke"],
               note="Lowell, Massachusetts, c. 1843–44: brick mills, coal smoke, immigrant streets, a barbershop interior. Use soot-softened light, brick red, slate blue, and one warm interior pool. Elijah Able and Jane Manning deserve portrait lighting, not silhouette.",
               palette=("#9b7a55", "#7c5d49", "#4a5158", "#c18a4f"),
               overrides={"fx": {"mist": 0.3, "dust": 0.15}, "camera": {"distance": 10, "elevation": 12}}),
    "27": dict(season="winter", time=10.0, weather="cold campaign weather", profile="winter_grey",
               confidence="climate + dated campaign", mood=["political", "tense", "cold"],
               note="Nauvoo, January–February 1844: a presidential campaign in winter. Use newsprint white, ink black, cold blue, and one red accent; the light is public and exposed.",
               palette=("#c3c0ae", "#7f7666", "#5c6d7d", "#a94732"),
               overrides={"fx": {"snow": 0.25}, "camera": {"distance": 12, "elevation": 12}}),
    "28": dict(season="spring", time=10.0, weather="spring grove, bright", profile="spring_morning",
               confidence="climate (no daily record located)", mood=["bold", "visionary", "mourning"],
               note="The King Follett discourse, 7 April 1844, outdoors before a large crowd. No reliable daily weather record was located, so stage it as a bright, cool spring morning: new leaves, hard sunlight, wind. The sermon's scale needs a big sky.",
               palette=("#a9c274", "#7c7a55", "#6e7f69", "#d6b26a"),
               overrides={"sun": {"elevation": 36, "intensity": 2.8}, "fx": {"wind": 0.25, "dust": 0.08}, "camera": {"distance": 15, "elevation": 11}}),
    "29": dict(season="early summer", time=17.0, weather="hot, still, dust", profile="golden",
               confidence="reported heat season + climate", mood=["foreboding", "urgency", "heat"],
               note="Nauvoo to Carthage, June 1844. The road should be bleached and dusty, the river a hot mirror, the sky too wide. This chapter hands the player to the jail; it should already feel like the light is draining.",
               palette=("#a9aa6f", "#9a835e", "#5b6b70", "#b5773f"),
               overrides={"sun": {"elevation": 28, "intensity": 2.2}, "fx": {"dust": 0.4, "mist": 0.12, "wind": 0.18}, "grade": {"saturation": 0.78, "temperature": 0.08, "contrast": 1.08}, "camera": {"distance": 16, "elevation": 10}}),
    "30": dict(title="Carthage · The Martyrdom", season="summer", time=17.0, weather="hot afternoon, hazy, still", profile="golden",
               confidence="reported: room very hot; late afternoon; no torchlit-night claim", mood=["tragic", "sacred", "violent", "grey"],
               note="Carthage, 27 June 1844, about 5 p.m. Period accounts say the upstairs room became very hot and the men opened the windows; the mob came in late afternoon with painted faces and firearms. Stage the historical preset as bleached pastoral green, dusty gold sun, grey-green shadow, and a slow desaturation toward ash. Torches/pitchforks belong only to the clearly labelled stylised nightmare preset.",
               palette=("#7a8f5a", "#7f8064", "#3b4342", "#a8432f"),
               overrides={"sky": {"top": "#6f7d7f", "horizon": "#c4bea8", "cloudTint": "#c9c4b4", "cloudCover": 0.55, "haze": 0.45}, "sun": {"azimuth": 262, "elevation": 30, "color": "#ffd9a8", "intensity": 2.0}, "ambient": {"sky": "#adb9b3", "ground": "#5d614a", "intensity": 0.48}, "fog": {"color": "#a9a594", "density": 0.022}, "fill": {"color": "#9fb9c8", "intensity": 0.3}, "grade": {"exposure": 0.86, "contrast": 1.24, "saturation": 0.45, "temperature": -0.02, "tint": -0.05, "shadowColor": "#3b4342", "shadowStrength": 0.6, "vignette": 0.58, "grain": 0.16, "bloom": 0.06}, "fx": {"dust": 0.3, "mist": 0.1, "wind": 0.12, "godRays": 0.08}, "mob": {"enabled": True, "count": 12, "torches": 0.0, "pitchforks": 0.0, "guns": 0.8, "muzzle": 0.0, "silhouette": True, "distance": 9, "spread": 1.15}, "camera": {"distance": 24, "azimuth": 38, "elevation": 16, "fov": 46, "targetHeight": 3.2}}),
    "31": dict(season="imagined", time=20.0, weather="liminal twilight", profile="supernatural",
               confidence="designed", mood=["liminal", "tender", "awe"],
               note="The spirit-world interval is designed, not historical. Use a pearl-and-indigo twilight, soft vertical light, no hard sun, and a horizon that refuses to resolve.",
               palette=("#a9c6c5", "#6e7f86", "#2e3b52", "#d6c08b"),
               overrides={"sky": {"top": "#172b46", "horizon": "#7d8fa0", "cloudCover": 0.3}, "fx": {"motes": 0.6, "mist": 0.35, "godRays": 0.55}, "camera": {"distance": 20, "elevation": 10}}),
    "32": dict(season="imagined", time=12.0, weather="celestial clarity", profile="celestial",
               confidence="designed", mood=["transcendent", "joyful", "luminous"],
               note="Celestial space and the new world: no earthly weather. Use a high-key gold/rose/cyan palette, long soft bloom, and a sky that reads as light rather than atmosphere.",
               palette=("#e6d39a", "#b9a875", "#b9d9e8", "#f4e6b0"),
               overrides={"camera": {"distance": 28, "elevation": 14}}),
    "E1": dict(season="imagined spring", time=7.0, weather="Eden morning", profile="spring_morning",
               confidence="designed", mood=["innocent", "wonder", "green"],
               note="Eden is an imagined mission landscape. Use saturated young green, warm mist, enormous soft sun, and a world without dust or damage.",
               palette=("#8fc46a", "#6f8a53", "#7fa7a0", "#e2c06a"),
               overrides={"sky": {"top": "#8ac0cf", "horizon": "#f0e6c9", "cloudCover": 0.22}, "fx": {"mist": 0.35, "motes": 0.2, "godRays": 0.5}, "grade": {"saturation": 1.12, "bloom": 0.3}, "camera": {"distance": 18, "elevation": 10}}),
    "E2": dict(season="summer", time=15.0, weather="high desert clear", profile="highdesert",
               confidence="climate + designed future", mood=["reflection", "expanse", "dry"],
               note="Salt Lake City after 1847, used as a fictional reflection. High desert light: hard sun, sage and ochre, a blue that goes almost black at zenith, mountains as a cool wall.",
               palette=("#9aa478", "#a58d66", "#5c7f9b", "#c49a55"),
               overrides={"camera": {"distance": 20, "elevation": 12}}),
    "E3": dict(season="autumn", time=17.5, weather="suburban dusk", profile="golden",
               confidence="designed", mood=["nostalgic", "uncanny", "autumn"],
               note="A 1955 doorstep: postwar suburb, autumn leaves, a low sun through elm trees, a car in the drive. Use Kodachrome warmth with one wrong cool shadow; nostalgia should be slightly too clean.",
               palette=("#c79a58", "#9a7c5a", "#56706f", "#d9a24e"),
               overrides={"sky": {"top": "#6f92ad", "horizon": "#efc58d", "cloudCover": 0.32}, "grade": {"saturation": 1.08, "temperature": 0.09, "contrast": 1.02}, "camera": {"distance": 12, "elevation": 8}}),
    "E4": dict(season="autumn", time=14.0, weather="overcast archive light", profile="fluorescent",
               confidence="designed", mood=["institutional", "memory", "flat"],
               note="1994 family archive: fluorescent tubes, beige carpet, a CRT, paper. Use flat greenish light, low contrast, and one warm desk lamp; the past is stored under office lighting.",
               palette=("#c6bfa4", "#8a7c66", "#6f7f78", "#c89b58"),
               overrides={"practical": {"lamp": 0.5, "lampColor": "#ffd59a"}, "camera": {"distance": 6, "elevation": 10}}),
    "E5": dict(season="summer", time=13.0, weather="climate-stressed heat", profile="summer_noon",
               confidence="designed + climate", mood=["urgent", "communal", "heat"],
               note="2026 shared water: a near-future Nauvoo under climate stress. Use harsh white sun, bleached concrete, a low river, and a storm that may or may not break; keep hope in the people, not the sky.",
               palette=("#b0a86a", "#a08f72", "#5e7f93", "#b95d3f"),
               overrides={"sun": {"elevation": 70, "intensity": 3.4}, "grade": {"exposure": 1.02, "contrast": 1.1, "saturation": 0.9, "temperature": 0.09}, "fx": {"dust": 0.3, "wind": 0.2}, "camera": {"distance": 14, "elevation": 10}}),
    "E6": dict(season="imagined aftermath", time=16.0, weather="ashfall, firestorm sky", profile="apocalypse",
               confidence="designed", mood=["apocalyptic", "grief", "ash"],
               note="The desert after the fire: an imagined nuclear aftermath. Use a red-black sky, falling ash, ember light, and no green; the palette is charcoal, rust, and bone.",
               palette=("#8a6a50", "#4a403a", "#7a3426", "#d06a3a"),
               overrides={"camera": {"distance": 18, "elevation": 8}}),
    "E7": dict(season="imagined future", time=2.0, weather="climate-controlled night", profile="fluorescent",
               confidence="designed", mood=["oppressive", "eerie", "cold"],
               note="The closed archive: a future of guarded knowledge. Use cold fluorescent strips, grey-green concrete, deep black outside the glass, and one screen-blue glow. The light should feel like surveillance.",
               palette=("#9aa89e", "#6a756c", "#2f3a3c", "#5f9aa0"),
               overrides={"sky": {"top": "#06090c", "horizon": "#10161a", "cloudCover": 0.0}, "grade": {"saturation": 0.5, "contrast": 1.14, "temperature": -0.08, "vignette": 0.55}, "practical": {"lamp": 0.35, "lampColor": "#c8f0e8"}, "camera": {"distance": 6, "elevation": 9}}),
    "E8": dict(season="imagined future", time=9.0, weather="open future light", profile="celestial",
               confidence="designed", mood=["joyful", "open", "welcome"],
               note="Zion is a welcome: an imagined open future. Use a high, clean morning, gold-green, water, and a horizon full of doors; the brightest scene in the game, but not white-out.",
               palette=("#b7d47e", "#9bb38a", "#a9d6e2", "#f0cf7a"),
               overrides={"sky": {"top": "#77b6cc", "horizon": "#f2e4c3", "cloudCover": 0.24}, "fx": {"motes": 0.3, "godRays": 0.6, "mist": 0.1}, "grade": {"exposure": 1.08, "bloom": 0.4}, "camera": {"distance": 24, "elevation": 12}}),
}

ISO = {
    "01": "1805-12-23", "02": "1816-06-01", "03": "1820-04-15", "04": "1823-09-21",
    "05": "1823-09-22", "06": "1827-09-22", "07": "1828-06-15", "08": "1829-05-15",
    "09": "1829-05-15", "10": "1830-03-26", "11": "1830-06-01", "12": "1831-02-01",
    "13": "1831-07-20", "14": "1832-02-16", "15": "1832-03-24", "N1": "1832-10-15",
    "16": "1833-03-01", "17": "1833-11-01", "18": "1834-05-20", "19": "1835-02-14",
    "20": "1836-04-03", "21": "1837-12-01", "22": "1838-10-15", "23": "1839-01-15",
    "24": "1840-05-01", "25": "1842-03-15", "26": "1842-06-01", "B1": "1843-10-15",
    "27": "1844-01-15", "28": "1844-04-07", "29": "1844-06-20", "30": "1844-06-27",
    "31": "1845-01-01", "32": "2100-01-01", "E1": "0001-04-01", "E2": "1848-07-24",
    "E3": "1955-10-15", "E4": "1994-10-15", "E5": "2026-07-15", "E6": "2100-07-15",
    "E7": "2140-01-15", "E8": "2200-04-01",
}

GEO = {
    "01": (43.64, -72.25, -5), "02": (43.06, -77.23, -5), "03": (43.06, -77.23, -5),
    "04": (43.06, -77.23, -5), "05": (43.06, -77.23, -5), "06": (42.85, -76.85, -4),
    "07": (41.75, -75.55, -5), "08": (41.75, -75.55, -5), "09": (42.0, -76.0, -5),
    "10": (42.85, -76.85, -5), "11": (42.85, -76.85, -5), "12": (41.60, -81.36, -5),
    "13": (39.09, -94.42, -6), "14": (41.31, -81.14, -5), "15": (41.31, -81.14, -5),
    "N1": (40.71, -74.0, -5), "16": (41.60, -81.36, -5), "17": (41.60, -81.36, -5),
    "18": (39.5, -88.0, -6), "19": (41.60, -81.36, -5), "20": (41.60, -81.36, -5),
    "21": (41.60, -81.36, -5), "22": (39.34, -93.96, -6), "23": (39.25, -94.42, -6),
    "24": (40.55, -91.38, -6), "25": (40.55, -91.38, -6), "26": (40.55, -91.38, -6),
    "B1": (42.63, -71.32, -5), "27": (40.55, -91.38, -6), "28": (40.55, -91.38, -6),
    "29": (40.55, -91.38, -6), "30": (40.416, -91.136, -6), "31": (0, 0, 0),
    "32": (0, 0, 0), "E1": (0, 0, 0), "E2": (40.76, -111.89, -7), "E3": (43.06, -77.23, -5),
    "E4": (41.75, -75.55, -5), "E5": (40.55, -91.38, -6), "E6": (39.09, -94.42, -6),
    "E7": (39.25, -94.42, -6), "E8": (0, 0, 0),
}

FALLBACK = dict(
    season="summer", time=12.0, weather="clear", profile="summer_noon",
    confidence="staged", mood=["historical", "devotional"],
    note="Baseline staging; refine with the studio.",
    palette=("#8fa06a", "#8a7a5c", "#4b5560", "#c49a55"),
    overrides={},
)


INTERIOR_IDS = {"01", "04", "07", "08", "14", "15", "23", "E4", "E7"}

INTERIOR_CAMERAS = {
    "01": {"distance": 6.5, "azimuth": 28, "elevation": 14, "fov": 52, "targetHeight": 1.2},
    "04": {"distance": 8.5, "azimuth": 30, "elevation": 28, "fov": 50, "targetHeight": 4.35},
    "07": {"distance": 7.0, "azimuth": 30, "elevation": 16, "fov": 52, "targetHeight": 1.35},
    "08": {"distance": 7.0, "azimuth": 30, "elevation": 16, "fov": 52, "targetHeight": 1.35},
    "14": {"distance": 7.0, "azimuth": 30, "elevation": 16, "fov": 52, "targetHeight": 1.4},
    "15": {"distance": 6.5, "azimuth": 30, "elevation": 14, "fov": 52, "targetHeight": 1.3},
    "23": {"distance": 6.5, "azimuth": 30, "elevation": 14, "fov": 52, "targetHeight": 1.4},
    "E4": {"distance": 7.0, "azimuth": 35, "elevation": 16, "fov": 52, "targetHeight": 1.4},
    "E7": {"distance": 6.5, "azimuth": 35, "elevation": 14, "fov": 52, "targetHeight": 1.4},
}


AUTHORED_RECORD_LOOKS = {
    "BM01": ("golden", 17, 230, 24, "#b6a47b", "#ad9270", "#565653", "#ddad68", "Warm domestic safety gives way to an exposed dry road.", {"practical": {"lamp": 0.45}, "fx": {"dust": 0.18}}),
    "BM02": ("foggy", 5, 95, 4, "#688077", "#768486", "#344854", "#f1e8cc", "Blue-grey dream mist; welcoming ivory fruit stays readable rather than glaring.", {"sky": {"top": "#455e72", "horizon": "#b6c6c5"}, "fx": {"mist": 0.48, "motes": 0.22}, "grade": {"bloom": 0.16}}),
    "BM03": ("moonlit", 23, 290, -18, "#596a66", "#68645d", "#202f44", "#cfa76c", "Cold moonlit treasury lanes with restrained warm doorway spill.", {"practical": {"lamp": 0.32}, "fog": {"density": 0.014}, "grade": {"exposure": 1.12, "vignette": 0.32}}),
    "BM04": ("dawn", 6, 100, 8, "#8c9b76", "#b39e77", "#566e79", "#e0ba77", "Salt-haze dawn opens into an amber shipbuilding workday.", {"fx": {"mist": 0.18, "dust": 0.12}, "sky": {"horizon": "#dfd6bc"}}),
    "BM05": ("storm", 15, 240, 22, "#51635c", "#596b69", "#213438", "#b6c7bf", "Green-black ocean storm, releasing toward a quiet silver horizon.", {"sky": {"top": "#263f40", "horizon": "#718780"}, "fx": {"rain": 0.8, "wind": 0.8, "lightning": 0.12}, "grade": {"saturation": 0.58}}),
    "BM06": ("bluehour", 5, 85, -6, "#727d73", "#797c78", "#2f4153", "#ead5a0", "Cold summit worklight gives way to intimate touched-stone radiance.", {"fx": {"motes": 0.12}, "practical": {"lamp": 0.25, "lampColor": "#e9d6a3"}}),
    "BM07": ("candle", 22, 285, -20, "#555c51", "#665447", "#211d1b", "#f0d49a", "Enclosed dark timber held by two warm stone lights; storm stays outside.", {"interior": True, "practical": {"lamp": 1.1, "lampColor": "#f0d49a"}, "fx": {"rain": 0, "motes": 0.12}, "grade": {"vignette": 0.28}}),
    "BM08": ("dusk", 19, 270, -2, "#596e56", "#786d53", "#304252", "#d6bc87", "Long contemplative forest shade leads to gentle dawn.", {"fx": {"mist": 0.16}, "grade": {"contrast": 0.96, "vignette": 0.24}}),
    "BM09": ("clear_morning", 9, 115, 32, "#8d9d70", "#b2a283", "#5f747a", "#d9bc7d", "Generous gathering morning; distant tents and listeners retain detail.", {"sun": {"intensity": 2.5}, "grade": {"exposure": 0.98, "contrast": 0.98, "bloom": 0.05}}),
    "BM10": ("overcast", 13, 215, 60, "#6e7869", "#9a8b74", "#46494a", "#c49c5d", "Hard institutional court shafts give way to a protected writing light.", {"interior": True, "sun": {"intensity": 1.4}, "ambient": {"intensity": 0.4}, "practical": {"lamp": 0.25}, "fx": {"godRays": 0.2}}),
    "BM11": ("spring_morning", 9, 120, 28, "#6e9269", "#7e9678", "#4a6d70", "#d0c294", "Leaf-filtered green surrounds legible shallow blue water and human faces.", {"sun": {"intensity": 2.2}, "grade": {"contrast": 0.98, "saturation": 0.94}, "fx": {"mist": 0.1}}),
    "BM12": ("bluehour", 4, 80, -8, "#6d796c", "#796d61", "#303c50", "#d5ad76", "Fractured dark memory softens into warm familial relief without flashing.", {"grade": {"contrast": 1.12, "saturation": 0.64}, "practical": {"lamp": 0.22}}),
    "BM13": ("summer_noon", 12, 190, 62, "#8a9a70", "#b0a182", "#5e7477", "#d9b17b", "Courtyard noon with shaded thresholds where gestures of kindness remain visible.", {"sun": {"intensity": 2.6}, "ambient": {"intensity": 0.76}, "grade": {"contrast": 0.99, "exposure": 0.98}}),
    "BM14": ("overcast", 10, 130, 25, "#8a8e70", "#96846d", "#555e5e", "#bfa37b", "Soft earth colours settle into sober grief; no victory red.", {"grade": {"saturation": 0.68, "contrast": 0.95}, "fx": {"dust": 0.14}}),
    "BM15": ("summer_noon", 14, 230, 52, "#888a64", "#a58c68", "#555d5c", "#bd9c6b", "Hard earthwork daylight, smoke during defense, and legible wounded care.", {"sky": {"cloudCover": 0.5, "haze": 0.35}, "grade": {"saturation": 0.75}, "fx": {"dust": 0.4, "mist": 0.12}}),
    "BM16": ("candle", 13, 220, 45, "#747568", "#766e60", "#303d46", "#c4a473", "Oppressive prison shade, dusty rupture, then sober open air.", {"interior": True, "practical": {"lamp": 0.5}, "grade": {"saturation": 0.6}, "fx": {"dust": 0.18}}),
    "BM17": ("night_room", 23, 300, -24, "#686e60", "#71695a", "#222e42", "#e3ba78", "Darkness and voices yield to harmless fire and communal light.", {"interior": True, "practical": {"lamp": 0.2}, "fx": {"motes": 0.15}, "grade": {"bloom": 0.12, "vignette": 0.3}}),
    "BM18": ("moonlit", 2, 310, -25, "#56645a", "#625f54", "#1f3044", "#c29c61", "Restrained blue nights with local campfire pools, preserving observation routes.", {"practical": {"lamp": 0.18, "torch": 0.32, "torchCount": 2}, "fog": {"density": 0.012}, "grade": {"vignette": 0.3}}),
    "BM19": ("golden", 8, 115, 18, "#8d9169", "#a48d6e", "#57646b", "#d4b384", "Dusty marching morning becomes a strained evening and a protective hearth.", {"fx": {"dust": 0.42}, "grade": {"saturation": 0.78}, "sun": {"intensity": 2.4}}),
    "BM20": ("clear_morning", 11, 160, 48, "#909775", "#b8aa8d", "#60757d", "#d6bc83", "An exposed pale wall against a broad atmospheric sky; keep speech gestures legible.", {"sky": {"haze": 0.25}, "grade": {"exposure": 0.98, "bloom": 0.04}, "fx": {"wind": 0.35}}),
    "BM21": ("overcast", 9, 120, 30, "#8c9e7e", "#aaa995", "#667b82", "#e4d6b3", "Expectant silence opens into warm human-scale holy light; white clothing retains detail.", {"sun": {"intensity": 1.7, "color": "#efe3c5"}, "ambient": {"intensity": 0.72}, "grade": {"exposure": 0.96, "contrast": 0.97, "saturation": 0.88, "bloom": 0.08}, "fx": {"mist": 0.06}}),
    "BM22": ("spring_morning", 10, 130, 35, "#91a582", "#afa98d", "#6a8082", "#e3cc9f", "Tender low contrast preserves faces, small hands, and white cloth in the healing circle.", {"sun": {"intensity": 2.0}, "ambient": {"intensity": 0.78}, "grade": {"exposure": 0.98, "contrast": 0.93, "saturation": 0.94, "bloom": 0.06, "vignette": 0.16}}),
    "BM23": ("clear_morning", 10, 135, 38, "#91a67b", "#a79d7c", "#647b7b", "#d0b479", "Balanced civic daylight changes gradually through disagreement, never an instant evil filter.", {"grade": {"contrast": 0.98, "saturation": 0.96}, "sun": {"intensity": 2.5}}),
    "BM24": ("overcast", 15, 245, 28, "#777b68", "#807969", "#414e52", "#af9472", "Ashen daylight, broken banners and layered smoke hold grief; rescue has no victory glow.", {"sky": {"top": "#626e70", "horizon": "#a5a493", "haze": 0.5}, "sun": {"intensity": 1.05, "color": "#d4c6a8"}, "grade": {"exposure": 0.96, "saturation": 0.42, "contrast": 1.1, "bloom": 0.03}, "fx": {"dust": 0.6, "mist": 0.42, "wind": 0.45}}),
    "BM25": ("winter_grey", 16, 245, 12, "#889087", "#9c9e98", "#52616e", "#c9aa78", "Chosen cold winter, a small warm record light, then silence.", {"grade": {"saturation": 0.52, "contrast": 0.96}, "practical": {"lamp": 0.25}, "fx": {"snow": 0.32, "wind": 0.18}}),
    "TX01": ("spring_morning", 9, 120, 28, "#91b578", "#9ca982", "#638184", "#dfc887", "Invented temporal headland: Eden abundance, bleached desert, then welcoming civic Zion.", {"grade": {"exposure": 1.02, "bloom": 0.12}, "fx": {"mist": 0.16}}),
    "TX02": ("fluorescent", 10, 135, 36, "#8eaa9d", "#a0aaa3", "#4e717a", "#dfc894", "Invented rescue workshop practicals lead into clear celestial docking light.", {"interior": True, "practical": {"lamp": 0.75, "lampColor": "#e4d2ae"}, "grade": {"exposure": 1, "saturation": 0.85, "bloom": 0.1}}),
    "TX03": ("clear_morning", 9, 115, 26, "#849b83", "#b7a488", "#557b88", "#d8bb85", "Invented temporal sea route: readable atlas, Gulf-like passage, imagined Levant landfall; no geography claim.", {"sky": {"haze": 0.25, "horizon": "#d6e1d8"}, "grade": {"contrast": 1, "exposure": 1}, "fx": {"mist": 0.1}}),
}


def record_info(chapter_id):
    profile, hour, azimuth, elevation, foliage, ground, shadow, accent, note, overrides = AUTHORED_RECORD_LOOKS[chapter_id]
    return dict(season="authored staging", time=hour, weather=note.split(";")[0], profile=profile,
                confidence="authored — not a dated weather or geography claim", mood=["ancient" if chapter_id.startswith("BM") else "speculative", "authored"],
                note=note, palette=(foliage, ground, shadow, accent),
                overrides=deep_merge({"sun": {"azimuth": azimuth, "elevation": elevation}}, overrides),
                interior=overrides.get("interior", False))


def chapter_preset(ch, info):
    authored = ch["id"] in AUTHORED_RECORD_LOOKS
    date_iso = "" if authored else ISO[ch["id"]]
    lat, lon, tz = (None, None, 0) if authored else GEO[ch["id"]]
    info = deep_merge(FALLBACK, info)
    preset = deep_merge(make_profile(info["profile"]), info["overrides"])
    if authored:
        az, alt = preset["sun"]["azimuth"], preset["sun"]["elevation"]
        phase = preset["sky"].get("moonPhase", 0.5)
    else:
        day = date.fromisoformat(date_iso)
        az, alt = solar_position(day, info["time"], lat, lon, tz)
        preset["sun"]["azimuth"] = info["overrides"].get("sun", {}).get("azimuth", az)
        preset["sun"]["elevation"] = info["overrides"].get("sun", {}).get("elevation", alt)
        phase = moon_phase(day)
    preset["sky"]["moonPhase"] = phase
    if preset["sky"].get("moon", 0) > 0 or preset["sun"]["elevation"] < 0:
        preset["sky"]["moon"] = max(preset["sky"].get("moon", 0.0), round(moon_illumination(phase), 3))
    if alt < 0 and preset["sun"]["intensity"] > 0.9:
        preset["sun"]["intensity"] = round(preset["sun"]["intensity"] * 0.18, 3)
    if alt >= 0 and preset["sun"]["intensity"] < 0.5 and not preset.get("interior"):
        preset["sun"]["intensity"] = 1.2
    preset["interior"] = info.get("interior", ch["id"] in INTERIOR_IDS)
    if ch["id"] in INTERIOR_CAMERAS:
        preset["camera"] = deep_merge(preset["camera"], INTERIOR_CAMERAS[ch["id"]])
    palette = preset["palette"]
    foliage, ground, shadow, accent = info["palette"]
    palette.update({"foliage": foliage, "ground": ground, "shadow": shadow, "accent": accent})
    preset["grade"]["shadowColor"] = shadow
    preset["groundWash"]["color"] = ground
    tags = list(dict.fromkeys(info["mood"] + [info["season"], info["weather"]]))
    return {
        "id": f"chapter-{ch['id']}",
        "kind": "chapter",
        "label": f"{ch['id']} · {info.get('title', ch['title'])}",
        "shortLabel": info.get("title", ch["title"]),
        "chapterId": ch["id"],
        "chapterType": "ancient" if ch["id"].startswith("BM") else "speculative" if ch["id"].startswith(("E", "TX")) else "documentary" if ch["id"].startswith("N") else "core",
        "authored": authored,
        "autoSun": not authored,
        "place": ch["place"],
        "date": date_iso,
        "dateLabel": ch["date"],
        "time": info["time"],
        "latitude": lat,
        "longitude": lon,
        "timezone": tz,
        "season": info["season"],
        "weather": info["weather"],
        "confidence": info["confidence"],
        "note": info["note"],
        "tags": tags,
        "swatch": [preset["sky"]["top"], preset["sky"]["horizon"], accent, foliage],
        "sky": preset["sky"],
        "sun": preset["sun"],
        "ambient": preset["ambient"],
        "fog": preset["fog"],
        "fill": preset["fill"],
        "rim": preset["rim"],
        "practical": preset["practical"],
        "grade": preset["grade"],
        "fx": preset["fx"],
        "palette": preset["palette"],
        "groundWash": preset["groundWash"],
        "mob": preset["mob"],
        "camera": preset["camera"],
        "interior": preset["interior"],
    }


def chapter_data():
    data = json.loads(CHAPTERS_PATH.read_text())
    presets = []
    for ch in data["chapters"]:
        info = record_info(ch["id"]) if ch["id"] in AUTHORED_RECORD_LOOKS else INFO[ch["id"]]
        presets.append(chapter_preset(ch, info))
    return presets


# --- Mood presets -----------------------------------------------------------
MOODS = [
    ("cheerful", "Cheerful open air", "High-key pastoral daylight with clean greens and a lifted horizon.", "golden", {"grade": {"exposure": 1.12, "contrast": 0.98, "saturation": 1.14, "temperature": 0.07, "vignette": 0.14, "grain": 0.03, "bloom": 0.2}, "fx": {"wind": 0.2, "godRays": 0.15}}, ["#9fc879", "#f2df9f", "#e8b85c"]),
    ("joyful", "Joyful high summer", "Full sun, generous colour, almost no shadow weight.", "summer_noon", {"grade": {"exposure": 1.16, "contrast": 0.96, "saturation": 1.2, "temperature": 0.09, "vignette": 0.10, "bloom": 0.28}, "fx": {"motes": 0.1}}, ["#86c07a", "#f7e7ae", "#e0a650"]),
    ("hopeful", "Hopeful dawn", "Cool shadows, a warm horizon, and a sky that is still opening.", "dawn", {"grade": {"exposure": 1.1, "contrast": 0.98, "saturation": 1.05, "temperature": 0.05, "vignette": 0.2, "bloom": 0.3}, "fx": {"mist": 0.08, "godRays": 0.35}}, ["#7ea6bf", "#f5c49a", "#d9b06b"]),
    ("sacred", "Sacred light", "A clean key from above, soft atmospheric bloom, and reverent shadow.", "spring_morning", {"sun": {"intensity": 2.4}, "grade": {"exposure": 1.08, "contrast": 1.0, "saturation": 0.98, "temperature": 0.01, "vignette": 0.24, "bloom": 0.48}, "fx": {"godRays": 0.65, "motes": 0.25}}, ["#d9d2a5", "#f6eccb", "#c7a35b"]),
    ("reverent", "Reverent interior", "Warm practicals inside a cool envelope; the room holds its breath.", "candle", {"grade": {"exposure": 1.16, "contrast": 1.05, "saturation": 0.94, "temperature": 0.07, "vignette": 0.48, "bloom": 0.22}}, ["#d8bc83", "#7d6046", "#e0b166"]),
    ("tender", "Tender intimacy", "Low contrast, warm skin, a single soft source, and room to breathe.", "winter_lamp", {"grade": {"exposure": 1.18, "contrast": 0.98, "saturation": 0.98, "temperature": 0.08, "vignette": 0.35, "grain": 0.05, "bloom": 0.18}}, ["#e7d3aa", "#b9783e", "#7b6a50"]),
    ("triumphant", "Triumphant gold", "A heroic low sun, strong rim, and a horizon that opens.", "golden", {"grade": {"exposure": 1.12, "contrast": 1.1, "saturation": 1.06, "temperature": 0.1, "vignette": 0.28, "bloom": 0.35}, "fx": {"godRays": 0.45}}, ["#f0c070", "#e08b4e", "#5d7e9d"]),
    ("nostalgic", "Nostalgic autumn", "Kodachrome warmth, softened contrast, and a little too much gold.", "golden", {"grade": {"exposure": 1.08, "contrast": 0.96, "saturation": 1.08, "temperature": 0.11, "tint": 0.02, "vignette": 0.32, "grain": 0.1, "bloom": 0.2}}, ["#d7a25c", "#e9c18b", "#8a6c4e"]),
    ("dreamy", "Dreamy haze", "Long bloom, low micro-contrast, and a horizon that dissolves.", "foggy", {"grade": {"exposure": 1.12, "contrast": 0.88, "saturation": 0.96, "temperature": 0.04, "vignette": 0.22, "grain": 0.04, "bloom": 0.45}, "fx": {"mist": 0.4, "motes": 0.2}}, ["#c7d4d0", "#eadcc4", "#d6b27a"]),
    ("peaceful", "Peaceful afternoon", "Even light, soft greens, no urgency.", "spring_morning", {"grade": {"exposure": 1.04, "contrast": 0.94, "saturation": 0.92, "temperature": 0.03, "vignette": 0.18, "grain": 0.03}}, ["#b7cf9a", "#e7e2c4", "#a7b98b"]),
    ("solemn", "Solemn grey", "Low-key, low-saturation, and a heavy horizon.", "overcast", {"grade": {"exposure": 0.98, "contrast": 1.02, "saturation": 0.62, "temperature": -0.02, "vignette": 0.42, "grain": 0.1}}, ["#8d9a99", "#c0c3b8", "#6e7770"]),
    ("mournful", "Mournful rain", "Cool rain light, soft edges, and faces turned slightly away.", "rain", {"grade": {"exposure": 0.96, "contrast": 0.98, "saturation": 0.6, "temperature": -0.05, "vignette": 0.45, "grain": 0.14}, "fx": {"rain": 0.55, "mist": 0.2}}, ["#6f8286", "#a9b2ad", "#52615e"]),
    ("tragic", "Tragic bleached pastoral", "Green world, ashen grade: beauty that has already been lost.", "golden", {"grade": {"exposure": 1.0, "contrast": 1.14, "saturation": 0.66, "temperature": 0.05, "tint": -0.03, "shadowColor": "#3b4446", "shadowStrength": 0.42, "vignette": 0.5, "grain": 0.15, "bloom": 0.1}, "fx": {"dust": 0.3, "mist": 0.1}}, ["#8f9d68", "#d9c9a8", "#a8432f"]),
    ("tense", "Tense heat", "Hard sun, compressed space, and a sky holding its breath.", "summer_noon", {"grade": {"exposure": 0.98, "contrast": 1.18, "saturation": 0.82, "temperature": 0.08, "vignette": 0.48, "grain": 0.12}, "fx": {"dust": 0.25, "wind": 0.1}}, ["#b9a76b", "#ddc89f", "#8b5a3a"]),
    ("ominous", "Ominous storm", "A bruised sky, a low key, and a horizon that is too dark.", "storm", {"grade": {"exposure": 0.9, "contrast": 1.22, "saturation": 0.6, "temperature": -0.04, "vignette": 0.58, "grain": 0.18}, "fx": {"rain": 0.35, "wind": 0.55, "lightning": 0.3}}, ["#3b4a4d", "#6f7771", "#8f4d36"]),
    ("scary", "Scary night", "Hard pools of light, black negative space, and an unstable sky.", "night", {"grade": {"exposure": 1.22, "contrast": 1.3, "saturation": 0.58, "temperature": -0.08, "vignette": 0.68, "grain": 0.2, "bloom": 0.2}, "fx": {"mist": 0.3, "wind": 0.4, "lightning": 0.1}}, ["#111827", "#44546a", "#b03d2a"]),
    ("horror", "Horror red", "A single red key, black fill, and no safe horizon.", "night", {"sun": {"color": "#c34a34", "intensity": 0.55}, "rim": {"color": "#ff5c3c", "intensity": 1.0}, "ambient": {"sky": "#3a1a1c", "ground": "#0d0908", "intensity": 0.18}, "grade": {"exposure": 1.1, "contrast": 1.32, "saturation": 0.72, "temperature": 0.12, "vignette": 0.7, "grain": 0.22, "bloom": 0.35}, "fx": {"embers": 0.2, "mist": 0.25}}, ["#2a0f12", "#7e2b24", "#d16a3d"]),
    ("gloomy", "Gloomy overcast", "Flat grey light, wet surfaces, no direct sun.", "overcast", {"grade": {"exposure": 0.95, "contrast": 0.9, "saturation": 0.5, "temperature": -0.04, "vignette": 0.4, "grain": 0.12}, "fx": {"mist": 0.2}}, ["#7d8888", "#b9beb5", "#5c6867"]),
    ("bleak", "Bleak winter", "Cold, almost colourless, with small warm human lights.", "winter_grey", {"grade": {"exposure": 0.95, "contrast": 0.9, "saturation": 0.34, "temperature": -0.07, "vignette": 0.4, "grain": 0.1}, "fx": {"snow": 0.35}}, ["#9aa6b3", "#c5cdd3", "#8b6a4d"]),
    ("oppressive", "Oppressive low ceiling", "A sky that sits on the shoulders; compressed value range.", "storm", {"sky": {"cloudCover": 1.0, "haze": 0.4}, "grade": {"exposure": 0.9, "contrast": 1.05, "saturation": 0.55, "temperature": -0.02, "vignette": 0.6, "grain": 0.16}, "fx": {"wind": 0.3, "dust": 0.15}}, ["#3f4b4b", "#70776d", "#6d5a44"]),
    ("claustrophobic", "Claustrophobic interior", "Close walls, one warm lamp, black corners.", "candle", {"camera": {"distance": 4.2, "fov": 58}, "grade": {"exposure": 1.2, "contrast": 1.18, "saturation": 0.9, "temperature": 0.09, "vignette": 0.66, "grain": 0.14}}, ["#6b4f38", "#241c18", "#d8a35c"]),
    ("supernatural", "Supernatural presence", "Cold light from nowhere, warm human edges, and floating motes.", "supernatural", {"grade": {"exposure": 1.1, "contrast": 1.06, "saturation": 0.88, "temperature": -0.04, "tint": 0.04, "vignette": 0.5, "grain": 0.08, "bloom": 0.62}, "fx": {"motes": 0.65, "godRays": 0.7, "mist": 0.15}}, ["#1b2b45", "#8fb2d1", "#d9c58d"]),
    ("ethereal", "Ethereal veil", "Pearl light, low contrast, a horizon without weight.", "supernatural", {"grade": {"exposure": 1.14, "contrast": 0.9, "saturation": 0.82, "temperature": -0.02, "vignette": 0.25, "bloom": 0.55}, "fx": {"motes": 0.5, "mist": 0.45, "godRays": 0.5}}, ["#b8c9cd", "#e9dfc8", "#b7a9c8"]),
    ("celestial", "Celestial", "Gold, rose, and cyan; light as substance rather than weather.", "celestial", {"grade": {"exposure": 1.06, "contrast": 0.98, "saturation": 1.14, "temperature": 0.04, "vignette": 0.18, "bloom": 0.62}, "fx": {"motes": 0.55, "godRays": 0.8}}, ["#f4e6b0", "#e8c9b8", "#a9d6e2"]),
    ("apocalyptic", "Apocalyptic ash", "Red-black sky, embers, and a world with the green taken out.", "apocalypse", {"grade": {"exposure": 0.92, "contrast": 1.28, "saturation": 0.7, "temperature": 0.12, "tint": -0.06, "vignette": 0.68, "grain": 0.22, "bloom": 0.35}, "fx": {"embers": 0.85, "dust": 0.7, "wind": 0.5}}, ["#2a1412", "#b24a2e", "#d06a3a"]),
    ("eerie", "Eerie liminal", "Too-even light, wrong colour temperature, and a space that feels watched.", "fluorescent", {"grade": {"exposure": 1.05, "contrast": 1.02, "saturation": 0.5, "temperature": -0.08, "tint": 0.05, "vignette": 0.5, "grain": 0.15, "bloom": 0.12}, "fx": {"mist": 0.15}}, ["#70807a", "#aebfb8", "#4e7777"]),
    ("uncanny", "Uncanny suburb", "Clean nostalgic colour with one impossible cold shadow.", "golden", {"grade": {"exposure": 1.06, "contrast": 1.02, "saturation": 1.02, "temperature": 0.08, "vignette": 0.3, "grain": 0.09}, "fx": {"motes": 0.08}}, ["#d3a25e", "#eac691", "#5c7c7e"]),
    ("industrial", "Industrial smoke", "Soot, brick, and a sun that has to push through.", "industrial", {"grade": {"exposure": 0.98, "contrast": 1.04, "saturation": 0.6, "temperature": 0.03, "vignette": 0.46, "grain": 0.16}}, ["#8b7358", "#a8a08e", "#6c7779"]),
    ("noir", "Gaslight noir", "Warm gas pools in a blue-black street.", "urban_gaslight", {"grade": {"exposure": 1.08, "contrast": 1.25, "saturation": 0.62, "temperature": 0.07, "vignette": 0.62, "grain": 0.18, "bloom": 0.28}}, ["#1b2230", "#d59a53", "#3f5068"]),
    ("pastoral", "Pastoral green", "Soft green, warm sun, a world that is cared for.", "spring_morning", {"grade": {"exposure": 1.05, "contrast": 0.98, "saturation": 1.1, "temperature": 0.04, "vignette": 0.2, "bloom": 0.18}}, ["#9fc27a", "#e9e3c2", "#c8a45e"]),
    ("stormy", "Stormy sea", "Cold wind, broken light, and a horizon in motion.", "storm", {"grade": {"exposure": 0.9, "contrast": 1.18, "saturation": 0.62, "temperature": -0.06, "vignette": 0.55, "grain": 0.18}, "fx": {"rain": 0.75, "wind": 0.75, "lightning": 0.45}}, ["#40545b", "#8a9691", "#5d7f92"]),
    ("feverish", "Feverish heat", "A sun too close, a colour too warm, and a horizon that wavers.", "summer_noon", {"grade": {"exposure": 1.04, "contrast": 1.12, "saturation": 1.08, "temperature": 0.14, "tint": 0.04, "vignette": 0.5, "grain": 0.14, "chromatic": 0.0015}, "fx": {"dust": 0.2, "mist": 0.2, "wind": 0.08}}, ["#c7a35c", "#e0b974", "#a85b3d"]),
    ("frozen", "Frozen blue", "Blue shadows, pale sun, and a world holding still.", "winter_grey", {"grade": {"exposure": 1.02, "contrast": 1.02, "saturation": 0.55, "temperature": -0.1, "tint": 0.03, "vignette": 0.4, "grain": 0.08}, "fx": {"snow": 0.55, "wind": 0.2}}, ["#9fb7cf", "#dce6ee", "#6d7f91"]),
    ("golden", "Golden hour", "Low amber key, long shadows, dust in the air.", "golden", {"grade": {"exposure": 1.08, "contrast": 1.08, "saturation": 1.04, "temperature": 0.1, "vignette": 0.36, "bloom": 0.24}, "fx": {"dust": 0.1, "godRays": 0.25}}, ["#f0b565", "#e58a52", "#5d7e9d"]),
    ("blue-hour", "Blue hour", "The after-sunset blue before the lamps take over.", "bluehour", {"grade": {"exposure": 1.16, "contrast": 1.08, "saturation": 0.78, "temperature": -0.05, "vignette": 0.46, "grain": 0.08, "bloom": 0.28}}, ["#354b6b", "#7f92a8", "#d0a56a"]),
    ("candlelit", "Candlelit", "One warm source, brown shadow, and faces close to the flame.", "candle", {"grade": {"exposure": 1.24, "contrast": 1.12, "saturation": 0.9, "temperature": 0.1, "vignette": 0.6, "bloom": 0.3}}, ["#d8bc83", "#5a3d2a", "#1d1711"]),
    ("torchlit", "Torchlit (stylised)", "Orange firelight and black air; explicitly a stylised staging, not a weather claim.", "night", {"practical": {"torch": 1.0, "torchCount": 8}, "grade": {"exposure": 1.18, "contrast": 1.22, "saturation": 0.94, "temperature": 0.13, "vignette": 0.62, "grain": 0.14, "bloom": 0.35}, "fx": {"embers": 0.35, "mist": 0.2, "wind": 0.2}}, ["#1a1210", "#e87833", "#ffc46a"]),
    ("moonlit", "Moonlit blue", "Silver-blue key, black-blue shadows, silver edges.", "moonlit", {"grade": {"exposure": 1.2, "contrast": 1.12, "saturation": 0.76, "temperature": -0.06, "vignette": 0.5, "grain": 0.1, "bloom": 0.3}}, ["#233a54", "#a7c8ff", "#3a4658"]),
    ("bloodlight", "Blood sunset", "A red horizon, a low dark key, and a world that feels wounded.", "dusk", {"sky": {"horizon": "#b33e2e", "top": "#301a1e", "cloudTint": "#692c2c"}, "sun": {"color": "#ff5c3c", "intensity": 1.2}, "grade": {"exposure": 1.0, "contrast": 1.24, "saturation": 0.9, "temperature": 0.13, "tint": -0.04, "vignette": 0.58, "grain": 0.16, "bloom": 0.28}}, ["#301a1e", "#b33e2e", "#6b2a26"]),
    ("sickly", "Sickly green", "A green cast, low contrast, and a sky that looks unwell.", "overcast", {"sky": {"horizon": "#b7bfa2", "top": "#71806e", "cloudTint": "#aab59a"}, "grade": {"exposure": 0.98, "contrast": 0.98, "saturation": 0.7, "temperature": -0.02, "tint": 0.08, "vignette": 0.42, "grain": 0.12}}, ["#7e8b6a", "#b7bfa2", "#9a8a55"]),
    ("verdant", "Verdant", "Deep chlorophyll green and wet air.", "spring_morning", {"grade": {"exposure": 1.02, "contrast": 1.02, "saturation": 1.18, "temperature": 0.01, "vignette": 0.24, "bloom": 0.16}, "fx": {"mist": 0.15}}, ["#6fa85f", "#b8d39a", "#4f7a4c"]),
    ("autumnal", "Autumnal", "Rust, ochre, and low gold.", "golden", {"grade": {"exposure": 1.04, "contrast": 1.05, "saturation": 1.08, "temperature": 0.1, "tint": 0.03, "vignette": 0.34, "grain": 0.08}}, ["#b9783e", "#d8a45e", "#6d5a42"]),
    ("wintry", "Wintry", "Blue-white, low sun, hard edges.", "winter_grey", {"grade": {"exposure": 1.04, "contrast": 1.08, "saturation": 0.5, "temperature": -0.08, "vignette": 0.38, "grain": 0.07}, "fx": {"snow": 0.4}}, ["#c7d4de", "#eaf1f6", "#7f92a5"]),
    ("vernal", "Vernal", "New green, cool air, high clouds.", "spring_morning", {"grade": {"exposure": 1.08, "contrast": 1.0, "saturation": 1.12, "temperature": 0.02, "vignette": 0.22, "bloom": 0.18}, "fx": {"godRays": 0.25}}, ["#a8cd7c", "#e5ebc8", "#d3b46b"]),
]


def mood_presets():
    out = []
    for key, label, desc, profile, patch, swatch in MOODS:
        base = make_profile(profile)
        fields = deep_merge(base, patch)
        # A mood is a lighting/atmosphere layer only; it does not move the
        # place, the date, or the computed moon phase.
        fields.pop("interior", None)
        fields.get("sky", {}).pop("moonPhase", None)
        out.append({
            "id": f"mood-{key}", "kind": "mood", "label": label, "shortLabel": label,
            "description": desc, "tags": [key, "mood"], "swatch": swatch, "fields": fields,
        })
    return out


WEATHERS = [
    ("clear", "Clear", "No cloud, maximum visibility, crisp shadows.", {"sky": {"cloudCover": 0.06, "haze": 0.05, "cloudTint": "#e8e6dc"}, "fx": {"rain": 0, "snow": 0, "dust": 0.02, "mist": 0, "wind": 0.08, "lightning": 0}, "fog": {"density": 0.005}}, ["#6f9bb5", "#e4dcc4", "#b7c9a0"]),
    ("partly-cloudy", "Partly cloudy", "Broken cloud, changing key, long shadows.", {"sky": {"cloudCover": 0.38, "haze": 0.1}, "fx": {"rain": 0, "wind": 0.18}}, ["#6f9bb5", "#e4dcc4", "#9fb48d"]),
    ("overcast", "Overcast", "Flat white-grey light, no direct sun.", {"sky": {"cloudCover": 0.9, "haze": 0.2, "cloudTint": "#c9cec6"}, "sun": {"intensity": 0.5}, "fx": {"rain": 0, "wind": 0.15}, "grade": {"contrast": 0.94, "saturation": 0.74}}, ["#7c878a", "#c4c8bf", "#8d9a90"]),
    ("fog", "Fog", "Low visibility, silver air, soft edges.", {"sky": {"cloudCover": 0.95, "haze": 0.55, "cloudTint": "#d4d7cc"}, "fog": {"color": "#c8cdc5", "density": 0.042}, "sun": {"intensity": 0.35}, "fx": {"mist": 0.5, "wind": 0.08}, "grade": {"contrast": 0.9, "saturation": 0.66}}, ["#c8cdc5", "#dde0d5", "#8a948e"]),
    ("mist", "Morning mist", "Ground-hugging mist with a low sun behind it.", {"fog": {"color": "#c9d3cc", "density": 0.028}, "fx": {"mist": 0.55, "godRays": 0.2}, "sun": {"intensity": 1.4}, "grade": {"contrast": 0.94, "saturation": 0.82}}, ["#b7c7c0", "#e5dfc9", "#8e9b7e"]),
    ("drizzle", "Drizzle", "Fine rain, low contrast, wet surfaces.", {"sky": {"cloudCover": 0.92, "haze": 0.25}, "fog": {"density": 0.02}, "fx": {"rain": 0.4, "mist": 0.15, "wind": 0.2}, "grade": {"contrast": 0.96, "saturation": 0.7}}, ["#75868a", "#aab2ae", "#6f7d72"]),
    ("rain", "Rain", "Steady rain, grey light, dark ground.", {"sky": {"cloudCover": 0.95, "haze": 0.28, "cloudTint": "#9da8a4"}, "fog": {"color": "#89958f", "density": 0.026}, "sun": {"intensity": 0.35}, "fx": {"rain": 0.72, "mist": 0.1, "wind": 0.35}, "grade": {"contrast": 1.0, "saturation": 0.66}}, ["#53656f", "#9fa9a4", "#65716a"]),
    ("downpour", "Downpour", "Heavy rain, veiled distance, water everywhere.", {"sky": {"cloudCover": 1, "haze": 0.35, "top": "#3d4b52", "horizon": "#828f8b"}, "fog": {"color": "#788681", "density": 0.035}, "sun": {"intensity": 0.22}, "fx": {"rain": 1.0, "mist": 0.2, "wind": 0.55}, "grade": {"contrast": 1.05, "saturation": 0.62}}, ["#3d4b52", "#828f8b", "#5e6b65"]),
    ("thunderstorm", "Thunderstorm", "Storm cell, lightning, wind, and sudden dark.", {"sky": {"cloudCover": 1, "haze": 0.4, "top": "#26343a", "horizon": "#5f6a67", "cloudTint": "#4d5b58"}, "fog": {"color": "#4d5754", "density": 0.03}, "sun": {"intensity": 0.3}, "fx": {"rain": 0.9, "wind": 0.75, "lightning": 0.55, "mist": 0.08}, "grade": {"contrast": 1.2, "saturation": 0.64}}, ["#26343a", "#5f6a67", "#b8a36a"]),
    ("snow", "Snow", "Snowfall, pale sky, muffled light.", {"sky": {"cloudCover": 0.9, "haze": 0.3, "top": "#8a99a8", "horizon": "#d8dfe4", "cloudTint": "#d7dde2"}, "fog": {"color": "#d6dee3", "density": 0.024}, "sun": {"intensity": 0.5}, "fx": {"snow": 0.7, "mist": 0.12, "wind": 0.15}, "grade": {"contrast": 0.98, "saturation": 0.6}}, ["#8a99a8", "#d8dfe4", "#b3c3cf"]),
    ("blizzard", "Blizzard", "Whiteout, horizontal snow, no horizon.", {"sky": {"cloudCover": 1, "haze": 0.55, "top": "#aebbc5", "horizon": "#e7edf1"}, "fog": {"color": "#e0e8ec", "density": 0.05}, "sun": {"intensity": 0.3}, "fx": {"snow": 1.0, "wind": 0.9}, "grade": {"contrast": 0.92, "saturation": 0.45}}, ["#aebbc5", "#e7edf1", "#c3d0d8"]),
    ("sleet", "Sleet", "Half-frozen rain, grey light, slick ground.", {"sky": {"cloudCover": 0.9, "top": "#6c7a84", "horizon": "#bcc4c7"}, "fog": {"density": 0.025}, "sun": {"intensity": 0.3}, "fx": {"rain": 0.5, "snow": 0.3, "wind": 0.4}, "grade": {"contrast": 1.0, "saturation": 0.55}}, ["#6c7a84", "#bcc4c7", "#85949b"]),
    ("dust", "Dust", "Airborne soil, a low brown horizon, and a sun with no edge.", {"sky": {"cloudCover": 0.5, "haze": 0.6, "top": "#9c8c72", "horizon": "#d3bd99", "cloudTint": "#c8b494"}, "fog": {"color": "#c0a985", "density": 0.03}, "sun": {"intensity": 1.6, "color": "#f0c98b"}, "fx": {"dust": 0.75, "wind": 0.5}, "grade": {"contrast": 1.02, "saturation": 0.78, "temperature": 0.08}}, ["#9c8c72", "#d3bd99", "#a8875b"]),
    ("ashfall", "Ashfall", "Falling ash, a red-black sky, and no green.", {"sky": {"cloudCover": 0.9, "haze": 0.6, "top": "#2a1b18", "horizon": "#8e4c35", "cloudTint": "#6a3a2d"}, "fog": {"color": "#6e4031", "density": 0.035}, "sun": {"intensity": 0.5, "color": "#e06a3a"}, "fx": {"dust": 0.8, "embers": 0.2, "wind": 0.35}, "grade": {"contrast": 1.2, "saturation": 0.58, "temperature": 0.1, "vignette": 0.6}}, ["#2a1b18", "#8e4c35", "#d6804c"]),
    ("embers", "Ember fall", "Burnt air, floating sparks, and a low red light.", {"sky": {"cloudCover": 0.75, "haze": 0.45, "top": "#211314", "horizon": "#8a3426"}, "fog": {"color": "#5f2b23", "density": 0.028}, "sun": {"intensity": 0.6, "color": "#ff6b3a"}, "fx": {"embers": 0.9, "dust": 0.3, "wind": 0.25}, "grade": {"contrast": 1.24, "saturation": 0.72, "temperature": 0.12, "vignette": 0.6, "bloom": 0.4}}, ["#211314", "#8a3426", "#f08b4a"]),
    ("wind", "High wind", "Fast air, moving cloth, sharp edges.", {"fx": {"wind": 0.9, "dust": 0.18}, "grade": {"contrast": 1.04, "saturation": 0.9}}, ["#9ab0b3", "#d8d7c8", "#7c8f7c"]),
    ("humid-haze", "Humid haze", "Warm wet air, soft distance, a sun with a halo.", {"sky": {"haze": 0.45, "cloudCover": 0.35}, "fog": {"density": 0.018}, "grade": {"contrast": 0.96, "saturation": 0.92, "temperature": 0.06}}, ["#8fa9b3", "#e1d8bd", "#91a06d"]),
    ("plague-haze", "Plague haze", "A sickly, low, particulate sky.", {"sky": {"cloudCover": 0.7, "haze": 0.5, "top": "#6f776a", "horizon": "#c0b89a", "cloudTint": "#aaa98e"}, "fog": {"color": "#b3ab8e", "density": 0.03}, "sun": {"intensity": 0.6, "color": "#d6c18a"}, "fx": {"mist": 0.3, "dust": 0.15}, "grade": {"contrast": 0.98, "saturation": 0.62, "tint": 0.05}}, ["#6f776a", "#c0b89a", "#9a8e68"]),
    ("industrial-smog", "Industrial smog", "Coal smoke, low sun, brick and soot.", {"sky": {"cloudCover": 0.85, "haze": 0.5, "top": "#5d6868", "horizon": "#a9a08e"}, "fog": {"color": "#8f8a7e", "density": 0.03}, "sun": {"intensity": 0.5, "color": "#d4b28b"}, "fx": {"dust": 0.25, "mist": 0.25, "wind": 0.15}, "grade": {"contrast": 1.02, "saturation": 0.58, "grain": 0.16}}, ["#5d6868", "#a9a08e", "#8a6d50"]),
    ("sea-fog", "Sea fog", "Salt-grey fog, flat light, no horizon.", {"sky": {"cloudCover": 1, "haze": 0.5, "top": "#8d9b9c", "horizon": "#cfd6d1"}, "fog": {"color": "#bdc8c5", "density": 0.045}, "sun": {"intensity": 0.3}, "fx": {"mist": 0.6, "wind": 0.2}, "grade": {"contrast": 0.88, "saturation": 0.55}}, ["#8d9b9c", "#cfd6d1", "#7f9497"]),
]


def weather_presets():
    out = []
    for key, label, desc, fields, swatch in WEATHERS:
        out.append({"id": f"weather-{key}", "kind": "weather", "label": label, "shortLabel": label,
                    "description": desc, "tags": [key, "weather"], "swatch": swatch, "fields": fields})
    return out


SEASONS = [
    ("spring", "Spring", "New green, cool air, high clouds, wet ground.", {"palette": {"foliage": "#8fbd6b", "ground": "#8c8a63", "accent": "#d3b46b"}, "groundWash": {"color": "#8fa268", "opacity": 0.05}, "grade": {"saturation": 1.06, "temperature": 0.02}, "fx": {"mist": 0.1}}, ["#a9c47a", "#d7e2c3", "#d8b267"]),
    ("summer", "Summer", "Deep green, high sun, dust, heavy air.", {"palette": {"foliage": "#6f8f4d", "ground": "#9a8a62", "accent": "#d0a253"}, "groundWash": {"color": "#8b8a5a", "opacity": 0.06}, "grade": {"saturation": 1.04, "temperature": 0.05}, "fx": {"dust": 0.08}}, ["#4f92bc", "#d9e6df", "#d0a253"]),
    ("autumn", "Autumn", "Ochre, rust, low gold, long shadows.", {"palette": {"foliage": "#b08a4f", "ground": "#8a7255", "accent": "#c06a3c"}, "groundWash": {"color": "#90704c", "opacity": 0.1}, "grade": {"saturation": 1.04, "temperature": 0.09, "contrast": 1.04}, "fx": {"wind": 0.3}}, ["#b9783e", "#d8a45e", "#6d5a42"]),
    ("winter", "Winter", "Blue-white, bare trees, low sun, snow.", {"palette": {"foliage": "#7f8d82", "ground": "#b8bec0", "accent": "#b56e43"}, "groundWash": {"color": "#c3ccd1", "opacity": 0.18}, "grade": {"saturation": 0.55, "temperature": -0.09}, "fx": {"snow": 0.45}}, ["#c7d4de", "#eaf1f6", "#7f92a5"]),
    ("year-without-summer", "1816 · Year Without a Summer", "Volcanic cold, failed crops, grey light, June frost.", {"sky": {"cloudCover": 0.8, "haze": 0.35, "top": "#707d80", "horizon": "#c2c8bd"}, "palette": {"foliage": "#8a9470", "ground": "#8a806b", "accent": "#b7a46e"}, "grade": {"saturation": 0.68, "temperature": -0.04, "contrast": 0.96}, "fx": {"mist": 0.2, "wind": 0.3, "snow": 0.08}}, ["#707d80", "#c2c8bd", "#8a9470"]),
    ("drought", "Drought", "Bleached grass, cracked earth, a white sky.", {"palette": {"foliage": "#b7a86a", "ground": "#b39a73", "accent": "#c08a4a"}, "groundWash": {"color": "#b09a72", "opacity": 0.16}, "grade": {"saturation": 0.78, "temperature": 0.1, "contrast": 1.08}, "fx": {"dust": 0.35, "wind": 0.2}}, ["#c7b27a", "#e0d4b0", "#b39a73"]),
    ("monsoon", "Monsoon", "Heavy green, saturated air, sudden rain.", {"palette": {"foliage": "#5f8f5a", "ground": "#6f6a4d", "accent": "#b98a4e"}, "groundWash": {"color": "#6d7d55", "opacity": 0.08}, "grade": {"saturation": 1.08, "temperature": 0.03}, "fx": {"rain": 0.5, "mist": 0.25, "wind": 0.35}}, ["#547c6b", "#aebf9c", "#b98a4e"]),
]


def season_presets():
    out = []
    for key, label, desc, fields, swatch in SEASONS:
        out.append({"id": f"season-{key}", "kind": "season", "label": label, "shortLabel": label,
                    "description": desc, "tags": [key, "season"], "swatch": swatch, "fields": fields})
    return out


TIMES = [
    ("pre-dawn", "Pre-dawn", "Before first light; blue-black sky, warm windows.", 4.5, {"sky": {"top": "#0b1424", "horizon": "#2a3a4f", "stars": 0.7, "cloudCover": 0.25}, "sun": {"intensity": 0.08}, "grade": {"exposure": 1.28, "saturation": 0.7}, "fx": {"mist": 0.25}}, ["#0b1424", "#2a3a4f", "#d6a15c"]),
    ("dawn", "Dawn", "First warm light on a cold sky.", 6.0, {"sky": {"top": "#4a607e", "horizon": "#f0b28a", "cloudCover": 0.3}, "grade": {"temperature": 0.07, "saturation": 0.92}, "fx": {"mist": 0.15}}, ["#4a607e", "#f0b28a", "#d9b06b"]),
    ("sunrise", "Sunrise", "Low direct sun, long shadows, waking world.", 7.0, {"sky": {"top": "#6a8fae", "horizon": "#f6c99a", "cloudCover": 0.25}, "grade": {"temperature": 0.09, "bloom": 0.3}, "fx": {"godRays": 0.3, "mist": 0.1}}, ["#6a8fae", "#f6c99a", "#e0b066"]),
    ("morning", "Morning", "Clear, cool, work-ready light.", 9.0, {"sky": {"top": "#6b9fc4", "horizon": "#dfe9df", "cloudCover": 0.2}, "grade": {"temperature": 0.02, "saturation": 1.02}, "fx": {"godRays": 0.08}}, ["#6b9fc4", "#dfe9df", "#a9c47a"]),
    ("noon", "Noon", "Overhead sun, short shadows, high contrast.", 12.0, {"sky": {"top": "#4f92bc", "horizon": "#d9e6df", "cloudCover": 0.22}, "grade": {"contrast": 1.06, "saturation": 1.02}, "fx": {"dust": 0.04}}, ["#4f92bc", "#d9e6df", "#d0a253"]),
    ("afternoon", "Afternoon", "Warm but still high; the start of the long slide.", 15.0, {"sky": {"top": "#6e9ab5", "horizon": "#e8dcc0", "cloudCover": 0.28}, "grade": {"temperature": 0.05}}, ["#6e9ab5", "#e8dcc0", "#c49a55"]),
    ("golden-hour", "Golden hour", "Low amber sun, dust, long shadows.", 18.0, {"sky": {"top": "#5d7e9d", "horizon": "#f2b781", "cloudCover": 0.3}, "sun": {"color": "#ffb365", "intensity": 2.45}, "grade": {"temperature": 0.1, "bloom": 0.24}, "fx": {"dust": 0.1, "godRays": 0.25}}, ["#5d7e9d", "#f2b781", "#ffb365"]),
    ("sunset", "Sunset", "The sun on the horizon; red-orange sky.", 19.5, {"sky": {"top": "#354b6b", "horizon": "#e18d6b", "cloudCover": 0.38}, "sun": {"color": "#ff9a62", "intensity": 1.1}, "grade": {"temperature": 0.09, "saturation": 0.92}, "fx": {"mist": 0.08}}, ["#354b6b", "#e18d6b", "#ff9a62"]),
    ("blue-hour", "Blue hour", "After sunset; blue sky, first lamps.", 20.5, {"sky": {"top": "#16243f", "horizon": "#6f7f95", "stars": 0.3, "cloudCover": 0.3}, "sun": {"intensity": 0.25}, "grade": {"exposure": 1.18, "temperature": -0.05}, "fx": {"mist": 0.1}}, ["#16243f", "#6f7f95", "#d6a15c"]),
    ("night", "Night", "Dark sky, moon and stars, practical lights.", 23.0, {"sky": {"top": "#050b18", "horizon": "#182437", "stars": 0.92, "moon": 0.9, "cloudCover": 0.15}, "sun": {"intensity": 0.5}, "grade": {"exposure": 1.25, "saturation": 0.72, "temperature": -0.08}, "fx": {"mist": 0.12}}, ["#050b18", "#182437", "#a9c7ff"]),
    ("midnight", "Midnight", "The deepest hour; only moon, fire, or lamp.", 0.5, {"sky": {"top": "#03060e", "horizon": "#111a26", "stars": 1.0, "moon": 0.8, "cloudCover": 0.1}, "sun": {"intensity": 0.4}, "grade": {"exposure": 1.3, "saturation": 0.65, "temperature": -0.1}, "fx": {"mist": 0.15}}, ["#03060e", "#111a26", "#9cb6d8"]),
    ("moonrise", "Moonrise", "A low moon, silver horizon, long blue shadows.", 21.0, {"sky": {"top": "#081426", "horizon": "#3b526b", "stars": 0.85, "moon": 1.0, "cloudCover": 0.12}, "sun": {"intensity": 0.8}, "grade": {"exposure": 1.22, "temperature": -0.06, "bloom": 0.3}, "fx": {"mist": 0.08}}, ["#081426", "#3b526b", "#bcd4ff"]),
]


def time_presets():
    out = []
    for key, label, desc, time, fields, swatch in TIMES:
        f = deepcopy(fields)
        f["time"] = time
        out.append({"id": f"time-{key}", "kind": "time", "label": label, "shortLabel": label,
                    "description": desc, "tags": [key, "time"], "swatch": swatch, "fields": f})
    return out


CAMERAS = [
    ("wide", "Wide establishing", "Show the place and the sky; the human is small.", {"distance": 26, "azimuth": 32, "elevation": 16, "fov": 54, "targetHeight": 1.6}),
    ("medium", "Medium", "A natural cinematic two-shot distance.", {"distance": 14, "azimuth": 35, "elevation": 14, "fov": 46, "targetHeight": 1.4}),
    ("close", "Close", "Faces, hands, and the practical light.", {"distance": 6.5, "azimuth": 30, "elevation": 10, "fov": 38, "targetHeight": 1.5}),
    ("low", "Low angle", "Sky weight and threat; the horizon tilts up.", {"distance": 12, "azimuth": 20, "elevation": -4, "fov": 50, "targetHeight": 1.0}),
    ("crane", "High crane", "A god's-eye view of the place and its approaches.", {"distance": 30, "azimuth": 40, "elevation": 42, "fov": 52, "targetHeight": 1.4}),
    ("over-shoulder", "Over the shoulder", "A witness position behind the protagonist.", {"distance": 4.8, "azimuth": 12, "elevation": 8, "fov": 44, "targetHeight": 1.55}),
    ("window", "Window frame", "From inside toward the light; silhouettes and glass.", {"distance": 3.6, "azimuth": 80, "elevation": 6, "fov": 46, "targetHeight": 1.6}),
    ("interior", "Interior corner", "A room-scale view with foreground depth.", {"distance": 5.8, "azimuth": 44, "elevation": 12, "fov": 52, "targetHeight": 1.35}),
    ("top", "Top-down", "Plan-view staging for blocking and shadows.", {"distance": 24, "azimuth": 0, "elevation": 78, "fov": 44, "targetHeight": 0.4}),
    ("dutch", "Dutch tilt", "Unease, imbalance, a world off its axis.", {"distance": 11, "azimuth": 28, "elevation": 12, "fov": 48, "targetHeight": 1.5, "roll": 8}),
]


def camera_presets():
    return [{"id": f"camera-{key}", "kind": "camera", "label": label, "shortLabel": label,
             "description": desc, "tags": [key, "camera"], "swatch": ["#2b3438", "#c49a52", "#8a9a7a"],
             "fields": {"camera": fields}} for key, label, desc, fields in CAMERAS]


EXTRA_CHAPTER = {
    "id": "chapter-30-stylized",
    "kind": "chapter",
    "label": "30 · Carthage — torchlit nightmare (stylised)",
    "shortLabel": "Carthage — torchlit nightmare",
    "chapterId": "30",
    "chapterType": "core",
    "stylized": True,
    "place": "Carthage Jail, Carthage, Illinois",
    "date": "1844-06-27",
    "dateLabel": "27 June 1844 · after dark (imagined staging)",
    "time": 22.0,
    "latitude": 40.416,
    "longitude": -91.136,
    "timezone": -6,
    "season": "summer",
    "weather": "storm, torchlight, imagined night",
    "confidence": "stylised — not a historical weather claim",
    "note": "A deliberately non-historical nightmare version for comparison: the same pastoral green world under a black storm sky, lit by torches and muzzle flashes. Period accounts place the attack in late afternoon and mention painted faces and firearms; torches and pitchforks are symbolic staging, not documented equipment. Keep the label visible whenever this preset is used.",
    "tags": ["tragic", "nightmare", "torchlit", "stylised", "summer"],
    "swatch": ["#120e0c", "#d96a2f", "#8f9d68"],
    "sky": {"top": "#06080b", "horizon": "#201917", "cloudTint": "#1b1817", "cloudCover": 0.92, "haze": 0.3, "stars": 0.05, "moon": 0.08, "moonPhase": 0.407},
    "sun": {"azimuth": 300, "elevation": -10, "color": "#6f7fa8", "intensity": 0.06, "shadows": 1.0},
    "ambient": {"sky": "#252a32", "ground": "#0b0b09", "intensity": 0.22},
    "fog": {"color": "#161412", "density": 0.03},
    "fill": {"azimuth": 300, "elevation": 20, "color": "#34445a", "intensity": 0.1},
    "rim": {"azimuth": 120, "elevation": 30, "color": "#ff8f3c", "intensity": 0.9},
    "practical": {"lamp": 0.0, "lampColor": "#ffcf8a", "torch": 1.0, "torchCount": 10, "torchColor": "#ff8a3c"},
    "grade": {"exposure": 0.98, "contrast": 1.22, "saturation": 0.66, "temperature": 0.04, "tint": -0.02, "lift": 0.0, "gamma": 1.0, "gain": 1.0, "shadowColor": "#2f2a26", "shadowStrength": 0.55, "vignette": 0.62, "grain": 0.18, "bloom": 0.24, "bloomThreshold": 0.7, "chromatic": 0.0, "letterbox": 0.06},
    "fx": {"rain": 0.3, "snow": 0.0, "dust": 0.15, "embers": 0.3, "motes": 0.0, "mist": 0.25, "groundFog": 0.15, "wind": 0.4, "lightning": 0.2, "godRays": 0.0},
    "palette": {"foliage": "#7f8a5c", "ground": "#7d735b", "shadow": "#2f2a26", "accent": "#c24f2f"},
    "groundWash": {"color": "#7d735b", "opacity": 0.12},
    "mob": {"enabled": True, "count": 18, "torches": 1.0, "pitchforks": 0.75, "guns": 0.9, "muzzle": 0.55, "silhouette": True, "distance": 7.5, "spread": 1.3},
    "camera": {"distance": 20, "azimuth": 38, "elevation": 8, "fov": 46, "targetHeight": 2.5, "targetX": 0, "targetZ": 0, "roll": 0},
    "interior": False,
}


OBJECTIVE_ARCS = {
    "03": {1: {"fx": {"mist": 0.12}}, 2: {"sun": {"color": "#fff0cd", "intensity": 2.7}, "fx": {"godRays": 0.55, "motes": 0.18}, "grade": {"bloom": 0.16}}},
    "04": {1: {"rim": {"color": "#dedfea", "intensity": 0.65}, "fx": {"motes": 0.25}, "grade": {"bloom": 0.2}}},
    "08": {1: {"practical": {"lamp": 0.95}, "grade": {"contrast": 1.02, "vignette": 0.26}}, 3: {"fx": {"motes": 0.15}, "practical": {"lamp": 1.05}}},
    "20": {6: {"fx": {"godRays": 0.6, "motes": 0.3}, "grade": {"bloom": 0.22, "exposure": 0.98}}},
    "22": {2: {"fx": {"dust": 0.45, "mist": 0.3}, "grade": {"saturation": 0.54}}},
    "23": {2: {"practical": {"lamp": 1.3}, "grade": {"contrast": 1.02, "saturation": 0.62}}},
    "30": {1: {"fx": {"dust": 0.36}, "grade": {"saturation": 0.4}}, 2: {"sky": {"haze": 0.58}, "fx": {"dust": 0.48, "mist": 0.28}, "palette": {"foliage": "#737b65", "strength": 0.72}, "grade": {"saturation": 0.32, "exposure": 0.84, "bloom": 0.03}}},
    "E8": {1: {"grade": {"exposure": 1.02, "bloom": 0.14, "contrast": 0.98}, "fx": {"godRays": 0.35}}, 2: {"grade": {"exposure": 1.04, "bloom": 0.18}, "rim": {"intensity": 0.55}}},
    "BM01": {2: {"practical": {"lamp": 0}, "fx": {"dust": 0.32}, "sun": {"elevation": 18}, "grade": {"saturation": 0.86}}},
    "BM02": {2: {"fog": {"density": 0.025}, "sky": {"horizon": "#ccd6cf"}}, 3: {"rim": {"color": "#f1e8cc", "intensity": 0.7}, "practical": {"lamp": 0.45, "lampColor": "#f1e8cc"}, "grade": {"exposure": 1.03, "bloom": 0.14}}},
    "BM03": {2: {"practical": {"lamp": 0.4}, "fill": {"intensity": 0.3}}, 3: {"grade": {"contrast": 1.04}, "fx": {"mist": 0.04}}},
    "BM04": {1: {"sun": {"elevation": 26, "intensity": 2.5}, "fx": {"mist": 0.08}}, 3: {"sun": {"elevation": 38, "color": "#ffe7b8"}, "sky": {"horizon": "#e2dcc4"}}},
    "BM05": {2: {"fx": {"rain": 0.45, "wind": 0.48, "lightning": 0}}, 3: {"sky": {"top": "#789497", "horizon": "#ced8ce", "cloudCover": 0.45}, "fx": {"rain": 0.08, "wind": 0.2, "lightning": 0}, "sun": {"intensity": 1.4}, "grade": {"contrast": 0.98, "saturation": 0.7}}},
    "BM06": {2: {"practical": {"lamp": 0.7, "lampColor": "#f2dfb0"}, "fx": {"motes": 0.2}}, 3: {"rim": {"intensity": 0.7, "color": "#f0ddb1"}, "grade": {"bloom": 0.16}}},
    "BM07": {3: {"interior": False, "sky": {"top": "#708d9c", "horizon": "#cdd8c9"}, "sun": {"intensity": 1.4, "elevation": 10}, "grade": {"contrast": 0.98, "exposure": 1.05}}},
    "BM08": {2: {"sky": {"top": "#677f95", "horizon": "#d8bf9d"}, "sun": {"elevation": 8, "intensity": 1.5}, "grade": {"saturation": 0.88}}, 3: {"sun": {"elevation": 16}, "fx": {"mist": 0.08}}},
    "BM09": {2: {"ambient": {"intensity": 0.7}, "grade": {"contrast": 0.96}}},
    "BM10": {2: {"fx": {"godRays": 0}, "sun": {"intensity": 0.4}, "practical": {"lamp": 0.75}}, 3: {"practical": {"lamp": 0.95}, "grade": {"contrast": 1.02, "vignette": 0.3}}},
    "BM11": {2: {"ambient": {"intensity": 0.74}, "fx": {"mist": 0.05}}},
    "BM12": {2: {"sky": {"top": "#6b8296", "horizon": "#d3c1a4"}, "sun": {"elevation": 12, "intensity": 1.5}, "grade": {"contrast": 0.98, "saturation": 0.85, "temperature": 0.04}}, 3: {"practical": {"lamp": 0.65}, "ambient": {"intensity": 0.65}}},
    "BM13": {2: {"ambient": {"intensity": 0.82}, "grade": {"contrast": 0.96}}},
    "BM14": {2: {"grade": {"saturation": 0.54}, "sky": {"haze": 0.32}}, 3: {"sun": {"intensity": 0.45}, "grade": {"saturation": 0.48}}},
    "BM15": {2: {"fx": {"dust": 0.6, "mist": 0.34}, "grade": {"saturation": 0.6}}, 3: {"fx": {"dust": 0.32, "mist": 0.24}, "grade": {"contrast": 1.01}, "ambient": {"intensity": 0.74}}},
    "BM16": {2: {"fx": {"dust": 0.7}, "grade": {"contrast": 1.05}}, 3: {"interior": False, "sky": {"top": "#819095", "horizon": "#c5c8bc"}, "sun": {"intensity": 1.4}, "ambient": {"intensity": 0.74}, "fx": {"dust": 0.3}, "grade": {"exposure": 1, "saturation": 0.66}}},
    "BM17": {1: {"practical": {"lamp": 0.65, "lampColor": "#f1bd78"}, "fx": {"motes": 0.25}}, 2: {"ambient": {"intensity": 0.65}, "practical": {"lamp": 1}, "grade": {"contrast": 1, "saturation": 0.86, "bloom": 0.14}}},
    "BM18": {2: {"fx": {"mist": 0.08}, "sun": {"intensity": 0.72}}, 3: {"practical": {"torch": 0.18}, "grade": {"saturation": 0.63}}},
    "BM19": {1: {"sun": {"elevation": 12, "color": "#e9bb86"}, "grade": {"saturation": 0.64}, "fx": {"dust": 0.5}}, 3: {"practical": {"lamp": 0.65}, "ambient": {"intensity": 0.6}, "fx": {"dust": 0.25}, "grade": {"contrast": 1}}},
    "BM20": {2: {"rim": {"intensity": 0.65}, "grade": {"contrast": 0.98}}, 3: {"fx": {"dust": 0.18}}},
    "BM21": {1: {"sky": {"cloudCover": 0.45, "horizon": "#ddd9c7"}, "sun": {"color": "#f5e2bd", "intensity": 2.1}, "rim": {"color": "#f4e0b9", "intensity": 0.6}, "fx": {"motes": 0.12, "godRays": 0.18}}, 3: {"grade": {"contrast": 0.95, "bloom": 0.1}, "ambient": {"intensity": 0.78}}},
    "BM22": {1: {"ambient": {"intensity": 0.82}, "grade": {"contrast": 0.92}}, 3: {"rim": {"intensity": 0.5}, "fx": {"motes": 0.08}}},
    "BM23": {2: {"grade": {"saturation": 0.86, "contrast": 1}, "sky": {"cloudCover": 0.28}}, 3: {"grade": {"saturation": 0.78, "contrast": 1.02}, "sky": {"cloudCover": 0.38}}},
    "BM24": {1: {"fx": {"dust": 0.72, "mist": 0.52}, "fog": {"density": 0.026}}, 2: {"ambient": {"intensity": 0.8}, "grade": {"contrast": 1.02, "saturation": 0.38}}, 3: {"fx": {"dust": 0.48, "mist": 0.4}, "grade": {"saturation": 0.32, "contrast": 1.02}}},
    "BM25": {1: {"practical": {"lamp": 0.6, "lampColor": "#d7b782"}}, 2: {"fx": {"snow": 0.22, "wind": 0.1}, "grade": {"contrast": 0.94}}, 3: {"practical": {"lamp": 0.15}, "fx": {"snow": 0.12}}},
    "TX01": {1: {"palette": {"foliage": "#8a8a70", "ground": "#aa9d86"}, "sky": {"top": "#b3ac99", "horizon": "#d5ccb5"}, "grade": {"saturation": 0.5}, "fx": {"dust": 0.45, "mist": 0}}, 3: {"palette": {"foliage": "#a1ba83"}, "sky": {"top": "#7ab2c5", "horizon": "#e7dfc8"}, "grade": {"saturation": 1, "bloom": 0.14}}},
    "TX02": {2: {"interior": False, "sky": {"top": "#7eaabe", "horizon": "#e0e1cd"}, "sun": {"intensity": 2.4}, "grade": {"saturation": 0.94, "tint": 0}}, 3: {"grade": {"bloom": 0.16, "contrast": 0.98}}},
    "TX03": {1: {"sky": {"haze": 0.34}, "fx": {"mist": 0.16}}, 3: {"sun": {"elevation": 18, "color": "#f0d1a2"}, "sky": {"horizon": "#dfd4b8"}, "grade": {"temperature": 0.05}}},
}


def build_cues(chapters):
    source = json.loads(CHAPTERS_PATH.read_text())["chapters"]
    entries = {}
    for chapter in source:
        arc = OBJECTIVE_ARCS.get(chapter["id"], {})
        accumulated = {}
        objectives = []
        for index, objective in enumerate(chapter["objectives"]):
            accumulated = deep_merge(accumulated, arc.get(index, {}))
            objectives.append({"objectiveId": objective["id"], "label": objective["label"],
                               "transitionSeconds": 2.5, "fields": deepcopy(accumulated)})
        events = {}
        if chapter["id"] == "30":
            events = {
                "carthage-assault": {"label": "Historical late-afternoon assault — smoke and ash", "fields": {"fx": {"dust": 0.65, "mist": 0.4, "lightning": 0}, "grade": {"saturation": 0.28, "exposure": 0.82}}},
                "carthage-stillness": {"label": "Grief and stillness", "fields": {"fx": {"dust": 0.28, "mist": 0.2, "wind": 0.04}, "grade": {"saturation": 0.25}}},
            }
        if chapter["id"] == "BM24":
            events["cumorah-withdrawal"] = {"label": "Preserve life and the record", "fields": {"fx": {"dust": 0.55, "mist": 0.48}, "grade": {"saturation": 0.3, "bloom": 0.02}}}
        entries[chapter["id"]] = {"presetId": f"chapter-{chapter['id']}", "objectives": objectives, "events": events}
    payload = {"schema": "zion-scene-cues/v1", "generatedBy": "tools/build_lighting_data.py", "chapters": entries}
    OUT_CUES.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {OUT_CUES} ({len(entries)} chapters)")


def build():
    chapters = chapter_data()
    moods = mood_presets()
    weather = weather_presets()
    seasons = season_presets()
    times = time_presets()
    cameras = camera_presets()
    ordered_chapters = []
    for item in chapters:
        ordered_chapters.append(item)
        if item["id"] == "chapter-30":
            ordered_chapters.append(EXTRA_CHAPTER)
    all_presets = ordered_chapters + moods + weather + seasons + times + cameras
    payload = {
        "schema": "zion-lighting-presets/v1",
        "generatedBy": "tools/build_lighting_data.py",
        "note": "Chapter presets are research-informed staging hypotheses, not exact historical weather records. Mood/weather/season/time presets are partial layers.",
        "counts": {
            "chapters": len(chapters) + 1,
            "moods": len(moods),
            "weather": len(weather),
            "seasons": len(seasons),
            "times": len(times),
            "cameras": len(cameras),
            "total": len(all_presets),
        },
        "presets": all_presets,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2) + "\n")
    build_cues(chapters)
    print(f"wrote {OUT_JSON} ({OUT_JSON.stat().st_size/1024:.1f} KB)")
    print(payload["counts"])
    if TEMPLATE.exists():
        html = TEMPLATE.read_text()
        rows = []
        for p in chapters:
            tag = '<span class="chip stylised">stylised</span>' if p.get("stylized") else ""
            rows.append(
                "<tr>"
                f"<td><b>{p['chapterId']}</b><br><span class='muted'>{p['shortLabel']}</span></td>"
                f"<td>{p['dateLabel']}<br><span class='muted'>{p['place']}</span></td>"
                f"<td>{p['season']}<br><span class='muted'>{p['weather']}</span></td>"
                f"<td>{p['time']:04.1f} h<br><span class='muted'>sun {p['sun']['elevation']:+.0f}° / az {p['sun']['azimuth']:.0f}°</span></td>"
                f"<td>{p['note']}</td>"
                f"<td><span class='swatches'><i style='background:{p['swatch'][0]}'></i><i style='background:{p['swatch'][1]}'></i><i style='background:{p['swatch'][2]}'></i><i style='background:{p['swatch'][3]}'></i></span><br><span class='muted'>{p['confidence']}</span></td>"
                "</tr>"
            )
        html = html.replace("<!--CHAPTER_ROWS-->", "\n".join(rows))
        html = html.replace("<!--COUNTS-->", f"{payload['counts']['total']} presets: {payload['counts']['chapters']} chapter/event looks, {payload['counts']['moods']} moods, {payload['counts']['weather']} weather states, {payload['counts']['seasons']} seasons, {payload['counts']['times']} times of day, {payload['counts']['cameras']} camera setups.")
        REPORT.write_text(html)
        print(f"wrote {REPORT} ({REPORT.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    build()
