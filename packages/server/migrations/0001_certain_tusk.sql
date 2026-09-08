CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`white_user_id` text,
	`black_user_id` text,
	`status` text NOT NULL,
	`state` text NOT NULL,
	`state_version` integer NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`white_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`black_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
