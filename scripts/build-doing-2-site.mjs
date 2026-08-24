import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '.doing-2-site');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const routes = [
  ['/', 'DOING'],
  ['/market/', 'DOING Market'],
  ['/market/public/', 'DOING Market Public'],
  ['/market/session/', 'DOING Market Session'],
  ['/project/', 'DOING Project'],
  ['/booking/', 'DOING Booking'],
  ['/guide/', 'DOING Guide'],
  ['/workspace/', 'DOING Workspace'],
  ['/me/', 'DOING Member'],
  ['/apply/', 'DOING Apply'],
  ['/register/', 'DOING Register'],
  ['/world-tree/', 'DOING World Tree'],
];

const legacyRedirects = [
  ['/doing-2.html', '/'],
  ['/index.html', '/'],
  ['/market-center.html', '/market/'],
  ['/market-public.html', '/market/public/'],
  ['/market-session.html', '/market/session/'],
  ['/project-center.html', '/project/'],
  ['/booking-2-center.html', '/booking/'],
  ['/booking-center.html', '/booking/'],
  ['/guide-center.html', '/guide/'],
  ['/workspace.html', '/workspace/'],
  ['/member.html', '/me/'],
  ['/member-panel.html', '/me/'],
  ['/smart-application.html', '/apply/'],
  ['/register.html', '/register/'],
  ['/admin.html', '/market/'],
  ['/onsite.html', '/market/'],
  ['/platform.html', '/workspace/'],
  ['/operations-center.html', '/workspace/'],
  ['/photo.html', '/market/'],
  ['/consignment.html', '/market/'],
  ['/about.html', '/'],
];

function routeFile(route) {
  if (route === '/') return path.join(out, 'index.html');
  return path.join(out, route.replace(/^\//, ''), 'index.html');
}

function shell(route, title) {
  const safeRoute = route.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<!doctype html>
<html lang="zh-Hant" data-doing-ui-state="rebuild-shell">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${title}</title>
  <style>
    :root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;color:#202326;background:#fbfaf6}
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%}
    body{min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(560px,100%);border:1px solid #d9ded8;background:#fff;padding:34px 28px;border-radius:10px;box-shadow:0 12px 36px rgba(32,35,38,.06)}
    h1{margin:0 0 12px;font-size:30px;letter-spacing:.02em}
    p{margin:8px 0;line-height:1.7;color:#555d59}
    .route{margin-top:20px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#7b827e}
  </style>
</head>
<body>
  <main aria-labelledby="title">
    <h1 id="title">DOING</h1>
    <p>操作介面正在重新建置。</p>
    <p>此正式網址已保留，舊操作版不再載入。</p>
    <div class="route">${safeRoute}</div>
  </main>
</body>
</html>`;
}

for (const [route, title] of routes) {
  const file = routeFile(route);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, shell(route, title), 'utf8');
}

fs.writeFileSync(path.join(out, '_headers'), `/*
  Cache-Control: no-store, max-age=0
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Robots-Tag: noindex, nofollow, noarchive
`, 'utf8');

fs.writeFileSync(
  path.join(out, '_redirects'),
  legacyRedirects.map(([from, to]) => `${from} ${to} 301`).join('\n') + '\n',
  'utf8',
);

const expectedHtml = routes.map(([route]) => path.relative(out, routeFile(route)).replaceAll(path.sep, '/')).sort();
const actualHtml = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fp);
    else if (entry.name.endsWith('.html')) actualHtml.push(path.relative(out, fp).replaceAll(path.sep, '/'));
  }
}
walk(out);
actualHtml.sort();
if (JSON.stringify(actualHtml) !== JSON.stringify(expectedHtml)) {
  throw new Error(`unexpected public HTML set: ${JSON.stringify(actualHtml)}`);
}

for (const file of actualHtml) {
  const html = fs.readFileSync(path.join(out, file), 'utf8');
  for (const forbidden of ['<script', '<form', '<button', 'tobeloved-api', 'supabase.co', 'localStorage', 'sessionStorage', '2bl-v7']) {
    if (html.includes(forbidden)) throw new Error(`interactive/legacy content leaked into ${file}: ${forbidden}`);
  }
  if (!html.includes('data-doing-ui-state="rebuild-shell"')) throw new Error(`rebuild marker missing: ${file}`);
}

const topLevel = fs.readdirSync(out).sort();
const allowedTopLevel = ['_headers','_redirects','apply','booking','guide','index.html','market','me','project','register','workspace','world-tree'].sort();
if (JSON.stringify(topLevel) !== JSON.stringify(allowedTopLevel)) {
  throw new Error(`unexpected deployed artifact: ${JSON.stringify(topLevel)}`);
}

console.log(JSON.stringify({
  result: 'PASS',
  mode: 'clean-slate-route-shells',
  routeCount: routes.length,
  routes: routes.map(([route]) => route),
  legacyRedirectCount: legacyRedirects.length,
  interactiveUiPublished: false,
  apiCallsPublished: false,
  databaseWrites: 0,
  workerChanges: 0,
  twoBlChanges: 0,
}, null, 2));
