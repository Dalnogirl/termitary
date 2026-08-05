import { NavLink, Outlet } from 'react-router';

export const RootLayout = () => (
  <div id="layout">
    <nav className="navbar">
      <span className="navbar-brand">Hive</span>
      <ul className="navbar-links">
        <li>
          <NavLink to="/hotseat">Hotseat</NavLink>
        </li>
      </ul>
    </nav>
    <main className="page">
      <Outlet />
    </main>
  </div>
);
