import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Outlet />
      </div>
    </div>
  );
}
