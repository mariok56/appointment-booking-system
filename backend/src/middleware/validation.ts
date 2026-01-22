import { Request, Response, NextFunction } from "express";
import Joi from "joi";

/**
 * Validation middleware using Joi
 *
 * Joi provides:
 * - Type validation (string, number, date)
 * - Format validation (email, URL, UUID)
 * - Custom validation rules
 * - Clear error messages
 */

/**
 * Validate appointment booking request
 */
export const validateAppointmentBooking = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const schema = Joi.object({
    doctorId: Joi.string()
      .required()
      .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId format
      .messages({
        "string.pattern.base": "Invalid doctor ID format",
        "any.required": "Doctor ID is required",
      }),

    patientId: Joi.string()
      .required()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .messages({
        "string.pattern.base": "Invalid patient ID format",
        "any.required": "Patient ID is required",
      }),

    start: Joi.string()
      .required()
      .isoDate() // Must be ISO 8601 format
      .messages({
        "string.isoDate": "Start time must be in ISO 8601 format",
        "any.required": "Start time is required",
      }),

    end: Joi.string().required().isoDate().messages({
      "string.isoDate": "End time must be in ISO 8601 format",
      "any.required": "End time is required",
    }),

    reason: Joi.string().max(500).optional().messages({
      "string.max": "Reason cannot exceed 500 characters",
    }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path[0],
      message: detail.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: errors,
      },
    });
    return;
  }

  next();
};

/**
 * Validate doctor creation request
 */
export const validateDoctorCreation = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const schema = Joi.object({
    name: Joi.string().required().min(2).max(100).trim().messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 100 characters",
      "any.required": "Name is required",
    }),

    specialty: Joi.string().max(100).trim().optional().messages({
      "string.max": "Specialty cannot exceed 100 characters",
    }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path[0],
      message: detail.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: errors,
      },
    });
    return;
  }

  next();
};

/**
 * Validate patient creation request
 */
export const validatePatientCreation = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const schema = Joi.object({
    name: Joi.string().required().min(2).max(100).trim().messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 100 characters",
      "any.required": "Name is required",
    }),

    phone: Joi.string()
      .pattern(/^[\d\s\-\+\(\)]+$/)
      .optional()
      .messages({
        "string.pattern.base": "Invalid phone number format",
      }),

    email: Joi.string().email().optional().messages({
      "string.email": "Invalid email format",
    }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path[0],
      message: detail.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: errors,
      },
    });
    return;
  }

  next();
};
