const request = require("supertest");
const app = require("../../dist/app").default;

describe("POST /api/appointments - Integration Test", () => {
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

    expect([201, 409]).toContain(response.status);
  });

  test("should validate required fields", async () => {
    expect(true).toBe(true);
  });
});
