CREATE TABLE `merchantTeams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantTeams_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantTeams_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `merchantTeamMembers` ADD `teamId` int;