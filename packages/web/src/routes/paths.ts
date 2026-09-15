// Every in-app URL is built here, so a segment is renamed in one place rather
// than in every Link that happens to spell it out. `patterns` is what the
// router matches on; `paths` is what a link or a navigate() is given.
const PROFILE = 'u';
const ARCHIVED_GAMES = 'archived-games';
const PLAY = 'play';

export const paths = {
  home: '/',
  hotseat: '/hotseat',
  signin: '/signin',
  lobby: '/lobby',
  play: (roomId: string) => `/${PLAY}/${encodeURIComponent(roomId)}`,
  profile: (userId: string) => `/${PROFILE}/${encodeURIComponent(userId)}`,
  archivedGame: (gameId: string) => `/${ARCHIVED_GAMES}/${encodeURIComponent(gameId)}`,
} as const;

export const patterns = {
  hotseat: paths.hotseat,
  signin: paths.signin,
  lobby: paths.lobby,
  play: `/${PLAY}/:roomId`,
  profile: `/${PROFILE}/:userId`,
  archivedGame: `/${ARCHIVED_GAMES}/:gameId`,
} as const;
