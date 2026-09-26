-- Rooms still waiting on a second player. Nothing creates one any more and
-- nothing lists one, so each would sit in its creator's games unplayable.
-- Finished rooms are left to the sweep, which archives before it deletes.
DELETE FROM `rooms`
WHERE `status` = 'in_progress'
  AND (`white_user_id` IS NULL OR `black_user_id` IS NULL);
