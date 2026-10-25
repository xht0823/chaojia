import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = await mkdtemp(path.join(tmpdir(), 'chaowan-auth-test-'));
const port = 18081;
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const server = spawn(python, [path.join(root, 'tests/browser_server.py'), String(port)], {
  cwd: root,
  env: { ...process.env, APP_DATABASE_PATH: path.join(temporary, 'test.db'), DEEPSEEK_API_KEY: '', PYTHONDONTWRITEBYTECODE: '1' },
  stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/openapi.json`)).ok) break; } catch { /* wait for startup */ }
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
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  const password = 'browser-test-123';
  async function register(name) {
    await page.getByRole('button', { name: '注册', exact: true }).click();
    await page.getByLabel('用户名', { exact: true }).fill(name);
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByLabel('确认密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '注册账号', exact: true }).click();
    await page.getByText('注册成功。现在用刚才的用户名和密码登录吧。').waitFor();
    assert.equal(await page.getByLabel('密码', { exact: true }).inputValue(), '');
    assert.equal(await page.getByRole('textbox', { name: '输入吵架经过或纠纷对话' }).count(), 0);
  }
  async function login() {
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录并开始复盘' }).click();
    await page.getByRole('textbox', { name: '输入吵架经过或纠纷对话' }).waitFor();
  }
  await register('browser_one');
  await login();
  const input = page.getByRole('textbox', { name: '输入吵架经过或纠纷对话' });
  await input.fill('虚构测试输入');
  await page.getByRole('button', { name: '发送，开始复盘' }).click();
  await page.getByText('虚构浏览器测试报告。').waitFor();
  await page.getByText('剩余 39 次', { exact: true }).waitFor();
  await input.fill('返回场景时保留的草稿');
  await page.getByText('返回四个场景', { exact: true }).click();
  for (const name of ['情侣吵架', '职场甩锅', '家长里短', '租房押金']) {
    await page.getByRole('button', { name: new RegExp(name) }).waitFor();
  }
  assert.equal(await input.inputValue(), '返回场景时保留的草稿');
  await page.getByText('今天还可以复盘 39 次', { exact: true }).waitFor();
  await page.getByRole('button', { name: '继续刚才的复盘' }).click();
  await page.getByText('虚构浏览器测试报告。').waitFor();
  await page.getByRole('button', { name: '个人主页', exact: true }).click();
  await page.getByText('browser_one · 免费版', { exact: true }).waitFor();
  await page.getByText('今天已用 1 / 40', { exact: true }).waitFor();
  await page.getByRole('button', { name: /高级会员/ }).click();
  await page.getByRole('heading', { name: '高级会员' }).waitFor();
  await page.getByRole('button', { name: '立即购买' }).click();
  await page.getByText('无限次', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: '个人主页', exact: true }).click();
  await page.getByText('月卡会员', { exact: true }).first().waitFor();
  await page.getByText('高级会员，不限次数', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '个人主页', exact: true }).click();
  await page.getByText('月卡会员', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.getByRole('button', { name: '登录并开始复盘' }).waitFor();
  await register('browser_two');
  await login();
  assert.equal(await page.getByText('虚构浏览器测试报告。').count(), 0);
  assert.equal(await input.inputValue(), '');
  await page.getByRole('button', { name: '个人主页', exact: true }).click();
  await page.getByText('browser_two · 免费版', { exact: true }).waitFor();
  await page.getByText('今天已用 0 / 40', { exact: true }).waitFor();
  const other = await context.newPage();
  await other.goto('http://127.0.0.1:5173/');
  await other.getByRole('textbox', { name: '输入吵架经过或纠纷对话' }).waitFor();
  await page.getByRole('button', { name: '退出登录' }).click();
  await other.getByRole('button', { name: '登录并开始复盘' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: real registration/login/database, mock report charge, refresh, logout, account isolation, cross-tab logout, mobile layout');
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  await rm(temporary, { recursive: true, force: true });
}
