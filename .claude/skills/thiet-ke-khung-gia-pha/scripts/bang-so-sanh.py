"""Puts 2–6 option pictures side by side, each with a big label (A, B, C…), into one image
so the user can compare and pick at a glance.

Usage: python3 -I bang-so-sanh.py out.png "A. Sơn mài" a.png "B. Men lam" b.png "C. Giấy dó" c.png
"""
import sys

from PIL import Image, ImageDraw, ImageFont

out, rest = sys.argv[1], sys.argv[2:]
pairs = list(zip(rest[0::2], rest[1::2]))
if not 2 <= len(pairs) <= 6:
    sys.exit('Need 2–6 "label" picture pairs')
H = 700
tiles = []
for label, path in pairs:
    im = Image.open(path).convert('RGB')
    im = im.resize((round(im.width * H / im.height), H))
    tiles.append((label, im))
cols = 3 if len(tiles) > 4 else len(tiles)
rows = (len(tiles) + cols - 1) // cols
cw = max(im.width for _, im in tiles)
pad, lab = 24, 70
sheet = Image.new('RGB', (cols * (cw + pad) + pad, rows * (H + lab + pad) + pad), '#f4f1ea')
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
except OSError:
    font = ImageFont.load_default()
for i, (label, im) in enumerate(tiles):
    x = pad + (i % cols) * (cw + pad) + (cw - im.width) // 2
    y = pad + (i // cols) * (H + lab + pad)
    draw.text((x, y + 8), label, fill='#1c1917', font=font)
    sheet.paste(im, (x, y + lab))
sheet.save(out, optimize=True)
print(out, sheet.size)
