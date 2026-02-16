-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               12.0.2-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             12.11.0.7065
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for central_db
CREATE DATABASE IF NOT EXISTS `central_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci */;
USE `central_db`;

-- Dumping structure for table central_db.bank_transactions
CREATE TABLE IF NOT EXISTS `bank_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `target_id` int(11) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `amount` int(11) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.character_farm_crops
CREATE TABLE IF NOT EXISTS `character_farm_crops` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `field_id` varchar(50) NOT NULL,
  `seed_item_id` varchar(50) NOT NULL,
  `x` float NOT NULL,
  `y` float NOT NULL,
  `z` float NOT NULL,
  `heading` float NOT NULL,
  `planted_at` bigint(20) NOT NULL,
  `ready_at` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `field_idx` (`field_id`),
  KEY `char_idx` (`character_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.character_farm_trees
CREATE TABLE IF NOT EXISTS `character_farm_trees` (
  `character_id` int(11) NOT NULL,
  `tree_id` varchar(50) NOT NULL,
  `harvests_left` int(11) DEFAULT 3,
  `cooldown_expiry` bigint(20) DEFAULT 0,
  PRIMARY KEY (`character_id`,`tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.character_inventory
CREATE TABLE IF NOT EXISTS `character_inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `item_id` varchar(50) NOT NULL,
  `count` int(11) DEFAULT 1,
  `slot` int(11) NOT NULL,
  `metadata` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_char_id` (`character_id`)
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.character_job_data
CREATE TABLE IF NOT EXISTS `character_job_data` (
  `character_id` int(11) NOT NULL,
  `job_key` varchar(50) NOT NULL,
  `data` longtext DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`character_id`,`job_key`),
  CONSTRAINT `character_job_data_ibfk_1` FOREIGN KEY (`character_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.character_job_skills
CREATE TABLE IF NOT EXISTS `character_job_skills` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `job_key` varchar(50) NOT NULL,
  `xp` int(11) DEFAULT 0,
  `level` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_skill` (`character_id`,`job_key`)
) ENGINE=InnoDB AUTO_INCREMENT=568 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.escootr_spawns
CREATE TABLE IF NOT EXISTS `escootr_spawns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model` varchar(50) DEFAULT 'serv_electricscooter',
  `position` varchar(255) NOT NULL,
  `rotation` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.ground_items
CREATE TABLE IF NOT EXISTS `ground_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` varchar(50) NOT NULL,
  `count` int(11) NOT NULL,
  `pos_x` float NOT NULL,
  `pos_y` float NOT NULL,
  `pos_z` float NOT NULL,
  `dimension` int(11) NOT NULL,
  `metadata` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.phone_contacts
CREATE TABLE IF NOT EXISTS `phone_contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `contact_name` varchar(50) NOT NULL,
  `avatar_url` varchar(255) DEFAULT 'default.png',
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.phone_messages
CREATE TABLE IF NOT EXISTS `phone_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_number` varchar(20) NOT NULL,
  `receiver_number` varchar(20) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'text',
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `sender_number` (`sender_number`),
  KEY `receiver_number` (`receiver_number`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.player_daily_quests
CREATE TABLE IF NOT EXISTS `player_daily_quests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `quest_id` varchar(64) NOT NULL,
  `progress` int(11) DEFAULT 0,
  `completed` tinyint(1) DEFAULT 0,
  `created_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`created_date`),
  CONSTRAINT `player_daily_quests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.player_mails
CREATE TABLE IF NOT EXISTS `player_mails` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `sender` varchar(50) DEFAULT 'System',
  `title` varchar(100) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.player_phone
CREATE TABLE IF NOT EXISTS `player_phone` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `wallpaper` text DEFAULT NULL,
  `is_dnd` tinyint(1) DEFAULT 0,
  `is_flight_mode` tinyint(1) DEFAULT 0,
  `is_silent` tinyint(1) DEFAULT 0,
  `ringtone` varchar(50) DEFAULT 'default.mp3',
  `zoom_level` int(11) DEFAULT 100,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_number` (`phone_number`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `player_phone_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.player_photos
CREATE TABLE IF NOT EXISTS `player_photos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `image_path` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.player_photo_hunt
CREATE TABLE IF NOT EXISTS `player_photo_hunt` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `activity_date` date NOT NULL,
  `assigned_landmarks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`assigned_landmarks`)),
  `completed_landmarks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`completed_landmarks`)),
  PRIMARY KEY (`id`),
  KEY `fk_user_photo` (`user_id`),
  CONSTRAINT `fk_user_photo` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.repo_jobs
CREATE TABLE IF NOT EXISTS `repo_jobs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `job_date` date NOT NULL,
  `job_number` tinyint(4) NOT NULL DEFAULT 1,
  `target_model` varchar(64) NOT NULL,
  `status` enum('available','pending','completed') DEFAULT 'available',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`job_date`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.server_vehicles
CREATE TABLE IF NOT EXISTS `server_vehicles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `model` varchar(50) NOT NULL,
  `position` varchar(255) NOT NULL,
  `color` varchar(255) DEFAULT '{"prim":0,"sec":0}',
  `plate` varchar(10) DEFAULT 'NEWCAR',
  `fuel` float DEFAULT 100,
  `engine_health` float DEFAULT 1000,
  `dirt_level` float DEFAULT 0,
  `dimension` int(11) DEFAULT 0,
  `parked` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `money` int(11) DEFAULT 0,
  `level` int(11) DEFAULT 1,
  `xp` int(11) DEFAULT 0,
  `vehicle_slots` int(11) DEFAULT 3,
  `premium_points` int(11) DEFAULT 0,
  `position` varchar(255) DEFAULT '{"x":-1037,"y":-2738,"z":13}',
  `social_id` varchar(50) DEFAULT NULL,
  `cooldowns` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{}' CHECK (json_valid(`cooldowns`)),
  `bank_money` int(11) NOT NULL DEFAULT 0,
  `hwid` varchar(255) DEFAULT NULL,
  `last_active` datetime DEFAULT current_timestamp(),
  `ip` varchar(50) DEFAULT NULL,
  `appearance` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`appearance`)),
  `gender` int(11) DEFAULT 0,
  `admin_level` int(11) DEFAULT 0,
  `payday_in` int(11) DEFAULT 60,
  `created_at` datetime DEFAULT current_timestamp(),
  `total_playtime` int(11) DEFAULT 0,
  `daily_playtime` int(11) DEFAULT 0,
  `daily_playtime_date` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.user_bans
CREATE TABLE IF NOT EXISTS `user_bans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `admin_name` varchar(50) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `ban_time` datetime DEFAULT current_timestamp(),
  `expire_time` datetime DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_bans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table central_db.vehicle_mods
CREATE TABLE IF NOT EXISTS `vehicle_mods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vehicle_id` int(11) NOT NULL,
  `mod_type` int(11) NOT NULL,
  `mod_index` int(11) NOT NULL DEFAULT -1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mod` (`vehicle_id`,`mod_type`),
  KEY `idx_vehicle` (`vehicle_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Data exporting was unselected.

-- 1. Families table — one row per clan/family
CREATE TABLE IF NOT EXISTS `families` (
    `id`                INT          AUTO_INCREMENT PRIMARY KEY,
    `name`              VARCHAR(50)  NOT NULL UNIQUE,
    `tag`               VARCHAR(4)   NOT NULL,
    `color`             VARCHAR(7)   NOT NULL DEFAULT '#FFFFFF',
    `owner_id`          INT          NOT NULL,
    `bank`              BIGINT       NOT NULL DEFAULT 0,
    `member_cap`        INT          NOT NULL DEFAULT 25,
    `hq_house_id`       INT          DEFAULT NULL,
    `applications_open` TINYINT(1)   NOT NULL DEFAULT 0,
    `invites_open`      TINYINT(1)   NOT NULL DEFAULT 1,
    `description`       VARCHAR(200) NOT NULL DEFAULT '',
    `rank1_name`        VARCHAR(30)  NOT NULL DEFAULT 'Recruit',
    `rank2_name`        VARCHAR(30)  NOT NULL DEFAULT 'Member',
    `rank3_name`        VARCHAR(30)  NOT NULL DEFAULT 'Veteran',
    `rank4_name`        VARCHAR(30)  NOT NULL DEFAULT 'Officer',
    `rank5_name`        VARCHAR(30)  NOT NULL DEFAULT 'Leader',
    `rank1_color`       VARCHAR(7)   NOT NULL DEFAULT '#AAAAAA',
    `rank2_color`       VARCHAR(7)   NOT NULL DEFAULT '#FFFFFF',
    `rank3_color`       VARCHAR(7)   NOT NULL DEFAULT '#00AAFF',
    `rank4_color`       VARCHAR(7)   NOT NULL DEFAULT '#FFAA00',
    `rank5_color`       VARCHAR(7)   NOT NULL DEFAULT '#FF4444',
    `created_at`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Family members — one row per member (user can only be in one family)
CREATE TABLE IF NOT EXISTS `family_members` (
    `id`         INT       AUTO_INCREMENT PRIMARY KEY,
    `family_id`  INT       NOT NULL,
    `user_id`    INT       NOT NULL UNIQUE,
    `username`   VARCHAR(50) NOT NULL,
    `rank`       INT       NOT NULL DEFAULT 1,
    `joined_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Family applications — pending join requests
CREATE TABLE IF NOT EXISTS `family_applications` (
    `id`         INT         AUTO_INCREMENT PRIMARY KEY,
    `family_id`  INT         NOT NULL,
    `user_id`    INT         NOT NULL,
    `username`   VARCHAR(50) NOT NULL,
    `applied_at` TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_app` (`family_id`, `user_id`),
    FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
