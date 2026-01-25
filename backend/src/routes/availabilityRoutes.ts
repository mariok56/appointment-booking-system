import { Router } from "express";
import appointmentController from "../controllers/appointmentController";
const { getAvailability } = appointmentController;

const router = Router();

/**
 * @route   GET /api/availability
 * @desc    Get available time slots for a doctor on a specific date
 * @access  Public
 * @query   doctorId (required), date (required, YYYY-MM-DD), slotMinutes (optional, default 30)
 *
 * @example
 * GET /api/availability?doctorId=507f1f77bcf86cd799439011&date=2024-01-25&slotMinutes=30
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "date": "2024-01-25",
 *     "doctorId": "507f1f77bcf86cd799439011",
 *     "slotMinutes": 30,
 *     "totalSlots": 12,
 *     "slots": [
 *       { "start": "2024-01-25T09:00:00Z", "end": "2024-01-25T09:30:00Z" },
 *       { "start": "2024-01-25T09:30:00Z", "end": "2024-01-25T10:00:00Z" }
 *     ]
 *   }
 * }
 */
router.get("/", getAvailability);

export default router;
