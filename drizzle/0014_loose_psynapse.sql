CREATE TABLE `merchantClinicQuoteLeads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientEmail` varchar(320) NOT NULL,
	`clientPhone` varchar(64),
	`note` varchar(1000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `merchantClinicQuoteLeads_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchantClinicQuoteLeads_clientEmail_unique` UNIQUE(`clientEmail`)
);
