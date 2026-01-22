import { Router } from "express";
import appointmentRoutes from "./appointmentRoutes";
import availabilityRoutes from "./availabilityRoutes";
import doctorRoutes from "./doctorRoutes";
import patientRoutes from "./patientRoutes";
import healthRoutes from "./healthRoutes";

const router = Router();

/**
 * Central route configuration
 *
 * All API routes are prefixed with /api in app.ts
 * So these become:
 * - /api/appointments
 * - /api/availability
 * - /api/doctors
 * - /api/patients
 *
 * Health check is at root level: /health
 */

// API routes
router.use("/appointments", appointmentRoutes);
router.use("/availability", availabilityRoutes);
router.use("/doctors", doctorRoutes);
router.use("/patients", patientRoutes);

export { healthRoutes };
export default router;
