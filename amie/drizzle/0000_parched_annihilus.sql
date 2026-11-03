CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text,
	`name` text NOT NULL,
	`mood` text DEFAULT 'okay' NOT NULL,
	`status` text DEFAULT 'around' NOT NULL,
	`status_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`location_at` integer,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `members_space` ON `members` (`space_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`file_key` text,
	`mime` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_space_time` ON `messages` (`space_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`partner_id` text,
	`invite_hash` text,
	`invite_expires` integer,
	`anniversary` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spaces_invite_hash_unique` ON `spaces` (`invite_hash`);