import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Correlation ID middleware
 *
 * Generates or extracts a unique ID for each request
 *
 * Used for:
 * - Tracing requests through logs
 * - Debugging specific user issues
 * - Distributed tracing across services
 *
 * How it works:
 * 1. Checks if client sent X-Correlation-ID header
 * 2. If yes, uses it (allows client-side request tracking)
 * 3. If no, generates new UUID
 * 4. Attaches to request headers
 * 5. Returns in response headers (so client knows the ID)
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Use existing correlation ID if provided (from API gateway, load balancer, or client)
  // Otherwise generate a new one
  const correlationId = (req.headers["x-correlation-id"] as string) || uuidv4();

  // Attach to request headers for use in controllers/services
  req.headers["x-correlation-id"] = correlationId;

  // Also send back in response headers (for client-side debugging)
  res.setHeader("X-Correlation-ID", correlationId);

  next();
};
