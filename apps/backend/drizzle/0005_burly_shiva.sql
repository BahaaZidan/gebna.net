CREATE TABLE `blob` (
	`sha256` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `message` ADD `rawSha256` text NOT NULL REFERENCES blob(sha256);--> statement-breakpoint
CREATE UNIQUE INDEX `msg_user_rawsha_uniq` ON `message` (`receiver`,`rawSha256`);