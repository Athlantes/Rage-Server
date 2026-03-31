CREATE DATABASE IF NOT EXISTS `central_db` 
USE `central_db`;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `arrest_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `officer_id` int DEFAULT NULL,
  `suspect_id` int DEFAULT NULL,
  `suspect_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `offenses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `outcome` enum('arrested','ticketed','released') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suspect` (`suspect_id`),
  KEY `idx_officer` (`officer_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `arrest_records_chk_1` CHECK (json_valid(`offenses`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `atm_skimmer_state` (
  `atm_index` int NOT NULL,
  `state` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` int DEFAULT NULL,
  `installed_at` datetime DEFAULT NULL,
  `reward` int DEFAULT NULL,
  `cooldown_at` datetime DEFAULT NULL,
  PRIMARY KEY (`atm_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `bank_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `target_id` int DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` int NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `businesses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tier` tinyint NOT NULL DEFAULT '1' COMMENT '1=Premium, 2=Standard, 3=Starter',
  `type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'gas_station | restaurant | mechanic | etc.',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `passive_pct` decimal(5,2) NOT NULL DEFAULT '5.00' COMMENT '% commission on player transactions',
  `delivery_payout` int unsigned NOT NULL DEFAULT '5000' COMMENT 'Total delivery mission reward (split 50/50)',
  `max_tickets` tinyint NOT NULL DEFAULT '5' COMMENT 'Max raffle entries per family',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `character_farm_crops` (
  `id` int NOT NULL AUTO_INCREMENT,
  `character_id` int NOT NULL,
  `field_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `seed_item_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `x` float NOT NULL,
  `y` float NOT NULL,
  `z` float NOT NULL,
  `heading` float NOT NULL,
  `planted_at` bigint NOT NULL,
  `ready_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `field_idx` (`field_id`),
  KEY `char_idx` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `character_farm_trees` (
  `character_id` int NOT NULL,
  `tree_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `harvests_left` int DEFAULT '3',
  `cooldown_expiry` bigint DEFAULT '0',
  PRIMARY KEY (`character_id`,`tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `character_inventory` (
  `id` int NOT NULL AUTO_INCREMENT,
  `character_id` int NOT NULL,
  `item_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `count` int DEFAULT '1',
  `slot` int NOT NULL,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_char_id` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `character_job_data` (
  `character_id` int NOT NULL,
  `job_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` longtext COLLATE utf8mb4_unicode_ci,
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`character_id`,`job_key`),
  CONSTRAINT `character_job_data_ibfk_1` FOREIGN KEY (`character_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `character_job_skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `character_id` int NOT NULL,
  `job_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `xp` int DEFAULT '0',
  `level` int DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_skill` (`character_id`,`job_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `escootr_spawns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'serv_electricscooter',
  `position` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rotation` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `faction_action_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `faction_id` int NOT NULL,
  `officer_id` int NOT NULL,
  `officer_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` int NOT NULL,
  `target_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` int DEFAULT '0',
  `reason` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_officer` (`officer_id`),
  KEY `idx_target` (`target_id`),
  KEY `idx_faction` (`faction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `faction_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `faction_id` int NOT NULL,
  `user_id` int NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app` (`faction_id`,`user_id`),
  CONSTRAINT `fk_app_faction` FOREIGN KEY (`faction_id`) REFERENCES `factions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `faction_ranks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `faction_id` int NOT NULL,
  `rank_index` int NOT NULL,
  `name` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salary` int NOT NULL DEFAULT '0',
  `permissions` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT '[]',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_faction_rank` (`faction_id`,`rank_index`),
  CONSTRAINT `faction_ranks_ibfk_1` FOREIGN KEY (`faction_id`) REFERENCES `factions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `faction_uniforms` (
  `character_id` int NOT NULL,
  `faction_id` int NOT NULL,
  `uniform_index` int NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`character_id`,`faction_id`),
  KEY `idx_faction` (`faction_id`),
  CONSTRAINT `faction_uniforms_ibfk_1` FOREIGN KEY (`character_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `faction_uniforms_ibfk_2` FOREIGN KEY (`faction_id`) REFERENCES `factions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `factions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#FFFFFF',
  `max_members` int NOT NULL DEFAULT '50',
  `bank` bigint NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `families` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag` varchar(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#FFFFFF',
  `owner_id` int NOT NULL,
  `bank` bigint NOT NULL DEFAULT '0',
  `premium_points` int unsigned NOT NULL DEFAULT '0',
  `member_cap` int NOT NULL DEFAULT '25',
  `hq_house_id` int DEFAULT NULL,
  `applications_open` tinyint(1) NOT NULL DEFAULT '0',
  `invites_open` tinyint(1) NOT NULL DEFAULT '1',
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `rank1_name` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Recruit',
  `rank2_name` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Member',
  `rank3_name` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Veteran',
  `rank4_name` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Officer',
  `rank5_name` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Leader',
  `rank1_color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#AAAAAA',
  `rank2_color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#FFFFFF',
  `rank3_color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#00AAFF',
  `rank4_color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#FFAA00',
  `rank5_color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#FF4444',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `family_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `family_id` int NOT NULL,
  `user_id` int NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app` (`family_id`,`user_id`),
  CONSTRAINT `family_applications_ibfk_1` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `family_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `family_id` int NOT NULL,
  `user_id` int NOT NULL,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rank` int NOT NULL DEFAULT '1',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `family_id` (`family_id`),
  CONSTRAINT `family_members_ibfk_1` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `ground_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `count` int NOT NULL,
  `pos_x` float NOT NULL,
  `pos_y` float NOT NULL,
  `pos_z` float NOT NULL,
  `dimension` int NOT NULL,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `houses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int DEFAULT '0',
  `price` int NOT NULL DEFAULT '50000',
  `position` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `interior_preset` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'motel',
  `locked` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `lotto_draws` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week_id` int NOT NULL,
  `drawn_numbers` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jackpot` bigint NOT NULL,
  `jackpot_won` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `lotto_state` (
  `id` int NOT NULL,
  `week_id` int NOT NULL DEFAULT '1',
  `jackpot` bigint NOT NULL DEFAULT '0',
  `next_draw` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `lotto_tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `player_id` int NOT NULL,
  `week_id` int NOT NULL,
  `numbers` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bet` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `permit_cycles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `business_id` int unsigned NOT NULL,
  `family_id` int unsigned DEFAULT NULL COMMENT 'NULL = no winner yet / cycle just created',
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `status` enum('open','active','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  PRIMARY KEY (`id`),
  KEY `business_id` (`business_id`),
  CONSTRAINT `permit_cycles_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `permit_deliveries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `cycle_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL COMMENT 'player who did the delivery',
  `family_id` int unsigned NOT NULL,
  `payout_player` int unsigned NOT NULL COMMENT '50% to player',
  `payout_safe` int unsigned NOT NULL COMMENT '50% to family safe',
  `delivered_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_cycle` (`user_id`,`cycle_id`) COMMENT 'one delivery per member per cycle',
  KEY `cycle_id` (`cycle_id`),
  CONSTRAINT `permit_deliveries_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `permit_cycles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `permit_entries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `cycle_id` int unsigned NOT NULL,
  `family_id` int unsigned NOT NULL,
  `tickets` tinyint NOT NULL DEFAULT '1' COMMENT 'How many tickets bought',
  `pp_spent` int unsigned NOT NULL DEFAULT '0' COMMENT 'PP locked in (for refund)',
  `refunded` tinyint(1) NOT NULL DEFAULT '0',
  `entered_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cycle_family` (`cycle_id`,`family_id`),
  CONSTRAINT `permit_entries_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `permit_cycles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `permit_passive_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `cycle_id` int unsigned NOT NULL,
  `business_id` int unsigned NOT NULL,
  `trigger_user_id` int unsigned NOT NULL,
  `transaction_amt` int unsigned NOT NULL,
  `commission_amt` int unsigned NOT NULL,
  `logged_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `phone_contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `contact_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'default.png',
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `phone_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiver_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sender_number` (`sender_number`),
  KEY `receiver_number` (`receiver_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `player_daily_quests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `quest_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `progress` int DEFAULT '0',
  `completed` tinyint(1) DEFAULT '0',
  `created_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`created_date`),
  CONSTRAINT `player_daily_quests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `player_mails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `sender` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'System',
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `player_phone` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wallpaper` text COLLATE utf8mb4_unicode_ci,
  `is_dnd` tinyint(1) DEFAULT '0',
  `is_flight_mode` tinyint(1) DEFAULT '0',
  `is_silent` tinyint(1) DEFAULT '0',
  `ringtone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'default.mp3',
  `zoom_level` int DEFAULT '100',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_number` (`phone_number`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `player_phone_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `player_photo_hunt` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `activity_date` date NOT NULL,
  `assigned_landmarks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `completed_landmarks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`id`),
  KEY `fk_user_photo` (`user_id`),
  CONSTRAINT `fk_user_photo` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `player_photo_hunt_chk_1` CHECK (json_valid(`assigned_landmarks`)),
  CONSTRAINT `player_photo_hunt_chk_2` CHECK (json_valid(`completed_landmarks`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `player_photos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `image_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `repo_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `job_date` date NOT NULL,
  `job_number` tinyint NOT NULL DEFAULT '1',
  `target_model` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('available','pending','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`job_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `server_vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '{"prim":0,"sec":0}',
  `plate` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'NEWCAR',
  `fuel` float DEFAULT '100',
  `engine_health` float DEFAULT '1000',
  `dirt_level` float DEFAULT '0',
  `dimension` int DEFAULT '0',
  `parked` tinyint(1) DEFAULT '0',
  `build_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`id`),
  CONSTRAINT `server_vehicles_chk_1` CHECK (json_valid(`build_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `server_weather` (
  `id` int NOT NULL,
  `current_state` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `end_time` bigint NOT NULL,
  `forecast_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `taxi_ratings` (
  `user_id` int NOT NULL,
  `rating_total` int NOT NULL DEFAULT '0',
  `rating_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `taxi_ratings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `user_bans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `admin_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ban_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `expire_time` datetime DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_bans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `money` int DEFAULT '0',
  `level` int DEFAULT '1',
  `xp` int DEFAULT '0',
  `vehicle_slots` int DEFAULT '3',
  `premium_points` int DEFAULT '0',
  `position` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '{"x":-1037,"y":-2738,"z":13}',
  `social_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cooldowns` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `bank_money` int NOT NULL DEFAULT '0',
  `hwid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_active` datetime DEFAULT CURRENT_TIMESTAMP,
  `ip` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `appearance` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `gender` int DEFAULT '0',
  `admin_level` int DEFAULT '0',
  `payday_in` int DEFAULT '60',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `total_playtime` int DEFAULT '0',
  `daily_playtime` int DEFAULT '0',
  `daily_playtime_date` date DEFAULT NULL,
  `mugshot` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discord_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `wanted_level` int NOT NULL DEFAULT '0',
  `exposure` int NOT NULL DEFAULT '0',
  `hunger` int DEFAULT '100',
  `thirst` int DEFAULT '100',
  `faction_id` int DEFAULT NULL,
  `faction_rank` int DEFAULT '0',
  `faction_warns` int DEFAULT '0',
  `faction_punish` int DEFAULT '0',
  `faction_joined_at` timestamp NULL DEFAULT NULL,
  `race_xp` int DEFAULT '0',
  `race_level` int DEFAULT '1',
  `race_wins` int DEFAULT '0',
  `race_losses` int DEFAULT '0',
  `daily_race_xp` int DEFAULT '0',
  `daily_race_xp_date` date DEFAULT NULL,
  `last_race_opponent` int DEFAULT NULL,
  `last_race_opponent_time` datetime DEFAULT NULL,
  `races_this_hour` int DEFAULT '0',
  `races_hour_start` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_user_faction` (`faction_id`),
  CONSTRAINT `fk_user_faction` FOREIGN KEY (`faction_id`) REFERENCES `factions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_chk_1` CHECK (json_valid(`cooldowns`)),
  CONSTRAINT `users_chk_2` CHECK (json_valid(`appearance`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `vehicle_mods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int NOT NULL,
  `mod_type` int NOT NULL,
  `mod_index` int NOT NULL DEFAULT '-1',
  `variant` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `slider_data` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mod` (`vehicle_id`,`mod_type`),
  KEY `idx_vehicle` (`vehicle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `wanted_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `offense_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `offense_label` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('RoS','NoS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `outcome` enum('escaped','arrested','ticketed','released') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'escaped',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_outcome` (`outcome`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed default businesses ────────────────────────────────────────────────
INSERT IGNORE INTO businesses (id, name, tier, type, description, passive_pct, delivery_payout, max_tickets) VALUES
-- Tier 1 — High profit
(1, 'Paleto Bay Gas Station',  1, 'gas_station',  'The busiest fuel stop in Blaine County.',  5.00, 8000,  5),
(2, 'Sandy Shores Gas Station',1, 'gas_station',  'Desert highway hub with heavy traffic.',   5.00, 8000,  5),
(3, 'Alta Street Mechanic',    1, 'mechanic',     'High-end auto repair in downtown LS.',     5.00, 7500,  5),

-- Tier 2 — Medium profit
(4, 'Rockford Hills Bistro',   2, 'restaurant',   'Upscale dining in the hills.',            5.00, 5500,  4),
(5, 'Vespucci Tow Service',    2, 'mechanic',     'Beach-side recovery & repairs.',           5.00, 5000,  4),
(6, 'Mirror Park Corner Store',2, 'convenience',  'Grab-and-go for Mirror Park locals.',      5.00, 4500,  4),

-- Tier 3 — Entry-level / small families
(7, 'Davis Gas Station',       3, 'gas_station',  'Quiet station in South LS.',              5.00, 3000,  3),
(8, 'Strawberry Diner',        3, 'restaurant',   'Comfort food for the locals.',            5.00, 2500,  3),
(9, 'Cypress Flats Scrapyard', 3, 'mechanic',     'Budget repairs and part sales.',           5.00, 2500,  3);

