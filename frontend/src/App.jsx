import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ArrowDown, ArrowLeft, ArrowUp, Brain, BriefcaseBusiness, Check, Heart, House, ImagePlus, MessageCircle, Mic, Music2, RotateCcw, ShieldCheck, Sparkles, Square, TriangleAlert, UserRound } from 'lucide-react';
import useAuth from './hooks/useAuth';
import { api } from './lib/api';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import UpgradePage from './components/UpgradePage';
import UpgradeModal from './components/UpgradeModal';
import ScenePicker from './components/ScenePicker';
import ReviewLoading from './components/ReviewLoading';
import ConclusionCard from './components/ConclusionCard';
import ImageImportDialog from './components/ImageImportDialog';
import { TEXT_LIMIT, textLength } from './lib/imageValidation';
import useVoiceInput from './hooks/useVoiceInput';
import useAmbientMusic from './hooks/useAmbientMusic';

const API_URL = '/review';
const EXAMPLES = [
  { name: '情侣吵架', hint: '我只是希望被在乎', icon: Heart, tone: 'bg-rose-50 text-rose-500', text: '我跟对象说：“你晚回家能不能提前告诉我一声？我会担心。”对方说：“你就是管太多，别人对象怎么没这么多事？”我说：“我不是不让你出去，只想知道你大概几点回来。”对方说：“又来了，跟你说话真累。”我不知道怎么说才不会又吵起来。' },
  { name: '职场甩锅', hint: '这口锅，不想再背了', icon: BriefcaseBusiness, tone: 'bg-blue-50 text-blue-500', text: '主管周一在群里说方案周五交，今天周三突然问：“你怎么还没交？昨天就该给我。”我说：“群里约的是周五，新增的数据也还没拿到。”主管说：“别找借口，别人都能提前做完。”群消息和需求变更记录我都留着，但我不想当众顶撞，也不想背锅。' },
  { name: '家长里短', hint: '讲边界，也留余地', icon: MessageCircle, tone: 'bg-amber-50 text-amber-600', text: '邻居把几个大箱子放在楼道，我推婴儿车经常过不去。我说：“能不能把箱子挪一下，至少留出通道？”邻居说：“我住了二十年，一直这么放，就你事多。”我拍了照片，还没找物业，也不想把邻里关系闹僵。' },
  { name: '租房押金', hint: '该拿回的，好好拿回', icon: House, tone: 'bg-emerald-50 text-emerald-600', text: '合同约定退租验收后七天退押金，房东验收时说没有损坏，现在已经第十天。我问：“请问押金什么时候能退？”房东说：“最近忙，再等等。你催什么催，住过总有损耗，扣多少我说了算。”我有合同、转账记录和验收时的聊天记录，现在应该怎么办？' },
];

const markdownComponents = {
  h1: ({ children }) => <h1 className="mt-7 mb-5 text-xl font-semibold tracking-tight text-stone-900 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-8 mb-4 rounded-xl border border-stone-100 bg-[#ECE8DA] px-4 py-3 text-[15px] font-semibold leading-7 text-stone-800 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-5 mb-3 font-semibold text-stone-800">{children}</h3>,
  p: ({ children }) => <p className="mb-4 whitespace-pre-wrap break-words leading-8 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-stone-900">{children}</strong>,
  ul: ({ children }) => <ul className="mb-5 list-disc space-y-3 pl-5 marker:text-stone-400">{children}</ul>,
  ol: ({ children }) => <ol className="mb-5 list-decimal space-y-4 pl-5 marker:text-stone-500">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-8">{children}</li>,
  blockquote: ({ children }) => <blockquote className="my-5 rounded-r-xl border-l-2 border-amber-200 bg-amber-50/40 px-4 py-3 text-stone-600">{children}</blockquote>,
};

function sceneClass(scene = '') {
  if (/情侣|亲密/.test(scene)) return 'border-[#1A1A1A] bg-white text-[#1A1A1A]';
  if (/职场/.test(scene)) return 'border-[#1A1A1A] bg-white text-[#1A1A1A]';
  if (/家长|邻里/.test(scene)) return 'border-[#1A1A1A] bg-white text-[#1A1A1A]';
  if (/消费|租房|押金/.test(scene)) return 'border-[#1A1A1A] bg-white text-[#1A1A1A]';
  return 'border-[#1A1A1A] bg-white text-[#1A1A1A]';
}

const CONTEXT_LIMIT = 4000;
function truncate(str, limit) {
  const chars = Array.from(str);
  return chars.length <= limit ? str : `${chars.slice(0, limit).join('')}…`;
}
function summaryOf(report) {
  const conclusion = report.match(/\*\*最终结论：\*\*\s*([^\n]+)/)?.[1]?.trim();
  const action = report.match(/\*\*现在先做：\*\*\s*([^\n]+)/)?.[1]?.trim();
  if (conclusion || action) {
    return [conclusion && `结论：${conclusion}`, action && `先做：${action}`].filter(Boolean).join('；');
  }
  return report;
}
function buildContext(messages) {
  const parts = [];
  for (const message of messages) {
    if (message.role === 'user') parts.push(`用户：${truncate(message.text, 800)}`);
    else if (message.status === 'done' && message.report) parts.push(`复盘：${truncate(summaryOf(message.report), 800)}`);
  }
  let context = parts.join('\n');
  while (textLength(context) > CONTEXT_LIMIT && parts.length > 1) {
    parts.shift();
    context = parts.join('\n');
  }
  return truncate(context, CONTEXT_LIMIT);
}

export default function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('chat');
  const [showScenes, setShowScenes] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [imageImport, setImageImport] = useState(null);
  const [inputError, setInputError] = useState('');
  const [deep, setDeep] = useState(false);
  const [composerHeight, setComposerHeight] = useState(160);
  const [showTop, setShowTop] = useState(false);
  const textarea = useRef(null);
  const composer = useRef(null);
  const scroll = useRef(null);
  const bottom = useRef(null);
  const request = useRef(null);
  const id = useRef(0);
  const reduced = useReducedMotion();
  const auth = useAuth();
  const quota = auth.user?.quota;
  const voice = useVoiceInput({
    onFinal: (text) => setInput((prev) => (prev ? prev + text : text)),
    onError: (message) => setInputError(message),
  });
  const music = useAmbientMusic();

  useLayoutEffect(() => {
    request.current?.abort();
    voice.stop();
    request.current = null;
    setImageImport(null); setInputError('');
    setInput(''); setMessages([]); setBusy(false); setShowUpgradeModal(false); setShowTop(false); setShowScenes(true); setView('chat');
  }, [auth.revision]);

  useEffect(() => {
    const node = composer.current;
    if (!node) { setComposerHeight(0); return undefined; }
    const update = () => setComposerHeight(Math.ceil(node.getBoundingClientRect().height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [view, auth.status]);

  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = 'auto';
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 160)}px`;
  }, [input, view, auth.status]);

  useEffect(() => {
    if (view === 'chat' && !showScenes) bottom.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }, [messages, reduced, view, showScenes]);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (view !== 'chat') scroll.current?.scrollTo({ top: 0 }); }, [view]);

  const focus = () => requestAnimationFrame(() => textarea.current?.focus());
  const goScenes = () => { setImageImport(null); setShowScenes(true); setShowTop(false); setView('chat'); scroll.current?.scrollTo({ top: 0 }); };
  const goChat = () => { setShowScenes(false); setView('chat'); focus(); };
  const goProfile = () => { setImageImport(null); setView('profile'); };
  const goUpgrade = () => { setImageImport(null); setView('upgrade'); };
  const handlePurchased = () => { setShowUpgradeModal(false); setView('chat'); auth.refresh(); focus(); };
  const reset = () => { setImageImport(null); setInputError(''); voice.stop(); request.current?.abort(); request.current = null; setShowUpgradeModal(false); setMessages([]); setInput(''); setBusy(false); setShowTop(false); setShowScenes(true); setView('chat'); focus(); };
  const onScroll = () => { const node = scroll.current; if (node) setShowTop(node.scrollHeight - node.scrollTop - node.clientHeight > 220); };

  async function send(value = input) {
    const text = value.trim();
    if (!text || request.current || auth.status !== 'authenticated') return;
    if (textLength(text) > TEXT_LIMIT) { setInputError('内容超过 20000 字符，请精简后再发送。'); return; }
    setInputError('');
    const context = buildContext(messages);
    const epoch = auth.epoch.current;
    const controller = new AbortController();
    request.current = controller;
    const userId = `u-${++id.current}`;
    const assistantId = `a-${++id.current}`;
    setInput(''); setBusy(true); setShowScenes(false); setView('chat');
    setMessages((old) => [...old, { id: userId, role: 'user', text }, { id: assistantId, role: 'assistant', status: 'loading' }]);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 70000);
    try {
      const data = await api(API_URL, { body: { text, scene: 'auto', deep, context }, signal: controller.signal });
      if (typeof data.report !== 'string' || !data.report.trim()) throw new Error('报告为空，请稍后重试');
      if (request.current !== controller || auth.epoch.current !== epoch) return;
      setMessages((old) => old.map((message) => message.id === assistantId ? { ...message, status: 'done', report: data.report, scene: typeof data.scene_detected === 'string' ? data.scene_detected : 'auto' } : message));
    } catch (error) {
      if (request.current !== controller || auth.epoch.current !== epoch || (error.name === 'AbortError' && !timedOut)) return;
      if (error.status === 401) { auth.expire(); return; }
      if (error.code === 'QUOTA_EXHAUSTED') {
        setInput(text);
        setMessages((old) => old.filter((message) => message.id !== assistantId && message.id !== userId));
        setShowUpgradeModal(true);
        return;
      }
      setMessages((old) => old.map((message) => message.id === assistantId ? { ...message, status: 'error', error: timedOut ? '这次等得有点久。后端若已完成仍会计次，请稍后查看额度。' : error.message || '这次没能顺利生成复盘，请稍后重试。', originalText: text } : message));
    } finally {
      clearTimeout(timeout);
      if (request.current === controller && auth.epoch.current === epoch) { request.current = null; setBusy(false); auth.refresh(); }
    }
  }

  function importText(text) {
    if (auth.status !== 'authenticated' || !imageImport || imageImport.epoch !== auth.epoch.current) return '登录状态变化，请重新打开识别。';
    const merged = input.trim() ? `${input}\n\n${text}` : text;
    if (textLength(merged) > TEXT_LIMIT) return '合并后超过 20000 字符，请先精简识别文字或原草稿。';
    setInput(merged); setInputError(''); setImageImport(null); focus();
    return null;
  }

  function keyDown(event) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
  }

  const hasMessages = messages.length > 0;
  if (auth.status === 'loading' || auth.status === 'error') return <div className="flex min-h-[100dvh] items-center justify-center bg-[#F4F1E6] p-6 text-center text-stone-600"><div role="status"><MessageCircle className="mx-auto mb-5 h-8 w-8 text-[#55554F]" /><p className="text-sm">{auth.status === 'loading' ? '正在确认登录状态…' : auth.error}</p>{auth.status === 'error' && <button onClick={auth.refresh} className="mt-5 rounded-xl bg-[#1A1A1A] px-5 py-3 text-sm text-white">重新连接</button>}</div></div>;
  if (!auth.user) return <AuthPage onLogin={auth.login} onGuest={auth.guest} notice={auth.error} onRetryLogout={auth.logout} />;
  const page = view === 'profile' ? <ProfilePage user={auth.user} quota={quota} onLogout={auth.logout} onBack={goChat} onUpgrade={goUpgrade} /> : view === 'upgrade' ? <UpgradePage user={auth.user} onBack={goChat} onPurchased={handlePurchased} onRegister={auth.logout} /> : null;

  return <div className="relative isolate flex h-[100dvh] min-h-[320px] flex-col overflow-hidden bg-[#F4F1E6] text-[#1A1A1A]">
    <div aria-hidden="true" className="paper-grain pointer-events-none absolute inset-x-0 top-0 -z-10 h-72" />
    <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-16 -z-10 h-96 w-96 rounded-full bg-[#E5E1D3]/35 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-64 -z-10 h-96 w-96 rounded-full bg-[#E5E1D3]/40 blur-3xl" />
    <header className="z-20 shrink-0 bg-[#F4F1E6]">
      <div className="marquee border-b border-[#1A1A1A] bg-[#1A1A1A] py-1 text-[11px] tracking-[0.12em] text-[#F4F1E6]" aria-hidden="true">
        <div className="marquee-track">【今日头版】把憋屈的话，摊开来说 · 每一次复盘，都给自己留一点空间 · 沟通复盘日报 · 不教你对骂，只帮你把事想清楚 · </div>
      </div>
      <div className="relative border-b-[3px] border-double border-[#1A1A1A]">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-5 py-2.5 sm:px-8">
          <button onClick={goScenes} className="flex flex-col items-center focus-visible:outline-none" aria-label="回到四个场景">
            <span className="text-[10px] tracking-[0.4em] text-[#33332F]">沟通复盘日报</span>
            <span className="text-[30px] font-bold leading-none tracking-[0.05em] text-[#1A1A1A] sm:text-[36px]">吵完才懂</span>
            <span className="mt-1 text-[9px] tracking-[0.2em] text-[#55554F]">把憋屈的话，摊开来说 · 第 001 期</span>
          </button>
          <span className="ink-stamp absolute left-4 top-1/2 -translate-y-1/2 text-[12px] sm:left-8">号外</span>
          <button onClick={music.toggle} disabled={!music.supported} title={music.playing ? '关闭轻音乐' : '开启治愈轻音乐'} aria-label={music.playing ? '关闭轻音乐' : '开启轻音乐'} aria-pressed={music.playing} className={`absolute right-[8.5rem] flex h-9 w-9 items-center justify-center border border-[#1A1A1A] transition focus-visible:outline-none sm:right-[12rem] ${music.playing ? 'bg-[#1A1A1A] text-[#F4F1E6]' : 'text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F4F1E6]'} disabled:opacity-30`}><Music2 className={`h-4 w-4 ${music.playing ? 'animate-pulse' : ''}`} /></button>
          <button onClick={goProfile} aria-label="个人主页" aria-current={view === 'profile' ? 'page' : undefined} title="个人主页" className={`absolute right-14 flex h-9 items-center gap-1.5 border border-[#1A1A1A] px-2.5 text-xs transition focus-visible:outline-none sm:right-20 ${view === 'profile' ? 'bg-[#1A1A1A] text-[#F4F1E6]' : 'text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F4F1E6]'}`}><UserRound className="h-4 w-4" /><span className="hidden sm:inline">我的</span></button>
          <button onClick={reset} title="清空重来" aria-label="清空重来" className="absolute right-4 flex h-9 w-9 items-center justify-center border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F4F1E6] focus-visible:outline-none"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
    <main ref={scroll} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: view === 'chat' ? composerHeight : 0 }}>
      <AnimatePresence mode="wait">
        {view !== 'chat' ? <motion.div key={view} onAnimationComplete={() => document.querySelector('[data-page-heading]')?.focus({ preventScroll: true })} initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="min-h-full">{page}</motion.div> : showScenes || !hasMessages ? <motion.div key="scenes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-full"><ScenePicker examples={EXAMPLES} reduced={reduced} remaining={quota?.unlimited ? null : quota?.remaining} hasMessages={hasMessages} busy={busy} onSelect={(text) => { setInput(text); send(text); }} onContinue={goChat} /></motion.div> : <motion.section key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex items-center justify-between px-1"><button type="button" onClick={goScenes} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-stone-500 hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"><ArrowLeft className="h-3.5 w-3.5" />返回四个场景</button><button onClick={goProfile} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-stone-500 hover:bg-white hover:text-stone-800"><Sparkles className="h-3 w-3 text-[#55554F]" />{quota?.unlimited ? '无限次' : `剩余 ${quota?.remaining ?? 0} 次`}</button></div>
          {messages.map((message) => <motion.article key={message.id} initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'user' ? <div className="max-w-[90%] rounded-2xl rounded-br-md bg-[#1A1A1A] px-5 py-4 text-[14px] leading-7 text-stone-100 shadow-sm sm:max-w-[85%] sm:text-[15px]"><p className="whitespace-pre-wrap break-words">{message.text}</p></div> : <div className="w-full min-w-0"><div className="mb-3 flex flex-wrap items-center gap-2.5 px-1"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#ECE8DA] text-[#33332F]"><Sparkles className="h-3.5 w-3.5" /></span><span className="text-xs font-medium tracking-wide text-stone-500">吵完才懂</span>{message.status === 'done' && message.scene !== 'auto' && <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${sceneClass(message.scene)}`}><Check className="h-3 w-3" />{message.scene}</span>}</div>
              <div className="rounded-2xl rounded-tl-md border border-gray-100 bg-white px-5 py-6 shadow-[0_10px_30px_rgba(63,79,59,0.06)] sm:px-7 sm:py-7">{message.status === 'loading' ? <ReviewLoading reduced={reduced} /> : message.status === 'error' ? <div role="alert"><div className="flex items-start gap-3"><TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-amber-600" /><p className="text-sm leading-7 text-stone-600">{message.error}</p></div><button disabled={busy} onClick={() => { setInput(message.originalText); focus(); }} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />放回输入框，再试一次</button></div> : <><div className="min-w-0 break-words text-[14px] text-stone-600 sm:text-[15px]"><ReactMarkdown skipHtml components={markdownComponents}>{message.report}</ReactMarkdown></div><ConclusionCard report={message.report} /></>}</div>
              {message.status === 'done' && <p className="mt-3 px-1 text-[11px] leading-6 text-stone-400">不急着回应对方。先想清楚，你真正想解决的是什么。</p>}
            </div>}
          </motion.article>)}
        </motion.section>}
      </AnimatePresence><div ref={bottom} className="h-6" aria-hidden="true" />
    </main>
    {view === 'chat' && !showScenes && showTop && hasMessages && <button type="button" aria-label="滚动到最新消息" onClick={() => bottom.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })} style={{ bottom: composerHeight + 14 }} className="fixed left-1/2 z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm"><ArrowDown className="h-4 w-4" /></button>}
    {view === 'chat' && <footer ref={composer} className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/40 bg-[#F4F1E6]/85 px-4 pt-4 backdrop-blur-xl sm:px-6" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}><div className="mx-auto max-w-3xl"><form onSubmit={(event) => { event.preventDefault(); send(); }} className="rounded-[22px] border border-stone-200 bg-white p-2 shadow-sm focus-within:border-[#77776E] focus-within:ring-4 focus-within:ring-[#DDD9CB]/60"><div className="flex items-end gap-2"><button type="button" onClick={() => (voice.listening ? voice.stop() : voice.start())} disabled={!voice.supported || busy} title={voice.supported ? '语音输入' : '当前浏览器不支持语音输入'} aria-label={voice.listening ? '停止语音输入' : '语音输入'} className={`mb-1 ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 disabled:cursor-not-allowed disabled:opacity-40 ${voice.listening ? 'bg-[#ECE8DA] text-[#33332F]' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}>{voice.listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button><button type="button" onClick={() => setImageImport({ epoch: auth.epoch.current })} disabled={busy} title="上传聊天截图识别" aria-label="上传聊天截图识别" className="mb-1 ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 disabled:cursor-not-allowed disabled:opacity-40"><ImagePlus className="h-5 w-5" /></button><textarea ref={textarea} value={input} rows={1} onChange={(event) => { setInput(event.target.value); setInputError(''); }} onKeyDown={keyDown} aria-label="输入吵架经过或纠纷对话" placeholder="把让你憋屈的对话粘在这里…" className="min-h-[48px] max-h-40 w-full resize-none overflow-y-auto bg-transparent px-3 py-3 text-[15px] leading-6 text-stone-800 outline-none placeholder:text-stone-400 sm:px-4" /><motion.button type="submit" disabled={!input.trim() || busy} whileTap={reduced || !input.trim() || busy ? undefined : { scale: .94 }} aria-label="发送，开始复盘" className="mb-1 mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1A1A1A] text-white transition hover:bg-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"><ArrowUp className="h-5 w-5" /></motion.button></div></form>{inputError && <p role="alert" className="mt-2 px-2 text-xs text-rose-600">{inputError}</p>}<div className="mt-3 flex items-center justify-between gap-3 px-1 text-[10px] leading-5 text-stone-500 sm:text-[11px]">{voice.listening && <span className="inline-flex items-center gap-1.5 text-[#33332F]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#66665E]" />正在听，说完了点方块结束</span>}<button type="button" onClick={() => setDeep(!deep)} aria-pressed={deep} title={deep ? '已开启深度思考，会输出完整复盘' : '开启深度思考，输出完整四模块复盘'} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 ${deep ? 'border-[#77776E] bg-[#ECE8DA] text-[#33332F]' : 'border-stone-200 bg-white/60 text-stone-500 hover:bg-white hover:text-stone-800'}`}><Brain className="h-3.5 w-3.5" />深度思考{deep ? ' · 开' : ''}</button><span className="hidden items-center gap-1.5 sm:inline-flex"><ShieldCheck className="h-3 w-3" />对话只在当前页面保留</span><span className="hidden sm:inline">Enter 发送 · Shift + Enter 换行</span></div><p className="mt-1 px-1 text-[10px] leading-5 text-stone-400">默认直接给结论和怎么做；开启深度思考会输出完整四模块复盘。</p></div></footer>}
    {imageImport && <ImageImportDialog paused={imageImport.epoch !== auth.epoch.current} hasDraft={input.trim().length > 0} onClose={() => setImageImport(null)} onConfirm={importText} />}
    {showUpgradeModal && <UpgradeModal isGuest={auth.user?.is_guest} onClose={() => { setShowUpgradeModal(false); focus(); }} onProfile={() => { setShowUpgradeModal(false); goProfile(); }} onPurchased={handlePurchased} onRegister={auth.logout} />}
  </div>;
}
