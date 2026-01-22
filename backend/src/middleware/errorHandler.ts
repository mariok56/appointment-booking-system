import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";
import {
  AppointmentBookingError,
  ValidationError,
} from "../services/appointmentService";

/**
 * Centralized error handling middleware
 *
 * This middleware:
 * 1. Logs all errors with correlation ID
 * 2. Maps domain errors to HTTP status codes
 * 3. Formats error responses consistently
 * 4. Hides sensitive error details in production
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const correlationId = req.headers["x-correlation-id"] as string;

  // Log the error
  logger.error("Error occurred", {
    correlationId,
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
  });

  // Handle Mongoose validation errors
  if (error.name === "ValidationError") {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
        details: error.errors, // Mongoose validation details
        correlationId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (error.name === "CastError") {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ID",
        message: `Invalid ${error.path}: ${error.value}`,
        correlationId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle custom AppointmentBookingError
  if (error instanceof AppointmentBookingError) {
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

  // Handle custom ValidationError
  if (error instanceof ValidationError) {
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

  // Handle MongoDB duplicate key error (E11000)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_ERROR",
        message: field ? `${field} already exists` : "Duplicate entry",
        correlationId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Default to 500 Internal Server Error
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message, // Show details in development
      correlationId,
      timestamp: new Date().toISOString(),
      // Only include stack trace in development
      ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
    },
  });
};

/**
 * 404 Not Found handler
 * This runs if no route matches
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    },
  });
};
