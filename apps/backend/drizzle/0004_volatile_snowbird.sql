DROP INDEX `msg_user_rawsha_uniq`;--> statement-breakpoint
ALTER TABLE `message` ADD `sentTimestamp` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `message` ADD `bccRaw` text;--> statement-breakpoint
ALTER TABLE `message` DROP COLUMN `rawR2Key`;--> statement-breakpoint
ALTER TABLE `message` DROP COLUMN `rawSha256`;--> statement-breakpoint
ALTER TABLE `message` DROP COLUMN `hasAttachment`;