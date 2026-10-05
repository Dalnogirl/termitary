import { GameList } from '../rooms/GameList.js';
import { PlayCard } from '../rooms/PlayCard.js';
import { SeekList } from '../rooms/SeekList.js';
import { useLobby } from '../rooms/use-lobby.js';

export const LobbyPage = () => {
  const lobby = useLobby();
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 p-4 md:p-10">
        <h1 className="sr-only">Lobby</h1>
        <PlayCard lobby={lobby} />
        <GameList lobby={lobby} />
        <SeekList lobby={lobby} />
      </div>
    </div>
  );
};
