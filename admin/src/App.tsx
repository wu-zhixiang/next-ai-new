import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { AppConfigPage } from './features/app-config/AppConfigPage';
import { FileUploadPage } from './features/files/FileUploadPage';
import { LoginPage } from './features/login/LoginPage';
import { NewsPage } from './features/news/NewsPage';
import { NotFoundPage } from './features/not-found/NotFoundPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { MemberPlanEditPage } from './features/plans/MemberPlanEditPage';
import { MemberPlansPage } from './features/plans/MemberPlansPage';
import { PointsConfigPage } from './features/points/PointsConfigPage';
import { ProductTypeEditPage } from './features/product-types/ProductTypeEditPage';
import { ProductTypesPage } from './features/product-types/ProductTypesPage';
import { ToolEditPage } from './features/tools/ToolEditPage';
import { ToolsPage } from './features/tools/ToolsPage';
import { UsersPage } from './features/users/UsersPage';

export function App(): JSX.Element {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/product-types" element={<ProductTypesPage />} />
              <Route path="/product-types/new" element={<ProductTypeEditPage />} />
              <Route path="/product-types/:productId/edit" element={<ProductTypeEditPage />} />
              <Route path="/plans" element={<MemberPlansPage />} />
              <Route path="/plans/new" element={<MemberPlanEditPage />} />
              <Route path="/plans/:planId/edit" element={<MemberPlanEditPage />} />
              <Route path="/points-config" element={<PointsConfigPage />} />
              <Route path="/app-config" element={<AppConfigPage />} />
              <Route path="/files" element={<FileUploadPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/tools/new" element={<ToolEditPage />} />
              <Route path="/tools/:toolId/edit" element={<ToolEditPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
