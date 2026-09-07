import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import type { Request, Response, RequestHandler } from 'express';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cindralux-security-'));
process.env.CINDRALUX_DATA_DIR = temp;
const { createApp } = await import('../src/app.ts');
const { createAccessControl, apiRequestGuard, rateLimit, assertSafeJson } = await import('../src/lib/security.ts');
const { DEFAULT_CONFIG, loadConfig, saveConfig, toPublicConfig } = await import('../src/services/config.ts');
const { validateConfigPatch } = await import('../src/lib/configValidation.ts');
const { fetchWithTimeout, safeHttpUrl, addressAllowed, describeError, configuredAgent } = await import('../src/lib/http.ts');
const { writeJson } = await import('../src/lib/jsonStore.ts');
const { resolvePhotoPath } = await import('../src/services/photos.ts');
const { parseCalendarIsolated, parseTrashIsolated } = await import('../src/lib/icsWorker.ts');
const { callService } = await import('../src/services/homeAssistant.ts');
const { createTimer } = await import('../src/services/timers.ts');
const { buildAuthUrl, consumeOAuthState } = await import('../src/services/google.ts');
const { urlHint } = await import('../src/lib/redact.ts');

const servers: http.Server[] = [];
async function listen(server: http.Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
}
const base = await listen(http.createServer(createApp()));
const headers = { 'Content-Type': 'application/json', 'X-Cindralux-Request': '1' };
after(async () => {
  await configuredAgent.close();
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await fs.rm(temp, { recursive: true, force: true });
});

function invoke(middleware: RequestHandler, options: { host?: string; ip?: string; headers?: Record<string, string>; path?: string; method?: string; origin?: string } = {}) {
  const requestHeaders: Record<string, string> = { host: options.host ?? 'localhost:4000', ...options.headers };
  let status = 200; let passed = false;
  const responseHeaders: Record<string, string> = {};
  const req = { headers: requestHeaders, socket: { remoteAddress: options.ip ?? '127.0.0.1' }, path: options.path ?? '/config', method: options.method ?? 'GET',
    get: (key: string) => requestHeaders[key.toLowerCase()], is: (type: string) => requestHeaders['content-type'] === type,
  } as unknown as Request;
  const res = { locals: { requestOrigin: options.origin ?? 'http://localhost:4000' },
    set: (name: string, value: string) => { responseHeaders[name] = value; return res; },
    status: (value: number) => { status = value; return res; }, json: () => res, end: () => res,
  } as unknown as Response;
  middleware(req, res, () => { passed = true; });
  return { status, passed, headers: responseHeaders };
}

test('access: local kiosk, DNS rebinding, remote clients and forwarded-header spoofing', () => {
  const access = createAccessControl();
  assert.equal(invoke(access).passed, true);
  for (const host of ['attacker.example', 'localhost.evil.example', 'localhost:4000@evil.example', 'localhost:4000/path']) assert.equal(invoke(access, { host }).status, 403);
  assert.equal(invoke(access, { ip: '192.168.1.25' }).status, 403);
  assert.equal(invoke(access, { headers: { 'x-forwarded-for': '127.0.0.1' } }).status, 403);
});

test('authentication: HTTPS proxy and strong password required; no loopback proxy bypass', () => {
  const password = 'test-password-with-at-least-20-characters';
  const access = createAccessControl({ password, origin: 'https://display.example' });
  const authorization = 'Basic ' + Buffer.from('cindralux:' + password).toString('base64');
  const proxy = { host: 'display.example', headers: { 'x-forwarded-proto': 'https', authorization } };
  assert.equal(invoke(access, proxy).passed, true);
  assert.equal(invoke(access).status, 401);
  assert.equal(invoke(access, { ...proxy, ip: '192.168.1.25' }).status, 403);
  assert.equal(invoke(access, { host: 'display.example', headers: { authorization } }).status, 403);
  assert.equal(invoke(access, { ...proxy, headers: { 'x-forwarded-proto': 'https' } }).status, 401);
  assert.throws(() => createAccessControl({ password: 'short' }));
  assert.throws(() => createAccessControl({ origin: 'http://display.example' }));
});

test('authentication throttles incorrect credentials', () => {
  const access = createAccessControl({ password: 'long-test-password-123456' });
  const options = { headers: { authorization: 'Basic ' + Buffer.from('cindralux:wrong').toString('base64') } };
  for (let i = 0; i < 10; i++) assert.equal(invoke(access, options).status, 401);
  assert.equal(invoke(access, options).status, 429);
});

test('CSRF: forms, cross-site requests and foreign origins are rejected', () => {
  assert.equal(invoke(apiRequestGuard, { method: 'POST' }).status, 403);
  assert.equal(invoke(apiRequestGuard, { method: 'POST', headers: { 'x-cindralux-request': '1', 'content-type': 'text/plain' } }).status, 415);
  for (const extra of [{ origin: 'https://attacker.example' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }]) {
    assert.equal(invoke(apiRequestGuard, { headers: { 'x-cindralux-request': '1', ...extra } }).status, 403);
  }
  assert.equal(invoke(apiRequestGuard, { method: 'POST', headers: { 'x-cindralux-request': '1', 'content-type': 'application/json', origin: 'http://localhost:4000' } }).passed, true);
  assert.equal(invoke(apiRequestGuard, { path: '/google/callback' }).passed, true);
  assert.equal(invoke(apiRequestGuard, { path: '/photos/file/photo.svg' }).passed, true);
});

test('OAuth callback escapes injected HTML; CSP blocks scripts and framing', async () => {
  const response = await fetch(base + '/api/google/callback?error=' + encodeURIComponent('<script>window.attacked=1</script>'));
  const html = await response.text();
  assert.equal(response.status, 400);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.match(response.headers.get('content-security-policy')!, /script-src 'self'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('API rejects malformed or oversized JSON and prototype-pollution input', async () => {
  for (const [body, expected] of [['{', 400], [JSON.stringify({ __proto__: null, calendars: [null] }), 400], ['{"constructor":{"prototype":{"polluted":true}}}', 400], [JSON.stringify({ value: 'x'.repeat(270000) }), 413]] as const) {
    const response = await fetch(base + '/api/config', { method: 'PUT', headers, body });
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes('stack'));
  }
  assert.throws(() => assertSafeJson(JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('config validates defaults and rejects corrupt arrays, URLs, bounds and duplicate panels', () => {
  assert.deepEqual(validateConfigPatch(DEFAULT_CONFIG, DEFAULT_CONFIG), DEFAULT_CONFIG);
  for (const patch of [null, [], { calendars: [null] }, { calendars: [{ id: 'bad' }] }, { calendarRefreshMinutes: -1 }, { weather: { latitude: 999 } }, { weather: { timezone: 'not/a-zone' } }, { ai: { gptLive: { url: 'javascript:alert(1)' } } }, { ai: { baseUrl: 'http://169.254.169.254' } }, { layout: { custom: [{ span: 12, panels: ['calendar', 'calendar'] }] } }, { appearance: { background: '../data/config.json' } }]) {
    assert.throws(() => validateConfigPatch(patch, DEFAULT_CONFIG));
  }
});

test('secret preservation, private file permissions and redacted errors', async () => {
  const secret = 'private-api-key-for-security-test';
  await saveConfig({ ai: { apiKey: secret } });
  await saveConfig({ ai: { apiKey: '' } });
  const config = await loadConfig();
  assert.equal(config.ai.apiKey, secret);
  assert.ok(!JSON.stringify(toPublicConfig(config)).includes(secret));
  assert.ok(!describeError(new Error(`provider echoed ${secret}`)).includes(secret));
  assert.equal((await fs.stat(path.join(temp, 'config.json'))).mode & 0o777, 0o600);
  assert.equal(urlHint('https://example.test/short-secret.ics'), 'example.test');
  const file = path.join(temp, 'atomic.json');
  await Promise.all(Array.from({ length: 10 }, (_, count) => writeJson(file, { count })));
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.equal(typeof JSON.parse(await fs.readFile(file, 'utf8')).count, 'number');
});

test('config reload does not trigger another file change', async () => {
  const { onConfigChanged } = await import('../src/services/config.ts');
  let changes = 0;
  onConfigChanged(() => { changes++; });
  await saveConfig({ appearance: { backgroundOpacity: 0.5 } });
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.ok(changes >= 1, 'saved configuration must notify watchers');
  const before = changes;
  await loadConfig();
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(changes, before, 'reading configuration must not notify watchers again');
});

test('photo traversal and symlink escape rejected; SVG navigation is sandboxed', async () => {
  const dir = path.join(temp, 'photos');
  await fs.mkdir(dir);
  await saveConfig({ photos: { localDir: dir } });
  await fs.writeFile(path.join(temp, 'outside.jpg'), 'private');
  await fs.symlink(path.join(temp, 'outside.jpg'), path.join(dir, 'escape.jpg'));
  await fs.writeFile(path.join(dir, 'safe.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>window.attacked=1</script></svg>');
  for (const name of ['../outside.jpg', '/etc/passwd', 'escape.jpg', 'bad\0.jpg', '..\\outside.jpg']) assert.equal(await resolvePhotoPath(name), null);
  assert.equal(await resolvePhotoPath('safe.svg'), path.join(dir, 'safe.svg'));
  const response = await fetch(base + '/api/photos/file/safe.svg');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy')!, /sandbox; default-src 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('SSRF: private, metadata, mapped IPv6 and non-HTTP URLs blocked', async () => {
  for (const url of ['file:///etc/passwd', 'http://user:pass@example.test', 'http://127.0.0.1', 'http://2130706433', 'http://[::ffff:127.0.0.1]', 'http://169.254.169.254', 'http://0.0.0.0']) assert.throws(() => safeHttpUrl(url));
  assert.equal(addressAllowed('8.8.8.8', false), true);
  assert.equal(addressAllowed('192.168.1.1', true), true);
  assert.equal(addressAllowed('169.254.169.254', true), false);
  assert.equal(addressAllowed('::ffff:169.254.169.254', true), false);
  await assert.rejects(fetchWithTimeout('http://localhost:9', {}, 1000));
});

test('downloads: bounded decompressed body, full-body timeout and redirect credential protection', async () => {
  let leaked = false;
  const destination = await listen(http.createServer((_req, res) => { leaked = true; res.end('unexpected'); }));
  const upstream = await listen(http.createServer((req, res) => {
    if (req.url === '/slow') { res.writeHead(200); res.flushHeaders(); return; }
    if (req.url === '/large') { res.writeHead(200, { 'Content-Encoding': 'gzip' }); res.end(gzipSync('x'.repeat(100000))); return; }
    if (req.url === '/redirect') { res.writeHead(302, { Location: destination }); res.end(); return; }
    if (req.url === '/metadata') { res.writeHead(302, { Location: 'http://169.254.169.254' }); res.end(); return; }
    res.end('ok');
  }));
  assert.equal(await (await fetchWithTimeout(upstream, {}, 1000, { allowPrivate: true })).text(), 'ok');
  await assert.rejects(fetchWithTimeout(upstream + '/slow', {}, 100, { allowPrivate: true }));
  await assert.rejects(fetchWithTimeout(upstream + '/large', {}, 1000, { allowPrivate: true, maxBytes: 2048 }), /groß/);
  await assert.rejects(fetchWithTimeout(upstream + '/metadata', {}, 1000, { allowPrivate: true }), /nicht erlaubt/);
  await assert.rejects(fetchWithTimeout(upstream + '/redirect', { headers: { Authorization: 'Bearer secret' } }, 1000, { allowPrivate: true }), /Zugangsdaten/);
  await assert.rejects(fetchWithTimeout(upstream + '/redirect', { method: 'POST', body: 'client_secret=secret' }, 1000, { allowPrivate: true }), /Zugangsdaten/);
  assert.equal(leaked, false);
});

test('rate limits reject excess work', () => {
  const limiter = rateLimit(2);
  assert.equal(invoke(limiter).passed, true);
  assert.equal(invoke(limiter).passed, true);
  assert.equal(invoke(limiter).status, 429);
});

test('OAuth state: wrong value does not cancel a pending authorization; replay fails', async () => {
  await saveConfig({ google: { clientId: 'fake-client', clientSecret: 'fake-secret' } });
  const state = new URL(await buildAuthUrl()).searchParams.get('state')!;
  assert.equal(consumeOAuthState('wrong'), false);
  assert.equal(consumeOAuthState(state), true);
  assert.equal(consumeOAuthState(state), false);
});

test('HA: arbitrary request serviceData cannot change the approved action', async () => {
  let received: unknown;
  const upstream = await listen(http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    received = JSON.parse(Buffer.concat(chunks).toString());
    res.setHeader('Content-Type', 'application/json'); res.end('[]');
  }));
  await saveConfig({ homeAssistant: { baseUrl: upstream, token: 'fake-ha-token' }, smartHomeActions: [{ id: 'lamp', label: 'Lampe', icon: 'lamp', kind: 'toggle', domain: 'light', service: 'turn_on', entityId: 'light.safe', serviceData: { brightness: 10 } }] });
  const result = await callService({ domain: 'light', service: 'turn_on', entityId: 'light.safe', serviceData: { entity_id: 'light.other', area_id: 'all', brightness: 255 } });
  assert.equal(result.ok, true);
  assert.deepEqual(received, { brightness: 10, entity_id: 'light.safe' });
  assert.equal((await callService({ domain: 'shell_command', service: 'run' })).ok, false);
});

test('timer validation rejects impossible times and malformed requests', async () => {
  for (const body of [{ kind: 'alarm', time: '99:99' }, { kind: 'alarm', time: '12:00', repeatWeekdays: [999] }, { kind: 'other', seconds: 3 }, { kind: 'timer', seconds: Infinity }]) await assert.rejects(createTimer(body as never));
  assert.equal((await createTimer({ kind: 'timer', seconds: 10, label: 'Test' })).kind, 'timer');
});

test('isolated ICS parser preserves normal recurrences and trash calendars', async () => {
  const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\nDTSTART:20260907T080000Z\r\nDTEND:20260907T090000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const source = { id: 'test', name: 'Test', color: '#ff5a1f', url: '', enabled: true };
  const events = await parseCalendarIsolated(text, source, new Date('2026-09-07'), new Date('2026-09-11'));
  assert.equal(events.length, 3);
  assert.equal(events[0]?.title, 'Test');
  const trash = await parseTrashIsolated(text.replace('SUMMARY:Test', 'SUMMARY:Biotonne'), new Date('2026-09-06'), 10);
  assert.equal(trash[0]?.kind, 'bio');
});

test('hostile recurrence is terminated without blocking the API event loop', { timeout: 20000 }, async () => {
  const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:hostile\r\nDTSTART:19000101T000000Z\r\nDTEND:19000101T000001Z\r\nRRULE:FREQ=SECONDLY\r\nSUMMARY:Hostile\r\nEND:VEVENT\r\nEND:VCALENDAR';
  let ticks = 0;
  const tick = setInterval(() => { ticks++; }, 50);
  try {
    await assert.rejects(parseCalendarIsolated(text, { id: 'test', name: 'Test', color: '#ff5a1f', url: '', enabled: true }, new Date('2026-09-07'), new Date('2026-09-08')));
    assert.ok(ticks > 0, 'API event loop must keep running');
  } finally { clearInterval(tick); }
});
