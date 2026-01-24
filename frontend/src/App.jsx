import { Routes, Route, Link, useLocation } from "react-router-dom";
import BookingPage from "./pages/BookingPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ManageDoctorsPage from "./pages/ManageDoctorsPage";
import ManagePatientsPage from "./pages/ManagePatientsPage";

function App() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const linkClass = (path) => {
    return isActive(path)
      ? "border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-blue-600">
                  Clinic Appointments
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link to="/" className={linkClass("/")}>
                  Book Appointment
                </Link>
                <Link to="/appointments" className={linkClass("/appointments")}>
                  View Appointments
                </Link>
                <Link to="/doctors" className={linkClass("/doctors")}>
                  Manage Doctors
                </Link>
                <Link to="/patients" className={linkClass("/patients")}>
                  Manage Patients
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/doctors" element={<ManageDoctorsPage />} />
          <Route path="/patients" element={<ManagePatientsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
