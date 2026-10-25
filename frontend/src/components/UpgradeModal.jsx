import { useEffect, useRef, useState } from 'react';
import { Check, Sparkles, UserRound, X } from 'lucide-react';
import { api } from '../lib/api';
import { PLANS } from '../lib/plans';

export default function UpgradeModal({ isGuest, onClose, onProfile, onPurchased, onRegister }) {
  const overlay = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [selected, setSelected] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previous = document.activeElement;
    const root = overlay.current;
    const siblings = Array.from(root.parentElement.children).filter((node) => node !== root);
    const previousInert = siblings.map((node) => node.inert);
    siblings.forEach((node) => { node.inert = true; });
    root.querySelector('[data-upgrade-heading]')?.focus();
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(root.querySelectorAll('button:not(:disabled)'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      siblings.forEach((node, index) => { node.inert = previousInert[index]; });
      if (previous?.isConnected) previous.focus();
    };
  }, []);

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

  return <div ref={overlay} className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/20 p-3 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title" className="max-h-[min(720px,calc(100dvh-24px))] w-full max-w-md overflow-y-auto rounded-[28px] border-2 border-[#1A1A1A] bg-[#F4F1E6] shadow-2xl shadow-stone-900/15">
      <div className="relative bg-[#ECE8DA] px-6 pb-7 pt-6 sm:px-8">
        <button type="button" onClick={onClose} aria-label="关闭重置额度" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-white/60 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50"><X className="h-4 w-4" /></button>
        {isGuest ? <UserRound className="mt-6 h-7 w-7 text-[#55554F]" strokeWidth={1.4} /> : <Sparkles className="mt-6 h-7 w-7 text-[#55554F]" strokeWidth={1.4} />}
        <h2 id="upgrade-modal-title" tabIndex={-1} data-upgrade-heading className="mt-4 text-2xl font-semibold tracking-tight text-[#1A1A1A] outline-none">{isGuest ? '游客试用已用完' : '重置额度，继续聊下去'}</h2>
        <p className="mt-2 text-sm leading-7 text-[#44443E]">{isGuest ? '注册 / 登录后每天 40 次，还能购买会员不限次。' : '今天的免费次数用完了。开通高级会员，之后不再受每日 40 次限制。'}</p>
      </div>
      <div className="px-6 py-6 sm:px-8">
        {isGuest ? <>
          <button type="button" onClick={onRegister} className="w-full rounded-2xl bg-[#1A1A1A] px-5 py-3.5 text-sm font-medium text-white hover:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">去注册 / 登录</button>
          <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40">先返回当前对话</button>
        </> : <>
          <div className="space-y-3" role="radiogroup" aria-label="选择会员卡">
            {PLANS.map((plan) => <button key={plan.id} type="button" role="radio" aria-checked={selected === plan.id} onClick={() => setSelected(plan.id)} className={`w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 ${selected === plan.id ? 'border-[#77776E] bg-[#ECE8DA]' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
              <div className="flex items-center justify-between"><span className="font-semibold text-stone-800">{plan.name}</span><span className="text-base font-semibold text-[#1A1A1A]">{plan.price}</span></div>
              <p className="mt-1 text-xs text-stone-500">{plan.note}</p>
              {selected === plan.id && <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#33332F]"><Check className="h-3 w-3" />已选择</p>}
            </button>)}
          </div>
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs leading-6 text-stone-500">开通后账号变为高级会员，不再受每天 40 次限制。</div>
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{error}</p>}
          <button type="button" onClick={purchase} disabled={busy} className="mt-6 w-full rounded-2xl bg-[#1A1A1A] px-5 py-3.5 text-sm font-medium text-white hover:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-50">{busy ? '正在开通…' : '立即购买'}</button>
          <button type="button" onClick={onProfile} className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40">查看个人主页与额度说明</button>
          <button type="button" onClick={onClose} className="mt-1 w-full rounded-xl px-4 py-2.5 text-sm text-stone-500 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40">先返回当前对话</button>
        </>}
      </div>
    </div>
  </div>;
}
