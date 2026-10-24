#!/usr/bin/env python3
"""Subset Source Han Serif for the wall's own Chinese copy, the way pake.run and hina.day do.

iOS has no Chinese serif, so the page ships Source Han Serif (Adobe, OFL) cut to
exactly the characters cats.html sets in the serif. The generated sponsor and
friend lists between the board markers use the system sans, so the daily
refresh never needs a new subset.

    python3 scripts/build-fonts.py          regenerate the subsets
    python3 scripts/build-fonts.py --check  verify every Chinese character in the copy is covered

Run the regenerate step after editing Chinese copy in cats.html: a missing
character silently falls back to the system font.
"""
import html
import os
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
FONT_DIR = root / "fonts"
PAGE = root / "cats.html"

# The 24 MB source OTFs are not committed; mole.fit keeps the same files.
CACHES = [
    pathlib.Path(os.environ["CATS_FONT_CACHE"]) if os.environ.get("CATS_FONT_CACHE") else None,
    root / ".fontcache",
    root.parent / "mole-mac" / "site" / ".fontcache",
]

# Regular for body text, SemiBold for 500 and up, matching the two @font-face rules in tailwind.css.
SUBSETS = [
    ("regular", "SourceHanSerifSC-Regular.otf"),
    ("semibold", "SourceHanSerifSC-SemiBold.otf"),
]

# Mirrors the unicode-range in tailwind.css; Latin stays with Charter.
CJK_RANGES = [
    (0x2E80, 0x2EFF), (0x3000, 0x303F), (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0xFE30, 0xFE4F), (0xFF00, 0xFFEF),
]

# The ?name= swap in cats.html can show this name in the lede.
EXTRA = "妙言"


def in_range(cp):
    return any(lo <= cp <= hi for lo, hi in CJK_RANGES)


def charset():
    text = PAGE.read_text(encoding="utf-8")
    text = re.sub(r"<!-- board:start -->.*?<!-- board:end -->", " ", text, flags=re.S)
    text = re.sub(r"<script.*?</script>|<style.*?</style>|<head>.*?</head>", " ", text, flags=re.S)
    painted = " ".join(re.findall(r'\b(?:alt|aria-label|title)="([^"]*)"', text))
    text = re.sub(r"<[^>]+>", " ", text)
    return {c for c in html.unescape(text + " " + painted + " " + EXTRA) if in_range(ord(c))}


def subset_path(weight):
    return FONT_DIR / f"cats-serif-sc-{weight}.woff2"


def source_dir():
    for path in CACHES:
        if path and all((path / src).exists() for _, src in SUBSETS):
            return path
    return None


def regenerate():
    cache = source_dir()
    if cache is None:
        print("missing Source Han Serif SC: put SourceHanSerifSC-Regular.otf and "
              "SourceHanSerifSC-SemiBold.otf in .fontcache "
              "(https://github.com/adobe-fonts/source-han-serif/releases)", file=sys.stderr)
        return 1
    FONT_DIR.mkdir(exist_ok=True)
    chars = charset()
    text_file = FONT_DIR / ".charset.txt"
    text_file.write_text("".join(sorted(chars)), encoding="utf-8")
    try:
        for weight, src in SUBSETS:
            out = subset_path(weight)
            subprocess.run([
                sys.executable, "-m", "fontTools.subset", str(cache / src),
                f"--text-file={text_file}",
                "--flavor=woff2",
                "--layout-features=kern,liga",
                "--no-hinting",
                "--desubroutinize",
                f"--output-file={out}",
            ], check=True)
            print(f"  fonts/{out.name}  {len(chars)} glyphs  {out.stat().st_size / 1024:.0f} KB")
    finally:
        text_file.unlink(missing_ok=True)
    return 0


def check():
    from fontTools.ttLib import TTFont

    needed = charset()
    failed = False
    for weight, _ in SUBSETS:
        out = subset_path(weight)
        if not out.exists():
            print(f"missing font subset: fonts/{out.name}", file=sys.stderr)
            failed = True
            continue
        covered = set()
        for table in TTFont(out)["cmap"].tables:
            covered.update(table.cmap)
        missing = {c for c in needed if ord(c) not in covered}
        if missing:
            print(f"font subset out of date: fonts/{out.name} is missing {len(missing)} character(s): "
                  f"{''.join(sorted(missing)[:20])}", file=sys.stderr)
            print("run: python3 scripts/build-fonts.py", file=sys.stderr)
            failed = True
    if failed:
        return 1
    print("cats-fonts-ok")
    return 0


if __name__ == "__main__":
    sys.exit(check() if "--check" in sys.argv[1:] else regenerate())
