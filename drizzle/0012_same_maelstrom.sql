CREATE TABLE `merchantInventoryShipmentAllocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`allocationKey` varchar(192) NOT NULL,
	`orderId` varchar(128) NOT NULL,
	`productKey` varchar(64) NOT NULL DEFAULT 'dab',
	`periodKey` varchar(7),
	`allocationKind` varchar(32) NOT NULL,
	`units` int NOT NULL,
	`shippedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merchantInventoryShipmentAllocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantInventoryShipmentAllocations_allocationKey_unique` UNIQUE(`allocationKey`)
);
