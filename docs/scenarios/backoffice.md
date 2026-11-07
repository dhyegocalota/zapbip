---
name: backoffice
title: The operator registers two WhatsApp numbers and an owner writes to each
authors: 2
paths:
  - "apps/api/src/backoffice/**"
  - "apps/api/src/numbers/**"
  - "apps/api/src/adapters/whatsapp/**"
  - "apps/api/migrations/**"
---

## Setup

Boot the development Worker with `pnpm --filter @zapbip/api dev`, which serves the backoffice on `http://backoffice.localhost:8787` and the fake WhatsApp channel and fake Graph on the same stack. The owner has run `pnpm backoffice:enroll:development` and put its two lines in `apps/api/.dev.vars`; the run takes the backoffice key and a code generator for the authenticator secret from the owner. Author 1 is the operator in the backoffice. Author 2 is an owner, writing from the fake WhatsApp channel.

## Tests

### T1 The operator signs in with both factors

Author 1 opens the backoffice, submits a wrong key, then the right key with a wrong code, then both right.

- Expect: the first two attempts show the same generic failure and the third opens the overview, with "No number is registered" shown.

### T2 The operator registers two numbers

Author 1 registers number A and number B under one Meta app, each with its own phone number ID, WABA ID, display number and access token, confirming each with a fresh code.

- Expect: both are listed as Pending, no page shows a token or an app secret again, and the audit log lists two `number.registered` rows.

### T3 The operator verifies and activates both

Author 1 verifies each number against the fake Graph and activates it with a fresh code.

- Expect: both show Verified and Active, and the verification page lists the four template statuses.

### T4 An owner writes to each number

Author 2 sends a message to number A, then another phone sends one to number B.

- Expect: each owner gets an account bound to the number it wrote to, and each reply is sent from the matching phone number ID.

### T5 A disabled number goes quiet

Author 1 disables number B with a fresh code, then the owner writes to B again.

- Expect: the message is ignored with a `200`, no agent sees it, and sends from B are refused.

## Edge cases to hunt during the run

- A step-up code reused within its 30 seconds.
- Ten wrong sign-ins in a row, then the right ones inside 15 minutes, then a re-enrollment.
- A form posted without its CSRF token or from a foreign `Origin`.
- The sign-in page requested on the MCP host, and the MCP routes on the backoffice host.
- A pending number receiving a message, and a closed number receiving a message from a new phone.
- A token or app secret appearing in a page, a log line or an MCP result.
