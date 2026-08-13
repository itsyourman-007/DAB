CREATE TABLE `fulfillmentNotificationEmails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationKey` varchar(192) NOT NULL,
	`orderId` varchar(128) NOT NULL,
	`status` enum('shipped','delivered') NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`deliveryStatus` enum('reserved','sent') NOT NULL DEFAULT 'reserved',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fulfillmentNotificationEmails_id` PRIMARY KEY(`id`),
	CONSTRAINT `fulfillmentNotificationEmails_notificationKey_unique` UNIQUE(`notificationKey`)
);
