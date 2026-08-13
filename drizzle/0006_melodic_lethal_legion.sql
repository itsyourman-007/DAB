CREATE TABLE `merchantEmployeeAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(512) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantEmployeeAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantEmployeeAccounts_email_unique` UNIQUE(`email`)
);
