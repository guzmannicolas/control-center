import { PageHeader } from '../components/PageHeader.tsx';

// The URL where ttyd is reached. Defaults to the same host over the dedicated terminal route or subdomain.
const TERMINAL_URL = import.meta.env.VITE_TERMINAL_URL ?? '/terminal/';

export function TerminalPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Terminal"
        subtitle="Direct interactive shell on the VPS (secured by Cloudflare Zero Trust)"
      />
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-black shadow-inner">
        <iframe
          src={TERMINAL_URL}
          title="VPS Terminal"
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
