import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api, getAccessToken } from '../../lib/api';

const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
    const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading');

    useEffect(() => {
        if (!getAccessToken()) {
            setStatus('denied');
            return;
        }

        api.users.getMe()
            .then(user => {
                if (user.isAdmin) {
                    setStatus('allowed');
                } else {
                    setStatus('denied');
                }
            })
            .catch(() => {
                setStatus('denied');
            });
    }, []);

    if (status === 'loading') return null;
    if (status === 'denied') return <Navigate to="/" replace />;
    return <>{children}</>;
};

export default RequireAdmin;
