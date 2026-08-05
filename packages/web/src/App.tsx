import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';
import { HotseatPage } from './routes/HotseatPage.js';
import { RootLayout } from './routes/RootLayout.js';

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, element: <Navigate to="/hotseat" replace /> },
      { path: 'hotseat', Component: HotseatPage },
    ],
  },
]);

export const App = () => <RouterProvider router={router} />;
