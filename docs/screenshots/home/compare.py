"""Build the explicitly requested visual comparison artifacts (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parent
reference = Image.open(root / 'reference-original.png').convert('RGB').resize((1711, 864), Image.Resampling.LANCZOS)
actual = Image.open(root / 'desktop-1711x864.png').convert('RGB')
reference.save(root / 'reference-1711x864.png')
comparison = Image.new('RGB', (3422, 904), '#141c24')
comparison.paste(reference, (0, 40))
comparison.paste(actual, (1711, 40))
draw = ImageDraw.Draw(comparison)
draw.text((20, 13), 'REFERENCE — scaled from 1765 x 891 to 1711 x 864', fill='white')
draw.text((1731, 13), 'IMPLEMENTATION — Chromium viewport 1711 x 864', fill='white')
comparison.save(root / 'side-by-side.png')
Image.blend(reference, actual, .5).save(root / 'overlay.png')
ImageChops.difference(reference, actual).save(root / 'difference.png')
