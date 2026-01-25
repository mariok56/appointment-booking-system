# Appointment Booking System

A clinic appointment booking system built with Node.js, Express, MongoDB, and React. This system allows creating doctors/patients, booking and cancelling appointments, and showing availability with race-condition safe booking logic.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd appointment-booking-system

# Start all services with Docker
docker compose up

# Wait for services to initialize (about 30 seconds)
```

**Access Points:**

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health
- API Documentation: See [docs/postman_collection.json](docs/postman_collection.json)

## 📋 Prerequisites

- Docker & Docker Compose (v2.0+)
- Node.js 18+ (for local development only)
- Git

## 🛠️ Development Setup

### Running with Docker (Recommended)

```bash
docker compose up
```

### Running Locally (Development)

```bash
# Terminal 1: Start MongoDB
docker run -d --name mongodb -p 27017:27017 mongo:7

# Terminal 2: Start Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Terminal 3: Start Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

## 📊 Running Data Seeding

The seed script creates realistic test data including doctors, patients, and appointments.

```bash
# With Docker (after docker compose up)
docker exec -it appointment-api npm run seed

# Or locally
cd backend
npm run seed
```

**Seed data includes:**

- 5 doctors with different specialties (Cardiology, Pediatrics, General Practice, Dermatology, Orthopedics)
- 10 patients with contact information
- 50+ appointments spread across 14 days
- Mix of BOOKED and CANCELLED appointments (80%/20%)
- Various time slots throughout working hours

## 🧪 Running Tests

### Unit Tests

```bash
# With Docker
docker exec -it appointment-api npm test

# Locally
cd backend
npm test
```

### Integration Tests

```bash
cd backend
npm run test:integration
```

### Performance/Concurrent Booking Test

```bash
# Ensure backend is running first
cd tests/performance
npm install
npm run test:concurrent
```

**Expected Results:**

- 10 concurrent booking attempts for the same slot
- Exactly 1 should succeed (201 Created)
- 9 should fail gracefully (409 Conflict)
- No overlapping appointments in database

## 🔧 Environment Variables

### Backend (.env)

| Variable               | Description                              | Default                                  |
| ---------------------- | ---------------------------------------- | ---------------------------------------- |
| `NODE_ENV`             | Environment mode                         | `development`                            |
| `PORT`                 | Server port                              | `3000`                                   |
| `MONGODB_URI`          | MongoDB connection string                | `mongodb://localhost:27017/appointments` |
| `CLINIC_START_HOUR`    | Clinic opening hour (24h format)         | `9`                                      |
| `CLINIC_END_HOUR`      | Clinic closing hour (24h format)         | `17`                                     |
| `DEFAULT_SLOT_MINUTES` | Default appointment duration             | `30`                                     |
| `LOG_LEVEL`            | Logging level (error, warn, info, debug) | `info`                                   |
| `CORS_ORIGIN`          | Allowed CORS origin                      | `http://localhost:5173`                  |

### Frontend (.env)

| Variable       | Description     | Default                     |
| -------------- | --------------- | --------------------------- |
| `VITE_API_URL` | Backend API URL | `http://localhost:3000/api` |

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/          # Database & logger configuration
│   │   ├── controllers/     # Request/response handling
│   │   ├── middleware/      # Error handling, validation, correlation ID
│   │   ├── models/          # Mongoose schemas (Doctor, Patient, Appointment)
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic (overlap detection, slot calculation)
│   │   ├── app.ts           # Express app configuration
│   │   └── server.ts        # Server entry point
│   ├── scripts/
│   │   └── seed.ts          # Database seeding script
│   ├── tests/
│   │   ├── unit/            # Unit tests
│   │   └── integration/     # Integration tests
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   ├── services/        # API client
│   │   ├── App.jsx          # Main app with routing
│   │   └── main.jsx         # Entry point
│   ├── Dockerfile
│   └── package.json
├── tests/
│   └── performance/         # Concurrent booking tests
├── docs/
│   ├── adr.md               # Architectural Decision Record
│   ├── database-troubleshooting.md
│   └── postman_collection.json
├── code-review/
│   └── review.md            # Code review task
├── troubleshooting-project/ # Bug fix task
├── problem-solving.md       # Problem-solving answers
├── docker-compose.yml
└── README.md
```

## 🏗️ Architecture Decisions

### Why This Project Structure?

I chose a **layered architecture** (routes → controllers → services → models) because:

1. **Separation of Concerns:** Each layer has a single responsibility
   - Routes: Define endpoints and apply middleware
   - Controllers: Handle HTTP request/response
   - Services: Contain business logic (overlap detection, slot calculation)
   - Models: Define data schemas and database interactions

2. **Testability:** Business logic in services can be unit tested independently

3. **Maintainability:** Changes to one layer don't affect others

4. **Scalability:** Easy to add new features without modifying existing code

5. **Industry Standard:** Familiar pattern for Node.js developers, easier onboarding

### MongoDB Indexes

I added the following indexes for optimal query performance:

```javascript
// Appointment Model - Critical for overlap detection
AppointmentSchema.index({
  doctorId: 1,
  status: 1,
  start: 1,
  end: 1,
});

// For daily appointment listing
AppointmentSchema.index({
  doctorId: 1,
  start: 1,
});

// Doctor Model
DoctorSchema.index({ name: 1 });

// Patient Model
PatientSchema.index({ name: 1, email: 1 });
```

**Rationale:**

1. **Compound Index (doctorId + status + start + end):**
   - Used by overlap detection query
   - Allows MongoDB to efficiently find conflicting appointments
   - Covers all fields in the overlap query, avoiding collection scans
   - Query time: < 10ms even with 100+ appointments per day

2. **Daily Listing Index (doctorId + start):**
   - Optimizes `GET /appointments?doctorId=&date=` queries
   - Supports range queries on dates efficiently

3. **Name Indexes:**
   - Supports search functionality
   - Improves sorting by name

### Overlap Prevention Strategy

I use **MongoDB Transactions** to prevent race conditions:

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Check for overlap WITHIN transaction
  const overlap = await Appointment.findOne({
    doctorId,
    status: "BOOKED",
    start: { $lt: end },
    end: { $gt: start },
  }).session(session); // CRITICAL: Use session

  if (overlap) throw new Error("Slot not available");

  // Create appointment WITHIN transaction
  await Appointment.create([data], { session });

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
}
```

**Why Transactions?**

- **ACID Guarantees:** Atomic check-and-insert operation
- **Snapshot Isolation:** Transaction sees consistent data
- **Automatic Rollback:** On any error, changes are reverted
- **Industry Standard:** Recommended by MongoDB for this pattern

### How to Scale to Thousands of Bookings/Hour

1. **Read Replicas:**
   - Route availability checks to read replicas
   - Keep writes on primary

2. **Caching:**
   - Cache availability for short periods (30 seconds)
   - Invalidate on booking/cancellation

3. **Horizontal Scaling:**
   - Multiple backend instances behind load balancer
   - Stateless design supports this

4. **Database Sharding:**
   - Shard by doctorId for even distribution
   - Each doctor's data on same shard (locality)

5. **Queue-Based Booking:**
   - Use message queue (RabbitMQ, Redis) for high-volume slots
   - Process bookings sequentially per time slot

6. **Pre-Generated Slots:**
   - For very high traffic, pre-generate slots in database
   - Trade storage for query speed

### If I Had More Time, I Would Improve:

1. **Authentication/Authorization:** JWT-based auth with role-based access control

2. **WebSocket Notifications:** Real-time updates when slots become available

3. **Appointment Reminders:** Background job to send reminders (24h before)

4. **More Comprehensive Tests:** Higher test coverage, E2E tests with Cypress

5. **Rate Limiting:** Protect against abuse and DoS attacks

6. **Caching Layer:** Redis cache for availability queries

7. **OpenAPI/Swagger:** Interactive API documentation

8. **Metrics Dashboard:** Grafana dashboard with key metrics

9. **Better Error Recovery:** Retry logic for transient failures

10. **Multi-timezone Support:** Handle different clinic locations/timezones

## 📝 Logging Strategy

### Implementation

I use **Winston** for structured logging with the following configuration:

- **Log Levels:** ERROR, WARN, INFO, DEBUG
- **Output Formats:**
  - Development: Colorized, human-readable console output
  - Production: JSON format for log aggregation

### Log Contents

All logs include:

- **Timestamp:** ISO 8601 format
- **Level:** error, warn, info, debug
- **Service:** `appointment-api`
- **Correlation ID:** Unique request identifier for tracing
- **Message:** Human-readable description
- **Context:** Relevant data (doctorId, appointmentId, etc.)

### Example Log Output

```json
{
  "level": "info",
  "message": "Booking appointment request",
  "correlationId": "abc-123-def",
  "doctorId": "507f1f77bcf86cd799439011",
  "patientId": "507f1f77bcf86cd799439012",
  "start": "2024-01-25T10:00:00.000Z",
  "timestamp": "2024-01-25 10:30:45",
  "service": "appointment-api"
}
```

### Correlation ID Tracing

Every request gets a correlation ID (from header or auto-generated):

1. Middleware extracts/generates correlation ID
2. ID is attached to all log entries
3. ID is returned in response headers
4. Enables tracing requests across services

### Extending for Distributed Tracing

To add full distributed tracing:

1. **Integrate OpenTelemetry:**

   ```javascript
   const { NodeTracerProvider } = require("@opentelemetry/node");
   const provider = new NodeTracerProvider();
   provider.register();
   ```

2. **Export to Jaeger/Zipkin:**

   ```javascript
   const { JaegerExporter } = require("@opentelemetry/exporter-jaeger");
   provider.addSpanProcessor(new SimpleSpanProcessor(new JaegerExporter()));
   ```

3. **Propagate Context:**
   - Pass trace context in HTTP headers
   - Include in async operations

## 📊 Metrics (Production Monitoring)

### Application Metrics I Would Track

1. **Request Metrics:**
   - Requests per second by endpoint
   - Response time (p50, p95, p99)
   - Error rate by endpoint
   - HTTP status code distribution

2. **Business Metrics:**
   - Bookings created per hour
   - Cancellations per hour
   - Booking success rate (vs conflicts)
   - Utilization rate per doctor (booked slots / total slots)
   - Peak booking times (hourly/daily patterns)

3. **Database Metrics:**
   - Query execution time
   - Connection pool utilization
   - Index usage statistics
   - Transaction commit/rollback rates

### Infrastructure Metrics

1. **Container Metrics:**
   - CPU usage per container
   - Memory usage per container
   - Network I/O

2. **MongoDB Metrics:**
   - Connections
   - Operations per second
   - Replication lag
   - Disk usage

### Implementation Approach

```javascript
// Using prom-client for Prometheus metrics
const promClient = require("prom-client");

const bookingCounter = new promClient.Counter({
  name: "bookings_total",
  help: "Total number of booking attempts",
  labelNames: ["status", "doctor_specialty"],
});

const responseTime = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
});
```

## 🔀 Git Workflow

### How I Structured Commits

I organized commits by feature/concern:

1. **Initial Setup:** Project scaffolding, Docker config
2. **Models:** Each entity (Doctor, Patient, Appointment) in separate commits
3. **Services:** Business logic with corresponding tests
4. **Controllers/Routes:** API endpoints
5. **Frontend:** Pages and components
6. **Documentation:** README, problem-solving, code review
7. **Tests:** Unit tests, integration tests, performance tests

**Commit Message Format:**

```
<type>(<scope>): <description>

feat(booking): implement race-condition safe booking with transactions
fix(validation): add working hours validation
docs(readme): add architecture decisions section
test(concurrent): add performance tests for race conditions
```

### Branching Strategy for Multiple Features

**Scenario:** Add SMS notifications while fixing an overlap bug

```
main
├── feature/sms-notifications
│   ├── commit: feat(sms): add SMS service integration
│   ├── commit: feat(sms): add reminder job scheduler
│   └── commit: test(sms): add SMS notification tests
│
└── bugfix/overlap-detection
    ├── commit: fix(overlap): correct boundary condition in overlap check
    ├── commit: test(overlap): add edge case tests
    └── commit: docs: update troubleshooting guide
```

**Workflow:**

1. Create branches from `main`
2. Work independently on each branch
3. Write tests for changes
4. Create PRs with descriptions
5. Code review
6. Merge `bugfix` first (it's critical)
7. Rebase `feature` on `main`
8. Merge `feature`

**Why This Approach:**

- Bug fixes can be deployed quickly
- Features don't block critical fixes
- Clear history of changes
- Easy to rollback if needed

## 📚 API Documentation

Full API documentation is available in [docs/postman_collection.json](docs/postman_collection.json).

### Quick Reference

| Endpoint                       | Method | Description                                 |
| ------------------------------ | ------ | ------------------------------------------- |
| `/health`                      | GET    | Health check                                |
| `/api/doctors`                 | POST   | Create doctor                               |
| `/api/doctors`                 | GET    | List all doctors                            |
| `/api/doctors/:id`             | GET    | Get doctor by ID                            |
| `/api/patients`                | POST   | Create patient                              |
| `/api/patients`                | GET    | List all patients                           |
| `/api/appointments`            | POST   | Book appointment                            |
| `/api/appointments`            | GET    | List appointments (query: doctorId, date)   |
| `/api/appointments/:id/cancel` | POST   | Cancel appointment                          |
| `/api/availability`            | GET    | Get available slots (query: doctorId, date) |

### Example: Book Appointment

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "507f1f77bcf86cd799439011",
    "patientId": "507f1f77bcf86cd799439012",
    "start": "2024-01-25T10:00:00.000Z",
    "end": "2024-01-25T10:30:00.000Z",
    "reason": "Annual checkup"
  }'
```

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "Time slot not available",
    "correlationId": "abc-123-def",
    "timestamp": "2024-01-25T10:30:45.000Z"
  }
}
```

## 🔒 Assumptions Made

1. **Single Timezone:** All times are in UTC. Frontend converts for display.

2. **No Authentication:** For simplicity, no auth is implemented. In production, JWT would be added.

3. **Working Hours:** Fixed 9:00-17:00 for all doctors. Configurable via env vars.

4. **Slot Duration:** Default 30 minutes, but configurable.

5. **No Past Bookings:** Cannot book appointments in the past.

6. **Single Location:** No multi-location support (documented how to extend in problem-solving.md).

7. **No Recurring Appointments:** Each appointment is a single occurrence.

## 📖 Additional Documentation

- [Architectural Decision Record](docs/adr.md)
- [Database Troubleshooting Guide](docs/database-troubleshooting.md)
- [Problem Solving Explanations](problem-solving.md)
- [Code Review](code-review/review.md)
- [API Documentation (Postman)](docs/postman_collection.json)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📄 License

MIT License

---

**Note:** This project was created as part of a technical assessment. The focus was on demonstrating clean architecture, proper validation, race-condition handling, and comprehensive documentation.
