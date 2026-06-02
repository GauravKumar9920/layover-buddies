# ADR-001: Unified Cross-Platform Codebase Strategy

**Status:** ACCEPTED  
**Date:** 2026-04-12  
**Decision Maker:** Gaurav Sharma (Founder)  
**Stakeholders:** Technical team (future), Product team

---

## Context

Detour is a two-sided marketplace (travelers + local guides) that requires presence on:
- Web (browser-based booking, dashboard, admin panel)
- iOS (mobile app for iOS users)
- Android (mobile app for Android users)

The founder (Gaurav) is a robotics engineer from VJTI Mumbai with strong Python/C++ skills but limited web/mobile development experience. The startup needs:
1. A single deployment pipeline (one `git push` → all platforms)
2. Code reuse and maintainability (one codebase, not three)
3. Fast MVP validation (weeks, not months)
4. Scalability for India's diverse device ecosystem
5. Hiring flexibility (JavaScript ecosystem has the largest talent pool in India)

---

## Decision: Option A - Expo Universal with expo-router

**We choose Expo (Option A) for the unified codebase.**

### What This Means

Expo is a framework built on React Native that allows you to write one React/JavaScript codebase and deploy it to:
- Web browsers (via `expo export:web`)
- iOS App Store (via EAS Build)
- Android Play Store (via EAS Build)

All from the **same source code**, with minimal platform-specific branching.

**Key technology stack:**
- **Expo SDK 52** — Latest stable, with excellent web support
- **expo-router v4** — File-based routing (like Next.js, but for mobile + web)
- **React Native 0.76+** — Core framework
- **TypeScript** — Strict mode from day one
- **Supabase** — PostgreSQL database, auth, realtime, Edge Functions
- **NativeWind** — Tailwind CSS for React Native (unified styling)
- **Razorpay** — Payments (popular in India, supports INR)
- **React Native Maps** — Maps on mobile, web (Google Maps Platform API)

---

## Comparison of Options

### Option A: Expo (Universal) with expo-router

**Pros:**
- ✅ Single codebase = one source of truth
- ✅ expo-router v3+ is production-ready for web (Aug 2023+)
- ✅ Massive community (used by Shopify, Discord, Coinbase)
- ✅ Supabase has first-class Expo support (official docs, examples)
- ✅ Faster iteration for MVP (one build process)
- ✅ Easier onboarding for Indian developers (JavaScript is dominant)
- ✅ Can use JavaScript ecosystem libraries (React Query, NativeWind, etc.)
- ✅ EAS Build abstracts away iOS/Android build complexity
- ✅ Vercel/Netlify integration for web is seamless
- ✅ Can eject to bare React Native later if needed (exit strategy)

**Cons:**
- ⚠️ Less fine-grained platform control (e.g., iOS-specific animations)
- ⚠️ Bundle size slightly larger than native (but compression helps)
- ⚠️ Some native features require bridging (rare in MVP scope)
- ⚠️ Requires Expo CLI + EAS account (free for basic, paid for advanced)

**Best for:** Startups, MVPs, teams new to mobile, rapid iteration

**Use if:** You need a unified deployment, fast time-to-market, and are comfortable with "good enough" platform parity.

---

### Option B: Next.js + React Native + Monorepo (Turborepo)

**Pros:**
- ✅ Maximum flexibility per platform (web != mobile UX)
- ✅ Next.js has mature ecosystem (best-in-class web framework)
- ✅ Monorepo allows shared types, UI components, business logic
- ✅ Can deeply optimize each platform (web for SEO, mobile for performance)
- ✅ Fine-grained control over build process
- ✅ Popular in large tech companies

**Cons:**
- ❌ THREE separate codebases to maintain (web, iOS, Android)
- ❌ THREE separate build/deployment pipelines
- ❌ More complex for a solo founder
- ❌ Requires expertise in Next.js + React Native (two different ecosystems)
- ❌ Longer setup time (Turborepo + monorepo infrastructure)
- ❌ More infrastructure costs (different hosting, different build systems)
- ❌ Shared component library is harder to maintain (web ≠ mobile constraints)

**Best for:** Large teams, companies with separate web + mobile teams, mature products

**Use if:** You have dedicated teams and need platform-specific optimization.

---

### Option C: Flutter

**Pros:**
- ✅ Excellent performance (compiled to native)
- ✅ Single codebase → iOS, Android, web, macOS, Windows
- ✅ Google-backed (long-term commitment)
- ✅ Growing ecosystem in India

**Cons:**
- ❌ **Gaurav would need to learn Dart** (not JavaScript ecosystem)
- ❌ Smaller hiring pool in India (JavaScript >> Dart developers)
- ❌ Fewer tutorials + Stack Overflow answers
- ❌ Supabase support is weaker (unofficial libraries, fewer examples)
- ❌ Cannot reuse JavaScript libraries (isolated ecosystem)
- ❌ Overkill for MVP (premature optimization)
- ❌ Longer onboarding time for Gaurav

**Best for:** Performance-critical apps, teams familiar with Dart, teams in Asia-Pacific with Dart expertise

**Use if:** Performance is paramount and you have Dart expertise.

---

## Why Option A Wins for Detour

| Factor | Option A (Expo) | Option B (Monorepo) | Option C (Flutter) |
|--------|-----------------|--------------------|--------------------|
| **Time to MVP** | 4-6 weeks | 8-10 weeks | 8-12 weeks |
| **Single codebase** | ✅ Yes | ❌ No (3 apps) | ✅ Yes |
| **Gaurav's learning curve** | ✅ Minimal | ❌ Steep | ❌ Very steep |
| **India talent pool** | ✅ Huge | ✅ Large | ❌ Small |
| **Supabase integration** | ✅ First-class | ✅ Good | ⚠️ Third-party |
| **Future flexibility** | ✅ Can migrate to B | ⚠️ N/A | ❌ Hard to migrate |
| **Deploy complexity** | ✅ Simple | ❌ 3 pipelines | ✅ Simple |
| **Infrastructure cost** | ✅ Low | ❌ High | ✅ Low |

---

## Decision Details

### Immediate Impact

1. **Codebase Structure**
   - Single Expo app with expo-router file-based routing
   - One `package.json`, one TypeScript config
   - Platform-specific code isolated to `_layout.tsx` and minimal conditionals

2. **Deployment Pipeline**
   - **Web**: `expo export:web` → Vercel (same as Next.js)
   - **iOS**: EAS Build → TestFlight → App Store
   - **Android**: EAS Build → Play Store
   - All triggered by `git push main`

3. **Development Environment**
   - `npx expo start` for local dev (web + mobile simulators)
   - Same codebase = one editor session, one terminal

4. **Hiring**
   - Job postings: "React/TypeScript developer with Expo experience"
   - Not: "Separate iOS + Android + Web developers"
   - Massive talent pool in India (React is dominant)

---

## Consequences

### Short Term (Weeks 1-4)
- ✅ Faster MVP delivery
- ✅ Gaurav can learn React/Expo from the ground up
- ✅ Single source of truth reduces bugs
- ✅ One build pipeline = less DevOps overhead

### Medium Term (Months 2-6)
- ✅ Scaling becomes straightforward (one codebase)
- ✅ New hires onboard faster (one language, one framework)
- ✅ Feature parity across platforms easier
- ⚠️ May hit performance limits on low-end Android devices (mitigate with optimization)

### Long Term (6+ months)
- ✅ If demand justifies: can eject to bare React Native (Option B) for either platform
- ✅ Web can move to Next.js independently if needed (exit strategy)
- ⚠️ Will need PostGIS + Elasticsearch at scale for geo queries and search
- ⚠️ Will need image CDN optimization (Supabase Storage + Cloudflare)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Performance on low-end Android | NativeWind optimization, code splitting, lazy loading |
| Supabase bandwidth limits | Implement caching (React Query), image CDN |
| EAS Build costs (free tier limited) | Start free, upgrade to Metered billing at $7/month |
| Rapid growth overwhelming infrastructure | Supabase auto-scales; add connection pooling at 10K users |
| Competitor launches native-first | Exit strategy: Monorepo migration in Month 12 if needed |

---

## Action Items

### Immediate (Week 1)
- [ ] Scaffold Expo app with expo-router
- [ ] Set up TypeScript + NativeWind
- [ ] Create Supabase project + schema
- [ ] Set up environment variables (.env.local)

### Phase 1 MVP (Weeks 1-4)
- [ ] Implement auth (email + Google OAuth)
- [ ] Build traveler booking flow (flight → guide search → booking)
- [ ] Build guide profile + itinerary creation
- [ ] Integrate Razorpay for payments
- [ ] Deploy web to Vercel
- [ ] Deploy iOS/Android to internal testing (EAS Build)

### Phase 2 (Weeks 5-8)
- [ ] Real-time chat (Supabase Realtime)
- [ ] Location tracking (Expo Location + PostGIS)
- [ ] Live tour view
- [ ] Post-tour reviews

### Phase 3 (Weeks 9+)
- [ ] Matching algorithm (Supabase Edge Functions)
- [ ] Flight tracking (FlightAware AeroAPI)
- [ ] Payouts + earnings dashboard
- [ ] Advanced search + filters
- [ ] Notifications (Expo Notifications)

### Monitoring
- [ ] Set up Sentry for error tracking
- [ ] Monitor build times (should be <5 min for web, <15 min for mobile)
- [ ] Track bundle sizes (web < 2MB gzip, mobile < 50MB)

---

## References

- [Expo Documentation](https://docs.expo.dev)
- [expo-router Documentation](https://docs.expo.dev/routing/introduction/)
- [Expo Web Support](https://docs.expo.dev/build-reference/how-expo-builds-ios-and-android/)
- [Supabase + Expo Integration](https://supabase.com/docs/guides/getting-started/quickstarts/expo)
- [NativeWind Documentation](https://www.nativewind.dev)
- [Turborepo Reference (Option B)](https://turbo.build/repo/docs)
- [Flutter Documentation (Option C)](https://flutter.dev)

---

## Sign-Off

**Accepted by:** Gaurav Sharma  
**Date:** 2026-04-12  
**Next Review:** 2026-07-12 (after MVP launch)
