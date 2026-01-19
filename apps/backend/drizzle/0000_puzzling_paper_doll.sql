CREATE TABLE `conversation_participant` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`identityId` text NOT NULL,
	`role` text NOT NULL,
	`state` text NOT NULL,
	`joinedAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`lastReadMessageId` text,
	FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identityId`) REFERENCES `identity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lastReadMessageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_participant` ON `conversation_participant` (`conversationId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_conversation` ON `conversation_participant` (`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_identity` ON `conversation_participant` (`identityId`);--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text,
	`dmKey` text,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`lastMessageAt` integer DEFAULT (strftime('%s','now')),
	CONSTRAINT "chk_conversation_dmkey_kind" CHECK((
				("conversation"."kind" = 'PRIVATE' AND "conversation"."dmKey" IS NOT NULL AND length("conversation"."dmKey") > 0)
				OR
				("conversation"."kind" = 'GROUP' AND "conversation"."dmKey" IS NULL)
			))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_dm_key` ON `conversation` (`dmKey`);--> statement-breakpoint
CREATE INDEX `idx_conversation_kind_updated` ON `conversation` (`kind`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_conversation_last_message_at` ON `conversation` (`lastMessageAt`);--> statement-breakpoint
CREATE TABLE `conversation_viewer_state` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`conversationId` text NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`mailbox` text NOT NULL,
	`unreadCount` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_viewer_state` ON `conversation_viewer_state` (`ownerId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_mailbox` ON `conversation_viewer_state` (`ownerId`,`mailbox`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_updated` ON `conversation_viewer_state` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE TABLE `identity_relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`identityId` text NOT NULL,
	`isContact` integer DEFAULT false NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`givenName` text,
	`uploadedAvatar` text,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identityId`) REFERENCES `identity`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_identity_relationship_owner_identity` ON `identity_relationship` (`ownerId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_identity_relationship_owner_contact` ON `identity_relationship` (`ownerId`,`isContact`);--> statement-breakpoint
CREATE TABLE `identity` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`address` text COLLATE NOCASE NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`name` text,
	`inferredAvatar` text,
	`avatarPlaceholder` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_address_unique` ON `identity` (`address`);--> statement-breakpoint
CREATE INDEX `idx_identity_address` ON `identity` (`address`);--> statement-breakpoint
CREATE INDEX `idx_identity_kind` ON `identity` (`kind`);--> statement-breakpoint
CREATE TABLE `message_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`recipientIdentityId` text NOT NULL,
	`status` text NOT NULL,
	`transport` text NOT NULL,
	`latestStatusChangeAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`error` text,
	FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipientIdentityId`) REFERENCES `identity`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_delivery_message_recipient` ON `message_delivery` (`messageId`,`recipientIdentityId`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_message` ON `message_delivery` (`messageId`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_recipient_status` ON `message_delivery` (`recipientIdentityId`,`status`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`senderIdentityId` text NOT NULL,
	`externalMessageId` text,
	`bodyText` text,
	`bodyHTML` text,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`emailMetadata` text,
	FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`senderIdentityId`) REFERENCES `identity`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_external_message_id` ON `message` (`externalMessageId`);--> statement-breakpoint
CREATE INDEX `idx_message_conversation_created` ON `message` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_message_sender_created` ON `message` (`senderIdentityId`,`createdAt`);--> statement-breakpoint
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
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text COLLATE NOCASE NOT NULL,
	`passwordHash` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`avatarPlaceholder` text NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);