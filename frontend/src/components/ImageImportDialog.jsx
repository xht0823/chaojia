import { useEffect, useRef, useState } from 'react';
import { ImagePlus, ScanText, ShieldCheck, X } from 'lucide-react';
import { startLocalOcr } from '../lib/localOcr';
import { TEXT_LIMIT, textLength, validateImage } from '../lib/imageValidation';

export default function ImageImportDialog({ paused, hasDraft, onClose, onConfirm }) {
  const dialog = useRef(null);
  const picker = useRef(null);
  const task = useRef(null);
  const generation = useRef(0);
  const preview = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [image, setImage] = useState(null);
  const [width, setWidth] = useState(0);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('selecting');
  const [progress, setProgress] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const running = status === 'recognizing';

  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    if (paused) node.close();
    else if (!node.open) node.showModal();
    return () => {
      node.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [paused]);

  useEffect(() => () => {
    generation.current += 1;
    task.current?.cancel();
    if (preview.current) URL.revokeObjectURL(preview.current);
  }, []);

  function cancelTask() {
    generation.current += 1;
    task.current?.cancel();
    task.current = null;
  }

  async function select(file) {
    cancelTask();
    const current = generation.current;
    setError(''); setText(''); setImage(null); setWidth(0); setStatus('validating');
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null; setUrl('');
    if (!file) { setStatus('selecting'); return; }
    try {
      const info = await validateImage(file);
      if (current !== generation.current) return;
      preview.current = URL.createObjectURL(file);
      setUrl(preview.current); setImage(file); setWidth(info.width); setStatus('preview');
    } catch (failure) {
      if (current !== generation.current) return;
      setError(failure.message); setStatus('selecting');
    }
  }

  async function recognize() {
    if (!image || running || paused || task.current) return;
    setStatus('recognizing'); setError(''); setProgress('正在准备本地识别引擎，首次需要加载资源…');
    const current = ++generation.current;
    try {
      const job = startLocalOcr(image, width, ({ status: stage, progress: value }) => {
        if (generation.current !== current) return;
        if (stage === 'recognizing text') {
          setProgress(`正在本地识别文字${Number.isFinite(value) ? ` · ${Math.round(value * 100)}%` : ''}`);
        } else if (stage.includes('language')) {
          setProgress('正在加载本站的中文与英文资源…');
        } else {
          setProgress('正在准备本地识别引擎…');
        }
      });
      task.current = job;
      const transcript = await job.promise;
      if (generation.current !== current) return;
      if (!transcript?.trim()) throw new Error('没有识别到可用文字，请裁剪聊天正文、使用更清晰的截图后重试。');
      setText(transcript.trim()); setStatus('editing');
    } catch (failure) {
      if (generation.current !== current) return;
      setStatus('preview');
      setError(failure.name === 'AbortError' ? '识别等待超时，已停止等待。请稍后重试或手动输入。' : (failure.message || '本地识别未完成，请换一张清晰截图重试。'));
    } finally {
      if (generation.current === current) task.current = null;
    }
  }

  function stop() {
    cancelTask(); setStatus(image ? 'preview' : 'selecting'); setProgress(''); setError('');
  }

  function confirm() {
    if (paused || running || !text.trim()) return;
    if (textLength(text.trim()) > TEXT_LIMIT) { setError('识别文字超过 20000 字符，请先编辑精简，不会自动截断。'); return; }
    const failure = onConfirm(text.trim());
    if (failure) setError(failure);
  }

  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); close.current(); }} aria-labelledby="image-import-title" aria-describedby="image-import-help" className="fixed inset-0 m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-stone-200 bg-[#F4F1E6] p-0 text-stone-800 shadow-2xl backdrop:bg-stone-900/30 backdrop:backdrop-blur-sm">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200/70 bg-[#F4F1E6]/95 px-5 py-5 backdrop-blur sm:px-7">
      <div><h2 id="image-import-title" className="flex items-center gap-2 text-lg font-semibold text-[#1A1A1A]"><ScanText className="h-5 w-5" />从聊天截图开始</h2><p className="mt-1 text-xs leading-6 text-stone-500">选择 → 本地识别 → 校对 → 填入草稿</p></div>
      <button type="button" onClick={onClose} aria-label="关闭截图识别" className="rounded-full p-2 text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><X className="h-5 w-5" /></button>
    </div>
    <div className="space-y-5 p-5 sm:p-7">
      <p id="image-import-help" className="flex gap-2 rounded-xl bg-[#ECE8DA] p-3 text-xs leading-6 text-[#33332F]"><ShieldCheck className="mt-1 h-4 w-4 shrink-0" />按气泡左右位置自动标注：右侧为我、左侧为对方（微信习惯）。识别可能有错字，请先校对再填入草稿。</p>
      <input ref={picker} id="screenshot-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择聊天截图" disabled={running || status === 'validating' || paused} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) select(file); }} className="block w-full rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#ECE8DA] file:px-3 file:py-2 file:text-[#33332F]" />
      <p className="text-xs leading-6 text-stone-500">一次一张 PNG、JPEG 或静态 WebP；≤5 MiB、≤1600 万像素、单边≤16000像素。</p>
      {url && <div className="rounded-2xl border border-stone-200 bg-white p-3"><img src={url} alt="待识别聊天截图预览" className="mx-auto max-h-64 max-w-full rounded-lg object-contain" /><button type="button" disabled={running || paused} onClick={() => select(null)} className="mt-2 rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-40">移除图片</button></div>}
      {status === 'validating' && <p role="status" className="text-sm text-stone-500">正在检查图片格式和尺寸…</p>}
      {running ? <div role="status" aria-live="polite" className="rounded-xl border border-[#DDD9CB] bg-white p-4"><p className="text-sm text-[#33332F]">{progress}</p><p className="mt-2 text-xs leading-6 text-stone-500">进度仅代表当前识别阶段。首次加载或长图可能需要更久。</p><button type="button" onClick={stop} className="mt-3 rounded-lg border border-stone-200 px-3 py-2 text-sm">取消识别</button></div> : image && status !== 'editing' && <button type="button" onClick={recognize} disabled={paused} className="inline-flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm text-white hover:bg-[#1A1A1A] disabled:opacity-50"><ImagePlus className="h-4 w-4" />{status === 'preview' && text ? '重新识别' : '开始识别'}</button>}
      {status === 'editing' && <div><label htmlFor="ocr-text" className="mb-2 block text-sm font-medium">识别文字（请检查并编辑）</label><p className="mb-3 text-xs leading-6 text-stone-500">识别可能错字或左右标反，请校对后再填入草稿，发送前仍可在输入框继续改。</p><textarea id="ocr-text" value={text} onChange={(event) => { setText(event.target.value); setError(''); }} rows={8} spellCheck={false} className="w-full resize-y rounded-xl border border-stone-200 bg-white p-4 text-sm leading-7 outline-none focus:border-[#66665E] focus:ring-2 focus:ring-[#66665E]/20" /><p className="mt-1 text-xs text-stone-500">{textLength(text)} / {TEXT_LIMIT} 字符</p><button type="button" onClick={confirm} disabled={!text.trim() || paused} className="mt-4 w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-medium text-white hover:bg-[#1A1A1A] disabled:opacity-40">{hasDraft ? '追加到草稿' : '填入草稿'}，不自动发送</button></div>}
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">{error}</p>}
      <button type="button" onClick={onClose} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-600 hover:bg-white">返回手动输入</button>
    </div>
  </dialog>;
}
