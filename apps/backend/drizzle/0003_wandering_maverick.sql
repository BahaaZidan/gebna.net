ALTER TABLE `email_submission` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `email_submission` ADD `nextAttemptAt` integer;--> statement-breakpoint
ALTER TABLE `email_submission` ADD `retryCount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_email_submission_queue` ON `email_submission` (`status`,`nextAttemptAt`);