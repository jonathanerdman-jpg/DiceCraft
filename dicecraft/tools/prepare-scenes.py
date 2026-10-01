"""Cuts the game's backdrops out of the Blockhead Odyssey website.

The website in this repository (the folders beside dicecraft/) carries its
pictures inline, as data: URIs inside each page. This finds the ones named
below by the page they are on and the start of their MD5, crops each to the
shape the game wants and writes it into assets/world/scenes/.

    python3 tools/prepare-scenes.py        (needs Pillow; dev-time only)

The output is committed, so nobody needs to run this to play.
"""
import base64
import hashlib
import io
import re
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
GAME = HERE.parent
SITE = GAME.parent
OUT = GAME / 'assets' / 'world' / 'scenes'

# scene file: (page the picture is on, md5 prefix of its first 5000 base64
# characters, width, height, horizontal focus 0..1, vertical focus 0..1)
WIDE = (1280, 800)
BAND = (720, 300)
CAMP = (960, 360)
SCENES = {
    'tome': ('explore-blockhead-odyssey', 'd5f68078c9', WIDE, 0.5, 0.5),
    'desk': ('explore-blockhead-odyssey', 'a5db684f5c', WIDE, 0.5, 0.5),
    'camp_reach': ('index', '840172e2b3', CAMP, 0.6, 0.45),
    'camp_downs': ('explore-blockhead-odyssey', '0a77410b8d', CAMP, 0.5, 0.4),
    'camp_mire': ('explore-blockhead-odyssey', '68b33a420b', CAMP, 0.5, 0.5),
    'camp_ironbacks': ('blockhead-odyssey-equine-breeding-system', '60a2aeef74', CAMP, 0.4, 0.5),
    'camp_spirelands': ('index', '6cc9f5a079', CAMP, 0.5, 0.45),
    'hall_reach': ('explore-blockhead-odyssey', '8e8aefcdf6', WIDE, 0.45, 0.5),
    'hall_downs': ('pillager-pirates', '5c7987986d', WIDE, 0.5, 0.5),
    'hall_mire': ('monthly-special-collection-quest', 'ceb0bfaa47', WIDE, 0.5, 0.5),
    'hall_ironbacks': ('index', 'cc2f5f32af', WIDE, 0.5, 0.5),
    'hall_spirelands': ('pillager-pirates', 'ee29532fdb', WIDE, 0.5, 0.45),
    'vault': ('index', '237341fc0e', BAND, 0.5, 0.55),
    'shaft': ('mobspawners', '6555c9bd94', BAND, 0.5, 0.5),
    'chapel': ('explore-blockhead-odyssey', '68b33a420b', BAND, 0.5, 0.55),
    'deepv': ('index', 'dce550041c', BAND, 0.5, 0.5),
    'city': ('blockhead-odyssey-metals', 'e500d0719e', BAND, 0.55, 0.5),
    'peaks': ('explore-blockhead-odyssey', '967a6af6fb', BAND, 0.5, 0.35),
    'town': ('index', '840172e2b3', BAND, 0.6, 0.4),
    'gate': ('pillager-pirates', 'ee29532fdb', BAND, 0.5, 0.4),
    'downs': ('explore-blockhead-odyssey', '7737125794', BAND, 0.5, 0.45),
    'wood': ('explore-blockhead-odyssey', '0a77410b8d', BAND, 0.5, 0.55),
    'spire': ('index', '6cc9f5a079', BAND, 0.5, 0.4),
    'fey': ('explore-blockhead-odyssey', '58fd7a9473', BAND, 0.5, 0.5),
}


def pictures(page):
    path = SITE / page / 'index.html' if page != 'index' else SITE / 'index.html'
    text = path.read_text(encoding='utf-8', errors='ignore')
    found = {}
    for m in re.finditer(r'data:image/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]{2000,})', text):
        b = m.group(1)
        key = hashlib.md5(b[:5000].encode()).hexdigest()[:10]
        found.setdefault(key, b)
    return found


def cover(img, size, fx, fy):
    w, h = size
    scale = max(w / img.width, h / img.height)
    big = img.resize((max(w, round(img.width * scale)), max(h, round(img.height * scale))), Image.LANCZOS)
    left = round((big.width - w) * fx)
    top = round((big.height - h) * fy)
    return big.crop((left, top, left + w, top + h))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cache = {}
    for name, (page, key, size, fx, fy) in SCENES.items():
        if page not in cache:
            cache[page] = pictures(page)
        data = cache[page].get(key)
        if not data:
            raise SystemExit(f'{name}: no picture {key} on {page}')
        img = Image.open(io.BytesIO(base64.b64decode(data))).convert('RGB')
        cover(img, size, fx, fy).save(OUT / f'{name}.jpg', quality=82, optimize=True, progressive=True)
        print(name, size)


if __name__ == '__main__':
    main()
