import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export default function PageHeader({ title, subtitle, actions, eyebrow }: Props) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-5 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
