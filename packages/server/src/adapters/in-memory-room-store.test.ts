import { createInMemoryRoomStore } from './in-memory-room-store.js';
import { describeRoomStoreContract } from './room-store.contract.js';

describeRoomStoreContract('InMemoryRoomStore', async () => ({
  store: createInMemoryRoomStore(),
  seedUser: async () => {},
}));
