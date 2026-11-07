"""Make one layer of a Canva design stronger (or fainter) without touching the rest.

Export the design twice at the same size: with the layer (co-lop.png) and with the layer
hidden (opacity 0, khong-lop.png). The difference is exactly that layer, so
    out = co_lop + k * (co_lop - khong_lop)
makes it k (e.g. 0.2 = 20%) clearer; a negative k makes it fainter.

Usage: python3 -I lam-ro-lop.py co-lop.png khong-lop.png out.jpg 0.2 [jpeg-quality]
"""
import sys

import numpy as np
from PIL import Image

with_path, without_path, out_path, k = sys.argv[1:5]
quality = int(sys.argv[5]) if len(sys.argv) > 5 else 90
a = np.asarray(Image.open(with_path).convert('RGB'), dtype=np.float32)
b = np.asarray(Image.open(without_path).convert('RGB'), dtype=np.float32)
if a.shape != b.shape:
    sys.exit(f'Two exports differ in size: {a.shape} vs {b.shape}')
out = np.clip(a + float(k) * (a - b), 0, 255).astype(np.uint8)
img = Image.fromarray(out, 'RGB')
if out_path.lower().endswith(('.jpg', '.jpeg')):
    img.save(out_path, quality=quality, optimize=True, progressive=True)
else:
    img.save(out_path, optimize=True)
changed = float((np.abs(a - b).max(axis=2) > 4).mean())
print(f'{out_path}: layer covers {changed:.1%} of the sheet, strength x{1 + float(k):.2f}')
