import { createInMemoryRoomStore } from './in-memory-room-store.js';
import { describeRoomStoreContract } from './room-store.contract.js';

describeRoomStoreContract('InMemoryRoomStore', async () => {
  let clock = new Date();
  return {
    store: createInMemoryRoomStore(() => clock),
    seedUser: async () => {},
    setNow: (at) => {
      clock = at;
    },
  };
});
