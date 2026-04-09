-- ============================================================
--  Family Points — Migration
--  Run once against your central_db database
-- ============================================================

-- Add family_points column to family_members
-- Default 0, capped by server logic at 200 (FAMILY_POINTS_MAX_STORED)

ALTER TABLE family_members
    ADD COLUMN family_points INT UNSIGNED NOT NULL DEFAULT 0
        COMMENT 'Personal family contribution points (max 200 stored)';
 