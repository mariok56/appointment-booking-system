import Patient, { IPatient } from "../models/Patient";
import logger from "../config/logger";

class PatientService {
  /**
   * Create a new patient
   *
   * @param data - Patient data (name, phone, email)
   * @returns Created patient
   * @throws ValidationError if data is invalid (e.g., invalid email)
   */
  async createPatient(data: {
    name: string;
    phone?: string;
    email?: string;
  }): Promise<IPatient> {
    logger.info("Creating new patient", { name: data.name });

    // Check for duplicate email if provided
    if (data.email) {
      const existing = await Patient.findOne({
        email: data.email.toLowerCase(),
      });

      if (existing) {
        logger.warn("Patient with email already exists", {
          email: data.email,
        });
        throw new Error("Patient with this email already exists");
      }
    }

    const patient = await Patient.create(data);

    logger.info("Patient created successfully", {
      patientId: patient._id,
      name: patient.name,
    });

    return patient;
  }

  /**
   * Get all patients
   *
   * @param limit - Optional limit for pagination
   * @param skip - Optional skip for pagination
   * @returns Array of patients
   */
  async getAllPatients(
    limit: number = 100,
    skip: number = 0,
  ): Promise<IPatient[]> {
    const patients = await Patient.find()
      .sort({ name: 1 })
      .limit(limit)
      .skip(skip)
      .lean();

    logger.debug("Fetched patients", {
      count: patients.length,
      limit,
      skip,
    });

    return patients as unknown as IPatient[];
  }

  /**
   * Get patient by ID
   *
   * @param id - Patient ID
   * @returns Patient or null if not found
   */
  async getPatientById(id: string): Promise<IPatient | null> {
    const patient = await Patient.findById(id);

    if (!patient) {
      logger.warn("Patient not found", { patientId: id });
    }

    return patient;
  }

  /**
   * Update patient information
   *
   * @param id - Patient ID
   * @param data - Updated data
   * @returns Updated patient
   * @throws Error if patient not found or email already exists
   */
  async updatePatient(
    id: string,
    data: Partial<{ name: string; phone: string; email: string }>,
  ): Promise<IPatient> {
    // If updating email, check for duplicates
    if (data.email) {
      const existing = await Patient.findOne({
        email: data.email.toLowerCase(),
        _id: { $ne: id }, // Exclude current patient
      });

      if (existing) {
        throw new Error("Email already in use by another patient");
      }
    }

    const patient = await Patient.findByIdAndUpdate(
      id,
      { $set: data },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!patient) {
      throw new Error("Patient not found");
    }

    logger.info("Patient updated", { patientId: id });

    return patient;
  }

  /**
   * Search patients by name, email, or phone
   *
   * @param query - Search term
   * @returns Matching patients
   */
  async searchPatients(query: string): Promise<IPatient[]> {
    const patients = await Patient.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ],
    })
      .limit(50) // Limit search results
      .lean();

    return patients as unknown as IPatient[];
  }

  /**
   * Get patient's appointment history
   *
   * @param patientId - Patient ID
   * @returns Patient with populated appointments
   */
  async getPatientAppointments(patientId: string) {
    const Appointment = (await import("../models/Appointment")).default;

    const appointments = await Appointment.find({
      patientId,
    })
      .populate("doctorId", "name specialty")
      .sort({ start: -1 }) // Most recent first
      .lean();

    return appointments;
  }
}

export default new PatientService();
