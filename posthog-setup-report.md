<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the MHacks 2026 hackathon dashboard. PostHog is initialized client-side via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy through `/ingest` to avoid ad blockers. A shared server-side client in `lib/posthog-server.ts` handles server actions and API routes. User identification is wired to Supabase's auth state change listener so every session — fresh login or returning visit — is correlated to the correct distinct ID. Six events are instrumented across both client and server.

| Event name | Description | File |
|---|---|---|
| `apply_now_clicked` | User clicks the Apply Now button on the hero section or navbar | `components/hero-section.tsx`, `components/navbar.tsx` |
| `otp_requested` | User submits their email and a one-time code is sent to them | `app/login/page.tsx` |
| `user_signed_in` | User successfully verifies their OTP and signs in (server-side) | `lib/actions/auth.server.actions.ts` |
| `application_step_completed` | User completes a form section and advances to the next step | `app/apply/application-form.tsx` |
| `application_submitted` | User successfully submits their hacker application (client + server) | `app/apply/application-form.tsx`, `lib/actions/application-form.server.actions.ts` |
| `resume_uploaded` | User successfully uploads their resume PDF (server-side) | `app/api/upload-resume/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/511408/dashboard/1844665)
- [Application submission funnel](https://us.posthog.com/project/511408/insights/ONx4rXpC)
- [Daily sign-ins](https://us.posthog.com/project/511408/insights/ZdABZwN4)
- [Applications submitted per day](https://us.posthog.com/project/511408/insights/gwtVGkfa)
- [Apply Now clicks by location](https://us.posthog.com/project/511408/insights/u9s0ex13)
- [Application form drop-off by step](https://us.posthog.com/project/511408/insights/WWDsjogz)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `AuthStateSync` component handles this, but verify it fires correctly for users who are already logged in when the page loads.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
