"""Compare page regressions; optionally compare an actual supplied reference.

python3 docs/screenshots/duels/compare.py
python3 docs/screenshots/duels/compare.py --reference /path/to/reference.png

The pre-change Duels screenshot is NOT the user's design reference.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageEnhance

parser = argparse.ArgumentParser()
parser.add_argument('--reference', type=Path)
args = parser.parse_args()
out = Path(__file__).resolve().parent
results = {}
for name in ('home', 'auth'):
    before = Image.open(out / f'before-{name}.png').convert('RGB')
    after = Image.open(out / f'after-{name}.png').convert('RGB')
    bounds = ImageChops.difference(before, after).getbbox()
    results[name] = {'pixelIdentical': bounds is None, 'changedBounds': bounds}
(out / 'regression-results.json').write_text(json.dumps(results, indent=2) + '\n')

before = Image.open(out / 'before-duels.png').convert('RGB')
after = Image.open(out / 'desktop-1792x861.png').convert('RGB')
comparison = Image.new('RGB', (before.width + after.width, max(before.height, after.height) + 58), '#101a25')
comparison.paste(before, (0, 58))
comparison.paste(after, (before.width, 58))
draw = ImageDraw.Draw(comparison)
draw.text((25, 20), 'BEFORE — existing page (not the requested reference)', fill='white')
draw.text((before.width + 25, 20), 'AFTER — new /duels at 1792 x 861', fill='white')
comparison.save(out / 'before-after.png')

if args.reference:
    reference = Image.open(args.reference).convert('RGB')
    if reference.size != after.size:
        parser.error(f'Reference is {reference.size}; browser capture is {after.size}. Recapture at the exact reference dimensions before comparing. No automatic rescaling is performed.')
    reference.save(out / 'reference-original.png')
    side_by_side = Image.new('RGB', (after.width * 2, after.height))
    side_by_side.paste(reference, (0, 0))
    side_by_side.paste(after, (after.width, 0))
    side_by_side.save(out / 'reference-side-by-side.png')
    Image.blend(reference, after, .5).save(out / 'reference-overlay.png')
    ImageEnhance.Contrast(ImageChops.difference(reference, after)).enhance(3).save(out / 'reference-difference.png')
print(json.dumps(results, indent=2))
