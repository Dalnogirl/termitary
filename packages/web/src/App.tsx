import { RouterProvider, createBrowserRouter } from 'react-router';
import { ArchivedGamePage } from './routes/ArchivedGamePage.js';
import { HomePage } from './routes/HomePage.js';
import { HotseatPage } from './routes/HotseatPage.js';
import { PlayPage } from './routes/PlayPage.js';
import { PlayerProfilePage } from './routes/PlayerProfilePage.js';
import { RequireAuth } from './routes/RequireAuth.js';
import { RootLayout } from './routes/RootLayout.js';
import { RouteError } from './routes/RouteError.js';
import { RulesPage } from './routes/RulesPage.js';
import { SignInPage } from './routes/SignInPage.js';
import { lobbyRedirect } from './routes/lobby-redirect.js';
import { patterns } from './routes/paths.js';

const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: HomePage },
      { path: patterns.hotseat, Component: HotseatPage },
      { path: patterns.rules, Component: RulesPage },
      { path: patterns.signin, Component: SignInPage },
      lobbyRedirect,
      {
        Component: RequireAuth,
        children: [
          { path: patterns.play, Component: PlayPage },
          { path: patterns.profile, Component: PlayerProfilePage },
          { path: patterns.archivedGame, Component: ArchivedGamePage },
        ],
      },
    ],
  },
]);

export const App = () => <RouterProvider router={router} />;
