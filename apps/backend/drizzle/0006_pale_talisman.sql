ALTER TABLE `message` ADD `textBody` text;--> statement-breakpoint
ALTER TABLE `message` ADD `textBodyIsTruncated` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `message` ADD `htmlBody` text;--> statement-breakpoint
ALTER TABLE `message` ADD `htmlBodyIsTruncated` integer DEFAULT false NOT NULL;