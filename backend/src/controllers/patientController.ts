import { Request, Response, NextFunction } from "express";
import patientService from "../services/patientService";

/**
 * Controller for patient-related endpoints
 */

/**
 * Create a new patient
 * POST /api/patients
 *
 * Body: {
 *   name: string,
 *   phone?: string,
 *   email?: string
 * }
 */
export const createPatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, phone, email } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Patient name is required",
        },
      });
      return;
    }

    const patient = await patientService.createPatient({
      name,
      phone,
      email,
    });

    res.status(201).json({
      success: true,
      data: patient,
      message: "Patient created successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all patients with pagination
 * GET /api/patients?limit=100&skip=0
 */
export const getAllPatients = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;

    const patients = await patientService.getAllPatients(limit, skip);

    res.json({
      success: true,
      data: {
        count: patients.length,
        limit,
        skip,
        patients,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient by ID
 * GET /api/patients/:id
 */
export const getPatientById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const patient = await patientService.getPatientById(id);

    if (!patient) {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Patient not found",
        },
      });
      return;
    }

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update patient
 * PUT /api/patients/:id
 *
 * Body: {
 *   name?: string,
 *   phone?: string,
 *   email?: string
 * }
 */
export const updatePatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;

    const patient = await patientService.updatePatient(id, {
      name,
      phone,
      email,
    });

    res.json({
      success: true,
      data: patient,
      message: "Patient updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search patients by name, email, or phone
 * GET /api/patients/search?q=searchTerm
 */
export const searchPatients = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q || (q as string).trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Search query is required",
        },
      });
      return;
    }

    const patients = await patientService.searchPatients(q as string);

    res.json({
      success: true,
      data: {
        query: q,
        count: patients.length,
        patients,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient's appointment history
 * GET /api/patients/:id/appointments
 */
export const getPatientAppointments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const appointments = await patientService.getPatientAppointments(id);

    res.json({
      success: true,
      data: {
        patientId: id,
        count: appointments.length,
        appointments,
      },
    });
  } catch (error) {
    next(error);
  }
};
