import { RouterProvider, createBrowserRouter } from 'react-router';
import { HomePage } from './routes/HomePage.js';
import { HotseatPage } from './routes/HotseatPage.js';
import { LobbyPage } from './routes/LobbyPage.js';
import { PlayPage } from './routes/PlayPage.js';
import { RequireAuth } from './routes/RequireAuth.js';
import { RootLayout } from './routes/RootLayout.js';
import { SignInPage } from './routes/SignInPage.js';

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: 'hotseat', Component: HotseatPage },
      { path: 'signin', Component: SignInPage },
      {
        Component: RequireAuth,
        children: [
          { path: 'lobby', Component: LobbyPage },
          { path: 'play/:roomId', Component: PlayPage },
        ],
      },
    ],
  },
]);

export const App = () => <RouterProvider router={router} />;
