import { LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { navigationItems } from '../config/navigation';

export function AdminLayout(): JSX.Element {
  const { logout, session } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <span className="brand-mark">AI</span>
          <div>
          <strong>会员管理后台</strong>
            <span>{session?.mode === 'remote' ? '真实云函数' : '未配置接口'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <span className="topbar-label">当前操作员</span>
            <strong>{session?.operatorName ?? '管理员'}</strong>
          </div>
          <button className="icon-button" type="button" onClick={logout} aria-label="退出登录" title="退出登录">
            <LogOut size={18} strokeWidth={2} />
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
