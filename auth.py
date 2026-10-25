from collections import OrderedDict, deque
import os
import secrets
import sqlite3
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from pwdlib import PasswordHash

COOKIE_NAME = 'chaowan_session'
SESSION_SECONDS = 7 * 24 * 60 * 60
password_hasher = PasswordHash.recommended()
DUMMY_HASH = password_hasher.hash(secrets.token_urlsafe(32))
router = APIRouter()


def allowed_origins():
    value = os.environ.get('APP_ALLOWED_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173')
    return [origin.strip().rstrip('/') for origin in value.split(',') if origin.strip()]


def allow_any_origin():
    return os.environ.get('APP_ALLOW_ANY_ORIGIN', 'false').lower() == 'true'


def problem(status, code, message):
    if status == 429:
        return HTTPException(status_code=status, detail={'code': code, 'error': message}, headers={'Retry-After': '900'})
    return HTTPException(status_code=status, detail={'code': code, 'error': message})


class RateLimiter:
    def __init__(self):
        self.entries = OrderedDict()
        self.lock = threading.Lock()

    def check(self, key, limit, window=900):
        now = time.monotonic()
        with self.lock:
            while self.entries and now - next(iter(self.entries.values()))[-1] >= window:
                self.entries.popitem(last=False)
            timestamps = self.entries.setdefault(key, deque())
            while timestamps and now - timestamps[0] >= window:
                timestamps.popleft()
            self.entries.move_to_end(key)
            if len(timestamps) >= limit:
                raise problem(429, 'RATE_LIMITED', '操作太频繁，请稍后再试')
            timestamps.append(now)
            if len(self.entries) > 10000:
                self.entries.popitem(last=False)


limiter = RateLimiter()
hash_slots = threading.BoundedSemaphore(2)


def run_password_task(function, *args):
    if not hash_slots.acquire(blocking=False):
        raise problem(429, 'RATE_LIMITED', '服务繁忙，请稍后再试')
    try:
        return function(*args)
    finally:
        hash_slots.release()


class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: str = Field(pattern=r'^[a-zA-Z0-9_]{3,32}$')
    password: SecretStr = Field(min_length=8, max_length=128)


def current_user(request: Request):
    user = request.app.state.db.session_user(request.cookies.get(COOKIE_NAME))
    if user is None:
        raise problem(401, 'UNAUTHENTICATED', '请先登录')
    return user


def auth_rate_limit(request, action, username):
    address = request.client.host if request.client else 'unknown'
    limiter.check((action, 'ip', address), 10 if action == 'register' else 30)
    limiter.check((action, 'username', username), 6 if action == 'register' else 10)


@router.post('/api/auth/register', status_code=201)
def register(payload: Credentials, request: Request):
    username = payload.username.lower()
    auth_rate_limit(request, 'register', username)
    hashed = run_password_task(password_hasher.hash, payload.password.get_secret_value())
    try:
        request.app.state.db.create_user(username, hashed)
    except sqlite3.IntegrityError:
        raise problem(409, 'USERNAME_TAKEN', '这个用户名已被使用，请换一个') from None
    return {'message': '注册成功，请登录'}


@router.post('/api/auth/login')
def login(payload: Credentials, request: Request, response: Response):
    username = payload.username.lower()
    auth_rate_limit(request, 'login', username)
    db = request.app.state.db
    user = db.find_user(username)
    valid = run_password_task(password_hasher.verify, payload.password.get_secret_value(), user['password_hash'] if user else DUMMY_HASH)
    if user is None or not valid:
        raise problem(401, 'INVALID_CREDENTIALS', '用户名或密码错误')
    token = secrets.token_urlsafe(32)
    db.create_session(user['id'], token, int(time.time()) + SESSION_SECONDS, request.cookies.get(COOKIE_NAME))
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True,
                        secure=os.environ.get('APP_COOKIE_SECURE', 'false').lower() == 'true',
                        samesite='lax', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return {'user': db.public_user(user['id'])}


@router.get('/api/me')
def me(request: Request, response: Response, user=Depends(current_user)):
    response.headers['Cache-Control'] = 'no-store'
    return {'user': request.app.state.db.public_user(user['id'])}


@router.post('/api/auth/guest')
def guest(request: Request, response: Response):
    limiter.check(('guest', 'ip', request.client.host if request.client else 'unknown'), 30)
    db = request.app.state.db
    user_id = db.create_guest()
    token = secrets.token_urlsafe(32)
    db.create_session(user_id, token, int(time.time()) + SESSION_SECONDS, request.cookies.get(COOKIE_NAME))
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True,
                        secure=os.environ.get('APP_COOKIE_SECURE', 'false').lower() == 'true',
                        samesite='lax', path='/')
    response.headers['Cache-Control'] = 'no-store'
    return {'user': db.public_user(user_id)}


@router.post('/api/auth/logout')
def logout(request: Request, response: Response):
    request.app.state.db.revoke_session(request.cookies.get(COOKIE_NAME))
    response.delete_cookie(COOKIE_NAME, path='/', httponly=True, samesite='lax',
                           secure=os.environ.get('APP_COOKIE_SECURE', 'false').lower() == 'true')
    response.headers['Cache-Control'] = 'no-store'
    return {'message': '已退出登录'}


PLANS = [
    {'id': 'monthly', 'name': '月卡', 'duration_days': 30, 'price_label': '¥30 / 30天', 'simulated': True},
    {'id': 'yearly', 'name': '年卡', 'duration_days': 365, 'price_label': '¥198 / 365天', 'simulated': True},
    {'id': 'lifetime', 'name': '终身卡', 'duration_days': None, 'price_label': '¥498 / 永久', 'simulated': True},
]


@router.get('/api/plans')
def plans(request: Request, response: Response, user=Depends(current_user)):
    response.headers['Cache-Control'] = 'no-store'
    return {'plans': PLANS}


class PurchaseRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    plan: str


@router.post('/api/membership/purchase')
def purchase(payload: PurchaseRequest, request: Request, response: Response, user=Depends(current_user)):
    if user.get('is_guest'):
        raise problem(403, 'GUEST_FORBIDDEN', '游客请先注册或登录后再购买会员')
    if payload.plan not in ('monthly', 'yearly', 'lifetime'):
        raise problem(422, 'INVALID_PLAN', '请选择有效的会员卡')
    db = request.app.state.db
    db.purchase_membership(user['id'], payload.plan)
    response.headers['Cache-Control'] = 'no-store'
    return {'simulated': True, 'message': '模拟支付成功，会员已开通（未真实扣款）', 'user': db.public_user(user['id'])}

