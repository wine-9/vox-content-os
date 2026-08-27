import type { ReactNode } from 'react';

type Tone = 'neutral' | 'sage' | 'clay' | 'plum' | 'warning' | 'danger';

export function SagePageHeader({
  eyebrow,
  title,
  description,
  status,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="sage-page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {(status || action) && <div className="sage-page-header-actions">{status}{action}</div>}
    </header>
  );
}

export function SageCard({ children, className = '', as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'article' | 'div' }) {
  return <Tag className={`card ${className}`.trim()}>{children}</Tag>;
}

export function SageStatus({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`sage-status sage-status-${tone} ${className}`.trim()}>{children}</span>;
}

export function SageSectionLabel({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return <div className="sage-section-label"><h2>{children}</h2>{detail && <span className="muted">{detail}</span>}</div>;
}
