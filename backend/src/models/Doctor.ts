import mongoose, { Schema, Document } from "mongoose";

export interface IDoctor extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  specialty?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    name: {
      type: String,
      required: [true, "Doctor name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    specialty: {
      type: String,
      trim: true,
      maxlength: [100, "Specialty cannot exceed 100 characters"],
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  },
);

// Index for faster queries when searching by name
DoctorSchema.index({ name: 1 });

export default mongoose.model<IDoctor>("Doctor", DoctorSchema);
