import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Use existing correlation ID if provided, otherwise generate new one
  const correlationId =
    (req.headers["x-correlation-id"] as string) || randomUUID();

  // Attach to request headers
  req.headers["x-correlation-id"] = correlationId;

  // Send back in response headers
  res.setHeader("X-Correlation-ID", correlationId);

  next();
};
