DROP INDEX "user_username_unique";--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "username" TO "username" text COLLATE NOCASE NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);