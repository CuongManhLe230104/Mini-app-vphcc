const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const project = process.env.REVIEW_PROJECT || path.resolve(__dirname, '..');

async function loadService(file, globals = {}, sdkOverrides = {}) {
  const context = vm.createContext({ Headers, console, navigator: { onLine: true }, ...globals });
  const names = ['getAccessToken', 'getUserInfo', 'getPhoneNumber', 'getSetting', 'authorize', 'followOA', 'openChat', 'openPhone', 'openWebview', 'openMediaPicker', 'getSystemInfo'];
  const sdk = new vm.SyntheticModule(names, function () {
    for (const name of names) this.setExport(name, sdkOverrides[name] || (async () => undefined));
  }, { context });
  const mod = new vm.SourceTextModule(fs.readFileSync(path.join(project, file), 'utf8'), {
    context, initializeImportMeta(meta) { meta.env = {}; },
  });
  await mod.link((name) => {
    assert.equal(name, 'zmp-sdk');
    return sdk;
  });
  await mod.evaluate();
  return mod.namespace;
}

test('Zalo access token is returned intact as a string', async () => {
  const mod = await loadService('src/services/zalo/index.js', {}, { getAccessToken: async () => 'test-access-token' });
  assert.equal(await mod.getZaloAccessToken(), 'test-access-token');
});

for (const [wrapper, sdk, input] of [['openZaloChat', 'openChat', '12345'], ['callHotline', 'openPhone', '0901234567'], ['openServicePortal', 'openWebview', 'https://example.com']]) {
  test(`${wrapper} lets the caller await SDK completion`, async () => {
    let complete;
    const pending = new Promise(resolve => { complete = resolve; });
    const mod = await loadService('src/services/zalo/index.js', {}, { [sdk]: () => pending });
    const result = mod[wrapper](input);
    assert.equal(typeof result?.then, 'function');
    complete();
    await result;
  });
}

test('placeholder hotline and missing OA are rejected before calling SDK', async () => {
  let called = false;
  const mod = await loadService('src/services/zalo/index.js', {}, { openPhone: async () => { called = true; } });
  await assert.rejects(() => mod.callHotline('0274.XXX.XXXX'));
  await assert.rejects(() => mod.followZaloOA(''));
  assert.equal(called, false);
});

test('API preserves JSON content type with an authorization header', async () => {
  const { api } = await loadService('src/services/api/index.js', { fetch: async (url, options) => {
    const headers = new Headers(options.headers);
    assert.equal(headers.get('authorization'), 'Bearer test');
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(JSON.parse(options.body).title, 'Tin thử');
    return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
  }});
  assert.equal((await api.post('/posts', { title: 'Tin thử' }, { headers: { Authorization: 'Bearer test' } })).ok, true);
});

test('API accepts HTTP 204 and an empty response body', async () => {
  const { api } = await loadService('src/services/api/index.js', { fetch: async () => new Response(null, { status: 204 }) });
  assert.equal(await api.post('/action', {}), undefined);
});

test('API errors preserve the actual HTTP status and validation message', async () => {
  const { api } = await loadService('src/services/api/index.js', { fetch: async () => new Response('{"status":200,"message":["A","B"]}', { status: 401 }) });
  await assert.rejects(() => api.get('/private'), e => e.status === 401 && e.message === 'A; B');
});

test('API reports offline network failure', async () => {
  const { api } = await loadService('src/services/api/index.js', { navigator: { onLine: false }, fetch: async () => { throw new TypeError('Network failed'); } });
  await assert.rejects(() => api.get('/posts'), e => e.code === 'OFFLINE');
});

test('every rendered ZaUI icon exists in the installed icon set', () => {
  const definitions = fs.readFileSync(path.join(project, 'node_modules/zmp-ui/esm/components/icon/icons.js'), 'utf8');
  const icons = new Set([...definitions.matchAll(/(zi_\w+):/g)].map(m => m[1].replaceAll('_', '-')));
  for (const name of fs.readdirSync(path.join(project, 'src/pages')).filter(n => n.endsWith('.jsx'))) {
    const source = fs.readFileSync(path.join(project, 'src/pages', name), 'utf8');
    for (const [, icon] of source.matchAll(/["'](zi-[\w-]+)["']/g)) assert.ok(icons.has(icon), `${name}: unknown icon ${icon}`);
  }
});
