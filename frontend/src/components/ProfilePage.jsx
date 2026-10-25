import { ArrowLeft, ArrowUpRight, Sparkles, UserRound } from 'lucide-react';

const PLAN_LABELS = { free: '免费版', monthly: '月卡会员', yearly: '年卡会员', lifetime: '终身会员' };

function formatExpiry(plan, expiry) {
  if (plan === 'lifetime') return '永久有效';
  if (!expiry) return '';
  return `到期 ${new Date(expiry * 1000).toLocaleDateString('zh-CN')}`;
}

export default function ProfilePage({ user, quota, onLogout, onBack, onUpgrade }) {
  const unlimited = quota?.unlimited;
  const used = quota?.usedToday ?? 0;
  const dailyLimit = quota?.dailyLimit ?? 40;
  const progress = unlimited ? 100 : Math.min(100, Math.max(0, (used / dailyLimit) * 100));
  return <section className="mx-auto max-w-2xl px-5 py-9 sm:py-14">
    <button onClick={onBack} className="mb-8 inline-flex items-center gap-2 rounded-lg p-1 text-sm text-stone-500 transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"><ArrowLeft className="h-4 w-4" />返回复盘</button>
    <div className="mb-8 flex items-center gap-4">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#ECE8DA] text-[#33332F]"><div aria-hidden="true" className="absolute inset-0 rounded-3xl bg-[#DDD9CB] blur-xl" /><UserRound className="relative h-7 w-7" strokeWidth={1.5} /></div>
      <div><p className="mb-1 text-xs tracking-[.18em] text-[#55554F]">给自己，留一点空间</p><h1 tabIndex={-1} data-page-heading className="text-2xl font-semibold tracking-tight outline-none">个人主页</h1><p className="mt-2 text-xs text-stone-500">{user.is_guest ? '游客 · 每天 15 次' : `${user.username} · ${PLAN_LABELS[user.plan] || '免费版'}`}</p></div>
    </div>
    <div className="rounded-3xl border border-stone-200/70 bg-white p-6 shadow-[0_12px_36px_rgba(63,79,59,0.06)] sm:p-8">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-medium text-stone-800">我的额度</h2><p className="mt-1 text-xs text-stone-400">{unlimited ? '高级会员，不限次数' : (user.is_guest ? '游客模式，每天 15 次' : '每天自动重置，最多 40 次')}</p></div><span className="rounded-full bg-[#ECE8DA] px-3 py-1 text-xs text-[#33332F]">{user.is_guest ? '游客' : PLAN_LABELS[user.plan] || '免费版'}</span></div>
      <div className="mt-7 flex items-end justify-between"><p className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">{unlimited ? '无限' : quota?.remaining}<span className="ml-1 text-sm font-normal text-stone-400">{unlimited ? '次' : '次今天剩余'}</span></p><p className="text-xs text-stone-500">{unlimited ? '' : `今天已用 ${used} / ${dailyLimit}`}</p></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ECE8DA]" role="progressbar" aria-label="今日额度使用进度" aria-valuemin="0" aria-valuemax={dailyLimit} aria-valuenow={used}><div className="h-full rounded-full bg-gradient-to-r from-[#77776E] to-[#33332F] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      <p className="mt-5 border-t border-stone-100 pt-4 text-xs leading-6 text-stone-500">{unlimited ? `当前：${PLAN_LABELS[user.plan]}，${formatExpiry(user.plan, user.plan_expires_at)}。` : (user.is_guest ? '游客每天 15 次，成功后计次；注册/登录后每天 40 次、额度不丢。' : '每天 40 次，成功后计次，失败不扣；当天用完可开通会员继续。')}</p>
    </div>
    <button onClick={onUpgrade} className="group relative mt-5 w-full overflow-hidden rounded-3xl border border-[#DDD9CB] bg-[#ECE8DA] p-6 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-[#E5E1D3] hover:shadow-[0_14px_34px_rgba(89,111,82,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 sm:p-8">
      <div aria-hidden="true" className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/40 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-[#33332F]"><Sparkles className="h-5 w-5" /></span><span className="inline-flex items-center rounded-full border border-[#D0CCBE] bg-white/30 px-2.5 py-1 text-[11px] text-[#33332F]">{unlimited ? '已开通' : '月卡 · 年卡 · 终身卡'}</span></div>
      <h2 className="relative mt-5 flex items-center justify-between text-lg font-semibold text-[#1A1A1A]">高级会员<ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></h2><p className="relative mt-2 text-sm leading-7 text-[#44443E]">开通后不再受每天 40 次限制，随时继续复盘。</p>
    </button>
    <button onClick={onLogout} className="mt-7 w-full rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm text-stone-600 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40">{user.is_guest ? '退出游客模式 · 登录/注册' : '退出登录'}</button>
  </section>;
}
