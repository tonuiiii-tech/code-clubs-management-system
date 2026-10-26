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
import { LearnersPage } from '../pages/Learners/LearnersPage.jsx';
import { LearnerDetailPage } from '../pages/Learners/LearnerDetailPage.jsx';
import { LearnerFormPage } from '../pages/Learners/LearnerFormPage.jsx';
import { SessionsPage } from '../pages/Sessions/SessionsPage.jsx';
import { SessionDetailPage } from '../pages/Sessions/SessionDetailPage.jsx';
import { SessionFormPage } from '../pages/Sessions/SessionFormPage.jsx';
import { ProfilePage } from '../pages/Profile/ProfilePage.jsx';
import { SyncPage } from '../pages/Sync/SyncPage.jsx';
import { EventsPage } from '../pages/Events/EventsPage.jsx';
import { EventDetailPage } from '../pages/Events/EventDetailPage.jsx';
import { EventFormPage } from '../pages/Events/EventFormPage.jsx';
import { AnnouncementsPage } from '../pages/Announcements/AnnouncementsPage.jsx';
import { ReportsPage } from '../pages/Reports/ReportsPage.jsx';
import { SettingsPage } from '../pages/Settings/SettingsPage.jsx';
import { NotFoundPage } from '../pages/NotFound/NotFoundPage.jsx';
import { EquipmentPage } from '../pages/Equipment/EquipmentPage.jsx';
import { EquipmentDetailPage } from '../pages/Equipment/EquipmentDetailPage.jsx';
import { EquipmentFormPage } from '../pages/Equipment/EquipmentFormPage.jsx';
import { ResourcesPage } from '../pages/Resources/ResourcesPage.jsx';
import { ResourceDetailPage } from '../pages/Resources/ResourceDetailPage.jsx';
import { ResourceFormPage } from '../pages/Resources/ResourceFormPage.jsx';
import { ProjectFormPage } from '../pages/Progress/ProjectFormPage.jsx';
import { AssessmentPage } from '../pages/Progress/AssessmentPage.jsx';
import { AssessmentFormPage } from '../pages/Progress/AssessmentFormPage.jsx';

/** [path, permission, page]. Guards only hide screens; the API enforces the same rules (D1-3). */
const PROTECTED = [
  ['/clubs', 'club:read', ClubsPage],
  ['/clubs/new', 'club:write', ClubFormPage],
  ['/clubs/:id', 'club:read', ClubDetailPage],
  ['/clubs/:id/edit', 'club:write', ClubFormPage],
  ['/learners', 'learner:read', LearnersPage],
  ['/learners/new', 'learner:write', LearnerFormPage],
  ['/learners/:id', 'learner:read', LearnerDetailPage],
  ['/learners/:id/edit', 'learner:write', LearnerFormPage],
  ['/sessions', 'session:read', SessionsPage],
  ['/sessions/new', 'session:write', SessionFormPage],
  ['/sessions/:id', 'session:read', SessionDetailPage],
  ['/sessions/:id/edit', 'session:write', SessionFormPage],
  ['/schools', 'school:read', SchoolsPage],
  ['/schools/new', 'school:write', SchoolFormPage],
  ['/schools/:id', 'school:read', SchoolDetailPage],
  ['/schools/:id/edit', 'school:write', SchoolFormPage],
  ['/users', 'user:manage', UsersPage],
  ['/users/new', 'user:manage', UserFormPage],
  ['/users/:id/edit', 'user:manage', UserFormPage],
  ['/events', 'event:read', EventsPage],
  ['/events/new', 'event:manage', EventFormPage],
  ['/events/:id', 'event:read', EventDetailPage],
  ['/events/:id/edit', 'event:manage', EventFormPage],
  ['/announcements', 'announcement:read', AnnouncementsPage],
  ['/equipment', 'equipment:read', EquipmentPage],
  ['/equipment/new', 'equipment:manage', EquipmentFormPage],
  ['/equipment/:id', 'equipment:read', EquipmentDetailPage],
  ['/equipment/:id/edit', 'equipment:manage', EquipmentFormPage],
  ['/resources', 'resource:read', ResourcesPage],
  ['/resources/new', 'resource:manage', ResourceFormPage],
  ['/resources/:id', 'resource:read', ResourceDetailPage],
  ['/resources/:id/edit', 'resource:manage', ResourceFormPage],
  ['/projects/new', 'progress:record', ProjectFormPage],
  ['/projects/:id/edit', 'progress:record', ProjectFormPage],
  ['/assessments/new', 'progress:record', AssessmentFormPage],
  ['/assessments/:id', 'progress:read', AssessmentPage],
  ['/assessments/:id/edit', 'progress:record', AssessmentFormPage],
  ['/reports', 'report:read', ReportsPage],
  ['/settings', ['term:manage', 'report:schedule'], SettingsPage],
  ['/profile', 'user:updateSelf', ProfilePage],
  // Everyone can open it; it shows sync to those who sync and conflicts to those who may read them.
  ['/sync', 'user:updateSelf', SyncPage],
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
