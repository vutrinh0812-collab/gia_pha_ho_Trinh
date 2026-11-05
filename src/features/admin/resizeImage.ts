/**
 * High-quality browser-side image resizing before upload (SPEC §4):
 * - Main portrait: up to 1600px on the longest side, JPEG quality 0.92 (stepped down only if > 1.95 MB).
 * - Thumbnail: up to 360px on the longest side, JPEG quality 0.88.
 * - Uses progressive step-down scaling with `imageSmoothingQuality = 'high'` for crisp portraits.
 */

type DrawableSource = ImageBitmap | HTMLImageElement;

async function decodeImage(blob: Blob): Promise<{ source: DrawableSource; width: number; height: number; close(): void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to HTMLImageElement decoding.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function renderToCanvas(source: DrawableSource, srcW: number, srcH: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  // Progressive 50% step-down avoids aliasing when shrinking high-megapixel phone photos.
  let curSource: CanvasImageSource = source;
  let curW = srcW;
  let curH = srcH;
  while (curW * 0.5 > targetW && curH * 0.5 > targetH) {
    const nextW = Math.max(targetW, Math.round(curW * 0.5));
    const nextH = Math.max(targetH, Math.round(curH * 0.5));
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) break;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(curSource, 0, 0, nextW, nextH);
    curSource = stepCanvas;
    curW = nextW;
    curH = nextH;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không xử lý được ảnh.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(curSource, 0, 0, targetW, targetH);
  return canvas;
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không nén được ảnh.'))), 'image/jpeg', quality),
  );
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Encodes a high-quality Data URL that fits comfortably inside a Firestore document
 * (and its auditLog before/after snapshot) when Firebase Cloud Storage is not enabled.
 */
export async function blobToFirestoreDataUrl(image: Blob, maxChars = 280_000): Promise<string> {
  const direct = await blobToDataUrl(image);
  if (direct.length <= maxChars) return direct;

  const decoded = await decodeImage(image);
  try {
    const attempts: Array<[number, number]> = [
      [1200, 0.9],
      [1080, 0.86],
      [960, 0.82],
      [800, 0.78],
      [640, 0.74],
    ];
    for (const [side, quality] of attempts) {
      const canvas = renderToCanvas(decoded.source, decoded.width, decoded.height, side);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxChars) return dataUrl;
    }
    const fallback = renderToCanvas(decoded.source, decoded.width, decoded.height, 512);
    return fallback.toDataURL('image/jpeg', 0.7);
  } finally {
    decoded.close();
  }
}

const MAX_STORAGE_BYTES = 2 * 1024 * 1024;

export async function resizeImage(file: File): Promise<{ image: Blob; thumb: Blob }> {
  if (!file.type.startsWith('image/')) throw new Error('Hãy chọn một tệp ảnh.');
  const decoded = await decodeImage(file);
  try {
    const mainCanvas = renderToCanvas(decoded.source, decoded.width, decoded.height, 1600);
    let image = await canvasToJpeg(mainCanvas, 0.92);
    if (image.size >= MAX_STORAGE_BYTES) {
      image = await canvasToJpeg(mainCanvas, 0.84);
    }
    if (image.size >= MAX_STORAGE_BYTES) {
      const smallerCanvas = renderToCanvas(decoded.source, decoded.width, decoded.height, 1280);
      image = await canvasToJpeg(smallerCanvas, 0.82);
    }
    if (image.size >= MAX_STORAGE_BYTES) throw new Error('Ảnh vẫn lớn hơn 2MB sau khi thu nhỏ.');

    const thumbCanvas = renderToCanvas(decoded.source, decoded.width, decoded.height, 360);
    const thumb = await canvasToJpeg(thumbCanvas, 0.88);
    return { image, thumb };
  } finally {
    decoded.close();
  }
}
