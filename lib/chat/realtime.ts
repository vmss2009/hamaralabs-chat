import { EventEmitter } from 'events';

// Simple in-memory pubsub (SSE fallback). For production replace with Redis or Socket.IO server adapter.
class ChatBus extends EventEmitter {}

// One instance per process, even if this module is bundled into several routes
// or re-evaluated by dev hot reload.
const globalForBus = globalThis as unknown as { __chatBus?: ChatBus };
export const chatBus = globalForBus.__chatBus ?? new ChatBus();
globalForBus.__chatBus = chatBus;
// Every open SSE connection adds listeners; they are removed when it closes.
chatBus.setMaxListeners(0);

export type ChatEvents = {
  message: {
    roomId: string;
    messageId: string;
  };
  // Room renamed / membership or roles changed, or room deleted.
  room: {
    roomId: string;
    kind: 'updated' | 'deleted';
  };
};
