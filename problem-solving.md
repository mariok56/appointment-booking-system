# Problem-Solving Documentation

## 1. Overlap Detection

**Question:** How do you detect overlaps correctly? Provide examples of edge cases.

**Answer:**

### The Classic Overlap Algorithm

Two time intervals `[A_start, A_end]` and `[B_start, B_end]` overlap if and only if:

```
A_start < B_end AND B_start < A_end
```

This single condition catches ALL overlap scenarios.

### Visual Representation

```
Case 1: Partial Overlap (start)
Existing:  |---------|
New:            |---------|
           ✓ Overlaps

Case 2: Partial Overlap (end)
Existing:       |---------|
New:        |---------|
           ✓ Overlaps

Case 3: Complete Containment (new inside existing)
Existing:  |---------------|
New:           |-----|
           ✓ Overlaps

Case 4: Complete Containment (existing inside new)
Existing:      |-----|
New:        |-----------|
           ✓ Overlaps

Case 5: Exact Match
Existing:  |---------|
New:       |---------|
           ✓ Overlaps

Case 6: Adjacent (No Overlap)
Existing:  |-----|
New:             |-----|
           ✗ No overlap (end === start is allowed)

Case 7: Separated (No Overlap)
Existing:  |-----|
New:                  |-----|
           ✗ No overlap
```

### MongoDB Query

```javascript
// Find any overlapping BOOKED appointment
const overlap = await Appointment.findOne({
  doctorId: doctorId,
  status: "BOOKED",
  start: { $lt: newEnd }, // Existing starts before new ends
  end: { $gt: newStart }, // Existing ends after new starts
});
```

### Edge Cases to Handle

#### Edge Case 1: Exact Boundaries (Back-to-Back Appointments)

```javascript
// Existing: 09:00 - 09:30
// New:      09:30 - 10:00
// Should this overlap? NO (in our system)

// Current algorithm:
start (09:30) < end (09:30) = false
end (10:00) > start (09:00) = true
Result: false && true = false ✓ Correct (no overlap)

// Design decision: Allow back-to-back bookings
// Patients can arrive at 09:30 for their appointment
```

**However**, some clinics might want a buffer:

```javascript
// Add 5-minute buffer
const bufferMinutes = 5;
const bufferedStart = new Date(newStart.getTime() - bufferMinutes * 60000);
const bufferedEnd = new Date(newEnd.getTime() + bufferMinutes * 60000);

// Check with buffer
const overlap = await Appointment.findOne({
  doctorId: doctorId,
  status: "BOOKED",
  start: { $lt: bufferedEnd },
  end: { $gt: bufferedStart },
});
```

#### Edge Case 2: Midnight Crossing (Multi-Day Validation)

```javascript
// Invalid: Appointment crosses midnight
// Start: 2024-01-25 23:00
// End:   2024-01-26 01:00

// Validation:
if (start.toDateString() !== end.toDateString()) {
  throw new Error("Appointments must be within the same day");
}
```

#### Edge Case 3: Timezone Consistency

```javascript
// All dates must be in the same timezone
// Store in UTC, display in local time

// BAD:
start: "2024-01-25T09:00:00+05:00"; // Lebanon time
end: "2024-01-25T09:30:00-05:00"; // EST (different TZ!)

// GOOD:
start: "2024-01-25T07:00:00Z"; // UTC
end: "2024-01-25T07:30:00Z"; // UTC
```

#### Edge Case 4: Zero-Duration Appointments

```javascript
// Invalid: Start === End
// Start: 2024-01-25 09:00
// End:   2024-01-25 09:00

// Validation:
if (start >= end) {
  throw new Error("End time must be after start time");
}

// Minimum duration check (optional):
const minDuration = 15; // minutes
const durationMs = end.getTime() - start.getTime();
const durationMinutes = durationMs / (60 * 1000);

if (durationMinutes < minDuration) {
  throw new Error(`Appointments must be at least ${minDuration} minutes`);
}
```

#### Edge Case 5: Leap Seconds and DST

```javascript
// Daylight Saving Time transitions can cause issues

// Example: DST spring forward (2 AM -> 3 AM)
// Appointment: 2024-03-10 02:30 - 03:30 (this time doesn't exist!)

// Solution: Use UTC internally, convert to local for display
const startUTC = new Date(startLocal).toISOString();

// Alternative: Use moment-timezone or date-fns-tz
const { zonedTimeToUtc } = require("date-fns-tz");
const startUTC = zonedTimeToUtc(startLocal, "America/New_York");
```

#### Edge Case 6: Cancelled Appointments

```javascript
// CRITICAL: Only check against BOOKED appointments
// Don't block slots that have CANCELLED appointments

const overlap = await Appointment.findOne({
  doctorId: doctorId,
  status: "BOOKED", // ← CRITICAL: Only BOOKED status
  start: { $lt: newEnd },
  end: { $gt: newStart },
});

// Without this filter, cancelled appointments would
// permanently block time slots
```

#### Edge Case 7: Floating Point Precision

```javascript
// JavaScript Date precision issues

const start = new Date("2024-01-25T09:00:00.000Z");
const end = new Date(start.getTime() + 30 * 60 * 1000); // +30 min

// Safe: Uses milliseconds (integers)
// Risky: Using floating point for time calculations

// BAD:
const hours = 0.5; // 30 minutes
const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
// 0.5 * 60 * 60 * 1000 = 1800000.0000000002 (floating point error)

// GOOD:
const minutes = 30;
const end = new Date(start.getTime() + minutes * 60 * 1000);
// 30 * 60 * 1000 = 1800000 (exact integer)
```

### Comprehensive Overlap Detection Function

```javascript
function detectOverlap(slot1, slot2) {
  // Normalize to Date objects
  const s1_start = new Date(slot1.start);
  const s1_end = new Date(slot1.end);
  const s2_start = new Date(slot2.start);
  const s2_end = new Date(slot2.end);

  // Validate dates
  if (
    isNaN(s1_start.getTime()) ||
    isNaN(s1_end.getTime()) ||
    isNaN(s2_start.getTime()) ||
    isNaN(s2_end.getTime())
  ) {
    throw new Error("Invalid date in overlap detection");
  }

  // Classic overlap algorithm
  return s1_start < s2_end && s2_start < s1_end;
}

// Test cases
const tests = [
  {
    s1: { start: "2024-01-25T09:00:00Z", end: "2024-01-25T10:00:00Z" },
    s2: { start: "2024-01-25T09:30:00Z", end: "2024-01-25T10:30:00Z" },
    expected: true,
  }, // Partial overlap

  {
    s1: { start: "2024-01-25T09:00:00Z", end: "2024-01-25T10:00:00Z" },
    s2: { start: "2024-01-25T10:00:00Z", end: "2024-01-25T11:00:00Z" },
    expected: false,
  }, // Adjacent (no overlap)

  {
    s1: { start: "2024-01-25T09:00:00Z", end: "2024-01-25T12:00:00Z" },
    s2: { start: "2024-01-25T10:00:00Z", end: "2024-01-25T11:00:00Z" },
    expected: true,
  }, // Contained

  {
    s1: { start: "2024-01-25T09:00:00Z", end: "2024-01-25T10:00:00Z" },
    s2: { start: "2024-01-25T09:00:00Z", end: "2024-01-25T10:00:00Z" },
    expected: true,
  }, // Exact match
];

tests.forEach((test, i) => {
  const result = detectOverlap(test.s1, test.s2);
  console.log(`Test ${i + 1}: ${result === test.expected ? "PASS" : "FAIL"}`);
});
```

---

## 2. Race Condition Prevention

**Question:** How do you prevent race conditions in MongoDB for appointment booking?

**Answer:**

### The Problem: Check-Then-Act Race Condition

```
Time  | Request A                      | Request B
------|--------------------------------|---------------------------
T1    | Check overlap (none found)     |
T2    |                                | Check overlap (none found)
T3    | Insert appointment             |
T4    |                                | Insert appointment ❌ CONFLICT!
T5    | Both appointments exist with overlap!
```

### Solution 1: MongoDB Transactions (RECOMMENDED)

**Requirements:**

- MongoDB 4.0+
- Replica Set (transactions don't work on standalone)

```javascript
async function bookAppointment(data) {
  const session = await mongoose.startSession();

  try {
    // Start transaction
    session.startTransaction();

    // Step 1: Check for overlap WITH SESSION
    const overlap = await Appointment.findOne({
      doctorId: data.doctorId,
      status: "BOOKED",
      start: { $lt: data.end },
      end: { $gt: data.start },
    }).session(session); // ← CRITICAL: Use session

    if (overlap) {
      throw new AppointmentBookingError("Slot not available");
    }

    // Step 2: Insert appointment WITH SESSION
    const appointment = await Appointment.create(
      [
        {
          doctorId: data.doctorId,
          patientId: data.patientId,
          start: data.start,
          end: data.end,
          status: "BOOKED",
        },
      ],
      { session },
    ); // ← CRITICAL: Use session

    // Step 3: Commit (make permanent)
    await session.commitTransaction();

    return appointment[0];
  } catch (error) {
    // Rollback on any error
    await session.abortTransaction();
    throw error;
  } finally {
    // Always cleanup
    session.endSession();
  }
}
```

**How It Works:**

- **Isolation:** Transaction sees consistent snapshot of data
- **Atomicity:** Both operations succeed or both fail
- **Serialization:** MongoDB serializes conflicting transactions
- **Rollback:** Automatic cleanup on failure

**Transaction Isolation Levels:**

MongoDB uses snapshot isolation:

```javascript
session.startTransaction({
  readConcern: { level: "snapshot" }, // Read from snapshot
  writeConcern: { w: "majority" }, // Wait for majority write
  readPreference: "primary", // Read from primary
});
```

### Solution 2: Unique Compound Index (Alternative)

If transactions aren't available (standalone MongoDB), use a unique index:

```javascript
// Create unique index on time slots
AppointmentSchema.index(
  {
    doctorId: 1,
    start: 1,
    end: 1,
  },
  {
    unique: true,
    partialFilterExpression: { status: "BOOKED" },
  },
);
```

**Problem:** This only prevents EXACT duplicates, not overlaps:

```javascript
// These would both be allowed (different times, but overlapping):
{ doctorId: 1, start: 09:00, end: 10:00, status: 'BOOKED' }
{ doctorId: 1, start: 09:30, end: 10:30, status: 'BOOKED' }  // Different times!
```

**Solution:** Use `findOneAndUpdate` with precise timing:

```javascript
// This approach doesn't fully prevent overlaps
// Better to use transactions
```

### Solution 3: Optimistic Locking

Add version field to appointments:

```javascript
const AppointmentSchema = new Schema({
  // ... other fields
  __v: { type: Number, default: 0 }, // Version field
});

// Check version during update
const result = await Appointment.updateOne(
  {
    _id: appointmentId,
    __v: currentVersion, // Only update if version matches
  },
  {
    $set: { status: "CANCELLED" },
    $inc: { __v: 1 }, // Increment version
  },
);

if (result.modifiedCount === 0) {
  throw new Error("Appointment was modified by another request");
}
```

**Limitation:** Only works for updates, not for the initial booking check.

### Solution 4: Application-Level Locks (Redis/Memcached)

Use distributed locks:

```javascript
const Redlock = require("redlock");
const redlock = new Redlock([redisClient]);

async function bookAppointment(data) {
  const lockKey = `appointment:${data.doctorId}:${data.start}`;
  const lock = await redlock.lock(lockKey, 1000); // 1 second TTL

  try {
    // Check and insert while holding lock
    const overlap = await checkOverlap(data);
    if (overlap) throw new Error("Slot unavailable");

    const appointment = await Appointment.create(data);
    return appointment;
  } finally {
    await lock.unlock();
  }
}
```

**Pros:**

- Works with standalone MongoDB
- Can use across services

**Cons:**

- Added complexity (Redis dependency)
- Lock contention under high load
- Network latency

### Solution 5: Serialized Queue (BullMQ)

Process bookings sequentially per doctor:

```javascript
const bookingQueue = new Queue("bookings");

// Add job to queue
await bookingQueue.add("book", {
  doctorId,
  patientId,
  start,
  end,
});

// Worker processes one at a time per doctor
bookingQueue.process("book", async (job) => {
  const { doctorId, patientId, start, end } = job.data;

  // No race condition - sequential processing
  const overlap = await checkOverlap(doctorId, start, end);
  if (overlap) throw new Error("Slot unavailable");

  return await Appointment.create({ doctorId, patientId, start, end });
});
```

**Pros:**

- Simple, no transactions needed
- Built-in retry logic

**Cons:**

- Async (user doesn't get immediate response)
- Queue overhead

### Comparison Table

| Approach            | Race-Safe          | Complexity | Performance | Requirements |
| ------------------- | ------------------ | ---------- | ----------- | ------------ |
| **Transactions**    | ✅ Yes             | Medium     | Good        | Replica Set  |
| **Unique Index**    | ❌ No (only exact) | Low        | Excellent   | None         |
| **Optimistic Lock** | ⚠️ Partial         | Medium     | Good        | None         |
| **Redis Lock**      | ✅ Yes             | High       | Medium      | Redis        |
| **Queue**           | ✅ Yes             | High       | Slow        | Queue system |

### Recommended Approach: Transactions

For production appointment booking, use **MongoDB transactions**:

1. **Correctness:** Guaranteed race-condition safety
2. **Industry Standard:** ACID compliance
3. **Maintainability:** Logic is straightforward
4. **Performance:** ~2-5ms overhead is acceptable

```javascript
// Production-ready implementation
class AppointmentService {
  async bookAppointment(data) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(
        async () => {
          // All operations here are atomic
          await this.validateSlot(data, session);
          return await this.createAppointment(data, session);
        },
        {
          readPreference: "primary",
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority", j: true },
        },
      );
    } finally {
      session.endSession();
    }
  }
}
```

---

## 3. Multi-Location & Time Zones

**Question:** How would your approach change if the clinic had multiple locations and time zones?

**Answer:**

### Data Model Changes

```javascript
// 1. Add Location entity
const LocationSchema = new Schema({
  name: String,
  address: {
    street: String,
    city: String,
    country: String,
    postalCode: String,
  },
  timezone: String, // IANA timezone: 'America/New_York'
  coordinates: {
    lat: Number,
    lng: Number,
  },
  workingHours: {
    monday: { start: "09:00", end: "17:00" },
    tuesday: { start: "09:00", end: "17:00" },
    // ... other days
  },
});

// 2. Update Doctor to include locations
const DoctorSchema = new Schema({
  name: String,
  specialty: String,
  locations: [
    {
      locationId: { type: Schema.Types.ObjectId, ref: "Location" },
      workingHours: {
        // Can override location hours
        monday: { start: "10:00", end: "16:00" },
      },
    },
  ],
});

// 3. Update Appointment to include location
const AppointmentSchema = new Schema({
  doctorId: { type: Schema.Types.ObjectId, ref: "Doctor" },
  patientId: { type: Schema.Types.ObjectId, ref: "Patient" },
  locationId: { type: Schema.Types.ObjectId, ref: "Location" }, // NEW
  start: Date, // ALWAYS store in UTC
  end: Date, // ALWAYS store in UTC
  timezone: String, // Original booking timezone for reference
  status: String,
});
```

### Timezone Handling Strategy

**Rule: Store UTC, Display Local**

```javascript
import { zonedTimeToUtc, utcToZonedTime, format } from "date-fns-tz";

class TimezoneService {
  /**
   * Convert local time to UTC for storage
   */
  toUTC(localTime, timezone) {
    // localTime: '2024-01-25 09:00'
    // timezone: 'America/New_York'
    // Returns: Date in UTC
    return zonedTimeToUtc(localTime, timezone);
  }

  /**
   * Convert UTC to local time for display
   */
  toLocal(utcTime, timezone) {
    // utcTime: Date (UTC)
    // timezone: 'America/New_York'
    // Returns: Date in local timezone
    return utcToZonedTime(utcTime, timezone);
  }

  /**
   * Format for display
   */
  formatLocal(utcTime, timezone, formatString = "yyyy-MM-dd HH:mm zzz") {
    const localTime = this.toLocal(utcTime, timezone);
    return format(localTime, formatString, { timeZone: timezone });
  }
}

// Usage in booking
async function bookAppointment(data) {
  const location = await Location.findById(data.locationId);
  const timezone = location.timezone;

  // Convert local time to UTC
  const startUTC = timezoneService.toUTC(data.startLocal, timezone);
  const endUTC = timezoneService.toUTC(data.endLocal, timezone);

  // Store in UTC
  const appointment = await Appointment.create({
    doctorId: data.doctorId,
    patientId: data.patientId,
    locationId: data.locationId,
    start: startUTC,
    end: endUTC,
    timezone: timezone, // Store original timezone for reference
    status: "BOOKED",
  });

  return appointment;
}
```

### Availability Calculation with Timezones

```javascript
async function getAvailableSlots(doctorId, locationId, date) {
  // Get location to determine timezone and working hours
  const location = await Location.findById(locationId);
  const timezone = location.timezone;

  // Parse date in location's timezone
  const startOfDay = zonedTimeToUtc(`${date} 00:00:00`, timezone);
  const endOfDay = zonedTimeToUtc(`${date} 23:59:59`, timezone);

  // Get working hours for this location
  const dayOfWeek = format(startOfDay, "EEEE", {
    timeZone: timezone,
  }).toLowerCase();
  const workingHours = location.workingHours[dayOfWeek];

  if (!workingHours) {
    return []; // Location closed this day
  }

  // Convert working hours to UTC
  const clinicStart = zonedTimeToUtc(`${date} ${workingHours.start}`, timezone);
  const clinicEnd = zonedTimeToUtc(`${date} ${workingHours.end}`, timezone);

  // Fetch booked appointments (stored in UTC)
  const bookedAppointments = await Appointment.find({
    doctorId,
    locationId,
    status: "BOOKED",
    start: { $gte: startOfDay, $lt: endOfDay },
  });

  // Generate slots (in UTC)
  const allSlots = generateSlots(clinicStart, clinicEnd, 30);

  // Filter out booked slots
  const availableSlots = allSlots.filter((slot) => {
    return !bookedAppointments.some(
      (apt) => slot.start < apt.end && apt.start < slot.end,
    );
  });

  // Convert back to local time for display
  return availableSlots.map((slot) => ({
    start: timezoneService.formatLocal(slot.start, timezone),
    end: timezoneService.formatLocal(slot.end, timezone),
    startUTC: slot.start,
    endUTC: slot.end,
  }));
}
```

### Updated Overlap Detection

```javascript
// Overlap detection query now includes locationId
async function checkOverlap(doctorId, locationId, start, end, session) {
  return await Appointment.findOne({
    doctorId,
    locationId, // Same doctor can be at different locations
    status: "BOOKED",
    start: { $lt: end },
    end: { $gt: start },
  }).session(session);
}
```

### Index Updates

```javascript
// Update compound index to include location
AppointmentSchema.index({
  doctorId: 1,
  locationId: 1, // NEW
  status: 1,
  start: 1,
  end: 1,
});

// Index for location-based queries
AppointmentSchema.index({
  locationId: 1,
  start: 1,
});
```

### API Changes

```javascript
// New endpoint parameters include locationId
POST /api/appointments
{
  "doctorId": "...",
  "patientId": "...",
  "locationId": "...",      // NEW: Required
  "startLocal": "2024-01-25 09:00",  // In location's timezone
  "endLocal": "2024-01-25 09:30",
  "timezone": "America/New_York"  // Client's timezone for confirmation
}

GET /api/availability?doctorId=xxx&locationId=yyy&date=2024-01-25
// Returns slots in location's local time

GET /api/doctors/:id/locations
// List all locations where doctor works
```

### DST Handling

```javascript
// Handle Daylight Saving Time transitions

function validateAppointmentTime(localTime, timezone) {
  try {
    // This will throw if time doesn't exist (DST spring forward)
    const utc = zonedTimeToUtc(localTime, timezone);

    // Check if time is ambiguous (DST fall back)
    // e.g., 1:30 AM occurs twice during fall back
    const backToLocal = utcToZonedTime(utc, timezone);

    if (format(backToLocal, "yyyy-MM-dd HH:mm") !== localTime) {
      throw new Error("Ambiguous time during DST transition");
    }

    return utc;
  } catch (error) {
    throw new Error(`Invalid time in timezone ${timezone}: ${error.message}`);
  }
}
```

### Patient Experience Considerations

```javascript
// When patient books, show their local time AND location time

{
  "appointment": {
    "yourTime": "2024-01-25 10:00 AM EST",      // Patient's timezone
    "clinicTime": "2024-01-25 09:00 AM CST",    // Clinic's timezone
    "location": {
      "name": "Downtown Clinic",
      "address": "123 Main St, Chicago, IL",
      "timezone": "America/Chicago"
    }
  },
  "reminder": "This appointment is at 9:00 AM Chicago time (10:00 AM your time)"
}
```

### Reminder System Updates

```javascript
// Send reminders in patient's preferred timezone

async function sendReminder(appointmentId) {
  const appointment = await Appointment.findById(appointmentId)
    .populate("locationId")
    .populate("patientId");

  const patient = appointment.patientId;
  const location = appointment.locationId;

  // Get patient's timezone (from profile or registration)
  const patientTimezone = patient.timezone || location.timezone;

  // Format in patient's timezone
  const appointmentTime = timezoneService.formatLocal(
    appointment.start,
    patientTimezone,
    "EEEE, MMMM do, yyyy [at] h:mm a zzz",
  );

  await sendEmail(patient.email, {
    subject: "Appointment Reminder",
    body: `Your appointment is ${appointmentTime}`,
  });
}
```

### Testing Multi-Timezone Logic

```javascript
describe("Multi-timezone booking", () => {
  it("should handle booking across timezones", async () => {
    // Chicago clinic (CST: UTC-6)
    const location = await Location.create({
      name: "Chicago Clinic",
      timezone: "America/Chicago",
    });

    // Patient in New York (EST: UTC-5)
    // Books for "9:00 AM Chicago time"
    const startLocal = "2024-01-25 09:00";
    const startUTC = zonedTimeToUtc(startLocal, "America/Chicago");
    // Result: 2024-01-25T15:00:00Z (3 PM UTC)

    const appointment = await bookAppointment({
      locationId: location._id,
      startLocal: startLocal,
      timezone: "America/Chicago",
    });

    // Verify stored in UTC
    expect(appointment.start.toISOString()).toBe("2024-01-25T15:00:00.000Z");

    // Display in patient's timezone (EST)
    const displayTime = timezoneService.formatLocal(
      appointment.start,
      "America/New_York",
    );
    // Shows: "2024-01-25 10:00 AM EST"
  });
});
```

### Key Principles

1. **Always store in UTC** - Single source of truth
2. **Display in user's timezone** - Better UX
3. **Include location in overlap checks** - Same doctor, different location is OK
4. **Validate DST transitions** - Prevent booking non-existent times
5. **Store original timezone** - For audit and reference
6. **Test edge cases** - DST, midnight crossing, international dateline

---

## 4. Security Considerations

**Question:** What are potential security risks in an appointment system? (Consider data privacy, authorization, injection attacks)

**Answer:**

### 1. Authentication & Authorization Risks

#### Risk: Unauthorized Access

```javascript
// BAD: No authentication
app.post("/api/appointments", bookAppointment);

// GOOD: Require authentication
app.post(
  "/api/appointments",
  authenticateJWT, // Verify user is logged in
  authorizePatient, // Verify user can book for this patient
  validateInput,
  bookAppointment,
);
```

#### Risk: Horizontal Privilege Escalation

```javascript
// Patient A tries to book appointment for Patient B

// BAD: Trust user input
app.post("/api/appointments", async (req, res) => {
  const { patientId } = req.body; // Could be anyone!
  // No verification that req.user.id === patientId
});

// GOOD: Verify ownership
app.post("/api/appointments", async (req, res) => {
  const { patientId } = req.body;

  // Verify user can book for this patient
  if (req.user.role !== "admin" && req.user.patientId !== patientId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Proceed...
});
```

#### Risk: Insecure Direct Object References (IDOR)

```javascript
// BAD: Anyone can cancel any appointment
app.post("/api/appointments/:id/cancel", async (req, res) => {
  await Appointment.findByIdAndUpdate(req.params.id, {
    status: "CANCELLED",
  });
});

// GOOD: Verify ownership
app.post("/api/appointments/:id/cancel", async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: "Not found" });
  }

  // Check if user owns this appointment
  if (
    req.user.role !== "admin" &&
    !appointment.patientId.equals(req.user.patientId)
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  appointment.status = "CANCELLED";
  await appointment.save();
});
```

### 2. Data Privacy Risks (HIPAA/GDPR)

#### Risk: PII Exposure in Logs

```javascript
// BAD: Logging sensitive data
logger.info("Booking appointment", {
  patientName: "John Doe",
  patientEmail: "john@example.com",
  reason: "HIV test", // ← HIPAA violation!
  ssn: "123-45-6789", // ← Major violation!
});

// GOOD: Log only IDs, redact sensitive data
logger.info("Booking appointment", {
  patientId: "abc123", // ID only, no PII
  doctorId: "def456",
  appointmentId: "ghi789",
  correlationId: "xyz",
});
```

#### Risk: Exposing PII in API Responses

```javascript
// BAD: Return all patient data
{
  "appointment": {
    "patient": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1-555-0101",
      "ssn": "123-45-6789",      // ← Should NEVER be in API
      "diagnosis": "Depression"   // ← HIPAA protected
    }
  }
}

// GOOD: Return minimal necessary data
{
  "appointment": {
    "patientId": "abc123",
    "patientName": "John D.",  // Partial name for confirmation
    "appointmentId": "xyz789"
  }
}
```

#### Risk: Data Breach via MongoDB Injection

```javascript
// BAD: Direct string concatenation
const doctorId = req.query.doctorId; // Could be: {"$ne": null}
const appointments = await Appointment.find({
  doctorId: doctorId, // Returns ALL appointments!
});

// GOOD: Validate and sanitize
const doctorIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const { error, value } = doctorIdSchema.validate(req.query.doctorId);

if (error) {
  return res.status(400).json({ error: "Invalid doctor ID" });
}

const appointments = await Appointment.find({
  doctorId: new mongoose.Types.ObjectId(value), // Type-safe
});
```

### 3. Injection Attacks

#### Risk: NoSQL Injection

```javascript
// Attacker sends:
// POST /api/appointments?doctorId[$ne]=null

// BAD: Vulnerable to NoSQL injection
app.get("/api/appointments", async (req, res) => {
  const appointments = await Appointment.find(req.query);
  // req.query could be: { doctorId: { $ne: null } }
  // This returns ALL appointments!
});

// GOOD: Whitelist allowed fields
app.get("/api/appointments", async (req, res) => {
  const allowedFields = ["doctorId", "date"];
  const query = {};

  allowedFields.forEach((field) => {
    if (req.query[field]) {
      // Validate each field
      query[field] = sanitize(req.query[field]);
    }
  });

  const appointments = await Appointment.find(query);
});
```

#### Risk: Command Injection via Appointment Reason

```javascript
// BAD: Storing unsanitized user input
const reason = req.body.reason; // Could contain scripts
await Appointment.create({ reason });

// Later retrieved and displayed without escaping
<div>{appointment.reason}</div>; // XSS vulnerability!

// GOOD: Sanitize and validate
const reasonSchema = Joi.string()
  .max(500)
  .pattern(/^[a-zA-Z0-9\s\.\,\-]*$/);
const { value: reason } = reasonSchema.validate(req.body.reason);

// In frontend, always escape
<div>{escapeHtml(appointment.reason)}</div>;
```

### 4. Rate Limiting & DoS Prevention

#### Risk: Resource Exhaustion

```javascript
// Attacker floods with booking requests

// GOOD: Rate limiting
const rateLimit = require("express-rate-limit");

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 booking attempts per 15 min
  message: "Too many booking attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Rate limit per IP + user
  keyGenerator: (req) => `${req.ip}-${req.user?.id || "anonymous"}`,
});

app.post("/api/appointments", bookingLimiter, bookAppointment);
```

#### Risk: Slot Enumeration Attack

```javascript
// Attacker rapidly checks all slots to map doctor schedules

// GOOD: Rate limit availability checks
const availabilityLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 checks per minute
  skipSuccessfulRequests: false,
});

app.get("/api/availability", availabilityLimiter, getAvailability);
```

### 5. Audit Trails & Compliance

#### Risk: No Audit Trail

```javascript
// HIPAA requires tracking who accessed what

// GOOD: Comprehensive audit logging
const AuditLogSchema = new Schema({
  userId: Schema.Types.ObjectId,
  action: String, // 'VIEW', 'CREATE', 'UPDATE', 'DELETE'
  resource: String, // 'APPOINTMENT'
  resourceId: Schema.Types.ObjectId,
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now },
  changes: Schema.Types.Mixed, // What changed
});

// Log all access
async function logAudit(req, action, resource, resourceId, changes = null) {
  await AuditLog.create({
    userId: req.user?.id,
    action,
    resource,
    resourceId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    changes,
  });
}

// Usage
app.get("/api/appointments/:id", async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  // Log access
  await logAudit(req, "VIEW", "APPOINTMENT", appointment._id);

  res.json(appointment);
});
```

### 6. Session & Token Security

#### Risk: Session Hijacking

```javascript
// GOOD: Secure session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Strong random secret
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Prevent XSS access
      secure: true, // HTTPS only
      sameSite: "strict", // CSRF protection
      maxAge: 1800000, // 30 minutes
    },
  }),
);
```

#### Risk: JWT Token Exposure

```javascript
// BAD: JWT in localStorage (vulnerable to XSS)
localStorage.setItem("token", jwt);

// GOOD: HTTP-only cookie
res.cookie("authToken", jwt, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 3600000, // 1 hour
});
```

### 7. Database Security

#### Risk: Exposed Database

```javascript
// GOOD: Database security checklist

// 1. Use connection string from env
const mongoUri = process.env.MONGODB_URI;  // Never hardcode

// 2. Enable authentication
// mongodb://username:password@host:port/database

// 3. Use TLS/SSL
const mongoose.connect(mongoUri, {
  ssl: true,
  sslValidate: true
});

// 4. Principle of least privilege
// Create separate DB users:
// - read-only for reporting
// - write for application
// - admin for migrations only

// 5. Network isolation
// Firewall rules: only allow connections from app servers
```

### 8. Encryption

#### Risk: Data at Rest Not Encrypted

```javascript
// GOOD: Encrypt sensitive fields

const PatientSchema = new Schema({
  name: String,
  email: String,

  // Encrypt SSN at application level
  ssn: {
    type: String,
    get: (value) => decrypt(value),
    set: (value) => encrypt(value),
  },
});

function encrypt(text) {
  const crypto = require("crypto");
  const algorithm = "aes-256-gcm";
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encrypted: encrypted.toString("hex"),
  });
}
```

### 9. Input Validation Comprehensive

```javascript
// Validation middleware for ALL inputs

const validateAppointmentBooking = (req, res, next) => {
  const schema = Joi.object({
    doctorId: Joi.string()
      .required()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .messages({
        "string.pattern.base": "Invalid doctor ID format",
      }),

    patientId: Joi.string()
      .required()
      .pattern(/^[0-9a-fA-F]{24}$/),

    start: Joi.date()
      .required()
      .greater("now") // Must be in future
      .messages({
        "date.greater": "Appointment must be in the future",
      }),

    end: Joi.date()
      .required()
      .greater(Joi.ref("start")) // Must be after start
      .messages({
        "date.greater": "End time must be after start time",
      }),

    reason: Joi.string()
      .max(500)
      .pattern(/^[a-zA-Z0-9\s\.\,\-']*$/) // Prevent scripts
      .optional()
      .messages({
        "string.max": "Reason cannot exceed 500 characters",
        "string.pattern.base": "Reason contains invalid characters",
      }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.details.map((d) => d.message),
    });
  }

  next();
};
```

### 10. Security Headers

```javascript
// GOOD: Security headers middleware
const helmet = require("helmet");

app.use(helmet()); // Adds multiple security headers

// Explicit configuration:
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Minimize 'unsafe-inline'
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  }),
);

app.use(
  helmet.hsts({
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  }),
);
```

### Security Checklist

✅ **Authentication:**

- [ ] JWT/session tokens
- [ ] HTTP-only cookies
- [ ] Token expiration
- [ ] Refresh token rotation

✅ **Authorization:**

- [ ] Role-based access control (RBAC)
- [ ] Resource ownership validation
- [ ] Principle of least privilege

✅ **Data Protection:**

- [ ] Encrypt sensitive data at rest
- [ ] Use HTTPS/TLS in transit
- [ ] Redact PII from logs
- [ ] Minimize data exposure in APIs

✅ **Injection Prevention:**

- [ ] Input validation (Joi)
- [ ] Parameterized queries
- [ ] NoSQL injection prevention
- [ ] XSS prevention

✅ **Rate Limiting:**

- [ ] Per-endpoint limits
- [ ] Per-user limits
- [ ] CAPTCHA for sensitive actions

✅ **Audit & Compliance:**

- [ ] Comprehensive audit logs
- [ ] GDPR compliance (data export/deletion)
- [ ] HIPAA compliance (if healthcare)
- [ ] Regular security audits

✅ **Infrastructure:**

- [ ] Database authentication
- [ ] Network isolation
- [ ] Firewall rules
- [ ] Regular security patches

---

## 5. Slot Generation Trade-offs

**Question:** Should appointment slots be pre-generated in the database or calculated on-demand?

**Answer:**

### Approach 1: Calculate On-Demand (RECOMMENDED for this system)

**How It Works:**

```javascript
async function getAvailableSlots(doctorId, date, slotMinutes = 30) {
  // 1. Get working hours for the day
  const startOfDay = new Date(date);
  startOfDay.setHours(9, 0, 0, 0); // 9 AM

  const endOfDay = new Date(date);
  endOfDay.setHours(17, 0, 0, 0); // 5 PM

  // 2. Generate all possible slots
  const allSlots = [];
  let current = new Date(startOfDay);

  while (current < endOfDay) {
    const slotEnd = new Date(current.getTime() + slotMinutes * 60000);
    if (slotEnd <= endOfDay) {
      allSlots.push({
        start: new Date(current),
        end: slotEnd,
      });
    }
    current = slotEnd;
  }

  // 3. Fetch booked appointments
  const booked = await Appointment.find({
    doctorId,
    status: "BOOKED",
    start: { $gte: startOfDay, $lt: endOfDay },
  })
    .select("start end")
    .lean();

  // 4. Filter out booked slots
  const available = allSlots.filter((slot) => {
    return !booked.some((apt) => slot.start < apt.end && apt.start < slot.end);
  });

  return available;
}
```

**Pros:**

- ✅ **Flexible:** Easy to change slot duration (15min, 30min, 60min)
- ✅ **No storage overhead:** No need to store millions of slots
- ✅ **Always up-to-date:** Reflects current bookings instantly
- ✅ **Simple logic:** Straightforward to understand and maintain
- ✅ **Easy testing:** Pure function, easy to unit test
- ✅ **No cleanup:** No need to delete old slots
- ✅ **Multi-tenant friendly:** Works for any doctor/location

**Cons:**

- ❌ **Computation cost:** Recalculated on every request
- ❌ **Potential slow query:** If many appointments (mitigated by indexing)
- ❌ **Limited querying:** Can't easily query "all available slots across all doctors"

**Performance:**

- Typical: 10-50ms for 100 appointments/day
- With proper indexes: < 300ms even with 500+ appointments/day

**When to Use:**

- **Small to medium clinics** (< 100 doctors)
- **Moderate booking volume** (< 1000 bookings/day)
- **Flexible requirements** (slot duration changes)
- **Simple working hours** (same hours every day)

---

### Approach 2: Pre-Generate Slots in Database

**How It Works:**

```javascript
const SlotSchema = new Schema({
  doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", index: true },
  locationId: { type: Schema.Types.ObjectId, ref: "Location" },
  start: { type: Date, index: true },
  end: Date,
  status: {
    type: String,
    enum: ["AVAILABLE", "BOOKED", "BLOCKED"],
    default: "AVAILABLE",
    index: true,
  },
  appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
});

// Pre-generate slots for next 90 days
async function generateSlotsForDoctor(doctorId, startDate, endDate) {
  const slots = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    // Skip weekends
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      // Generate slots for this day (9 AM - 5 PM)
      for (let hour = 9; hour < 17; hour++) {
        for (let minute of [0, 30]) {
          const start = new Date(current);
          start.setHours(hour, minute, 0, 0);

          const end = new Date(start);
          end.setMinutes(end.getMinutes() + 30);

          slots.push({
            doctorId,
            start,
            end,
            status: "AVAILABLE",
          });
        }
      }
    }

    // Next day
    current.setDate(current.getDate() + 1);
  }

  await Slot.insertMany(slots);
}

// Booking updates slot
async function bookAppointment(slotId, appointmentData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Mark slot as booked
    const slot = await Slot.findOneAndUpdate(
      { _id: slotId, status: "AVAILABLE" },
      {
        status: "BOOKED",
        appointmentId: appointmentId,
      },
      { session, new: true },
    );

    if (!slot) {
      throw new Error("Slot not available");
    }

    // Create appointment
    const appointment = await Appointment.create([appointmentData], {
      session,
    });

    await session.commitTransaction();
    return { slot, appointment };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Get available slots (just a query!)
async function getAvailableSlots(doctorId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return await Slot.find({
    doctorId,
    status: "AVAILABLE",
    start: { $gte: startOfDay, $lte: endOfDay },
  }).sort({ start: 1 });
}
```

**Pros:**

- ✅ **Fast queries:** Simple SELECT, no computation
- ✅ **Easy filtering:** Can query across multiple doctors
- ✅ **Atomic booking:** Update slot status in single operation
- ✅ **Complex availability:** Support blocked times, holidays easily
- ✅ **Scalable queries:** "Show all available slots this week across all doctors"
- ✅ **Cached results:** Can cache entire day's availability

**Cons:**

- ❌ **Storage overhead:** Millions of slots (100 doctors × 16 slots/day × 365 days = 584,000 slots/year)
- ❌ **Cleanup required:** Delete old slots, generate new ones
- ❌ **Less flexible:** Changing slot duration requires regeneration
- ❌ **Complexity:** More moving parts (generation job, cleanup)
- ❌ **Initial setup:** Must pre-generate before bookings
- ❌ **Maintenance:** Cron job to generate future slots

**When to Use:**

- **Large clinics** (> 100 doctors)
- **High booking volume** (> 10,000 bookings/day)
- **Complex availability rules** (holidays, blocked times, varying hours)
- **Cross-doctor queries needed** ("Find any available slot this week")
- **Mobile apps** (better offline support with cached slots)

---

### Hybrid Approach (Best of Both)

**How It Works:**

```javascript
// Pre-generate slots for popular doctors/times
// Calculate on-demand for others

async function getAvailableSlots(doctorId, date) {
  // Check if this doctor has pre-generated slots
  const hasPreGenerated = await Slot.exists({
    doctorId,
    start: { $gte: date },
  });

  if (hasPreGenerated) {
    // Use pre-generated slots (fast path)
    return await Slot.find({
      doctorId,
      status: "AVAILABLE",
      start: {
        $gte: date,
        $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
      },
    });
  } else {
    // Calculate on-demand (slow path)
    return await calculateSlotsOnDemand(doctorId, date);
  }
}
```

**When to Use:**

- Mixed workload (some busy doctors, some not)
- Want performance for VIP doctors
- Gradual migration from on-demand to pre-generated

---

### Comparison Table

| Factor            | On-Demand     | Pre-Generated      | Hybrid           |
| ----------------- | ------------- | ------------------ | ---------------- |
| **Query Speed**   | Medium (50ms) | Fast (5ms)         | Fast/Medium      |
| **Storage**       | None          | High (millions)    | Medium           |
| **Flexibility**   | High          | Low                | High             |
| **Complexity**    | Low           | High               | Medium           |
| **Scalability**   | Good          | Excellent          | Excellent        |
| **Maintenance**   | None          | High (cron jobs)   | Medium           |
| **Initial Setup** | None          | Generate all slots | Generate popular |

---

### Recommendation for This System

**Use On-Demand Calculation**

**Reasons:**

1. **Small scale:** < 100 doctors, moderate volume
2. **Simplicity:** Easier to implement and maintain
3. **Flexibility:** Requirements may change
4. **No overhead:** No storage, no cleanup jobs
5. **Performance is adequate:** With proper indexing, < 300ms is fine

**Optimization Strategy:**

```javascript
// Add compound index for fast queries
AppointmentSchema.index({
  doctorId: 1,
  status: 1,
  start: 1,
});

// Use lean() for better performance
const booked = await Appointment.find({ doctorId, status: "BOOKED" })
  .select("start end")
  .lean();

// Cache results for 5 minutes (optional)
const cacheKey = `slots:${doctorId}:${date}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const slots = await calculateSlots(doctorId, date);
await redis.setex(cacheKey, 300, JSON.stringify(slots)); // 5 min TTL

return slots;
```

**When to Switch to Pre-Generated:**

- Volume exceeds 1000 bookings/day
- Query performance degrades (> 1 second)
- Need cross-doctor availability searches
- Mobile app requires offline slot viewing

---

## 6. MongoDB findOneAndUpdate with arrayFilters

**Question:** Research and explain how to use MongoDB findOneAndUpdate with arrayFilters to implement a waiting list feature.

**Answer:**

### Use Case: Waiting List Feature

When a time slot is fully booked, patients can join a waiting list. If someone cancels, automatically book the next person on the waiting list.

### Data Model

```javascript
const AppointmentSchema = new Schema({
  doctorId: Schema.Types.ObjectId,
  patientId: Schema.Types.ObjectId, // Currently booked patient
  start: Date,
  end: Date,
  status: {
    type: String,
    enum: ["BOOKED", "CANCELLED", "COMPLETED"],
  },

  // NEW: Waiting list as array
  waitingList: [
    {
      patientId: { type: Schema.Types.ObjectId, ref: "Patient" },
      joinedAt: { type: Date, default: Date.now },
      notified: { type: Boolean, default: false },
      priority: { type: Number, default: 0 }, // For sorting
    },
  ],
});
```

### Basic arrayFilters Example

```javascript
// Update specific item in waitingList array

await Appointment.findOneAndUpdate(
  {
    // Match the appointment
    _id: appointmentId,
  },
  {
    // Update operation
    $set: {
      "waitingList.$[element].notified": true,
    },
  },
  {
    // arrayFilters: specify which array elements to update
    arrayFilters: [
      { "element.patientId": patientId }, // Update only this patient
    ],
    new: true,
  },
);
```

**Explanation:**

- `$[element]` is a placeholder for array items that match the filter
- `arrayFilters: [{ 'element.patientId': patientId }]` specifies the condition
- Only array items where `patientId` matches will be updated

### Joining the Waiting List

```javascript
async function joinWaitingList(appointmentId, patientId) {
  // Add patient to waiting list if not already there
  const result = await Appointment.findOneAndUpdate(
    {
      _id: appointmentId,
      status: "BOOKED", // Only for booked appointments
      "waitingList.patientId": { $ne: patientId }, // Not already in list
    },
    {
      $push: {
        waitingList: {
          patientId,
          joinedAt: new Date(),
          notified: false,
          priority: 0,
        },
      },
    },
    {
      new: true,
    },
  );

  if (!result) {
    throw new Error("Already in waiting list or appointment not found");
  }

  return result;
}
```

### Auto-Booking from Waiting List

```javascript
async function cancelAndAutoBook(appointmentId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Get the appointment with waiting list
    const appointment =
      await Appointment.findById(appointmentId).session(session);

    if (!appointment || appointment.waitingList.length === 0) {
      // No one waiting, just cancel
      appointment.status = "CANCELLED";
      await appointment.save({ session });
      await session.commitTransaction();
      return { cancelled: true, autoBooked: false };
    }

    // Step 2: Get highest priority person from waiting list
    const sortedWaitingList = appointment.waitingList.sort((a, b) => {
      // Sort by priority (descending), then joinedAt (ascending)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const nextPatient = sortedWaitingList[0];

    // Step 3: Book for next patient and remove from waiting list
    const updated = await Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
      },
      {
        // Update patient and status
        $set: {
          patientId: nextPatient.patientId,
          status: "BOOKED",
        },
        // Remove this patient from waiting list
        $pull: {
          waitingList: { patientId: nextPatient.patientId },
        },
      },
      {
        session,
        new: true,
      },
    );

    // Step 4: Notify all waiting patients of their new position
    await Appointment.updateOne(
      { _id: appointmentId },
      {
        $set: {
          "waitingList.$[].notified": false, // Reset notification flag
        },
      },
      { session },
    );

    await session.commitTransaction();

    // Send notification to newly booked patient
    await sendNotification(nextPatient.patientId, "You have been booked!");

    return {
      cancelled: false,
      autoBooked: true,
      newPatient: nextPatient.patientId,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### Advanced: Update Multiple Waiting List Items

```javascript
// Mark all high-priority patients as notified

await Appointment.updateOne(
  { _id: appointmentId },
  {
    $set: {
      "waitingList.$[highPriority].notified": true,
    },
  },
  {
    arrayFilters: [
      { "highPriority.priority": { $gte: 5 } }, // Priority >= 5
    ],
  },
);
```

### Complex Example: Update Based on Multiple Conditions

```javascript
// Notify patients who joined more than 24 hours ago and haven't been notified

await Appointment.updateMany(
  {}, // All appointments
  {
    $set: {
      "waitingList.$[oldAndUnnotified].notified": true,
    },
  },
  {
    arrayFilters: [
      {
        "oldAndUnnotified.joinedAt": {
          $lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        "oldAndUnnotified.notified": false,
      },
    ],
  },
);
```

### Increment Priority for Waiting Patients

```javascript
// Daily job: Increase priority for patients waiting > 7 days

await Appointment.updateMany(
  {},
  {
    $inc: {
      "waitingList.$[longWait].priority": 1, // Increment priority by 1
    },
  },
  {
    arrayFilters: [
      {
        "longWait.joinedAt": {
          $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    ],
  },
);
```

### Remove Expired Waiting List Entries

```javascript
// Remove patients who joined > 30 days ago

await Appointment.updateMany(
  {},
  {
    $pull: {
      waitingList: {
        joinedAt: {
          $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  },
);
```

### Get Waiting List Position

```javascript
async function getWaitingListPosition(appointmentId, patientId) {
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  // Sort waiting list by priority and joinedAt
  const sorted = appointment.waitingList.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.joinedAt.getTime() - b.joinedAt.getTime();
  });

  // Find patient's position
  const position = sorted.findIndex((item) => item.patientId.equals(patientId));

  if (position === -1) {
    return { inList: false };
  }

  return {
    inList: true,
    position: position + 1, // 1-indexed
    totalWaiting: sorted.length,
    estimatedWaitTime: calculateEstimatedWait(position),
  };
}
```

### Notify Next Person in Line

```javascript
async function notifyNextInLine(appointmentId) {
  // Find first unnotified person in waiting list
  const appointment = await Appointment.findOneAndUpdate(
    {
      _id: appointmentId,
      "waitingList.notified": false, // Has unnotified patients
    },
    {
      $set: {
        "waitingList.$[nextPerson].notified": true,
      },
    },
    {
      arrayFilters: [{ "nextPerson.notified": false }],
      new: true,
    },
  );

  if (!appointment) {
    return null; // No one to notify
  }

  // Find the newly notified person
  const notifiedPerson = appointment.waitingList.find(
    (item) => item.notified === true,
  );

  if (notifiedPerson) {
    await sendNotification(
      notifiedPerson.patientId,
      "A slot may become available soon!",
    );
  }

  return notifiedPerson;
}
```

### Complete Waiting List API

```javascript
// POST /api/appointments/:id/waiting-list
router.post("/:id/waiting-list", async (req, res) => {
  const { id } = req.params;
  const patientId = req.user.patientId; // From auth

  try {
    const appointment = await joinWaitingList(id, patientId);
    const position = await getWaitingListPosition(id, patientId);

    res.json({
      success: true,
      message: "Added to waiting list",
      data: {
        appointment: appointment._id,
        position: position.position,
        totalWaiting: position.totalWaiting,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/appointments/:id/waiting-list/position
router.get("/:id/waiting-list/position", async (req, res) => {
  const { id } = req.params;
  const patientId = req.user.patientId;

  const position = await getWaitingListPosition(id, patientId);

  res.json({
    success: true,
    data: position,
  });
});

// DELETE /api/appointments/:id/waiting-list
router.delete("/:id/waiting-list", async (req, res) => {
  const { id } = req.params;
  const patientId = req.user.patientId;

  const result = await Appointment.findOneAndUpdate(
    { _id: id },
    {
      $pull: {
        waitingList: { patientId },
      },
    },
    { new: true },
  );

  res.json({
    success: true,
    message: "Removed from waiting list",
  });
});
```

### Key Takeaways

**arrayFilters Syntax:**

```javascript
{
  arrayFilters: [{ "placeholder.field": condition }];
}
```

**Common Use Cases:**

1. Update specific array items based on conditions
2. Increment values for matching items
3. Mark items as processed
4. Update timestamps for specific entries

**Benefits:**

- Update multiple items in single query
- Atomic operations (no race conditions)
- Powerful filtering within arrays
- Better performance than pull + push

**Limitations:**

- Can only filter on fields in the array
- Cannot use $and/$or in arrayFilters (use multiple filters)
- Maximum 128 arrayFilters per query

**Best Practices:**

1. Always use transactions for complex operations
2. Sort waiting list by priority + timestamp
3. Notify patients of position changes
4. Clean up old waiting list entries
5. Limit waiting list size (e.g., max 20 people)
6. Send notifications asynchronously (queue)
