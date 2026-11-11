const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
require('ts-node').register({ project: path.resolve(__dirname, '../tsconfig.json') });
require('reflect-metadata');
const { Module, Global } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const passport = require('passport');
const sharp = require('sharp');
const { MediaModule } = require('../src/media/media.module');
const { isPostImageUrl } = require('../src/media/image-url.validator');
const { CreatePostDto } = require('../src/content/dto/create-post.dto');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');

test('image upload HTTP flow: permissions, multipart, persistence, validation and public retrieval', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'miniapp-image-test-'));
  // Test-only identity provider; production uses the actual JwtStrategy.
  class TestStrategy extends passport.Strategy {
    constructor() { super(); this.name = 'jwt'; }
    authenticate(req) {
      const role = req.headers['x-test-role'];
      if (!role) return this.fail(401);
      this.success({ id: 'test', type: role === 'citizen' ? 'citizen' : 'admin', role });
    }
  }
  passport.use('jwt', new TestStrategy());
  class TestConfig {}
  Global()(TestConfig);
  Module({ providers: [{ provide: ConfigService, useValue: { get: () => dir } }], exports: [ConfigService] })(TestConfig);
  class TestApp {}
  Module({ imports: [TestConfig, MediaModule] })(TestApp);
  const app = await NestFactory.create(TestApp, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api/v1');
  t.after(async () => {
    await app.close();
    passport.unuse('jwt');
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith('miniapp-image-test-'));
    await fs.rm(dir, { recursive: true, force: true });
  });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const png = await sharp({ create: { width: 1800, height: 900, channels: 3, background: '#1255ee' } }).png().toBuffer();
  async function upload(bytes, role = 'SUPER_ADMIN', filename = 'photo.png', second = false) {
    const body = new FormData();
    if (bytes) body.append('file', new Blob([bytes], { type: 'image/png' }), filename);
    if (second) body.append('file', new Blob([bytes]), filename);
    return fetch(base + '/api/v1/media/images', { method: 'POST', body,
      headers: role ? { 'x-test-role': role } : {} });
  }
  await t.test('anonymous and unauthorized roles cannot upload', async () => {
    assert.equal((await upload(png, null)).status, 401);
    for (const role of ['citizen', 'REVIEWER', 'COUNTER_STAFF']) assert.equal((await upload(png, role)).status, 403);
  });
  await t.test('editor uploads an image and it is resized and served as WebP', async () => {
    const res = await upload(png, 'EDITOR');
    const result = await res.json();
    assert.equal(res.status, 201, JSON.stringify(result));
    assert.equal(result.width, 1600);
    assert.equal(result.height, 800);
    assert.equal(isPostImageUrl(result.url), true);
    const image = await fetch(base + result.url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/webp');
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.equal((await sharp(bytes).metadata()).format, 'webp');
    assert.deepEqual(bytes, await fs.readFile(path.join(dir, 'images', path.basename(result.url))));
    const dto = plainToInstance(CreatePostDto, { type: 'NEWS', title: 'Test', content: 'Test', thumbnail: result.url });
    assert.equal(validateSync(dto).length, 0);
  });
  await t.test('valid JPEG and WebP images are accepted', async () => {
    for (const format of ['jpeg', 'webp']) {
      const bytes = await sharp(png).toFormat(format).toBuffer();
      assert.equal((await upload(bytes, 'SUPER_ADMIN', 'photo.' + format)).status, 201);
    }
  });
  await t.test('missing, fake, corrupt, animated/unsupported and oversized files are rejected', async () => {
    assert.equal((await upload(null)).status, 400);
    assert.equal((await upload(Buffer.from('<html>not an image</html>'))).status, 400);
    assert.equal((await upload(png.subarray(0, 40))).status, 400);
    assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'))).status, 400);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    assert.equal((await upload(png, 'EDITOR', 'photo.png', true)).status, 400);
  });
  await t.test('only valid stored filenames are served and existing HTTPS links remain valid', async () => {
    assert.equal((await fetch(base + '/api/v1/media/images/.env')).status, 404);
    assert.equal((await fetch(base + '/api/v1/media/images/00000000-0000-0000-0000-000000000000.webp')).status, 404);
    assert.equal(isPostImageUrl('https://example.com/image.jpg'), true);
    for (const url of ['http://example.com/image.jpg', 'javascript:alert(1)', '/api/v1/media/images/../../.env', 'data:image/png;base64,aaa']) {
      assert.equal(isPostImageUrl(url), false);
    }
  });
});
