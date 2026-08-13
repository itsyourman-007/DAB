CREATE TABLE `paymentConfirmationEmails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(128) NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`status` enum('reserved','sent') NOT NULL DEFAULT 'reserved',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentConfirmationEmails_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentConfirmationEmails_orderId_unique` UNIQUE(`orderId`)
);
