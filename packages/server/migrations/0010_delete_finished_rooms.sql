-- A finished game now leaves `rooms` in the commit that archives it. Most rows
-- this deletes are already archived; the rest are games whose archive failed
-- and was logged. Those are dropped rather than rebuilt in SQL, since nothing
-- has been deployed that a player could lose.
DELETE FROM `rooms` WHERE `status` = 'finished';
