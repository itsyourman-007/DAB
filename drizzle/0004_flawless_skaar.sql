CREATE TABLE `merchantDashboardProfiles` (
	`id` int NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantDashboardProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchantOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(128) NOT NULL,
	`buyerName` varchar(160) NOT NULL,
	`buyerEmail` varchar(320),
	`phone` varchar(64),
	`address` varchar(500),
	`city` varchar(100),
	`state` varchar(100),
	`pincode` varchar(32),
	`planKey` varchar(64) NOT NULL,
	`planName` varchar(160) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`amount` int NOT NULL,
	`paymentMethod` varchar(64) NOT NULL DEFAULT 'UPI',
	`utr` varchar(128),
	`deliverySpan` varchar(64),
	`paymentStatus` enum('pending','utr_submitted','paid','expired') NOT NULL DEFAULT 'pending',
	`source` varchar(32) NOT NULL DEFAULT '91dab-shop',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`verifiedAt` timestamp,
	CONSTRAINT `merchantOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantOrders_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionReminderDispatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodKey` varchar(7) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptionReminderDispatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptionReminderDispatches_periodKey_unique` UNIQUE(`periodKey`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionReminderSettings` (
	`id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptionReminderSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `merchantTeamMembers` MODIFY COLUMN `department` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `merchantTeamMembers` ADD `salaryInr` int;