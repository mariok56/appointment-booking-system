import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import {
  getDoctors,
  getAppointments,
  cancelAppointment,
} from "../services/api";

export default function AppointmentsPage() {
  // State
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [appointments, setAppointments] = useState([]);

  // Loading states
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load doctors on mount
  useEffect(() => {
    loadDoctors();
  }, []);

  // Load appointments when doctor and date change
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      loadAppointments();
    } else {
      setAppointments([]);
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

  const loadAppointments = async () => {
    try {
      setLoadingAppointments(true);
      setError("");

      const data = await getAppointments(selectedDoctor, selectedDate);
      setAppointments(data);
    } catch (err) {
      setError("Failed to load appointments");
      setAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleCancel = async (appointmentId) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) {
      return;
    }

    try {
      setCancellingId(appointmentId);
      setError("");
      setSuccess("");

      await cancelAppointment(appointmentId);

      setSuccess("Appointment cancelled successfully");

      // Reload appointments
      loadAppointments();
    } catch (err) {
      const errorMsg =
        err.response?.data?.error?.message || "Failed to cancel appointment";
      setError(errorMsg);
    } finally {
      setCancellingId(null);
    }
  };

  const formatTime = (dateString) => {
    return format(new Date(dateString), "h:mm a");
  };

  const getStatusBadge = (status) => {
    const styles = {
      BOOKED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
      COMPLETED: "bg-blue-100 text-blue-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || "bg-gray-100 text-gray-800"}`}
      >
        {status}
      </span>
    );
  };

  // Generate date options (past 7 days + next 14 days)
  const getDateOptions = () => {
    const dates = [];

    // Past 7 days
    for (let i = -7; i < 0; i++) {
      const date = addDays(new Date(), i);
      dates.push({
        value: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE, MMMM d, yyyy"),
      });
    }

    // Today + next 14 days
    for (let i = 0; i < 15; i++) {
      const date = addDays(new Date(), i);
      dates.push({
        value: format(date, "yyyy-MM-dd"),
        label:
          i === 0
            ? `Today - ${format(date, "MMMM d, yyyy")}`
            : format(date, "EEEE, MMMM d, yyyy"),
      });
    }

    return dates;
  };

  return (
    <div className="px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          View Appointments
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

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Doctor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Doctor
              </label>
              {loadingDoctors ? (
                <div className="text-gray-500">Loading doctors...</div>
              ) : (
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a doctor --</option>
                  {doctors.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>
                      {doctor.name}{" "}
                      {doctor.specialty && `(${doctor.specialty})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!selectedDoctor}
              >
                <option value="">-- Select a date --</option>
                {getDateOptions().map((date) => (
                  <option key={date.value} value={date.value}>
                    {date.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Appointments List */}
        {selectedDoctor && selectedDate && (
          <div className="bg-white rounded-lg shadow-sm">
            {loadingAppointments ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading appointments...</p>
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-2 text-gray-600 font-medium">
                  No appointments found
                </p>
                <p className="text-sm text-gray-500">
                  There are no appointments for this doctor on this date
                </p>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Appointments ({appointments.length})
                  </h3>
                </div>

                {/* List */}
                <ul className="divide-y divide-gray-200">
                  {appointments.map((appointment) => (
                    <li
                      key={appointment._id}
                      className="px-6 py-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Time */}
                          <div className="flex items-center gap-3 mb-2">
                            <svg
                              className="h-5 w-5 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-lg font-medium text-gray-900">
                              {formatTime(appointment.start)} -{" "}
                              {formatTime(appointment.end)}
                            </span>
                            {getStatusBadge(appointment.status)}
                          </div>

                          {/* Patient */}
                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-1">
                            <svg
                              className="h-5 w-5 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            <span>
                              {appointment.patientId?.name || "Unknown Patient"}
                              {appointment.patientId?.email && (
                                <span className="text-gray-500 ml-2">
                                  ({appointment.patientId.email})
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Reason */}
                          {appointment.reason && (
                            <div className="flex items-start gap-3 text-sm text-gray-600">
                              <svg
                                className="h-5 w-5 text-gray-400 mt-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span className="flex-1">
                                {appointment.reason}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="ml-4 flex-shrink-0">
                          {appointment.status === "BOOKED" && (
                            <button
                              onClick={() => handleCancel(appointment._id)}
                              disabled={cancellingId === appointment._id}
                              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {cancellingId === appointment._id ? (
                                <span className="flex items-center">
                                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-red-700 mr-2"></div>
                                  Cancelling...
                                </span>
                              ) : (
                                "Cancel"
                              )}
                            </button>
                          )}
                          {appointment.status === "CANCELLED" && (
                            <span className="text-sm text-gray-500 italic">
                              Cancelled
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!selectedDoctor && !selectedDate && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-gray-600 font-medium">
              Select a doctor and date
            </p>
            <p className="text-sm text-gray-500">
              Choose a doctor and date to view appointments
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
