// Generates eight layered 1920x1080 nature scenes as lightweight SVGs.
// Deterministic (seeded) so rebuilds are identical.
const fs = require('fs');
const path = require('path');

const W = 1920;
const H = 1080;
const OUT = path.join(__dirname, '..', 'app', 'wallpapers');

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => Number(v.toFixed(1));

function ridgePoints(seed, baseY, amp, count, jagged) {
  const r = mulberry32(seed);
  const p1 = r() * 6.283;
  const p2 = r() * 6.283;
  const p3 = r() * 6.283;
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const low = 0.56 + 0.26 * Math.sin(t * 6.1 + p1) + 0.1 * Math.sin(t * 15.3 + p2) + 0.05 * Math.sin(t * 29.7 + p3);
    const spike = jagged ? 0.12 * Math.sin(t * 47 + p1 * 2) : 0;
    const y = baseY - amp * Math.max(0.08, low + spike);
    pts.push([t * W, y]);
  }
  return pts;
}

function smooth(pts, closeY = H) {
  let d = `M ${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${n(pts[i][0])} ${n(pts[i][1])} ${n(xc)} ${n(yc)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${n(last[0])} ${n(last[1])} L ${W} ${closeY} L 0 ${closeY} Z`;
  return d;
}

function linGrad(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  const s = stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
}

function radGrad(id, stops, cx = '50%', cy = '50%', r = '50%') {
  const s = stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${s}</radialGradient>`;
}

function stars(seed, count, maxY, color = '#dfeaff') {
  const r = mulberry32(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = r() * W;
    const y = r() * maxY;
    const rad = 0.6 + r() * 1.9;
    const op = 0.15 + r() * 0.75;
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rad)}" fill="${color}" opacity="${n(op)}"/>`;
  }
  return out;
}

function cloud(cx, cy, rx, ry, color, op) {
  return `<g opacity="${op}" fill="${color}">
    <ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/>
    <ellipse cx="${n(cx - rx * 0.55)}" cy="${n(cy + ry * 0.15)}" rx="${n(rx * 0.55)}" ry="${n(ry * 0.72)}"/>
    <ellipse cx="${n(cx + rx * 0.5)}" cy="${n(cy + ry * 0.1)}" rx="${n(rx * 0.6)}" ry="${n(ry * 0.66)}"/>
  </g>`;
}

function pines(seed, baseY, count, minH, maxH, color, op) {
  const r = mulberry32(seed);
  let out = `<g fill="${color}" opacity="${op}">`;
  for (let i = 0; i < count; i++) {
    const x = (i + r() * 0.75) * (W / count);
    const h = minH + r() * (maxH - minH);
    const w = h * (0.32 + r() * 0.1);
    out += `<g transform="translate(${n(x)} ${n(baseY)})">`;
    out += `<rect x="${n(-h * 0.022)}" y="${n(-h * 0.18)}" width="${n(h * 0.044)}" height="${n(h * 0.2)}"/>`;
    for (let k = 0; k < 3; k++) {
      const top = -h * (0.35 + k * 0.24);
      const half = (w / 2) * (1 - k * 0.2);
      out += `<path d="M ${n(-half)} ${n(top + h * 0.3)} L 0 ${n(top)} L ${n(half)} ${n(top + h * 0.3)} Z"/>`;
    }
    out += `</g>`;
  }
  out += `</g>`;
  return out;
}

function sceneAurora() {
  const r = mulberry32(11);
  let ribbons = '';
  for (let i = 0; i < 4; i++) {
    const y0 = 150 + i * 62;
    let d = `M -100 ${n(y0)}`;
    for (let k = 1; k <= 14; k++) {
      const x = (k / 14) * (W + 200) - 100;
      const y = y0 + Math.sin(k * 0.85 + i * 1.7) * (34 + i * 12) - k * 2.5;
      d += ` Q ${n(x - 55)} ${n(y - 46)} ${n(x)} ${n(y)}`;
    }
    const wdt = 90 + i * 22;
    const col = i % 2 ? 'url(#aur2)' : 'url(#aur1)';
    ribbons += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${wdt}" stroke-linecap="round" opacity="${0.22 - i * 0.02}" style="mix-blend-mode:screen"/>`;
    ribbons += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${Math.round(wdt * 0.28)}" stroke-linecap="round" opacity="0.33" style="mix-blend-mode:screen"/>`;
  }
  const far = smooth(ridgePoints(21, 690, 210, 26, false));
  const mid = smooth(ridgePoints(22, 770, 250, 22, false));
  const near = smooth(ridgePoints(23, 860, 190, 18, false));
  return `<defs>
    ${linGrad('sky', [[0, '#020617'], [0.42, '#071a35'], [0.72, '#0b3352'], [1, '#0e4e63']])}
    ${linGrad('aur1', [[0, '#3ff0c4', 0], [0.2, '#3ff0c4'], [0.55, '#35d0ff'], [1, '#7b6bff']], 0, 0, 1, 0)}
    ${linGrad('aur2', [[0, '#7b6bff', 0], [0.25, '#59a7ff'], [0.6, '#2ef2c0'], [1, '#2ef2c0', 0]], 0, 0, 1, 0)}
    ${linGrad('m1', [[0, '#12384f'], [1, '#081c2b']])}
    ${linGrad('m2', [[0, '#0d2839'], [1, '#061521']])}
    ${linGrad('m3', [[0, '#071620'], [1, '#030a10']])}
    ${radGrad('moonGlow', [[0, '#cfe8ff', 0.4], [1, '#cfe8ff', 0]])}
    ${linGrad('water', [[0, '#0a2a3c'], [0.55, '#061a27'], [1, '#020a10']])}
    ${linGrad('fade', [[0, '#fff'], [0.45, '#fff', 0.35], [1, '#000', 0]])}
    <mask id="reflMask"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#fade)"/></mask>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars(5, 240, 560)}
  ${ribbons}
  <circle cx="1480" cy="176" r="38" fill="#e7f1ff" opacity="0.85"/>
  <circle cx="1480" cy="176" r="110" fill="url(#moonGlow)" opacity="0.5"/>
  <path d="${far}" fill="url(#m1)"/>
  <path d="${mid}" fill="url(#m2)"/>
  <path d="${near}" fill="url(#m3)"/>
  <rect x="0" y="905" width="${W}" height="175" fill="url(#water)"/>
  <g mask="url(#reflMask)" opacity="0.18">
    <path d="${near}" fill="#0e5a6e" transform="translate(0 1810) scale(1 -1)"/>
  </g>
  <g opacity="0.16" stroke="#8fe8ff" stroke-width="2">
    <line x1="140" y1="960" x2="620" y2="960"/><line x1="820" y1="995" x2="1320" y2="995"/>
    <line x1="1180" y1="1030" x2="1760" y2="1030"/><line x1="300" y1="1042" x2="780" y2="1042"/>
  </g>`;
}

function sceneDawn() {
  const sun = `<circle cx="1320" cy="640" r="72" fill="#ffe9c4"/>
    <circle cx="1320" cy="640" r="260" fill="url(#sunGlow)"/>`;
  const layers = [
    ['l1', 470, 300, 30, '#c99bb6', '#8f6f93', 0.9],
    ['l2', 570, 260, 26, '#a4789f', '#6c4c74', 0.95],
    ['l3', 675, 230, 22, '#7e5a7c', '#4c3453', 1],
    ['l4', 800, 210, 18, '#54394f', '#2a1c2c', 1],
  ];
  let defs = '';
  let body = '';
  for (const [id, base, amp, cnt, c1, c2, op] of layers) {
    defs += linGrad(id, [[0, c1], [0.18, c1], [0.55, c2], [1, c2]]);
    body += `<path d="${smooth(ridgePoints(base + amp, base, amp, cnt, false))}" fill="url(#${id})" opacity="${op}"/>`;
  }
  return `<defs>
    ${linGrad('sky', [[0, '#2b2450'], [0.28, '#7a5074'], [0.55, '#d98a7a'], [0.78, '#ffc48a'], [1, '#ffe3b0']])}
    ${radGrad('sunGlow', [[0, '#ffd9a0', 0.55], [0.45, '#ff9e6e', 0.22], [1, '#ff9e6e', 0]])}
    ${defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${cloud(400, 300, 190, 26, '#ffd7c2', 0.18)}
  ${cloud(1100, 240, 240, 30, '#ffe0cc', 0.14)}
  ${cloud(1600, 380, 150, 20, '#ffc9b4', 0.16)}
  ${sun}
  ${body}
  <rect x="0" y="940" width="${W}" height="140" fill="#1a1424" opacity="0.85"/>
  ${cloud(700, 860, 420, 34, '#ffd2b8', 0.1)}`;
}

function sceneForest() {
  const m1 = smooth(ridgePoints(41, 520, 240, 24, false));
  const m2 = smooth(ridgePoints(42, 600, 220, 20, false));
  return `<defs>
    ${linGrad('sky', [[0, '#0b1d1c'], [0.4, '#163b33'], [0.72, '#2c5b45'], [1, '#6f8f63']])}
    ${linGrad('f1', [[0, '#16382f'], [1, '#0a1f1b']])}
    ${linGrad('f2', [[0, '#0e2a22'], [1, '#07140f']])}
    ${radGrad('sunGlow', [[0, '#d8f0b4', 0.35], [1, '#d8f0b4', 0]])}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="1240" cy="320" r="220" fill="url(#sunGlow)"/>
  <path d="${m1}" fill="url(#f1)"/>
  <path d="${m2}" fill="url(#f2)"/>
  <rect x="0" y="760" width="${W}" height="320" fill="#06120e"/>
  ${pines(43, 900, 14, 260, 420, '#081813', 0.82)}
  ${pines(44, 1010, 11, 360, 560, '#030b08', 0.95)}
  <g opacity="0.1" fill="#dfffe0">
    <ellipse cx="700" cy="600" rx="620" ry="34"/>
    <ellipse cx="1150" cy="700" rx="720" ry="42"/>
  </g>`;
}

function sceneOcean() {
  const r = mulberry32(51);
  let shimmer = '';
  for (let i = 0; i < 26; i++) {
    const y = 650 + i * 16 + r() * 8;
    const x = 200 + r() * 1500;
    const len = 80 + r() * 300;
    shimmer += `<line x1="${n(x - len / 2)}" y1="${n(y)}" x2="${n(x + len / 2)}" y2="${n(y)}" stroke="#ffd9b8" stroke-width="${n(1 + r() * 2)}" opacity="${n(0.05 + r() * 0.16)}"/>`;
  }
  return `<defs>
    ${linGrad('sky', [[0, '#241b46'], [0.3, '#6d3f6e'], [0.58, '#c96b74'], [0.74, '#ffb480'], [0.76, '#ffd7a8'], [1, '#2b2738']])}
    ${linGrad('sea', [[0, '#1b2536'], [0.4, '#101a2a'], [1, '#050a13']])}
    ${radGrad('sunGlow', [[0, '#ffe0a8', 0.7], [0.4, '#ff9d6a', 0.25], [1, '#ff9d6a', 0]])}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${cloud(520, 260, 260, 24, '#ffcfae', 0.14)}
  ${cloud(1420, 330, 210, 20, '#ffc0a0', 0.12)}
  <circle cx="960" cy="640" r="66" fill="#ffe6b8"/>
  <circle cx="960" cy="640" r="280" fill="url(#sunGlow)"/>
  <rect x="0" y="640" width="${W}" height="440" fill="url(#sea)"/>
  ${shimmer}
  <rect x="0" y="636" width="${W}" height="4" fill="#ffd9a8" opacity="0.5"/>`;
}

function sceneDunes() {
  const layers = [
    ['d1', 560, 220, 22, '#e9b57a', '#c68a55'],
    ['d2', 680, 200, 18, '#d99a5c', '#a96a3f'],
    ['d3', 810, 190, 15, '#b97645', '#7e4a2d'],
    ['d4', 950, 170, 12, '#7d4a2c', '#43261a'],
  ];
  let defs = '';
  let body = '';
  for (const [id, base, amp, cnt, c1, c2] of layers) {
    defs += linGrad(id, [[0, c1], [1, c2]]);
    body += `<path d="${smooth(ridgePoints(base + amp, base, amp, cnt, false))}" fill="url(#${id})"/>`;
  }
  return `<defs>
    ${linGrad('sky', [[0, '#2a2038'], [0.3, '#7b4a52'], [0.6, '#d9835c'], [0.85, '#ffc07a'], [1, '#ffe0a8']])}
    ${radGrad('sunGlow', [[0, '#fff0c8', 0.6], [0.45, '#ffb56e', 0.2], [1, '#ffb56e', 0]])}
    ${defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="600" cy="520" r="62" fill="#fff2cf"/>
  <circle cx="600" cy="520" r="230" fill="url(#sunGlow)"/>
  ${body}
  <line x1="0" y1="1035" x2="${W}" y2="1035" stroke="#2b1a12" stroke-width="60" opacity="0.35"/>`;
}

function sceneAlpine() {
  const layers = [
    ['a1', 620, 360, 28, '#d7e6f2', '#8aa4bd'],
    ['a2', 700, 330, 24, '#c2d5e6', '#6a849e'],
    ['a3', 800, 300, 20, '#a8bfd4', '#4c637a'],
    ['a4', 910, 250, 16, '#7e94a9', '#2e3d4e'],
  ];
  let defs = '';
  let body = '';
  for (const [id, base, amp, cnt, c1, c2] of layers) {
    defs += linGrad(id, [[0, '#f4fbff'], [0.2, c1], [0.42, c2], [1, '#243140']]);
    body += `<path d="${smooth(ridgePoints(base + amp, base, amp, cnt, true))}" fill="url(#${id})"/>`;
  }
  return `<defs>
    ${linGrad('sky', [[0, '#050b17'], [0.35, '#10213a'], [0.7, '#3b5d7d'], [1, '#8fb0c8']])}
    ${radGrad('moonGlow', [[0, '#dceeff', 0.45], [1, '#dceeff', 0]])}
    ${defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars(61, 170, 520)}
  <circle cx="1520" cy="200" r="46" fill="#eef7ff"/>
  <circle cx="1520" cy="200" r="150" fill="url(#moonGlow)"/>
  ${body}
  <rect x="0" y="1000" width="${W}" height="80" fill="#101a26" opacity="0.8"/>`;
}

function sceneMeadow() {
  const layers = [
    ['h1', 610, 170, 20, '#8fb887', '#6f9a6b'],
    ['h2', 710, 160, 17, '#6f9a63', '#4f784c'],
    ['h3', 830, 140, 14, '#4f7645', '#35552f'],
    ['h4', 970, 120, 11, '#2f4a2a', '#1a2c19'],
  ];
  let defs = '';
  let body = '';
  for (const [id, base, amp, cnt, c1, c2] of layers) {
    defs += linGrad(id, [[0, c1], [1, c2]]);
    body += `<path d="${smooth(ridgePoints(base + amp, base, amp, cnt, false))}" fill="url(#${id})"/>`;
  }
  return `<defs>
    ${linGrad('sky', [[0, '#8fc6e8'], [0.55, '#cfe8f2'], [1, '#f4f1dc']])}
    ${radGrad('sunGlow', [[0, '#fff8dc', 0.45], [1, '#fff8dc', 0]])}
    ${defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="1450" cy="220" r="230" fill="url(#sunGlow)"/>
  ${cloud(360, 220, 210, 30, '#ffffff', 0.55)}
  ${cloud(900, 320, 280, 34, '#ffffff', 0.4)}
  ${cloud(1560, 400, 190, 24, '#ffffff', 0.45)}
  ${body}
  <g opacity="0.35" stroke="#e8f3d0" stroke-width="2">
    <line x1="120" y1="1000" x2="180" y2="940"/><line x1="1560" y1="1020" x2="1620" y2="950"/>
  </g>`;
}

function sceneCanyon() {
  const layers = [
    ['c1', 520, 200, 24, '#b4634c', '#7d3c32'],
    ['c2', 640, 200, 21, '#9c4f3d', '#672e29'],
    ['c3', 760, 190, 18, '#7c3a30', '#4b1f1e'],
    ['c4', 900, 180, 14, '#54241f', '#2a1112'],
  ];
  let defs = '';
  let body = '';
  for (const [id, base, amp, cnt, c1, c2] of layers) {
    defs += linGrad(id, [[0, c1], [0.6, c1], [1, c2]]);
    body += `<path d="${smooth(ridgePoints(base + amp, base, amp, cnt, true))}" fill="url(#${id})"/>`;
  }
  return `<defs>
    ${linGrad('sky', [[0, '#1b1630'], [0.3, '#5a3450'], [0.62, '#c0715c'], [0.85, '#f0b47c'], [1, '#ffd9a0']])}
    ${linGrad('river', [[0, '#f0a86a'], [0.4, '#b86a4a'], [1, '#57262a']])}
    ${radGrad('sunGlow2', [[0, '#ffe0a8', 0.5], [1, '#ffb37a', 0]])}
    ${defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="960" cy="560" r="58" fill="#ffe4b0"/>
  <circle cx="960" cy="560" r="210" fill="url(#sunGlow2)" opacity="0.55"/>
  ${body}
  <path d="M 780 1080 Q 880 900 940 800 Q 1010 690 1180 640 L 1280 640 Q 1080 720 1030 820 Q 990 920 960 1080 Z" fill="url(#river)" opacity="0.9"/>
  <g opacity="0.18" stroke="#ffd9a8" stroke-width="2">
    <line x1="960" y1="700" x2="1060" y2="700"/><line x1="940" y1="760" x2="1080" y2="760"/>
    <line x1="920" y1="830" x2="1090" y2="830"/>
  </g>`;
}

const scenes = [
  ['01-aurora', 'Aurora', sceneAurora],
  ['02-dawn', 'Dawn Ridge', sceneDawn],
  ['03-forest', 'Mistwood', sceneForest],
  ['04-ocean', 'Quiet Sea', sceneOcean],
  ['05-dunes', 'Golden Dunes', sceneDunes],
  ['06-alpine', 'Alpine Moon', sceneAlpine],
  ['07-meadow', 'Green Valley', sceneMeadow],
  ['08-canyon', 'Red Canyon', sceneCanyon],
];

fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const [file, name, fn] of scenes) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${fn()}</svg>`;
  fs.writeFileSync(path.join(OUT, `${file}.svg`), svg);
  manifest.push({ file: `wallpapers/${file}.svg`, name });
  console.log(`${file}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
}

fs.writeFileSync(
  path.join(__dirname, '..', 'app', 'js', 'wallpapers.js'),
  `// Generated by scripts/gen-wallpapers.js\nwindow.AURORA_WALLPAPERS = ${JSON.stringify(manifest, null, 2)};\n`
);
console.log(`\n${manifest.length} wallpapers -> app/wallpapers/`);
