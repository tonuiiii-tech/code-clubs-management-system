import { Outlet } from 'react-router-dom';
import { DemoBanner } from '../components/DemoBanner.jsx';

export function AuthLayout() {
  return (
    <>
      <DemoBanner />
      <div className="auth-page">
        <div className="auth-card">
          <Outlet />
        </div>
      </div>
    </>
  );
}
