CREATE TABLE `merchantDashboardLoginAudits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('admin','employee') NOT NULL,
	`signedInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merchantDashboardLoginAudits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `merchantOrders` ADD `fulfillmentStatus` enum('not_shipped','shipped','delivered') DEFAULT 'not_shipped' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchantOrders` ADD `shippedAt` timestamp;--> statement-breakpoint
ALTER TABLE `merchantOrders` ADD `deliveredAt` timestamp;