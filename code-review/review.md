# Code Review: Appointment Overlap Detection

## Code to Review

```javascript
app.post("/api/appointments", async (req, res) => {
  const { doctorId, patientId, start, end } = req.body;

  const existing = await db.collection("appointments").findOne({
    doctorId: doctorId,
    status: "BOOKED",
    start: { $lt: end },
    end: { $gt: start },
  });

  if (existing) {
    return res.status(400).json({ error: "Time slot not available" });
  }

  await db.collection("appointments").insertOne({
    doctorId,
    patientId,
    start,
    end,
    status: "BOOKED",
  });

  res.json({ success: true });
});
```

## Issues Identified

### 1. [Issue Name] - CRITICAL

**Severity:** Critical
**Description:**
_(To be completed)_

### 2. [Issue Name] - HIGH

**Severity:** High
**Description:**
_(To be completed)_

_(Continue with remaining issues)_

## Corrected Version

```javascript
// Corrected implementation
// (To be completed)
```

## Explanation

_(To be completed)_
