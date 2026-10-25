import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionApi = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);

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
    instance.continuous = true;
    instance.interimResults = true;
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
        network: '语音识别网络异常，请稍后重试',
      };
      const message = messages[event.error] || '语音识别未完成，请重试';
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
