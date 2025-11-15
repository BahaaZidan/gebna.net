CREATE TABLE `account_blob` (
	`accountId` text NOT NULL,
	`sha256` text NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`accountId`, `sha256`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sha256`) REFERENCES `blob`(`sha256`) ON UPDATE no action ON DELETE cascade
);
