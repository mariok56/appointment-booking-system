import mongoose, { Schema, Document } from "mongoose";

export interface IPatient extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    name: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          // Basic phone validation (US format)
          return !v || /^[\d\s\-\+\(\)]+$/.test(v);
        },
        message: "Please provide a valid phone number",
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true, // Automatically converts to lowercase
      validate: {
        validator: function (v: string) {
          // Email regex validation
          return !v || /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
        },
        message: "Please provide a valid email address",
      },
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for searching patients
PatientSchema.index({ name: 1, email: 1 });

export default mongoose.model<IPatient>("Patient", PatientSchema);
