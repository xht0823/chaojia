import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import auth
from database import Database, QuotaError, FREE_DAILY_LIMIT, today_key
import main

HEADERS = {'X-Chaowan-Client': 'web', 'Origin': 'http://127.0.0.1:5173'}
PASSWORD = 'test-password-123'


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'APP_DATABASE_PATH': str(Path(self.directory.name) / 'test.db'), 'DEEPSEEK_API_KEY': ''})
        self.env.start()
        auth.limiter.entries.clear()
        self.client = TestClient(main.app, headers=HEADERS)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.env.stop()
        self.directory.cleanup()

    def register(self, name='tester'):
        return self.client.post('/api/auth/register', json={'username': name, 'password': PASSWORD})

    def login(self, name='tester', password=PASSWORD):
        return self.client.post('/api/auth/login', json={'username': name, 'password': password})

    def mock_model(self, text='## 一、你的处境\n模拟报告', finish='stop', error=None):
        create = AsyncMock(side_effect=error) if error else AsyncMock(return_value=SimpleNamespace(choices=[SimpleNamespace(finish_reason=finish, message=SimpleNamespace(content=text))]))
        main.app.state.client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        return create

    def test_registration_requires_login_and_hashes_secrets(self):
        self.assertEqual(self.register('Tester').status_code, 201)
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.assertEqual(self.register('TESTER').status_code, 409)
        response = self.login('TESTER')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user']['username'], 'tester')
        self.assertIn('HttpOnly', response.headers['set-cookie'])
        self.assertIn('SameSite=lax', response.headers['set-cookie'])
        stored = main.app.state.db.find_user('tester')
        self.assertTrue(stored['password_hash'].startswith('$argon2id$'))
        self.assertNotIn(PASSWORD, response.text)
        with main.app.state.db.connect() as db:
            token_hash = db.execute('SELECT token_hash FROM sessions').fetchone()[0]
            self.assertNotEqual(token_hash, self.client.cookies.get(auth.COOKIE_NAME))
        self.assertEqual(self.client.post('/api/auth/logout', json={}).status_code, 200)
        self.assertEqual(self.client.get('/api/me').status_code, 401)

    def test_deep_mode_selects_full_prompt(self):
        self.register(); self.login()
        quick = self.mock_model()
        self.client.post('/review', json={'text': '虚构输入'})
        quick_kwargs = quick.call_args.kwargs
        self.assertEqual(quick_kwargs['max_tokens'], 2000)
        self.assertEqual(quick_kwargs['messages'][0]['content'], main.QUICK_PROTOCOL)
        deep = self.mock_model()
        self.client.post('/review', json={'text': '虚构输入', 'deep': True})
        deep_kwargs = deep.call_args.kwargs
        self.assertEqual(deep_kwargs['max_tokens'], 4000)
        self.assertEqual(deep_kwargs['messages'][0]['content'], main.SYSTEM_PROMPT)
        self.assertEqual(deep_kwargs['messages'][1]['content'], main.OUTPUT_PROTOCOL)

    def test_context_is_forwarded(self):
        self.register(); self.login()
        create = self.mock_model()
        self.client.post('/review', json={'text': '他刚才那句话怎么回', 'context': '用户：之前关于押金\n复盘：结论：先要书面依据'})
        user_content = create.call_args.kwargs['messages'][-1]['content']
        self.assertIn('他刚才那句话怎么回', user_content)
        self.assertIn('之前关于押金', user_content)

    def test_invalid_credentials_validation_and_csrf(self):
        self.register()
        wrong = self.login(password='wrong-password')
        unknown = self.login(name='unknown')
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(wrong.json(), unknown.json())
        result = self.client.post('/api/auth/register', json={'username': 'x', 'password': 'sensitive'})
        self.assertEqual(result.status_code, 422)
        self.assertNotIn('sensitive', result.text)
        self.assertEqual(self.client.post('/api/auth/login', json={'username': 'tester', 'password': PASSWORD}, headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/auth/login', json={'username': 'tester', 'password': PASSWORD}, headers={'X-Chaowan-Client': ''}).status_code, 403)
        for _ in range(12):
            limited = self.login(password='wrong-password')
        self.assertEqual(limited.status_code, 429)

    def test_quota_daily_limit_and_account_isolation(self):
        self.register(); self.login()
        create = self.mock_model()
        for _ in range(FREE_DAILY_LIMIT):
            self.assertEqual(self.client.post('/review', json={'text': '虚构输入'}).status_code, 200)
        blocked = self.client.post('/review', json={'text': '超出当日'})
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()['code'], 'QUOTA_EXHAUSTED')
        self.assertEqual(create.await_count, FREE_DAILY_LIMIT)
        self.assertEqual(self.client.get('/api/me').json()['user']['quota']['remaining'], 0)
        self.register('second'); self.login('second')
        self.assertEqual(self.client.get('/api/me').json()['user']['quota']['remaining'], FREE_DAILY_LIMIT)

    def test_failure_timeout_empty_and_missing_key_do_not_charge(self):
        self.register(); self.login()
        self.assertEqual(self.client.post('/review', json={'text': '虚构'}).status_code, 503)
        for kwargs, status in [({'error': RuntimeError()}, 502), ({'error': asyncio.TimeoutError()}, 504), ({'text': ''}, 502)]:
            self.mock_model(**kwargs)
            self.assertEqual(self.client.post('/review', json={'text': '虚构'}).status_code, status)
            self.assertEqual(self.client.get('/api/me').json()['user']['quota']['usedToday'], 0)
            self.assertFalse(self.client.get('/api/me').json()['user']['quota']['pending'])

    def test_truncated_report_returns_with_note_and_charges(self):
        self.register(); self.login()
        self.mock_model(finish='length', text='## 一、你的处境\n部分内容')
        response = self.client.post('/review', json={'text': '虚构'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('内容过长已被截断', response.json()['report'])
        self.assertEqual(self.client.get('/api/me').json()['user']['quota']['usedToday'], 1)

    def test_membership_purchase_grants_unlimited_and_records_simulated(self):
        self.register(); self.login()
        result = self.client.post('/api/membership/purchase', json={'plan': 'monthly'})
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertTrue(body['simulated'])
        self.assertEqual(body['user']['plan'], 'monthly')
        self.assertTrue(body['user']['quota']['unlimited'])
        self.assertIsNone(body['user']['quota']['remaining'])
        create = self.mock_model()
        for _ in range(3):
            self.assertEqual(self.client.post('/review', json={'text': '会员无限'}).status_code, 200)
        self.assertEqual(create.await_count, 3)
        with main.app.state.db.connect() as db:
            purchase = db.execute('SELECT plan, simulated FROM purchases').fetchone()
            self.assertEqual(purchase['plan'], 'monthly')
            self.assertEqual(purchase['simulated'], 1)
        self.assertEqual(self.client.post('/api/membership/purchase', json={'plan': 'lifetime'}).json()['user']['plan'], 'lifetime')

    def test_guest_trial_has_15_daily_quota(self):
        response = self.client.post('/api/auth/guest', json={})
        self.assertEqual(response.status_code, 200)
        user = response.json()['user']
        self.assertTrue(user['is_guest'])
        self.assertEqual(user['quota']['dailyLimit'], 15)
        self.assertEqual(user['quota']['remaining'], 15)
        create = self.mock_model()
        for _ in range(15):
            self.assertEqual(self.client.post('/review', json={'text': '游客试用'}).status_code, 200)
        blocked = self.client.post('/review', json={'text': '第16次'})
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()['code'], 'QUOTA_EXHAUSTED')
        self.assertEqual(create.await_count, 15)
        purchase = self.client.post('/api/membership/purchase', json={'plan': 'monthly'})
        self.assertEqual(purchase.status_code, 403)
        self.assertEqual(purchase.json()['detail']['code'], 'GUEST_FORBIDDEN')
        self.register('guestreg'); self.login('guestreg')
        self.assertEqual(self.client.get('/api/me').json()['user']['quota']['dailyLimit'], 40)

    def test_daily_reset(self):
        self.register(); self.login()
        self.mock_model()
        db = main.app.state.db
        user_id = db.find_user('tester')['id']
        with db.connect(write=True) as conn:
            conn.execute('UPDATE users SET used_today = 40, quota_date = ?', (today_key(),))
        self.assertEqual(self.client.post('/review', json={'text': '当日用完'}).status_code, 429)
        with db.connect(write=True) as conn:
            conn.execute("UPDATE users SET quota_date = '2000-01-01'")
        self.assertEqual(self.client.get('/api/me').json()['user']['quota']['usedToday'], 0)
        self.assertEqual(self.client.get('/api/me').json()['user']['quota']['remaining'], FREE_DAILY_LIMIT)

    def test_atomic_reservation_expiry_and_idempotence(self):
        self.register(); self.login()
        db = main.app.state.db
        user_id = db.find_user('tester')['id']
        def reserve():
            try:
                return db.reserve(user_id)
            except QuotaError as e:
                return e.code
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: reserve(), range(2)))
        self.assertEqual(results.count('REVIEW_IN_PROGRESS'), 1)
        token = next(value for value in results if value != 'REVIEW_IN_PROGRESS')
        self.assertTrue(db.settle(user_id, token))
        self.assertFalse(db.settle(user_id, token))
        token = db.reserve(user_id)
        with db.connect(write=True) as connection:
            connection.execute('UPDATE reservations SET expires_at = ?', (int(time.time()) - 1,))
        replacement = db.reserve(user_id)
        self.assertFalse(db.settle(user_id, token))
        db.release(user_id, replacement)
        self.assertEqual(Database(db.path).public_user(user_id)['quota']['usedToday'], 1)

    def test_expired_and_revoked_session_cannot_review(self):
        self.register(); self.login()
        create = self.mock_model()
        with main.app.state.db.connect(write=True) as db:
            db.execute('UPDATE sessions SET expires_at = 0')
        self.assertEqual(self.client.post('/review', json={'text': '虚构'}).status_code, 401)
        self.assertEqual(create.await_count, 0)


if __name__ == '__main__':
    unittest.main()
