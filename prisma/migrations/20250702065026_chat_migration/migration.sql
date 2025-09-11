/*
  Warnings:

  - You are about to drop the `Address` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `City` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Competition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Country` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Course` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomisedCompetition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomisedCourse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomisedTinkeringActivity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `School` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `State` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Student` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subtopic` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TinkeringActivity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Topic` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_city_id_fkey";

-- DropForeignKey
ALTER TABLE "City" DROP CONSTRAINT "City_state_id_fkey";

-- DropForeignKey
ALTER TABLE "CustomisedCompetition" DROP CONSTRAINT "CustomisedCompetition_competition_id_fkey";

-- DropForeignKey
ALTER TABLE "CustomisedCompetition" DROP CONSTRAINT "CustomisedCompetition_student_id_fkey";

-- DropForeignKey
ALTER TABLE "CustomisedCourse" DROP CONSTRAINT "CustomisedCourse_course_id_fkey";

-- DropForeignKey
ALTER TABLE "CustomisedCourse" DROP CONSTRAINT "CustomisedCourse_student_id_fkey";

-- DropForeignKey
ALTER TABLE "CustomisedTinkeringActivity" DROP CONSTRAINT "CustomisedTinkeringActivity_base_ta_id_fkey";

-- DropForeignKey
ALTER TABLE "CustomisedTinkeringActivity" DROP CONSTRAINT "CustomisedTinkeringActivity_student_id_fkey";

-- DropForeignKey
ALTER TABLE "CustomisedTinkeringActivity" DROP CONSTRAINT "CustomisedTinkeringActivity_subtopic_id_fkey";

-- DropForeignKey
ALTER TABLE "School" DROP CONSTRAINT "School_address_id_fkey";

-- DropForeignKey
ALTER TABLE "State" DROP CONSTRAINT "State_country_id_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_school_id_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Subtopic" DROP CONSTRAINT "Subtopic_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "TinkeringActivity" DROP CONSTRAINT "TinkeringActivity_subtopic_id_fkey";

-- DropForeignKey
ALTER TABLE "Topic" DROP CONSTRAINT "Topic_subject_id_fkey";

-- DropTable
DROP TABLE "Address";

-- DropTable
DROP TABLE "City";

-- DropTable
DROP TABLE "Competition";

-- DropTable
DROP TABLE "Country";

-- DropTable
DROP TABLE "Course";

-- DropTable
DROP TABLE "CustomisedCompetition";

-- DropTable
DROP TABLE "CustomisedCourse";

-- DropTable
DROP TABLE "CustomisedTinkeringActivity";

-- DropTable
DROP TABLE "School";

-- DropTable
DROP TABLE "State";

-- DropTable
DROP TABLE "Student";

-- DropTable
DROP TABLE "Subject";

-- DropTable
DROP TABLE "Subtopic";

-- DropTable
DROP TABLE "TinkeringActivity";

-- DropTable
DROP TABLE "Topic";
