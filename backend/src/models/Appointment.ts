import mongoose, { Schema, Document } from "mongoose";

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  start: Date;
  end: Date;
  status: "BOOKED" | "CANCELLED";
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor ID is required"],
      index: true, // Important: doctorId is frequently queried
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Patient ID is required"],
      index: true,
    },
    start: {
      type: Date,
      required: [true, "Start time is required"],
      index: true, // Critical for time-based queries
      validate: {
        validator: function (this: IAppointment, v: Date) {
          // Start must be in the future (for new appointments)
          if (this.isNew) {
            return v > new Date();
          }
          return true;
        },
        message: "Start time must be in the future",
      },
    },
    end: {
      type: Date,
      required: [true, "End time is required"],
      index: true,
      validate: {
        validator: function (this: IAppointment, v: Date) {
          // End must be after start
          return v > this.start;
        },
        message: "End time must be after start time",
      },
    },
    status: {
      type: String,
      enum: {
        values: ["BOOKED", "CANCELLED"],
        message: "{VALUE} is not a valid status",
      },
      default: "BOOKED",
      index: true, // Frequently filter by status
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// ============================================
// CRITICAL INDEXES FOR PERFORMANCE
// ============================================

// Compound index for overlap detection queries
// This is THE MOST IMPORTANT index for the booking system
AppointmentSchema.index({
  doctorId: 1,
  status: 1,
  start: 1,
  end: 1,
});

// Index for daily appointment queries (list appointments for a day)
AppointmentSchema.index({
  doctorId: 1,
  start: 1,
});

// ============================================
// MIDDLEWARE HOOKS
// ============================================

// Pre-save validation for same-day appointments
AppointmentSchema.pre("save", function (next) {
  // Ensure start and end are on the same day
  const startDay = this.start.toDateString();
  const endDay = this.end.toDateString();

  if (startDay !== endDay) {
    return next(new Error("Appointments must be within the same day"));
  }

  // Validate working hours (9 AM - 5 PM)
  const startHour = this.start.getHours();
  const endHour = this.end.getHours();
  const endMinutes = this.end.getMinutes();

  const clinicStart = parseInt(process.env.CLINIC_START_HOUR || "9");
  const clinicEnd = parseInt(process.env.CLINIC_END_HOUR || "17");

  if (
    startHour < clinicStart ||
    endHour > clinicEnd ||
    (endHour === clinicEnd && endMinutes > 0)
  ) {
    return next(
      new Error(
        `Appointments must be between ${clinicStart}:00 and ${clinicEnd}:00`,
      ),
    );
  }

  next();
});

export default mongoose.model<IAppointment>("Appointment", AppointmentSchema);
