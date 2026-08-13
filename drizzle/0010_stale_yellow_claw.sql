CREATE TABLE `demoOrderCleanupSettings` (
	`id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demoOrderCleanupSettings_id` PRIMARY KEY(`id`)
);
