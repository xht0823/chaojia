import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = await mkdtemp(path.join(tmpdir(), 'chaowan-image-test-'));
const port = 18082;
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const server = spawn(python, [path.join(root, 'tests/browser_server.py'), String(port)], {
  cwd: root,
  env: { ...process.env, APP_DATABASE_PATH: path.join(temporary, 'test.db'), DEEPSEEK_API_KEY: '', PYTHONDONTWRITEBYTECODE: '1' },
  stdio: 'ignore',
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const onePixel = path.join(temporary, 'one.png');
const tooLarge = path.join(temporary, 'large.bin');
await writeFile(onePixel, png);
await writeFile(tooLarge, Buffer.alloc(6 * 1024 * 1024, 1));

let browser;
try {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/openapi.json`)).ok) break; } catch { /* wait */ }
    if (i === 99) throw new Error('Test backend startup failed');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {});
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.route(/\/api\/|\/review$/, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const response = await route.fetch({ url: `http://127.0.0.1:${port}${pathname}` });
    await route.fulfill({ response });
  });
  let reviewCalls = 0;
  await context.route('**/review', async (route) => { reviewCalls += 1; await route.continue(); });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/');
  const password = 'image-test-123';
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.getByLabel('用户名', { exact: true }).fill('image_user');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '注册账号', exact: true }).click();
  await page.getByText('注册成功').waitFor();
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录并开始复盘' }).click();
  await page.getByRole('textbox', { name: '输入吵架经过或纠纷对话' }).waitFor();

  await page.getByRole('button', { name: '上传聊天截图识别' }).click();
  await page.getByText('从聊天截图开始').waitFor();
  assert.equal(reviewCalls, 0);

  const file = page.getByLabel('选择聊天截图');
  await file.setInputFiles(tooLarge);
  await page.getByText(/图片超过 5 MiB/).waitFor();
  assert.equal(await page.getByRole('button', { name: '开始识别' }).count(), 0);

  await file.setInputFiles(onePixel);
  await page.getByAltText('待识别聊天截图预览').waitFor();
  await page.getByRole('button', { name: '开始识别' }).waitFor();
  assert.equal(reviewCalls, 0);

  await page.getByRole('button', { name: '关闭截图识别' }).click();
  await page.getByText('从聊天截图开始').waitFor({ state: 'detached' });
  assert.equal(reviewCalls, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('chaowan:demo-quota:v1')), null);
  console.log('PASS: image entry opens, oversize rejected before OCR, valid image previews, no review request or quota charge');
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  await rm(temporary, { recursive: true, force: true });
}
