CREATE TABLE `attachment` (
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
	FOREIGN KEY (`threadId`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachment_messageId_idx` ON `attachment` (`messageId`);--> statement-breakpoint
CREATE INDEX `attachment_threadId_idx` ON `attachment` (`threadId`);--> statement-breakpoint
CREATE TABLE `contact` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`ownerId` text NOT NULL,
	`targetMailboxId` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`avatarPlaceholder` text NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`targetMailboxId`) REFERENCES `mailbox`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `address_user_uniq` ON `contact` (`address`,`ownerId`);--> statement-breakpoint
CREATE TABLE `mailbox` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mailbox_user_id` ON `mailbox` (`userId`);--> statement-breakpoint
CREATE INDEX `mailbox_user_id_type` ON `mailbox` (`userId`,`type`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`from` text NOT NULL,
	`ownerId` text NOT NULL,
	`threadId` text NOT NULL,
	`mailboxId` text NOT NULL,
	`direction` text DEFAULT 'inbound' NOT NULL,
	`unseen` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`subject` text,
	`to` text,
	`cc` text,
	`bcc` text,
	`replyTo` text,
	`inReplyTo` text,
	`messageId` text,
	`references` text,
	`snippet` text,
	`bodyText` text,
	`bodyHTML` text,
	`sizeInBytes` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`threadId`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailboxId`) REFERENCES `mailbox`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_thread_idx` ON `message` (`threadId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_ownerId_messageId` ON `message` (`ownerId`,`messageId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`refreshHash` text NOT NULL,
	`userAgent` text,
	`ip` text,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`revoked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `thread` (
	`id` text PRIMARY KEY NOT NULL,
	`firstMessageFrom` text NOT NULL,
	`ownerId` text NOT NULL,
	`mailboxId` text NOT NULL,
	`unseenCount` integer NOT NULL,
	`title` text,
	`snippet` text,
	`lastMessageAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`firstMessageId` text,
	`firstMessageSubject` text,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailboxId`) REFERENCES `mailbox`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_thread_mailbox` ON `thread` (`mailboxId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text COLLATE NOCASE NOT NULL,
	`passwordHash` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`avatarPlaceholder` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);