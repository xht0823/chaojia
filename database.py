import hashlib
import os
from contextlib import contextmanager
from pathlib import Path
import secrets
import sqlite3
import time

FREE_DAILY_LIMIT = 40
GUEST_DAILY_LIMIT = 15
RESERVATION_SECONDS = 60
PLAN_DURATIONS = {'monthly': 30 * 24 * 60 * 60, 'yearly': 365 * 24 * 60 * 60, 'lifetime': None}


class QuotaError(Exception):
    def __init__(self, code):
        self.code = code


def today_key():
    return time.strftime('%Y-%m-%d', time.localtime())


def is_member(plan, plan_expires_at, now=None):
    now = now if now is not None else int(time.time())
    if plan == 'lifetime':
        return True
    if plan in ('monthly', 'yearly') and plan_expires_at and plan_expires_at > now:
        return True
    return False


class Database:
    def __init__(self, path=None):
        configured = path or os.environ.get('APP_DATABASE_PATH', 'data/app.db')
        self.path = Path(configured)
        if not self.path.is_absolute():
            self.path = Path(__file__).resolve().parent / self.path

    @contextmanager
    def connect(self, write=False):
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys = ON')
        try:
            if write:
                connection.execute('BEGIN IMMEDIATE')
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect(write=True) as db:
            version = db.execute('PRAGMA user_version').fetchone()[0]
            if version == 0:
                db.execute('''CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    used_today INTEGER NOT NULL DEFAULT 0,
                    quota_date TEXT NOT NULL DEFAULT '',
                    plan TEXT NOT NULL DEFAULT 'free',
                    plan_expires_at INTEGER,
                    is_guest INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL
                )''')
                db.execute('PRAGMA user_version = 3')
            elif version in (1, 2):
                if version == 1:
                    db.execute('ALTER TABLE users ADD COLUMN used_today INTEGER NOT NULL DEFAULT 0')
                    db.execute("ALTER TABLE users ADD COLUMN quota_date TEXT NOT NULL DEFAULT ''")
                    db.execute("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'")
                    db.execute('ALTER TABLE users ADD COLUMN plan_expires_at INTEGER')
                db.execute('ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0')
                db.execute('PRAGMA user_version = 3')
            elif version != 3:
                raise RuntimeError('Unsupported database schema version')
            db.execute('''CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            )''')
            db.execute('CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)')
            db.execute('''CREATE TABLE IF NOT EXISTS reservations (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                request_id TEXT NOT NULL UNIQUE,
                expires_at INTEGER NOT NULL
            )''')
            db.execute('''CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                plan TEXT NOT NULL,
                simulated INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            )''')

    def create_user(self, username, password_hash, is_guest=0):
        with self.connect(write=True) as db:
            db.execute('INSERT INTO users(username, password_hash, is_guest, created_at) VALUES (?, ?, ?, ?)',
                       (username, password_hash, is_guest, int(time.time())))

    def create_guest(self):
        with self.connect(write=True) as db:
            username = f'guest_{secrets.token_hex(6)}'
            db.execute('INSERT INTO users(username, password_hash, is_guest, created_at) VALUES (?, ?, 1, ?)',
                       (username, '', int(time.time())))
            return db.execute('SELECT last_insert_rowid() AS id').fetchone()['id']

    def find_user(self, username):
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            return dict(row) if row else None

    @staticmethod
    def token_hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def create_session(self, user_id, token, expires_at, previous=None):
        with self.connect(write=True) as db:
            db.execute('DELETE FROM sessions WHERE expires_at <= ?', (int(time.time()),))
            if previous:
                db.execute('DELETE FROM sessions WHERE token_hash = ?', (self.token_hash(previous),))
            db.execute('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)',
                       (self.token_hash(token), user_id, expires_at))

    def session_user(self, token):
        if not token or len(token) > 256:
            return None
        with self.connect() as db:
            row = db.execute('''SELECT u.id, u.username, u.plan, u.plan_expires_at, u.is_guest, u.created_at
                FROM users u JOIN sessions s ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.expires_at > ?''',
                (self.token_hash(token), int(time.time()))).fetchone()
            return dict(row) if row else None

    def revoke_session(self, token):
        if not token:
            return
        with self.connect(write=True) as db:
            db.execute('DELETE FROM sessions WHERE token_hash = ?', (self.token_hash(token),))

    def _reset_daily(self, db, user_id):
        today = today_key()
        db.execute('UPDATE users SET used_today = 0, quota_date = ? WHERE id = ? AND quota_date != ?',
                   (today, user_id, today))

    def public_user(self, user_id):
        with self.connect() as db:
            self._reset_daily(db, user_id)
            user = db.execute('SELECT id, username, plan, plan_expires_at, used_today, quota_date, is_guest, created_at FROM users WHERE id = ?', (user_id,)).fetchone()
            pending = db.execute('SELECT 1 FROM reservations WHERE user_id = ? AND expires_at > ?',
                                 (user_id, int(time.time()))).fetchone() is not None
            member = is_member(user['plan'], user['plan_expires_at'])
            limit = GUEST_DAILY_LIMIT if user['is_guest'] else FREE_DAILY_LIMIT
            return {
                'id': user['id'], 'username': user['username'], 'created_at': user['created_at'],
                'plan': user['plan'], 'plan_expires_at': user['plan_expires_at'], 'is_guest': bool(user['is_guest']),
                'quota': {
                    'dailyLimit': limit,
                    'usedToday': user['used_today'],
                    'remaining': None if member else limit - user['used_today'],
                    'pending': pending,
                    'unlimited': member,
                },
            }

    def reserve(self, user_id):
        now = int(time.time())
        request_id = secrets.token_urlsafe(24)
        with self.connect(write=True) as db:
            db.execute('DELETE FROM reservations WHERE expires_at <= ?', (now,))
            self._reset_daily(db, user_id)
            user = db.execute('SELECT used_today, plan, plan_expires_at, is_guest FROM users WHERE id = ?', (user_id,)).fetchone()
            member = is_member(user['plan'], user['plan_expires_at'], now)
            limit = GUEST_DAILY_LIMIT if user['is_guest'] else FREE_DAILY_LIMIT
            if not member and user['used_today'] >= limit:
                raise QuotaError('QUOTA_EXHAUSTED')
            if db.execute('SELECT 1 FROM reservations WHERE user_id = ?', (user_id,)).fetchone():
                raise QuotaError('REVIEW_IN_PROGRESS')
            db.execute('INSERT INTO reservations VALUES (?, ?, ?)',
                       (user_id, request_id, now + RESERVATION_SECONDS))
        return request_id

    def settle(self, user_id, request_id):
        with self.connect(write=True) as db:
            result = db.execute('DELETE FROM reservations WHERE user_id = ? AND request_id = ? AND expires_at > ?',
                                (user_id, request_id, int(time.time())))
            if result.rowcount != 1:
                return False
            self._reset_daily(db, user_id)
            user = db.execute('SELECT plan, plan_expires_at, is_guest FROM users WHERE id = ?', (user_id,)).fetchone()
            if is_member(user['plan'], user['plan_expires_at']):
                return True
            limit = GUEST_DAILY_LIMIT if user['is_guest'] else FREE_DAILY_LIMIT
            result = db.execute('UPDATE users SET used_today = used_today + 1 WHERE id = ? AND used_today < ?',
                                (user_id, limit))
            if result.rowcount != 1:
                raise RuntimeError('Quota settlement failed')
            return True

    def release(self, user_id, request_id):
        with self.connect(write=True) as db:
            db.execute('DELETE FROM reservations WHERE user_id = ? AND request_id = ?', (user_id, request_id))

    def purchase_membership(self, user_id, plan):
        if plan not in PLAN_DURATIONS:
            raise ValueError('invalid plan')
        now = int(time.time())
        with self.connect(write=True) as db:
            user = db.execute('SELECT plan, plan_expires_at FROM users WHERE id = ?', (user_id,)).fetchone()
            if plan == 'lifetime':
                new_expiry = None
            else:
                base = now
                if user['plan'] == plan and user['plan_expires_at'] and user['plan_expires_at'] > now:
                    base = user['plan_expires_at']
                new_expiry = base + PLAN_DURATIONS[plan]
            db.execute('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?', (plan, new_expiry, user_id))
            db.execute('INSERT INTO purchases(user_id, plan, simulated, created_at) VALUES (?, ?, 1, ?)',
                       (user_id, plan, now))
