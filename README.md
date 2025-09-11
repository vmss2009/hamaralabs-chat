This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Chat Feature (Added)

### Overview
A real-time multi-room chat with file & image uploads (S3), SSE-driven live updates, and Prisma-backed persistence.

### Data Model
- User
- ChatRoom (name, members, lastMessageAt)
- Message (content, type, attachments)
- Attachment (url, type, filename, size)

### Setup Steps
1. Apply new Prisma schema changes:
```bash
npx prisma migrate dev --name chat_feature
npx prisma generate
```
2. Ensure env vars for S3:
```
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PUBLIC_URL=... # public base if different from endpoint
```
3. Start dev server:
```bash
npm run dev
```
4. Login then navigate to `/protected/chat`.

### Uploads
Files are uploaded to bucket `chat` under key `<roomId>/<timestamp>-<filename>`.

### Realtime
Currently uses an in-memory EventEmitter + Server Sent Events. Scale suggestion: replace with Redis pub/sub or Socket.IO adapter.

### Next Improvements
- Typing indicators
- Read receipts
- Infinite scroll (pagination already supported via cursor in API)
- Message editing & deletion
- Presence (online/offline)
- Better error & retry handling
