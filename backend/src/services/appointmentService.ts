import mongoose from "mongoose";
import Appointment, { IAppointment } from "../models/Appointment";
import logger from "../config/logger";

// Custom error classes for better error handling
export class AppointmentBookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentBookingError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

interface TimeSlot {
  start: Date;
  end: Date;
}

interface BookingData {
  doctorId: string;
  patientId: string;
  start: Date;
  end: Date;
  reason?: string;
}

class AppointmentService {
  /**
   * Book an appointment with race-condition safety
   *
   * This is the core method that prevents double-booking
   * Uses MongoDB transactions to ensure atomicity
   *
   * @param data - Appointment booking details
   * @returns Created appointment
   * @throws AppointmentBookingError if slot not available
   * @throws ValidationError if data is invalid
   */
  async bookAppointment(data: BookingData): Promise<IAppointment> {
    const correlationId = `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info("Starting appointment booking", {
      correlationId,
      doctorId: data.doctorId,
      start: data.start,
      end: data.end,
    });

    // Step 1: Validate the appointment times
    this.validateAppointmentTimes(data.start, data.end);
    this.validateWorkingHours(data.start, data.end);
    this.validateNotInPast(data.start);

    // Step 2: Start a MongoDB session for transaction
    const session = await mongoose.startSession();

    try {
      // Start transaction
      session.startTransaction();

      logger.debug("Transaction started", { correlationId });

      // Step 3: Check for overlaps WITHIN the transaction

      const overlap = await this.checkOverlap(
        data.doctorId,
        data.start,
        data.end,
        session,
      );

      if (overlap) {
        logger.warn("Booking conflict detected", {
          correlationId,
          doctorId: data.doctorId,
          conflictingAppointment: overlap._id,
          requestedStart: data.start,
          requestedEnd: data.end,
        });

        throw new AppointmentBookingError("Time slot not available");
      }

      // Step 4: Create the appointment within the transaction
      const appointment = await Appointment.create(
        [
          {
            doctorId: new mongoose.Types.ObjectId(data.doctorId),
            patientId: new mongoose.Types.ObjectId(data.patientId),
            start: data.start,
            end: data.end,
            status: "BOOKED",
            reason: data.reason,
          },
        ],
        { session },
      );

      // Step 5: Commit the transaction
      await session.commitTransaction();

      logger.info("Appointment booked successfully", {
        correlationId,
        appointmentId: appointment[0]._id,
        doctorId: data.doctorId,
      });

      return appointment[0];
    } catch (error) {
      // Rollback on any error
      await session.abortTransaction();

      logger.error("Appointment booking failed", {
        correlationId,
        error: error instanceof Error ? error.message : "Unknown error",
        doctorId: data.doctorId,
      });

      throw error;
    } finally {
      // Always end the session
      session.endSession();
    }
  }

  /**
   * Check for overlapping appointments
   *
   * Overlap occurs when:
   * 1. New appointment starts during existing appointment
   * 2. New appointment ends during existing appointment
   * 3. New appointment completely contains existing appointment
   * 4. Existing appointment completely contains new appointment
   *
   * @param doctorId - Doctor ID to check
   * @param start - New appointment start time
   * @param end - New appointment end time
   * @param session - MongoDB session for transaction
   * @returns Overlapping appointment if found, null otherwise
   */
  private async checkOverlap(
    doctorId: string,
    start: Date,
    end: Date,
    session: mongoose.ClientSession,
  ): Promise<IAppointment | null> {
    // This query finds ANY overlapping appointment
    // Using the classic overlap detection algorithm
    const overlap = await Appointment.findOne({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: "BOOKED", // Only check BOOKED appointments
      $or: [
        // Case 1: Existing appointment starts before new ends AND ends after new starts
        // This catches all overlap scenarios
        {
          start: { $lt: end },
          end: { $gt: start },
        },
      ],
    }).session(session); // CRITICAL: Use the transaction session

    return overlap;
  }

  /**
   * Get available time slots for a doctor on a specific date
   *
   * Algorithm:
   * 1. Generate all possible slots for the day (09:00-17:00)
   * 2. Fetch all BOOKED appointments for that day
   * 3. Filter out slots that overlap with booked appointments
   *
   * @param doctorId - Doctor ID
   * @param date - Date to check availability
   * @param slotMinutes - Duration of each slot (default 30)
   * @returns Array of available time slots
   */
  async getAvailableSlots(
    doctorId: string,
    date: Date,
    slotMinutes: number = 30,
  ): Promise<TimeSlot[]> {
    logger.info("Calculating available slots", {
      doctorId,
      date: date.toISOString(),
      slotMinutes,
    });

    // Step 1: Define working hours for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(
      parseInt(process.env.CLINIC_START_HOUR || "9"),
      0,
      0,
      0,
    );

    const endOfDay = new Date(date);
    endOfDay.setHours(parseInt(process.env.CLINIC_END_HOUR || "17"), 0, 0, 0);

    // Step 2: Fetch all BOOKED appointments for this doctor on this day
    // Using the indexed query for performance
    const bookedAppointments = await Appointment.find({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      status: "BOOKED",
      start: { $gte: startOfDay, $lt: endOfDay },
    })
      .sort({ start: 1 }) // Sort by start time
      .select("start end") // Only fetch start and end (performance optimization)
      .lean(); // Return plain JS objects (faster than Mongoose documents)

    logger.debug("Fetched booked appointments", {
      doctorId,
      count: bookedAppointments.length,
    });

    // Step 3: Generate all possible time slots
    const allSlots = this.generateTimeSlots(startOfDay, endOfDay, slotMinutes);

    // Step 4: Filter out slots that overlap with booked appointments
    const availableSlots = allSlots.filter((slot) => {
      // Check if this slot overlaps with any booked appointment
      const hasOverlap = bookedAppointments.some((appointment) =>
        this.slotsOverlap(
          slot.start,
          slot.end,
          appointment.start,
          appointment.end,
        ),
      );
      return !hasOverlap; // Keep slot if no overlap
    });

    logger.info("Available slots calculated", {
      doctorId,
      totalSlots: allSlots.length,
      bookedSlots: bookedAppointments.length,
      availableSlots: availableSlots.length,
    });

    return availableSlots;
  }

  /**
   * Generate time slots for a given time range
   *
   * Example: 09:00-17:00 with 30-minute slots
   * Returns: 09:00-09:30, 09:30-10:00, 10:00-10:30, ..., 16:30-17:00
   *
   * @param start - Start of time range
   * @param end - End of time range
   * @param slotMinutes - Duration of each slot
   * @returns Array of time slots
   */
  private generateTimeSlots(
    start: Date,
    end: Date,
    slotMinutes: number,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const current = new Date(start);

    while (current < end) {
      const slotEnd = new Date(current.getTime() + slotMinutes * 60000);

      // Only add slot if it ends before or at the clinic close time
      if (slotEnd <= end) {
        slots.push({
          start: new Date(current),
          end: slotEnd,
        });
      }

      // Move to next slot
      current.setMinutes(current.getMinutes() + slotMinutes);
    }

    return slots;
  }

  private slotsOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }
  async cancelAppointment(appointmentId: string): Promise<IAppointment> {
    logger.info("Cancelling appointment", { appointmentId });

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.status === "CANCELLED") {
      logger.warn("Appointment already cancelled", { appointmentId });
      throw new Error("Appointment is already cancelled");
    }

    appointment.status = "CANCELLED";
    await appointment.save();

    logger.info("Appointment cancelled successfully", { appointmentId });

    return appointment;
  }

  async getAppointmentsByDoctorAndDate(
    doctorId: string,
    date: Date,
  ): Promise<IAppointment[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      doctorId: new mongoose.Types.ObjectId(doctorId),
      start: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("patientId", "name email phone")
      .sort({ start: 1 });

    return appointments;
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate that start time is before end time
   * and they're on the same day
   */
  private validateAppointmentTimes(start: Date, end: Date): void {
    if (start >= end) {
      throw new ValidationError("Start time must be before end time");
    }

    // Ensure same day (no multi-day appointments)
    if (start.toDateString() !== end.toDateString()) {
      throw new ValidationError("Appointments must be within the same day");
    }
  }

  /**
   * Validate that appointment is within clinic working hours
   */
  private validateWorkingHours(start: Date, end: Date): void {
    const startHour = start.getHours();
    const startMinutes = start.getMinutes();
    const endHour = end.getHours();
    const endMinutes = end.getMinutes();

    const clinicStart = parseInt(process.env.CLINIC_START_HOUR || "9");
    const clinicEnd = parseInt(process.env.CLINIC_END_HOUR || "17");

    // Check if start time is before clinic opens
    if (
      startHour < clinicStart ||
      (startHour === clinicStart && startMinutes < 0)
    ) {
      throw new ValidationError(
        `Appointments cannot start before ${clinicStart}:00`,
      );
    }

    // Check if end time is after clinic closes
    if (endHour > clinicEnd || (endHour === clinicEnd && endMinutes > 0)) {
      throw new ValidationError(
        `Appointments cannot end after ${clinicEnd}:00`,
      );
    }
  }

  /**
   * Validate that appointment is not in the past
   */
  private validateNotInPast(start: Date): void {
    const now = new Date();
    if (start < now) {
      throw new ValidationError("Cannot book appointments in the past");
    }
  }
}

// Export singleton instance
export default new AppointmentService();
