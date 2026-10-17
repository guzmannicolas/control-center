export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6 pb-5 md:pt-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
    </header>
  );
}
