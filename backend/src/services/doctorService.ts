import Doctor, { IDoctor } from "../models/Doctor";
import logger from "../config/logger";

class DoctorService {
  /**
   * Create a new doctor
   *
   * @param data - Doctor data (name, specialty)
   * @returns Created doctor
   * @throws ValidationError if data is invalid
   */
  async createDoctor(data: {
    name: string;
    specialty?: string;
  }): Promise<IDoctor> {
    logger.info("Creating new doctor", { name: data.name });

    // Mongoose validation happens automatically
    const doctor = await Doctor.create(data);

    logger.info("Doctor created successfully", {
      doctorId: doctor._id,
      name: doctor.name,
    });

    return doctor;
  }

  /**
   * Get all doctors
   *
   * @returns Array of all doctors
   */
  async getAllDoctors(): Promise<IDoctor[]> {
    const doctors = await Doctor.find()
      .sort({ name: 1 }) // Sort alphabetically
      .lean(); // Performance optimization

    logger.debug("Fetched all doctors", { count: doctors.length });

    return doctors as unknown as IDoctor[];
  }

  /**
   * Get doctor by ID
   *
   * @param id - Doctor ID
   * @returns Doctor or null if not found
   */
  async getDoctorById(id: string): Promise<IDoctor | null> {
    const doctor = await Doctor.findById(id);

    if (!doctor) {
      logger.warn("Doctor not found", { doctorId: id });
    }

    return doctor;
  }

  /**
   * Update doctor information
   *
   * @param id - Doctor ID
   * @param data - Updated data
   * @returns Updated doctor
   * @throws Error if doctor not found
   */
  async updateDoctor(
    id: string,
    data: Partial<{ name: string; specialty: string }>,
  ): Promise<IDoctor> {
    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { $set: data },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      },
    );

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    logger.info("Doctor updated", { doctorId: id });

    return doctor;
  }

  /**
   * Search doctors by name or specialty
   *
   * @param query - Search term
   * @returns Matching doctors
   */
  async searchDoctors(query: string): Promise<IDoctor[]> {
    const doctors = await Doctor.find({
      $or: [
        { name: { $regex: query, $options: "i" } }, // Case-insensitive
        { specialty: { $regex: query, $options: "i" } },
      ],
    }).lean();

    return doctors as unknown as IDoctor[];
  }
}

export default new DoctorService();
