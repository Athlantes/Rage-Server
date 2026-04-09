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
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Permit cycles (one row per 30-day lease period per business) ──────────
CREATE TABLE IF NOT EXISTS permit_cycles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id     INT UNSIGNED NOT NULL,
    family_id       INT UNSIGNED NULL COMMENT 'NULL = no winner yet / cycle just created',
    started_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP    NULL DEFAULT NULL,
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
INSERT IGNORE INTO businesses (id, name, tier, type, description, passive_pct, delivery_payout, max_tickets) VALUES
(1, 'Gas Station',    1, 'gas_station', 'Controls the permit for every gas station in the state.', 5.00, 8000, 5),
(2, 'Car Dealership', 1, 'dealership',  'Controls the permit for vehicle sales.',                  5.00, 8000, 5),
(3, 'Tuning Shop',    2, 'tuning',      'Controls the permit for all mechanic and tuning shops.',  5.00, 6000, 4),
(4, '24/7 Store',     3, 'convenience', 'Controls the permit for every convenience store.',        5.00, 4000, 3);
