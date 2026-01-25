import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message || error.message;
    console.error("API Error:", message);
    return Promise.reject(error);
  },
);

// ============================================
// Doctors API
// ============================================

export const getDoctors = async () => {
  const response = await api.get("/doctors");
  return response.data.data.doctors;
};

export const getDoctorById = async (id) => {
  const response = await api.get(`/doctors/${id}`);
  return response.data.data;
};

export const createDoctor = async (doctorData) => {
  const response = await api.post("/doctors", doctorData);
  return response.data.data;
};

// ============================================
// Patients API
// ============================================

export const getPatients = async (limit = 100) => {
  const response = await api.get(`/patients?limit=${limit}`);
  return response.data.data.patients;
};

export const createPatient = async (patientData) => {
  const response = await api.post("/patients", patientData);
  return response.data.data;
};

// ============================================
// Appointments API
// ============================================

export const getAppointments = async (doctorId, date) => {
  const response = await api.get("/appointments", {
    params: { doctorId, date },
  });
  // Backend returns array directly in data, not { appointments: [...] }
  return response.data.data;
};

export const bookAppointment = async (appointmentData) => {
  const response = await api.post("/appointments", appointmentData);
  return response.data.data;
};

export const cancelAppointment = async (appointmentId) => {
  const response = await api.post(`/appointments/${appointmentId}/cancel`);
  return response.data.data;
};

// ============================================
// Availability API
// ============================================

export const getAvailableSlots = async (doctorId, date, slotMinutes = 30) => {
  const response = await api.get("/availability", {
    params: { doctorId, date, slotMinutes },
  });

  return response.data.data;
};

export default api;
