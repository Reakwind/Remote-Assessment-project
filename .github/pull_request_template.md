## Scope

- Surface/backend area:
- User-visible behavior:
- Supabase remote impact: none / read-only inspection / migration / Edge Function deploy / storage / secrets
- Netlify impact: none / patient staging / clinician / both

## Verification

- [ ] `cd client && npm test`
- [ ] `cd client && npm run lint`
- [ ] `cd client && npm run build`
- [ ] `cd client && npm run build:surfaces && npm run verify:surface-builds`
- [ ] `deno check --frozen $(node scripts/edge-functions.mjs deno-check-args)`
- [ ] Local Supabase + Edge Functions + `node scripts/local-e2e.mjs --all-versions`
- [ ] `cd client && npm run e2e:browser`
- [ ] Hosted smoke, if deployed-surface or hosted Supabase behavior changed

Skipped checks and reason:

## Deployment Notes

- GitHub CI run:
- Netlify deploys checked:
- Hosted Supabase inspection/deploy commands:
- Rollback note for hosted-changing work:

## Risks / Follow-Up

- 
