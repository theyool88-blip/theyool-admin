-- Storage Alerts Table
-- Dedicated table for storage quota alerts (80%, 90%, 100%)
-- Does NOT require phone number unlike notification_logs

CREATE TABLE IF NOT EXISTS storage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  threshold_percent INTEGER NOT NULL, -- 80, 90, or 100
  used_bytes BIGINT NOT NULL,
  quota_bytes BIGINT NOT NULL,
  acknowledged_at TIMESTAMPTZ, -- NULL = unacknowledged
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate alerts for same threshold on same day
  CONSTRAINT uq_storage_alert_daily UNIQUE (tenant_id, threshold_percent, (created_at::DATE))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storage_alerts_tenant ON storage_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storage_alerts_unacknowledged
  ON storage_alerts(tenant_id, acknowledged_at) WHERE acknowledged_at IS NULL;

-- RLS
ALTER TABLE storage_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view storage alerts in their tenant" ON storage_alerts;
CREATE POLICY "Users can view storage alerts in their tenant"
  ON storage_alerts FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Only admins can manage storage alerts" ON storage_alerts;
CREATE POLICY "Only admins can manage storage alerts"
  ON storage_alerts FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Grant permissions
GRANT SELECT ON storage_alerts TO authenticated;
GRANT ALL ON storage_alerts TO service_role;
