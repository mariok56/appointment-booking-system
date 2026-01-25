# Architectural Decision Records

## ADR-001: Use MongoDB Transactions for Race-Condition Prevention

**Date:** 2024-01-20

**Status:** Accepted

**Context:**
The appointment booking system must prevent double-booking when multiple users attempt to book the same time slot simultaneously. This is a critical business requirement - two patients cannot be scheduled for the same doctor at overlapping times.

The naive approach of "check for overlap, then insert" creates a race condition window:

```
Time  | Request A              | Request B
------|------------------------|------------------------
T1    | Check overlap (none)   |
T2    |                        | Check overlap (none)
T3    | Insert appointment     |
T4    |                        | Insert appointment ❌ DOUBLE BOOKING!
```

**Decision:**
We will use **MongoDB transactions** to wrap the check-and-insert operation atomically.

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Check for overlap WITHIN the transaction
  const overlap = await Appointment.findOne({
    doctorId,
    status: "BOOKED",
    start: { $lt: end },
    end: { $gt: start },
  }).session(session); // CRITICAL: Use session

  if (overlap) throw new Error("Slot not available");

  // Insert WITHIN the transaction
  await Appointment.create([data], { session });

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

**Alternatives Considered:**

### 1. Optimistic Locking (Version Field)

**Approach:** Add version field, check during update
**Pros:** Simple, no transaction overhead
**Cons:** Only works for updates, not initial booking check-and-insert
**Rejected:** Doesn't solve our specific problem

### 2. Application-Level Locks (Redis/Memcached)

**Approach:** Acquire distributed lock before check-and-insert
**Pros:** Works with standalone MongoDB, can span services
**Cons:** Added complexity (Redis dependency), lock contention, network latency
**Rejected:** Over-engineering for our scale

### 3. Pre-generated Slots with Unique Index

**Approach:** Pre-create all slots, use findOneAndUpdate to claim
**Pros:** Atomic operation, simple logic
**Cons:** Storage overhead, less flexible, requires slot generation jobs
**Rejected:** Added complexity, not needed for our scale

### 4. MongoDB Transactions (Chosen)

**Approach:** Wrap check-and-insert in atomic transaction
**Pros:**

- ACID guarantees
- Database-level consistency
- Automatic retry logic
- Industry-standard approach
- Clear, readable code
  **Cons:**
- Slight performance overhead (~2-5ms per booking)
- Requires MongoDB replica set

**Consequences:**

### Positive

- **Correctness:** Guaranteed race-condition safety through ACID guarantees
- **Simplicity:** Logic is straightforward and follows standard patterns
- **Maintainability:** Easy to understand and modify
- **Testability:** Can be tested with concurrent requests
- **Reliability:** MongoDB handles edge cases (network issues, crashes)

### Negative

- **Deployment Requirement:** MongoDB must run in replica set mode (even single-node requires rs.initiate())
- **Performance Overhead:** ~2-5ms additional latency per booking (acceptable trade-off)
- **Complexity:** Requires proper session management and error handling

### Mitigation

- Docker Compose configured with replica set initialization
- Performance overhead is acceptable for correctness
- Error handling is centralized in service layer

**Implementation Notes:**

1. **Session Management:** Always end sessions in finally block
2. **Error Handling:** Custom AppointmentBookingError for conflict responses
3. **Indexing:** Compound index on (doctorId, status, start, end) for efficient overlap check
4. **Testing:** Performance tests verify only 1 of 10 concurrent requests succeeds

**References:**

- [MongoDB Transactions Documentation](https://docs.mongodb.com/manual/core/transactions/)
- [Mongoose Transactions](https://mongoosejs.com/docs/transactions.html)

---

## ADR-002: Calculate Availability On-Demand vs Pre-Generated Slots

**Date:** 2024-01-20

**Status:** Accepted

**Context:**
The system needs to show available time slots for booking. There are two main approaches:

1. Pre-generate all possible slots in the database
2. Calculate available slots on-demand from working hours minus booked appointments

**Decision:**
We will calculate availability **on-demand** rather than pre-generating slots.

**Algorithm:**

```javascript
async function getAvailableSlots(doctorId, date, slotMinutes = 30) {
  // 1. Define working hours (09:00 - 17:00)
  const startOfDay = new Date(date).setHours(9, 0, 0, 0);
  const endOfDay = new Date(date).setHours(17, 0, 0, 0);

  // 2. Generate all possible slots
  const allSlots = generateTimeSlots(startOfDay, endOfDay, slotMinutes);

  // 3. Fetch booked appointments
  const booked = await Appointment.find({
    doctorId,
    status: "BOOKED",
    start: { $gte: startOfDay, $lt: endOfDay },
  });

  // 4. Filter out booked slots
  return allSlots.filter((slot) => !hasOverlap(slot, booked));
}
```

**Alternatives Considered:**

### Pre-Generated Slots

**Pros:** Fast queries, supports complex scheduling
**Cons:** Storage overhead, cleanup jobs needed, less flexible
**Rejected:** Over-engineering for our scale

### On-Demand Calculation (Chosen)

**Pros:**

- No storage overhead
- Always up-to-date
- Flexible slot durations
- Simple logic
  **Cons:** Computation on each request (mitigated by indexing)

**Consequences:**

- Query performance is excellent (< 50ms) with proper indexes
- No maintenance jobs needed
- Easy to change slot duration
- Can add caching layer if needed later

---

## Future Decisions

Additional architectural decisions will be documented here as the system evolves.

- ADR-003: Authentication Strategy (pending)
- ADR-004: Multi-Location Support (pending)
- ADR-005: Notification System Architecture (pending)
