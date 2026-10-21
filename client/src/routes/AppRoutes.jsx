import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { RequirePermission } from '../components/RequirePermission.jsx';
import { LoginPage } from '../pages/Login/LoginPage.jsx';
import { DashboardPage } from '../pages/Dashboard/DashboardPage.jsx';
import { UsersPage } from '../pages/Users/UsersPage.jsx';
import { UserFormPage } from '../pages/Users/UserFormPage.jsx';
import { SchoolsPage } from '../pages/Schools/SchoolsPage.jsx';
import { SchoolDetailPage } from '../pages/Schools/SchoolDetailPage.jsx';
import { SchoolFormPage } from '../pages/Schools/SchoolFormPage.jsx';
import { ClubsPage } from '../pages/Clubs/ClubsPage.jsx';
import { ClubDetailPage } from '../pages/Clubs/ClubDetailPage.jsx';
import { ClubFormPage } from '../pages/Clubs/ClubFormPage.jsx';
import { ProfilePage } from '../pages/Profile/ProfilePage.jsx';
import { NotFoundPage } from '../pages/NotFound/NotFoundPage.jsx';

/** [path, permission, page]. Guards only hide screens; the API enforces the same rules (D1-3). */
const PROTECTED = [
  ['/clubs', 'club:read', ClubsPage],
  ['/clubs/new', 'club:write', ClubFormPage],
  ['/clubs/:id', 'club:read', ClubDetailPage],
  ['/clubs/:id/edit', 'club:write', ClubFormPage],
  ['/schools', 'school:read', SchoolsPage],
  ['/schools/new', 'school:write', SchoolFormPage],
  ['/schools/:id', 'school:read', SchoolDetailPage],
  ['/schools/:id/edit', 'school:write', SchoolFormPage],
  ['/users', 'user:manage', UsersPage],
  ['/users/new', 'user:manage', UserFormPage],
  ['/users/:id/edit', 'user:manage', UserFormPage],
  ['/profile', 'user:updateSelf', ProfilePage],
];

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
        {PROTECTED.map(([path, permission, Page]) => (
          <Route
            key={path}
            path={path}
            element={
              <RequirePermission permission={permission}>
                <Page />
              </RequirePermission>
            }
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
