CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`receiver` text NOT NULL,
	`messageIdHeader` text,
	`subject` text,
	`receivedTimestamp` integer NOT NULL,
	`fromRaw` text,
	`toRaw` text,
	`ccRaw` text,
	`headersRaw` text,
	`rawR2Key` text NOT NULL,
	`rawSha256` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`hasAttachment` integer DEFAULT false NOT NULL,
	`snippet` text,
	FOREIGN KEY (`receiver`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `msg_user_date_idx` ON `message` (`receiver`,"receivedTimestamp" desc);--> statement-breakpoint
CREATE UNIQUE INDEX `msg_user_rawsha_uniq` ON `message` (`receiver`,`rawSha256`);