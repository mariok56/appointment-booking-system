# Database Troubleshooting Guide

## Scenario: Overlapping Appointments Despite Prevention Logic

### 1. Initial Investigation

**Data to Examine:**

- Query overlapping appointments in database
- Check application logs for transaction errors
- Review MongoDB slow query logs
- Check server timestamps vs database timestamps

**Commands:**

```javascript
// Find overlapping appointments
db.appointments.find({
  doctorId: ObjectId("..."),
  status: "BOOKED",
  start: { $lt: ISODate("...") },
  end: { $gt: ISODate("...") },
});

// Check transaction logs
db.system.transactions.find();
```

### 2. Common Causes

1. **Race Condition:** Transactions not properly implemented
2. **Time Zone Issues:** Server and database in different time zones
3. **Transaction Rollback Failure:** Error in rollback logic
4. **Index Missing:** Overlap query not using proper indexes
5. **Stale Reads:** Read preference set to secondary without proper consistency

### 3. Resolution Steps

_(Full details to be completed)_

### 4. Prevention & Monitoring

_(To be completed)_
