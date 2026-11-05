CREATE TABLE `nearby_presence` (
	`space_id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
