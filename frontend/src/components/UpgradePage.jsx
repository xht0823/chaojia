import { useState } from 'react';
import { ArrowLeft, Check, Sparkles, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { PLANS } from '../lib/plans';

export default function UpgradePage({ user, onBack, onPurchased, onRegister }) {
  const [selected, setSelected] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isGuest = user?.is_guest;
  const member = user?.quota?.unlimited;

  async function purchase() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api('/api/membership/purchase', { body: { plan: selected } });
      onPurchased();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (isGuest) {
    return <section className="mx-auto max-w-2xl px-5 py-9 sm:py-14">
      <button onClick={onBack} className="mb-8 inline-flex items-center gap-2 rounded-lg p-1 text-sm text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" />返回</button>
      <UserRound className="mt-6 h-8 w-8 text-[#55554F]" strokeWidth={1.4} />
      <h1 tabIndex={-1} data-page-heading className="mt-5 text-2xl font-semibold tracking-tight text-[#1A1A1A] outline-none sm:text-3xl">高级会员</h1>
      <p className="mt-3 text-sm leading-7 text-[#44443E]">游客模式暂不支持购买会员。注册 / 登录后每天 40 次，还能购买会员不限次。</p>
      <button type="button" onClick={onRegister} className="mt-6 w-full rounded-2xl bg-[#1A1A1A] px-5 py-3.5 text-sm font-medium text-white hover:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">去注册 / 登录</button>
    </section>;
  }

  return <section className="mx-auto max-w-2xl px-5 py-9 sm:py-14">
    <button onClick={onBack} className="mb-8 inline-flex items-center gap-2 rounded-lg p-1 text-sm text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" />返回</button>
    <Sparkles className="mt-6 h-8 w-8 text-[#55554F]" strokeWidth={1.4} />
    <h1 tabIndex={-1} data-page-heading className="mt-5 text-2xl font-semibold tracking-tight text-[#1A1A1A] outline-none sm:text-3xl">高级会员</h1>
    <p className="mt-3 text-sm leading-7 text-[#44443E]">{member ? '已经是高级会员，额度无限。' : '开通后不再受每天 40 次限制。'}</p>
    <div className="mt-8 space-y-3" role="radiogroup" aria-label="选择会员卡">
      {PLANS.map((plan) => <button key={plan.id} type="button" role="radio" aria-checked={selected === plan.id} onClick={() => setSelected(plan.id)} className={`w-full rounded-3xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 ${selected === plan.id ? 'border-[#77776E] bg-[#ECE8DA]' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
        <div className="flex items-center justify-between"><span className="text-lg font-semibold text-stone-800">{plan.name}</span><span className="text-lg font-semibold text-[#1A1A1A]">{plan.price}</span></div>
        <p className="mt-1 text-sm text-stone-500">{plan.note}</p>
        {selected === plan.id && <p className="mt-2 inline-flex items-center gap-1 text-sm text-[#33332F]"><Check className="h-4 w-4" />已选择</p>}
      </button>)}
    </div>
    <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-6 text-stone-500">开通后立即生效，额度变为无限次。</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{error}</p>}
    <button type="button" onClick={purchase} disabled={busy} className="mt-6 w-full rounded-2xl bg-[#1A1A1A] px-5 py-3.5 text-sm font-medium text-white hover:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{busy ? '正在开通…' : '立即购买'}</button>
  </section>;
}
