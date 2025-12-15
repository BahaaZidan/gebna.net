ALTER TABLE `message` RENAME COLUMN `unread` TO `unseen`;
--> statement-breakpoint
ALTER TABLE `thread` RENAME COLUMN `unreadCount` TO `unseenCount`;
