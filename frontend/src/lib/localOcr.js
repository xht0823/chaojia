// A single in-memory OCR job for the page. No model API or persistent caches.
let active = null;
const aborted = () => new DOMException('识别已取消', 'AbortError');

// Build a role-labeled transcript from OCR blocks using left/right position.
// WeChat convention: right side = 我, left side = 对方.
function transcriptFromBlocks(data, width) {
  const lines = [];
  const collect = (block) => {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const text = (line.text || '').trim();
        if (text && line.bbox) lines.push({ text, cx: (line.bbox.x0 + line.bbox.x1) / 2, y: line.bbox.y0, x0: line.bbox.x0 });
      }
    }
  };
  for (const block of data.blocks || []) collect(block);
  if (!lines.length) return (data.text || '').trim();
  lines.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const mid = width / 2;
  const parts = [];
  let current = null;
  for (const line of lines) {
    const side = line.cx >= mid ? '我' : '对方';
    if (current && current.side === side) current.text += ` ${line.text}`;
    else { current = { side, text: line.text }; parts.push(current); }
  }
  return parts.map((part) => `${part.side}：${part.text}`).join('\n');
}

export function startLocalOcr(file, width, onProgress) {
  if (active) throw new Error('上一项识别仍在清理，请稍后再试。');
  const task = { cancelled: false, worker: null };
  active = task;
  let stop;
  const cancelled = new Promise((_, reject) => { stop = reject; });
  const cancel = () => {
    if (task.cancelled) return;
    task.cancelled = true;
    stop(aborted());
    if (task.worker) {
      task.worker.terminate();
      if (active === task) active = null;
    }
  };
  const work = (async () => {
    try {
      const { createWorker } = await import('tesseract.js');
      if (task.cancelled) throw aborted();
      const root = new URL(`${import.meta.env.BASE_URL}ocr/v7/`, window.location.origin);
      const worker = await createWorker(['chi_sim', 'eng'], 1, {
        workerPath: new URL('worker.min.js', root).href,
        corePath: new URL('core', root).href,
        langPath: new URL('lang', root).href,
        workerBlobURL: false,
        cacheMethod: 'none',
        gzip: true,
        logger: (message) => {
          if (!task.cancelled) onProgress(message);
        },
        errorHandler: () => {},
      });
      task.worker = worker;
      if (task.cancelled) throw aborted();
      await worker.setParameters({ tessedit_pageseg_mode: '11' });
      const result = await worker.recognize(file, {}, { text: true, blocks: true });
      if (task.cancelled) throw aborted();
      return transcriptFromBlocks(result.data, width);
    } finally {
      if (task.worker) await task.worker.terminate();
      if (active === task) active = null;
    }
  })();
  const timeout = window.setTimeout(cancel, 120000);
  const promise = Promise.race([work, cancelled]).finally(() => window.clearTimeout(timeout));
  return { promise, cancel };
}
