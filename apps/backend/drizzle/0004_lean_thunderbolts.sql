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
DROP INDEX `idx_address_email`;--> statement-breakpoint
CREATE UNIQUE INDEX `ux_address_email` ON `address` (`email`);--> statement-breakpoint
ALTER TABLE `message` ADD `bodyStructureJson` text;