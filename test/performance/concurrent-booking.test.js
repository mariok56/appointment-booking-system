const axios = require("axios");

const API_URL = process.env.API_URL || "http://localhost:3000/api";

// Test configuration
const CONCURRENT_REQUESTS = 10;

/**
 * Generate a test slot that's guaranteed to be during working hours
 * Working hours: 9:00 AM - 5:00 PM
 */
function generateTestSlot() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Set to 10:00 AM tomorrow (safe time during working hours)
  tomorrow.setHours(10, 0, 0, 0);

  const start = new Date(tomorrow);
  const end = new Date(tomorrow.getTime() + 30 * 60 * 1000); // +30 minutes

  return { start, end };
}

const TEST_SLOT = generateTestSlot();

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Setup test data
 */
async function setup() {
  log("cyan", "\n========================================");
  log("cyan", "SETUP: Creating test data");
  log("cyan", "========================================\n");

  try {
    const timestamp = Date.now();

    // Create doctor
    const doctorRes = await axios.post(`${API_URL}/doctors`, {
      name: `Dr. Performance Test ${timestamp}`,
      specialty: "Testing",
    });
    const doctorId = doctorRes.data.data._id;
    log("green", `✓ Created doctor: ${doctorId}`);

    // Create patients with unique emails to avoid conflicts
    const patientIds = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      const patientRes = await axios.post(`${API_URL}/patients`, {
        name: `Test Patient ${timestamp}-${i + 1}`,
        email: `patient-${timestamp}-${i + 1}@test.com`,
      });
      patientIds.push(patientRes.data.data._id);
    }
    log("green", `✓ Created ${CONCURRENT_REQUESTS} patients`);

    return { doctorId, patientIds };
  } catch (error) {
    log("red", `✗ Setup failed: ${error.message}`);
    if (error.response) {
      console.log("Response:", error.response.data);
    }
    throw error;
  }
}

/**
 * Make a single booking request
 */
async function attemptBooking(doctorId, patientId, requestId) {
  const startTime = Date.now();

  try {
    const response = await axios.post(`${API_URL}/appointments`, {
      doctorId,
      patientId,
      start: TEST_SLOT.start.toISOString(),
      end: TEST_SLOT.end.toISOString(),
      reason: `Concurrent test - Request ${requestId}`,
    });

    const duration = Date.now() - startTime;

    return {
      requestId,
      success: true,
      status: response.status,
      duration,
      appointmentId: response.data.data._id,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      requestId,
      success: false,
      status: error.response?.status || "ERROR",
      duration,
      errorCode: error.response?.data?.error?.code,
      errorMessage: error.response?.data?.error?.message,
    };
  }
}

/**
 * Run concurrent booking test
 */
async function runConcurrentTest(doctorId, patientIds) {
  log("cyan", "\n========================================");
  log("cyan", "TEST: Concurrent Booking Requests");
  log("cyan", "========================================\n");

  log(
    "blue",
    `Making ${CONCURRENT_REQUESTS} concurrent requests for the same slot...`,
  );
  log("blue", `Time slot: ${TEST_SLOT.start.toISOString()}\n`);

  const startTime = Date.now();

  // Fire all requests simultaneously
  const promises = patientIds.map((patientId, index) =>
    attemptBooking(doctorId, patientId, index + 1),
  );

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  return { results, totalDuration };
}

/**
 * Analyze test results
 */
function analyzeResults(results, totalDuration) {
  log("cyan", "\n========================================");
  log("cyan", "RESULTS ANALYSIS");
  log("cyan", "========================================\n");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  // Group failures by error code
  const errorCodes = {};
  failed.forEach((r) => {
    const code = r.errorCode || "UNKNOWN";
    errorCodes[code] = (errorCodes[code] || 0) + 1;
  });

  // Print summary
  log("blue", "Summary:");
  console.log(`  Total requests: ${results.length}`);
  console.log(`  Successful: ${successful.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Total duration: ${totalDuration}ms`);
  console.log(
    `  Average response time: ${Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length)}ms\n`,
  );

  // Print successful bookings
  if (successful.length > 0) {
    log("green", "Successful Bookings:");
    successful.forEach((r) => {
      console.log(
        `  ✓ Request ${r.requestId}: ${r.duration}ms (ID: ${r.appointmentId})`,
      );
    });
    console.log();
  }

  // Print failed requests
  if (failed.length > 0) {
    log("yellow", "Failed Requests:");
    failed.forEach((r) => {
      console.log(
        `  ✗ Request ${r.requestId}: ${r.duration}ms - ${r.errorCode}: ${r.errorMessage}`,
      );
    });
    console.log();
  }

  // Print error distribution
  if (Object.keys(errorCodes).length > 0) {
    log("blue", "Error Distribution:");
    Object.entries(errorCodes).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
    console.log();
  }

  return { successful, failed };
}

/**
 * Verify no overlapping appointments
 */
async function verifyNoOverlaps(doctorId) {
  log("cyan", "\n========================================");
  log("cyan", "VERIFICATION: Checking for overlaps");
  log("cyan", "========================================\n");

  try {
    const date = TEST_SLOT.start.toISOString().split("T")[0];
    const response = await axios.get(`${API_URL}/appointments`, {
      params: { doctorId, date },
    });

    const appointments = response.data.data.appointments;
    const bookedAppointments = appointments.filter(
      (a) => a.status === "BOOKED",
    );

    log("blue", `Total appointments on ${date}: ${appointments.length}`);
    log("blue", `BOOKED appointments: ${bookedAppointments.length}\n`);

    // Check for overlaps
    let overlapFound = false;
    for (let i = 0; i < bookedAppointments.length; i++) {
      for (let j = i + 1; j < bookedAppointments.length; j++) {
        const a1 = bookedAppointments[i];
        const a2 = bookedAppointments[j];

        const start1 = new Date(a1.start);
        const end1 = new Date(a1.end);
        const start2 = new Date(a2.start);
        const end2 = new Date(a2.end);

        // Check overlap: start1 < end2 AND start2 < end1
        if (start1 < end2 && start2 < end1) {
          overlapFound = true;
          log("red", `✗ OVERLAP DETECTED!`);
          console.log(
            `  Appointment 1: ${start1.toISOString()} - ${end1.toISOString()}`,
          );
          console.log(
            `  Appointment 2: ${start2.toISOString()} - ${end2.toISOString()}\n`,
          );
        }
      }
    }

    if (!overlapFound && bookedAppointments.length > 0) {
      log(
        "green",
        "✓ No overlaps detected - race condition prevention working!\n",
      );
    } else if (bookedAppointments.length === 0) {
      log("yellow", "⚠ No booked appointments found\n");
    }

    return overlapFound;
  } catch (error) {
    log("red", `✗ Verification failed: ${error.message}\n`);
    return false;
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log("\n");
  log("cyan", "╔════════════════════════════════════════╗");
  log("cyan", "║  CONCURRENT BOOKING PERFORMANCE TEST  ║");
  log("cyan", "╚════════════════════════════════════════╝");

  try {
    // Setup
    const { doctorId, patientIds } = await setup();

    // Run test
    const { results, totalDuration } = await runConcurrentTest(
      doctorId,
      patientIds,
    );

    // Analyze
    const { successful, failed } = analyzeResults(results, totalDuration);

    // Verify no overlaps
    const hasOverlaps = await verifyNoOverlaps(doctorId);

    // Final verdict
    log("cyan", "========================================");
    log("cyan", "FINAL VERDICT");
    log("cyan", "========================================\n");

    const passed =
      successful.length === 1 &&
      failed.length === CONCURRENT_REQUESTS - 1 &&
      !hasOverlaps;

    if (passed) {
      log("green", "✓✓✓ TEST PASSED ✓✓✓\n");
      console.log("  Race condition prevention is working correctly!");
      console.log("  Exactly 1 booking succeeded, rest failed gracefully.");
      console.log("  No overlapping appointments in database.\n");
      process.exit(0);
    } else {
      log("red", "✗✗✗ TEST FAILED ✗✗✗\n");

      if (successful.length !== 1) {
        console.log(
          `  Expected 1 successful booking, got ${successful.length}`,
        );
      }
      if (failed.length !== CONCURRENT_REQUESTS - 1) {
        console.log(
          `  Expected ${CONCURRENT_REQUESTS - 1} failures, got ${failed.length}`,
        );
      }
      if (hasOverlaps) {
        console.log("  Overlapping appointments detected in database!");
      }

      console.log(
        "\n  Race condition prevention may not be working correctly.\n",
      );
      process.exit(1);
    }
  } catch (error) {
    log("red", `\n✗ Test execution failed: ${error.message}\n`);
    if (error.response) {
      console.log("Response data:", error.response.data);
    }
    process.exit(1);
  }
}

// Run test
main();
