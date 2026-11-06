ALTER TABLE `spaces` ADD `message_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `messages_revision_insert` AFTER INSERT ON `messages` BEGIN
  UPDATE `spaces` SET `message_revision` = `message_revision` + 1 WHERE `id` = NEW.`space_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `messages_revision_update` AFTER UPDATE ON `messages` BEGIN
  UPDATE `spaces` SET `message_revision` = `message_revision` + 1 WHERE `id` IN (OLD.`space_id`, NEW.`space_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `messages_revision_delete` AFTER DELETE ON `messages` BEGIN
  UPDATE `spaces` SET `message_revision` = `message_revision` + 1 WHERE `id` = OLD.`space_id`;
END;
