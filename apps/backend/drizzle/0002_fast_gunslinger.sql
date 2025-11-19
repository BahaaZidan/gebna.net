CREATE TABLE `vacation_response_log` (
	`accountId` text NOT NULL,
	`contact` text NOT NULL,
	`respondedAt` integer NOT NULL,
	PRIMARY KEY(`accountId`, `contact`),
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
