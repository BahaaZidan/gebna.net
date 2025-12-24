CREATE VIRTUAL TABLE message_fts USING fts5(
  messageId UNINDEXED,
  ownerId   UNINDEXED,
  mailboxId UNINDEXED,
  threadId  UNINDEXED,
  createdAt UNINDEXED,
  subject,
  bodyText,
  tokenize = 'unicode61'
);
--> statement-breakpoint
CREATE TRIGGER message_fts_ai AFTER INSERT ON message BEGIN
  INSERT INTO message_fts(messageId, ownerId, mailboxId, threadId, createdAt, subject, bodyText)
  VALUES (new.id, new.ownerId, new.mailboxId, new.threadId, new.createdAt, coalesce(new.subject,''), coalesce(new.bodyText,''));
END;
--> statement-breakpoint
CREATE TRIGGER message_fts_ad AFTER DELETE ON message BEGIN
  DELETE FROM message_fts WHERE messageId = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER message_fts_au AFTER UPDATE OF subject, bodyText, ownerId, mailboxId, threadId, createdAt ON message BEGIN
  UPDATE message_fts
  SET ownerId   = new.ownerId,
      mailboxId = new.mailboxId,
      threadId  = new.threadId,
      createdAt = new.createdAt,
      subject   = coalesce(new.subject,''),
      bodyText  = coalesce(new.bodyText,'')
  WHERE messageId = new.id;
END;
