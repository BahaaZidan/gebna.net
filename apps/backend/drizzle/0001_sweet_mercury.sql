DROP INDEX "uniq_conversation_participant";--> statement-breakpoint
DROP INDEX "idx_conversation_participant_conversation";--> statement-breakpoint
DROP INDEX "idx_conversation_participant_identity";--> statement-breakpoint
DROP INDEX "uniq_conversation_dm_key";--> statement-breakpoint
DROP INDEX "idx_conversation_kind_updated";--> statement-breakpoint
DROP INDEX "idx_conversation_last_message_at";--> statement-breakpoint
DROP INDEX "uniq_conversation_viewer_state";--> statement-breakpoint
DROP INDEX "idx_conversation_viewer_state_owner_mailbox";--> statement-breakpoint
DROP INDEX "idx_conversation_viewer_state_owner_updated";--> statement-breakpoint
DROP INDEX "uniq_identity_relationship_owner_identity";--> statement-breakpoint
DROP INDEX "idx_identity_relationship_owner_contact";--> statement-breakpoint
DROP INDEX "idx_identity_relationship_owner_display";--> statement-breakpoint
DROP INDEX "uniq_identity_kind_address";--> statement-breakpoint
DROP INDEX "idx_identity_address";--> statement-breakpoint
DROP INDEX "idx_identity_kind";--> statement-breakpoint
DROP INDEX "uniq_message_delivery_message_recipient";--> statement-breakpoint
DROP INDEX "idx_message_delivery_message";--> statement-breakpoint
DROP INDEX "idx_message_delivery_recipient_status";--> statement-breakpoint
DROP INDEX "idx_message_conversation_created";--> statement-breakpoint
DROP INDEX "idx_message_sender_created";--> statement-breakpoint
DROP INDEX "user_username_unique";--> statement-breakpoint
ALTER TABLE `conversation` ALTER COLUMN "lastMessageAt" TO "lastMessageAt" integer DEFAULT (strftime('%s','now'));--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_participant` ON `conversation_participant` (`conversationId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_conversation` ON `conversation_participant` (`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_participant_identity` ON `conversation_participant` (`identityId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_dm_key` ON `conversation` (`dmKey`);--> statement-breakpoint
CREATE INDEX `idx_conversation_kind_updated` ON `conversation` (`kind`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_conversation_last_message_at` ON `conversation` (`lastMessageAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_conversation_viewer_state` ON `conversation_viewer_state` (`ownerId`,`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_mailbox` ON `conversation_viewer_state` (`ownerId`,`mailbox`);--> statement-breakpoint
CREATE INDEX `idx_conversation_viewer_state_owner_updated` ON `conversation_viewer_state` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_identity_relationship_owner_identity` ON `identity_relationship` (`ownerId`,`identityId`);--> statement-breakpoint
CREATE INDEX `idx_identity_relationship_owner_contact` ON `identity_relationship` (`ownerId`,`isContact`);--> statement-breakpoint
CREATE INDEX `idx_identity_relationship_owner_display` ON `identity_relationship` (`ownerId`,`displayName`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_identity_kind_address` ON `identity` (`kind`,`address`);--> statement-breakpoint
CREATE INDEX `idx_identity_address` ON `identity` (`address`);--> statement-breakpoint
CREATE INDEX `idx_identity_kind` ON `identity` (`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_delivery_message_recipient` ON `message_delivery` (`messageId`,`recipientIdentityId`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_message` ON `message_delivery` (`messageId`);--> statement-breakpoint
CREATE INDEX `idx_message_delivery_recipient_status` ON `message_delivery` (`recipientIdentityId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_message_conversation_created` ON `message` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_message_sender_created` ON `message` (`senderIdentityId`,`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);