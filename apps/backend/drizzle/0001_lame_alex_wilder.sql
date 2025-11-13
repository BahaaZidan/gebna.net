PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
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
INSERT INTO `__new_session`("id", "userId", "refreshHash", "userAgent", "ip", "createdAt", "expiresAt", "revoked") SELECT "id", "userId", "refreshHash", "userAgent", "ip", "createdAt", "expiresAt", "revoked" FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `account` ALTER COLUMN "userId" TO "userId" text NOT NULL REFERENCES user(id) ON DELETE cascade ON UPDATE no action;