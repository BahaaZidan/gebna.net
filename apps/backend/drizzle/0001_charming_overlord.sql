CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`userId` text NOT NULL,
	`storageKey` text NOT NULL,
	`sizeInBytes` integer NOT NULL,
	`fileName` text,
	`mimeType` text,
	`disposition` text,
	`contentId` text,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachment_messageId_idx` ON `attachment` (`messageId`);--> statement-breakpoint
CREATE INDEX `attachment_userId_idx` ON `attachment` (`userId`);--> statement-breakpoint
ALTER TABLE `message` ADD `sizeInBytes` integer NOT NULL;--> statement-breakpoint
CREATE INDEX `message_thread_idx` ON `message` (`threadId`);--> statement-breakpoint
CREATE INDEX `idx_thread_mailbox` ON `thread` (`mailboxId`);