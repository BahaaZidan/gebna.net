PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`threadId` text NOT NULL,
	`messageId` text NOT NULL,
	`ownerId` text NOT NULL,
	`storageKey` text NOT NULL,
	`sizeInBytes` integer NOT NULL,
	`fileName` text,
	`mimeType` text,
	`disposition` text,
	`contentId` text,
	FOREIGN KEY (`threadId`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_attachment`("id", "threadId", "messageId", "ownerId", "storageKey", "sizeInBytes", "fileName", "mimeType", "disposition", "contentId") SELECT "id", "threadId", "messageId", "ownerId", "storageKey", "sizeInBytes", "fileName", "mimeType", "disposition", "contentId" FROM `attachment`;--> statement-breakpoint
DROP TABLE `attachment`;--> statement-breakpoint
ALTER TABLE `__new_attachment` RENAME TO `attachment`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `attachment_messageId_idx` ON `attachment` (`messageId`);--> statement-breakpoint
CREATE INDEX `attachment_threadId_idx` ON `attachment` (`threadId`);