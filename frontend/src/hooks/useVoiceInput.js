import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionApi = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

export default function useVoiceInput({ onFinal, onError } = {}) {
  const [supported] = useState(() => typeof SpeechRecognitionApi() === 'function');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef(null);

  const stop = useCallback(() => {
    if (recognition.current) {
      recognition.current.stop();
      recognition.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SR = SpeechRecognitionApi();
    if (typeof SR !== 'function') {
      setError('当前浏览器不支持语音输入');
      onError?.('当前浏览器不支持语音输入，请手动输入');
      return;
    }
    recognition.current?.stop();
    const instance = new SR();
    instance.lang = 'zh-CN';
    // iOS Safari 的 SpeechRecognition 不支持 continuous / interim，按单句模式跑更稳。
    instance.continuous = !isIOS;
    instance.interimResults = !isIOS;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (finalText) onFinal?.(finalText);
    };
    instance.onerror = (event) => {
      setListening(false);
      const messages = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器里允许使用麦克风',
        'no-speech': '没有听到声音，请靠近麦克风再试',
        'audio-capture': '没有找到可用的麦克风',
        network: '语音识别连不上服务器：浏览器自带的语音服务在国内常不可用（安卓 Chrome 依赖 Google）',
        'service-not-allowed': '浏览器不允许使用语音识别服务，可能被限制',
        'language-not-supported': '当前浏览器不支持中文语音识别',
        aborted: '语音识别被中断，请重试',
      };
      const message = messages[event.error] || `语音识别未完成（错误码：${event.error || '未知'}），请重试或改用手机键盘自带的语音输入`;
      setError(message);
      onError?.(message);
    };
    instance.onend = () => {
      setListening(false);
      if (recognition.current === instance) recognition.current = null;
    };
    recognition.current = instance;
    setError('');
    setListening(true);
    instance.start();
  }, [onFinal, onError]);

  useEffect(() => () => {
    recognition.current?.abort?.();
    recognition.current = null;
  }, []);

  return { supported, listening, error, start, stop };
}
