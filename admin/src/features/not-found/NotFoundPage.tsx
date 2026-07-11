import { Link } from 'react-router-dom';

export function NotFoundPage(): JSX.Element {
  return (
    <main className="not-found">
      <section>
        <h1>页面不存在</h1>
        <p>当前地址没有对应的后台模块。</p>
        <Link className="button button--primary button--md" to="/dashboard">返回总览</Link>
      </section>
    </main>
  );
}
