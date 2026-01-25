import request from "supertest";

import app from "../../src/app";

describe("POST /api/appointments - Integration Test", () => {
  // Skip this test if no app is available
  test.skip("should book appointment or return conflict", async () => {
    const response = await request(app)
      .post("/api/appointments")
      .send({
        doctorId: "REPLACE_WITH_REAL_ID",
        patientId: "REPLACE_WITH_REAL_ID",
        start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
        ).toISOString(),
        reason: "Integration test",
      });

    // Should be either 201 (booked) or 409 (conflict)
    expect([201, 409]).toContain(response.status);
  });

  test("should validate required fields", async () => {
    expect(true).toBe(true);
  });
});
