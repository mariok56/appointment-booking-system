import { Request, Response, NextFunction } from "express";
import doctorService from "../services/doctorService";

/**
 * Controller for doctor-related endpoints
 */

/**
 * Create a new doctor
 * POST /api/doctors
 *
 * Body: {
 *   name: string,
 *   specialty?: string
 * }
 */
export const createDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, specialty } = req.body;

    // Basic validation (Joi middleware does more)
    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Doctor name is required",
        },
      });
      return;
    }

    const doctor = await doctorService.createDoctor({ name, specialty });

    res.status(201).json({
      success: true,
      data: doctor,
      message: "Doctor created successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all doctors
 * GET /api/doctors
 */
export const getAllDoctors = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const doctors = await doctorService.getAllDoctors();

    res.json({
      success: true,
      data: {
        count: doctors.length,
        doctors,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get doctor by ID
 * GET /api/doctors/:id
 */
export const getDoctorById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const doctor = await doctorService.getDoctorById(id);

    if (!doctor) {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Doctor not found",
        },
      });
      return;
    }

    res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update doctor
 * PUT /api/doctors/:id
 *
 * Body: {
 *   name?: string,
 *   specialty?: string
 * }
 */
export const updateDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, specialty } = req.body;

    const doctor = await doctorService.updateDoctor(id, { name, specialty });

    res.json({
      success: true,
      data: doctor,
      message: "Doctor updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search doctors by name or specialty
 * GET /api/doctors/search?q=searchTerm
 */
export const searchDoctors = async (
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

    const doctors = await doctorService.searchDoctors(q as string);

    res.json({
      success: true,
      data: {
        query: q,
        count: doctors.length,
        doctors,
      },
    });
  } catch (error) {
    next(error);
  }
};
