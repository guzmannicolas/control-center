# Control Center — Central Knowledge Base & Neural Hub

Welcome to the canonical knowledge repository for the Nico Guzman Dev Control Center ecosystem. This repository serves as the single source of truth for AI agents (Antigravity, Cursor, Claude Code, Roo Code) and human operators.

## Global Directives for AI Agents

1. **Mandatory English in Code and UI**:
   - All user-facing UI labels, placeholders, titles, status badges, and error messages MUST be in English.
   - All code symbols, comments, database models, and git commit messages MUST be in English.
   - User chat replies MUST be in Spanish when requested by the user.

2. **Strict No-Emoji Policy**:
   - Do NOT use emojis anywhere: no emojis in UI components, no emojis in code, no emojis in git commits, no emojis in assistant responses.
   - Use clean SVG icons, CSS styling, or standard punctuation instead.

3. **Production Infrastructure Awareness**:
   - VPS: Contabo Germany (`173.212.224.70`).
   - SSH Port: `2222`. User: `adminnico`.
   - Reverse Proxy: Caddy (`cms-caddy-1`) handling TLS.
   - Production API: Container `control-center-api-1` running image `control-center-app` on port 4100.
   - Production Web: Hosted on Vercel at `control.nicoguzmandev.com`.

4. **Workflow Protocol**:
   - Always read `knowledge/index.md` and the relevant domain doc before planning or modifying code.
   - Test builds locally (`pnpm run build` in `apps/api` and `apps/web`) before pushing.
   - Deploy backend changes to the VPS container via `scp` and `docker restart`.

## System Navigation Map

| Document | Purpose |
| :--- | :--- |
| [`knowledge/architecture.md`](./architecture.md) | Contabo VPS topology, Docker containers, internal networks, volume mapping. |
| [`knowledge/database-schema.md`](./database-schema.md) | Prisma schema, PostgreSQL tables, Lead states, indexes, and relations. |
| [`knowledge/skills/maps-scraper.md`](./skills/maps-scraper.md) | Technical specs of the Google Maps live feed extractor and phone normalizer. |
| [`knowledge/skills/whatsapp-outreach.md`](./skills/whatsapp-outreach.md) | Template engine, variable interpolation, anti-ban pacing, and outreach queue. |
| [`knowledge/skills/gemini-orchestrator.md`](./skills/gemini-orchestrator.md) | Multi-model pool fallback, temperature control, session persistence, voice dictation. |
| [`knowledge/playbooks/deployment.md`](./playbooks/deployment.md) | Standard operating procedure for building and deploying web and API components. |
| [`knowledge/playbooks/outreach.md`](./playbooks/outreach.md) | Commercial playbook for pitching Argentine businesses with live Vercel demos. |
| [`knowledge/playbooks/disaster-recovery.md`](./playbooks/disaster-recovery.md) | Emergency recovery manual for PostgreSQL dumps and media volumes. |
