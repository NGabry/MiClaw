interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`border border-border rounded-sm p-5 ${className}`}
    >
      {children}
    </div>
  );
}
