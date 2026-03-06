# Security Policy

## Supported Versions

Security fixes are applied to the latest `main` branch first.

## Reporting a Vulnerability

Please do **not** open public issues for security vulnerabilities.

Use one of these private channels:
1. GitHub Security Advisory (preferred):  
   `Security` tab -> `Report a vulnerability`
2. If advisory flow is unavailable, contact maintainers directly through a private channel.

## Response SLA (target)

- Initial acknowledgment: within 72 hours
- Triage decision: within 7 days
- Fix/release timeline: based on severity and exploitability

## Disclosure Policy

- Coordinated disclosure is preferred.
- Public disclosure is made after mitigation is available or a safe workaround is documented.

## Scope

In-scope examples:
- Authentication and authorization bypass
- SignalR endpoint abuse leading to privilege escalation
- Injection, XSS, CSRF, SSRF, RCE, sensitive data exposure
- Dependency vulnerabilities with practical exploit paths

Out-of-scope examples:
- Best-practice suggestions without demonstrable risk
- Denial-of-service requiring unrealistic resources
