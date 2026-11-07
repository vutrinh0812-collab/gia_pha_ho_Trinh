"""Cut the title scroll out of a render on a known background (both exported from Canva)."""
import sys
import numpy as np
from PIL import Image
from collections import deque

board_path, bg_path, out_path = sys.argv[1:4]
L, T, W, H = (float(v) for v in sys.argv[4:8])
M = 20
x0, y0 = int(L) - M, int(T) - M
x1, y1 = int(L + W) + M, int(T + H) + M
I = np.asarray(Image.open(board_path).convert('RGB'), dtype=np.float32)[y0:y1, x0:x1]
B = np.asarray(Image.open(bg_path).convert('RGB'), dtype=np.float32)[y0:y1, x0:x1]
diff = np.abs(I - B).max(axis=2)
core = diff > 22
h, w = core.shape
# Pixels reachable from the crop border without crossing the scroll = outside.
outside = np.zeros_like(core)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if not core[y, x]:
            outside[y, x] = True; q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if not core[y, x] and not outside[y, x]:
            outside[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not outside[ny, nx] and not core[ny, nx]:
            outside[ny, nx] = True; q.append((ny, nx))
alpha = np.where(outside, np.clip(diff / 40.0, 0, 1), 1.0)
alpha[alpha < 0.08] = 0
a = alpha[..., None]
rgb = np.where(a > 0, (I - (1 - a) * B) / np.maximum(a, 1e-3), 0)
out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
# Trim to the opaque bounds.
ys, xs = np.nonzero(alpha > 0)
by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
Image.fromarray(out[by0:by1, bx0:bx1], 'RGBA').save(out_path, optimize=True)
print('board px box (in 3179x2245):', x0 + bx0, y0 + by0, bx1 - bx0, by1 - by0)
print('opaque share:', round(float((alpha > 0.99).mean()), 3))
