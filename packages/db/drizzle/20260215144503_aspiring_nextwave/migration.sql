-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `account` (
	`id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT cast(unixepoch('subsecond') * 1000 as integer) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `account_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `conversation_participant` (
	`id` text NOT NULL,
	`conversationId` text NOT NULL,
	`identityId` text NOT NULL,
	`ownerId` text,
	`role` text NOT NULL,
	`state` text NOT NULL,
	`joinedAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`lastReadMessageId` text,
	CONSTRAINT `conversation_participant_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_conversation_participant_lastReadMessageId_message_id_fk` FOREIGN KEY (`lastReadMessageId`) REFERENCES `message`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_conversation_participant_ownerId_user_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversation_participant_identityId_identity_id_fk` FOREIGN KEY (`identityId`) REFERENCES `identity`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversation_participant_conversationId_conversation_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text,
	`dmKey` text,
	`createdAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`updatedAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`lastMessageAt` integer DEFAULT strftime('%s','now'),
	`uploadedAvatar` text,
	`lastMessageId` text,
	CONSTRAINT `conversation_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_conversation_lastMessageId_message_id_fk` FOREIGN KEY (`lastMessageId`) REFERENCES `message`(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_viewer_state` (
	`id` text NOT NULL,
	`ownerId` text NOT NULL,
	`conversationId` text NOT NULL,
	`createdAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`updatedAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`mailbox` text NOT NULL,
	`unreadCount` integer NOT NULL,
	CONSTRAINT `conversation_viewer_state_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_conversation_viewer_state_conversationId_conversation_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversation_viewer_state_ownerId_user_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `identity_relationship` (
	`id` text NOT NULL,
	`ownerId` text NOT NULL,
	`identityId` text NOT NULL,
	`isContact` integer DEFAULT false NOT NULL,
	`updatedAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`createdAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`givenName` text,
	`uploadedAvatar` text,
	CONSTRAINT `identity_relationship_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_identity_relationship_identityId_identity_id_fk` FOREIGN KEY (`identityId`) REFERENCES `identity`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_identity_relationship_ownerId_user_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `identity` (
	`id` text NOT NULL,
	`ownerId` text,
	`kind` text NOT NULL,
	`address` text NOT NULL,
	`createdAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`updatedAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`name` text,
	`inferredAvatar` text,
	`avatarPlaceholder` text NOT NULL,
	CONSTRAINT `identity_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_identity_ownerId_user_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `message_delivery` (
	`id` text NOT NULL,
	`messageId` text NOT NULL,
	`recipientIdentityId` text NOT NULL,
	`status` text NOT NULL,
	`transport` text NOT NULL,
	`latestStatusChangeAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`error` text,
	CONSTRAINT `message_delivery_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_message_delivery_recipientIdentityId_identity_id_fk` FOREIGN KEY (`recipientIdentityId`) REFERENCES `identity`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_message_delivery_messageId_message_id_fk` FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text NOT NULL,
	`conversationId` text NOT NULL,
	`senderIdentityId` text NOT NULL,
	`externalMessageId` text,
	`bodyText` text,
	`bodyHTML` text,
	`bodyMD` text,
	`createdAt` integer DEFAULT strftime('%s','now') NOT NULL,
	`emailMetadata` text,
	`hasHTML` integer DEFAULT false,
	`bodySnippet` text,
	CONSTRAINT `message_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_message_senderIdentityId_identity_id_fk` FOREIGN KEY (`senderIdentityId`) REFERENCES `identity`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_message_conversationId_conversation_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT cast(unixepoch('subsecond') * 1000 as integer) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `session_pk` PRIMARY KEY(`id`),
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT cast(unixepoch('subsecond') * 1000 as integer) NOT NULL,
	`updated_at` integer DEFAULT cast(unixepoch('subsecond') * 1000 as integer) NOT NULL,
	`username` text NOT NULL,
	`display_username` text,
	`uploadedAvatar` text,
	`avatarPlaceholder` text NOT NULL,
	CONSTRAINT `user_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT cast(unixepoch('subsecond') * 1000 as integer) NOT NULL,
	`updated_at` integer DEFAULT cast(unixepoch('subsecond') * 1000 as integer) NOT NULL,
	CONSTRAINT `verification_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_conversation_last_message_at` ON `conversation` (`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `idx_conversation_kind_updated` ON `conversation` (`kind`,`updatedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_dm_key` ON `conversation` (`dmKey`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_identity` ON `conversation_participant` (`identityId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_conversation` ON `conversation_participant` (`conversationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_participant` ON `conversation_participant` (`conversationId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_updated` ON `conversation_viewer_state` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_mailbox` ON `conversation_viewer_state` (`ownerId`,`mailbox`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_viewer_state` ON `conversation_viewer_state` (`ownerId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_identity_kind` ON `identity` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_identity_address` ON `identity` (`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_address_unique` ON `identity` (`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_ownerId_unique` ON `identity` (`ownerId`);--> statement-breakpoint
CREATE INDEX `idx_identity_relationship_owner_contact` ON `identity_relationship` (`ownerId`,`isContact`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_identity_relationship_owner_identity` ON `identity_relationship` (`ownerId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_message_sender_created` ON `message` (`senderIdentityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_message_conversation_created` ON `message` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_external_message_id` ON `message` (`externalMessageId`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_recipient_status` ON `message_delivery` (`recipientIdentityId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_message` ON `message_delivery` (`messageId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_delivery_message_recipient` ON `message_delivery` (`messageId`,`recipientIdentityId`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
*/