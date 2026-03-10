# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

We only support the latest version of Gratonite. Please ensure you are running the most recent release before reporting a vulnerability.

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, report vulnerabilities using one of these methods:

1. **GitHub Security Advisories** (preferred): Use [GitHub's private vulnerability reporting](https://github.com/CoodayeA/Gratonite/security/advisories/new) to create a confidential advisory.

2. **Email**: Send details to **security@gratonite.chat**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity
  - Critical: Within 72 hours
  - High: Within 1 week
  - Medium: Within 2 weeks
  - Low: Next release cycle

### What to Expect

1. We'll acknowledge your report within 48 hours
2. We'll investigate and keep you updated on our progress
3. Once fixed, we'll credit you in the release notes (unless you prefer to remain anonymous)
4. We'll coordinate disclosure timing with you

## Scope

The following are in scope:

- Gratonite API (`apps/api`)
- Gratonite Web Client (`apps/web`)
- Gratonite Desktop App (`apps/desktop`)
- Gratonite Mobile App (`apps/mobile`)
- Self-hosting configurations (`deploy/`)

The following are out of scope:

- Third-party dependencies (report to the upstream project)
- Social engineering attacks
- Denial of service attacks
- Issues in services we don't control

## Security Best Practices for Self-Hosters

- Always use HTTPS in production
- Keep your `.env` file secure and never commit it to version control
- Regularly update to the latest version
- Use strong, unique passwords for database and JWT secrets
- Enable rate limiting (configured by default)
- Review the [self-hosting guide](deploy/self-host/README.md) for secure deployment
