import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { RequirePermission } from '../components/RequirePermission.jsx';
import { LoginPage } from '../pages/Login/LoginPage.jsx';
import { DashboardPage } from '../pages/Dashboard/DashboardPage.jsx';
import { UsersPage } from '../pages/Users/UsersPage.jsx';
import { SchoolsPage } from '../pages/Schools/SchoolsPage.jsx';
import { ClubsPage } from '../pages/Clubs/ClubsPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route
        element={
          <RequirePermission>
            <AppLayout />
          </RequirePermission>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="/clubs"
          element={
            <RequirePermission permission="club:read">
              <ClubsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/schools"
          element={
            <RequirePermission permission="school:read">
              <SchoolsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/users"
          element={
            <RequirePermission permission="user:manage">
              <UsersPage />
            </RequirePermission>
          }
        />
      </Route>
    </Routes>
  );
}
