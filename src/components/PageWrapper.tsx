export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
  );
}
