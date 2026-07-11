import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { useAuth } from '../../auth/AuthProvider';

interface LocationState {
  readonly from?: string;
}

function isLocationState(value: unknown): value is LocationState {
  return typeof value === 'object' && value !== null && (!('from' in value) || typeof value.from === 'string');
}

export function LoginPage(): JSX.Element {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = isLocationState(location.state) ? location.state : {};
  const redirectTo = state.from ?? '/dashboard';
  const isLocalDev = import.meta.env.DEV;

  const [operatorName, setOperatorName] = useState('管理员');
  const [apiBaseUrl, setApiBaseUrl] = useState(import.meta.env.VITE_ADMIN_API_BASE_URL || '/admin-api');
  const [token, setToken] = useState('');

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    login({
      operatorName,
      apiBaseUrl,
      token,
      mode: 'remote',
    });
    navigate(redirectTo, { replace: true });
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark">AI</span>
          <div>
            <h1 id="login-title">AI 会员管理后台</h1>
            <p>用户、订单、AI 新闻与 AI 工具运营管理</p>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>操作员</span>
            <input
              required
              type="text"
              value={operatorName}
              onChange={(event) => setOperatorName(event.target.value)}
              placeholder="请输入操作员名称"
            />
          </label>

          <label className="field">
            <span>接口地址</span>
            <input
              required
              type="text"
              value={apiBaseUrl}
              disabled={isLocalDev}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="/admin-api"
            />
          </label>

          <label className="field">
            <span>访问密钥</span>
            <input
              required
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Bearer Token"
            />
          </label>

          <div className="button-row">
            <Button type="submit" variant="primary" icon={<LogIn size={16} strokeWidth={2} />}>
              进入后台
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
