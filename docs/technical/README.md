# Technical Documentation

> Last verified: 2026-09-05.

## Start here
- [project-structure.md](project-structure.md) — monorepo layout, workspaces, conventions
- [system-architecture.md](system-architecture.md) — components, data flow, security model
- [RUNBOOK.md](RUNBOOK.md) — run every surface locally; test accounts; screen map
- [TESTING.md](TESTING.md) — automated suites + manual smoke checklists

## Architecture decisions
- [ADR-001-unified-codebase.md](ADR-001-unified-codebase.md) — why Expo Universal (one codebase for iOS/Android/web)
- [ADR-002-monorepo-workspaces.md](ADR-002-monorepo-workspaces.md) — why a workspaces monorepo
- [ADR-003-admin-control-plane-growth-publishing.md](ADR-003-admin-control-plane-growth-publishing.md) — Admin 2.0: anon-key SPA + server-only control plane, growth reporting, Astro/Sanity/Vercel publishing

## Operations
- [ADMIN2_PROVIDER_SETUP_RUNBOOK.md](ADMIN2_PROVIDER_SETUP_RUNBOOK.md) — the 10 remaining Admin 2.0 provider-config steps (DNS, MFA, Resend, GA4, Search Console, publishing hooks, Sanity import, acceptance)
- [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) — dependency security exceptions; root `overrides` policy
- [app_launch.md](app_launch.md) — operating notes for the two-sided local demo

## Stack summary (current)
| Component | Technology |
|-----------|-----------|
| Mobile app | React Native 0.76 / Expo 52 / Expo Router 4 / NativeWind 4 / Zustand 4 |
| Admin console | Vite 8 + React 18 + React Router 7 + Tailwind → Vercel (`detour-admin.vercel.app`) |
| Marketing site | Astro 7 static output → Vercel (detourtrips.com) |
| Content Studio | Sanity 6 + React 19 (isolated lockfile) → `detour-content.sanity.studio` |
| Backend | Supabase (Postgres + Auth + Storage + Deno Edge Functions, pg_cron) |
| Payments | Razorpay — checkout wired (test mode); live payouts deferred |
| Push | Expo Push via `send-push` edge function (built, pending enablement) |
| Maps | react-native-maps 1.18, expo-location |
| Hosting | Vercel (admin + marketing), Sanity (studio), Supabase (backend) |

## Historical documents (bannered — do not follow blindly)
- [ADMIN2_GROWTH_HANDOFF_2026-08-14.md](ADMIN2_GROWTH_HANDOFF_2026-08-14.md) — superseded by the provider setup runbook
- [claude-code-handoff.md](claude-code-handoff.md), [claude-code-handoff-2026-04-19.md](claude-code-handoff-2026-04-19.md) — April 2026 build handoffs
- [admin-smoke-test-handoff.md](admin-smoke-test-handoff.md) — describes the retired local password/service-role security model
- [../manual-ios-test.md](../manual-ios-test.md) — native-only manual test script; current testing guide is [TESTING.md](TESTING.md)
