interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number;
}

export function PageHeader({ title, description, count }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        {count !== undefined && (
          <span className="text-sm text-text-muted">{count}</span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      )}
    </div>
  );
}
