import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AdminApi } from '../services/adminApi';

export function useAdminApi(): AdminApi {
  const { session } = useAuth();

  return useMemo(() => new AdminApi({
    baseUrl: session?.apiBaseUrl ?? '',
    token: session?.token ?? '',
  }), [session?.apiBaseUrl, session?.token]);
}
