import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import {
  getDoctors,
  getPatients,
  getAvailableSlots,
  bookAppointment,
} from "../services/api";

export default function BookingPage() {
  // State
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState("");

  // Loading states
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  // Messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load doctors and patients on mount
  useEffect(() => {
    loadDoctors();
    loadPatients();
  }, []);

  // Load available slots when doctor and date change
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      loadAvailableSlots();
    } else {
      setAvailableSlots([]);
      setSelectedSlot(null);
    }
  }, [selectedDoctor, selectedDate]);

  const loadDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const data = await getDoctors();
      setDoctors(data);
    } catch (err) {
      setError("Failed to load doctors");
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const data = await getPatients();
      setPatients(data);
    } catch (err) {
      setError("Failed to load patients");
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      setError("");
      setSelectedSlot(null);

      const slots = await getAvailableSlots(selectedDoctor, selectedDate);
      setAvailableSlots(slots);

      if (slots.length === 0) {
        setError("No available slots for this date");
      }
    } catch (err) {
      setError("Failed to load available slots");
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBooking = async (e) => {
    e.preventDefault();

    if (!selectedDoctor || !selectedPatient || !selectedSlot) {
      setError("Please select doctor, patient, and time slot");
      return;
    }

    try {
      setBooking(true);
      setError("");
      setSuccess("");

      await bookAppointment({
        doctorId: selectedDoctor,
        patientId: selectedPatient,
        start: selectedSlot.start,
        end: selectedSlot.end,
        reason: reason.trim() || undefined,
      });

      setSuccess("Appointment booked successfully!");

      // Reset form
      setSelectedSlot(null);
      setReason("");

      // Reload available slots
      loadAvailableSlots();
    } catch (err) {
      const errorMsg =
        err.response?.data?.error?.message || "Failed to book appointment";
      setError(errorMsg);
    } finally {
      setBooking(false);
    }
  };

  const formatSlotTime = (slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    return `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
  };

  // Generate next 14 days for date picker
  const getAvailableDates = () => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(new Date(), i);
      dates.push({
        value: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE, MMMM d, yyyy"),
      });
    }
    return dates;
  };

  return (
    <div className="px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Book an Appointment
        </h2>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleBooking} className="space-y-6">
          {/* Doctor Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Doctor *
            </label>
            {loadingDoctors ? (
              <div className="text-gray-500">Loading doctors...</div>
            ) : (
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Select a doctor --</option>
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {doctor.name} {doctor.specialty && `(${doctor.specialty})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date *
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={!selectedDoctor}
            >
              <option value="">-- Select a date --</option>
              {getAvailableDates().map((date) => (
                <option key={date.value} value={date.value}>
                  {date.label}
                </option>
              ))}
            </select>
          </div>

          {/* Available Slots */}
          {selectedDoctor && selectedDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Time Slots *
              </label>

              {loadingSlots ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">
                    Loading available slots...
                  </p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-600">
                    No available slots for this date
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Please try another date
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        selectedSlot === slot
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {formatSlotTime(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Patient *
            </label>
            {loadingPatients ? (
              <div className="text-gray-500">Loading patients...</div>
            ) : (
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Select a patient --</option>
                {patients.map((patient) => (
                  <option key={patient._id} value={patient._id}>
                    {patient.name} {patient.email && `(${patient.email})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Visit (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Annual checkup, follow-up visit, consultation..."
            />
            <p className="mt-1 text-sm text-gray-500">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedDoctor("");
                setSelectedPatient("");
                setSelectedDate("");
                setSelectedSlot(null);
                setReason("");
                setError("");
                setSuccess("");
              }}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={
                booking || !selectedDoctor || !selectedPatient || !selectedSlot
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {booking ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Booking...
                </>
              ) : (
                "Book Appointment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
