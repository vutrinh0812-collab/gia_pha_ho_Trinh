import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/app/ui/Sheet';
import { getAdminBackend } from '@/lib/admin/backend';
import {
  addChild,
  addFather,
  addSpouse,
  AdminError,
  clean,
  editPerson,
  newId,
  personContent,
  type ChangeSet,
} from '@/lib/admin/changes';
import type { ClanModel, PersonRec } from '@/lib/clanModel';
import { childrenGroupLabel } from '@/lib/format';
import type { Gender, PersonFields } from '@/lib/types';
import { useAdminStore } from '@/store/adminStore';
import { DateFields } from './DateFields';
import { resizeImage } from './resizeImage';
import styles from './AdminForms.module.css';

export type FormMode = 'edit' | 'addChild' | 'addSpouse' | 'addFather';

interface Props {
  mode: FormMode;
  model: ClanModel;
  person: PersonRec;
  onDone(): void;
}

function initialDraft(mode: FormMode, person: PersonRec): PersonFields {
  switch (mode) {
    case 'edit':
      return personContent(person);
    case 'addChild':
      return { fullName: '', gender: 'male', isBloodline: true };
    case 'addSpouse':
      return { fullName: '', gender: person.gender === 'male' ? 'female' : 'male', isBloodline: false };
    case 'addFather':
      return { fullName: '', gender: 'male', isBloodline: true };
  }
}

function titleOf(mode: FormMode, person: PersonRec): string {
  switch (mode) {
    case 'edit':
      return `Sửa thông tin ${person.fullName}`;
    case 'addChild':
      return `Thêm con của ${person.fullName}`;
    case 'addSpouse':
      return `Thêm ${person.gender === 'male' ? 'vợ' : 'chồng'} cho ${person.fullName}`;
    case 'addFather':
      return `Thêm cha của ${person.fullName}`;
  }
}

/** The person form (SPEC §6, 5A.2): full screen on a phone, grouped fields, partial dates. */
export function PersonForm({ mode, model, person, onDone }: Props) {
  const [draft, setDraft] = useState<PersonFields>(() => initialDraft(mode, person));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const apply = useAdminStore((s) => s.apply);
  const unions = person.isBloodline ? model.index.unionsOf(person.id) : model.index.spouseUnionsOf(person.id);
  const [unionId, setUnionId] = useState(unions[0]?.id ?? '');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [canUpload, setCanUpload] = useState<boolean | null>(null);
  const branches = useMemo(
    () => [...new Set(model.persons.map((p) => p.branchLabel).filter((b): b is string => Boolean(b)))].sort(),
    [model],
  );
  useEffect(() => {
    void getAdminBackend().then((b) => setCanUpload(Boolean(b.uploadPhoto)));
  }, []);

  const set = <K extends keyof PersonFields>(key: K, value: PersonFields[K] | undefined) =>
    setDraft((d) => ({ ...d, [key]: value === '' ? undefined : value }));
  const setOther = (key: 'huy' | 'tu' | 'hieu' | 'thuong', value: string) =>
    setDraft((d) => ({ ...d, otherNames: { ...d.otherNames, [key]: value || undefined } }));

  const deceased = draft.death?.isDeceased === true;
  const deathLunar = draft.death?.lunar;
  const gio = draft.deathAnniversaryLunar;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let changeSet: ChangeSet;
    try {
      const fields = clean(draft);
      changeSet =
        mode === 'edit'
          ? editPerson(model, person.id, fields)
          : mode === 'addChild'
            ? addChild(model, person.id, fields, unionId || undefined)
            : mode === 'addSpouse'
              ? addSpouse(model, person.id, fields)
              : addFather(model, person.id, fields);
    } catch (err) {
      setError(err instanceof AdminError ? err.message : 'Dữ liệu chưa hợp lệ.');
      return;
    }
    setBusy(true);
    const ok = await apply(changeSet, mode === 'edit' ? 'Đã lưu thay đổi.' : 'Đã thêm.');
    setBusy(false);
    if (ok) onDone();
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const backend = await getAdminBackend();
      const { image, thumb } = await resizeImage(file);
      const url = await backend.uploadPhoto!(mode === 'edit' ? person.id : newId(), image, thumb);
      set('photoUrl', url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được ảnh lên.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const formId = 'person-form';
  return (
    <Sheet
      label={titleOf(mode, person)}
      onClose={onDone}
      initialSnap="full"
      header={<h2 className={styles.title}>{titleOf(mode, person)}</h2>}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onDone}>
            Hủy
          </button>
          <button type="submit" form={formId} className={styles.primary} disabled={busy || photoBusy}>
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {mode === 'addFather' && (
          <p className={styles.note}>
            {model.founders.length > 1
              ? `Người này sẽ thành thủy tổ mới (đời 1) và là cha chung của cả ${model.founders.length} gia đình đang ở đời 1. Mọi người hiện có lùi xuống một đời.`
              : 'Người này sẽ thành thủy tổ mới (đời 1); mọi người hiện có lùi xuống một đời.'}
          </p>
        )}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Cơ bản</legend>
          <div className={styles.field}>
            <label htmlFor="f-name">Họ và tên</label>
            <input id="f-name" required autoComplete="off" value={draft.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </div>
          {mode !== 'addFather' && (
            <div className={styles.field} role="radiogroup" aria-labelledby="f-gender-l">
              <span id="f-gender-l" className={styles.label}>
                Giới tính
              </span>
              <div className={styles.segment}>
                {(['male', 'female'] as Gender[]).map((g) => (
                  <label key={g} className={styles.segmentItem}>
                    <input type="radio" name="gender" id={`f-gender-${g}`} checked={draft.gender === g} onChange={() => set('gender', g)} />
                    <span>{g === 'male' ? 'Nam' : 'Nữ'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {mode === 'addChild' && unions.length > 1 && (
            <div className={styles.field}>
              <label htmlFor="f-union">Con của</label>
              <select id="f-union" value={unionId} onChange={(e) => setUnionId(e.target.value)}>
                {unions.map((u) => {
                  const partner = model.get(u.bloodlinePersonId === person.id ? u.spousePersonId : u.bloodlinePersonId);
                  return (
                    <option key={u.id} value={u.id}>
                      {childrenGroupLabel(partner?.gender ?? 'female', u.order)}
                      {partner ? ` · ${partner.fullName}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          {(mode === 'edit' ? person.parentUnionId : mode === 'addChild') && (
            <div className={styles.field}>
              <label htmlFor="f-order">Con thứ</label>
              <input
                id="f-order"
                inputMode="numeric"
                value={draft.birthOrder ?? ''}
                placeholder={mode === 'addChild' ? 'Tự xếp cuối' : ''}
                onChange={(e) => {
                  const n = e.target.value.replace(/\D/g, '');
                  set('birthOrder', n ? Number(n) : undefined);
                }}
              />
            </div>
          )}
          {mode !== 'addSpouse' && (
            <div className={styles.field}>
              <label htmlFor="f-branch">Chi</label>
              <input id="f-branch" list="f-branches" value={draft.branchLabel ?? ''} onChange={(e) => set('branchLabel', e.target.value)} />
              <datalist id="f-branches">
                {branches.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Tên khác</legend>
          <div className={styles.row2}>
            {(
              [
                ['huy', 'Tên húy'],
                ['tu', 'Tên tự'],
                ['hieu', 'Tên hiệu'],
                ['thuong', 'Tên thường gọi'],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className={styles.field}>
                <label htmlFor={`f-${k}`}>{label}</label>
                <input id={`f-${k}`} value={draft.otherNames?.[k] ?? ''} onChange={(e) => setOther(k, e.target.value)} />
              </div>
            ))}
          </div>
        </fieldset>

        <DateFields idPrefix="f-birth" legend="Ngày sinh" value={draft.birth} onChange={(v) => set('birth', v)} />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Ngày mất và ngày giỗ</legend>
          <label className={styles.check} htmlFor="f-deceased">
            <input
              id="f-deceased"
              type="checkbox"
              checked={deceased}
              onChange={(e) => set('death', e.target.checked ? { ...draft.death, isDeceased: true } : undefined)}
            />
            Đã mất
          </label>
          {deceased && (
            <>
              <DateFields
                idPrefix="f-death"
                legend="Ngày mất"
                value={draft.death}
                onChange={(v) => set('death', { ...(v ?? {}), isDeceased: true })}
              />
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label htmlFor="f-gio-d">Giỗ: ngày (âm lịch)</label>
                  <input
                    id="f-gio-d"
                    inputMode="numeric"
                    value={gio?.day ?? ''}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, '')) || 0;
                      set('deathAnniversaryLunar', n || gio?.month ? { day: n, month: gio?.month ?? 0 } : undefined);
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="f-gio-m">Tháng (âm lịch)</label>
                  <input
                    id="f-gio-m"
                    inputMode="numeric"
                    value={gio?.month ?? ''}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, '')) || 0;
                      set('deathAnniversaryLunar', n || gio?.day ? { day: gio?.day ?? 0, month: n } : undefined);
                    }}
                  />
                </div>
              </div>
              {deathLunar?.day && deathLunar.month && (gio?.day !== deathLunar.day || gio?.month !== deathLunar.month) && (
                <p className={styles.suggest} role="status">
                  Ngày giỗ thường lấy theo ngày mất âm lịch: {deathLunar.day}/{deathLunar.month}.{' '}
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => set('deathAnniversaryLunar', { day: deathLunar.day!, month: deathLunar.month! })}
                  >
                    Điền vào
                  </button>
                </p>
              )}
              <div className={styles.field}>
                <label htmlFor="f-burial">Nơi an táng</label>
                <input id="f-burial" value={draft.burialPlace ?? ''} onChange={(e) => set('burialPlace', e.target.value)} />
              </div>
            </>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Thông tin khác</legend>
          <div className={styles.field}>
            <label htmlFor="f-job">Nghề nghiệp</label>
            <input id="f-job" value={draft.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="f-notes">Ghi chú</label>
            <textarea id="f-notes" rows={4} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </div>
          {canUpload && (
            <div className={styles.field}>
              <label htmlFor="f-photo">Ảnh</label>
              <div className={styles.photoRow}>
                {draft.photoUrl && <img src={draft.photoUrl} alt="" className={styles.photo} />}
                <input id="f-photo" type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} disabled={photoBusy} />
              </div>
              {photoBusy && <p className={styles.note}>Đang thu nhỏ và tải ảnh lên…</p>}
              {draft.photoUrl && (
                <button type="button" className={styles.textButton} onClick={() => set('photoUrl', undefined)}>
                  Bỏ ảnh
                </button>
              )}
            </div>
          )}
          {canUpload === false && <p className={styles.note}>Chưa bật lưu ảnh cho gia phả này (xem README, mục 3.6).</p>}
        </fieldset>
      </form>
    </Sheet>
  );
}
