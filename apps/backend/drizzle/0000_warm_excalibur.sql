CREATE TABLE `address_user` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`userId` text NOT NULL,
	`targetMailboxId` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`avatarPlaceholder` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`targetMailboxId`) REFERENCES `mailbox`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `address_user_uniq` ON `address_user` (`address`,`userId`);--> statement-breakpoint
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
	`recipientId` text NOT NULL,
	`threadId` text NOT NULL,
	`mailboxId` text NOT NULL,
	`unread` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
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
	FOREIGN KEY (`recipientId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`threadId`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailboxId`) REFERENCES `mailbox`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_thread_idx` ON `message` (`threadId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_recipientId_messageId` ON `message` (`recipientId`,`messageId`);--> statement-breakpoint
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
	`from` text NOT NULL,
	`recipientId` text NOT NULL,
	`mailboxId` text NOT NULL,
	`unreadCount` integer DEFAULT 1 NOT NULL,
	`title` text,
	`snippet` text,
	`lastMessageAt` integer NOT NULL,
	`firstMessageId` text,
	`firstMessageSubject` text,
	FOREIGN KEY (`recipientId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
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