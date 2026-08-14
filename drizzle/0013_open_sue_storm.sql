CREATE TABLE `merchantQuoteClientCustomizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientName` varchar(160) NOT NULL,
	`clientEmail` varchar(320),
	`clientPhone` varchar(64),
	`unitsPurchased` int NOT NULL,
	`revenueInr` int NOT NULL,
	`notes` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantQuoteClientCustomizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `merchantOrders` ADD `deliveryStartMonth` varchar(7);