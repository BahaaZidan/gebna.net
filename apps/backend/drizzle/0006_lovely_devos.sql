CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`filename` text,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`cid` text,
	`disposition` text DEFAULT 'attachment' NOT NULL,
	`sha256` text NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sha256`) REFERENCES `blob`(`sha256`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `att_msg_idx` ON `attachment` (`messageId`);--> statement-breakpoint
CREATE UNIQUE INDEX `att_msg_sha_uniq` ON `attachment` (`messageId`,`sha256`);--> statement-breakpoint
ALTER TABLE `message` ADD `attachmentsPreview` text DEFAULT '[]' NOT NULL;