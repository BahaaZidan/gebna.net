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
	`passwordHash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);