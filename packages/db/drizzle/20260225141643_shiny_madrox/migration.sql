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
CREATE TABLE `emailAddressRefs` (
	`id` text PRIMARY KEY,
	`ownerId` text NOT NULL,
	`address` text COLLATE NOCASE NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`givenName` text,
	`givenAvatar` text,
	`isBlocked` integer DEFAULT false NOT NULL,
	`isSpam` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_emailAddressRefs_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailAddressRefs_address_emailAddresses_address_fk` FOREIGN KEY (`address`) REFERENCES `emailAddresses`(`address`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `emailAddresses` (
	`address` text COLLATE NOCASE PRIMARY KEY,
	`name` text,
	`inferredAvatar` text,
	`avatarPlaceholder` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emailAttachments` (
	`id` text PRIMARY KEY,
	`ownerId` text NOT NULL,
	`messageId` text NOT NULL,
	`conversationId` text NOT NULL,
	`fromRef` text NOT NULL,
	`filename` text,
	`mimeType` text,
	`disposition` text,
	`related` integer,
	`description` text,
	`contentId` text,
	`method` text,
	`content` blob NOT NULL,
	CONSTRAINT `fk_emailAttachments_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailAttachments_messageId_emailMessages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `emailMessages`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailAttachments_conversationId_emailConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `emailConversations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailAttachments_fromRef_emailAddressRefs_id_fk` FOREIGN KEY (`fromRef`) REFERENCES `emailAddressRefs`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `emailConversationParticipants` (
	`conversationId` text NOT NULL,
	`emailAddressRefId` text NOT NULL,
	CONSTRAINT `emailConversationParticipants_pk` PRIMARY KEY(`conversationId`, `emailAddressRefId`),
	CONSTRAINT `fk_emailConversationParticipants_conversationId_emailConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `emailConversations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailConversationParticipants_emailAddressRefId_emailAddressRefs_id_fk` FOREIGN KEY (`emailAddressRefId`) REFERENCES `emailAddressRefs`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `emailConversations` (
	`id` text PRIMARY KEY,
	`ownerId` text NOT NULL,
	`kind` text NOT NULL,
	`privateConvoKey` text COLLATE NOCASE,
	`title` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`lastMessageId` text,
	`lastMessageAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
	`uploadedAvatar` text,
	`unseenCount` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_emailConversations_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailConversations_lastMessageId_emailMessages_id_fk` FOREIGN KEY (`lastMessageId`) REFERENCES `emailMessages`(`id`) ON DELETE SET NULL,
	CONSTRAINT "chk_conversation_dmkey_kind" CHECK((
				("kind" = 'PRIVATE' AND "privateConvoKey" IS NOT NULL AND length("privateConvoKey") > 0)
				OR
				("kind" = 'GROUP' AND "privateConvoKey" IS NULL)
			))
);
--> statement-breakpoint
CREATE TABLE `emailMessages` (
	`id` text PRIMARY KEY,
	`ownerId` text NOT NULL,
	`canonicalMessageId` text,
	`conversationId` text NOT NULL,
	`from` text COLLATE NOCASE NOT NULL,
	`to` text COLLATE NOCASE NOT NULL,
	`bodyPlaintext` text,
	`bodyHTML` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`metadata` text,
	`sizeInBytes` integer NOT NULL,
	`unseen` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_emailMessages_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailMessages_conversationId_emailConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `emailConversations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailMessages_from_ref` FOREIGN KEY (`ownerId`,`from`) REFERENCES `emailAddressRefs`(`ownerId`,`address`) ON DELETE CASCADE,
	CONSTRAINT `fk_emailMessages_to_ref` FOREIGN KEY (`ownerId`,`to`) REFERENCES `emailAddressRefs`(`ownerId`,`address`) ON DELETE CASCADE
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
CREATE UNIQUE INDEX `uniq_idx_ownerId_address` ON `emailAddressRefs` (`ownerId`,`address`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_conversation` ON `emailConversationParticipants` (`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_identity` ON `emailConversationParticipants` (`emailAddressRefId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_idx_ownerId_dmKey` ON `emailConversations` (`ownerId`,`privateConvoKey`);--> statement-breakpoint
CREATE INDEX `idx_conversation_ownerId_last_message_at` ON `emailConversations` (`ownerId`,`lastMessageAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_idx_message_canonical_message_id` ON `emailMessages` (`ownerId`,`canonicalMessageId`);--> statement-breakpoint
CREATE INDEX `idx_message_conversation_created` ON `emailMessages` (`conversationId`,"createdAt" desc);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);