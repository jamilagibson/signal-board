-- Migration 001: Add NOT NULL constraints to votes.user_id and votes.feature_request_id
--
-- These columns were nullable at creation, allowing inserts with missing fields
-- to succeed silently. The FK constraints only reject present-but-invalid values;
-- they do not reject null. NOT NULL constraints close that gap at the DB layer.
--
-- Run: psql -U <user> -d signalboard -f src/db/migrations/001_votes_not_null.sql

ALTER TABLE votes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE votes ALTER COLUMN feature_request_id SET NOT NULL;
