# Architectural Decision Record

## Decision: Use MongoDB Transactions for Race-Condition Prevention

**Date:** 2024-01-20

**Status:** Accepted

**Context:**
The appointment booking system must prevent double-booking when multiple users attempt to book the same time slot simultaneously.

**Decision:**
We will use MongoDB transactions to wrap the check-and-insert operation atomically.

**Alternatives Considered:**

1. **Optimistic Locking:** Version-based conflict detection
2. **Application-Level Locks:** In-memory or Redis-based locks
3. **Pre-generated Slots:** Create all slots in database upfront
4. **MongoDB Transactions:** (Chosen)

**Consequences:**

**Pros:**

- ACID guarantees prevent race conditions
- Database-level consistency
- Automatic retry logic
- Industry-standard approach

**Cons:**

- Slight performance overhead (~2-5ms per booking)
- Requires MongoDB replica set in production
- More complex than simple queries

**Implementation:**

```typescript
const session = await mongoose.startSession();
session.startTransaction();
try {
  const overlap = await checkOverlap(..., session);
  if (overlap) throw error;
  await create(..., session);
  await session.commitTransaction();
} catch {
  await session.abortTransaction();
}
```

**Rationale:**
Correctness over performance. It's better to have slightly slower bookings than to have double-bookings.

---

## Future Decisions

Additional architectural decisions will be documented here as the system evolves.
