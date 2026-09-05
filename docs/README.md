# Documentation

> Last verified: 2026-09-05.

Central repository for all Detour documentation. If you're new, read in this order:
[project/PROJECT-OVERVIEW.md](project/PROJECT-OVERVIEW.md) → [technical/RUNBOOK.md](technical/RUNBOOK.md) → [project/NEXT_TASKS.md](project/NEXT_TASKS.md).

## Folder Structure

### project/ — product state & roadmap
- [PROJECT-OVERVIEW.md](project/PROJECT-OVERVIEW.md) — what the product is, what works, where things stand today
- [NEXT_TASKS.md](project/NEXT_TASKS.md) — current prioritized roadmap (Now / Next / Blocked-external)
- [DEFERRED.md](project/DEFERRED.md) — built-but-inactive features and the exact steps to enable them
- [APP_REVIEW.md](project/APP_REVIEW.md) — *historical* (June 2026) code/lifecycle review; see banner
- [RELEASE_AUDIT_2026-07-06.md](project/RELEASE_AUDIT_2026-07-06.md) — *historical* release audit; several findings since fixed
- [SMOKE_TEST_RESULTS.md](project/SMOKE_TEST_RESULTS.md) — *historical* (April 2026) first end-to-end smoke test

### technical/ — architecture & operations
- [README.md](technical/README.md) — technical docs index
- [project-structure.md](technical/project-structure.md) — monorepo layout & conventions
- [system-architecture.md](technical/system-architecture.md) — components, data flow, security model
- [RUNBOOK.md](technical/RUNBOOK.md) — run every surface locally; test accounts
- [TESTING.md](technical/TESTING.md) — automated suites + manual smoke checklists
- [ADR-001-unified-codebase.md](technical/ADR-001-unified-codebase.md) — why Expo Universal
- [ADR-002-monorepo-workspaces.md](technical/ADR-002-monorepo-workspaces.md) — why a workspaces monorepo
- [ADR-003-admin-control-plane-growth-publishing.md](technical/ADR-003-admin-control-plane-growth-publishing.md) — Admin 2.0 charter: secure control plane, growth reporting, structured publishing
- [ADMIN2_PROVIDER_SETUP_RUNBOOK.md](technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md) — the 10 remaining Admin 2.0 config steps
- [DEPENDENCY_SECURITY.md](technical/DEPENDENCY_SECURITY.md) — dependency security exceptions and root `overrides` policy
- [app_launch.md](technical/app_launch.md) — operating notes for the two-sided local demo
- *Historical (bannered):* [ADMIN2_GROWTH_HANDOFF_2026-08-14.md](technical/ADMIN2_GROWTH_HANDOFF_2026-08-14.md), [claude-code-handoff.md](technical/claude-code-handoff.md), [claude-code-handoff-2026-04-19.md](technical/claude-code-handoff-2026-04-19.md), [admin-smoke-test-handoff.md](technical/admin-smoke-test-handoff.md) (archived security model), [manual-ios-test.md](manual-ios-test.md)

### product/
- [STRUCTURED_PROFILES.md](product/STRUCTURED_PROFILES.md) — structured guide/traveler profile model

### business/ · financial/ · legal/ · research/
Business plans and [business/model docs](business/), [financial model + handoff](financial/), [legal compliance playbook](legal/), [market research](research/).

### Root of docs/
- [CODE_REVIEW_2026-05-14.md](CODE_REVIEW_2026-05-14.md), [CODE_REVIEW_2026-05-14-claude-preview.md](CODE_REVIEW_2026-05-14-claude-preview.md), [CODE_REVIEW_BACKLOG.md](CODE_REVIEW_BACKLOG.md) — *historical* May 2026 review pass and its deferred-findings backlog
- [manual-ios-test.md](manual-ios-test.md) — *historical* native-only manual test script (see banner; current guide in [technical/TESTING.md](technical/TESTING.md))

## Documentation Standards
- Use Markdown (.md) for all text-based documentation
- Living docs carry a "Last verified: YYYY-MM-DD" stamp near the top; update it when you verify the content
- Historical point-in-time docs get an italic banner at the top instead of edits
- Schema changes are documented by the migrations themselves (`supabase/migrations/`); docs link, not duplicate
- Keep commands and paths copy-pasteable — verify against the repo before writing them
