import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Page.module.css';

interface Props {
  title: string;
  phase?: number | string;
  children?: ReactNode;
}

export function PlaceholderPage({ title, phase, children }: Props) {
  return (
    <div className={styles.plain}>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
      {phase !== undefined && <p className={styles.muted}>Tính năng này sẽ có ở giai đoạn {phase}.</p>}
      <p>
        <Link to="/">← Về trang đầu</Link>
      </p>
    </div>
  );
}
