import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Heart, House, MessageCircle, Sparkles } from 'lucide-react';

const SCENE_ART = {
  '情侣吵架': { icon: Heart, column: '情感版' },
  '职场甩锅': { icon: BriefcaseBusiness, column: '职场版' },
  '家长里短': { icon: MessageCircle, column: '邻里版' },
  '租房押金': { icon: House, column: '民生版' },
};

export default function ScenePicker({ examples, reduced, remaining, hasMessages, busy, onSelect, onContinue }) {
  return <section className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center px-5 py-12 text-center sm:px-8 sm:py-16">
    <div className="mb-6 inline-flex items-center gap-2 border-2 border-[#1A1A1A] bg-[#1A1A1A] px-3 py-1 text-[11px] tracking-[0.3em] text-[#F4F1E6]">头版头条</div>
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-1.5 top-1.5 -z-10 select-none text-[52px] font-bold leading-[1.02] text-[#1A1A1A]/10 sm:text-[88px]">下次不憋屈。</span>
      <h1 className="text-[52px] font-bold leading-[1.02] tracking-tight text-[#1A1A1A] sm:text-[88px]">下次不憋屈。<span className="blink" aria-hidden="true" /></h1>
    </div>
    <p className="mt-6 max-w-md text-[15px] leading-8 tracking-wide text-[#33332F] sm:text-base">有些话，吵完才想明白。<br />把经过放在这里，我们一起把心里的结理一理。</p>
    <div className="mt-7 inline-flex items-center gap-2 border border-[#1A1A1A] bg-[#F4F1E6] px-3.5 py-1.5 text-xs text-[#1A1A1A]"><Sparkles className="h-3.5 w-3.5" />{remaining === null ? '高级会员 · 无限次' : `今天还可以复盘 ${remaining} 次`}</div>
    <div className="double-rule mb-4 mt-11 w-full max-w-[700px] pt-3 text-center text-[11px] tracking-[0.3em] text-[#55554F]">从一件事开始 · 选一个版面</div>
    <div className="grid w-full max-w-[700px] grid-cols-2 gap-3 sm:grid-cols-4">
      {examples.map((example, index) => {
        const art = SCENE_ART[example.name] || { icon: Heart, column: '情感版' };
        const Icon = art.icon;
        const num = String(index + 1).padStart(2, '0');
        return <motion.button key={example.name} type="button" initial={{ opacity: 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : index * .07, duration: .35 }} whileHover={reduced ? undefined : { y: -4 }} whileTap={reduced ? undefined : { scale: .98 }} onClick={() => onSelect(example.text)} className="group relative flex min-h-[170px] flex-col items-start overflow-hidden border-2 border-[#1A1A1A] bg-[#F4F1E6] p-4 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-[185px] sm:p-5">
          <span aria-hidden="true" className="halftone absolute inset-x-0 top-0 h-1.5 opacity-60" />
          <span className="absolute right-2 top-2.5 text-[11px] font-bold text-[#1A1A1A]">{num}</span>
          <span className="mb-1 text-[9px] tracking-[0.3em] text-[#55554F]">{art.column}</span>
          <span className="mb-4 flex h-10 w-10 items-center justify-center bg-[#1A1A1A] text-[#F4F1E6]"><Icon className="h-[19px] w-[19px]" strokeWidth={1.7} /></span>
          <span className="text-sm font-bold text-[#1A1A1A]">{example.name}</span>
          <span className="mt-1.5 text-[11px] leading-5 text-[#55554F]">{example.hint}</span>
          <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[11px] font-bold text-[#1A1A1A]">开始说说 <ArrowRight className="h-3 w-3" /></span>
        </motion.button>;
      })}
    </div>
    <p className="mt-6 text-xs leading-6 text-[#55554F]">点击卡片会发送一段虚构示例，也可以直接在下方粘贴自己的对话</p>
    {hasMessages && <button type="button" onClick={onContinue} className="mt-4 border-2 border-[#1A1A1A] bg-[#F4F1E6] px-4 py-2.5 text-sm font-bold text-[#1A1A1A] transition hover:bg-[#1A1A1A] hover:text-[#F4F1E6] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2">{busy ? '查看正在生成的复盘' : '继续刚才的复盘'}</button>}
  </section>;
}
