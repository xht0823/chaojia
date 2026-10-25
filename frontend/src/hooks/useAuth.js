import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const epoch = useRef(0);
  const identity = useRef(null);
  const channel = useRef(null);
  const checking = useRef(0);
  const loggingOut = useRef(false);

  const invalidate = useCallback(() => {
    epoch.current += 1;
    identity.current = null;
    setUser(null);
    setRevision((value) => value + 1);
  }, []);

  const refresh = useCallback(async () => {
    if (loggingOut.current) return null;
    const check = ++checking.current;
    const startEpoch = epoch.current;
    try {
      const data = await api('/api/me');
      if (check !== checking.current || startEpoch !== epoch.current) return null;
      if (identity.current !== data.user.id) {
        invalidate();
        identity.current = data.user.id;
      }
      setUser(data.user);
      setStatus('authenticated');
      setError('');
      return data.user;
    } catch (failure) {
      if (check !== checking.current || startEpoch !== epoch.current) return null;
      setError('');
      loggingOut.current = false;
      if (failure.status === 401) {
        invalidate();
        setStatus('anonymous');
        setError('');
      } else {
        // Hide private content until identity can be verified again.
        setStatus('error');
        setError(failure.message);
      }
      return null;
    }
  }, [invalidate]);

  const expire = useCallback(() => {
    checking.current += 1;
    invalidate();
    setStatus('anonymous');
  }, [invalidate]);

  useEffect(() => {
    refresh();
    const recheck = () => {
      // Background verification keeps the app shell mounted; only an actual
      // 401 clears content. Flipping to "loading" here would unmount the
      // screenshot importer during a native file picker's visibility change.
      if (document.visibilityState === 'visible' && identity.current !== null && !loggingOut.current) {
        refresh();
      }
    };
    const notify = () => {
      loggingOut.current = false;
      invalidate();
      setStatus('loading');
      refresh();
    };
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('chaowan-auth');
      channel.current.onmessage = notify;
    }
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      channel.current?.close();
      window.removeEventListener('focus', recheck);
      window.removeEventListener('pageshow', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [refresh, invalidate]);

  async function login(username, password) {
    loggingOut.current = false;
    const data = await api('/api/auth/login', { body: { username, password } });
    checking.current += 1;
    invalidate();
    identity.current = data.user.id;
    setUser(data.user);
    setStatus('authenticated');
    setError('');
    channel.current?.postMessage('changed');
  }

  async function guest() {
    loggingOut.current = false;
    const data = await api('/api/auth/guest', { body: {} });
    checking.current += 1;
    invalidate();
    identity.current = data.user.id;
    setUser(data.user);
    setStatus('authenticated');
    setError('');
    channel.current?.postMessage('changed');
  }

  async function logout() {
    loggingOut.current = true;
    expire();
    try {
      await api('/api/auth/logout', { body: {} });
      channel.current?.postMessage('changed');
      setError('');
      loggingOut.current = false;
    } catch {
      setError('本地内容已清空，但退出未确认，请重试退出。');
    }
  }

  return { user, status, error, revision, epoch, refresh, login, guest, logout, expire };
}
