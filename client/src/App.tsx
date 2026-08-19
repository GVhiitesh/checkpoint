import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { EventsListPage } from './pages/EventsListPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage';
import { StationScannerPage } from './pages/StationScannerPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requireRole?: 'organizer' | 'attendee' }> = ({
  children,
  requireRole,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to="/events" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <EventsListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-tickets"
                element={
                  <ProtectedRoute requireRole="attendee">
                    <MyTicketsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/:eventId"
                element={
                  <ProtectedRoute requireRole="organizer">
                    <OrganizerDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scanner"
                element={
                  <ProtectedRoute requireRole="organizer">
                    <StationScannerPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/events" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};
