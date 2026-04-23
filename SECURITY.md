# Security Policy

## Supported Versions

Security fixes are applied to the active `main` branch only.

| Branch | Security Support |
| --- | --- |
| `main` | :white_check_mark: |
| Feature branches / historical commits | :x: |

## Reporting a Vulnerability

If you discover a security issue, please do **not** open a public GitHub issue.

Report privately by email:

- **Contact:** `security@remotecheck.app`
- **Subject format:** `Security Report: <short title>`

Include:

1. A clear description of the issue
2. Reproduction steps (or proof of concept)
3. Affected components/files/endpoints
4. Potential impact
5. Suggested mitigation (if available)

### Response Targets

- Initial acknowledgment: within 3 business days
- Triage update: within 7 business days
- Resolution timeline: shared after triage based on severity and complexity

## Disclosure Policy

- Please allow us time to investigate and remediate before public disclosure.
- We will credit responsible disclosure unless you request anonymity.

## Security Scope Notes

This project contains sensitive assessment and clinical workflow data. Priority areas include:

- Supabase auth/session token validation
- Storage bucket access policies (drawings/audio)
- Edge Function authorization and input validation
- Secrets handling (`service_role`, API keys, `.env.local`)
