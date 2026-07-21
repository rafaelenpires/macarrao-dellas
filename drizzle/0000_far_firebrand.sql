CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tracking_token` text NOT NULL,
	`order_code` integer NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_tracking_token_unique` ON `orders` (`tracking_token`);