ALTER TABLE `merchantQuoteClientCustomizations` ADD `fulfillmentStatus` varchar(32) DEFAULT 'not_shipped' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchantQuoteClientCustomizations` ADD `shippedAt` timestamp;--> statement-breakpoint
ALTER TABLE `merchantQuoteClientCustomizations` ADD `deliveredAt` timestamp;