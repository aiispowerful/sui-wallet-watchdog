# Vercel environment variables

Set these in the Vercel project settings (Environment Variables). Names only — never commit values.

## Required for a full production demo

- `TATUM_API_KEY`
- `MEMWAL_KEY`
- `MEMWAL_ACCOUNT_ID`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `LLM_MODEL`
- `SESSION_SECRET`

## Optional

- `WATCH_ADDRESS` (scripts only; never pre-fills the UI)
- `RATE_LIMIT_PER_HOUR`
- `TATUM_SUI_GRAPHQL_URL`
- `TATUM_DATA_URL`
- `ALLOW_PUBLIC_SUI_FALLBACK`
- `MEMWAL_SERVER_URL`
- `MEMWAL_NAMESPACE_PREFIX`
- `AUTH_DOMAIN`

`RATE_LIMIT_PER_HOUR` defaults to 20 if unset. Set it to `0` to disable the scan limiter.
