ALTER TABLE `contact` RENAME COLUMN "avatar" TO "inferredAvatar";--> statement-breakpoint
CREATE TABLE `address_avatar_inferences` (
	`address` text COLLATE NOCASE PRIMARY KEY NOT NULL,
	`avatarURL` text NOT NULL,
	`lastCheckedAt` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `contact` ADD `uploadedAvatar` text;