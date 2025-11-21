CREATE TABLE `jmap_query_state` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`filterJson` text,
	`sortJson` text,
	`createdAt` integer NOT NULL,
	`lastAccessedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_jmap_query_state_account` ON `jmap_query_state` (`accountId`);--> statement-breakpoint
DROP TABLE `upload`;