/**
 * Renders title-lettering options ON the real title board picture, the way the app fits
 * them (PosterSvg `fitBoardText`, D79): both lines sized from their real ink (tone marks
 * over capitals included) plus the arc's rise, subtitle ≤ half the title, 92% of the box
 * width, 7% margin above and below, the block centred; letters on their baselines. The
 * text box is outlined in blue so a line that leaves it shows at once. Straight or bent along an arc
 * (`arcRadius`, × board width: positive = arch, the middle higher; negative = sag, the
 * middle lower, like a ribbon hanging between its rolls). One labelled panel per option,
 * stacked in one PNG, with a sample person card under the board to judge the names face.
 *
 * Usage: node mau-tieu-de.cjs spec.json out.png
 * spec.json: {
 *   "bang": "/abs/path/bang-tieu-de.png", "nen": "#9e1b1e", "chu": "#4a2a0c",
 *   "vungChu": { "top": 0.545, "bottom": 0.69, "left": 0.31, "right": 0.69 },
 *   "tieuDe": "Gia Phả Họ Trịnh", "dongPhu": "Đời thứ nhất đến đời thứ bảy",
 *   "o": { "nen": "#4f0b0e", "vien": "#b8862b", "chu": "#ffe4a0", "phu": "#e8c88c" },
 *   "phuongAn": [
 *     { "nhan": "A", "tieuDe": "Playfair Display:700", "dongPhu": "Playfair Display:400i",
 *       "ten": "Noto Serif:600", "doCong": -2.0, "hoa": false, "gianChu": 0 }
 *   ]
 * }
 * A face is "Family:weight" with an optional "i" for italic. "doCong" null/0 = straight.
 * "hoa": write the title in capitals; "gianChu": letter spacing in em.
 * Optional per option: "tieuDe_text" / "dongPhu_text" to try another wording (a long
 * title with stacked tone marks, or "" for no subtitle) — always try those before choosing.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const [specPath, out] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const parse = (f) => {
  const [family, w = '400'] = f.split(':');
  return { family, weight: parseInt(w, 10), italic: w.endsWith('i') };
};
const faces = new Map();
for (const p of spec.phuongAn) for (const k of ['tieuDe', 'dongPhu', 'ten']) {
  const f = parse(p[k]);
  const list = faces.get(f.family) ?? new Set();
  list.add(`${f.italic ? 1 : 0},${f.weight}`);
  faces.set(f.family, list);
}
const css =
  'https://fonts.googleapis.com/css2?' +
  [...faces].map(([fam, set]) => `family=${fam.replace(/ /g, '+')}:ital,wght@${[...set].sort().join(';')}`).join('&') +
  '&display=block&subset=vietnamese';
const img = 'data:image/png;base64,' + fs.readFileSync(spec.bang).toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">
<style>body{margin:0;background:#e9e4da;font-family:sans-serif}.p{margin:16px;padding:12px 12px 20px;background:${spec.nen};border-radius:10px;width:1100px}
.l{font:700 34px sans-serif;color:#fff;margin:4px 8px}.n{font:14px monospace;color:#f3e3c0;margin:6px 8px}</style></head>
<body><div id="root"></div><script>
const spec=${JSON.stringify(spec)};const IMG=${JSON.stringify(img)};
const parse=${parse.toString()};
const ctx=document.createElement('canvas').getContext('2d');
const fontStr=(f,size)=>(f.italic?'italic ':'')+f.weight+' '+size+'px "'+f.family+'"';
const widths=(t,f,size,sp)=>Array.from(t).map(ch=>{ctx.font=fontStr(f,size);return ctx.measureText(ch).width+(sp||0)*size;});
const W=1100;
function line(svg,text,f,size,cx,y,R,fill,sp){
  if(!R){const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    Object.entries({x:cx,y,'text-anchor':'middle','font-family':f.family,'font-weight':f.weight,'font-style':f.italic?'italic':'normal','font-size':size,fill,'letter-spacing':(sp||0)+'em'}).forEach(([k,v])=>t.setAttribute(k,v));
    t.textContent=text;svg.appendChild(t);return;}
  const ws=widths(text,f,size,sp).map((w,i)=>Array.from(text)[i]===' '?Math.max(w,0.32*size):w);
  const total=ws.reduce((a,b)=>a+b,0);let along=-total/2;
  Array.from(text).forEach((l,i)=>{const mid=along+ws[i]/2;along+=ws[i];if(l===' ')return;
    const a=mid/R,x=cx+R*Math.sin(a),ly=y+R-R*Math.cos(a);
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    Object.entries({x,y:ly,transform:'rotate('+(a*180/Math.PI)+' '+x+' '+ly+')','text-anchor':'middle','font-family':f.family,'font-weight':f.weight,'font-style':f.italic?'italic':'normal','font-size':size,fill}).forEach(([k,v])=>t.setAttribute(k,v));
    t.textContent=l;svg.appendChild(t);});
}
function panel(p,iw,ih){
  const d=document.createElement('div');d.className='p';
  d.innerHTML='<div class="l">'+p.nhan+'</div>';
  const bw=W,bh=bw*ih/iw,cardH=150;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width',W);svg.setAttribute('height',bh+cardH);
  const im=document.createElementNS('http://www.w3.org/2000/svg','image');im.setAttribute('href',IMG);im.setAttribute('width',bw);im.setAttribute('height',bh);svg.appendChild(im);
  const v=spec.vungChu,tb={x:v.left*bw,y:v.top*bh,w:(v.right-v.left)*bw,h:(v.bottom-v.top)*bh};
  const tf=parse(p.tieuDe),sf=parse(p.dongPhu),nf=parse(p.ten);
  const rawT=p.tieuDe_text!==undefined?p.tieuDe_text:spec.tieuDe;
  const title=p.hoa?rawT.toLocaleUpperCase('vi'):rawT;
  const sub=p.dongPhu_text!==undefined?p.dongPhu_text:spec.dongPhu;
  const em=(t,f,sp)=>Math.max(0.5,widths(t,f,1,sp).reduce((a,b)=>a+b,0));
  const ink=(t,f)=>{ctx.font=fontStr(f,100);const m=ctx.measureText(t);return{above:m.actualBoundingBoxAscent/100,below:Math.max(0,m.actualBoundingBoxDescent/100)};};
  const R=p.doCong?p.doCong*bw:0;
  const T={em:em(title,tf,p.gianChu),...ink(title,tf)},S=sub?{em:em(sub,sf,0),...ink(sub,sf)}:null;
  const padY=tb.h*0.07,roomW=tb.w*0.92,roomH=tb.h-2*padY;
  const rise=w=>{if(!R)return 0;const r=Math.abs(R),h=Math.min(w/2,r);return r-Math.sqrt(r*r-h*h);};
  const lay=size=>{const ss=S?Math.min(size*0.5,roomW/S.em):0,gap=S?size*0.2:0;
    const top=R<0?rise(size*T.em):0,bottom=R>0?(S?rise(ss*S.em):rise(size*T.em)):0;
    return{ss,gap,top,height:top+size*(T.above+T.below)+(S?gap+ss*(S.above+S.below):0)+bottom};};
  let ts=Math.min(200,roomW/T.em);for(let i=0;i<6;i++){const h=lay(ts).height;if(h<=roomH)break;ts*=roomH/h;}
  const L=lay(ts),blockTop=tb.y+(tb.h-L.height)/2,ty=blockTop+L.top+ts*T.above,sy=S?ty+ts*T.below+L.gap+L.ss*S.above:ty;
  const box=document.createElementNS('http://www.w3.org/2000/svg','rect');
  Object.entries({x:tb.x,y:tb.y,width:tb.w,height:tb.h,fill:'none',stroke:'#2a6cff','stroke-width':1.5,'stroke-dasharray':'6 4'}).forEach(([k,v])=>box.setAttribute(k,v));svg.appendChild(box);
  line(svg,title,tf,ts,tb.x+tb.w/2,ty,R,spec.chu,p.gianChu);
  if(S)line(svg,sub,sf,L.ss,tb.x+tb.w/2,sy,R?R-(sy-ty):0,spec.chu,0);
  const o=spec.o;if(o){const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.innerHTML=
    '<rect x="'+(W/2-230)+'" y="'+(bh+20)+'" width="460" height="110" rx="10" fill="'+o.nen+'" stroke="'+o.vien+'" stroke-width="3"/>'+
    '<text x="'+W/2+'" y="'+(bh+62)+'" text-anchor="middle" font-family="'+nf.family+'" font-weight="'+nf.weight+'" font-style="'+(nf.italic?'italic':'normal')+'" font-size="30" fill="'+o.chu+'">Trịnh Thị Thanh Thơm</text>'+
    '<text x="'+W/2+'" y="'+(bh+100)+'" text-anchor="middle" font-family="'+nf.family+'" font-weight="400" font-size="22" fill="'+o.phu+'">1818 – 1897 · Vợ: Dương Thị Loan</text>';svg.appendChild(g);}
  d.appendChild(svg);
  const n=document.createElement('div');n.className='n';n.textContent=(p.tieuDe_text!==undefined||p.dongPhu_text!==undefined?'thử chữ khác · ':'')+p.tieuDe+' · '+p.dongPhu+' · '+p.ten+(p.doCong?' · cung '+p.doCong:' · thẳng')+(p.hoa?' · chữ hoa':'')+(p.gianChu?' · giãn '+p.gianChu+'em':'');d.appendChild(n);
  return d;
}
document.fonts.ready.then(()=>{const i=new Image();i.onload=()=>{spec.phuongAn.forEach(p=>root.appendChild(panel(p,i.width,i.height)));document.body.dataset.done=1;};i.src=IMG;});
</script></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 800 } });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.dataset.done === '1', null, { timeout: 60000 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
  console.log(out);
})();
