#!/bin/bash
# Downloads a Google Font as a static TTF and cuts it to Latin + Vietnamese for the PDF export.
# Usage: bash phong-pdf.sh "Water Brush" 400 0 water-brush-400      (family, weight, italic 0/1, file key)
# Writes public/fonts/pdf/<key>.ttf (run from the repository root). Needs pyftsubset (fonttools).
set -euo pipefail
fam="$1"; w="$2"; it="$3"; key="$4"
q=$(echo "$fam" | sed 's/ /+/g')
if [ "$it" = 1 ]; then spec="ital,wght@1,$w"; else spec="wght@$w"; fi
# An empty User-Agent makes Google Fonts answer with plain .ttf links.
url=$(curl -s -A "" "https://fonts.googleapis.com/css2?family=$q:$spec" | grep -o "https://[^)]*\.ttf" | head -1)
[ -z "$url" ] && { echo "Không tìm thấy $fam $w (italic=$it) trên Google Fonts"; exit 1; }
tmp=$(mktemp -d)
curl -s -o "$tmp/full.ttf" "$url"
pyftsubset "$tmp/full.ttf" --output-file="public/fonts/pdf/$key.ttf" \
  --unicodes="U+0000-00FF,U+0102-0103,U+0110-0111,U+0128-0129,U+0131,U+0152-0153,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+1EA0-1EF9,U+2000-206F,U+20AB,U+2122,U+2190-2193,U+2212,U+FEFF,U+FFFD" \
  --layout-features='' --no-hinting
rm -rf "$tmp"
# Check every Vietnamese letter is really in the font (some script fonts lack ơ/ư or tones).
python3 -I - "public/fonts/pdf/$key.ttf" <<'EOF'
import sys
from fontTools.ttLib import TTFont
cmap = TTFont(sys.argv[1]).getBestCmap()
need = "aăâbcdđeêghiklmnoôơpqrstuưvxyAĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ"
missing = [c for c in need if ord(c) not in cmap]
print(sys.argv[1], 'thiếu: ' + ''.join(missing) if missing else 'đủ chữ tiếng Việt')
EOF
ls -la "public/fonts/pdf/$key.ttf"
