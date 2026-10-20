// Static checks: JS syntax, asset paths, duplicate IDs, i18n keys, FAQ count, removed studios, branding.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

const html = read('index.html');
// local assets
const refs = [...html.matchAll(/(?:src|href)="(?!https?:|#|mailto:)([^"]+)"/g)].map((m) => m[1]);
refs.forEach((r) => ok(fs.existsSync(path.join(root, r)), 'asset exists: ' + r));
// duplicate ids
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
ok(new Set(ids).size === ids.length, 'no duplicate HTML ids (' + ids.length + ')');
// getElementById targets exist
const js = fs.readdirSync(path.join(root, 'assets/js')).map((f) => read('assets/js/' + f)).join('\n');
const used = [...js.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map((m) => m[1]);
const missing = [...new Set(used)].filter((i) => !ids.includes(i));
ok(!missing.length, 'all $("id") targets exist' + (missing.length ? ': ' + missing : ''));
// JS syntax
fs.readdirSync(path.join(root, 'assets/js')).forEach((f) => { try { new vm.Script(read('assets/js/' + f), { filename: f }); ok(true, 'JS syntax ' + f); } catch (e) { ok(false, 'JS syntax ' + f + ' ' + e.message); } });
// CSS brace balance
['styles.css', 'animations.css'].forEach((f) => { const c = read('assets/css/' + f).replace(/\/\*[\s\S]*?\*\//g, ''); ok((c.match(/{/g) || []).length === (c.match(/}/g) || []).length, 'CSS braces balanced ' + f); });
// i18n keys
global.SX = {}; global.window = global; require('../assets/js/utils.js'); require('../assets/js/translations.js');
const D = SX.i18n.dict;
const keys = new Set([...html.matchAll(/data-i18n(?:-aria|-ph)?="([^"]+)"/g)].map((m) => m[1]));
[...js.matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)].forEach((m) => { if (!m[1].endsWith('.')) keys.add(m[1]); });
const dyn = [];
['idle', 'initializing', 'measuringLatency', 'measuringDownload', 'measuringUpload', 'finalizing', 'completed', 'partial', 'cancelled', 'offline', 'failed', 'unsupported', 'timeout'].forEach((k) => dyn.push('state.' + k));
['completed', 'partial', 'failed', 'cancelled', 'offline', 'timeout', 'unsupported'].forEach((k) => dyn.push('status.' + k));
['idle', 'init', 'latency', 'download', 'upload', 'done'].forEach((k) => dyn.push('gauge.p.' + k));
['latency', 'download', 'upload'].forEach((k) => dyn.push('phase.' + k));
['network', 'timeout', 'http', 'offline', 'unsupported', 'cancelled'].forEach((k) => dyn.push('err.' + k));
['empty', 'invalid', 'negative', 'zero', 'tooLarge'].forEach((k) => dyn.push('err.num.' + k));
['format', 'leadingZero', 'range', 'empty', 'cidrRange', 'maskFormat', 'maskNotContiguous'].forEach((k) => dyn.push('err.sn.' + k));
['empty', 'format', 'length'].forEach((k) => dyn.push('err.dom.' + k));
['invalid', 'rate', 'http', 'badResponse', 'timeout', 'network'].forEach((k) => dyn.push('err.dns.' + k));
['timeout', 'network'].forEach((k) => dyn.push('err.ip.' + k));
['empty', 'scheme', 'format', 'httpsOnly', 'credentials', 'local'].forEach((k) => dyn.push('err.url.' + k));
['private', 'loopback', 'linkLocal', 'cgnat', 'multicast', 'reserved', 'thisNetwork', 'public'].forEach((k) => dyn.push('ipkind.' + k));
['collecting', 'stable', 'fair', 'unstable'].forEach((k) => dyn.push('stab.v.' + k));
['browsing', 'hd', 'uhd', 'calls', 'gaming', 'large'].forEach((k) => { dyn.push('adv.' + k, 'adv.' + k + '.d'); });
['good', 'fair', 'poor', 'unknown'].forEach((k) => dyn.push('lvl.' + k));
['up', 'down', 'flat'].forEach((k) => dyn.push('trend.' + k));
['mobile', 'wifi', 'speed', 'gaming', 'security', 'trouble'].forEach((k) => dyn.push('cat.' + k));
['stability', 'troubleshoot', 'calc', 'subnet', 'dns', 'ip', 'endpoint', 'advisor', 'safety'].forEach((k) => dyn.push('tool.' + k));
['p2p', 'host'].forEach((k) => dyn.push('sub.' + k));
dyn.forEach((k) => keys.add(k));
const bad = [...keys].filter((k) => !D[k] || !D[k][0] || !D[k][1]);
ok(!bad.length, 'every i18n key has EN + HI (' + keys.size + ' keys)' + (bad.length ? ' MISSING: ' + bad.join(', ') : ''));
// FAQ
require('../assets/js/faq-data.js');
const F = SX.FAQ;
ok(F.length === 50, 'FAQ count is exactly 50 (' + F.length + ')');
ok(new Set(F.map((f) => f.id)).size === 50, '50 unique FAQ ids');
const want = { mobile: 10, wifi: 10, speed: 8, gaming: 7, security: 7, trouble: 8 };
Object.keys(want).forEach((c) => ok(F.filter((f) => f.c === c).length === want[c], 'FAQ category ' + c + ' = ' + want[c]));
ok(F.every((f) => f.q.en && f.q.hi && f.a.en && f.a.hi && f.k.length), 'every FAQ has EN/HI question+answer and keywords');
ok(F.every((f) => /[\u0900-\u097F]/.test(f.q.hi) && /[\u0900-\u097F]/.test(f.a.hi)), 'Hindi fields contain Devanagari');
ok(new Set(F.map((f) => f.q.en)).size === 50, 'unique English questions');
// removed scope / branding
['QR Studio', 'Image Studio', 'merge pdf', 'split pdf'].forEach((w) => ok(!new RegExp(w, 'i').test(html), 'removed module not in HTML: ' + w));
ok(html.includes('Created By Shiv Yogi'), 'branding "Created By Shiv Yogi" present');
ok(html.includes('CONNECT. MEASURE. CREATE.') && html.includes('YOUR DIGITAL WORLD, REDEFINED.') || D['footer.tag'][0].includes('REDEFINED'), 'taglines present');
ok(!/localStorage|sessionStorage/.test(read('assets/js/speed-test.js')), 'speed engine uses no storage');
ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(js.replace(/\/\*[\s\S]*?\*\//g, '')), 'no unsafe HTML sinks (innerHTML/eval) in JS');
ok(!/api[_-]?key|secret|token/i.test(js.replace(/token/g, '')), 'no API keys/secrets in JS');
// animations
const anim = read('assets/css/animations.css');
const n = new Set([...anim.matchAll(/^\/\* (\d+) /gm)].map((m) => m[1]));
const header = anim.match(/1 Logo Reveal[\s\S]*?25 Reduced-Motion Alternative/)[0];
ok((header.match(/\d+ [A-Z]/g) || []).length >= 25, 'animation header lists 25 patterns');
['letter-in', 'x-in', 'intro-in', 'drift-a', 'card-in', 'draw', 'spin', 'toast-in', 'modal-in', 'panel-in', 'bounce', 'msg-in', 'report-in', 'shimmer', 'copied', 'star-pop', 'pulse'].forEach((k) => ok(anim.includes('@keyframes ' + k), 'keyframes defined: ' + k));
ok(/prefers-reduced-motion: reduce/.test(anim) && /data-motion="reduce"/.test(anim), 'reduced-motion rules present');
console.log(fail ? '\n' + fail + ' FAILED' : '\nALL STATIC CHECKS PASSED');
process.exit(fail ? 1 : 0);
