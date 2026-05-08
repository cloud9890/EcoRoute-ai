# Phase 0: Security Spec

## Data Invariants
- Bins can be read by anyone, but updated only by admin/verified system.
- Reports can be created by verified users.
- Users can ONLY modify their own `userId`. Trust scores can only be updated by the system/admin.

## Dirty Dozen Payloads
1. Create bin as normal user.
2. Update bin fillLevel as normal user.
3. Create report without binId.
4. Create report with someone else's userId.
5. Create report with photoAttached = string.
6. Create report as anonymous user.
7. Modify report to change markedFake as normal user.
8. Create citizen doc as another user.
9. Modifying own citizen reliabilityScore.
...
