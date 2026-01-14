ALTER TABLE `message` ADD COLUMN `externalMessageId` text;--> statement-breakpoint
WITH ranked AS (
	SELECT
		id,
		json_extract(emailMetadata, '$.messageId') AS mid,
		ROW_NUMBER() OVER (
			PARTITION BY json_extract(emailMetadata, '$.messageId')
			ORDER BY createdAt ASC, id ASC
		) AS rn
	FROM `message`
	WHERE emailMetadata IS NOT NULL
		AND json_extract(emailMetadata, '$.messageId') IS NOT NULL
		AND length(json_extract(emailMetadata, '$.messageId')) > 0
)
UPDATE `message`
SET externalMessageId = (SELECT mid FROM ranked WHERE ranked.id = `message`.id)
WHERE id IN (SELECT id FROM ranked WHERE rn = 1);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_message_external_message_id` ON `message` (`externalMessageId`);--> statement-breakpoint
