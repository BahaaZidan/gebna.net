CREATE TABLE `oidc_auth_code` (
	`code` text PRIMARY KEY NOT NULL,
	`clientId` text NOT NULL,
	`userId` text NOT NULL,
	`redirectUri` text NOT NULL,
	`scope` text NOT NULL,
	`codeChallenge` text NOT NULL,
	`codeChallengeMethod` text DEFAULT 'S256' NOT NULL,
	`nonce` text,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`clientId`) REFERENCES `oidc_client`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_oidc_auth_code_client` ON `oidc_auth_code` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_oidc_auth_code_user` ON `oidc_auth_code` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_oidc_auth_code_expires` ON `oidc_auth_code` (`expiresAt`);--> statement-breakpoint
CREATE TABLE `oidc_client` (
	`id` text PRIMARY KEY NOT NULL,
	`clientSecret` text,
	`name` text NOT NULL,
	`redirectUrisJson` text NOT NULL,
	`allowedScopesJson` text NOT NULL,
	`isConfidential` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `idx_oidc_client_name` ON `oidc_client` (`name`);--> statement-breakpoint
CREATE TABLE `oidc_token` (
	`id` text PRIMARY KEY NOT NULL,
	`clientId` text NOT NULL,
	`userId` text NOT NULL,
	`scope` text NOT NULL,
	`type` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`revokedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`clientId`) REFERENCES `oidc_client`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_oidc_token_client` ON `oidc_token` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_oidc_token_user` ON `oidc_token` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_oidc_token_type` ON `oidc_token` (`type`);--> statement-breakpoint
CREATE INDEX `idx_oidc_token_expires` ON `oidc_token` (`expiresAt`);--> statement-breakpoint
INSERT INTO `oidc_client` (
	`id`,
	`clientSecret`,
	`name`,
	`redirectUrisJson`,
	`allowedScopesJson`,
	`isConfidential`,
	`createdAt`,
	`updatedAt`
) VALUES (
	'dev-client',
	'dev-secret-change-me',
	'Gebna Dev Console',
	'["http://localhost:3000/oauth/callback"]',
	'["openid","email","profile","jmap"]',
	1,
	unixepoch('now'),
	unixepoch('now')
);
