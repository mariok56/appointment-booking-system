import { Router } from "express";
import {
  bookAppointment,
  cancelAppointment,
  getAppointments,
} from "../controllers/appointmentController";
import { validateAppointmentBooking } from "../middleware/validation";

const router = Router();

/**
 * @route   POST /api/appointments
 * @desc    Book a new appointment
 * @access  Public (would be authenticated in production)
 * @body    { doctorId, patientId, start, end, reason? }
 */
router.post("/", validateAppointmentBooking, bookAppointment);

/**
 * @route   GET /api/appointments
 * @desc    Get appointments for a doctor on a specific date
 * @access  Public
 * @query   doctorId (required), date (required, YYYY-MM-DD)
 */
router.get("/", getAppointments);

/**
 * @route   POST /api/appointments/:id/cancel
 * @desc    Cancel an appointment
 * @access  Public (would be authenticated in production)
 * @param   id - Appointment ID
 */
router.post("/:id/cancel", cancelAppointment);

export default router;
