import { Router } from "express";
import {
  createDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  searchDoctors,
} from "../controllers/doctorController";
import { validateDoctorCreation } from "../middleware/validation";

const router = Router();

router.post("/", validateDoctorCreation, createDoctor);
router.get("/", getAllDoctors);
router.get("/search", searchDoctors);
router.get("/:id", getDoctorById);
router.put("/:id", validateDoctorCreation, updateDoctor);

export default router;
