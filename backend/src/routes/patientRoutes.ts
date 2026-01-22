import { Router } from "express";
import {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  searchPatients,
  getPatientAppointments,
} from "../controllers/patientController";
import { validatePatientCreation } from "../middleware/validation";

const router = Router();

router.post("/", validatePatientCreation, createPatient);
router.get("/", getAllPatients);
router.get("/search", searchPatients);
router.get("/:id", getPatientById);
router.put("/:id", validatePatientCreation, updatePatient);
router.get("/:id/appointments", getPatientAppointments);

export default router;
