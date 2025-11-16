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
	`deliveryStatusJson` text,
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
--> statement-breakpoint
DROP INDEX "ux_account_message_account_msg";--> statement-breakpoint
DROP INDEX "idx_account_message_account_date";--> statement-breakpoint
DROP INDEX "idx_account_message_thread";--> statement-breakpoint
DROP INDEX "ux_account_address";--> statement-breakpoint
DROP INDEX "idx_account_user";--> statement-breakpoint
DROP INDEX "idx_address_email";--> statement-breakpoint
DROP INDEX "idx_attachment_message";--> statement-breakpoint
DROP INDEX "idx_email_keyword_keyword";--> statement-breakpoint
DROP INDEX "idx_email_submission_account";--> statement-breakpoint
DROP INDEX "idx_email_submission_email";--> statement-breakpoint
DROP INDEX "idx_identity_account";--> statement-breakpoint
DROP INDEX "idx_mailbox_message_mailbox";--> statement-breakpoint
DROP INDEX "ux_mailbox_account_name";--> statement-breakpoint
DROP INDEX "ux_mailbox_account_role";--> statement-breakpoint
DROP INDEX "idx_mailbox_account";--> statement-breakpoint
DROP INDEX "idx_message_address_msg_kind";--> statement-breakpoint
DROP INDEX "ux_message_ingest";--> statement-breakpoint
DROP INDEX "idx_message_message_id";--> statement-breakpoint
DROP INDEX "idx_message_created_at";--> statement-breakpoint
DROP INDEX "idx_thread_account_latest";--> statement-breakpoint
DROP INDEX "idx_upload_account";--> statement-breakpoint
DROP INDEX "idx_upload_expires";--> statement-breakpoint
DROP INDEX "user_username_unique";--> statement-breakpoint
ALTER TABLE `account_message` ALTER COLUMN "updatedAt" TO "updatedAt" integer;--> statement-breakpoint
CREATE UNIQUE INDEX `ux_account_message_account_msg` ON `account_message` (`accountId`,`messageId`);--> statement-breakpoint
CREATE INDEX `idx_account_message_account_date` ON `account_message` (`accountId`,`internalDate`);--> statement-breakpoint
CREATE INDEX `idx_account_message_thread` ON `account_message` (`accountId`,`threadId`,`internalDate`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_account_address` ON `account` (`address`);--> statement-breakpoint
CREATE INDEX `idx_account_user` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_address_email` ON `address` (`email`);--> statement-breakpoint
CREATE INDEX `idx_attachment_message` ON `attachment` (`messageId`,`position`);--> statement-breakpoint
CREATE INDEX `idx_mailbox_message_mailbox` ON `mailbox_message` (`mailboxId`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mailbox_account_name` ON `mailbox` (`accountId`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_mailbox_account_role` ON `mailbox` (`accountId`,`role`);--> statement-breakpoint
CREATE INDEX `idx_mailbox_account` ON `mailbox` (`accountId`);--> statement-breakpoint
CREATE INDEX `idx_message_address_msg_kind` ON `message_address` (`messageId`,`kind`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_message_ingest` ON `message` (`ingestId`);--> statement-breakpoint
CREATE INDEX `idx_message_message_id` ON `message` (`messageId`);--> statement-breakpoint
CREATE INDEX `idx_message_created_at` ON `message` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_thread_account_latest` ON `thread` (`accountId`,`latestMessageAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
ALTER TABLE `message` ALTER COLUMN "size" TO "size" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `message` ADD `hasAttachment` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mailbox` ADD `updatedAt` integer;--> statement-breakpoint
ALTER TABLE `thread` ADD `updatedAt` integer;