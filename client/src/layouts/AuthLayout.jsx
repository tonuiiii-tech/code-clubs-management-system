import { Outlet } from 'react-router-dom';
import { DemoBanner } from '../components/DemoBanner.jsx';
import codeClubLogo from '../assets/code-club-logo.png';

export function AuthLayout() {
  return (
    <>
      <DemoBanner />
      <div className="auth-page">
        <div className="auth-card">
          <img className="auth-logo" src={codeClubLogo} alt="Code Club" width={180} />
          <Outlet />
        </div>
      </div>
    </>
  );
}
