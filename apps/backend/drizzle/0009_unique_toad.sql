CREATE TABLE `push_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`deviceClientId` text NOT NULL,
	`url` text NOT NULL,
	`keysAuth` text,
	`keysP256dh` text,
	`typesJson` text,
	`verificationCode` text,
	`expiresAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_push_subscription_account` ON `push_subscription` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_push_subscription_device` ON `push_subscription` (`accountId`,`deviceClientId`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mailbox` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`name` text NOT NULL,
	`parentId` text,
	`role` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parentId`) REFERENCES `mailbox`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_mailbox`("id", "accountId", "name", "parentId", "role", "sortOrder", "createdAt", "updatedAt") SELECT "id", "accountId", "name", "parentId", "role", "sortOrder", "createdAt", "updatedAt" FROM `mailbox`;--> statement-breakpoint
DROP TABLE `mailbox`;--> statement-breakpoint
ALTER TABLE `__new_mailbox` RENAME TO `mailbox`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mailbox_account_name` ON `mailbox` (`accountId`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mailbox_account_role` ON `mailbox` (`accountId`,`role`);--> statement-breakpoint
CREATE INDEX `idx_mailbox_account` ON `mailbox` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_mailbox_parent` ON `mailbox` (`parentId`);