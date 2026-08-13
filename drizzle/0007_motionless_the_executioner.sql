CREATE TABLE `merchantInventory` (
	`id` int NOT NULL,
	`productKey` varchar(64) NOT NULL,
	`productName` varchar(160) NOT NULL,
	`availableUnits` int NOT NULL DEFAULT 0,
	`configured` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantInventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantInventory_productKey_unique` UNIQUE(`productKey`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionDeliveryRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryKey` varchar(192) NOT NULL,
	`orderId` varchar(128) NOT NULL,
	`periodKey` varchar(7) NOT NULL,
	`deliveredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptionDeliveryRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptionDeliveryRecords_deliveryKey_unique` UNIQUE(`deliveryKey`)
);
