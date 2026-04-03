interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function Card({ children, className = "", id, onClick, onMouseEnter, onMouseLeave }: CardProps) {
  return (
    <div
      id={id}
      className={`border border-border rounded-sm p-5 scroll-mt-4 ${
        onClick ? "cursor-pointer hover:border-accent/30 transition-colors" : ""
      } ${className}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}
