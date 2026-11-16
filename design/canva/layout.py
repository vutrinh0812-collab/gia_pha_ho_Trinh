#!/usr/bin/env python3
"""Dàn sơ đồ phả hệ cho tranh khắc đồng (bước 5 của brief Canva).

    python3 design/canva/layout.py <data> <out_dir> [--d3-rong 5] [--o-doc-tu 4] [--danh-sach-la 2] [--con-gai co|khong]

<data>: bản sao lưu của ứng dụng (format gia-pha-backup), hoặc file dạng {persons, unions, settings}
như design/proposals/data.js. Không sửa dữ liệu, chỉ đọc.
Xuất: layout.json (tấm chính + các tấm "Chi n"), report.json, preview_*.png.
Đơn vị px trên trang 7200 x 4800 (khoảng 67 px/cm ngang với khổ 107 cm).
"""
import json, sys, os, collections
from PIL import Image, ImageDraw, ImageFont

PW, PH = 7200, 4800
PX = PW / 100.0          # 1% bề ngang
PY = PH / 100.0          # 1% bề cao
Z4 = dict(x0=14 * PX, x1=86 * PX, y0=20 * PY, y1=90 * PY)
GAP_SIB = 0.6 * PX       # anh em
GAP_COUSIN = 1.2 * PX    # thêm giữa hai nhánh khác cha
GAP_ROW = 2.2 * PY       # khoảng nối dọc
LINE_W = 6
NAME_PX, SUB_PX = 29, 19
LH = 1.22                # hệ số dòng
PAD = 8                  # lề trong ô (text width = w - 16)
SAFETY = 1.08            # dự phòng sai khác font Canva
LIST_W, SPINE = 5 * PX, 28
FONT_DIR = '/usr/share/fonts/truetype/liberation/'
FB = ImageFont.truetype(FONT_DIR + 'LiberationSerif-Bold.ttf', NAME_PX)
FR = ImageFont.truetype(FONT_DIR + 'LiberationSerif-Regular.ttf', SUB_PX)

def tw(text, font):
    return font.getlength(text) * SAFETY

def wrap(text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if tw(t, font) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

CFG = dict(d3_rong=7.0, o_doc_tu=7, danh_sach_la=None, con_gai=None, doc_rong=2.2,
           sao=True, ten_khac=True, nam_pn=False, nhan=True, pn_dam=False,
           xung_ho=False, xuat_gia=True)
# sao: dấu ★ con trưởng. ten_khac: dòng tên thường gọi/tên khác. nam_pn: năm sinh (– năm mất) của vợ/chồng.
# nhan: chừa dải nhãn Đ.n ở góc trên ô. pn_dam: tên vợ/chồng cùng cỡ, cùng độ đậm với tên chính (kind 'sname').
GAP_PN = 8   # khoảng cách trước khối vợ/chồng
# xung_ho: đời 1 ghi 'Cụ ông/Cụ bà', đời 2 ghi 'Ông/Bà' trước tên. xuat_gia: dòng '(Xuất giá họ …)' của con gái.
XUNG_HO = {1: ('Cụ ông', 'Cụ bà'), 2: ('Ông', 'Bà')}
# d3_rong: bề rộng ô đời 2–3 (% trang). o_doc_tu: đời bắt đầu dùng ô dọc hẹp.
# danh_sach_la: None = đúng brief (nhà >6 con mới xếp danh sách); N = gom các con chưa có con cháu
#   thành danh sách dọc khi nhà có từ N con như vậy. con_gai: None = theo cài đặt của dữ liệu.

def hyphenate(word, font, width):
    """Ô dọc hẹp: từ quá dài (thường là tên nước ngoài) ngắt bằng gạch nối, không thu nhỏ chữ."""
    out = []
    while tw(word, font) > width and len(word) > 2:
        k = len(word) - 1
        while k > 1 and tw(word[:k] + '-', font) > width: k -= 1
        out.append(word[:k] + '-'); word = word[k:]
    return out + [word]

def gen_style(g):
    if g == 1: return dict(kind='thuy_to', w=9 * PX)
    if g >= CFG['o_doc_tu']: return dict(kind='doc_hep', w=CFG['doc_rong'] * PX, min_h=6 * PY)
    if g <= 3: return dict(kind='cuon_thu', w=CFG['d3_rong'] * PX)
    return dict(kind='chu_nhat', w=5 * PX)

# ---------------------------------------------------------------- dữ liệu
def _year(di):
    if not di: return None
    if di.get('solar'): return di['solar'][:4]
    l = di.get('lunar') or {}
    return str(l['year']) if l.get('year') else None

def _span(p):
    b, d = _year(p.get('birth')), _year(p.get('death'))
    dead = (p.get('death') or {}).get('isDeceased') is True
    bt = '?' if b is None else ('k. ' if (p.get('birth') or {}).get('approximate') else '') + b
    if not dead: return '' if b is None else bt
    dt = '?' if d is None else ('k. ' if p['death'].get('approximate') else '') + d
    return f"{bt} – {dt}"

def from_backup(d):
    """Chuyển bản sao lưu ứng dụng (format gia-pha-backup) sang cấu trúc chuẩn. Chỉ đọc, không sửa dữ liệu."""
    S = d['settings']; root = S['rootPersonId']
    P = {p['id']: p for p in d['persons']}
    U = {u['id']: u for u in d['unions']}
    kids = collections.defaultdict(list)
    for p in P.values():
        if p.get('parentUnionId') in U: kids[U[p['parentUnionId']]['bloodlinePersonId']].append(p['id'])
    gen, q = {root: 1}, [root]
    while q:
        x = q.pop(0)
        for u in U.values():
            if u['bloodlinePersonId'] == x and u.get('spousePersonId'): gen.setdefault(u['spousePersonId'], gen[x])
        for c in kids.get(x, []):
            if c not in gen: gen[c] = gen[x] + 1; q.append(c)
    lab = dict(huy='Húy', tu='Tự', hieu='Hiệu', thuong='Thường gọi', khac='Tên khác')
    persons = []
    for p in P.values():
        pu = U.get(p.get('parentUnionId'))
        par = P.get(pu['bloodlinePersonId']) if pu else None
        lun = p.get('deathAnniversaryLunar') or ((p.get('death') or {}).get('lunar') if (p.get('death') or {}).get('isDeceased') else None)
        persons.append(dict(id=p['id'], name=p['fullName'], male=p.get('gender') == 'male', blood=p.get('isBloodline', False),
            maternal=bool(par and par.get('gender') == 'female'), gen=gen.get(p['id']), order=p.get('birthOrder'),
            parentUnion=p.get('parentUnionId'), years=_span(p), deceased=(p.get('death') or {}).get('isDeceased') is True,
            other=' · '.join(f"{lab.get(k, k)} {v}" for k, v in (p.get('otherNames') or {}).items() if v),
            gio=f"{lun['day']}/{lun['month']}" if lun and lun.get('day') and lun.get('month') else None))
    unions = [dict(id=u['id'], b=u['bloodlinePersonId'], s=u.get('spousePersonId'), order=u.get('order')) for u in U.values()]
    unreach = [p['name'] for p in persons if p['gen'] is None]
    if unreach: raise SystemExit(f"Có người chưa nối vào cây: {unreach}")
    return dict(settings=S, rootId=root, persons=persons, unions=unions)

def load(path):
    s = open(path, encoding='utf8').read()
    if not s.lstrip().startswith('{'):
        s = s[s.index('{'):s.rstrip().rstrip(';').rindex('}') + 1]
    d = json.loads(s)
    return from_backup(d) if d.get('format') == 'gia-pha-backup' else d

def build_tree(d):
    P = {p['id']: p for p in d['persons']}
    U = {u['id']: u for u in d['unions']}
    show_mat = d.get('settings', {}).get('showMaternalDescendants', False) if CFG['con_gai'] is None else CFG['con_gai']
    spouses = collections.defaultdict(list)
    for u in sorted(U.values(), key=lambda u: u.get('order') or 0):
        if u.get('s'): spouses[u['b']].append(P[u['s']])
    kids = collections.defaultdict(list)
    for p in P.values():
        if not p.get('parentUnion') or not p['blood']: continue
        if p.get('maternal') and not show_mat: continue
        kids[U[p['parentUnion']]['b']].append(p['id'])
    for k in kids:
        kids[k].sort(key=lambda i: (P[i].get('order') or 99, i))
    root = d.get('rootId') or d['settings']['rootPersonId']
    return P, spouses, kids, root

def box_lines(p, P, spouses, kids, parent_kids):
    g = p['gen']
    sons = [c for c in parent_kids if P[c]['male']]
    star = '★ ' if CFG['sao'] and p['male'] and sons and sons[0] == p['id'] and len(parent_kids) > 1 else ''
    sp = spouses.get(p['id'], [])
    lines = []
    if CFG['xung_ho'] and g in XUNG_HO:
        ong, ba = XUNG_HO[g] if p['male'] else XUNG_HO[g][::-1]
        lines.append(('name', f"{ong}: {p['name']}"))
        if CFG['ten_khac'] and p.get('other'): lines.append(('sub', p['other']))
        lines.append(('sub', p.get('years') or '…'))
        for i, s in enumerate(sp, 1):
            lab = ba + (f" {i}" if len(sp) > 1 else '')
            if CFG['pn_dam']:
                lines.append(('sname', f"{lab}: {s['name'].strip()}"))
                lines.append(('sub', s.get('years') or '…'))
            else:
                lines.append(('sub', f"{lab}: {s['name'].strip()} ({s.get('years') or '…'})"))
        return lines
    if g == 1:
        lines.append(('name', f"Thủy tổ: {p['name']}"))
        if CFG['ten_khac'] and p.get('other'): lines.append(('sub', p['other']))
        lines.append(('sub', p.get('years') or '…'))
        for i, s in enumerate(sp, 1):
            other = f" – {s['other']}" if s.get('other') else ''
            lab = f"Bà {i}" if len(sp) > 1 else 'Bà'
            lines.append(('sub', f"{lab}: {s['name']}{other} ({s.get('years') or '…'})"))
        return lines
    lines.append(('name', star + p['name']))
    if CFG['ten_khac'] and p.get('other'): lines.append(('sub', p['other']))
    yrs = p.get('years') or '…'
    if p.get('deceased') and p.get('gio'): yrs += f" · Giỗ {p['gio']}"
    lines.append(('sub', yrs))
    if not p['male'] and CFG['xuat_gia']:
        ho = sp[0]['name'].split()[0] if sp else '…'
        lines.append(('sub', f"(Xuất giá họ {ho})"))
    for i, s in enumerate(sp, 1):
        lab = ('Chồng' if not p['male'] else 'Vợ') + (f" {i}" if len(sp) > 1 else '')
        y = f" ({s['years']})" if CFG['nam_pn'] and s.get('years') else ''
        if CFG['pn_dam']:
            lines.append(('sname', f"{lab}: {s['name'].strip()}"))
            if y: lines.append(('sub', y.strip()))
        else:
            lines.append(('sub', f"{lab}: {s['name'].strip()}{y}"))
    return lines

def measure(lines, style):
    """Trả (text_rows, height). Ô dọc hẹp: mỗi chữ (từ) một dòng."""
    inner = style['w'] - 2 * PAD
    rows, h = [], PAD + (SUB_PX * LH if CFG['nhan'] else 0)   # dải nhãn Đ.n ở góc trên trái
    if style['kind'] == 'thuy_to': h += 1.6 * PX   # chừa mái đình
    prev = None
    for kind, text in lines:
        f, size = (FB, NAME_PX) if kind in ('name', 'sname') else (FR, SUB_PX)
        if kind == 'sname' and prev != 'sname': h += GAP_PN
        prev = kind
        parts = [c for wd in text.split() for c in hyphenate(wd, f, inner)] if style['kind'] == 'doc_hep' else wrap(text, f, inner)
        for t in parts:
            if tw(t, f) > inner:
                rows.append((kind, t, 'TRAN'))
            else:
                rows.append((kind, t, ''))
            h += size * LH
    return rows, h + PAD

# ---------------------------------------------------------------- bố cục
class Node:
    __slots__ = ('id', 'gen', 'row', 'w', 'h', 'kids', 'list_kids', 'x', 'lines', 'stub', 'all_lines')

def make_nodes(P, spouses, kids, root, use_list):
    nodes = {}
    def rec(pid, sib):
        n = Node(); p = P[pid]
        n.id, n.gen, n.row, n.stub = pid, p['gen'], p['gen'] - 1, None
        st = gen_style(p['gen'])
        n.lines = box_lines(p, P, spouses, kids, sib)
        n.w = st['w']
        n.kids = list(kids.get(pid, []))
        n.list_kids = []
        n.all_lines = {c: box_lines(P[c], P, spouses, kids, kids[pid]) for c in kids.get(pid, [])}
        leaves = [c for c in n.kids if not kids.get(c)]
        if use_list and (len(n.kids) > 6 if CFG['danh_sach_la'] is None else len(leaves) >= CFG['danh_sach_la']) and leaves:
            n.list_kids = leaves
            n.kids = [c for c in n.kids if kids.get(c)]
        nodes[pid] = n
        for c in kids.get(pid, []): rec(c, kids[pid])
    rec(root, [root])
    return nodes

def row_geometry(nodes, y0=None):
    hmax = collections.defaultdict(float)
    for n in nodes.values():
        st = gen_style(n.gen)
        _, h = measure(n.lines, st)
        hmax[n.row] = max(hmax[n.row], h, st.get('min_h', 0))
    tops, y = {}, Z4['y0'] if y0 is None else y0
    r0 = min(hmax)
    for r in range(r0, max(hmax) + 1):
        tops[r] = y; y += hmax.get(r, 0) + GAP_ROW
    return tops, dict(hmax)

LIST_STYLE = dict(kind='danh_sach', w=LIST_W)

def list_item(n, c):
    """Ô trong danh sách dọc: cùng nội dung như ô thường, rộng 5%, cao theo nội dung."""
    return measure(n.all_lines[c], dict(kind='danh_sach', w=LIST_W))

def layout(nodes, root, tops, hmax):
    """Reingold–Tilford theo đường viền (contour) từng hàng. Trả vị trí tương đối."""
    def rows_covered(r0, height):
        y_end = tops[r0] + height
        return [r for r in tops if r >= r0 and tops[r] < y_end] or [r0]
    def rec(pid):
        n = nodes[pid]
        subs = [rec(c) for c in n.kids]
        blocks = []   # (contour, positions, is_list)
        for c, (cont, pos) in zip(n.kids, subs): blocks.append((cont, pos))
        if n.list_kids:
            r0 = n.row + 1
            if r0 not in tops: tops[r0] = tops[n.row] + hmax[n.row] + GAP_ROW
            H = sum(list_item(n, c)[1] + 16 for c in n.list_kids)
            wblk = SPINE + LIST_W
            cont = {r: (-wblk / 2, wblk / 2) for r in rows_covered(r0, H)}
            blocks.append((cont, {('LIST', pid): 0.0}))
        cont = {n.row: (-n.w / 2, n.w / 2)}
        pos = {pid: 0.0}
        if not blocks: return cont, pos
        placed, acc, centers = {}, {}, []
        for i, (bc, bp) in enumerate(blocks):
            if i == 0: off = 0.0
            else:
                off = -1e18
                for r, (l, _) in bc.items():
                    if r in acc:
                        gap = GAP_SIB if r == n.row + 1 else GAP_SIB + GAP_COUSIN
                        off = max(off, acc[r][1] - l + gap)
                if off == -1e18: off = centers[-1] + 1
            for r, (l, rr) in bc.items():
                a = acc.get(r); acc[r] = (min(a[0], l + off) if a else l + off, max(a[1], rr + off) if a else rr + off)
            for k, v in bp.items(): placed[k] = v + off
            centers.append(off)
        mid = (centers[0] + centers[-1]) / 2
        for k, v in placed.items(): pos[k] = v - mid
        for r, (l, rr) in acc.items(): cont[r] = (l - mid, rr - mid)
        return cont, pos
    return rec(root)

def subtree_ids(nodes, pid):
    out, st = [], [pid]
    while st:
        x = st.pop(); out.append(x); n = nodes[x]; st += n.kids + n.list_kids
    return out

def place(nodes, root, P, y0=None):
    tops, hmax = row_geometry({k: nodes[k] for k in subtree_ids(nodes, root)}, y0)
    cont, pos = layout(nodes, root, tops, hmax)
    minx = min(l for l, _ in cont.values()); maxx = max(r for _, r in cont.values())
    width = maxx - minx
    cx = (Z4['x0'] + Z4['x1']) / 2 - (minx + maxx) / 2
    return dict(tops=tops, hmax=hmax, pos=pos, cx=cx, width=width)

# ---------------------------------------------------------------- xuất
def dan_rong_hang(nodes, geo, row, x0, x1, gap_in, gap_nhom, cho_trong=1):
    """Dãn một hàng (thường là đời cuối): giữ thứ tự, mỗi nhà một cụm, các con cách nhau gap_in,
    chừa thêm `cho_trong` ô trống bên phải mỗi cụm để sau này điền thêm cháu; cụm cố đứng dưới cha."""
    cx, pos = geo['cx'], geo['pos']
    groups = []
    for pid, n in nodes.items():
        kids = [c for c in n.kids if c in pos and nodes[c].row == row]
        if kids and pid in pos: groups.append((cx + pos[pid], kids))
    groups.sort(key=lambda g: g[0])
    out = []
    for px, kids in groups:
        w = nodes[kids[0]].w; s = w + gap_in
        span = (len(kids) - 1) * s + w; R = span + cho_trong * s
        out.append([px - span / 2, span, R, s, w, kids])
    for i, g in enumerate(out):          # quét trái → phải: không chồng nhau
        if i: g[0] = max(g[0], out[i - 1][0] + out[i - 1][2] + gap_nhom)
        g[0] = max(g[0], x0)
    for i in range(len(out) - 1, -1, -1):  # quét phải → trái: không vượt lề phải
        lim = x1 if i == len(out) - 1 else out[i + 1][0] - gap_nhom
        g = out[i]; g[0] = min(g[0], lim - g[2])
    if out:   # dời cả hàng để các cụm lệch trái/phải đều quanh cha
        lech = sum(g[0] + g[1] / 2 - px for g, (px, _) in zip(out, groups)) / len(out)
        d = max(x0 - out[0][0], min(x1 - (out[-1][0] + out[-1][2]), -lech))
        for g in out: g[0] += d
    for L, span, R, s, w, kids in out:
        for k, c in enumerate(kids): pos[c] = L + k * s + w / 2 - cx
    return out

def emit(nodes, root, geo, P, chi_of):
    tops, hmax, pos, cx = geo['tops'], geo['hmax'], geo['pos'], geo['cx']
    boxes, segs = [], []
    def seg(x1, y1, x2, y2): segs.append(dict(x1=round(x1), y1=round(y1), x2=round(x2), y2=round(y2), w=LINE_W))
    for pid in subtree_ids(nodes, root):
        if pid not in pos: continue   # con trong danh sách dọc: vẽ ở khối danh sách bên dưới
        n = nodes[pid]; p = P[pid]
        x = cx + pos[pid]; y = tops[n.row]; h = hmax[n.row]
        st = gen_style(n.gen)
        rows, _ = measure(n.lines, st)
        b = dict(id=pid, gen=n.gen, kind=st['kind'], x=round(x - n.w / 2), y=round(y), w=round(n.w), h=round(h),
                 text_w=round(n.w - 16), label=f"Đ.{n.gen}", deceased=bool(p.get('deceased')),
                 female=not p['male'], dashed=not p['male'], lines=[dict(style=k, text=t) for k, t, _ in rows],
                 overflow=[t for _, t, f in rows if f])
        if pid in chi_of: b['see_chi'] = chi_of[pid]
        boxes.append(b)
        bottom = y + h
        if n.kids:
            cy = tops[n.row + 1]; mid = cy - GAP_ROW / 2
            xs = [cx + pos[c] for c in n.kids]
            seg(x, bottom, x, mid)
            lo, hi = min(xs + [x]), max(xs + [x])
            if hi > lo: seg(lo, mid, hi, mid)
            for xc in xs: seg(xc, mid, xc, cy)
        if n.list_kids:
            cy = tops[n.row + 1]; mid = cy - GAP_ROW / 2
            bx = cx + pos[('LIST', pid)] - (SPINE + LIST_W) / 2
            seg(x, bottom, x, mid); seg(min(x, bx), mid, max(x, bx), mid)
            yy = cy
            for i, c in enumerate(n.list_kids):
                cp = P[c]; rows, lih = list_item(n, c)
                boxes.append(dict(id=c, gen=cp['gen'], kind='danh_sach', x=round(bx + SPINE), y=round(yy), w=round(LIST_W),
                                  h=round(lih), text_w=round(LIST_W - 16), label=f"Đ.{cp['gen']}", deceased=bool(cp.get('deceased')),
                                  female=not cp['male'], dashed=not cp['male'], lines=[dict(style=k, text=t) for k, t, _ in rows],
                                  overflow=[t for _, t, f in rows if f]))
                seg(bx, yy + lih / 2, bx + SPINE, yy + lih / 2)
                last = yy + lih / 2; yy += lih + 16
            seg(bx, mid, bx, last)
    return boxes, segs

def check(boxes, segs):
    errs = []
    def inside(b): return b['x'] >= Z4['x0'] and b['x'] + b['w'] <= Z4['x1'] and b['y'] >= Z4['y0'] and b['y'] + b['h'] <= Z4['y1']
    for b in boxes:
        if not inside(b): errs.append(f"ra ngoài Z4: {b['id']}")
        if b['overflow']: errs.append(f"chữ tràn ô: {b['id']} {b['overflow']}")
    bs = sorted(boxes, key=lambda b: b['x'])
    for i, a in enumerate(bs):
        for b in bs[i + 1:]:
            if b['x'] >= a['x'] + a['w']: break
            if a['y'] < b['y'] + b['h'] and b['y'] < a['y'] + a['h']: errs.append(f"chồng ô: {a['id']} / {b['id']}")
    for s in segs:
        x0, x1 = sorted((s['x1'], s['x2'])); y0, y1 = sorted((s['y1'], s['y2']))
        if x0 == x1: x0 -= LINE_W / 2; x1 += LINE_W / 2   # nét dọc: tính bề dày theo ngang
        else: y0 -= LINE_W / 2; y1 += LINE_W / 2          # nét ngang: tính bề dày theo dọc
        for b in boxes:   # chạm mép ô (điểm đầu/cuối) là hợp lệ; cắt vào trong ô thì lỗi
            if x0 < b['x'] + b['w'] - 1 and b['x'] + 1 < x1 and y0 < b['y'] + b['h'] - 1 and b['y'] + 1 < y1:
                errs.append(f"đường nối cắt ô {b['id']}")
        if not (Z4['x0'] <= x0 and x1 <= Z4['x1'] and Z4['y0'] <= y0 and y1 <= Z4['y1']): errs.append('đường nối ra ngoài Z4')
    return errs

def preview(boxes, segs, path, title, titles=()):
    k = 0.4
    fn = ImageFont.truetype(FONT_DIR + 'LiberationSerif-Bold.ttf', int(NAME_PX * k))
    fs = ImageFont.truetype(FONT_DIR + 'LiberationSerif-Regular.ttf', int(SUB_PX * k))
    im = Image.new('RGB', (int(PW * k), int(PH * k)), '#5A3816'); dr = ImageDraw.Draw(im)
    m = 3
    dr.rectangle([PW * m / 100 * k, PH * m / 100 * k, PW * (1 - m / 100) * k, PH * (1 - m / 100) * k], outline='#A8742E', width=2)
    dr.rectangle([Z4['x0'] * k, Z4['y0'] * k, Z4['x1'] * k, Z4['y1'] * k], outline='#2E1A0B', width=2)
    for s in segs: dr.line([s['x1'] * k, s['y1'] * k, s['x2'] * k, s['y2'] * k], fill='#D4A94F', width=max(1, int(LINE_W * k)))
    fill = dict(thuy_to='#8E1B14', cuon_thu='#A8742E', chu_nhat='#5A3816', doc_hep='#5A3816', danh_sach='#5A3816')
    for b in boxes:
        x0, y0 = b['x'] * k, b['y'] * k
        dr.rectangle([x0, y0, x0 + b['w'] * k, y0 + b['h'] * k], fill=fill[b['kind']], outline='#D4A94F' if b['dashed'] else '#F3D98B', width=1)
        dr.text((x0 + 2, y0 + 1), b['label'] + (' •' if b['deceased'] else ''), fill='#D4A94F', font=fs)
        y = y0 + (PAD + SUB_PX * LH) * k + (1.6 * PX * k if b['kind'] == 'thuy_to' else 0)
        for ln in b['lines']:
            f = fn if ln['style'] == 'name' else fs
            t = ln['text']; wt = f.getlength(t)
            dr.text((x0 + (b['w'] * k - wt) / 2 if b['kind'] != 'danh_sach' else x0 + 4, y), t, fill='#F3D98B', font=f)
            y += (NAME_PX if ln['style'] == 'name' else SUB_PX) * LH * k
        if b.get('see_chi'): dr.text((x0, y0 + b['h'] * k + 2), f"→ Xem Chi {b['see_chi']}", fill='#F3D98B', font=fs)
    for t in titles: dr.text((t['x'] * k, t['y'] * k), t['text'], fill='#F3D98B', font=fn)
    dr.text((20, 10), title, fill='#F3D98B', font=fn)
    im.save(path)

def run(d, out):
    """Anh em xếp trái→phải theo thứ tự sinh (nhánh trưởng bên trái).
    Nén lần lượt a → b → c, dừng ngay khi sơ đồ vừa 72% bề ngang."""
    P, spouses, kids, root = build_tree(d)
    limit = Z4['x1'] - Z4['x0']
    pct = lambda w: round(w / PW * 100, 1)
    all_ids = subtree_ids(make_nodes(P, spouses, kids, root, False), root)
    per_gen = collections.Counter(P[i]['gen'] for i in all_ids)
    report = dict(nguon=d.get('settings', {}).get('title'), cau_hinh=dict(CFG), so_doi=max(per_gen),
                  so_nguoi_trong_du_lieu=len(P), so_o=len(all_ids), o_theo_doi=dict(sorted(per_gen.items())),
                  vo_chong_ghi_trong_o=sum(len(spouses[i]) for i in all_ids), buoc=[])

    nodes = make_nodes(P, spouses, kids, root, False)
    w = place(nodes, root, P)['width']
    report['buoc'].append(dict(buoc=f"a. Ô dọc hẹp từ đời {CFG['o_doc_tu']}, ô đời 2–3 rộng {CFG['d3_rong']}%", rong_pct=pct(w)))
    if w > limit:
        nodes = make_nodes(P, spouses, kids, root, True)
        w = place(nodes, root, P)['width']
        report['buoc'].append(dict(buoc=f"b. Danh sách dọc ({sum(1 for n in nodes.values() if n.list_kids)} nhà áp dụng)", rong_pct=pct(w)))

    # c. Tách chi: mỗi lượt chọn cây con nhỏ nhất mà tách ra thì vừa; nếu chưa có thì tách cây giảm bề rộng nhiều nhất.
    panels, chi_of = [], {}
    def cut(i):
        n = nodes[i]; saved = (n.kids, n.list_kids); n.kids, n.list_kids = [], []; return saved
    def split_until_fit(rid):
        while place(nodes, rid, P)['width'] > limit:
            cands = [i for i in subtree_ids(nodes, rid) if i != rid and (nodes[i].kids or nodes[i].list_kids)]
            if not cands: return
            trials = []
            for i in cands:
                size = len(subtree_ids(nodes, i)); saved = cut(i)
                trials.append((place(nodes, rid, P)['width'], size, nodes[i].gen, i))
                nodes[i].kids, nodes[i].list_kids = saved
            ok = [t for t in trials if t[0] <= limit]
            best = min(ok, key=lambda t: (t[1], t[2]))[3] if ok else min(trials, key=lambda t: (t[0], t[1]))[3]
            k, lk = cut(best)
            panels.append(dict(goc=best, kids=k, list_kids=lk)); chi_of[best] = len(panels)
    split_until_fit(root)
    i = 0
    while i < len(panels):   # tấm chi quá rộng thì tách tiếp
        pn = panels[i]; n = nodes[pn['goc']]
        n.kids, n.list_kids = pn['kids'], pn['list_kids']
        split_until_fit(pn['goc'])
        pn['kids'], pn['list_kids'] = n.kids, n.list_kids
        n.kids, n.list_kids = [], []
        i += 1
    if panels:
        report['buoc'].append(dict(buoc=f"c. Tách {len(panels)} chi", rong_pct=pct(place(nodes, root, P)['width'])))

    geo = place(nodes, root, P)
    boxes, segs = emit(nodes, root, geo, P, chi_of)
    main_bottom = max(b['y'] + b['h'] for b in boxes)
    sheets = [dict(ten='Tấm chính', goc=root, boxes=boxes, segments=segs, titles=[])]
    # Tấm phụ: đặt ngay trong Z4, dưới cây chính, nếu còn chỗ; không thì ra tranh riêng.
    band_y, band_x = main_bottom + 2 * GAP_ROW + SUB_PX * 3, Z4['x0']
    band = []
    for k, pn in enumerate(panels, 1):
        n = nodes[pn['goc']]
        n.kids, n.list_kids = pn['kids'], pn['list_kids']
        sub_chi = {pp['goc']: j for j, pp in enumerate(panels, 1) if pp['goc'] != pn['goc'] and pp['goc'] in subtree_ids(nodes, pn['goc'])}
        g = place(nodes, pn['goc'], P, band_y)
        b2, s2 = emit(nodes, pn['goc'], g, P, sub_chi)
        bw, bh = g['width'], max(b['y'] + b['h'] for b in b2) - band_y
        title = f"Chi {k}: {P[pn['goc']]['name'].strip()} (Đ.{P[pn['goc']]['gen']})"
        if band_x + bw <= Z4['x1'] and band_y + bh <= Z4['y1']:
            dx = band_x - min([b['x'] for b in b2] + [min(sg['x1'], sg['x2']) - LINE_W / 2 for sg in s2])
            for b in b2: b['x'] = round(b['x'] + dx); b['chi'] = k
            for sg in s2: sg['x1'] = round(sg['x1'] + dx); sg['x2'] = round(sg['x2'] + dx)
            sheets[0]['boxes'] += b2; sheets[0]['segments'] += s2
            sheets[0]['titles'].append(dict(text=title, x=round(band_x), y=round(band_y - SUB_PX * 2.5), w=round(bw)))
            band_x += bw + 3 * GAP_SIB + GAP_COUSIN
            band.append((b2, s2, sheets[0]['titles'][-1]))
        else:
            g = place(nodes, pn['goc'], P, Z4['y0'])
            b2, s2 = emit(nodes, pn['goc'], g, P, sub_chi)
            sheets.append(dict(ten=f'Chi {k} (tranh riêng)', goc=pn['goc'], boxes=b2, segments=s2, titles=[dict(text=title, x=round(Z4['x0']), y=round(Z4['y0'] - SUB_PX * 2.5), w=round(limit))]))
        n.kids, n.list_kids = [], []
    if band:   # cân dải tấm phụ vào giữa trục dọc của tranh
        used = band_x - (3 * GAP_SIB + GAP_COUSIN) - Z4['x0']
        sh = round((Z4['x1'] - Z4['x0'] - used) / 2)
        for b2, s2, t in band:
            for b in b2: b['x'] += sh
            for sg in s2: sg['x1'] += sh; sg['x2'] += sh
            t['x'] += sh
    for k, sh in enumerate(sheets):
        sh['loi'] = check(sh['boxes'], sh['segments'])
        preview(sh['boxes'], sh['segments'], os.path.join(out, f'preview_{k}.png'), sh['ten'], sh['titles'])
    seen = collections.Counter(b['id'] for sh in sheets for b in sh['boxes'])
    dup_ok = {pn['goc'] for pn in panels}
    report['kiem_dem'] = dict(so_o_can_ve=len(all_ids), so_nguoi_da_ve=len(seen), thieu=[P[i]['name'] for i in all_ids if i not in seen],
                              lap_sai=[i for i, c in seen.items() if c > 1 and not (c == 2 and i in dup_ok)])
    report['tam'] = [dict(ten=sh['ten'], goc=P[sh['goc']]['name'].strip(), so_o=len(sh['boxes']),
                          rong_pct=pct(max(b['x'] + b['w'] for b in sh['boxes']) - min(b['x'] for b in sh['boxes'])),
                          tu_y_pct=pct(min(b['y'] for b in sh['boxes']) * PW / PH), den_y_pct=round(max(b['y'] + b['h'] for b in sh['boxes']) / PH * 100, 1),
                          tam_phu=[t['text'] for t in sh['titles']], so_loi=len(sh['loi']), loi=sh['loi'][:10]) for sh in sheets]
    report['tam'] = [dict(t, tu_y_pct=round(min(b['y'] for b in sh['boxes']) / PH * 100, 1)) for t, sh in zip(report['tam'], sheets)]
    report['chieu_cao_o_px'] = {f"Đ.{r + 1}": round(h) for r, h in sorted(geo['hmax'].items())}
    json.dump(dict(page=dict(w=PW, h=PH), z4=Z4, cau_hinh=CFG, sheets=sheets), open(os.path.join(out, 'layout.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False, indent=1)
    return report

# ---------------------------------------------------------------- bố cục trục giữa
CHANNEL = 3 * PX   # khe dọc giữa dải trên cho đường thân chính đi qua

def run_axis(d, out):
    """Đời đầu (chuỗi một con) nằm đúng trục giữa; các gia đình phía dưới chia thành 2 dải,
    giữ thứ tự sinh (dải trên: trái→phải, rồi dải dưới), mỗi dải dàn đều hết bề ngang Z4;
    dải dưới chạm đáy Z4. Đường thân chính đi dọc trục giữa qua khe giữa dải trên."""
    P, spouses, kids, root = build_tree(d)
    limit = Z4['x1'] - Z4['x0']; axis = (Z4['x0'] + Z4['x1']) / 2
    nodes = make_nodes(P, spouses, kids, root, False)
    all_ids = subtree_ids(nodes, root)
    chain = [root]
    while len(nodes[chain[-1]].kids) == 1: chain.append(nodes[chain[-1]].kids[0])
    heads = list(nodes[chain[-1]].kids)
    _, hmax = row_geometry({k: nodes[k] for k in all_ids})
    # bề rộng và đường viền từng gia đình
    fam = {}
    for h in heads:
        tops = {}; y = 0
        for r in range(nodes[h].row, max(hmax) + 1): tops[r] = y; y += hmax[r] + GAP_ROW
        cont, pos = layout(nodes, h, tops, hmax)
        l = min(a for a, _ in cont.values()); r = max(b for _, b in cont.values())
        depth = max(nodes[i].row for i in subtree_ids(nodes, h))
        fam[h] = dict(l=l, r=r, w=r - l, pos=pos, depth=depth)
    def spread(items, x0, x1):
        """Dàn đều kiểu space-evenly; trả tâm-gốc (x của ô đầu gia đình) cho từng gia đình."""
        tot = sum(fam[h]['w'] for h in items); g = (x1 - x0 - tot) / (len(items) + 1)
        out, x = {}, x0 + g
        for h in items: out[h] = x - fam[h]['l']; x += fam[h]['w'] + g
        return out, g
    best = None
    half = (limit - CHANNEL) / 2
    for k in range(1, len(heads)):
        b1, b2 = heads[:k], heads[k:]
        for m in range(1, k):
            L, R = b1[:m], b1[m:]
            wl, wr = sum(fam[h]['w'] for h in L), sum(fam[h]['w'] for h in R)
            w2 = sum(fam[h]['w'] for h in b2)
            if wl > half or wr > half or w2 > limit: continue
            # ưu tiên: hai dải đầy đều nhau, hai nửa dải trên cân nhau
            score = abs(max(wl, wr) / half - w2 / limit) + abs(wl - wr) / half
            if best is None or score < best[0]: best = (score, L, R, b2)
    if best is None: raise SystemExit('Không chia được 2 dải vừa khổ — cần tách chi hoặc nén thêm.')
    _, L, R, b2 = best
    band_h = lambda items: sum(hmax[r] for r in range(nodes[items[0]].row, max(fam[h]['depth'] for h in items) + 1)) + \
        GAP_ROW * (max(fam[h]['depth'] for h in items) - nodes[items[0]].row)
    top_h = sum(hmax[nodes[c].row] for c in chain) + GAP_ROW * (len(chain) - 1)
    h1, h2 = band_h(L + R), band_h(b2)
    free = (Z4['y1'] - Z4['y0']) - top_h - h1 - h2
    gap = free / 2     # chia đều phần cao còn lại cho 2 khoảng: thân→dải trên, dải trên→dải dưới
    if gap < GAP_ROW: raise SystemExit(f'Không đủ chiều cao cho 2 dải: cần {top_h + h1 + h2 + 2 * GAP_ROW:.0f} px, có {Z4["y1"] - Z4["y0"]:.0f} px.')
    boxes, segs = [], []
    def seg(x1, y1, x2, y2): segs.append(dict(x1=round(x1), y1=round(y1), x2=round(x2), y2=round(y2), w=LINE_W))
    # chuỗi đời đầu trên trục giữa
    y = Z4['y0']
    last = nodes[chain[-1]]; saved = last.kids; last.kids = []
    tops = {}
    for c in chain: tops[nodes[c].row] = y; y += hmax[nodes[c].row] + GAP_ROW
    cont, pos = layout(nodes, root, tops, hmax)
    b0, s0 = emit(nodes, root, dict(tops=tops, hmax=hmax, pos=pos, cx=axis), P, {})
    boxes += b0; segs += s0; last.kids = saved
    trunk_top = tops[last.row] + hmax[last.row]
    # các dải
    def band(items_xy, y_top):
        r0 = nodes[next(iter(items_xy))].row
        tp = {}; yy = y_top
        for r in range(r0, max(hmax) + 1): tp[r] = yy; yy += hmax[r] + GAP_ROW
        bar = y_top - GAP_ROW / 2
        for h, cx in items_xy.items():
            b, sg = emit(nodes, h, dict(tops=tp, hmax=hmax, pos=fam[h]['pos'], cx=cx), P, {})
            boxes.extend(b); segs.extend(sg)
            seg(cx, bar, cx, y_top)
        xs = list(items_xy.values()) + [axis]
        seg(min(xs), bar, max(xs), bar)
        return bar
    y1 = trunk_top + gap
    xl, gl = spread(L, Z4['x0'], axis - CHANNEL / 2)
    xr, gr = spread(R, axis + CHANNEL / 2, Z4['x1'])
    band({**xl, **xr}, y1)
    y2 = Z4['y1'] - h2
    x2, g2 = spread(b2, Z4['x0'], Z4['x1'])
    bar2 = band(x2, y2)
    seg(axis, trunk_top, axis, bar2)
    errs = check(boxes, segs)
    seen = collections.Counter(b['id'] for b in boxes)
    per_gen = collections.Counter(P[i]['gen'] for i in all_ids)
    report = dict(nguon=d.get('settings', {}).get('title'), bo_cuc='trục giữa, 2 dải', cau_hinh=dict(CFG),
                  so_doi=max(per_gen), so_nguoi_trong_du_lieu=len(P), so_o=len(all_ids), o_theo_doi=dict(sorted(per_gen.items())),
                  vo_chong_ghi_trong_o=sum(len(spouses[i]) for i in all_ids),
                  truc_giua=[P[c]['name'].strip() for c in chain],
                  dai_tren_trai=[P[h]['name'].strip() for h in L], dai_tren_phai=[P[h]['name'].strip() for h in R],
                  dai_duoi=[P[h]['name'].strip() for h in b2],
                  khoang_cach_deu_px=dict(tren_trai=round(gl), tren_phai=round(gr), duoi=round(g2)),
                  lech_truc_doi_xung_px=round((max(b['x'] + b['w'] for b in boxes) + min(b['x'] for b in boxes)) / 2 - axis),
                  rong_pct=round((max(b['x'] + b['w'] for b in boxes) - min(b['x'] for b in boxes)) / PW * 100, 1),
                  cao_tu_den_pct=[round(min(b['y'] for b in boxes) / PH * 100, 1), round(max(b['y'] + b['h'] for b in boxes) / PH * 100, 1)],
                  kiem_dem=dict(so_o_can_ve=len(all_ids), da_ve=len(seen), thieu=[P[i]['name'] for i in all_ids if i not in seen],
                                lap=[i for i, c in seen.items() if c > 1]),
                  chieu_cao_o_px={f"Đ.{r + 1}": round(h) for r, h in sorted(hmax.items())},
                  so_loi=len(errs), loi=errs[:10])
    json.dump(dict(page=dict(w=PW, h=PH), z4=Z4, cau_hinh=CFG, sheets=[dict(ten='Tấm chính', goc=root, boxes=boxes, segments=segs, titles=[])]),
              open(os.path.join(out, 'layout.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False, indent=1)
    preview(boxes, segs, os.path.join(out, 'preview_0.png'), 'Truc giua')
    return report

def set_page(w, h, z4=None, name_px=None, sub_px=None):
    """Đổi khổ trang (px), vùng sơ đồ Z4 (px: x0,y0,x1,y1) và cỡ chữ tối thiểu."""
    global PW, PH, PX, PY, GAP_SIB, GAP_COUSIN, GAP_ROW, LIST_W, NAME_PX, SUB_PX, FB, FR, CHANNEL
    PW, PH = w, h; PX, PY = PW / 100.0, PH / 100.0
    GAP_SIB, GAP_COUSIN, GAP_ROW, LIST_W = 0.6 * PX, 1.2 * PX, 2.2 * PY, 5 * PX
    CHANNEL = 3 * PX
    if z4: Z4.update(x0=z4[0], y0=z4[1], x1=z4[2], y1=z4[3])
    else: Z4.update(x0=14 * PX, x1=86 * PX, y0=20 * PY, y1=90 * PY)
    if name_px: NAME_PX = name_px
    if sub_px: SUB_PX = sub_px
    FB = ImageFont.truetype(FONT_DIR + 'LiberationSerif-Bold.ttf', NAME_PX)
    FR = ImageFont.truetype(FONT_DIR + 'LiberationSerif-Regular.ttf', SUB_PX)

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('data'); ap.add_argument('out')
    ap.add_argument('--d3-rong', type=float, default=7.0)
    ap.add_argument('--o-doc-tu', type=int, default=7)
    ap.add_argument('--danh-sach-la', type=int, default=None)
    ap.add_argument('--con-gai', choices=['co', 'khong'], default=None, help='vẽ con cháu của con gái')
    ap.add_argument('--page', help='khổ trang px, vd 5342x4044')
    ap.add_argument('--z4', help='vùng sơ đồ px: x0,y0,x1,y1')
    ap.add_argument('--font', help='cỡ chữ tên,phụ px, vd 30,20')
    ap.add_argument('--truc-giua', action='store_true', help='đời đầu ở trục giữa, con cháu dàn đều 2 dải')
    a = ap.parse_args()
    if a.page:
        w, h = map(int, a.page.split('x'))
        f = list(map(int, a.font.split(','))) if a.font else [None, None]
        set_page(w, h, list(map(float, a.z4.split(','))) if a.z4 else None, *f)
    CFG.update(d3_rong=a.d3_rong, o_doc_tu=a.o_doc_tu, danh_sach_la=a.danh_sach_la,
               con_gai=None if a.con_gai is None else a.con_gai == 'co')
    os.makedirs(a.out, exist_ok=True)
    print(json.dumps((run_axis if a.truc_giua else run)(load(a.data), a.out), ensure_ascii=False, indent=1))
