ALTER TABLE `session` ADD `refreshHash` text NOT NULL;--> statement-breakpoint
ALTER TABLE `session` ADD `userAgent` text;--> statement-breakpoint
ALTER TABLE `session` ADD `ip` text;--> statement-breakpoint
ALTER TABLE `session` ADD `createdAt` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `session` ADD `revoked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `age`;