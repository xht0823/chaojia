import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = await mkdtemp(path.join(tmpdir(), 'chaowan-ocr-real-'));
const port = 18083;
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const server = spawn(python, [path.join(root, 'tests/browser_server.py'), String(port)], {
  cwd: root,
  env: { ...process.env, APP_DATABASE_PATH: path.join(temporary, 'test.db'), DEEPSEEK_API_KEY: '', PYTHONDONTWRITEBYTECODE: '1' },
  stdio: 'ignore',
});
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
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/');
  const password = 'ocr-real-123';
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.getByLabel('用户名', { exact: true }).fill('ocr_real');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '注册账号', exact: true }).click();
  await page.getByText('注册成功').waitFor();
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录并开始复盘' }).click();
  await page.getByRole('textbox', { name: '输入吵架经过或纠纷对话' }).waitFor();
  await page.getByRole('button', { name: '上传聊天截图识别' }).click();

  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 800, 240);
    ctx.fillStyle = '#000000'; ctx.font = '900 96px Arial';
    ctx.textBaseline = 'middle';
    ctx.fillText('HELLO 12345', 40, 120);
    return canvas.toDataURL('image/png');
  });
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  await page.getByLabel('选择聊天截图').setInputFiles({ name: 'chat.png', mimeType: 'image/png', buffer });
  await page.getByRole('button', { name: '开始识别' }).click();
  await page.getByLabel('识别文字（请检查并编辑）').waitFor({ timeout: 120000 });
  const recognized = await page.getByLabel('识别文字（请检查并编辑）').inputValue();
  assert.match(recognized.toUpperCase(), /HELLO/);
  await page.getByRole('button', { name: /填入草稿/ }).click();
  const draft = await page.getByRole('textbox', { name: '输入吵架经过或纠纷对话' }).inputValue();
  assert.match(draft.toUpperCase(), /HELLO/);
  console.log('PASS: real browser OCR recognized clean English text and filled the draft for manual confirmation');
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  await rm(temporary, { recursive: true, force: true });
}
