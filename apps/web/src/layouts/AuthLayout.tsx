import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
    return (
        <div className="auth-container">
            <div className="bg-orbs">
                <div className="orb orb-1" style={{ background: 'var(--accent-primary)' }}></div>
                <div className="orb orb-2" style={{ background: '#2a2a4a' }}></div>
            </div>
            <Outlet />
        </div>
    );
};

export default AuthLayout;
