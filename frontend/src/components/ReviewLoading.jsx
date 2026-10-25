import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Leaf, Sparkles } from 'lucide-react';

const LINES = [
  ['正在把这段话理顺……', '先把情绪放在桌上，不急着给谁定性。'],
  ['正在找出真正卡住的地方……', '很多争吵表面是语气，底下可能是需求。'],
  ['正在整理下一步怎么走……', '等一会儿，我们给你一个能拿走的结论。'],
];

export default function ReviewLoading({ reduced }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reduced) return undefined;
    const timer = window.setInterval(() => setPhase((value) => (value + 1) % LINES.length), 4200);
    return () => window.clearInterval(timer);
  }, [reduced]);
  return <div className="relative overflow-hidden rounded-2xl border border-[#DDD9CB] bg-gradient-to-br from-[#F4F1E6] to-white px-5 py-6 shadow-[0_8px_24px_rgba(89,111,82,0.06)]" role="status" aria-live="polite">
    <div aria-hidden="true" className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#ECE8DA] blur-2xl" />
    <div className="relative flex items-start gap-3">
      <motion.span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECE8DA] text-[#33332F]" animate={reduced ? undefined : { rotate: [0, 4, -4, 0] }} transition={{ duration: 3, repeat: Infinity }}><Brain className="h-4.5 w-4.5" strokeWidth={1.5} /></motion.span>
      <div className="min-w-0"><motion.p key={phase} initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-medium leading-7 text-[#33332F]">{LINES[phase][0]}</motion.p><p className="mt-1 text-xs leading-6 text-stone-500">{LINES[phase][1]}</p></div>
      <div className="ml-auto flex shrink-0 gap-1 pt-2" aria-hidden="true">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-[#66665E]" animate={reduced ? { opacity: .65 } : { y: [0, -4, 0], opacity: [.35, 1, .35] }} transition={{ duration: 1, repeat: reduced ? 0 : Infinity, delay: i * .16 }} />)}</div>
    </div>
    <div className="relative mt-5 flex items-center gap-2 text-[11px] text-stone-400"><Leaf className="h-3 w-3 text-[#66665E]" />这不是评判，是帮你看清楚</div>
  </div>;
}
