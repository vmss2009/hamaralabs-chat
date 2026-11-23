/*
  Room membership gets a role (ADMIN / MEMBER) and a join time.

  The implicit many-to-many table "_ChatRoomMembers" is replaced by an explicit
  "ChatRoomMember" table. Existing memberships are copied across before the old
  table is dropped. Before this migration every member could manage the room, so
  existing members become ADMIN to keep the rights they already had.
*/

-- CreateEnum
CREATE TYPE "RoomRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "ChatRoomMember" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoomRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateIndex
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy existing memberships ("A" = room id, "B" = user id)
INSERT INTO "ChatRoomMember" ("roomId", "userId", "role")
SELECT "A", "B", 'ADMIN' FROM "_ChatRoomMembers";

-- DropForeignKey
ALTER TABLE "_ChatRoomMembers" DROP CONSTRAINT "_ChatRoomMembers_A_fkey";

-- DropForeignKey
ALTER TABLE "_ChatRoomMembers" DROP CONSTRAINT "_ChatRoomMembers_B_fkey";

-- DropTable
DROP TABLE "_ChatRoomMembers";
