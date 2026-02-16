CREATE TABLE `accounts` (
	`id` text PRIMARY KEY,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `conversationParticipants` (
	`id` text PRIMARY KEY,
	`conversationId` text NOT NULL,
	`identityId` text NOT NULL,
	`ownerId` text,
	`role` text NOT NULL,
	`state` text NOT NULL,
	`joinedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`lastSeenMessageId` text,
	CONSTRAINT `fk_conversationParticipants_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversationParticipants_identityId_identities_id_fk` FOREIGN KEY (`identityId`) REFERENCES `identities`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversationParticipants_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversationParticipants_lastSeenMessageId_messages_id_fk` FOREIGN KEY (`lastSeenMessageId`) REFERENCES `messages`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `conversationViewerStates` (
	`id` text PRIMARY KEY,
	`ownerId` text NOT NULL,
	`conversationId` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`mailbox` text NOT NULL,
	`unseenCount` integer NOT NULL,
	CONSTRAINT `fk_conversationViewerStates_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_conversationViewerStates_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY,
	`kind` text NOT NULL,
	`title` text,
	`dmKey` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`lastMessageId` text,
	`lastMessageAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	`uploadedAvatar` text,
	CONSTRAINT `fk_conversations_lastMessageId_messages_id_fk` FOREIGN KEY (`lastMessageId`) REFERENCES `messages`(`id`) ON DELETE SET NULL,
	CONSTRAINT "chk_conversation_dmkey_kind" CHECK((
				("kind" = 'PRIVATE' AND "dmKey" IS NOT NULL AND length("dmKey") > 0)
				OR
				("kind" = 'GROUP' AND "dmKey" IS NULL)
			))
);
--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY,
	`ownerId` text UNIQUE,
	`kind` text NOT NULL,
	`address` text COLLATE NOCASE NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`name` text,
	`inferredAvatar` text,
	`avatarPlaceholder` text NOT NULL,
	CONSTRAINT `fk_identities_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "chk_identities_ownerId_matches_kind" CHECK((
        ("kind" = 'INTERNAL' AND "ownerId" IS NOT NULL)
        OR
        ("kind" = 'EXTERNAL' AND "ownerId" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE `identityRelationships` (
	`id` text PRIMARY KEY,
	`ownerId` text NOT NULL,
	`identityId` text NOT NULL,
	`isContact` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`givenName` text,
	`uploadedAvatar` text,
	CONSTRAINT `fk_identityRelationships_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_identityRelationships_identityId_identities_id_fk` FOREIGN KEY (`identityId`) REFERENCES `identities`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `messageDeliveries` (
	`id` text PRIMARY KEY,
	`messageId` text NOT NULL,
	`recipientIdentityId` text NOT NULL,
	`transport` text NOT NULL,
	`status` text NOT NULL,
	`latestStatusChangeAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`error` text,
	CONSTRAINT `fk_messageDeliveries_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_messageDeliveries_recipientIdentityId_identities_id_fk` FOREIGN KEY (`recipientIdentityId`) REFERENCES `identities`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY,
	`conversationId` text NOT NULL,
	`senderIdentityId` text NOT NULL,
	`externalMessageId` text,
	`bodyPlainText` text,
	`bodyPlainTextSnippet` text,
	`bodyRawHTML` text,
	`hasBodyRawHTML` integer DEFAULT false,
	`bodyMD` text,
	`bodyHTMLFromMD` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`emailMetadata` text,
	CONSTRAINT `fk_messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_messages_senderIdentityId_identities_id_fk` FOREIGN KEY (`senderIdentityId`) REFERENCES `identities`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	CONSTRAINT `fk_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text COLLATE NOCASE NOT NULL UNIQUE,
	`emailVerified` integer DEFAULT true NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`username` text COLLATE NOCASE NOT NULL UNIQUE,
	`displayUsername` text,
	`uploadedAvatar` text,
	`avatarPlaceholder` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_participant` ON `conversationParticipants` (`conversationId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_conversation` ON `conversationParticipants` (`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_identity` ON `conversationParticipants` (`identityId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_viewer_state` ON `conversationViewerStates` (`ownerId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_mailbox` ON `conversationViewerStates` (`ownerId`,`mailbox`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_updated` ON `conversationViewerStates` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_dm_key` ON `conversations` (`dmKey`);--> statement-breakpoint
CREATE INDEX `idx_conversation_kind_updated` ON `conversations` (`kind`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_conversation_last_message_at` ON `conversations` (`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `idx_identities_address` ON `identities` (`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_identity_relationship_owner_identity` ON `identityRelationships` (`ownerId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_identity_relationship_owner_contact` ON `identityRelationships` (`ownerId`,`isContact`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_delivery_message_recipient` ON `messageDeliveries` (`messageId`,`recipientIdentityId`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_message` ON `messageDeliveries` (`messageId`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_recipient_status` ON `messageDeliveries` (`recipientIdentityId`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_external_message_id` ON `messages` (`externalMessageId`);--> statement-breakpoint
CREATE INDEX `idx_message_conversation_created` ON `messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_message_sender_created` ON `messages` (`senderIdentityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);