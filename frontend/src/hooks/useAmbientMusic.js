import { useCallback, useEffect, useRef, useState } from 'react';

// 高音区五声音阶（八音盒质感），纯正弦、缓慢循环，更柔和。
const NOTES = [
  523.25, 659.25, 783.99, 659.25, // C5 E5 G5 E5
  880.00, 783.99, 659.25, 587.33, // A5 G5 E5 D5
  523.25, 659.25, 783.99, 880.00, // C5 E5 G5 A5
  783.99, 659.25, 587.33, 523.25, // G5 E5 D5 C5
];

function playNote(ctx, destination, freq, time) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.35, time + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(time);
  osc.stop(time + 1.9);
}

export default function useAmbientMusic() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const timerRef = useRef(null);
  const stepRef = useRef(0);
  const supported = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    masterRef.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (!supported || ctxRef.current) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.08;

    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.55;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);

    ctxRef.current = ctx;
    masterRef.current = master;
    stepRef.current = 0;

    const scheduleNext = () => {
      const current = ctxRef.current;
      const dest = masterRef.current;
      if (!current || !dest) return;
      playNote(current, dest, NOTES[stepRef.current % NOTES.length], current.currentTime + 0.02);
      stepRef.current += 1;
    };
    scheduleNext();
    timerRef.current = window.setInterval(scheduleNext, 680);
    setPlaying(true);
  }, [supported]);

  const toggle = useCallback(() => {
    if (playing) stop();
    else start();
  }, [playing, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { playing, toggle, supported };
}
