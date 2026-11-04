/*
 * Shared prototype logic for the three design proposals (A, B, C).
 * Same data, same screens, same behaviour; each style changes layout, type and
 * colour through its own CSS and the few style-only blocks below.
 * Screens: Gia đình (family around one person), Danh sách (by generation),
 * the person detail (right rail on desktop, bottom sheet on a phone), search.
 */
(function () {
  const D = window.CLAN;
  const STYLE = document.documentElement.dataset.style; // 'a' | 'b' | 'c'
  const byId = new Map(D.persons.map((p) => [p.id, p]));
  const unionById = new Map(D.unions.map((u) => [u.id, u]));
  const unionsOf = new Map();
  const spouseUnions = new Map();
  const kidsOf = new Map();
  for (const u of D.unions) {
    (unionsOf.get(u.b) || unionsOf.set(u.b, []).get(u.b)).push(u);
    if (u.s) (spouseUnions.get(u.s) || spouseUnions.set(u.s, []).get(u.s)).push(u);
  }
  for (const list of unionsOf.values()) list.sort((a, b) => a.order - b.order);
  for (const p of D.persons) {
    if (p.parentUnion) (kidsOf.get(p.parentUnion) || kidsOf.set(p.parentUnion, []).get(p.parentUnion)).push(p);
  }
  for (const list of kidsOf.values()) list.sort((a, b) => (a.order || 99) - (b.order || 99));

  const ORD = ['cả', 'hai', 'ba', 'tư'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const given = (n) => n.split(' ').pop();

  const parentUnion = (id) => unionById.get(byId.get(id)?.parentUnion);
  const bloodParent = (id) => byId.get(parentUnion(id)?.b);
  const partnerships = (p) => {
    const list = p.blood ? unionsOf.get(p.id) || [] : spouseUnions.get(p.id) || [];
    return list.map((u) => ({ u, partner: byId.get(u.b === p.id ? u.s : u.b), kids: kidsOf.get(u.id) || [] }));
  };
  const lineage = (id) => {
    const out = [];
    let cur = byId.get(id);
    if (cur && !cur.blood && !cur.parentUnion) {
      out.push(cur);
      cur = byId.get((spouseUnions.get(cur.id) || [])[0]?.b);
    }
    while (cur) {
      out.push(cur);
      cur = bloodParent(cur.id);
    }
    return out.reverse();
  };
  const kidCount = (id) => (unionsOf.get(id) || []).reduce((n, u) => n + (kidsOf.get(u.id) || []).length, 0);
  const roleOf = (p, partnerOf) => {
    if (!p.blood) return p.male ? 'Rể' : 'Dâu';
    return p.male ? 'Nam' : 'Nữ';
  };
  const spouseLabel = (spouse, order, count) => {
    const base = spouse.male ? 'Chồng' : 'Vợ';
    return count > 1 ? `${base} ${ORD[order - 1] || order}` : base;
  };
  const who = (p) => {
    const parts = [`Đời ${p.gen}`];
    const par = bloodParent(p.id);
    if (par) parts.push(`con ${par.male ? 'ông' : 'bà'} ${par.name}`);
    else if (!p.blood) {
      const partner = byId.get((spouseUnions.get(p.id) || [])[0]?.b);
      if (partner) parts.push(`${p.male ? 'chồng bà' : 'vợ ông'} ${partner.name}`);
    }
    if (p.branch) parts.push(p.branch);
    return parts.join(' · ');
  };

  const state = { center: D.rootId, view: 'family', detail: null, search: false };

  /* ---------- Small pieces ---------- */
  const personRow = (p, caption, extra) => `
    <button type="button" class="person" data-go="${p.id}" data-blood="${p.blood}">
      ${caption ? `<span class="person-cap">${esc(caption)}</span>` : ''}
      <span class="person-name">${esc(p.name)}</span>
      <span class="person-meta">${esc([p.years, p.deceased && !p.years.includes('–') ? 'đã mất' : null, extra].filter(Boolean).join(' · '))}</span>
    </button>`;

  const mark = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 9.5v6M8 21v-5.5h16V21M16 15.5V21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="7" r="3" fill="currentColor"/><circle cx="8" cy="23.5" r="2.5" fill="currentColor"/><circle cx="16" cy="23.5" r="2.5" fill="currentColor"/><circle cx="24" cy="23.5" r="2.5" fill="currentColor"/></svg>`;

  const ICONS = {
    family: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M12 7.5v4M6 14.5V12h12v2.5"/>',
    tree: '<rect x="9" y="2.5" width="6" height="4" rx="1"/><rect x="2.5" y="17.5" width="6" height="4" rx="1"/><rect x="15.5" y="17.5" width="6" height="4" rx="1"/><path d="M12 6.5v8M5.5 17.5V14h13v3.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
    gio: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  };
  const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

  /* ---------- Shell ---------- */
  const NAV = [
    ['family', 'Gia đình'],
    ['tree', 'Sơ đồ'],
    ['list', 'Danh sách'],
    ['gio', 'Ngày giỗ'],
  ];
  function shell() {
    const s = D.settings;
    const giosThisWeek = D.upcoming.filter((g) => g.inDays <= 7).length;
    return `
    <aside class="side" aria-label="Điều hướng">
      <div class="brand">${mark}<div><div class="brand-name">${esc(s.title)}</div><div class="brand-scope">${D.persons.length} người · ${D.maxGen} đời</div></div></div>
      <button type="button" class="side-search" data-search>${icon('search')}<span>Tìm người</span><kbd>/</kbd></button>
      <nav><ul class="side-nav">${NAV.map(
        ([k, label]) =>
          `<li><button type="button" data-view="${k}" class="side-link">${icon(k)}<span>${label}</span>${k === 'gio' && giosThisWeek ? `<span class="count" aria-label="${giosThisWeek} giỗ trong 7 ngày tới">${giosThisWeek}</span>` : ''}</button></li>`,
      ).join('')}</ul></nav>
      <div class="side-foot"><button type="button" class="side-link">${icon('more')}<span>Nhập mã admin</span></button></div>
    </aside>
    <header class="topbar">${mark}<span class="topbar-name">${esc(s.title)}</span><button type="button" class="topbar-btn" data-search aria-label="Tìm người">${icon('search')}</button></header>
    <main class="main" id="main"></main>
    <div class="rail-wrap" id="rail"></div>
    <nav class="tabbar" aria-label="Điều hướng chính">${[
      ['family', 'Gia đình'],
      ['tree', 'Sơ đồ'],
      ['list', 'Danh sách'],
      ['search', 'Tìm kiếm'],
      ['more', 'Thêm'],
    ]
      .map(([k, label]) => `<button type="button" class="tab" ${k === 'search' ? 'data-search' : `data-view="${k}"`}>${icon(k)}<span>${label}</span></button>`)
      .join('')}</nav>
    <div class="search" id="search" hidden></div>`;
  }

  /* ---------- Gia đình ---------- */
  function familyView() {
    const p = byId.get(state.center);
    const pu = parentUnion(p.id);
    const parents = pu ? [byId.get(pu.b), byId.get(pu.s)].filter(Boolean) : [];
    const parts = partnerships(p);
    const sibs = pu ? (kidsOf.get(pu.id) || []).filter((c) => c.id !== p.id) : [];
    const line = lineage(p.id);
    const several = parts.filter((x) => x.kids.length).length > 1;
    const next = D.upcoming[0];
    const nextP = byId.get(next.id);

    const greeting =
      STYLE === 'a'
        ? `<header class="hello">
            <h1>${esc(D.settings.title)}</h1>
            <p class="hello-fact">Hôm nay ${esc(D.today.lunar)}. Giỗ gần nhất: <button type="button" class="inline" data-detail="${nextP.id}">${esc(nextP.name)}</button>, ${esc(next.date.toLowerCase())}, còn ${next.inDays} ngày.</p>
          </header>`
        : '';

    const lineageBlock =
      STYLE === 'b'
        ? `<nav class="spine" aria-label="Dòng dõi">
            <h2 class="block-title">Dòng dõi</h2>
            <ol>${line
              .map(
                (x) =>
                  `<li ${x.id === p.id ? 'aria-current="true"' : ''}><button type="button" data-go="${x.id}"><span class="spine-gen">Đời ${x.gen}</span><span class="spine-name">${esc(x.name)}</span></button></li>`,
              )
              .join('')}</ol>
          </nav>`
        : `<nav class="crumbs" aria-label="Dòng dõi"><ol>${line
            .map(
              (x) =>
                `<li ${x.id === p.id ? 'aria-current="true"' : ''}><button type="button" data-go="${x.id}"><span>Đời ${x.gen}</span> ${esc(given(x.name))}</button></li>`,
            )
            .join('')}</ol></nav>`;

    const gioStrip =
      STYLE === 'c'
        ? `<section class="gio" aria-labelledby="gio-t">
            <h2 id="gio-t" class="block-title">Ngày giỗ sắp tới</h2>
            <ul>${D.upcoming
              .slice(0, 3)
              .map((g) => {
                const x = byId.get(g.id);
                return `<li><button type="button" data-detail="${x.id}"><span class="gio-when">${g.inDays === 0 ? 'Hôm nay' : `Còn ${g.inDays} ngày`}</span><span class="gio-name">${esc(x.name)}</span><span class="gio-date">${esc(g.date)} · ${esc(g.lunar)}</span></button></li>`;
              })
              .join('')}</ul>
          </section>`
        : '';

    const gioPanel =
      STYLE === 'a'
        ? `<section class="block gio-panel" aria-labelledby="gp-t">
            <h2 id="gp-t" class="block-title">Ngày giỗ sắp tới</h2>
            <ul>${D.upcoming
              .slice(0, 3)
              .map((g) => {
                const x = byId.get(g.id);
                return `<li><button type="button" data-detail="${x.id}"><span class="gp-name">${esc(x.name)}</span><span class="gp-date">${esc(g.date)} · còn ${g.inDays} ngày</span></button></li>`;
              })
              .join('')}</ul>
          </section>`
        : '';

    const focus = `
      <section class="focus" aria-labelledby="focus-name">
        <p class="focus-facts">${esc([`Đời ${p.gen}`, p.branch, !p.blood ? (p.male ? 'Rể' : 'Dâu') : null, p.maternal ? 'Bên ngoại' : null].filter(Boolean).join(' · '))}</p>
        ${STYLE === 'a' ? `<h2 id="focus-name" class="focus-name">${esc(p.name)}</h2>` : `<h1 id="focus-name" class="focus-name">${esc(p.name)}</h1>`}
        ${p.other ? `<p class="focus-other">${esc(p.other)}</p>` : ''}
        <p class="focus-years">${esc(p.years || 'Chưa rõ năm sinh')}${p.deceased ? ' · đã mất' : ''}${p.gio ? ` · giỗ ${esc(p.gio)} âm lịch` : ''}</p>
        <div class="focus-actions">
          <button type="button" class="btn primary" data-detail="${p.id}">Xem chi tiết</button>
          ${pu ? `<button type="button" class="btn" data-go="${pu.b}">${icon('up')}Lên đời trước</button>` : ''}
        </div>
      </section>`;

    const parentsBlock = `
      <section class="block parents" aria-labelledby="par-t">
        <h2 id="par-t" class="block-title">Cha mẹ</h2>
        ${parents.length ? `<div class="rows two">${parents.map((x) => personRow(x, x.male ? 'Cha' : 'Mẹ')).join('')}</div>` : `<p class="empty">${p.id === D.rootId ? 'Thủy tổ, đời đầu tiên được ghi trong gia phả.' : 'Chưa ghi cha mẹ.'}</p>`}
      </section>`;

    const spouseBlock = parts.length
      ? `<section class="block spouses" aria-labelledby="sp-t">
          <h2 id="sp-t" class="block-title">${p.male ? 'Vợ' : 'Chồng'}</h2>
          <div class="rows">${parts
            .map(({ u, partner }) => (partner ? personRow(partner, p.blood && parts.length > 1 ? spouseLabel(partner, u.order, parts.length) : null) : `<p class="empty">Chưa rõ tên</p>`))
            .join('')}</div>
        </section>`
      : '';

    const kidsBlocks = parts
      .filter((x) => x.kids.length)
      .map(
        ({ u, partner, kids }) => `
        <section class="block kids" aria-labelledby="k-${u.id}">
          <h2 id="k-${u.id}" class="block-title">${several ? `Con ${partner && partner.male ? 'ông' : 'bà'} ${ORD[u.order - 1]}` : 'Các con'} <span class="n">${kids.length}</span>${several && partner ? `<span class="block-sub">${esc(partner.name)}</span>` : ''}</h2>
          <div class="rows grid">${kids.map((c) => personRow(c, c.order ? `Con thứ ${c.order}` : null, kidCount(c.id) ? `${kidCount(c.id)} con` : null)).join('')}</div>
        </section>`,
      )
      .join('');
    const noKids = !parts.some((x) => x.kids.length)
      ? `<section class="block kids" aria-labelledby="k-none"><h2 id="k-none" class="block-title">Các con</h2><p class="empty">Chưa ghi nhận con.</p></section>`
      : '';
    const sibsBlock = sibs.length
      ? `<section class="block sibs" aria-labelledby="sib-t"><h2 id="sib-t" class="block-title">Anh chị em <span class="n">${sibs.length}</span></h2><div class="rows grid">${sibs.map((c) => personRow(c, c.order ? `Con thứ ${c.order}` : null)).join('')}</div></section>`
      : '';

    return `<div class="family" data-center="${p.id}">${greeting}${STYLE === 'b' ? '' : lineageBlock}
      <div class="family-grid">
        ${STYLE === 'b' ? lineageBlock : ''}
        <div class="family-main">${focus}${gioPanel}${gioStrip}${parentsBlock}${spouseBlock}${kidsBlocks}${noKids}${sibsBlock}</div>
      </div></div>`;
  }

  /* ---------- Danh sách ---------- */
  const openGens = new Set([1, 2]);
  function listView() {
    const gens = new Map();
    for (const p of D.persons) {
      if (!p.blood || p.maternal) continue;
      const g = gens.get(p.gen) || gens.set(p.gen, new Map()).get(p.gen);
      const key = p.branch || 'Chưa chia chi';
      (g.get(key) || g.set(key, []).get(key)).push(p);
    }
    const total = [...gens.values()].reduce((n, m) => n + [...m.values()].reduce((k, r) => k + r.length, 0), 0);
    return `<div class="listview">
      <header class="list-head"><h1>Danh sách theo đời</h1><p>${total} người trong họ, ${gens.size} đời. Con cháu bên ngoại đang ẩn.</p></header>
      <ol class="gens">${[...gens.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([gen, branches]) => {
          const n = [...branches.values()].reduce((k, r) => k + r.length, 0);
          const open = openGens.has(gen);
          return `<li class="gen"><button type="button" class="gen-head" data-gen="${gen}" aria-expanded="${open}"><span class="gen-name">Đời ${gen}</span><span class="gen-n">${n} người</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
          ${open ? `<div class="gen-body">${[...branches.entries()]
            .sort()
            .map(
              ([b, rows]) =>
                `<section aria-label="${esc(b)}">${branches.size > 1 || b !== 'Chưa chia chi' ? `<h2 class="branch">${esc(b)}</h2>` : ''}<div class="rows">${rows
                  .map((p) => {
                    const sp = (unionsOf.get(p.id) || []).map((u) => byId.get(u.s)).filter(Boolean);
                    return personRow(p, null, sp.length ? `${p.male ? 'vợ' : 'chồng'} ${sp.map((s) => s.name).join(', ')}` : null);
                  })
                  .join('')}</div></section>`,
            )
            .join('')}</div>` : ''}</li>`;
        })
        .join('')}</ol></div>`;
  }

  function placeholder(title, text) {
    return `<div class="placeholder"><h1>${title}</h1><p>${text}</p></div>`;
  }

  /* ---------- Detail ---------- */
  function detailPanel(id) {
    const p = byId.get(id);
    const par = bloodParent(id);
    const rows = [
      ['Tên khác', p.other],
      ['Quan hệ', p.blood ? (p.maternal ? 'Con cháu bên ngoại' : 'Huyết thống') : p.male ? 'Rể' : 'Dâu'],
      ['Thứ tự', p.order && par ? `Con thứ ${p.order} của ${par.name}` : null],
      ['Sinh', p.birth || 'Chưa rõ'],
      ['Nơi sinh', p.birthPlace],
      ['Mất', p.death],
      ['Ngày giỗ', p.gio ? `${p.gio} âm lịch` : null],
      ['An táng', p.burial],
      ['Nghề nghiệp', p.job],
      ['Ghi chú', p.notes],
    ].filter((r) => r[1]);
    const pu = parentUnion(id);
    const parents = pu ? [byId.get(pu.b), byId.get(pu.s)].filter(Boolean) : [];
    const parts = partnerships(p);
    const kids = parts.flatMap((x) => x.kids);
    const rel = [
      parents.length && ['Cha mẹ', parents.map((x) => personRow(x, x.male ? 'Cha' : 'Mẹ'))],
      parts.length && [p.male ? 'Vợ' : 'Chồng', parts.filter((x) => x.partner).map(({ u, partner }) => personRow(partner, p.blood && parts.length > 1 ? spouseLabel(partner, u.order, parts.length) : null))],
      kids.length && [`Con · ${kids.length}`, kids.map((c) => personRow(c, c.order ? `Con thứ ${c.order}` : null))],
    ].filter(Boolean);
    return `<div class="scrim" data-close></div>
      <aside class="rail" role="dialog" aria-modal="false" aria-labelledby="d-name">
        <div class="rail-head">
          <div><h2 id="d-name" class="d-name">${esc(p.name)}</h2><p class="d-sub">${esc(who(p))}</p></div>
          <button type="button" class="icon-btn" data-close aria-label="Đóng">${icon('close')}</button>
        </div>
        <div class="rail-body">
          <dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          ${rel.map(([t, items]) => `<section class="rel"><h3>${t}</h3><div class="rows">${items.join('')}</div></section>`).join('')}
        </div>
        <div class="rail-foot">
          <button type="button" class="btn" data-go="${p.blood ? p.id : (spouseUnions.get(p.id) || [])[0]?.b || p.id}" data-close>Xem gia đình</button>
          <button type="button" class="btn">${icon('share')}Chia sẻ</button>
        </div>
      </aside>`;
  }

  /* ---------- Search ---------- */
  function searchPanel(q) {
    const nq = norm(q.trim());
    const hits = nq
      ? D.persons
          .map((p) => ({ p, n: norm(p.name) }))
          .filter(({ n }) => nq.split(' ').every((w) => n.split(' ').some((x) => x.startsWith(w))) || n.includes(nq))
          .slice(0, 30)
      : [];
    return `<div class="search-bar"><label for="q" class="vh">Tìm theo tên</label><input id="q" type="search" placeholder="Gõ tên, không cần dấu" value="${esc(q)}" autocomplete="off"><button type="button" class="icon-btn" data-close-search aria-label="Đóng tìm kiếm">${icon('close')}</button></div>
      <div class="search-results">${
        !nq
          ? '<p class="empty">Ví dụ: <em>trinh van viet</em>, hoặc chỉ tên <em>khai</em>.</p>'
          : hits.length
            ? `<p class="search-n">${hits.length >= 30 ? 'Hơn 30' : hits.length} kết quả</p><div class="rows">${hits.map(({ p }) => `<button type="button" class="person" data-go="${p.id}" data-detail-after="${p.id}" data-blood="${p.blood}"><span class="person-name">${esc(p.name)}</span><span class="person-meta">${esc(who(p))}${p.years ? ` · ${esc(p.years)}` : ''}</span></button>`).join('')}</div>`
            : `<p class="empty">Không tìm thấy ai tên “${esc(q)}”.</p>`
      }</div>`;
  }

  /* ---------- Render & events ---------- */
  const root = document.getElementById('app');
  root.innerHTML = shell();
  const main = document.getElementById('main');
  const rail = document.getElementById('rail');
  const search = document.getElementById('search');
  const desktop = () => window.matchMedia('(min-width: 1000px)').matches;

  function render() {
    main.innerHTML =
      state.view === 'family'
        ? familyView()
        : state.view === 'list'
          ? listView()
          : state.view === 'tree'
            ? placeholder('Sơ đồ', 'Sơ đồ cây giữ nguyên cách dùng hiện tại (phóng to nhiều mức, thu gọn nhánh). Khi chọn mẫu, sơ đồ sẽ dùng cùng chữ và màu của mẫu này.')
            : placeholder('Ngày giỗ', D.upcoming.map((g) => `${byId.get(g.id).name}: ${g.date}, ${g.lunar}, còn ${g.inDays} ngày.`).join(' '));
    for (const b of root.querySelectorAll('[data-view]')) b.setAttribute('aria-current', b.dataset.view === state.view ? 'page' : 'false');
    // On a desktop the rail always shows someone: the open detail, else the centre person.
    const showId = state.detail || (desktop() && STYLE !== 'a' && state.view === 'family' ? state.center : null);
    rail.innerHTML = showId ? detailPanel(showId) : '';
    rail.dataset.open = state.detail ? 'true' : 'false';
    document.body.classList.toggle('sheet-open', Boolean(state.detail) && !desktop());
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-close]');
    if (!t) return;
    if (t.dataset.view) {
      state.view = t.dataset.view === 'more' ? state.view : t.dataset.view;
      state.detail = null;
    }
    if (t.dataset.gen) {
      const g = Number(t.dataset.gen);
      openGens.has(g) ? openGens.delete(g) : openGens.add(g);
    }
    if (t.dataset.search !== undefined) {
      search.hidden = false;
      search.innerHTML = searchPanel('');
      search.querySelector('input').focus();
      return;
    }
    if (t.dataset.closeSearch !== undefined) {
      search.hidden = true;
      return;
    }
    if (t.dataset.go) {
      state.center = t.dataset.go;
      state.view = 'family';
      state.detail = t.dataset.detailAfter || null;
      search.hidden = true;
      window.scrollTo({ top: 0 });
    }
    if (t.dataset.detail) state.detail = t.dataset.detail;
    if (t.dataset.close !== undefined && !t.dataset.go) state.detail = null;
    render();
  });
  search.addEventListener('input', (e) => {
    const pos = e.target.selectionStart;
    search.innerHTML = searchPanel(e.target.value);
    const input = search.querySelector('input');
    input.focus();
    input.setSelectionRange(pos, pos);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.hidden = true;
      state.detail = null;
      render();
    }
    if (e.key === '/' && search.hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      search.hidden = false;
      search.innerHTML = searchPanel('');
      search.querySelector('input').focus();
    }
  });
  window.matchMedia('(min-width: 1000px)').addEventListener('change', render);
  render();
})();
