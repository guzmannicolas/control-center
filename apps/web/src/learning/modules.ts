// Study modules about this project's own stack. Pass a module's quiz to earn its badge.
// Adding a technology to the project? Add its module here, so it shows up as knowledge debt until studied.

export interface LearningModule {
  id: string;
  badge: string;
  title: string;
  minutes: number;
  tech: string[];
  intro: string;
  sections: { heading: string; text: string[]; points?: string[] }[];
  inProject: { path: string; what: string }[];
  interview: { q: string; a: string }[];
  quiz: { q: string; options: string[]; answer: number; why: string }[];
}

export const REPO = 'https://github.com/guzmannicolas/control-center/blob/main/';

export const MODULES: LearningModule[] = [
  {
    id: 'architecture',
    badge: 'System design',
    title: 'How the Control Center fits together',
    minutes: 10,
    tech: ['Monolith', 'Worker', 'Postgres', 'Redis', 'Vercel', 'Cloudflare'],
    intro:
      'The big picture first: what runs where, and why it was split that way. If you can draw this on a whiteboard and justify each box, most system design questions about this project are covered.',
    sections: [
      {
        heading: 'The pieces',
        text: ['A request travels: browser → dashboard on Vercel → API on the VPS (through a Cloudflare tunnel) → Postgres. Meanwhile, a separate worker runs the checks on a schedule and writes results to the same database.'],
        points: [
          'Dashboard (React): only shows data. Static files on Vercel.',
          'API (Fastify): login, sessions, read endpoints. Answers people.',
          'Worker (BullMQ): runs checks in the background. Never answers people.',
          'Postgres: the source of truth (targets, monitors, results, incidents, users).',
          'Redis: the job schedules and queue, plus login attempt counters.',
        ],
      },
      {
        heading: 'Why one app split inside (a modular monolith)',
        text: [
          'Everything is one repository and one deploy, but split into clear parts: checkers, runner, routes, auth. Microservices would add network calls, separate deploys and distributed failures for a single developer, with no benefit.',
          'The one real split is web vs worker, because they have different jobs: the API must answer fast, the worker may be slow. If a check hangs, the API is unaffected, and you can run three workers without touching the API.',
        ],
      },
      {
        heading: 'Why it is not inside Directus',
        text: ['A monitor must not depend on what it monitors. If the CMS goes down, the Control Center has to keep working to tell you. So it has its own Postgres and Redis, separate from the CMS ones.'],
      },
      {
        heading: 'The plugin idea, everywhere',
        text: ['New things to watch are checkers: one file following one contract. New dashboard pages are sections: one entry in a list. The core never changes to grow. This is the strategy pattern.'],
      },
    ],
    inProject: [
      { path: 'README.md', what: 'The overview and data model' },
      { path: 'docker-compose.yml', what: 'Every process and how they connect' },
      { path: 'apps/api/src/checkers/index.ts', what: 'The checker registry (plugin pattern)' },
      { path: 'apps/web/src/sections.tsx', what: 'The section registry for the dashboard' },
    ],
    interview: [
      { q: 'Walk me through what happens when the dashboard loads.', a: 'The browser loads static files from Vercel. React asks the API "who am I?" with the session cookie. If the session is valid, it fetches the overview: the API reads targets and monitors from Postgres and returns each target with its worst status. TanStack Query refreshes it every 30 seconds.' },
      { q: 'Why a separate worker process?', a: 'Different jobs, different failure modes. Checks can be slow or hang; the API must stay fast. Separate processes isolate failures and let each scale on its own.' },
      { q: 'Why not microservices?', a: 'One developer, one VPS. Microservices add network calls, deploy coordination and distributed debugging. A modular monolith keeps clear boundaries without that cost, and pieces can be split out later if a real need appears.' },
      { q: 'How would you add a new kind of check?', a: 'Write one checker file that follows the Checker interface and register it. The scheduler, storage, incidents and dashboard already handle it.' },
    ],
    quiz: [
      { q: 'Why does the Control Center have its own Postgres instead of using the CMS one?', options: ['Postgres cannot hold two schemas', 'So it keeps working, and can report, when the CMS breaks', 'Prisma requires an empty database'], answer: 1, why: 'A monitor must not depend on the thing it monitors.' },
      { q: 'What is the main reason the worker is a separate process from the API?', options: ['Slow or hanging checks must not slow down answers to people', 'Node can only run one HTTP server per process', 'BullMQ cannot run inside Fastify'], answer: 0, why: 'Isolation: different jobs and different failure modes.' },
      { q: 'Adding a new kind of check requires…', options: ['A new table and a new API route', 'One checker file plus one line in the registry', 'A new microservice'], answer: 1, why: 'That is the plugin (strategy) pattern the project is built on.' },
    ],
  },

  {
    id: 'typescript-monorepo',
    badge: 'TypeScript',
    title: 'TypeScript monorepo and shared types',
    minutes: 8,
    tech: ['TypeScript', 'pnpm workspaces', 'Zod'],
    intro: 'One repository, three packages, one language. The point is that the API and the dashboard cannot disagree about the shape of the data without the compiler noticing.',
    sections: [
      {
        heading: 'The workspace',
        text: ['pnpm workspaces link packages inside one repo: apps/api, apps/web and packages/shared. Both apps import "@cc/shared" as if it were an npm package, but it is just a folder.'],
      },
      {
        heading: 'One definition, checked on both sides',
        text: [
          'Zod schemas describe data once and give you two things: runtime validation (reject bad input) and a TypeScript type (for the compiler). ImprovementInput validates the form in the browser and the request on the server.',
          'Response types like Overview or DomainView live in shared too. If the API renames a field, the dashboard stops compiling, instead of breaking silently in the browser.',
        ],
      },
      {
        heading: 'Choosing versions on purpose',
        text: ['TypeScript 7 existed, but the project uses 6.0.3 because typescript-eslint only supports up to 6.x. In a team you pick the newest version your whole toolchain supports, not the newest number.'],
      },
    ],
    inProject: [
      { path: 'pnpm-workspace.yaml', what: 'Which folders are packages' },
      { path: 'packages/shared/src/index.ts', what: 'Schemas and types used by API and dashboard' },
      { path: 'tsconfig.base.json', what: 'Strict compiler settings shared by all packages' },
    ],
    interview: [
      { q: 'What does "end-to-end type safety" mean here?', a: 'The same types describe the data in the database layer, the API responses and the React components. A breaking change shows up as a compile error, not a production bug.' },
      { q: 'Why validate at runtime if you already have TypeScript?', a: 'Types disappear at runtime. Data from outside (a request body, an RDAP response, environment variables) can be anything, so it is validated with Zod at the boundary.' },
      { q: 'What does strict mode plus noUncheckedIndexedAccess give you?', a: 'Strict catches null/undefined mistakes. noUncheckedIndexedAccess makes array[i] possibly undefined, forcing you to handle "not found" instead of assuming.' },
    ],
    quiz: [
      { q: 'Why validate request bodies with Zod when the code is already TypeScript?', options: ['TypeScript types do not exist at runtime', 'Zod makes the code faster', 'Fastify requires Zod'], answer: 0, why: 'Types are erased when compiled; outside data must be checked while running.' },
      { q: 'What happens if the API renames a field used by the dashboard?', options: ['The dashboard shows undefined in production', 'The dashboard fails to compile', 'Nothing, JSON is flexible'], answer: 1, why: 'Both import the same type from @cc/shared.' },
      { q: 'Why is the project on TypeScript 6 and not 7?', options: ['7 is slower', 'The linter (typescript-eslint) does not support 7 yet', '7 does not support React'], answer: 1, why: 'Pick the newest version the whole toolchain supports.' },
    ],
  },

  {
    id: 'fastify',
    badge: 'Fastify',
    title: 'The API with Fastify',
    minutes: 8,
    tech: ['Node.js', 'Fastify', 'Plugins', 'Hooks'],
    intro: 'The HTTP layer: how routes, hooks and plugins are organised, and how the app is built so it can be tested without a network or a real server.',
    sections: [
      {
        heading: 'buildApp: dependencies are passed in',
        text: ['buildApp receives Prisma, the health probes and settings instead of importing them. Tests can pass fakes and call app.inject() to send a request in memory, with no port. This is dependency injection without a framework.'],
      },
      {
        heading: 'Hooks and plugins',
        text: ['Hooks run at points of every request: onRequest (CSRF Origin check), preHandler (who is logged in), onSend (Cache-Control: no-store). Plugins group routes; a hook added inside a plugin applies only to that plugin, which is how every /api route requires login without repeating it.'],
      },
      {
        heading: 'Health checks that never hang',
        text: ['/health asks Postgres and Redis and answers 200 or 503 naming the broken part. Each probe has a 2-second limit, because a health check that hangs is worse than one that fails: Docker cannot tell slow from dead. A test found this bug when Redis was stopped on purpose.'],
      },
    ],
    inProject: [
      { path: 'apps/api/src/app.ts', what: 'buildApp, hooks, CORS, health' },
      { path: 'apps/api/src/routes/api.ts', what: 'The protected /api routes' },
      { path: 'apps/api/src/server.ts', what: 'Startup and graceful shutdown' },
    ],
    interview: [
      { q: 'How do you test an API without starting a server?', a: 'Build the app with injected dependencies and use inject() to send requests in memory. Fast, no ports, and fakes can simulate a dead database.' },
      { q: 'What is graceful shutdown?', a: 'On SIGTERM (what Docker sends on stop) the server stops accepting new requests, finishes the ones in flight, then closes database and Redis connections before exiting.' },
      { q: 'Why does /health have a timeout per dependency?', a: 'Because a client like ioredis may wait forever while reconnecting. Without a limit the endpoint hangs, and orchestrators cannot distinguish slow from down.' },
    ],
    quiz: [
      { q: 'What does app.inject() do?', options: ['Sends a request to the app in memory, without a network', 'Injects environment variables', 'Adds a route at runtime'], answer: 0, why: 'It is how the tests call the API without a port.' },
      { q: 'A hook registered inside the /api plugin applies to…', options: ['Every route of the whole app', 'Only the routes inside that plugin', 'Only GET requests'], answer: 1, why: 'Fastify plugins are encapsulated.' },
      { q: 'Why does /health answer 503 within 2 s when Redis is down?', options: ['Each probe has its own time limit', 'Redis answers fast when it is down', 'Docker restarts Redis'], answer: 0, why: 'Without the limit the request would hang.' },
    ],
  },

  {
    id: 'postgres-prisma',
    badge: 'PostgreSQL',
    title: 'PostgreSQL and Prisma',
    minutes: 12,
    tech: ['PostgreSQL', 'Prisma', 'Migrations', 'Indexes', 'Transactions'],
    intro: 'The data model, how it changes safely over time, and the database features that keep it correct and fast.',
    sections: [
      {
        heading: 'The model',
        text: ['Target (something I own) → Monitor (one check on one target, with an interval) → Result (each time it ran). Incident records a problem with a start and an end, so one outage is one alert, not one per check.'],
        points: [
          'JSON columns (config, settings, metrics, details) for data whose shape depends on a type.',
          'Normal columns for what you filter and join on (type, status, enabled).',
          'lastStatus is copied onto the monitor so the dashboard never scans the results table.',
        ],
      },
      {
        heading: 'Migrations',
        text: ['Every schema change is a SQL file in prisma/migrations, committed to Git and applied by a one-shot migrate container before the API starts. When migrate dev needed a human at the keyboard, the SQL was generated with migrate diff instead, which is how CI pipelines do it.'],
      },
      {
        heading: 'Letting the database enforce rules',
        text: ['"At most one open incident per monitor" is a partial unique index: CREATE UNIQUE INDEX … WHERE resolved_at IS NULL. Prisma cannot express it, so it was added to the migration by hand. A test proves the database refuses a second open incident.'],
      },
      {
        heading: 'Transactions and indexes',
        text: ['Recording a result, updating the monitor and opening or closing an incident happen in one transaction: all or nothing. The results table grows fast (about 5,000 rows a day), so it has an index on (monitor_id, checked_at DESC) for "latest results of this monitor".'],
      },
    ],
    inProject: [
      { path: 'apps/api/prisma/schema.prisma', what: 'The whole data model' },
      { path: 'apps/api/prisma/migrations', what: 'Every change, in order' },
      { path: 'apps/api/src/runner.ts', what: 'recordOutcome: the transaction' },
    ],
    interview: [
      { q: 'When do you use a JSON column instead of normal columns?', a: 'When the shape depends on a type and you rarely filter on it, like each checker\'s settings. Anything you search or join on stays a real column.' },
      { q: 'How do you handle a table that grows forever?', a: 'Index for the queries you run, keep raw data for a window (for example 30 days), aggregate older data into summaries, and consider partitioning by time.' },
      { q: 'What is a partial index and when is it useful?', a: 'An index over only the rows matching a condition. Here it makes "one open incident per monitor" a rule the database enforces, even under concurrent writes.' },
      { q: 'Why run migrations as a separate step?', a: 'The schema changes once, in a controlled place, before any app instance starts. Apps never alter the schema on their own while serving traffic.' },
    ],
    quiz: [
      { q: 'How does the project guarantee only one open incident per monitor?', options: ['A check in the JavaScript code', 'A partial unique index in Postgres', 'A Redis lock'], answer: 1, why: 'The database enforces it, even if two writes race.' },
      { q: 'Why is lastStatus stored on the monitor as well as in results?', options: ['So the dashboard does not scan the results table', 'Prisma requires it', 'For backups'], answer: 0, why: 'A deliberate copy (denormalisation) for fast reads.' },
      { q: 'Saving a result and opening an incident in one transaction means…', options: ['They run faster', 'Either both are saved or neither is', 'They are saved in Redis'], answer: 1, why: 'Atomicity.' },
    ],
  },

  {
    id: 'redis-bullmq',
    badge: 'Redis & queues',
    title: 'Redis and background jobs with BullMQ',
    minutes: 8,
    tech: ['Redis', 'BullMQ', 'Job schedulers'],
    intro: 'How checks run on time without a cron per check, and why the scheduling is designed to never lose or reset a timer.',
    sections: [
      {
        heading: 'Job schedulers',
        text: ['Each monitor has a BullMQ job scheduler stored in Redis: "run monitor X every N seconds". Because it lives in Redis, it survives restarts. A worker takes due jobs and runs up to 5 at a time.'],
      },
      {
        heading: 'Postgres says what, Redis holds when',
        text: ['Every minute the worker syncs: monitors in Postgres → schedulers in Redis (add, change, remove). Unchanged schedulers are left alone on purpose: re-creating one would restart its clock, and a 24-hour check would never fire.'],
      },
      {
        heading: 'Redis settings that matter',
        text: ['BullMQ requires maxRetriesPerRequest: null, so Redis commands wait for a reconnect instead of failing mid-job. That same setting made /health hang until it got its own timeout. The queue Redis uses an append-only file, so every write survives a restart.'],
      },
    ],
    inProject: [
      { path: 'apps/api/src/schedules.ts', what: 'syncSchedules' },
      { path: 'apps/api/src/worker.ts', what: 'The worker process' },
      { path: 'apps/api/src/infra.ts', what: 'Redis connection settings' },
    ],
    interview: [
      { q: 'How do you run background work in Node?', a: 'With a queue in Redis (BullMQ): the web process or a scheduler adds jobs, separate worker processes take them, with retries, concurrency limits and persistence.' },
      { q: 'Why does the sync skip unchanged schedulers?', a: 'Re-creating a scheduler resets its next run. Doing that every minute would mean a daily check never runs.' },
      { q: 'What happens to scheduled checks if the worker restarts?', a: 'Nothing is lost: schedules live in Redis. The worker reconnects and keeps taking due jobs.' },
    ],
    quiz: [
      { q: 'Where do the check schedules live?', options: ['In the worker\'s memory', 'In Redis, as BullMQ job schedulers', 'In a crontab'], answer: 1, why: 'So they survive restarts.' },
      { q: 'Why not re-create every scheduler on each sync?', options: ['It would reset their clocks, so long intervals never fire', 'Redis would run out of memory', 'It is slower'], answer: 0, why: 'A real bug avoided by design.' },
      { q: 'What does maxRetriesPerRequest: null do?', options: ['Disables Redis', 'Makes commands wait for reconnection instead of failing', 'Limits jobs to one retry'], answer: 1, why: 'Required by BullMQ, and the reason health probes need a timeout.' },
    ],
  },

  {
    id: 'auth-security',
    badge: 'Web security',
    title: 'Authentication and web security',
    minutes: 15,
    tech: ['scrypt', 'Sessions', 'Cookies', 'CORS', 'CSRF', 'Rate limiting', 'Least privilege'],
    intro: 'The most common interview topic for full stack. Every choice here has a reason you should be able to say in one sentence.',
    sections: [
      {
        heading: 'Passwords',
        text: ['Stored as scrypt hashes with a random salt, never in plain text. scrypt is deliberately slow and memory-hungry (64 MB per hash), so guessing offline is expensive. Comparison is constant-time. An unknown email costs the same time as a wrong password, so timing cannot reveal which accounts exist.'],
      },
      {
        heading: 'Sessions instead of JWT',
        text: [
          'Login creates a random 256-bit token in a cookie. The database stores only its SHA-256, so a database leak gives away no sessions. Logout deletes it: sessions can be revoked instantly, which is harder with JWTs.',
          'The cookie is HttpOnly (page JavaScript cannot read it, so an XSS bug cannot steal it), Secure (HTTPS only) and SameSite=Lax (not sent on requests started by other sites).',
        ],
      },
      {
        heading: 'CORS and CSRF',
        text: [
          'CORS is enforced by the browser: the API says "only control.nicoguzmandev.com may read my answers" and browsers block other pages from reading them.',
          'CSRF is a different attack: another site making your browser send a request with your cookie. Defence: every request that changes something must carry the dashboard\'s exact Origin header, which other sites cannot fake.',
        ],
      },
      {
        heading: 'Least privilege and secrets',
        text: ['Brute force: 5 attempts per 15 minutes per IP, counted in Redis. Database monitoring uses a pg_monitor user that reads statistics but cannot read rows or write, tested both ways. Secrets live in .env, never in Git; a scan runs before every push and GitHub push protection blocks tokens.'],
      },
    ],
    inProject: [
      { path: 'apps/api/src/auth/password.ts', what: 'scrypt hashing' },
      { path: 'apps/api/src/auth/sessions.ts', what: 'Session tokens' },
      { path: 'apps/api/src/auth/routes.ts', what: 'Login, cookie flags, rate limit' },
      { path: 'apps/api/src/app.ts', what: 'CORS and the CSRF Origin check' },
    ],
    interview: [
      { q: 'How do you store passwords?', a: 'Never in plain text: a slow, salted hash (scrypt, bcrypt or Argon2), compared in constant time.' },
      { q: 'Cookie sessions or JWT?', a: 'For a web app on one domain, cookie sessions: revocable instantly, nothing sensitive readable by JavaScript. JWTs suit stateless APIs between services, but revoking them needs extra machinery.' },
      { q: 'What is the difference between CORS and CSRF?', a: 'CORS controls which sites may read responses (the browser enforces it). CSRF is a forged request using your cookie; you stop it with SameSite cookies and Origin or token checks on the server.' },
      { q: 'Why store a hash of the session token?', a: 'If the database leaks, the attacker gets hashes, not usable tokens. The token is fully random, so a fast hash is enough; passwords need slow hashes because people choose guessable ones.' },
    ],
    quiz: [
      { q: 'What does HttpOnly on a cookie protect against?', options: ['Page JavaScript (XSS) reading the session', 'The cookie being sent over HTTP', 'Other sites reading the API'], answer: 0, why: 'HttpOnly hides the cookie from document.cookie.' },
      { q: 'Who enforces CORS?', options: ['The API server', 'The browser', 'Cloudflare'], answer: 1, why: 'The server only declares the rule; the browser blocks the read.' },
      { q: 'Why do passwords need a slow hash but session tokens only SHA-256?', options: ['Tokens are 256 random bits; passwords are guessable', 'SHA-256 is slower', 'Tokens expire'], answer: 0, why: 'Guessing a random 256-bit value is impossible; guessing human passwords is not.' },
    ],
  },

  {
    id: 'docker',
    badge: 'Docker',
    title: 'Docker and Docker Compose',
    minutes: 12,
    tech: ['Docker', 'Compose', 'Multi-stage builds', 'Healthchecks', 'Networks'],
    intro: 'How everything runs 24/7 on the VPS, survives crashes and reboots, and why the production image went from 745 MB to 313 MB.',
    sections: [
      {
        heading: 'The services',
        text: ['docker compose up -d starts postgres and redis, then migrate (applies migrations once and exits), then api and worker, which start only if migrate succeeded. Restart policy unless-stopped brings them back after a crash or reboot, but respects a manual stop.'],
      },
      {
        heading: 'Multi-stage build',
        text: ['The build stage has every tool (TypeScript, Prisma CLI, esbuild). The runtime stage copies only the bundled JavaScript and production dependencies, runs as a non-root user and contains no source or .env.'],
        points: [
          '745 MB at first: the Prisma CLI, Studio, React and TypeScript were leaking into production through a peer dependency.',
          'A pnpm hook removed that peer, and the build keeps only the PostgreSQL query engine.',
          'Result: 313 MB, node_modules from 386 MB to 60 MB. Measure first, then optimise.',
        ],
      },
      {
        heading: 'Operations details',
        text: ['.dockerignore keeps .env out of the image. Logs rotate (3 × 10 MB) so they cannot fill the disk. Memory is capped at 256 MB per process. On this VPS a second compose file joins the worker to the CMS network; on two networks, names like "postgres" become ambiguous, so it uses exact container names.'],
      },
    ],
    inProject: [
      { path: 'docker-compose.yml', what: 'Services, healthchecks, restart, logs' },
      { path: 'docker/app.Dockerfile', what: 'The multi-stage build' },
      { path: 'docker-compose.vps.yml', what: 'Wiring only this server needs' },
      { path: '.pnpmfile.cjs', what: 'The hook that shrank the image' },
    ],
    interview: [
      { q: 'Why multi-stage builds?', a: 'Build with every tool, ship only what runs: smaller images, faster deploys, less attack surface.' },
      { q: 'How did you reduce the image size?', a: 'I measured what was inside, found the Prisma CLI and React leaking in through a peer dependency, fixed it with a pnpm hook, and dropped database engines we do not use: 745 MB to 313 MB.' },
      { q: 'restart: always vs unless-stopped?', a: 'Both restart after crashes and reboots; unless-stopped stays down if you stopped it yourself. Note docker kill counts as a manual stop.' },
      { q: 'Why is migrate a separate one-shot service?', a: 'Migrations run once, before the app, and the app only starts if they succeed.' },
    ],
    quiz: [
      { q: 'What does .dockerignore prevent here?', options: ['Copying .env and node_modules into the image', 'Running as root', 'Rotating logs'], answer: 0, why: 'Without it, COPY . . would put secrets in the image.' },
      { q: 'What mostly made the first image 745 MB?', options: ['Logs', 'The Prisma CLI and its dependencies leaking into production', 'The React dashboard'], answer: 1, why: 'Found by measuring node_modules inside the image.' },
      { q: 'The api service starts…', options: ['In parallel with migrate', 'Only after migrate finished successfully', 'Before postgres'], answer: 1, why: 'depends_on with service_completed_successfully.' },
    ],
  },

  {
    id: 'networking',
    badge: 'Networking',
    title: 'DNS, TLS, Cloudflare and the LaLiga incident',
    minutes: 12,
    tech: ['DNS', 'TLS', 'Cloudflare Tunnel', 'Cloudflare Access', 'RDAP'],
    intro: 'How a name like control.nicoguzmandev.com reaches the right server, how traffic is protected, and a real incident that is a great interview story.',
    sections: [
      {
        heading: 'DNS records',
        text: ['A CNAME points one name at another. control.nicoguzmandev.com → Vercel (DNS only). control-api.nicoguzmandev.com → the Cloudflare tunnel (proxied). "Proxied" means traffic goes through Cloudflare; "DNS only" means Cloudflare only answers the lookup.'],
      },
      {
        heading: 'Tunnel and Access',
        text: ['cloudflared runs on the VPS and opens an outgoing connection to Cloudflare, so no inbound port is opened: port 4100 is closed from outside. The VPN and SSH panels add Cloudflare Access (email PIN) in front. The API does not, because it has its own login.'],
      },
      {
        heading: 'TLS and domains',
        text: ['Certificates are issued automatically (Let\'s Encrypt via Vercel, Caddy and Cloudflare) and renewed about 30 days before expiry, so the checker warns at 21 days: below that, renewal is failing. Domain facts come from RDAP, the JSON successor of WHOIS.'],
      },
      {
        heading: 'The LaLiga incident',
        text: ['The dashboard hung for the owner in Spain but worked everywhere else. Logs showed his requests never reached the server. His connection was Spanish, and the API resolved to Cloudflare IPs that Spanish ISPs block during LaLiga matches under a court order. Proxying through Vercel then hit Cloudflare\'s bot challenge, so it was rolled back and the limitation documented. Lesson: reproduce, read the logs, follow the request hop by hop.'],
      },
    ],
    inProject: [
      { path: 'apps/api/src/checkers/ssl-expiry.ts', what: 'Reading certificates with node:tls' },
      { path: 'apps/api/src/checkers/domain-expiry.ts', what: 'Parsing RDAP' },
      { path: 'README.md', what: 'The documented Spain limitation' },
    ],
    interview: [
      { q: 'How do you expose a service without opening ports?', a: 'With an outbound tunnel (Cloudflare Tunnel): the server connects out to the edge, and the edge forwards requests through that connection.' },
      { q: 'Tell me about a hard production bug.', a: 'The LaLiga incident: requests from Spain hung, never reaching the server. I compared logs, checked the user\'s country and the resolved IPs, matched it to court-ordered ISP blocks of Cloudflare ranges, tried routing through Vercel, saw Cloudflare challenge it, rolled back and documented the limitation and two fixes.' },
      { q: 'Why warn about certificates at 21 days?', a: 'Auto-renewal happens around 30 days before expiry. If one is still under 21 days, renewal has failed and there is time to fix it.' },
    ],
    quiz: [
      { q: 'How is the API reachable while port 4100 is closed?', options: ['Through an outbound Cloudflare tunnel', 'Through port forwarding', 'It is not reachable'], answer: 0, why: 'cloudflared connects out; nothing listens publicly.' },
      { q: 'What caused the dashboard to hang in Spain?', options: ['A CORS bug', 'ISPs blocking Cloudflare IPs during football matches', 'An expired certificate'], answer: 1, why: 'Requests never reached the server.' },
      { q: 'What is RDAP?', options: ['A DNS record type', 'The structured (JSON) successor of WHOIS', 'A Cloudflare product'], answer: 1, why: 'The domain checker reads expiry, registrar and lock status from it.' },
    ],
  },

  {
    id: 'react-dashboard',
    badge: 'React',
    title: 'The React dashboard',
    minutes: 10,
    tech: ['React', 'TanStack Query', 'Vite', 'Tailwind', 'Accessibility'],
    intro: 'How the frontend fetches, caches and shows data, and how it is organised to grow one section at a time.',
    sections: [
      {
        heading: 'Server state with TanStack Query',
        text: ['Every API call is a query with a key ("overview", "domains"…). TanStack Query caches it, refetches on an interval and when the window regains focus, retries network errors and shares results between components. A 401 anywhere resets "who am I", which shows the login screen.'],
      },
      {
        heading: 'Sections and routing',
        text: ['sections.tsx lists every section (path, label, icon, page). The menu, the URLs and the pages come from that list. A 30-line router uses the History API, so URLs can be bookmarked and back/forward work.'],
      },
      {
        heading: 'Never wait forever',
        text: ['Every request has a 15-second limit. A hung connection becomes an error with a Retry button instead of an endless "Loading…". Before this, a blocked network left the page spinning with no way out.'],
      },
      {
        heading: 'Accessible by default',
        text: ['Status is never shown by color alone: every status has an icon and a word. The chart can be read with the arrow keys and has a table view. Dark mode uses its own color values instead of an automatic inversion.'],
      },
    ],
    inProject: [
      { path: 'apps/web/src/api.ts', what: 'Requests, timeout, errors' },
      { path: 'apps/web/src/main.tsx', what: 'Query client and the global 401 rule' },
      { path: 'apps/web/src/sections.tsx', what: 'The section registry' },
      { path: 'apps/web/src/components/ResponseChart.tsx', what: 'The SVG chart' },
    ],
    interview: [
      { q: 'How do you manage server data in React?', a: 'With a server-state library (TanStack Query): caching by key, background refetch, retries, loading and error states, instead of hand-written useEffect and useState.' },
      { q: 'How do you handle an expired session in the UI?', a: 'A global rule: any 401 resets the current-user query, which re-renders the login screen. Pages do not handle it one by one.' },
      { q: 'What did you do for accessibility?', a: 'Status has icon and text, not only color; keyboard support on the chart; a table alternative; semantic headings and aria labels.' },
    ],
    quiz: [
      { q: 'What happens anywhere in the app when the API answers 401?', options: ['Nothing', 'The "who am I" query is reset and the login screen shows', 'The page reloads'], answer: 1, why: 'One global rule in the query cache.' },
      { q: 'Why does every request have a 15-second limit?', options: ['To reduce server load', 'So a hung connection shows an error instead of loading forever', 'Vercel requires it'], answer: 1, why: 'A real bug fixed in production.' },
      { q: 'Adding a new dashboard section needs…', options: ['A new router library', 'Its page plus one entry in sections.tsx', 'A new Vercel project'], answer: 1, why: 'The registry drives menu, URLs and pages.' },
    ],
  },

  {
    id: 'testing',
    badge: 'Testing',
    title: 'Testing strategy',
    minutes: 10,
    tech: ['Vitest', 'Integration tests', 'Playwright'],
    intro: 'Three levels of tests, each catching different bugs. Several real bugs in this project were found by tests before reaching you.',
    sections: [
      {
        heading: 'Unit tests: pure logic',
        text: ['decideIncident, parseRdap, parseBackupLog, classify functions: no network, no database, milliseconds. Logic is written as pure functions precisely so it is easy to test.'],
      },
      {
        heading: 'Integration tests: a real database',
        text: ['The incident lifecycle, login and every API route run against a real Postgres (control_test), created and migrated automatically. Files run one after another because they share that database. No mocks of the database: mocks can pass while the real query fails.'],
      },
      {
        heading: 'Browser tests: Playwright',
        text: ['A real Chrome and Firefox log in, open charts, reload and sign out. These caught the logout bug (the screen stayed on the dashboard) and verified the live site after each deploy.'],
      },
      {
        heading: 'Bugs tests caught',
        points: [
          '/health hung when Redis was down (it now times out).',
          'The results endpoint took the oldest 5,000 points instead of the newest.',
          'Signing out did not show the login screen.',
          'Error messages for refused connections were unhelpful.',
        ],
        text: [],
      },
    ],
    inProject: [
      { path: 'apps/api/src/runner.test.ts', what: 'Unit tests of the runner' },
      { path: 'apps/api/src/auth/auth.int.test.ts', what: 'Login flow against real Postgres' },
      { path: 'apps/api/test/global-setup.ts', what: 'Creates and migrates the test database' },
    ],
    interview: [
      { q: 'Unit vs integration vs end-to-end?', a: 'Unit tests check one piece of logic in isolation, fast. Integration tests check pieces together, here the API with a real database. End-to-end tests drive the real app in a browser like a user.' },
      { q: 'Do you mock the database?', a: 'Not for integration tests: a real test database catches query and migration problems that mocks hide. Fakes are fine for unit tests of logic that only needs an interface.' },
      { q: 'Give an example of a bug a test caught.', a: 'Stopping Redis on purpose showed /health hung forever instead of answering 503. The fix was a per-probe timeout, plus a test for the "never answers" case.' },
    ],
    quiz: [
      { q: 'Why do integration test files run one after another?', options: ['They share one test database and must not clear each other\'s data', 'Vitest cannot run in parallel', 'To save memory'], answer: 0, why: 'Prevents flaky tests.' },
      { q: 'Why test against a real Postgres instead of mocking it?', options: ['Mocks can pass while the real query or migration fails', 'It is faster', 'Prisma cannot be mocked'], answer: 0, why: 'Integration tests exist to catch exactly that.' },
      { q: 'Which bug did a browser test catch?', options: ['Signing out left the dashboard on screen', 'A wrong certificate date', 'A slow query'], answer: 0, why: 'Only visible when driving the real UI.' },
    ],
  },

  {
    id: 'monitoring',
    badge: 'Observability',
    title: 'Monitoring, incidents and checkers',
    minutes: 10,
    tech: ['Checkers', 'Incidents', 'Timeouts', 'Structured logs'],
    intro: 'The domain knowledge of the project itself: how a check becomes a result, when it becomes an incident, and how failures are kept from spreading.',
    sections: [
      {
        heading: 'Four statuses, on purpose',
        text: ['ok, warn (works but needs attention), fail (broken) and error (the check itself could not run). Separating "it is broken" from "I could not look" avoids false alarms: error never opens or closes an incident.'],
      },
      {
        heading: 'The defensive runner',
        text: ['executeCheck wraps every checker: unknown checker, wrong target type, invalid settings, a throw, a hang (30-second limit) or garbage output all become an error result instead of crashing the worker.'],
      },
      {
        heading: 'Incidents',
        text: ['One incident per problem: opened on the first warn or fail, updated while it lasts, resolved on the next ok. That means one alert when it breaks and one when it recovers, and downtime can be measured.'],
      },
      {
        heading: 'What it watches today',
        points: [
          'Uptime and response time of sites and panels; the VPN panel must keep answering 302 to the login page.',
          'Certificates, domain registration (registrar, DNSSEC, transfer lock).',
          'Databases with statistics-only users, and the age and warnings of the nightly backup.',
        ],
        text: [],
      },
    ],
    inProject: [
      { path: 'apps/api/src/checkers/define.ts', what: 'The checker contract' },
      { path: 'apps/api/src/runner.ts', what: 'executeCheck and decideIncident' },
      { path: 'apps/api/src/checkers/backup-age.ts', what: 'Reading the backup log' },
    ],
    interview: [
      { q: 'How do you avoid alert fatigue?', a: 'Incidents instead of per-check alerts, warnings with thresholds before failures, and a separate status for "could not check" so monitoring hiccups do not page you.' },
      { q: 'How do you stop one bad plugin from breaking the system?', a: 'Wrap it: validate its settings, give it a deadline, catch whatever it throws and validate what it returns. Its failure becomes data, not a crash.' },
      { q: 'What did the monitoring find on day one?', a: 'That the CMS backups to Google Drive will stop during 2026 (a retired rclone client id) and that the monitor\'s own database had no backup.' },
    ],
    quiz: [
      { q: 'What does the "error" status mean?', options: ['The site is down', 'The check itself could not run', 'A warning'], answer: 1, why: 'And it never opens or resolves incidents.' },
      { q: 'A checker hangs forever. What happens?', options: ['The worker freezes', 'After 30 s it becomes an error result', 'The API restarts'], answer: 1, why: 'The runner gives every check a deadline.' },
      { q: 'A site fails for 15 minutes, checked every 5. How many incidents?', options: ['One', 'Three', 'None'], answer: 0, why: 'An incident has a start and an end.' },
    ],
  },

  {
    id: 'deploy-ops',
    badge: 'DevOps',
    title: 'Deploying and operating',
    minutes: 8,
    tech: ['Vercel', 'Git', 'Environment variables', 'Secrets', 'Rollback'],
    intro: 'How code gets from your editor to production, how secrets are kept out of the way, and what to do when a deploy breaks things.',
    sections: [
      {
        heading: 'Two deploy paths',
        text: ['The dashboard deploys itself: every push to main makes Vercel build apps/web. The API and worker deploy with docker compose up -d --build on the VPS, which runs migrations first. VITE_ variables are baked into the dashboard at build time, so changing one needs a rebuild.'],
      },
      {
        heading: 'Secrets',
        text: ['Real values live only in .env on the server; .env.example has placeholders. Before every push a secret scanner (gitleaks) checks the staged changes, and GitHub push protection blocks known token formats. A leaked key must be revoked: deleting it from Git is not enough, because history and clones keep it.'],
      },
      {
        heading: 'When a deploy breaks production',
        text: ['Routing the API through Vercel returned 403 for everyone (Cloudflare challenged Vercel). The first move was restoring service by redeploying the previous behaviour, then investigating, then cleaning up and documenting. Restore first, debug second.'],
      },
    ],
    inProject: [
      { path: '.env.example', what: 'Every setting, with fake values' },
      { path: 'apps/web/vercel.json', what: 'SPA routing and security headers' },
      { path: 'README.md', what: 'Production and development commands' },
    ],
    interview: [
      { q: 'How do you manage secrets?', a: 'Environment variables on the server, never in Git; an example file with fake values; scanning before push; push protection; revoke anything that leaks.' },
      { q: 'A deploy breaks production. What do you do?', a: 'Restore service first (roll back or redeploy the last good version), then investigate calmly, fix, and write down what happened.' },
      { q: 'Why does changing VITE_API_URL need a new build?', a: 'Vite replaces import.meta.env values when it builds, so the value is inside the JavaScript files.' },
    ],
    quiz: [
      { q: 'A key was committed by mistake. Enough to delete it in a new commit?', options: ['Yes', 'No: revoke the key, history still has it', 'Only if the repo is private'], answer: 1, why: 'Anyone with a clone or the history can still read it.' },
      { q: 'Production broke after a deploy. First step?', options: ['Find the root cause', 'Restore service, then investigate', 'Write a postmortem'], answer: 1, why: 'Users first.' },
      { q: 'When are VITE_ variables applied?', options: ['At build time', 'On every request', 'When the user logs in'], answer: 0, why: 'They are compiled into the bundle.' },
    ],
  },
];
