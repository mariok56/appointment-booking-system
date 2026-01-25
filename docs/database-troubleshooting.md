# Database Troubleshooting Guide

## Scenario: Overlapping Appointments Despite Prevention Logic

You discover that some appointments are overlapping even though your overlap prevention logic is in place. Users are complaining about double-bookings.

---

## 1. Initial Investigation

### Data to Examine

#### A. Find Overlapping Appointments

```javascript
// MongoDB query to find overlapping appointments
db.appointments.aggregate([
  {
    $match: { status: "BOOKED" },
  },
  {
    $lookup: {
      from: "appointments",
      let: {
        doctorId: "$doctorId",
        start: "$start",
        end: "$end",
        id: "$_id",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$doctorId", "$$doctorId"] },
                { $eq: ["$status", "BOOKED"] },
                { $ne: ["$_id", "$$id"] },
                { $lt: ["$start", "$$end"] },
                { $gt: ["$end", "$$start"] },
              ],
            },
          },
        },
      ],
      as: "overlaps",
    },
  },
  {
    $match: {
      overlaps: { $ne: [] },
    },
  },
  {
    $project: {
      doctorId: 1,
      start: 1,
      end: 1,
      overlaps: 1,
      overlapCount: { $size: "$overlaps" },
    },
  },
]);
```

#### B. Check Transaction Logs

```bash
# Enable profiling on MongoDB
db.setProfilingLevel(2);

# Check slow queries
db.system.profile.find({ millis: { $gt: 100 } }).sort({ ts: -1 });

# Check for failed transactions
db.system.transactions.find({ state: "aborted" });
```

#### C. Examine Application Logs

```bash
# Search for booking errors
grep "Appointment booking failed" logs/combined.log

# Search for transaction rollbacks
grep "abortTransaction" logs/combined.log

# Look for correlation IDs with conflicts
grep "BOOKING_CONFLICT" logs/combined.log | awk '{print $5}' | sort | uniq -c
```

#### D. Check Server Time vs Database Time

```javascript
// Check if server time and MongoDB time are in sync
const serverTime = new Date();
const dbTime = await db.runCommand({ isMaster: 1 }).then((r) => r.localTime);

console.log("Server time:", serverTime);
console.log("DB time:", dbTime);
console.log("Difference (ms):", Math.abs(serverTime - dbTime));

// Difference should be < 1000ms
```

#### E. Analyze Concurrency Patterns

```javascript
// Find appointments created within 1 second of each other
db.appointments.aggregate([
  {
    $group: {
      _id: {
        doctorId: "$doctorId",
        timeWindow: {
          $subtract: ["$createdAt", { $mod: ["$createdAt", 1000] }],
        },
      },
      count: { $sum: 1 },
      appointments: { $push: "$$ROOT" },
    },
  },
  {
    $match: { count: { $gt: 1 } },
  },
]);
```

---

## 2. Common Causes for Race Conditions

### Cause 1: **Transactions Not Implemented**

**Symptoms:**

- Multiple appointments created for same slot
- Overlaps occur under load
- No rollback when conflicts detected

**Root Cause:**

```javascript
// WRONG: Non-atomic check-then-act
const overlap = await checkOverlap();
if (!overlap) {
  await createAppointment(); // Race window here!
}
```

**Why It Happens:**
Between checking for overlap and creating appointment, another request can insert a conflicting appointment.

**Detection:**

```javascript
// Check if transactions are being used
grep -r "startSession" backend/src/
grep -r "startTransaction" backend/src/
```

### Cause 2: **MongoDB Not in Replica Set Mode**

**Symptoms:**

- Transactions fail with error: "Transaction numbers are only allowed on a replica set member"
- Code has transactions but they don't work

**Root Cause:**
MongoDB transactions require replica set. Standalone MongoDB doesn't support transactions.

**Detection:**

```javascript
// Check replica set status
db.adminCommand({ replSetGetStatus: 1 });

// If error: "not running with --replSet", you're in standalone mode
```

**Solution:**

```bash
# docker-compose.yml
mongodb:
  image: mongo:7
  command: ["--replSet", "rs0"]

# After starting, initialize replica set:
docker exec appointment-db mongosh --eval "rs.initiate()"
```

### Cause 3: **Session Not Passed to Queries**

**Symptoms:**

- Transactions start but queries don't use them
- Rollback doesn't undo all changes
- Partial writes occur

**Root Cause:**

```javascript
// WRONG: Session not used
const session = await mongoose.startSession();
session.startTransaction();

const overlap = await Appointment.findOne({ ... });
// ☝️ Missing .session(session)

await Appointment.create([data]);
// ☝️ Missing { session }
```

**Detection:**

```javascript
// Search for queries without .session()
grep -A5 "startTransaction" backend/src/ | grep -v "session(session)"
```

### Cause 4: **Time Zone Inconsistencies**

**Symptoms:**

- Overlaps occur at specific times (midnight, DST transitions)
- Different results on different servers
- Inconsistent behavior across environments

**Root Cause:**
Server time zone differs from database time zone, or client sends local time instead of UTC.

**Detection:**

```javascript
// Check appointment times
db.appointments.find().forEach((apt) => {
  print(
    `${apt._id}: ${apt.start.toISOString()} (${apt.start.getTimezoneOffset()})`,
  );
});

// All should have same timezone offset (0 for UTC)
```

### Cause 5: **Index Missing or Incorrect**

**Symptoms:**

- Overlap detection very slow (> 500ms)
- Performance degrades with more appointments
- Race window larger under load

**Root Cause:**
Without proper indexes, overlap queries do collection scans, taking too long and widening race window.

**Detection:**

```javascript
// Check query plan
db.appointments
  .find({
    doctorId: ObjectId("..."),
    status: "BOOKED",
    start: { $lt: new Date() },
    end: { $gt: new Date() },
  })
  .explain("executionStats");

// Look for:
// - totalDocsExamined vs nReturned (should be close)
// - executionTimeMillis (should be < 50ms)
// - winningPlan.stage should be "IXSCAN" not "COLLSCAN"
```

---

## 3. Resolution Steps

### Fix 1: Implement Transactions Correctly

```javascript
async function bookAppointment(data) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        // 1. Check overlap WITH SESSION
        const overlap = await Appointment.findOne({
          doctorId: data.doctorId,
          status: "BOOKED",
          start: { $lt: data.end },
          end: { $gt: data.start },
        }).session(session); // ← CRITICAL

        if (overlap) {
          throw new Error("Slot not available");
        }

        // 2. Create appointment WITH SESSION
        const appointment = await Appointment.create(
          [{ ...data, status: "BOOKED" }],
          { session }, // ← CRITICAL
        );

        return appointment[0];
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    session.endSession();
  }
}
```

### Fix 2: Enable Replica Set

```yaml
# docker-compose.yml
mongodb:
  image: mongo:7
  command: ["--replSet", "rs0", "--bind_ip_all"]
  environment:
    MONGO_INITDB_DATABASE: appointments
  healthcheck:
    test: |
      mongosh --eval "
        try {
          rs.status();
          print('Replica set is ready');
        } catch (e) {
          rs.initiate();
          print('Initiated replica set');
        }
      "
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 20s
```

### Fix 3: Add Proper Indexes

```javascript
// In Appointment model
AppointmentSchema.index({
  doctorId: 1,
  status: 1,
  start: 1,
  end: 1,
});

// Create index manually if needed
db.appointments.createIndex({
  doctorId: 1,
  status: 1,
  start: 1,
  end: 1,
});

// Verify index is used
db.appointments
  .find({
    doctorId: ObjectId("..."),
    status: "BOOKED",
    start: { $lt: ISODate("...") },
    end: { $gt: ISODate("...") },
  })
  .explain("executionStats");
```

### Fix 4: Standardize on UTC

```javascript
// Backend: Store all times in UTC
const startUTC = new Date(req.body.start); // ISO 8601 string
const endUTC = new Date(req.body.end);

// Validate it's actually UTC
if (startUTC.getTimezoneOffset() !== 0) {
  throw new Error("Times must be in UTC (ISO 8601 format)");
}

// Frontend: Send UTC times
const startUTC = new Date(localDateTime).toISOString();

// Database: Store as Date (automatically UTC)
start: { type: Date, required: true }
```

### Fix 5: Add Retry Logic with Exponential Backoff

```javascript
async function bookWithRetry(data, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await bookAppointment(data);
    } catch (error) {
      if (error.message.includes("WriteConflict")) {
        // Transaction conflict - retry
        lastError = error;
        const delay = Math.min(100 * Math.pow(2, attempt), 1000);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        // Other error - don't retry
        throw error;
      }
    }
  }

  throw lastError;
}
```

---

## 4. Prevention & Monitoring

### A. Automated Testing

```javascript
// CI/CD pipeline test
describe("Race condition prevention", () => {
  it("should prevent double booking under concurrent load", async () => {
    const requests = Array(10)
      .fill()
      .map(() => bookAppointment({ doctorId, patientId, start, end }));

    const results = await Promise.allSettled(requests);

    const successful = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(successful.length).toBe(1);
    expect(failed.length).toBe(9);
  });
});
```

### B. Real-time Monitoring

```javascript
// Alert if overlaps detected
async function checkForOverlaps() {
  const overlaps = await db.appointments
    .aggregate([
      /* overlap detection query from section 1 */
    ])
    .toArray();

  if (overlaps.length > 0) {
    logger.error("CRITICAL: Overlapping appointments detected!", {
      count: overlaps.length,
      overlaps: overlaps.map((o) => o._id),
    });

    // Send alert to Slack/PagerDuty
    await sendAlert({
      severity: "critical",
      message: `${overlaps.length} overlapping appointments found`,
      data: overlaps,
    });
  }
}

// Run every 5 minutes
setInterval(checkForOverlaps, 5 * 60 * 1000);
```

### C. Performance Metrics

```javascript
// Track booking performance
const bookingHistogram = new Histogram({
  name: "booking_duration_seconds",
  help: "Appointment booking duration",
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5],
});

async function bookAppointment(data) {
  const start = Date.now();

  try {
    const result = await bookAppointmentImpl(data);
    bookingHistogram.observe((Date.now() - start) / 1000);
    return result;
  } catch (error) {
    bookingErrorCounter.inc({ error: error.code });
    throw error;
  }
}
```

### D. Database Health Checks

```javascript
// Health check endpoint
app.get("/health/database", async (req, res) => {
  try {
    // Check connection
    await mongoose.connection.db.admin().ping();

    // Check replica set status
    const status = await mongoose.connection.db.admin().command({
      replSetGetStatus: 1,
    });

    // Check indexes exist
    const indexes = await Appointment.collection.indexes();
    const hasOverlapIndex = indexes.some(
      (idx) => idx.key.doctorId && idx.key.status && idx.key.start,
    );

    if (!hasOverlapIndex) {
      return res.status(500).json({
        status: "unhealthy",
        error: "Critical index missing",
      });
    }

    res.json({
      status: "healthy",
      replicaSet: status.set,
      primary: status.members.find((m) => m.stateStr === "PRIMARY")?.name,
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});
```

### E. Audit Trail

```javascript
// Log all booking attempts
logger.info("Booking attempt", {
  correlationId,
  doctorId,
  patientId,
  start,
  end,
  timestamp: new Date().toISOString()
});

// Log all conflicts
if (overlap) {
  logger.warn("Booking conflict", {
    correlationId,
    requestedSlot: { start, end },
    conflictingAppointment: overlap._id,
    timestamp: new Date().toISOString()
  });
}

// Query audit trail
grep "Booking conflict" logs/combined.log | wc -l
```

---

## 5. Incident Response Playbook

### Step 1: Detect

```bash
# Run overlap detection query
mongo appointments --eval "db.appointments.aggregate([...])"
```

### Step 2: Assess Impact

```bash
# Count affected appointments
# Identify affected doctors/patients
# Determine time range
```

### Step 3: Immediate Mitigation

```javascript
// Cancel one of the overlapping appointments
await Appointment.findByIdAndUpdate(duplicateId, {
  status: "CANCELLED",
  cancellationReason: "System error - overlapping booking",
});

// Notify affected patient
await notifyPatient(
  patientId,
  "We apologize, but your appointment was cancelled due to a system error...",
);
```

### Step 4: Root Cause Analysis

```bash
# Check logs around incident time
grep "$correlationId" logs/combined.log

# Review MongoDB logs
docker logs appointment-db | grep "$timestamp"

# Check transaction status
```

### Step 5: Prevention

```bash
# Deploy fix
# Add monitoring
# Update runbook
# Conduct post-mortem
```

---

## 6. Preventive Measures Summary

✅ **Use MongoDB transactions** for atomic check-and-create  
✅ **Run MongoDB in replica set mode** (required for transactions)  
✅ **Pass session to ALL queries** within transaction  
✅ **Add compound indexes** for overlap detection  
✅ **Store times in UTC** consistently  
✅ **Implement concurrent booking tests** in CI/CD  
✅ **Monitor for overlaps** with automated checks  
✅ **Track performance metrics** for early warning  
✅ **Maintain audit logs** for investigation  
✅ **Have incident response plan** ready

---

## Additional Resources

- [MongoDB Transactions Documentation](https://docs.mongodb.com/manual/core/transactions/)
- [Mongoose Transactions](https://mongoosejs.com/docs/transactions.html)
- [Replica Set Configuration](https://docs.mongodb.com/manual/replication/)
- [Query Performance](https://docs.mongodb.com/manual/tutorial/analyze-query-plan/)
