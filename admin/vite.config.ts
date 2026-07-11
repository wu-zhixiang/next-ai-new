import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

const LOCAL_ADMIN_API_PREFIX = '/admin-api';

function resolveAdminApiProxyTarget(env: Record<string, string>): string {
  const explicitTarget = env.ADMIN_API_PROXY_TARGET || env.VITE_ADMIN_API_PROXY_TARGET;
  if (explicitTarget) {
    return explicitTarget;
  }

  const legacyBaseUrl = env.VITE_ADMIN_API_BASE_URL ?? '';
  return /^https?:\/\//.test(legacyBaseUrl) ? legacyBaseUrl : '';
}

function createAdminApiProxy(rawTarget: string): ProxyOptions | undefined {
  const trimmedTarget = rawTarget?.trim().replace(/\/$/, '');
  if (!trimmedTarget) {
    return undefined;
  }

  const targetUrl = new URL(trimmedTarget);
  const targetPath = targetUrl.pathname === '/' ? '' : targetUrl.pathname.replace(/\/$/, '');
  const targetAlreadyIncludesAdminApi = targetPath.endsWith(LOCAL_ADMIN_API_PREFIX);

  return {
    target: targetUrl.origin,
    changeOrigin: true,
    rewrite: (path) => {
      if (targetAlreadyIncludesAdminApi && path.startsWith(LOCAL_ADMIN_API_PREFIX)) {
        return `${targetPath}${path.slice(LOCAL_ADMIN_API_PREFIX.length) || ''}`;
      }
      return `${targetPath}${path}`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const adminApiProxyTarget = resolveAdminApiProxyTarget(env);
  const adminApiProxy = createAdminApiProxy(adminApiProxyTarget);

  return {
    base: './',
    plugins: [
      react(),
      {
        name: 'admin-api-proxy-guard',
        configureServer(server) {
          const status = adminApiProxy
            ? `enabled -> ${adminApiProxyTarget}`
            : 'disabled, missing ADMIN_API_PROXY_TARGET';
          server.config.logger.info(`[admin-api-proxy] ${status}`);
          if (adminApiProxy) {
            return;
          }
          server.middlewares.use((request, response, next) => {
            if (!request.url?.startsWith(LOCAL_ADMIN_API_PREFIX)) {
              next();
              return;
            }
            response.statusCode = 502;
            response.setHeader('content-type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({
              code: 502,
              message: '本地代理未配置：请在 admin/.env.local 设置 ADMIN_API_PROXY_TARGET',
              data: null,
            }));
          });
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 5174,
      ...(adminApiProxy ? {
        proxy: {
          [LOCAL_ADMIN_API_PREFIX]: adminApiProxy,
        },
      } : {}),
    },
    preview: {
      host: '127.0.0.1',
      port: 4174,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
