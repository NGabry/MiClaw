interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Card({ children, className = "", id }: CardProps) {
  return (
    <div
      id={id}
      className={`border border-border rounded-sm p-5 scroll-mt-4 ${className}`}
    >
      {children}
    </div>
  );
}
