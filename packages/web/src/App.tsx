import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';
import { HotseatPage } from './routes/HotseatPage.js';
import { PlayPage } from './routes/PlayPage.js';
import { RootLayout } from './routes/RootLayout.js';

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, element: <Navigate to="/hotseat" replace /> },
      { path: 'hotseat', Component: HotseatPage },
      { path: 'play/:roomId', Component: PlayPage },
    ],
  },
]);

export const App = () => <RouterProvider router={router} />;
