DROP INDEX `seeks_seeker_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `seeks_seeker_idx` ON `seeks` (`seeker_user_id`);