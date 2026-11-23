import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

export default s3;

export const CHAT_BUCKET = "chat";

// Uploaded chat files live under <roomId>/<userId>/ in the bucket.
export function chatObjectKeyPrefix(roomId: string, userId: string) {
  return `${roomId.replaceAll("/", "_")}/${userId.replaceAll("/", "_")}/`;
}

// Deletes every uploaded file under <roomId>/ (all users).
export async function deleteChatRoomObjects(roomId: string) {
  const Prefix = `${roomId.replaceAll("/", "_")}/`;
  let ContinuationToken: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: CHAT_BUCKET, Prefix, ContinuationToken }));
    const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
    if (keys.length) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: CHAT_BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }));
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

export function chatObjectPublicUrl(key: string) {
  const base = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || "").replace(/\/+$/, "");
  return `${base}/${CHAT_BUCKET}/${key}`;
}

// True only for URLs that point at a file this user uploaded to this room.
export function isOwnChatUploadUrl(raw: unknown, roomId: string, userId: string) {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  try {
    const expected = new URL(chatObjectPublicUrl(chatObjectKeyPrefix(roomId, userId)));
    const actual = new URL(raw); // normalises any "../" segments before comparing
    return (
      actual.origin === expected.origin &&
      actual.pathname.startsWith(expected.pathname) &&
      actual.pathname.length > expected.pathname.length &&
      !actual.search &&
      !actual.hash
    );
  } catch {
    return false;
  }
}
