# SignalBridge AI — Firestore Security Specification

## 1. Data Invariants
1. **Public Readability for Disaster Awareness**: Incidents and feed sync states can be read by clients for crisis awareness and situational analysis.
2. **Reviewer & Admin Controlled Mutation**: Only authenticated users (or bootstrap admin `touseefpanjtan52@gmail.com`) can review, verify, or update incidents. Unauthenticated writes are strictly forbidden.
3. **Immutable Audit Trail**: Audit log entries (`/audit_logs/{logId}`) are append-only. Once created, they can never be updated or deleted.
4. **Anti-Update-Gap Strict Schemas**: `isValidIncident` and `isValidAuditLog` enforce allowed keys, bounded string lengths (title <= 300, notes <= 4000, provenance <= 500), and valid enums.
5. **No Blind Privilege Escalation**: RBAC and administrative overrides cannot be self-assigned.
6. **No Arbitrary Key Injection**: Document updates must be constrained to explicit, allowlisted action keys (`reviewStatus`, `reviewedBy`, `reviewedAt`, `reviewerNotes`, `conflictStatus`, `updatedAt`, `mergedReports`, etc.).

---

## 2. The Dirty Dozen Payloads (Targeting Exploitation Points)
1. **Payload 1 (Ghost Field Injection / Shadow Update)**:
   Attempt to write an unvalidated field `{ id: "inc-1", title: "Test", isSystemSuperUser: true }`.
   *Expected: REJECT (Schema violation).*
2. **Payload 2 (Unauthenticated Write)**:
   Unauthenticated client attempts `create` on `/incidents/inc-999`.
   *Expected: REJECT (Permission denied).*
3. **Payload 3 (Audit Log Deletion)**:
   Authenticated user attempts to `delete` an audit log `/audit_logs/log-123`.
   *Expected: REJECT (Audit logs are immutable).*
4. **Payload 4 (Audit Log Mutation / History Tampering)**:
   Authenticated user attempts to `update` an existing audit log.
   *Expected: REJECT (Updates denied).*
5. **Payload 5 (ID Path Variable Poisoning)**:
   Writing with document ID containing path traversal `../../../evil`.
   *Expected: REJECT (Fails `isValidId`).*
6. **Payload 6 (Oversized Title Buffer Attack)**:
   Incident title containing 50,000 characters.
   *Expected: REJECT (title exceeds maxLength 300).*
7. **Payload 7 (Invalid Enum Injection)**:
   `originType: "hacked_feed"` or `reviewStatus: "super_verified"`.
   *Expected: REJECT (Invalid enum).*
8. **Payload 8 (Identity Spoofing on Review)**:
   User attempting to submit review without valid auth credentials.
   *Expected: REJECT (isSignedIn() check).*
9. **Payload 9 (Arbitrary Modification of System Confidence / Timestamps)**:
   Client bypassing action gates to rewrite core internal fields.
   *Expected: REJECT (hasOnly action-based update gates).*
10. **Payload 10 (Malformed Feed Sync State)**:
    Attempt to inject malicious script into feed sync error message or oversized ID.
    *Expected: REJECT (Field validation).*
11. **Payload 11 (Unauthenticated Feed State Tampering)**:
    Unauthenticated user attempts to update feed sync telemetry.
    *Expected: REJECT (Only authenticated operators or admin).*
12. **Payload 12 (Blanket Collection Write)**:
    Attempt to write to undefined collection `/system_secrets/api_keys`.
    *Expected: REJECT (Default deny catch-all `match /{document=**}`).*
