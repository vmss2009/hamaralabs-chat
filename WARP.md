# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project summary
- Next.js (App Router) chat application with Authentik (via NextAuth) authentication, Prisma/PostgreSQL persistence, SSE-based realtime updates, and S3-backed file uploads.
- Key domains: User, ChatRoom, Message, Attachment.

Commands you’ll use often
- Install dependencies
```bash path=null start=null
npm install
```
- Development server
```bash path=null start=null
npm run dev
```
- Lint
```bash path=null start=null
npm run lint
```
- Build and run production server
```bash path=null start=null
npm run build
npm run start
```
- Prisma (database) workflows
  - Apply migrations locally and regenerate client (per README)
```bash path=null start=null
npx prisma migrate dev --name chat_feature
npx prisma generate
```
- Tests
  - No test runner is configured in package.json; single-test execution does not apply.

Environment configuration
Create a .env (or .env.local) with these variables before running locally:
- Database
  - DATABASE_URL=postgres connection string
- NextAuth + Authentik
  - NEXTAUTH_SECRET=secret for NextAuth
  - AUTHENTIK_URL=https://auth.example.com/application/o/… (base used for authorize/token/userinfo)
  - AUTHENTIK_CLIENT_ID=…
  - AUTHENTIK_CLIENT_SECRET=…
  - AUTHENTIK_ISSUER=issuer url if required by provider
- App URL (used for URL parsing in API routes)
  - NEXT_PUBLIC_APP_URL=http://localhost:3000
- S3 storage
  - S3_ENDPOINT=https://s3.example.com (or local/minio endpoint)
  - S3_ACCESS_KEY=…
  - S3_SECRET_KEY=…
  - S3_PUBLIC_URL=public base URL if different from endpoint (used to build returned file URLs)
Notes
- The upload flow uses bucket chat; ensure it exists and your credentials can write to it.
- S3 client is configured with forcePathStyle=true.

Big-picture architecture
- App layer (Next.js App Router)
  - Entry
    - app/page.tsx: redirects to /protected.
    - middleware.ts: redirects unauthenticated users away from /protected and non-auth /api routes to /sign-in; redirects authenticated users away from /sign-in to /protected.
  - Auth
    - app/(auth)/sign-in/page.tsx: client page calling signIn("authentik").
    - app/api/auth/[...nextauth]/route.ts exposes NextAuth handlers from lib/auth/auth.ts.
    - lib/auth/auth.ts: NextAuth configured with Authentik provider.
      - jwt callback: derives a stable token.id (prefers provider sub), ensures a corresponding User exists in DB via ensureUserExists, and stores id on token.
      - session callback: propagates token.id to session.user.id for client use.
  - Protected area
    - app/protected/layout.tsx: wraps children with SessionProvider so client components can use useSession.
    - app/protected/page.tsx: basic authenticated landing.
    - app/protected/chat/page.tsx: main chat UI using TipTap editor; subscribes to SSE updates; renders message HTML via dangerouslySetInnerHTML.
- Data & persistence (Prisma/PostgreSQL)
  - prisma/schema.prisma defines core models:
    - User: id (string, external identity), email, user_meta_data, relations to ChatRoom (members) and Message (sender).
    - ChatRoom: members: User[], messages: Message[], timestamps including lastMessageAt.
    - Message: content (HTML from TipTap), type (TEXT/IMAGE/FILE/CALL), attachments[]; sender and chatRoom relations; 10-minute edit/delete windows enforced in service layer.
    - Attachment: url/type/filename/size and relation to Message.
  - lib/db/prisma.ts exports a singleton Prisma client.
  - lib/db/auth/user.ts provides ensureUserExists and helpers used by auth callbacks.
- Realtime (SSE via in-memory EventEmitter)
  - lib/chat/realtime.ts: chatBus EventEmitter used as pub/sub.
  - app/api/chat/events/route.ts (runtime='nodejs'): SSE endpoint streaming room-scoped events. Heartbeat pings keep-alive; listeners removed on abort.
  - Service layer (lib/chat/messages.ts): emits chatBus 'message' events after create/update/delete and updates ChatRoom.lastMessageAt.
- File storage (S3)
  - lib/storage/storage.ts: S3Client configured from env; region us-east-1, forcePathStyle.
  - app/api/storage/upload/route.ts (runtime='nodejs'): accepts multipart/form-data file, stores to bucket chat under <roomId>/<timestamp>-<filename>, returns public URL and key.
  - app/api/storage/route.ts: simple GET to verify S3 connectivity (lists buckets).
- API surface (selected)
  - /api/chat/rooms GET: list rooms for current user; POST: create room (connects only existing user IDs; returns missing IDs for transparency).
  - /api/chat/messages GET: list messages (cursor pagination supported); POST: send message with HTML content and optional attachments.
  - /api/chat/message PATCH: edit message (sender-only, within 10 minutes); DELETE: delete message (sender-only, within 10 minutes). Status codes reflect authorization/window failures.
  - /api/chat/events GET: SSE stream for a given roomId; clients refresh their message list on event.
  - /api/users GET: returns all users (id, email, user_meta_data). Access relies on middleware to guard /api for unauthenticated users.

How the chat flow fits together
- Rooms
  - listRooms(userId) returns rooms where the user is a member, ordered by lastMessageAt then updatedAt.
  - createRoom(userId, name, memberIds) creates a room; ensures the current user exists (upserts placeholder if missing) and connects only existing user IDs; returns any missing member IDs for the caller to handle.
- Messages
  - sendMessage(roomId, senderId, data) persists content/attachments, bumps lastMessageAt, and emits chatBus 'message' for the room.
  - listMessages(roomId, cursor) returns 30 at a time, newest first (response is reversed to chronological order); provides nextCursor when available.
  - updateMessage/deleteMessage enforce sender-only and 10-minute windows; both emit chatBus events to trigger client refresh.
- Client behavior (app/protected/chat/page.tsx)
  - Subscribes to /api/chat/events?roomId=… via EventSource; on each event, refetches the latest messages for the active room.
  - Composes messages with TipTap StarterKit and posts HTML to /api/chat/messages.
  - Renders message HTML via dangerouslySetInnerHTML.

Notes for future changes
- The realtime layer is in-memory; scale-out requires swapping chatBus for a shared pub/sub (e.g., Redis or a Socket.IO adapter). The README notes this explicitly.
- Message content is stored and rendered as HTML from the editor. If accepting untrusted input sources, consider server-side sanitization before storage or at render time.
- Some dependencies in package.json (e.g., express, socket.io-client) are not currently used in the checked-in code.

References from README.md (Chat Feature)
- Real-time multi-room chat with file & image uploads (S3), SSE live updates, Prisma persistence.
- Data model: User, ChatRoom, Message, Attachment.
- Setup (already reflected above): prisma migrate/generate, S3 env vars, dev server, navigate to /protected/chat.
- Uploads: to bucket chat under <roomId>/<timestamp>-<filename>.
- Realtime: in-memory EventEmitter + SSE; suggested future: Redis pub/sub or Socket.IO adapter.

