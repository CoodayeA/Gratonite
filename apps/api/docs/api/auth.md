# Auth API

Base path: `/api/v1/auth`

All endpoints consume and produce `application/json` unless noted otherwise.
The refresh token is managed via an `httpOnly` cookie named `gratonite_refresh`
— clients do not need to handle it manually.

---

## Table of Contents

1. [POST /register](#post-register)
2. [GET /username-available](#get-username-available)
3. [POST /login](#post-login)
4. [POST /refresh](#post-refresh)
5. [POST /logout](#post-logout)
6. [POST /verify-email/request](#post-verify-emailrequest)
7. [POST /verify-email/confirm](#post-verify-emailconfirm)
8. [Error Reference](#error-reference)
9. [Cookie Reference](#cookie-reference)

---

## POST /register

Create a new Gratonite account.

A verification email is sent immediately after registration. The account cannot
be used to log in until the email is verified.

### Request Body

| Field         | Type   | Required | Constraints                                      |
|---------------|--------|----------|--------------------------------------------------|
| `username`    | string | yes      | 3–32 chars, alphanumeric + underscore only       |
| `email`       | string | yes      | Valid email format                               |
| `password`    | string | yes      | Minimum 8 characters                            |
| `displayName` | string | no       | 1–64 chars; defaults to `username` if omitted   |

### Response — 201 Created

```json
{
  "message": "Check your email to verify your account"
}
```

### Error Responses

| Status | Body                                    | Reason                         |
|--------|-----------------------------------------|--------------------------------|
| 400    | `{ "error": "Validation failed", "details": [...] }` | Invalid input     |
| 409    | `{ "error": "Username is already taken" }` | Username conflict           |
| 409    | `{ "error": "Email is already registered" }` | Email conflict            |

### Example

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice_99",
    "email": "alice@example.com",
    "password": "hunter2hunter2",
    "displayName": "Alice"
  }' | jq
```

---

## GET /username-available

Check whether a username is available before registration.

Useful for real-time availability feedback in the registration form. The check
is case-insensitive: `Alice` and `alice` are treated as the same username.

### Query Parameters

| Param      | Type   | Required | Description           |
|------------|--------|----------|-----------------------|
| `username` | string | yes      | Username to check     |

### Response — 200 OK

```json
{ "available": true }
```

or

```json
{ "available": false }
```

### Error Responses

| Status | Body                                            | Reason              |
|--------|-------------------------------------------------|---------------------|
| 400    | `{ "error": "username query parameter is required" }` | Missing param |

### Example

```bash
curl -s "http://localhost:4000/api/v1/auth/username-available?username=alice_99" | jq
```

---

## POST /login

Authenticate with a username or email + password. Issues a short-lived access
token (in the response body) and a long-lived refresh token (as an httpOnly
cookie).

### Request Body

| Field      | Type   | Required | Description                              |
|------------|--------|----------|------------------------------------------|
| `login`    | string | yes      | Username or email address                |
| `password` | string | yes      | Account password                         |

### Response — 200 OK

Sets cookie: `gratonite_refresh` (httpOnly, sameSite: lax, maxAge: 30 days).

```json
{
  "accessToken": "<JWT>",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice_99",
    "email": "alice@example.com",
    "displayName": "Alice",
    "avatarHash": null,
    "bannerHash": null,
    "bio": null,
    "pronouns": null,
    "customStatus": null,
    "status": "online",
    "isAdmin": false,
    "emailVerified": true,
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
}
```

The `accessToken` is a JWT valid for **15 minutes**. Store it in memory (not
`localStorage`) and include it as `Authorization: Bearer <token>` on subsequent
API requests.

### Error Responses

| Status | Body                                               | Reason                          |
|--------|----------------------------------------------------|---------------------------------|
| 400    | `{ "error": "Validation failed", "details": [...] }` | Missing fields                |
| 401    | `{ "error": "Invalid credentials" }`              | Wrong username/email or password |
| 403    | `{ "error": "...", "code": "EMAIL_NOT_VERIFIED" }` | Email not yet confirmed         |

### Example

```bash
# Login with username
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "login": "alice_99", "password": "hunter2hunter2" }' | jq

# Login with email
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "login": "alice@example.com", "password": "hunter2hunter2" }' | jq
```

---

## POST /refresh

Exchange a valid `gratonite_refresh` cookie for a new access token. This is
the "silent refresh" flow used by SPAs to keep the user logged in without
requiring them to re-enter their password.

### Request

No body required. The `gratonite_refresh` cookie is read automatically.

### Response — 200 OK

```json
{ "accessToken": "<new JWT>" }
```

### Error Responses

| Status | Body                                                   | Reason                             |
|--------|--------------------------------------------------------|------------------------------------|
| 401    | `{ "error": "No refresh token provided" }`            | Cookie missing                     |
| 401    | `{ "error": "Invalid or expired refresh token" }`     | JWT invalid, revoked, or expired   |

### Example

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/refresh \
  -b cookies.txt | jq
```

---

## POST /logout

Revoke the current session's refresh token and clear the cookie. After this
call the client should discard its access token from memory.

This operation is idempotent — calling it when already logged out still returns
200.

### Request

No body required.

### Response — 200 OK

```json
{ "message": "Logged out" }
```

Clears cookie: `gratonite_refresh`.

### Example

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/logout \
  -b cookies.txt -c cookies.txt | jq
```

---

## POST /verify-email/request

(Re)send a verification email to the given address.

- If the email is already verified, returns 200 immediately (idempotent).
- If the email is not registered, returns 200 (no enumeration).
- Any existing unconfirmed token is replaced.

### Request Body

| Field   | Type   | Required | Description        |
|---------|--------|----------|--------------------|
| `email` | string | yes      | Email to verify    |

### Response — 200 OK

```json
{ "message": "Verification email sent" }
```

or, if already verified:

```json
{ "message": "Email is already verified" }
```

### Error Responses

| Status | Body                                              | Reason            |
|--------|---------------------------------------------------|-------------------|
| 400    | `{ "error": "Validation failed", "details": [...] }` | Invalid email  |

### Example

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/verify-email/request \
  -H "Content-Type: application/json" \
  -d '{ "email": "alice@example.com" }' | jq
```

---

## POST /verify-email/confirm

Confirm an email verification token. The frontend extracts `token` and `email`
from the verification link query string (`/app/verify?token=xxx&email=yyy`)
and POSTs them here.

On success, `emailVerified` is set to `true` and the token is consumed
(one-time use).

### Request Body

| Field   | Type   | Required | Description                                 |
|---------|--------|----------|---------------------------------------------|
| `token` | string | yes      | Raw verification token from the email link  |
| `email` | string | yes      | Email address the verification was sent to  |

### Response — 200 OK

```json
{ "message": "Email verified" }
```

### Error Responses

| Status | Body                                                              | Reason                         |
|--------|-------------------------------------------------------------------|--------------------------------|
| 400    | `{ "error": "Validation failed", "details": [...] }`             | Missing or invalid fields      |
| 400    | `{ "error": "Invalid or expired verification token" }`           | Token not found or hash mismatch |
| 400    | `{ "error": "Verification token has expired. Please request a new one." }` | Token past 24h expiry |

### Example

```bash
# The token and email come from the link the user clicked in their email.
curl -s -X POST http://localhost:4000/api/v1/auth/verify-email/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    "email": "alice@example.com"
  }' | jq
```

---

## Error Reference

### Standard error shape

```json
{
  "error": "Human-readable description"
}
```

### Validation error shape

```json
{
  "error": "Validation failed",
  "details": [
    { "code": "too_small", "path": ["password"], "message": "Password must be at least 8 characters" }
  ]
}
```

### Special error codes

| Code                | HTTP Status | Endpoint    | Meaning                                           |
|---------------------|-------------|-------------|---------------------------------------------------|
| `EMAIL_NOT_VERIFIED`| 403         | POST /login | Account exists but email has not been confirmed. Prompt the user to check their inbox or resend via `/verify-email/request`. |

---

## Cookie Reference

### `gratonite_refresh`

| Attribute  | Value                                     |
|------------|-------------------------------------------|
| Path       | `/`                                       |
| HttpOnly   | Yes — not readable by JavaScript          |
| SameSite   | `Lax`                                     |
| Secure     | Yes in production, no in development      |
| Max-Age    | 30 days                                   |

The cookie contains a signed JWT (the raw refresh token). Its SHA-256 hash is
stored in the `refresh_tokens` table, enabling per-session revocation on logout.
