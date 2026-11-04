import { Link } from 'react-router-dom';
import styles from './Page.module.css';

interface Props {
  title: string;
  phase?: number;
}

export function PlaceholderPage({ title, phase }: Props) {
  return (
    <main className={styles.page}>
      <h1>{title}</h1>
      {phase !== undefined && <p className={styles.muted}>Tính năng này sẽ có ở giai đoạn {phase}.</p>}
      <p>
        <Link to="/">← Về trang chủ</Link>
      </p>
    </main>
  );
}
