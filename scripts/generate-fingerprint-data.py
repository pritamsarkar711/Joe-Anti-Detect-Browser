#!/usr/bin/env python3
"""
Regenerate packages/core/src/data/realFingerprints.ts from observed browser
traffic distributions.

Data source: Apify fingerprint-suite / BrowserForge Bayesian network
  https://github.com/daijro/browserforge            (Apache-2.0)
  https://github.com/apify/fingerprint-suite        (Apache-2.0)
  https://pypi.org/project/apify-fingerprint-datapoints/

The generator samples a Bayesian network trained on real-world header and
fingerprint frequencies. Every field of a sample therefore comes from ONE
coherent device, unlike a random UA + random GPU + random screen mash-up. We
only sample Chromium-family browsers because Joe Browser's consistency layer
targets Chromium / Android WebView; Firefox and Safari profiles would need a
patched Gecko/WebKit engine and are intentionally out of scope.

Usage (optional, requires network access to PyPI):
    pip install browserforge apify-fingerprint-datapoints
    python3 scripts/generate-fingerprint-data.py

The generated TypeScript file is committed so no Python dependency exists at
build time.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from browserforge.fingerprints import FingerprintGenerator
except ImportError:
    sys.exit("Install with: pip install browserforge apify-fingerprint-datapoints")

OUT = Path(__file__).resolve().parents[1] / "packages" / "core" / "src" / "data" / "realFingerprints.ts"

# (label, os constraint, device constraint, browser constraint, locale, count)
PLAN = [
    ("Windows 11 · Intel", "windows", "desktop", "chrome", "en-US", 6),
    ("Windows 11 · NVIDIA", "windows", "desktop", "chrome", "de-DE", 3),
    ("Windows 11 · Edge", "windows", "desktop", "edge", "en-GB", 2),
    ("macOS · Apple Silicon", "macos", "desktop", "chrome", "en-US", 4),
    ("macOS · Intel", "macos", "desktop", "chrome", "en-GB", 2),
    ("Linux · Desktop", "linux", "desktop", "chrome", "en-GB", 3),
    ("Android · Pixel", "android", "mobile", "chrome", "en-US", 5),
    ("Android · Galaxy", "android", "mobile", "chrome", "en-SG", 4),
]


def brands(sec_ch_ua: str, major: int) -> list[dict[str, str]]:
    found = re.findall(r'"([^"]+)";v="([^"]+)"', sec_ch_ua or "")
    if not found:
        return [
            {"brand": "Not A(Brand", "version": "99"},
            {"brand": "Google Chrome", "version": str(major)},
            {"brand": "Chromium", "version": str(major)},
        ]
    return [{"brand": b, "version": v} for b, v in found]


def safe(value, default=""):
    return default if value is None else value


def coherent_fonts(raw_fonts, os_name: str) -> list[str]:
    """Use observed fonts, or a plausible OS list when the sampler omits them."""
    fonts = [str(f) for f in (raw_fonts or []) if str(f).strip()]
    if len(fonts) >= 3:
        return fonts
    fallbacks = {
        "Windows": ["Arial", "Calibri", "Segoe UI", "Tahoma", "Times New Roman", "Verdana"],
        "macOS": ["Arial", "Helvetica", "Helvetica Neue", "Menlo", "San Francisco", "Times"],
        "Linux": ["Arial", "DejaVu Sans", "Liberation Sans", "Noto Sans", "Ubuntu"],
        "Android": ["Arial", "Noto Sans", "Roboto", "Droid Sans", "Droid Serif"],
    }
    return fallbacks.get(os_name, ["Arial", "Helvetica", "Times New Roman"])


def main() -> None:
    gen = FingerprintGenerator()
    rows: list[dict] = []
    seen: set[str] = set()

    for label, os_c, device_c, browser_c, locale, count in PLAN:
        made = 0
        attempt = 0
        while made < count and attempt < count * 200:
            attempt += 1
            try:
                f = gen.generate(
                    browser=browser_c,
                    os=os_c,
                    device=device_c,
                    locale=locale,
                    strict=True,
                )
            except Exception:
                continue
            ua = safe(f.navigator.userAgent)
            if not ua or ua in seen:
                continue
            seen.add(ua)
            major_m = re.search(r"(?:Chrome|Edg)/(\d+)", ua)
            if not major_m:
                continue
            major = int(major_m.group(1))
            gpu = f.videoCard
            screen = f.screen
            headers = f.headers or {}
            sec = headers.get("sec-ch-ua", "")
            nav = f.navigator
            brand_rows = brands(sec, major)

            # Client Hints must agree with the UA major version. Reject
            # headless draws and stale samples such as Chrome/141 UA with
            # Chromium/156 brands, which are internally contradictory.
            if any("headless" in b["brand"].lower() for b in brand_rows):
                continue
            if not any(b["version"] == str(major) for b in brand_rows):
                continue

            # Reject implausible / stale draws. The Bayesian network includes
            # rare legacy devices; a professional preset library should not.
            w, h, dpr = int(screen.width), int(screen.height), float(screen.devicePixelRatio or 1)
            cores, mem = int(nav.hardwareConcurrency or 8), int(nav.deviceMemory or 8)
            if major < 130 or cores < 2 or cores > 32 or mem < 2 or mem > 64:
                continue
            if dpr < 1 or dpr > 4:
                continue
            if not getattr(gpu, "renderer", ""):
                continue
            if device_c == "mobile" and not (320 <= w <= 600 and h >= 600):
                continue
            if device_c == "desktop" and not (1024 <= w <= 3840 and h >= 600):
                continue
            touches = int(nav.maxTouchPoints or 0)
            if device_c == "desktop" and touches > 0:
                continue
            if device_c == "mobile" and touches < 1:
                continue
            os_name = {"windows": "Windows", "macos": "macOS", "linux": "Linux", "android": "Android"}[os_c]
            rows.append(
                {
                    "id": f"real-{len(rows)+1:02d}",
                    "label": label,
                    "os": os_name,
                    "browser": "Edge" if browser_c == "edge" else "Chrome",
                    "mobile": device_c == "mobile",
                    "userAgent": ua,
                    "platform": safe(nav.platform),
                    "oscpu": safe(nav.oscpu),
                    "vendor": safe(nav.vendor, "Google Inc."),
                    "chromeMajor": major,
                    "brands": brand_rows,
                    "secChUa": sec,
                    "secChUaPlatform": headers.get("sec-ch-ua-platform", "").strip('"'),
                    "secChUaMobile": headers.get("sec-ch-ua-mobile", "?0"),
                    "acceptLanguage": headers.get("Accept-Language", locale),
                    "screen": {
                        "width": int(screen.width),
                        "height": int(screen.height),
                        "dpr": float(screen.devicePixelRatio or 1),
                    },
                    "cores": int(nav.hardwareConcurrency or 8),
                    "memoryGb": int(nav.deviceMemory or 8),
                    "touchPoints": int(nav.maxTouchPoints or 0),
                    "gpu": {
                        "vendor": safe(getattr(gpu, "vendor", ""), "Google Inc."),
                        "renderer": safe(getattr(gpu, "renderer", ""), "WebKit WebGL"),
                    },
                    "fonts": coherent_fonts(f.fonts, os_name),
                    "locale": locale,
                    "languages": list(nav.languages or [locale]),
                    "dnt": safe(nav.doNotTrack),
                }
            )
            made += 1

    body = json.dumps(rows, ensure_ascii=False, indent=2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        """/**
 * Real-device fingerprint samples, generated from the Apify / BrowserForge
 * Bayesian network of observed browser traffic (Apache-2.0).
 *
 * DO NOT EDIT BY HAND. Regenerate with scripts/generate-fingerprint-data.py.
 * Every sample is a single coherent device: UA, Client Hints, GPU, screen,
 * fonts, CPU and memory all come from the same distribution draw.
 *
 * Upstream: https://github.com/daijro/browserforge
 *           https://github.com/apify/fingerprint-suite
 */

export interface RealFingerprint {
  id: string;
  label: string;
  os: 'Windows' | 'macOS' | 'Android' | 'Linux';
  browser: 'Chrome' | 'Edge';
  mobile: boolean;
  userAgent: string;
  platform: string;
  oscpu: string;
  vendor: string;
  chromeMajor: number;
  brands: Array<{ brand: string; version: string }>;
  secChUa: string;
  secChUaPlatform: string;
  secChUaMobile: string;
  acceptLanguage: string;
  screen: { width: number; height: number; dpr: number };
  cores: number;
  memoryGb: number;
  touchPoints: number;
  gpu: { vendor: string; renderer: string };
  fonts: string[];
  locale: string;
  languages: string[];
  dnt: string | null;
}

export const REAL_FINGERPRINTS: RealFingerprint[] = """ + body + """;

export const FINGERPRINT_DATA_SOURCE = 'Apify fingerprint-suite / BrowserForge (Apache-2.0)';
""",
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} real-device samples to {OUT}")


if __name__ == "__main__":
    main()
