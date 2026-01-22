import { Request, Response, NextFunction } from "express";
import appointmentService from "../services/appointmentService";
import logger from "../config/logger";

/**
 * Controller for appointment-related endpoints
 *
 * Responsibilities:
 * - Parse and validate HTTP requests
 * - Call service layer for business logic
 * - Format and send HTTP responses
 * - Handle errors gracefully
 */

/**
 * Book a new appointment
 * POST /api/appointments
 *
 * Body: {
 *   doctorId: string,
 *   patientId: string,
 *   start: string (ISO date),
 *   end: string (ISO date),
 *   reason?: string
 * }
 */
export const bookAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const correlationId = req.headers["x-correlation-id"] as string;

  try {
    const { doctorId, patientId, start, end, reason } = req.body;

    // Parse dates from ISO strings
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Validate dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATE",
          message: "Invalid date format. Use ISO 8601 format.",
          correlationId,
        },
      });
      return;
    }

    logger.info("Booking appointment request", {
      correlationId,
      doctorId,
      patientId,
      start: startDate,
      end: endDate,
    });

    const appointment = await appointmentService.bookAppointment({
      doctorId,
      patientId,
      start: startDate,
      end: endDate,
      reason,
    });

    res.status(201).json({
      success: true,
      data: appointment,
      message: "Appointment booked successfully",
    });
  } catch (error) {
    // Pass to error handling middleware
    next(error);
  }
};

/**
 * Get available time slots
 * GET /api/availability?doctorId=xxx&date=YYYY-MM-DD&slotMinutes=30
 */
export const getAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { doctorId, date, slotMinutes = "30" } = req.query;

    // Validate required parameters
    if (!doctorId || !date) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_PARAMETERS",
          message: "doctorId and date are required",
        },
      });
      return;
    }

    // Parse date (YYYY-MM-DD format)
    const requestedDate = new Date(date as string);

    if (isNaN(requestedDate.getTime())) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATE",
          message: "Invalid date format. Use YYYY-MM-DD.",
        },
      });
      return;
    }

    const slots = await appointmentService.getAvailableSlots(
      doctorId as string,
      requestedDate,
      parseInt(slotMinutes as string),
    );

    res.json({
      success: true,
      data: {
        date: requestedDate.toISOString().split("T")[0],
        doctorId,
        slotMinutes: parseInt(slotMinutes as string),
        totalSlots: slots.length,
        slots,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an appointment
 * POST /api/appointments/:id/cancel
 */
export const cancelAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info("Cancel appointment request", { appointmentId: id });

    const appointment = await appointmentService.cancelAppointment(id);

    res.json({
      success: true,
      data: appointment,
      message: "Appointment cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get appointments for a doctor on a specific date
 * GET /api/appointments?doctorId=xxx&date=YYYY-MM-DD
 */
export const getAppointments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_PARAMETERS",
          message: "doctorId and date are required",
        },
      });
      return;
    }

    const requestedDate = new Date(date as string);

    if (isNaN(requestedDate.getTime())) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATE",
          message: "Invalid date format. Use YYYY-MM-DD.",
        },
      });
      return;
    }

    const appointments =
      await appointmentService.getAppointmentsByDoctorAndDate(
        doctorId as string,
        requestedDate,
      );

    res.json({
      success: true,
      data: {
        date: requestedDate.toISOString().split("T")[0],
        doctorId,
        count: appointments.length,
        appointments,
      },
    });
  } catch (error) {
    next(error);
  }
};
