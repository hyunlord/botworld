-- Botworld Database Schema
-- Requires PostgreSQL 13+ (gen_random_uuid)

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: owners
-- ============================================================
CREATE TABLE IF NOT EXISTS owners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    verified        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owners_email ON owners (email);

-- ============================================================
-- Table: agents
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_hash    TEXT NOT NULL,
    name            VARCHAR(50) UNIQUE NOT NULL,
    owner_id        UUID REFERENCES owners(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending_claim'
                    CHECK (status IN ('pending_claim', 'active', 'suspended', 'banned')),
    character_data  JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents (owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents (name);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents (last_active_at);

-- ============================================================
-- Table: world_state  (1 row per agent)
-- ============================================================
CREATE TABLE IF NOT EXISTS world_state (
    agent_id        UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    position        JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
    inventory       JSONB NOT NULL DEFAULT '[]',
    stats           JSONB NOT NULL DEFAULT '{}',
    current_action  VARCHAR(50),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: chat_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    location        JSONB,
    content         TEXT NOT NULL,
    message_type    VARCHAR(20) NOT NULL DEFAULT 'say'
                    CHECK (message_type IN ('say', 'whisper', 'shout', 'emote', 'system')),
    target_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_agent_id ON chat_messages (agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_target ON chat_messages (target_agent_id)
    WHERE target_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_type ON chat_messages (message_type);
CREATE INDEX IF NOT EXISTS idx_chat_agent_recent
    ON chat_messages (agent_id, created_at DESC);

-- ============================================================
-- Table: api_key_audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS api_key_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL
                    CHECK (event_type IN ('created', 'rotated', 'revoked', 'used', 'failed_auth')),
    ip_address      INET,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_agent_id ON api_key_audit_log (agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON api_key_audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON api_key_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_agent_recent
    ON api_key_audit_log (agent_id, created_at DESC);

-- ============================================================
-- Column: agents.claim_code (for ownership claim flow)
-- ============================================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_code VARCHAR(32) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_agents_claim_code ON agents (claim_code)
    WHERE claim_code IS NOT NULL;

-- ============================================================
-- Column: agents.violation_count (content filter violations)
-- ============================================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS violation_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- Extend api_key_audit_log event_type CHECK (add key_leak_attempt)
-- ============================================================
ALTER TABLE api_key_audit_log DROP CONSTRAINT IF EXISTS api_key_audit_log_event_type_check;
ALTER TABLE api_key_audit_log ADD CONSTRAINT api_key_audit_log_event_type_check
    CHECK (event_type IN ('created', 'rotated', 'revoked', 'used', 'failed_auth', 'key_leak_attempt'));

-- ============================================================
-- Column: chat_messages.blocked (ContentFilter blocked flag)
-- ============================================================
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_chat_blocked ON chat_messages (blocked) WHERE blocked = true;

-- ============================================================
-- Table: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    owner_id        UUID REFERENCES owners(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL
                    CHECK (type IN ('level_up', 'rare_item', 'trade_completed', 'character_ko', 'new_relationship', 'security_warning', 'bot_offline')),
    title           VARCHAR(100) NOT NULL,
    message         TEXT NOT NULL,
    data            JSONB NOT NULL DEFAULT '{}',
    read            BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_owner_id ON notifications (owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON notifications (agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_owner_unread ON notifications (owner_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);

-- ============================================================
-- Table: agent_skills (persistent skill progression)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_skills (
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id        VARCHAR(30) NOT NULL,
    level           INTEGER NOT NULL DEFAULT 0,
    xp              INTEGER NOT NULL DEFAULT 0,
    xp_to_next      INTEGER NOT NULL DEFAULT 10,
    unlocked_abilities TEXT[] NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill ON agent_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_level ON agent_skills (level DESC);

-- ============================================================
-- Table: agent_magic_state (persistent mana/effects)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_magic_state (
    agent_id        UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    max_mana        INTEGER NOT NULL DEFAULT 50,
    current_mana    INTEGER NOT NULL DEFAULT 50,
    cooldowns       JSONB NOT NULL DEFAULT '{}',
    active_casts    JSONB NOT NULL DEFAULT '[]',
    active_effects  JSONB NOT NULL DEFAULT '[]',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
