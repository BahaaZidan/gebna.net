ALTER TABLE `email_submission` ADD `threadId` text NOT NULL REFERENCES thread(id);--> statement-breakpoint
ALTER TABLE `email_submission` ADD `dsnBlobIdsJson` text NOT NULL;--> statement-breakpoint
ALTER TABLE `email_submission` ADD `mdnBlobIdsJson` text NOT NULL;