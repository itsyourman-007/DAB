CREATE TABLE `adminSecurity` (
	`id` int NOT NULL,
	`passwordHash` text,
	`otpHash` text,
	`otpRecipient` varchar(320),
	`otpExpiresAt` timestamp,
	`otpAttempts` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminSecurity_id` PRIMARY KEY(`id`)
);
