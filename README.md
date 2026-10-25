# 吵完才懂

> 吵架之后，别憋着也别乱怼。把对话贴进来，一分钟理清：你现在什么处境、对方在玩什么套路、你缺什么、下一步怎么走。

一个面向普通人的**沟通复盘助手**。你把吵架 / 纠纷的对话粘贴进来，或者上传一张聊天截图，它用 DeepSeek 生成一份「懂你但不煽情」的结构化复盘报告——先接住你的情绪，再给你能直接念出来的行动话术。

---

## 它能做什么

- **贴对话，出报告**：粘贴一段糟心对话或纠纷描述，自动判断场景并生成复盘。
- **截图也能识别**：上传聊天截图，浏览器本地 OCR 转成文字（原图不上传、不落库），可编辑后直接生成复盘。
- **两种深度**：
  - **快速模式（默认）**：只给「场景判断 + 一句核心结论 + 2-3 条怎么做 + 一句收尾」，不啰嗦。
  - **深度思考**：完整四模块报告——你的处境 / 对方在耍什么套路 / 你缺什么 / 下一步怎么走。
- **四种场景自动适配**：情侣沟通 · 家长里短 · 职场沟通 · 消费 / 租房纠纷，语气和侧重点各不相同。
- **连续复盘**：同一会话里接着上文分析，不重复已经给过的结论。
- **情绪价值优先**：先接住你的感受、肯定你已经做的努力，再给可执行的动作，不说教、不指责、不教你怼人。

## 账号与额度

| | 免费额度 |
|---|---|
| 游客（免注册） | 15 次 / 天 |
| 注册账号 | 40 次 / 天 |
| 会员（月 / 年 / 终身卡） | 不限次 |

- 会员卡为**模拟支付演示**，不真实扣款、不收集支付信息。
- **隐私**：账号和额度存在本地 SQLite；你输入的内容、生成的报告、对话历史**一律不落库、不缓存**。

## 技术栈

- **后端**：FastAPI + SQLite（Argon2id 密码哈希、HttpOnly Cookie 会话）
- **前端**：React 19 + Vite + Tailwind CSS 4 + framer-motion
- **AI**：DeepSeek（`deepseek-flash`）
- **OCR**：Tesseract.js（纯浏览器本地识别）

## 快速开始

需要 Python 3.10+ 和 Node 20+。

### 1. 后端

```sh
# 项目根目录
python -m venv .venv
source .venv/Scripts/activate        # Windows Git Bash；macOS/Linux 用 .venv/bin/activate
python -m pip install -r requirements.txt

# 配置 DeepSeek Key（不要写进代码或提交）
export DEEPSEEK_API_KEY="sk-..."

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log --log-level critical --no-proxy-headers
```

### 2. 前端

```sh
cd frontend
npm install --registry=https://registry.npmjs.org
npm run dev
```

访问 **http://127.0.0.1:5173/**，先点「注册」再登录（或直接「游客试用」）。Vite 已把 `/api` 和 `/review` 代理到后端 8000 端口。

> 没配 Key 也能用账号功能，只是生成报告会返回 503 且不扣次数。

### 生产 / 同源部署

```sh
cd frontend && npm run build
# 回到项目根目录，启动后端
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

构建后后端会直接托管前端，访问 `http://127.0.0.1:8000/` 就是完整应用，无需另开前端。根目录已提供 `Dockerfile`。

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek Key，报告生成必需 | 空 |
| `APP_DATABASE_PATH` | SQLite 路径，相对路径按项目根目录算 | `data/app.db` |
| `APP_ALLOWED_ORIGINS` | 允许的精确来源，逗号分隔 | `http://127.0.0.1:5173,http://localhost:5173` |
| `APP_COOKIE_SECURE` | 生产 HTTPS 下设为 `true` | `false` |
| `APP_ALLOW_ANY_ORIGIN` | 放开来源校验（仅调试） | `false` |

## API 一览

| 接口 | 说明 |
|---|---|
| `POST /api/auth/register` | 注册 `{username, password}` |
| `POST /api/auth/login` | 登录，设置 Cookie |
| `POST /api/auth/guest` | 游客免登录 |
| `GET /api/me` | 当前用户与额度 |
| `POST /api/auth/logout` | 退出登录 |
| `POST /review` | 生成复盘 `{text, scene:"auto", deep?, context?}` |
| `GET /api/plans` | 会员卡列表（需登录） |
| `POST /api/membership/purchase` | 模拟开通会员（游客 403） |

所有 POST 需要 `Content-Type: application/json` 和 `X-Chaowan-Client: web`，并带登录 Cookie；前端已自动处理。

## 目录结构

```
chao/
├── main.py          # FastAPI 应用：/review、静态托管、中间件
├── auth.py          # 注册/登录/游客/会话/会员卡接口
├── database.py      # SQLite：账号、额度预占/结算、会员
├── requirements.txt
├── Dockerfile
├── data/            # SQLite 数据库（启动自动建表）
├── tests/           # 后端测试（临时库 + 模拟模型）
└── frontend/
    ├── src/         # React 前端
    ├── public/ocr/  # Tesseract.js 引擎与中英文资源
    └── scripts/     # OCR 资源准备脚本（predev/prebuild 自动跑）
```

## 测试

```sh
# 后端（不消耗真实额度、不碰真实数据库）
python -m unittest discover -s tests -v

# 前端
cd frontend && npm run build
```

## 安全与部署边界（简）

- 生产必须 HTTPS，设 `APP_COOKIE_SECURE=true` 和正确的 `APP_ALLOWED_ORIGINS`；本地用 `--no-proxy-headers`。
- 报告内容会发给 DeepSeek 生成，其留存政策由第三方决定，无法承诺第三方零留存。
- SQLite 面向单实例；多实例 / 高并发请换 PostgreSQL 并在网关层加共享限流。
- 会员是演示，真实收费上线前还需支付渠道、回调验签、退款与合规。

> 公开部署需要你自己的托管账号（Render / Railway / Fly.io / VPS）和 DeepSeek Key；我无法替你开户或绑定。
