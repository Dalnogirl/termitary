ALTER TABLE `rooms` ADD `deadline` integer;--> statement-breakpoint
CREATE INDEX `rooms_deadline_idx` ON `rooms` (`deadline`);