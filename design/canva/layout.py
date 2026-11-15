#!/usr/bin/env python3
"""Dàn sơ đồ phả hệ cho tranh khắc đồng (bước 5 của brief Canva).

    python3 design/canva/layout.py <data> <out_dir>

<data>: file dạng {persons:[...], unions:[...], settings:{...}} như design/proposals/data.js
(window.CLAN = {...}) hoặc JSON thuần cùng cấu trúc. Không sửa dữ liệu, chỉ đọc.
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

def gen_style(g):
    if g == 1: return dict(kind='thuy_to', w=9 * PX)
    if g <= 3: return dict(kind='cuon_thu', w=7 * PX)
    if g <= 6: return dict(kind='chu_nhat', w=5 * PX)
    return dict(kind='doc_hep', w=2.2 * PX, min_h=6 * PY)

# ---------------------------------------------------------------- dữ liệu
def load(path):
    s = open(path, encoding='utf8').read()
    if not s.lstrip().startswith('{'):
        s = s[s.index('{'):s.rstrip().rstrip(';').rindex('}') + 1]
    return json.loads(s)

def build_tree(d):
    P = {p['id']: p for p in d['persons']}
    U = {u['id']: u for u in d['unions']}
    show_mat = d.get('settings', {}).get('showMaternalDescendants', False)
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
    star = '★ ' if p['male'] and sons and sons[0] == p['id'] and len(parent_kids) > 1 else ''
    sp = spouses.get(p['id'], [])
    lines = []
    if g == 1:
        lines.append(('name', f"Thủy tổ: {p['name']}"))
        if p.get('other'): lines.append(('sub', p['other']))
        lines.append(('sub', p.get('years') or '…'))
        for i, s in enumerate(sp, 1):
            other = f" – {s['other']}" if s.get('other') else ''
            lab = f"Bà {i}" if len(sp) > 1 else 'Bà'
            lines.append(('sub', f"{lab}: {s['name']}{other} ({s.get('years') or '…'})"))
        return lines
    lines.append(('name', star + p['name']))
    if p.get('other'): lines.append(('sub', p['other']))
    yrs = p.get('years') or '…'
    if p.get('deceased') and p.get('gio'): yrs += f" · Giỗ {p['gio']}"
    lines.append(('sub', yrs))
    if not p['male']:
        ho = sp[0]['name'].split()[0] if sp else '…'
        lines.append(('sub', f"(Xuất giá họ {ho})"))
    for i, s in enumerate(sp, 1):
        lab = ('Chồng' if not p['male'] else 'Vợ') + (f" {i}" if len(sp) > 1 else '')
        lines.append(('sub', f"{lab}: {s['name']}"))
    return lines

def measure(lines, style):
    """Trả (text_rows, height). Ô dọc hẹp: mỗi chữ (từ) một dòng."""
    inner = style['w'] - 2 * PAD
    rows, h = [], PAD + SUB_PX * LH   # dải nhãn Đ.n ở góc trên trái
    if style['kind'] == 'thuy_to': h += 1.6 * PX   # chừa mái đình
    for kind, text in lines:
        f, size = (FB, NAME_PX) if kind == 'name' else (FR, SUB_PX)
        parts = text.split() if style['kind'] == 'doc_hep' else wrap(text, f, inner)
        for t in parts:
            if tw(t, f) > inner:
                rows.append((kind, t, 'TRAN'))
            else:
                rows.append((kind, t, ''))
            h += size * LH
    return rows, h + PAD

# ---------------------------------------------------------------- bố cục
class Node:
    __slots__ = ('id', 'gen', 'row', 'w', 'h', 'kids', 'list_kids', 'x', 'lines', 'stub')

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
        if use_list and len(n.kids) > 6:
            n.list_kids = [c for c in n.kids if not kids.get(c)]
            n.kids = [c for c in n.kids if kids.get(c)]
        nodes[pid] = n
        for c in kids.get(pid, []): rec(c, kids[pid])
    rec(root, [root])
    return nodes

def row_geometry(nodes):
    hmax = collections.defaultdict(float)
    for n in nodes.values():
        st = gen_style(n.gen)
        _, h = measure(n.lines, st)
        hmax[n.row] = max(hmax[n.row], h, st.get('min_h', 0))
    tops, y = {}, Z4['y0']
    for r in range(max(hmax) + 1):
        tops[r] = y; y += hmax.get(r, 0) + GAP_ROW
    return tops, dict(hmax)

def list_item_h():
    return PAD * 2 + NAME_PX * LH + SUB_PX * LH

def layout(nodes, root, tops, hmax):
    """Reingold–Tilford theo đường viền (contour) từng hàng. Trả vị trí tương đối."""
    lih = list_item_h()
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
            H = len(n.list_kids) * (lih + 16)
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

def place(nodes, root, P):
    tops, hmax = row_geometry({k: nodes[k] for k in subtree_ids(nodes, root)})
    cont, pos = layout(nodes, root, tops, hmax)
    minx = min(l for l, _ in cont.values()); maxx = max(r for _, r in cont.values())
    width = maxx - minx
    cx = (Z4['x0'] + Z4['x1']) / 2 - (minx + maxx) / 2
    return dict(tops=tops, hmax=hmax, pos=pos, cx=cx, width=width)

# ---------------------------------------------------------------- xuất
def emit(nodes, root, geo, P, chi_of):
    tops, hmax, pos, cx = geo['tops'], geo['hmax'], geo['pos'], geo['cx']
    boxes, segs = [], []
    lih = list_item_h()
    def seg(x1, y1, x2, y2): segs.append(dict(x1=round(x1), y1=round(y1), x2=round(x2), y2=round(y2), w=LINE_W))
    for pid in subtree_ids(nodes, root):
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
                cp = P[c]
                lines = [('name', cp['name']), ('sub', (cp.get('years') or '…'))]
                boxes.append(dict(id=c, gen=cp['gen'], kind='danh_sach', x=round(bx + SPINE), y=round(yy), w=round(LIST_W),
                                  h=round(lih), text_w=round(LIST_W - 16), label=f"Đ.{cp['gen']}", deceased=bool(cp.get('deceased')),
                                  female=not cp['male'], dashed=not cp['male'], lines=[dict(style=k, text=t) for k, t in lines], overflow=[]))
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
        x0 -= LINE_W / 2; x1 += LINE_W / 2
        for b in boxes:   # chạm mép ô (điểm đầu/cuối) là hợp lệ; cắt vào trong ô thì lỗi
            if x0 < b['x'] + b['w'] - 1 and b['x'] + 1 < x1 and y0 < b['y'] + b['h'] - 1 and b['y'] + 1 < y1:
                errs.append(f"đường nối cắt ô {b['id']}")
        if not (Z4['x0'] <= x0 and x1 <= Z4['x1'] and Z4['y0'] <= y0 and y1 <= Z4['y1']): errs.append('đường nối ra ngoài Z4')
    return errs

def preview(boxes, segs, path, title):
    k = 0.25
    im = Image.new('RGB', (int(PW * k), int(PH * k)), '#5A3816'); dr = ImageDraw.Draw(im)
    m = 3
    dr.rectangle([PW * m / 100 * k, PH * m / 100 * k, PW * (1 - m / 100) * k, PH * (1 - m / 100) * k], outline='#A8742E', width=2)
    dr.rectangle([Z4['x0'] * k, Z4['y0'] * k, Z4['x1'] * k, Z4['y1'] * k], outline='#2E1A0B', width=2)
    for s in segs: dr.line([s['x1'] * k, s['y1'] * k, s['x2'] * k, s['y2'] * k], fill='#D4A94F', width=2)
    fill = dict(thuy_to='#8E1B14', cuon_thu='#A8742E', chu_nhat='#5A3816', doc_hep='#5A3816', danh_sach='#5A3816')
    for b in boxes:
        dr.rectangle([b['x'] * k, b['y'] * k, (b['x'] + b['w']) * k, (b['y'] + b['h']) * k], fill=fill[b['kind']], outline='#F3D98B' if not b['dashed'] else '#D4A94F', width=1)
    dr.text((20, 10), title, fill='#F3D98B')
    im.save(path)

def run(d, out):
    """Anh em xếp trái→phải theo thứ tự sinh (nhánh trưởng bên trái)."""
    P, spouses, kids, root = build_tree(d)
    report = dict(nguon=d.get('settings', {}).get('title'), so_doi=max(p['gen'] for p in P.values()),
                  so_nguoi_tong=len(P), so_o=None, buoc=[])
    limit = Z4['x1'] - Z4['x0']
    per_gen = collections.Counter(P[i]['gen'] for i in subtree_ids(make_nodes(P, spouses, kids, root, False), root))
    report['o_theo_doi'] = dict(sorted(per_gen.items()))
    report['so_o'] = sum(per_gen.values())
    report['vo_chong_trong_o'] = sum(len(spouses[i]) for i in subtree_ids(make_nodes(P, spouses, kids, root, False), root))

    nodes = make_nodes(P, spouses, kids, root, False)
    geo = place(nodes, root, P)
    report['buoc'].append(dict(buoc='Không nén (đời ≥7 đã là ô dọc hẹp theo mục 4 = bước a)', rong_px=round(geo['width']), rong_pct=round(geo['width'] / PW * 100, 1)))
    nodes = make_nodes(P, spouses, kids, root, True)
    n_list = sum(1 for n in nodes.values() if n.list_kids)
    geo = place(nodes, root, P)
    report['buoc'].append(dict(buoc=f'b. Danh sách dọc cho nhà có >6 con ({n_list} nhà áp dụng)', rong_px=round(geo['width']), rong_pct=round(geo['width'] / PW * 100, 1)))

    # c. tách chi: tham lam, cắt cây con rộng nhất ở đời nông nhất cho tới khi vừa
    panels, chi_of = [], {}
    def width_of(rid):
        return place(nodes, rid, P)['width']
    def split_until_fit(rid):
        while True:
            g = place(nodes, rid, P)
            if g['width'] <= limit: return
            ids = subtree_ids(nodes, rid)
            cands = [i for i in ids if i != rid and nodes[i].kids + nodes[i].list_kids]
            if not cands: return
            mingen = min(nodes[i].gen for i in cands)
            best = max((i for i in cands if nodes[i].gen == mingen), key=width_of)
            sub = dict(goc=best, kids=nodes[best].kids, list_kids=nodes[best].list_kids)
            nodes[best].kids, nodes[best].list_kids = [], []
            panels.append(sub)
            chi_of[best] = len(panels)
    split_until_fit(root)
    # mỗi tấm chi: phục hồi con rồi kiểm tra, nếu vẫn quá rộng thì tách tiếp
    i = 0
    while i < len(panels):
        pnl = panels[i]; n = nodes[pnl['goc']]
        saved_stub = (n.kids, n.list_kids)
        n.kids, n.list_kids = pnl['kids'], pnl['list_kids']
        pnl['restore'] = True
        split_until_fit(pnl['goc'])
        pnl['kids'], pnl['list_kids'] = n.kids, n.list_kids
        n.kids, n.list_kids = saved_stub
        i += 1

    geo = place(nodes, root, P)
    boxes, segs = emit(nodes, root, geo, P, chi_of)
    errs = check(boxes, segs)
    sheets = [dict(ten='Tấm chính', goc=root, rong_pct=round(geo['width'] / PW * 100, 1), boxes=boxes, segments=segs, loi=errs)]
    report['buoc'].append(dict(buoc=f'c. Tách {len(panels)} chi ra tấm riêng', rong_px=round(geo['width']), rong_pct=round(geo['width'] / PW * 100, 1)))
    preview(boxes, segs, os.path.join(out, 'preview_tam_chinh.png'), 'Tam chinh')
    for k, pnl in enumerate(panels, 1):
        n = nodes[pnl['goc']]
        stub = (n.kids, n.list_kids)
        n.kids, n.list_kids = pnl['kids'], pnl['list_kids']
        # tấm chi bắt đầu từ hàng trên cùng của Z4
        g0 = n.row
        old_row = {}
        for sid in subtree_ids(nodes, pnl['goc']): old_row[sid] = nodes[sid].row; nodes[sid].row -= g0
        g = place(nodes, pnl['goc'], P)
        sub_chi = {pp['goc']: j for j, pp in enumerate(panels, 1) if pp['goc'] in subtree_ids(nodes, pnl['goc']) and pp['goc'] != pnl['goc']}
        b2, s2 = emit(nodes, pnl['goc'], g, P, sub_chi)
        e2 = check(b2, s2)
        for sid, r in old_row.items(): nodes[sid].row = r
        sheets.append(dict(ten=f'Chi {k}', goc=pnl['goc'], ten_goc=P[pnl['goc']]['name'], doi_goc=P[pnl['goc']]['gen'],
                           rong_pct=round(g['width'] / PW * 100, 1), boxes=b2, segments=s2, loi=e2))
        preview(b2, s2, os.path.join(out, f'preview_chi_{k}.png'), f'Chi {k}')
        n.kids, n.list_kids = stub
    # đếm: mỗi người dòng máu xuất hiện đúng 1 lần (ô gốc chi xuất hiện ở tấm chính và lặp lại ở đầu tấm chi)
    seen = collections.Counter(b['id'] for s in sheets for b in s['boxes'])
    dup_ok = set(p['goc'] for p in panels)
    report['kiem_dem'] = dict(so_nguoi_can_ve=report['so_o'], so_nguoi_da_ve=len(seen),
                              lap_sai=[i for i, c in seen.items() if c > 1 and not (c == 2 and i in dup_ok)])
    report['tam'] = [dict(ten=s['ten'], goc=s.get('ten_goc', P[root]['name']), doi_goc=s.get('doi_goc', 1),
                          so_o=len(s['boxes']), so_doi=len(set(b['gen'] for b in s['boxes'])), rong_pct=s['rong_pct'],
                          cao_pct=round((max(b['y'] + b['h'] for b in s['boxes']) - Z4['y0']) / PH * 100, 1), loi=s['loi'][:10], so_loi=len(s['loi']))
                     for s in sheets]
    report['chieu_cao_o'] = {f"Đ.{r + 1}": round(h) for r, h in sorted(geo['hmax'].items())}
    json.dump(dict(page=dict(w=PW, h=PH), z4=Z4, sheets=sheets), open(os.path.join(out, 'layout.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False, indent=1)
    return report

if __name__ == '__main__':
    out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    print(json.dumps(run(load(sys.argv[1]), out), ensure_ascii=False, indent=1))
