import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="mt-1 text-muted-foreground">{description}</p>}
    </div>
  );
}
