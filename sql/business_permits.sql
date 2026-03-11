-- ============================================================
--  Family Business Permit System — Database Schema
--  Run this once against your central_db database
-- ============================================================

-- ── 1. Businesses catalog (static config, seeded once) ───────────────────────
CREATE TABLE IF NOT EXISTS businesses (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(80)  NOT NULL,
    tier            TINYINT      NOT NULL DEFAULT 1 COMMENT '1=Premium, 2=Standard, 3=Starter',
    type            VARCHAR(40)  NOT NULL COMMENT 'gas_station | restaurant | mechanic | etc.',
    description     VARCHAR(255) NOT NULL DEFAULT '',
    passive_pct     DECIMAL(5,2) NOT NULL DEFAULT 5.00 COMMENT '% commission on player transactions',
    delivery_payout INT UNSIGNED NOT NULL DEFAULT 5000  COMMENT 'Total delivery mission reward (split 50/50)',
    max_tickets     TINYINT      NOT NULL DEFAULT 5     COMMENT 'Max raffle entries per family',
    world_x         FLOAT        NOT NULL DEFAULT 0,
    world_y         FLOAT        NOT NULL DEFAULT 0,
    world_z         FLOAT        NOT NULL DEFAULT 0,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Permit cycles (one row per 30-day lease period per business) ──────────
CREATE TABLE IF NOT EXISTS permit_cycles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id     INT UNSIGNED NOT NULL,
    family_id       INT UNSIGNED NULL COMMENT 'NULL = no winner yet / cycle just created',
    started_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP    NOT NULL,
    status          ENUM('open','active','expired') NOT NULL DEFAULT 'open',
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Raffle entries per cycle ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permit_entries (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cycle_id        INT UNSIGNED NOT NULL,
    family_id       INT UNSIGNED NOT NULL,
    tickets         TINYINT      NOT NULL DEFAULT 1 COMMENT 'How many tickets bought',
    pp_spent        INT UNSIGNED NOT NULL DEFAULT 0  COMMENT 'PP locked in (for refund)',
    refunded        TINYINT(1)   NOT NULL DEFAULT 0,
    entered_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cycle_family (cycle_id, family_id),
    FOREIGN KEY (cycle_id) REFERENCES permit_cycles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Delivery mission cooldowns per permit cycle ────────────────────────────
CREATE TABLE IF NOT EXISTS permit_deliveries (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cycle_id        INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL COMMENT 'player who did the delivery',
    family_id       INT UNSIGNED NOT NULL,
    payout_player   INT UNSIGNED NOT NULL COMMENT '50% to player',
    payout_safe     INT UNSIGNED NOT NULL COMMENT '50% to family safe',
    delivered_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_cycle (user_id, cycle_id) COMMENT 'one delivery per member per cycle',
    FOREIGN KEY (cycle_id) REFERENCES permit_cycles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. Passive income log (optional – audit trail) ────────────────────────────
CREATE TABLE IF NOT EXISTS permit_passive_log (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cycle_id        INT UNSIGNED NOT NULL,
    business_id     INT UNSIGNED NOT NULL,
    trigger_user_id INT UNSIGNED NOT NULL,
    transaction_amt INT UNSIGNED NOT NULL,
    commission_amt  INT UNSIGNED NOT NULL,
    logged_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. Seed default businesses ────────────────────────────────────────────────
INSERT IGNORE INTO businesses (id, name, tier, type, description, passive_pct, delivery_payout, max_tickets, world_x, world_y, world_z) VALUES
-- Tier 1 — High profit
(1, 'Paleto Bay Gas Station',  1, 'gas_station',  'The busiest fuel stop in Blaine County.',  5.00, 8000,  5,  -99.01,  6417.39, 31.63),
(2, 'Sandy Shores Gas Station',1, 'gas_station',  'Desert highway hub with heavy traffic.',   5.00, 8000,  5,  1795.47, 3778.16, 34.27),
(3, 'Alta Street Mechanic',    1, 'mechanic',     'High-end auto repair in downtown LS.',     5.00, 7500,  5, -349.65, -133.49, 38.44),

-- Tier 2 — Medium profit
(4, 'Rockford Hills Bistro',   2, 'restaurant',   'Upscale dining in the hills.',            5.00, 5500,  4, -716.44,  57.41, 52.49),
(5, 'Vespucci Tow Service',    2, 'mechanic',     'Beach-side recovery & repairs.',           5.00, 5000,  4, -434.40, -351.00, 34.50),
(6, 'Mirror Park Corner Store',2, 'convenience',  'Grab-and-go for Mirror Park locals.',      5.00, 4500,  4,  938.47, -268.10, 65.04),

-- Tier 3 — Entry-level / small families
(7, 'Davis Gas Station',       3, 'gas_station',  'Quiet station in South LS.',              5.00, 3000,  3,  218.47,-1738.25, 29.50),
(8, 'Strawberry Diner',        3, 'restaurant',   'Comfort food for the locals.',            5.00, 2500,  3, -248.15,-1558.25, 28.37),
(9, 'Cypress Flats Scrapyard', 3, 'mechanic',     'Budget repairs and part sales.',           5.00, 2500,  3,  920.97,-2022.79, 30.10);
