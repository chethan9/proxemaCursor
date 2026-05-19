# Supabase Auth hardening (brute-force and abuse)

Email/password sign-in uses the Supabase JS client in the browser (`signInWithPassword`). Requests go to **Supabase Auth**, not through Next.js `/api/*`, so application middleware rate limits do not apply to login attempts.

## Recommended dashboard settings

In the [Supabase Dashboard](https://supabase.com/dashboard) for your project:

1. **Authentication** → **Attack Protection**  
   - Enable protections appropriate for your plan (e.g. leaked password protection, CAPTCHA where available).

2. **Authentication** → **Rate limits**  
   Configure limits on sign-in / sign-up / token endpoints to match your policy. For a **5 attempts per 15 minutes** style policy, align **IP-based** or **identifier-based** limits with what Supabase exposes for your plan (exact knobs vary by version).

3. **Authentication** → **Auth hooks** (optional)  
   Use hooks to log or block suspicious patterns if you need logic beyond built-in rate limits.

4. **URL configuration**  
   Ensure **Site URL** and **Redirect URLs** match production and preview domains so OAuth and magic links are not abused from unexpected origins.

## Optional app-enforced login caps

To enforce exact attempt counts in your own stack, you would need a **server-mediated** flow (e.g. `POST /api/auth/sign-in` with Redis-backed counters) and sessions via **`@supabase/ssr`** cookies. That is a larger refactor than dashboard configuration; treat it as a follow-up if compliance requires in-app counters.
