import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Doctor from "../src/models/Doctor";
import Patient from "../src/models/Patient";
import Appointment from "../src/models/Appointment";
import logger from "../src/config/logger";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

/**
 * Seed Script
 *
 * Creates realistic test data for the appointment booking system
 *
 * Run with: npm run seed
 *
 * What it creates:
 * - 3-5 doctors with different specialties
 * - 5-10 patients with contact information
 * - 20-30 appointments (future only, booked/cancelled)
 *
 * Features:
 * - Idempotent (safe to run multiple times)
 * - Realistic data distribution
 * - Some doctors fully booked, others with availability
 * - Mix of appointment statuses
 */

// Sample data
const doctorsData = [
  {
    name: "Dr. Sarah Johnson",
    specialty: "Cardiology",
  },
  {
    name: "Dr. Michael Chen",
    specialty: "Pediatrics",
  },
  {
    name: "Dr. Emily Rodriguez",
    specialty: "General Practice",
  },
  {
    name: "Dr. James Williams",
    specialty: "Dermatology",
  },
  {
    name: "Dr. Aisha Patel",
    specialty: "Orthopedics",
  },
];

const patientsData = [
  {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1-555-0101",
  },
  {
    name: "Jane Smith",
    email: "jane.smith@example.com",
    phone: "+1-555-0102",
  },
  {
    name: "Robert Johnson",
    email: "robert.j@example.com",
    phone: "+1-555-0103",
  },
  {
    name: "Maria Garcia",
    email: "maria.garcia@example.com",
    phone: "+1-555-0104",
  },
  {
    name: "David Lee",
    email: "david.lee@example.com",
    phone: "+1-555-0105",
  },
  {
    name: "Sarah Brown",
    email: "sarah.brown@example.com",
    phone: "+1-555-0106",
  },
  {
    name: "Michael Wilson",
    email: "michael.w@example.com",
    phone: "+1-555-0107",
  },
  {
    name: "Lisa Anderson",
    email: "lisa.anderson@example.com",
    phone: "+1-555-0108",
  },
  {
    name: "James Taylor",
    email: "james.taylor@example.com",
    phone: "+1-555-0109",
  },
  {
    name: "Emma Martinez",
    email: "emma.martinez@example.com",
    phone: "+1-555-0110",
  },
];

const appointmentReasons = [
  "Annual checkup",
  "Follow-up visit",
  "Consultation",
  "Symptoms evaluation",
  "Vaccination",
  "Lab results discussion",
  "Prescription renewal",
  "Physical examination",
  "Treatment review",
  "Preventive care",
];

/**
 * Generate random appointment reason
 */
const getRandomReason = (): string => {
  return appointmentReasons[
    Math.floor(Math.random() * appointmentReasons.length)
  ];
};

/**
 * Generate appointments for a specific date
 *
 * @param doctors - Array of doctor IDs
 * @param patients - Array of patient IDs
 * @param date - Date for appointments
 * @param appointmentsPerDoctor - Number of appointments per doctor
 * @param startHourMin - Minimum start hour (default 9)
 * @returns Array of appointment objects
 */
const generateAppointmentsForDate = (
  doctors: any[],
  patients: any[],
  date: Date,
  appointmentsPerDoctor: number,
  startHourMin: number = 9,
): any[] => {
  const appointments: any[] = [];

  doctors.forEach((doctor) => {
    // Generate appointments per doctor per day
    const numAppointments = appointmentsPerDoctor;

    for (let i = 0; i < numAppointments; i++) {
      // Random time slot starting from startHourMin to 15 (3 PM)
      const hour =
        startHourMin + Math.floor(Math.random() * (16 - startHourMin)); // 16 is 4 PM, but range to 15
      const minute = Math.random() < 0.5 ? 0 : 30; // Either :00 or :30

      const start = new Date(date);
      start.setHours(hour, minute, 0, 0);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30); // 30-minute appointments

      // Random patient
      const patient = patients[Math.floor(Math.random() * patients.length)];

      // 20% chance of cancelled appointment
      const status = Math.random() < 0.2 ? "CANCELLED" : "BOOKED";

      appointments.push({
        doctorId: doctor._id,
        patientId: patient._id,
        start,
        end,
        status,
        reason: getRandomReason(),
      });
    }
  });

  return appointments;
};

/**
 * Main seed function
 */
const seed = async (): Promise<void> => {
  try {
    // Connect to database
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/appointments";
    logger.info("Connecting to MongoDB...", { uri: mongoUri });
    await mongoose.connect(mongoUri);
    logger.info("Connected to MongoDB successfully");

    // ============================================
    // STEP 1: Clear existing data (idempotent)
    // ============================================
    logger.info("Clearing existing data...");
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
    await Appointment.deleteMany({});
    logger.info("Existing data cleared");

    // ============================================
    // STEP 2: Create doctors
    // ============================================
    logger.info("Creating doctors...");
    const doctors = await Doctor.insertMany(doctorsData);
    logger.info("Doctors created", { count: doctors.length });

    // Log created doctors
    doctors.forEach((doctor) => {
      logger.info("Created doctor", {
        id: doctor._id,
        name: doctor.name,
        specialty: doctor.specialty,
      });
    });

    // ============================================
    // STEP 3: Create patients
    // ============================================
    logger.info("Creating patients...");
    const patients = await Patient.insertMany(patientsData);
    logger.info("Patients created", { count: patients.length });

    // ============================================
    // STEP 4: Create appointments
    // ============================================
    logger.info("Creating appointments...");

    const appointments: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's appointments (ensure start times are in the future)
    const now = new Date();
    const startHourMin = Math.max(9, now.getHours() + 1); // At least 1 hour from now, but not before 9 AM
    const todayAppointments = generateAppointmentsForDate(
      doctors,
      patients,
      today,
      3, // 3 appointments per doctor today
      startHourMin,
    );
    appointments.push(...todayAppointments);

    // Future appointments (tomorrow to 14 days from now)
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);

      // Vary the number of appointments
      // Some days fully booked (4-5), others with availability (1-2)
      const numAppointments =
        dayOffset % 3 === 0
          ? 1 + Math.floor(Math.random() * 2) // Light days
          : 3 + Math.floor(Math.random() * 2); // Busy days

      const dayAppointments = generateAppointmentsForDate(
        doctors,
        patients,
        date,
        numAppointments,
      );

      appointments.push(...dayAppointments);
    }

    // Insert all appointments
    const createdAppointments = await Appointment.insertMany(appointments);
    logger.info("Appointments created", { count: createdAppointments.length });

    // ============================================
    // STEP 5: Statistics
    // ============================================
    const stats = {
      doctors: doctors.length,
      patients: patients.length,
      totalAppointments: createdAppointments.length,
      bookedAppointments: createdAppointments.filter(
        (a) => a.status === "BOOKED",
      ).length,
      cancelledAppointments: createdAppointments.filter(
        (a) => a.status === "CANCELLED",
      ).length,
      pastAppointments: 0, // No past appointments created
      futureAppointments: createdAppointments.length, // All are future
    };

    logger.info("=".repeat(50));
    logger.info("Seed completed successfully!");
    logger.info("=".repeat(50));
    logger.info("Statistics:", stats);
    logger.info("=".repeat(50));

    // Sample data for testing
    logger.info("Sample Doctor ID (for testing):", {
      doctorId: doctors[0]._id.toString(),
      name: doctors[0].name,
    });
    logger.info("Sample Patient ID (for testing):", {
      patientId: patients[0]._id.toString(),
      name: patients[0].name,
    });

    // Show some sample appointments
    const sampleAppointments = createdAppointments
      .filter((a) => a.start >= today && a.status === "BOOKED")
      .slice(0, 3);

    logger.info("Sample future appointments:");
    sampleAppointments.forEach((apt) => {
      logger.info("Appointment", {
        id: apt._id,
        doctor: doctors.find((d) => d._id.equals(apt.doctorId))?.name,
        patient: patients.find((p) => p._id.equals(apt.patientId))?.name,
        start: apt.start.toISOString(),
        status: apt.status,
      });
    });

    logger.info("=".repeat(50));
    logger.info("You can now:");
    logger.info("1. Start the server: npm run dev");
    logger.info("2. Test booking: POST /api/appointments");
    logger.info(
      "3. Check availability: GET /api/availability?doctorId=<id>&date=2024-01-25",
    );
    logger.info(
      "4. List appointments: GET /api/appointments?doctorId=<id>&date=2024-01-25",
    );
    logger.info("=".repeat(50));
  } catch (error) {
    logger.error("Seed failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    logger.info("Database connection closed");
    process.exit(0);
  }
};

// Run the seed function
seed();
