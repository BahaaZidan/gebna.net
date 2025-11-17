CREATE TABLE `account_blob` (
	`accountId` text NOT NULL,
	`sha256` text NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`accountId`, `sha256`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sha256`) REFERENCES `blob`(`sha256`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
	`updatedAt` integer,
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
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
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
CREATE UNIQUE INDEX `ux_address_email` ON `address` (`email`);--> statement-breakpoint
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
CREATE TABLE `change_log` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`type` text NOT NULL,
	`objectId` text NOT NULL,
	`modSeq` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_change_log_account_type_modseq` ON `change_log` (`accountId`,`type`,`modSeq`);--> statement-breakpoint
CREATE INDEX `idx_change_log_account_modseq` ON `change_log` (`accountId`,`modSeq`);--> statement-breakpoint
CREATE TABLE `email_keyword` (
	`accountMessageId` text NOT NULL,
	`keyword` text NOT NULL,
	PRIMARY KEY(`accountMessageId`, `keyword`),
	FOREIGN KEY (`accountMessageId`) REFERENCES `account_message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_email_keyword_keyword` ON `email_keyword` (`keyword`);--> statement-breakpoint
CREATE TABLE `email_submission` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`emailId` text NOT NULL,
	`identityId` text NOT NULL,
	`envelopeJson` text NOT NULL,
	`sendAt` integer,
	`deliveryStatusJson` text NOT NULL,
	`undoStatus` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`emailId`) REFERENCES `account_message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identityId`) REFERENCES `identity`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_email_submission_account` ON `email_submission` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_email_submission_email` ON `email_submission` (`emailId`);--> statement-breakpoint
CREATE INDEX `idx_email_submission_send_at` ON `email_submission` (`sendAt`);--> statement-breakpoint
CREATE TABLE `identity` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`replyToJson` text,
	`bccJson` text,
	`textSignature` text,
	`htmlSignature` text,
	`isDefault` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_identity_account` ON `identity` (`accountId`);--> statement-breakpoint
CREATE TABLE `jmap_state` (
	`accountId` text NOT NULL,
	`type` text NOT NULL,
	`modSeq` integer NOT NULL,
	PRIMARY KEY(`accountId`, `type`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
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
	`updatedAt` integer,
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
CREATE TABLE `message_header` (
	`messageId` text NOT NULL,
	`name` text NOT NULL,
	`lowerName` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_message_header_msg` ON `message_header` (`messageId`);--> statement-breakpoint
CREATE INDEX `idx_message_header_name` ON `message_header` (`lowerName`);--> statement-breakpoint
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
	`size` integer NOT NULL,
	`hasAttachment` integer DEFAULT false NOT NULL,
	`bodyStructureJson` text,
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
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `thread` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`subject` text,
	`latestMessageAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_thread_account_latest` ON `thread` (`accountId`,`latestMessageAt`);--> statement-breakpoint
CREATE TABLE `upload` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`blobSha256` text NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`size` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blobSha256`) REFERENCES `blob`(`sha256`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_upload_account` ON `upload` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_upload_expires` ON `upload` (`expiresAt`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text COLLATE NOCASE NOT NULL,
	`passwordHash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `vacation_response` (
	`accountId` text PRIMARY KEY NOT NULL,
	`isEnabled` integer DEFAULT false NOT NULL,
	`fromDate` integer,
	`toDate` integer,
	`subject` text,
	`textBody` text,
	`htmlBody` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
