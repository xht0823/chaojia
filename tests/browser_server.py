import os
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DEEPSEEK_API_KEY'] = ''
import main
import uvicorn

original = main.lifespan

from contextlib import asynccontextmanager

@asynccontextmanager
async def test_lifespan(app):
    async with original(app):
        app.state.client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
            create=AsyncMock(return_value=SimpleNamespace(choices=[SimpleNamespace(
                finish_reason='stop', message=SimpleNamespace(content='场景判断：职场沟通场景\n\n## 一、你的处境\n虚构浏览器测试报告。')
            )]))
        )))
        yield

if __name__ == '__main__':
    if not os.environ.get('APP_DATABASE_PATH'):
        raise RuntimeError('A temporary test database path is required')
    main.app.router.lifespan_context = test_lifespan
    uvicorn.run(main.app, host='127.0.0.1', port=int(sys.argv[1]), access_log=False, log_level='critical', proxy_headers=False)
