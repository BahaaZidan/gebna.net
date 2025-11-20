ALTER TABLE `mailbox` ADD `parentId` text REFERENCES mailbox(id);--> statement-breakpoint
CREATE INDEX `idx_mailbox_parent` ON `mailbox` (`parentId`);