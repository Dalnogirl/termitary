CREATE TABLE `seeks` (
	`id` text PRIMARY KEY NOT NULL,
	`seeker_user_id` text NOT NULL,
	`preference` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`seeker_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seeks_seeker_idx` ON `seeks` (`seeker_user_id`);--> statement-breakpoint
CREATE INDEX `seeks_pool_idx` ON `seeks` (`visibility`,`created_at`);