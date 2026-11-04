/** Resizes a photo in the browser before upload (SPEC §4): 800px and a 120px thumbnail, JPEG. */
async function toJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không xử lý được ảnh.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không nén được ảnh.'))), 'image/jpeg', quality),
  );
}

export async function resizeImage(file: File): Promise<{ image: Blob; thumb: Blob }> {
  if (!file.type.startsWith('image/')) throw new Error('Hãy chọn một tệp ảnh.');
  const bitmap = await createImageBitmap(file);
  try {
    const image = await toJpeg(bitmap, 800, 0.85);
    if (image.size >= 2 * 1024 * 1024) throw new Error('Ảnh vẫn lớn hơn 2MB sau khi thu nhỏ.');
    const thumb = await toJpeg(bitmap, 120, 0.8);
    return { image, thumb };
  } finally {
    bitmap.close();
  }
}
