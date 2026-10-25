import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';

function splitConclusion(report) {
  const conclusion = report.match(/\*\*最终结论：\*\*\s*([^\n]+)/)?.[1]?.trim();
  const action = report.match(/\*\*现在先做：\*\*\s*([^\n]+)/)?.[1]?.trim();
  const summary = report.match(/\*\*一句话总结：\*\*\s*([^\n]+)/)?.[1]?.trim();
  return { conclusion, action, summary };
}

export default function ConclusionCard({ report }) {
  const { conclusion, action, summary } = splitConclusion(report);
  const [copied, setCopied] = useState(false);
  if (!conclusion && !action && !summary) return null;
  const copy = async () => {
    const text = [conclusion && `最终结论：${conclusion}`, action && `现在先做：${action}`, summary && `一句话总结：${summary}`].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return <div className="mt-6 overflow-hidden rounded-2xl border border-[#DDD9CB] bg-gradient-to-br from-[#F4F1E6] to-white shadow-[0_8px_24px_rgba(89,111,82,0.07)]">
    <div className="flex items-center justify-between gap-3 border-b border-[#E5E1D3] px-5 py-3.5"><span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#33332F]"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[#55554F]"><MessageCircle className="h-3.5 w-3.5" /></span>把这句话带走</span><button type="button" onClick={copy} aria-label={copied ? '已复制结论' : '复制结论'} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-[#44443E] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '已复制' : '复制'}</button></div>
    <div className="space-y-4 px-5 py-5 text-sm leading-7 text-stone-700">{summary && <div className="rounded-xl bg-[#ECE8DA]/60 px-4 py-3"><p className="mb-1 text-[11px] font-semibold tracking-wide text-[#55554F]">一句话总结</p><p>{summary}</p></div>}{conclusion && <div><p className="mb-1 text-[11px] font-semibold tracking-wide text-[#55554F]">最终结论</p><p>{conclusion}</p></div>}{action && <div className="border-t border-[#E5E1D3] pt-4"><p className="mb-1 text-[11px] font-semibold tracking-wide text-[#55554F]">现在先做</p><p>{action}</p></div>}</div>
  </div>;
}

