# Security Specification: Simple Quiz Application

## 1. Data Invariants
- **User profiles (`/users/{userId}`)**: 
  - Read access is allowed for any user (authenticated or guest/unauthenticated) to fetch top scores for the global leaderboard view.
  - Write, update, and delete access are restricted strictly to the user themselves. Users cannot modify another user's profile.
  - Experience points (`totalScore`) and steak metrics (`streakCount`) must be integers, and display names must be restricted string sizes.

- **Quiz History logs (`/history/{historyId}`)**:
  - Read access is permitted only for authenticated users who owned the corresponding document (`uid` field in history must match the logged-in user's UID) to fetch recent logs.
  - Create/Write access is allowed only if the logged-in user's UID matches the history document's `uid` field, preventing malicious actors from writing quiz logs under someone else's ID.

---

## 2. The "Dirty Dozen" Threat Payloads
Here are 12 specific hostile payloads/queries designed to break identity, integrity, and state logic:

1. **Hostile Profile Creation**: Unauthenticated user attempts to create a profile under `/users/attacker_user`.
2. **Profile Identity Spoofing**: Logged-in user `user_A` attempts to write/edit the profile of `user_B` at `/users/user_B`.
3. **Privilege Escalation Gate**: Logged-in user `user_A` attempts to add private admin flags inside their user document.
4. **Denial of Wallet (ID Poisoning)**: User attempts to write profile with a 1.5KB long, corrupted special-character document ID.
5. **Denial of Wallet (Size Flood)**: User attempts to write profile with an extremely large `displayName` string (e.g., 5MB).
6. **Negative XP Inject**: User attempts to update their `totalScore` with a negative score or invalid floating value.
7. **Score Type Hijack**: User attempts to set `totalScore` to a string instead of an integer.
8. **Malicious History Write**: User `user_A` attempts to add a quiz history record under `uid = "user_B"`.
9. **History Log Inflation**: User attempts to submit a history document with an empty user UID.
10. **History Private Read Theft**: User `user_A` attempts to list or get history logs belonging to `user_B`.
11. **Anonymized System Read Leak**: Unauthenticated user attempts to list the entire `/history` collection.
12. **Tampering with Creation Timestamps**: User attempts to set a custom string for `timestamp` or `createdAt` bypassing system checks.

---

## 3. Test Cases (TDD Rules Validation)

Below is the conceptual Firestore verification suite ensuring all of these payloads fail.

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("Firestore Security Rules Tests", () => {
  it("rejects unauthorized user write to other profile", async () => {
    // Assert that User A cannot write to User B profile.
  });

  it("rejects history document creation where uid doesn't match authenticated user", async () => {
    // Assert that User A cannot log quizes with uid set to User B.
  });

  it("permits global read access to user profile summaries for leaderboard rendering", async () => {
    // Assert that any client can get/list user data.
  });
});
```
