import type { ReactNode } from 'react';

export function Fact({ label, children, tabular = false }: { label: string; children: ReactNode; tabular?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm${tabular ? ' tabular-nums' : ''}`}>{children}</dd>
    </div>
  );
}
