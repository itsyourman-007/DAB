CREATE TABLE `merchantTeamMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`department` enum('engineering','marketing','sales') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantTeamMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantTeamMembers_email_unique` UNIQUE(`email`)
);
