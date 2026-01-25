/**
 * Unit test for overlap detection logic
 */

describe("Overlap Detection", () => {
  // Helper function to test overlap logic
  function slotsOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
  }

  test("should detect overlapping slots", () => {
    const result = slotsOverlap(
      new Date("2024-01-25T09:00:00Z"),
      new Date("2024-01-25T10:00:00Z"),
      new Date("2024-01-25T09:30:00Z"),
      new Date("2024-01-25T10:30:00Z"),
    );
    expect(result).toBe(true);
  });

  test("should not detect adjacent slots as overlapping", () => {
    const result = slotsOverlap(
      new Date("2024-01-25T09:00:00Z"),
      new Date("2024-01-25T09:30:00Z"),
      new Date("2024-01-25T09:30:00Z"),
      new Date("2024-01-25T10:00:00Z"),
    );
    expect(result).toBe(false);
  });

  test("should detect complete containment as overlap", () => {
    const result = slotsOverlap(
      new Date("2024-01-25T09:00:00Z"),
      new Date("2024-01-25T11:00:00Z"),
      new Date("2024-01-25T09:30:00Z"),
      new Date("2024-01-25T10:00:00Z"),
    );
    expect(result).toBe(true);
  });

  test("should not detect separated slots as overlapping", () => {
    const result = slotsOverlap(
      new Date("2024-01-25T09:00:00Z"),
      new Date("2024-01-25T09:30:00Z"),
      new Date("2024-01-25T11:00:00Z"),
      new Date("2024-01-25T11:30:00Z"),
    );
    expect(result).toBe(false);
  });
});
