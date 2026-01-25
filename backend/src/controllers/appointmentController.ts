import { Request, Response, NextFunction } from "express";
import appointmentService, {
  AppointmentBookingError,
  ValidationError,
} from "../services/appointmentService";

import mongoose from "mongoose";
import logger from "../config/logger";

class AppointmentController {
  /**
   * Book a new appointment
   * POST /api/appointments
   */
  async createAppointment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { doctorId, patientId, start, end, reason } = req.body;
      const correlationId = (req as any).correlationId || `req-${Date.now()}`;

      logger.info("Booking appointment request", {
        correlationId,
        doctorId,
        patientId,
        start,
        end,
      });

      // Validate required fields
      if (!doctorId || !patientId || !start || !end) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: doctorId, patientId, start, end",
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Validate MongoDB ObjectIds
      if (
        !mongoose.Types.ObjectId.isValid(doctorId) ||
        !mongoose.Types.ObjectId.isValid(patientId)
      ) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid doctorId or patientId format",
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const appointment = await appointmentService.bookAppointment({
        doctorId,
        patientId,
        start: new Date(start),
        end: new Date(end),
        reason,
      });

      logger.info("Appointment booked successfully", {
        correlationId,
        appointmentId: appointment._id,
      });

      res.status(201).json({
        success: true,
        data: appointment,
      });
    } catch (error) {
      const correlationId = (req as any).correlationId || `req-${Date.now()}`;

      // Handle booking conflicts - return 409 Conflict
      if (error instanceof AppointmentBookingError) {
        logger.warn("Booking conflict", {
          correlationId,
          error: error.message,
        });

        res.status(409).json({
          success: false,
          error: {
            code: "BOOKING_CONFLICT",
            message: error.message,
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Handle validation errors - return 400 Bad Request
      if (error instanceof ValidationError) {
        logger.warn("Validation error", {
          correlationId,
          error: error.message,
        });

        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Pass other errors to error handler
      next(error);
    }
  }

  /**
   * Get appointments for a doctor on a specific date
   * GET /api/appointments?doctorId=xxx&date=YYYY-MM-DD
   */
  async getAppointments(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { doctorId, date } = req.query;
      const correlationId = (req as any).correlationId || `req-${Date.now()}`;

      if (!doctorId || !date) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required query parameters: doctorId and date",
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const appointments =
        await appointmentService.getAppointmentsByDoctorAndDate(
          doctorId as string,
          new Date(date as string),
        );

      logger.info("Fetched appointments", {
        correlationId,
        doctorId,
        date,
        count: appointments.length,
      });

      res.json({
        success: true,
        data: appointments,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel an appointment
   * POST /api/appointments/:id/cancel
   */
  async cancelAppointment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const correlationId = (req as any).correlationId || `req-${Date.now()}`;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid appointment ID format",
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const appointment = await appointmentService.cancelAppointment(id);

      logger.info("Appointment cancelled", {
        correlationId,
        appointmentId: id,
      });

      res.json({
        success: true,
        data: appointment,
      });
    } catch (error) {
      const correlationId = (req as any).correlationId || `req-${Date.now()}`;

      if (error instanceof Error) {
        if (error.message === "Appointment not found") {
          res.status(404).json({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: error.message,
              correlationId,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        if (error.message === "Appointment is already cancelled") {
          res.status(400).json({
            success: false,
            error: {
              code: "ALREADY_CANCELLED",
              message: error.message,
              correlationId,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      }

      next(error);
    }
  }

  /**
   * Get available time slots for a doctor on a specific date
   * GET /api/availability?doctorId=xxx&date=YYYY-MM-DD&slotMinutes=30
   */
  async getAvailability(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { doctorId, date, slotMinutes } = req.query;
      const correlationId = (req as any).correlationId || `req-${Date.now()}`;

      if (!doctorId || !date) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required query parameters: doctorId and date",
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const slots = await appointmentService.getAvailableSlots(
        doctorId as string,
        new Date(date as string),
        slotMinutes ? parseInt(slotMinutes as string) : 30,
      );

      logger.info("Fetched available slots", {
        correlationId,
        doctorId,
        date,
        slotsCount: slots.length,
      });

      res.json({
        success: true,
        data: slots,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AppointmentController();
