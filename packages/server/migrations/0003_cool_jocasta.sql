CREATE TABLE `archived_games` (
	`id` text PRIMARY KEY NOT NULL,
	`white_user_id` text,
	`black_user_id` text,
	`white_name` text,
	`black_name` text,
	`result` text NOT NULL,
	`end_reason` text NOT NULL,
	`state` text NOT NULL,
	`state_version` integer NOT NULL,
	`move_count` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	FOREIGN KEY (`white_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`black_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `archived_games_white_idx` ON `archived_games` (`white_user_id`,`finished_at`);--> statement-breakpoint
CREATE INDEX `archived_games_black_idx` ON `archived_games` (`black_user_id`,`finished_at`);