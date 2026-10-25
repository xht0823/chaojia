import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';

export default function AuthPage({ onLogin, onGuest, notice, onRetryLogout }) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const reduced = useReducedMotion();

  function switchMode() {
    setRegistering(!registering);
    setPassword(''); setConfirmation(''); setError(''); setSuccess(''); setVisible(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSuccess('');
    if (registering && password !== confirmation) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      if (registering) {
        await api('/api/auth/register', { body: { username: username.trim(), password } });
        setRegistering(false);
        setPassword(''); setConfirmation(''); setVisible(false);
        setSuccess('注册成功。现在用刚才的用户名和密码登录吧。');
      } else {
        await onLogin(username.trim(), password);
        setPassword('');
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="min-h-[100dvh] bg-[#F4F1E6] px-5 py-8 text-[#1A1A1A]">
    <header className="mx-auto max-w-5xl">
      <div className="marquee -mx-5 mb-3 border-y border-[#1A1A1A] bg-[#1A1A1A] py-1 text-[11px] tracking-[0.12em] text-[#F4F1E6]" aria-hidden="true"><div className="marquee-track">【今日头版】把憋屈的话，摊开来说 · 每一次复盘，都给自己留一点空间 · 沟通复盘日报 · </div></div>
      <div className="relative flex flex-col items-center border-b-[3px] border-double border-[#1A1A1A] pb-2">
        <span className="text-[10px] tracking-[0.4em] text-[#33332F]">沟通复盘日报</span>
        <span className="text-[30px] font-bold leading-none tracking-[0.05em] text-[#1A1A1A]">吵完才懂</span>
        <span className="mt-1 text-[9px] tracking-[0.2em] text-[#55554F]">把憋屈的话，摊开来说 · 第 001 期</span>
        <span className="ink-stamp absolute left-0 top-1/2 -translate-y-1/2 text-[12px]">号外</span>
      </div>
    </header>
    <motion.main initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[410px] pb-10 pt-12 sm:pt-20">
      <p className="mb-3 text-xs tracking-[.18em] text-[#55554F]">先安顿好自己，再慢慢说</p>
      <h1 className="text-3xl font-semibold tracking-tight text-[#1A1A1A]">{registering ? '给自己一个新开始。' : '欢迎回来。'}</h1>
      <p className="mt-3 text-sm leading-7 text-stone-500">{registering ? '创建账号，每天 40 次免费复盘。' : '有些话，吵完才想明白。我们一起理一理。'}</p>
      <div className="mt-8 rounded-3xl border border-stone-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex rounded-xl bg-stone-100/80 p-1" aria-label="登录与注册"><button type="button" disabled={busy} onClick={() => registering && switchMode()} className={`flex-1 rounded-lg py-2 text-sm ${!registering ? 'bg-white font-medium shadow-sm' : 'text-stone-500'}`}>登录</button><button type="button" disabled={busy} onClick={() => !registering && switchMode()} className={`flex-1 rounded-lg py-2 text-sm ${registering ? 'bg-white font-medium shadow-sm' : 'text-stone-500'}`}>注册</button></div>
        {success && <p role="status" className="mb-5 rounded-xl bg-[#ECE8DA] px-4 py-3 text-sm leading-6 text-[#33332F]">{success}</p>}
        {notice && <div role="alert" className="mb-5 text-sm leading-6 text-amber-700">{notice}<button type="button" onClick={onRetryLogout} className="ml-2 underline underline-offset-4">重试退出</button></div>}
        <form onSubmit={submit} className="space-y-5">
          <div><label htmlFor="username" className="mb-2 block text-sm font-medium">用户名</label><input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" disabled={busy} placeholder="给自己起个名字" className="w-full rounded-xl border border-stone-200 bg-[#F4F1E6]/50 px-4 py-3 text-base outline-none focus:border-[#66665E] focus:ring-2 focus:ring-[#66665E]/15 disabled:opacity-60" /><p className="mt-2 text-[11px] text-stone-400">3–32 位英文字母、数字或下划线，不区分大小写</p></div>
          <div><label htmlFor="password" className="mb-2 block text-sm font-medium">密码</label><div className="relative"><input id="password" type={visible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} disabled={busy} placeholder="至少 8 个字符" className="w-full rounded-xl border border-stone-200 bg-[#F4F1E6]/50 px-4 py-3 pr-12 text-base outline-none focus:border-[#66665E] focus:ring-2 focus:ring-[#66665E]/15 disabled:opacity-60" /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? '隐藏密码' : '显示密码'} className="absolute right-3 top-3 rounded-md p-1 text-stone-400 hover:text-stone-700">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
          {registering && <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">确认密码</label><input id="confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} maxLength={128} disabled={busy} className="w-full rounded-xl border border-stone-200 bg-[#F4F1E6]/50 px-4 py-3 text-base outline-none focus:border-[#66665E] focus:ring-2 focus:ring-[#66665E]/15" /></div>}
          {error && <p role="alert" className="text-sm leading-6 text-rose-600">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-3.5 text-sm font-medium text-white hover:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{busy ? '请稍候…' : registering ? '注册账号' : '登录并开始复盘'}{!busy && <ArrowRight className="h-4 w-4" />}</button>
        </form>
      </div>
      <button type="button" disabled={busy} onClick={async () => { if (busy) return; setBusy(true); setError(''); try { await onGuest(); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }} className="mt-5 flex w-full items-center justify-center gap-2 border-2 border-[#1A1A1A] bg-[#F4F1E6] px-4 py-3.5 text-sm font-bold text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F4F1E6] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">游客试用 · 每天 15 次</button>
      <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-[#E5E1D3] bg-[#F4F1E6] p-3">{[['40', '次/天'], ['账号', '额度不丢失'], ['无限', '会员更自在']].map(([value, label]) => <div key={label} className="text-center"><p className="text-sm font-semibold text-[#33332F]">{value}</p><p className="mt-1 text-[10px] leading-4 text-stone-500">{label}</p></div>)}</div>
    </motion.main>
  </div>;
}
