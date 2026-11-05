import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useClanStore } from '@/store/clanStore';
import { Profile } from './Profile';
import styles from './ProfilePage.module.css';

/** /nguoi/:id — a person's full profile page (shareable link). */
export default function ProfilePage() {
  const { id = '' } = useParams();
  const model = useClanStore((s) => s.model);
  const navigate = useNavigate();
  const person = model?.get(id);

  useEffect(() => {
    if (person) document.title = `${person.fullName} — ${model?.settings.title ?? 'Gia phả'}`;
  }, [person, model]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  if (!model) return null;
  if (!person) {
    return (
      <div className={styles.page}>
        <h1>Không tìm thấy</h1>
        <p>Không có người này trong gia phả. Có thể dữ liệu đã thay đổi.</p>
        <Link to="/">← Về trang đầu</Link>
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <Profile model={model} person={person} variant="page" onPick={(p) => navigate(`/nguoi/${encodeURIComponent(p.id)}`)} />
    </div>
  );
}
