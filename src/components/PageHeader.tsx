interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number;
}

export function PageHeader({ title, description, count }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-mono font-medium tracking-tight">{title}</h1>
        {count !== undefined && (
          <span className="font-mono text-sm text-text-dim">{count}</span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      )}
    </div>
  );
}
