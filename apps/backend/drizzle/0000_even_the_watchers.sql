CREATE TABLE `account_message` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`messageId` text NOT NULL,
	`threadId` text NOT NULL,
	`internalDate` integer NOT NULL,
	`isSeen` integer DEFAULT false NOT NULL,
	`isFlagged` integer DEFAULT false NOT NULL,
	`isAnswered` integer DEFAULT false NOT NULL,
	`isDraft` integer DEFAULT false NOT NULL,
	`isDeleted` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`threadId`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_account_message_account_msg` ON `account_message` (`accountId`,`messageId`);--> statement-breakpoint
CREATE INDEX `idx_account_message_account_date` ON `account_message` (`accountId`,`internalDate`);--> statement-breakpoint
CREATE INDEX `idx_account_message_thread` ON `account_message` (`accountId`,`threadId`,`internalDate`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_account_address` ON `account` (`address`);--> statement-breakpoint
CREATE INDEX `idx_account_user` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `address` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE INDEX `idx_address_email` ON `address` (`email`);--> statement-breakpoint
CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`blobSha256` text NOT NULL,
	`filename` text,
	`mimeType` text NOT NULL,
	`disposition` text,
	`contentId` text,
	`related` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blobSha256`) REFERENCES `blob`(`sha256`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_attachment_message` ON `attachment` (`messageId`,`position`);--> statement-breakpoint
CREATE TABLE `blob` (
	`sha256` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`r2Key` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mailbox_message` (
	`accountMessageId` text NOT NULL,
	`mailboxId` text NOT NULL,
	`addedAt` integer NOT NULL,
	PRIMARY KEY(`accountMessageId`, `mailboxId`),
	FOREIGN KEY (`accountMessageId`) REFERENCES `account_message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailboxId`) REFERENCES `mailbox`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mailbox_message_mailbox` ON `mailbox_message` (`mailboxId`);--> statement-breakpoint
CREATE TABLE `mailbox` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mailbox_account_name` ON `mailbox` (`accountId`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mailbox_account_role` ON `mailbox` (`accountId`,`role`);--> statement-breakpoint
CREATE INDEX `idx_mailbox_account` ON `mailbox` (`accountId`);--> statement-breakpoint
CREATE TABLE `message_address` (
	`messageId` text NOT NULL,
	`addressId` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`messageId`, `addressId`, `kind`, `position`),
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressId`) REFERENCES `address`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_message_address_msg_kind` ON `message_address` (`messageId`,`kind`,`position`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`ingestId` text NOT NULL,
	`rawBlobSha256` text NOT NULL,
	`messageId` text,
	`inReplyTo` text,
	`referencesJson` text,
	`subject` text,
	`snippet` text,
	`sentAt` integer,
	`createdAt` integer NOT NULL,
	`size` integer,
	FOREIGN KEY (`rawBlobSha256`) REFERENCES `blob`(`sha256`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_message_ingest` ON `message` (`ingestId`);--> statement-breakpoint
CREATE INDEX `idx_message_message_id` ON `message` (`messageId`);--> statement-breakpoint
CREATE INDEX `idx_message_created_at` ON `message` (`createdAt`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`refreshHash` text NOT NULL,
	`userAgent` text,
	`ip` text,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`revoked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `thread` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`subject` text,
	`createdAt` integer NOT NULL,
	`latestMessageAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_thread_account_latest` ON `thread` (`accountId`,`latestMessageAt`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text COLLATE NOCASE NOT NULL,
	`passwordHash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);