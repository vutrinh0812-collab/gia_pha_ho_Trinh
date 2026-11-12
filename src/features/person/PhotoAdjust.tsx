import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/app/ui/Sheet';
import { editPerson, personContent } from '@/lib/admin/changes';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { PHOTO_ZOOM_MAX, type PhotoCrop } from '@/lib/types';
import { useAdminStore } from '@/store/adminStore';
import { cropStyle } from './Avatar';
import styles from './PhotoAdjust.module.css';

const FLAT: PhotoCrop = { zoom: 1, x: 0, y: 0 };
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * How far the photo may be shifted (a fraction of the circle) while still covering it:
 * `object-fit: cover` makes the shorter side exactly the circle, the longer one `aspect`
 * times it, and `zoom` enlarges both.
 */
export function cropBounds(aspect: number, zoom: number): { x: number; y: number } {
  const w = aspect >= 1 ? aspect : 1;
  const h = aspect >= 1 ? 1 : 1 / aspect;
  return { x: Math.max(0, (w * zoom - 1) / 2), y: Math.max(0, (h * zoom - 1) / 2) };
}

/** Keeps a crop inside the bounds that still cover the circle. */
export function clampCrop(c: PhotoCrop, aspect: number): PhotoCrop {
  const zoom = Math.min(PHOTO_ZOOM_MAX, Math.max(1, c.zoom));
  const b = cropBounds(aspect, zoom);
  return { zoom: round(zoom), x: round(Math.min(b.x, Math.max(-b.x, c.x))), y: round(Math.min(b.y, Math.max(-b.y, c.y))) };
}

/**
 * Adjust the portrait right from the profile (D95): drag the photo to move it, pinch, scroll
 * or use the slider to enlarge it, and watch the round result; guide lines mark the centre.
 */
export function PhotoAdjust({ model, person, onClose }: { model: ClanModel; person: PersonRec; onClose(): void }) {
  const apply = useAdminStore((s) => s.apply);
  const [crop, setCrop] = useState<PhotoCrop>(person.photoCrop ?? FLAT);
  const [aspect, setAspect] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const circle = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  const set = (next: PhotoCrop) => setCrop(clampCrop(next, aspectRef.current));
  // The photo's shape is known once it has loaded: keep the saved crop inside its bounds.
  useEffect(() => setCrop((c) => clampCrop(c, aspect)), [aspect]);

  const size = () => circle.current?.getBoundingClientRect().width || 1;
  const onDown = (e: React.PointerEvent) => {
    circle.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: crop.zoom };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      set({ ...crop, zoom: pinch.current.zoom * (dist / pinch.current.dist) });
    } else if (pointers.current.size === 1) {
      const s = size();
      set({ ...crop, x: crop.x + (e.clientX - last.x) / s, y: crop.y + (e.clientY - last.y) / s });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
  };
  const onWheel = (e: React.WheelEvent) => set({ ...crop, zoom: crop.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06) });
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = move[e.key];
    if (m) {
      e.preventDefault();
      set({ ...crop, x: crop.x + m[0], y: crop.y + m[1] });
    } else if (e.key === '+' || e.key === '=') set({ ...crop, zoom: crop.zoom + 0.1 });
    else if (e.key === '-') set({ ...crop, zoom: crop.zoom - 0.1 });
  };

  const unchanged = JSON.stringify(crop) === JSON.stringify(person.photoCrop ?? FLAT);
  const save = async () => {
    setBusy(true);
    setError(null);
    const flat = crop.zoom === 1 && crop.x === 0 && crop.y === 0;
    const ok = await apply(editPerson(model, person.id, { ...personContent(person), photoCrop: flat ? undefined : crop }), 'Đã căn chỉnh ảnh.');
    setBusy(false);
    if (ok) onClose();
    else setError('Chưa lưu được. Hãy thử lại.');
  };

  const deceased = person.death?.isDeceased === true;
  return (
    <Sheet
      label={`Căn chỉnh ảnh ${person.fullName}`}
      onClose={onClose}
      initialSnap="full"
      header={<h2 className={styles.title}>Căn chỉnh ảnh đại diện</h2>}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Hủy
          </button>
          <button type="button" className={styles.primary} onClick={() => void save()} disabled={busy || unchanged}>
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </>
      }
    >
      <p className={styles.hint}>Kéo ảnh để dời, hai ngón tay hoặc thanh trượt để phóng to. Đường kẻ giữa chỉ vị trí trung tâm.</p>
      <div
        ref={circle}
        className={styles.circle}
        role="application"
        aria-label="Vùng căn chỉnh ảnh: kéo để dời, mũi tên để dời từng chút, cộng trừ để phóng to"
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onKeyDown={onKey}
      >
        <img
          src={person.photoUrl}
          alt=""
          draggable={false}
          data-deceased={deceased || undefined}
          style={cropStyle(crop)}
          onLoad={(e) => setAspect(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))}
        />
        <span className={styles.guideV} aria-hidden="true" />
        <span className={styles.guideH} aria-hidden="true" />
      </div>
      <div className={styles.zoomRow}>
        <button type="button" className={styles.step} onClick={() => set({ ...crop, zoom: crop.zoom - 0.1 })} aria-label="Thu nhỏ">
          −
        </button>
        <input
          type="range"
          className={styles.slider}
          min={1}
          max={PHOTO_ZOOM_MAX}
          step={0.01}
          value={crop.zoom}
          aria-label="Phóng to"
          onChange={(e) => set({ ...crop, zoom: Number(e.target.value) })}
        />
        <button type="button" className={styles.step} onClick={() => set({ ...crop, zoom: crop.zoom + 0.1 })} aria-label="Phóng to thêm">
          +
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.value}>Phóng to {Math.round(crop.zoom * 100)}%</span>
        <button type="button" className={styles.textButton} onClick={() => setCrop(FLAT)} disabled={crop.zoom === 1 && crop.x === 0 && crop.y === 0}>
          Đặt lại
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
