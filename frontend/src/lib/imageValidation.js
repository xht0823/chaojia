export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;
export const MAX_IMAGE_EDGE = 16_000;
export const TEXT_LIMIT = 20_000;
export const textLength = (text) => Array.from(text).length;

const invalid = () => new Error('图片格式损坏或不受支持，请换一张 PNG、JPEG 或静态 WebP 截图。');

export function imageDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length >= 33 && bytes[0] === 137 && ascii(1, 3) === 'PNG' && view.getUint32(4) === 0x0d0a1a0a) {
    if (view.getUint32(8) !== 13 || ascii(12, 4) !== 'IHDR') throw invalid();
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset);
      if (offset + 12 + size > bytes.length) throw invalid();
      if (ascii(offset + 4, 4) === 'acTL') throw new Error('暂不支持动画图片，请使用静态截图。');
      offset += size + 12;
    }
    return { width: view.getUint32(16), height: view.getUint32(20), mime: 'image/png' };
  }
  if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) throw invalid();
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) throw invalid();
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) throw invalid();
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (size < 8) throw invalid();
        return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5), mime: 'image/jpeg' };
      }
      offset += size;
    }
    throw invalid();
  }
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    if (view.getUint32(4, true) + 8 !== bytes.length) throw invalid();
    const kind = ascii(12, 4);
    if (kind === 'VP8X') {
      if (view.getUint32(16, true) < 10 || bytes[20] & 0x02) throw new Error('暂不支持动画 WebP，请使用静态截图。');
      const uint24 = (at) => bytes[at] + bytes[at + 1] * 256 + bytes[at + 2] * 65536;
      return { width: uint24(24) + 1, height: uint24(27) + 1, mime: 'image/webp' };
    }
    if (kind === 'VP8 ' && ascii(23, 3) === '\x9d\x01\x2a') {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff, mime: 'image/webp' };
    }
    if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, mime: 'image/webp' };
    }
  }
  throw invalid();
}

export async function validateImage(file) {
  if (!file || file.size === 0) throw new Error('请选择一张有内容的聊天截图。');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片超过 5 MiB，请裁剪或压缩后再试。');
  const info = imageDimensions(new Uint8Array(await file.arrayBuffer()));
  if (file.type && file.type !== info.mime) throw invalid();
  if (!info.width || !info.height) throw invalid();
  if (info.width * info.height > MAX_IMAGE_PIXELS || Math.max(info.width, info.height) > MAX_IMAGE_EDGE) {
    throw new Error('图片尺寸过大：最多 1600 万像素、单边 16000 像素。请裁剪成较短的截图。');
  }
  // Header dimensions are checked before decoding, not after allocating a huge bitmap.
  if (typeof createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
      if (bitmap.width !== info.width || bitmap.height !== info.height) throw invalid();
    } catch {
      throw invalid();
    } finally {
      bitmap?.close();
    }
  } else {
    const url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.naturalWidth === info.width && image.naturalHeight === info.height ? resolve() : reject(invalid());
        image.onerror = () => reject(invalid());
        image.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }
  return info;
}
