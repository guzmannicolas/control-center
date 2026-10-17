import type { LearningProgressView } from '@cc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { MODULES, REPO, type LearningModule } from '../learning/modules.ts';
import { Link, usePath } from '../router.tsx';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

function useProgress() {
  return useQuery({ queryKey: ['learning'], queryFn: api.learningProgress });
}

function Badge({ module, earned }: { module: LearningModule; earned?: LearningProgressView }) {
  return (
    <Link
      to={`/learning/${module.id}`}
      className={`group flex flex-col rounded-xl border p-4 transition-colors ${
        earned ? 'border-series/50 bg-surface ring-1 ring-series/30' : 'border-dashed border-line bg-page hover:bg-surface'
      }`}
    >
      <span
        aria-hidden
        className={`grid size-10 place-items-center rounded-full text-lg font-bold ${earned ? 'bg-series text-white' : 'border border-dashed border-muted text-muted'}`}
      >
        {earned ? '✓' : module.badge[0]}
      </span>
      <span className="mt-3 font-semibold">{module.badge}</span>
      <span className="text-sm text-ink-2">{module.title}</span>
      <span className="mt-auto pt-3 text-xs text-muted">
        {earned ? `Earned ${shortDate(earned.completedAt)}` : `Not yet · ${module.minutes} min`}
      </span>
    </Link>
  );
}

function Overview() {
  const progress = useProgress();
  const earned = new Map((progress.data ?? []).map((p) => [p.moduleId, p]));
  const done = MODULES.filter((m) => earned.has(m.id)).length;
  const debt = MODULES.length - done;
  const pct = Math.round((done / MODULES.length) * 100);

  return (
    <div>
      <PageHeader title="Learning" subtitle={`${done} of ${MODULES.length} badges`} />
      <section className="mb-6 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Knowledge debt</h2>
          <span className="text-sm text-ink-2 tabular-nums">{pct}% studied</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-grid" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Studied">
          <div className="h-full rounded-full bg-series" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {debt === 0
            ? 'You can explain every technology this project uses. New ones will appear here when they are added.'
            : `${debt} technolog${debt === 1 ? 'y' : 'ies'} in this project you have not studied yet. Each module ends with a short quiz: get every answer right to earn the badge.`}
        </p>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {MODULES.map((m) => <Badge key={m.id} module={m} earned={earned.get(m.id)} />)}
      </div>
    </div>
  );
}

function Quiz({ module, earned }: { module: LearningModule; earned?: LearningProgressView }) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<(number | null)[]>(module.quiz.map(() => null));
  const [checked, setChecked] = useState(false);
  const complete = useMutation({
    mutationFn: (score: number) => api.completeModule(module.id, score),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  });
  const reset = useMutation({
    mutationFn: () => api.resetModule(module.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  });

  const right = module.quiz.filter((q, i) => answers[i] === q.answer).length;
  const allAnswered = answers.every((a) => a !== null);
  const passed = checked && right === module.quiz.length;

  const check = () => {
    setChecked(true);
    if (right === module.quiz.length) complete.mutate(100);
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="quiz">
      <h2 id="quiz" className="text-lg font-semibold">Quiz</h2>
      {earned && !checked ? (
        <div className="mt-2 text-sm">
          <p>You earned this badge on {shortDate(earned.completedAt)}.</p>
          <button onClick={() => reset.mutate()} className="mt-2 rounded-md border border-line px-3 py-1 text-sm hover:bg-grid/50">
            Study it again (resets the badge)
          </button>
        </div>
      ) : (
        <>
          <ol className="mt-3 grid gap-5">
            {module.quiz.map((q, qi) => {
              const wrong = checked && answers[qi] !== q.answer;
              return (
                <li key={q.q}>
                  <fieldset>
                    <legend className="font-medium">{qi + 1}. {q.q}</legend>
                    <div className="mt-2 grid gap-1.5">
                      {q.options.map((o, oi) => (
                        <label key={o} className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                          answers[qi] === oi ? 'border-series bg-series/5' : 'border-line hover:bg-grid/40'}`}>
                          <input type="radio" name={`${module.id}-${qi}`} className="mt-0.5" checked={answers[qi] === oi} disabled={passed}
                            onChange={() => { setAnswers(answers.map((a, i) => (i === qi ? oi : a))); setChecked(false); }} />
                          {o}
                        </label>
                      ))}
                    </div>
                    {checked && (
                      <p className={`mt-1.5 text-sm ${wrong ? 'text-critical' : 'text-ink-2'}`}>
                        {wrong ? '✕ Not quite. ' : '✓ Right. '}{q.why}
                      </p>
                    )}
                  </fieldset>
                </li>
              );
            })}
          </ol>
          {passed ? (
            <p className="mt-4 rounded-md bg-series/10 px-3 py-2 font-medium" role="status">
              Badge earned: {module.badge}. {complete.isError ? 'It could not be saved, try again.' : ''}
            </p>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={check} disabled={!allAnswered} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-page disabled:opacity-50">
                Check answers
              </button>
              {checked && <span className="text-sm text-ink-2" role="status">{right} of {module.quiz.length} right. Review the explanation and try again.</span>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ModulePage({ module }: { module: LearningModule }) {
  const progress = useProgress();
  const earned = progress.data?.find((p) => p.moduleId === module.id);
  return (
    <article className="pb-10">
      <Link to="/learning" className="mt-6 inline-block text-sm text-ink-2 hover:text-ink">← All badges</Link>
      <header className="pt-3 pb-5">
        <p className="text-sm text-muted">{module.badge} · {module.minutes} min{earned ? ' · badge earned ✓' : ''}</p>
        <h1 className="mt-1 text-2xl font-semibold">{module.title}</h1>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {module.tech.map((t) => <li key={t} className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">{t}</li>)}
        </ul>
        <p className="mt-4 max-w-prose text-ink-2">{module.intro}</p>
      </header>

      <div className="grid max-w-prose gap-6">
        {module.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            {s.text.map((t) => <p key={t} className="mt-2 leading-relaxed">{t}</p>)}
            {s.points && (
              <ul className="mt-2 grid list-disc gap-1 pl-5">
                {s.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
          </section>
        ))}

        <section>
          <h2 className="text-lg font-semibold">Where it lives in your code</h2>
          <ul className="mt-2 grid gap-1.5">
            {module.inProject.map((f) => (
              <li key={f.path} className="text-sm">
                <a href={REPO + f.path} target="_blank" rel="noreferrer" className="font-mono text-xs text-series hover:underline">{f.path}</a>
                <span className="text-ink-2"> · {f.what}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Interview questions</h2>
          <p className="mt-1 text-sm text-ink-2">Answer out loud first, then open the suggested answer.</p>
          <div className="mt-2 grid gap-2">
            {module.interview.map((x) => (
              <details key={x.q} className="rounded-lg border border-line bg-surface px-3 py-2">
                <summary className="cursor-pointer font-medium">{x.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{x.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 max-w-prose">
        <Quiz key={earned ? 'earned' : 'open'} module={module} earned={earned} />
      </div>
    </article>
  );
}

export function LearningPage() {
  const id = usePath().split('/')[2];
  if (!id) return <Overview />;
  const module = MODULES.find((m) => m.id === id);
  return module ? (
    <ModulePage module={module} />
  ) : (
    <div className="py-10">
      <h1 className="text-xl font-semibold">Module not found</h1>
      <Link to="/learning" className="mt-2 inline-block text-sm text-series hover:underline">All badges</Link>
    </div>
  );
}
