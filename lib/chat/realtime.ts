import { EventEmitter } from 'events';

// Simple in-memory pubsub (SSE fallback). For production replace with Redis or Socket.IO server adapter.
class ChatBus extends EventEmitter {}
export const chatBus = new ChatBus();

export type ChatEvents = {
  message: {
    roomId: string;
    messageId: string;
  };
};
