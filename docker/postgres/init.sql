-- MediCore AI - PostgreSQL Database Schema
-- Run automatically on first container start

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL CHECK (role IN ('doctor','radiologist','admin')),
    specialty       VARCHAR(255),
    license_number  VARCHAR(100),
    institution     VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PATIENTS ────────────────────────────────────────────────────────────────
CREATE TABLE patients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_code        VARCHAR(50) UNIQUE NOT NULL,
    full_name           VARCHAR(255) NOT NULL,
    date_of_birth       DATE NOT NULL,
    sex                 CHAR(1) NOT NULL CHECK (sex IN ('M','F','O')),
    national_id         VARCHAR(100),
    blood_type          VARCHAR(5),
    phone               VARCHAR(50),
    email               VARCHAR(255),
    address             TEXT,
    emergency_contact   VARCHAR(255),
    allergies           TEXT[],
    chronic_diseases    TEXT[],
    current_medications TEXT[],
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── STUDIES ─────────────────────────────────────────────────────────────────
CREATE TABLE studies (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id         UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    study_type         VARCHAR(50) NOT NULL CHECK (study_type IN ('ecg','xray','ct','mri','labs','vitals')),
    status             VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','reviewed')),
    urgency            VARCHAR(20) DEFAULT 'routine' CHECK (urgency IN ('routine','urgent','emergent')),
    file_path          TEXT,
    file_name          TEXT,
    file_size          BIGINT,
    file_mime          VARCHAR(100),
    clinical_notes     TEXT,
    ordering_physician VARCHAR(255),
    uploaded_by        UUID REFERENCES users(id),
    reviewed_by        UUID REFERENCES users(id),
    reviewed_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI RESULTS ──────────────────────────────────────────────────────────────
CREATE TABLE ai_results (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id           UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    model_name         VARCHAR(100) NOT NULL,
    model_version      VARCHAR(50),
    confidence_score   DECIMAL(5,2),
    urgency            VARCHAR(20) CHECK (urgency IN ('routine','urgent','emergent')),
    raw_findings       JSONB,
    measurements       JSONB,
    primary_findings   TEXT[],
    critical_flags     TEXT[],
    differential_dx    TEXT[],
    recommendation     TEXT,
    heatmap_path       TEXT,
    processing_time_ms INTEGER,
    error_message      TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REPORTS ─────────────────────────────────────────────────────────────────
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id        UUID NOT NULL REFERENCES studies(id),
    ai_result_id    UUID REFERENCES ai_results(id),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    language        VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en','fr','ar')),
    report_type     VARCHAR(50),
    report_text     TEXT NOT NULL,
    report_html     TEXT,
    status          VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft','pending_review','signed','finalized')),
    generated_by    UUID REFERENCES users(id),
    signed_by       UUID REFERENCES users(id),
    signed_at       TIMESTAMPTZ,
    physician_notes TEXT,
    pdf_path        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ECG ANALYSES ────────────────────────────────────────────────────────────
CREATE TABLE ecg_analyses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id        UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    ai_result_id    UUID REFERENCES ai_results(id),
    heart_rate      INTEGER,
    rhythm          VARCHAR(100),
    pr_interval_ms  INTEGER,
    qrs_duration_ms INTEGER,
    qt_interval_ms  INTEGER,
    qtc_interval_ms INTEGER,
    axis_degrees    INTEGER,
    stemi_detected  BOOLEAN DEFAULT FALSE,
    stemi_leads     TEXT[],
    nstemi_pattern  BOOLEAN DEFAULT FALSE,
    afib_detected   BOOLEAN DEFAULT FALSE,
    av_block_type   VARCHAR(50),
    qt_prolonged    BOOLEAN DEFAULT FALSE,
    lvh_detected    BOOLEAN DEFAULT FALSE,
    lbbb_detected   BOOLEAN DEFAULT FALSE,
    rbbb_detected   BOOLEAN DEFAULT FALSE,
    axis_deviation  VARCHAR(50),
    st_changes      JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── XRAY ANALYSES ───────────────────────────────────────────────────────────
CREATE TABLE xray_analyses (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id          UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    ai_result_id      UUID REFERENCES ai_results(id),
    view_type         VARCHAR(20),
    pneumonia_prob    DECIMAL(4,3),
    effusion_prob     DECIMAL(4,3),
    pneumothorax_prob DECIMAL(4,3),
    cardiomegaly_prob DECIMAL(4,3),
    pulm_edema_prob   DECIMAL(4,3),
    fibrosis_prob     DECIMAL(4,3),
    tb_pattern_prob   DECIMAL(4,3),
    findings          JSONB,
    impression        TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LAB RESULTS ─────────────────────────────────────────────────────────────
CREATE TABLE lab_results (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id         UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    patient_id       UUID NOT NULL REFERENCES patients(id),
    result_date      TIMESTAMPTZ DEFAULT NOW(),
    wbc              DECIMAL(6,2),
    rbc              DECIMAL(6,2),
    hemoglobin       DECIMAL(6,2),
    hematocrit       DECIMAL(6,2),
    platelets        INTEGER,
    neutrophils_pct  DECIMAL(5,2),
    lymphocytes_pct  DECIMAL(5,2),
    sodium           DECIMAL(6,2),
    potassium        DECIMAL(5,3),
    creatinine       DECIMAL(6,3),
    bun              DECIMAL(6,2),
    glucose          DECIMAL(6,2),
    alt              DECIMAL(7,2),
    ast              DECIMAL(7,2),
    troponin_i       DECIMAL(8,4),
    troponin_t       DECIMAL(8,4),
    bnp              DECIMAL(8,2),
    ck_mb            DECIMAL(8,2),
    pt               DECIMAL(6,2),
    inr              DECIMAL(5,3),
    ptt              DECIMAL(6,2),
    crp              DECIMAL(8,2),
    esr              INTEGER,
    procalcitonin    DECIMAL(8,4),
    ph               DECIMAL(5,3),
    pco2             DECIMAL(6,2),
    po2              DECIMAL(6,2),
    hco3             DECIMAL(6,2),
    sao2             DECIMAL(5,2),
    critical_values  JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ALERTS ──────────────────────────────────────────────────────────────────
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID REFERENCES patients(id),
    study_id        UUID REFERENCES studies(id),
    alert_type      VARCHAR(100) NOT NULL,
    severity        VARCHAR(20) NOT NULL CHECK (severity IN ('info','warning','critical')),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── VITALS ──────────────────────────────────────────────────────────────────
CREATE TABLE vitals (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    recorded_by      UUID REFERENCES users(id),
    recorded_at      TIMESTAMPTZ DEFAULT NOW(),
    heart_rate       INTEGER,
    systolic_bp      INTEGER,
    diastolic_bp     INTEGER,
    respiratory_rate INTEGER,
    temperature      DECIMAL(4,1),
    spo2             DECIMAL(4,1),
    gcs_score        INTEGER,
    weight_kg        DECIMAL(6,2),
    notes            TEXT
);

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(100),
    resource_id UUID,
    ip_address  INET,
    user_agent  TEXT,
    details     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_studies_patient    ON studies(patient_id);
CREATE INDEX idx_studies_status     ON studies(status);
CREATE INDEX idx_studies_type       ON studies(study_type);
CREATE INDEX idx_ai_results_study   ON ai_results(study_id);
CREATE INDEX idx_alerts_patient     ON alerts(patient_id);
CREATE INDEX idx_alerts_severity    ON alerts(severity);
CREATE INDEX idx_alerts_ack         ON alerts(is_acknowledged);
CREATE INDEX idx_audit_user         ON audit_logs(user_id);
CREATE INDEX idx_audit_created      ON audit_logs(created_at);
CREATE INDEX idx_lab_patient        ON lab_results(patient_id);
CREATE INDEX idx_vitals_patient     ON vitals(patient_id, recorded_at DESC);

-- ─── SEED: Demo admin user (password: Admin1234!) ────────────────────────────
INSERT INTO users (email, hashed_password, full_name, role, specialty, institution, is_active, is_verified)
VALUES (
    'admin@medicore.ai',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewuhdCEbF9E8mQey',
    'Dr. Admin',
    'admin',
    'Administration',
    'MediCore Medical Center',
    TRUE,
    TRUE
);
