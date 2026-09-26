-- The rebuild below refuses a seat that is null or names a missing user, and
-- only a user deleted by hand leaves either. The migrator runs in a
-- transaction, where SQLite ignores `foreign_keys=OFF`, so a dangling id fails
-- the copy too. A finished room here is usually archived already; one whose
-- archive failed is lost.
DELETE FROM `rooms`
WHERE `white_user_id` IS NULL
  OR `black_user_id` IS NULL
  OR `white_user_id` NOT IN (SELECT `id` FROM `user`)
  OR `black_user_id` NOT IN (SELECT `id` FROM `user`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`white_user_id` text NOT NULL,
	`black_user_id` text NOT NULL,
	`status` text NOT NULL,
	`state` text NOT NULL,
	`state_version` integer NOT NULL,
	`ruleset` text,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`white_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`black_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_rooms`("id", "white_user_id", "black_user_id", "status", "state", "state_version", "ruleset", "version", "created_at", "updated_at") SELECT "id", "white_user_id", "black_user_id", "status", "state", "state_version", "ruleset", "version", "created_at", "updated_at" FROM `rooms`;--> statement-breakpoint
DROP TABLE `rooms`;--> statement-breakpoint
ALTER TABLE `__new_rooms` RENAME TO `rooms`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `rooms_white_idx` ON `rooms` (`white_user_id`);--> statement-breakpoint
CREATE INDEX `rooms_black_idx` ON `rooms` (`black_user_id`);