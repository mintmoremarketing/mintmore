# Master Workflow Acceptance Tests

Run these against a staging database with migrations `023` through `032` applied.

## Membership And Access

- Open `/demo`, verify the dashboard renders without authenticated API errors, and verify live actions route to account creation.
- Subscribe once: membership activates and welcome credits are granted once.
- Replay the payment webhook: no duplicate membership payment or credits.
- Renew: only renewal credits are granted.
- Pause: next renewal stops, paid-period access remains, and active orders remain usable.
- Expire membership: new job creation and subscription tools are blocked; active orders remain usable.
- Purchase each configured access pass and verify no Mint Credits are granted.

## Jobs, Matching, And Negotiation

- KYC blocks publishing a paid brief but does not block demo access or Mint AI.
- Budget brief queues matching automatically.
- Pro brief waits for admin review.
- Only the primary selected creative can view and respond.
- Save a preferred creative and verify the configured ranking boost when eligible.
- Complete freelancer, client, freelancer, client offer turns.
- Verify stale offer buttons return conflict and live views update without refresh.

## Deal, Delivery, And Money

- Approve a deal with insufficient client cash: approval fails and no assignment is created.
- Approve with sufficient cash: escrow, assignment, chat, and notifications each occur exactly once.
- Retry the same approval request: no duplicate escrow hold.
- Upload versions and verify old versions remain.
- Request three included revision rounds, then verify round four debits the client and credits the freelancer exactly once.
- Open a dispute and verify delivery/escrow completion is frozen.
- Approve final delivery, submit structured ratings, and verify escrow release and freelancer earnings.
- Request a scheduled payout and verify no fee; request an instant payout and verify the configured fee and net payout.

## Operations

- Stop the backend after writing an outbox event, restart it, and verify the event is delivered.
- Force an outbox handler failure until dead-lettered; verify `/health` degrades and the Audit screen exposes it.
- Retry the event with an `operations.manage` admin and verify an immutable audit record is created.
- Verify the admin dashboard reports wallet-ledger or held-escrow reconciliation drift.
- Verify public Mintbox URLs never reveal storage-provider URLs.
- Create a social post from an existing Mintbox image/video and verify the stored media URL uses the Mint More API hostname.
