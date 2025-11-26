/**
 * Consultation Activity Log System
 * Tracks all changes made to consultations for audit purposes
 */

-- ============================================================================
-- CONSULTATION ACTIVITY LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultation_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Consultation reference
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,

  -- Activity details
  activity_type TEXT NOT NULL, -- 'created', 'status_changed', 'assigned', 'scheduled', 'rescheduled', 'cancelled', 'completed', 'field_updated', 'note_added'
  description TEXT NOT NULL, -- Human-readable description

  -- Change tracking
  field_name TEXT, -- Field that was changed (for field_updated type)
  old_value TEXT, -- Previous value (JSON string if complex)
  new_value TEXT, -- New value (JSON string if complex)

  -- Actor tracking
  actor_type TEXT NOT NULL DEFAULT 'admin', -- 'admin', 'system', 'customer'
  actor_id TEXT, -- User ID or identifier
  actor_name TEXT, -- Display name

  -- Metadata
  metadata JSONB, -- Additional context (IP address, user agent, etc.)
  is_system_generated BOOLEAN DEFAULT false
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_consultation_activity_log_consultation_id
  ON consultation_activity_log(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_activity_log_created_at
  ON consultation_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_activity_log_activity_type
  ON consultation_activity_log(activity_type);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE consultation_activity_log ENABLE ROW LEVEL SECURITY;

-- Admin can view all activity logs
CREATE POLICY "Admins can view all activity logs"
  ON consultation_activity_log
  FOR SELECT
  TO authenticated
  USING (true);

-- System can insert activity logs
CREATE POLICY "System can insert activity logs"
  ON consultation_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- AUTOMATIC ACTIVITY LOGGING TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION log_consultation_activity()
RETURNS TRIGGER AS $$
DECLARE
  activity_desc TEXT;
  old_status TEXT;
  new_status TEXT;
BEGIN
  -- Log different types of activities based on what changed

  IF (TG_OP = 'INSERT') THEN
    -- New consultation created
    INSERT INTO consultation_activity_log (
      consultation_id,
      activity_type,
      description,
      new_value,
      is_system_generated
    ) VALUES (
      NEW.id,
      'created',
      '새로운 상담 요청이 등록되었습니다.',
      json_build_object(
        'request_type', NEW.request_type,
        'name', NEW.name,
        'phone', NEW.phone,
        'status', NEW.status
      )::TEXT,
      true
    );

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Status changed
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO consultation_activity_log (
        consultation_id,
        activity_type,
        description,
        field_name,
        old_value,
        new_value,
        is_system_generated
      ) VALUES (
        NEW.id,
        'status_changed',
        '상담 상태가 변경되었습니다: ' || COALESCE(OLD.status, '없음') || ' → ' || NEW.status,
        'status',
        OLD.status,
        NEW.status,
        true
      );
    END IF;

    -- Lawyer assigned
    IF (OLD.assigned_lawyer IS DISTINCT FROM NEW.assigned_lawyer) THEN
      INSERT INTO consultation_activity_log (
        consultation_id,
        activity_type,
        description,
        field_name,
        old_value,
        new_value,
        is_system_generated
      ) VALUES (
        NEW.id,
        'assigned',
        '담당 변호사가 ' ||
          CASE
            WHEN NEW.assigned_lawyer IS NULL THEN '해제되었습니다'
            WHEN OLD.assigned_lawyer IS NULL THEN NEW.assigned_lawyer || '님으로 지정되었습니다'
            ELSE OLD.assigned_lawyer || '님에서 ' || NEW.assigned_lawyer || '님으로 변경되었습니다'
          END,
        'assigned_lawyer',
        OLD.assigned_lawyer,
        NEW.assigned_lawyer,
        true
      );
    END IF;

    -- Schedule confirmed/changed
    IF (OLD.confirmed_date IS DISTINCT FROM NEW.confirmed_date OR
        OLD.confirmed_time IS DISTINCT FROM NEW.confirmed_time) THEN

      -- Schedule deleted
      IF (NEW.confirmed_date IS NULL AND OLD.confirmed_date IS NOT NULL) THEN
        INSERT INTO consultation_activity_log (
          consultation_id,
          activity_type,
          description,
          field_name,
          old_value,
          is_system_generated
        ) VALUES (
          NEW.id,
          'rescheduled',
          '확정된 일정이 삭제되었습니다: ' || OLD.confirmed_date || ' ' || OLD.confirmed_time,
          'confirmed_schedule',
          json_build_object('date', OLD.confirmed_date, 'time', OLD.confirmed_time)::TEXT,
          true
        );

      -- Schedule added
      ELSIF (NEW.confirmed_date IS NOT NULL AND OLD.confirmed_date IS NULL) THEN
        INSERT INTO consultation_activity_log (
          consultation_id,
          activity_type,
          description,
          field_name,
          new_value,
          is_system_generated
        ) VALUES (
          NEW.id,
          'scheduled',
          '상담 일정이 확정되었습니다: ' || NEW.confirmed_date || ' ' || NEW.confirmed_time,
          'confirmed_schedule',
          json_build_object('date', NEW.confirmed_date, 'time', NEW.confirmed_time)::TEXT,
          true
        );

      -- Schedule changed
      ELSIF (NEW.confirmed_date IS NOT NULL AND OLD.confirmed_date IS NOT NULL) THEN
        INSERT INTO consultation_activity_log (
          consultation_id,
          activity_type,
          description,
          field_name,
          old_value,
          new_value,
          is_system_generated
        ) VALUES (
          NEW.id,
          'rescheduled',
          '상담 일정이 변경되었습니다: ' ||
            OLD.confirmed_date || ' ' || OLD.confirmed_time || ' → ' ||
            NEW.confirmed_date || ' ' || NEW.confirmed_time,
          'confirmed_schedule',
          json_build_object('date', OLD.confirmed_date, 'time', OLD.confirmed_time)::TEXT,
          json_build_object('date', NEW.confirmed_date, 'time', NEW.confirmed_time)::TEXT,
          true
        );
      END IF;
    END IF;

    -- Case linked
    IF (OLD.case_id IS DISTINCT FROM NEW.case_id AND NEW.case_id IS NOT NULL) THEN
      INSERT INTO consultation_activity_log (
        consultation_id,
        activity_type,
        description,
        field_name,
        new_value,
        is_system_generated
      ) VALUES (
        NEW.id,
        'field_updated',
        '사건이 연결되었습니다.',
        'case_id',
        NEW.case_id,
        true
      );
    END IF;

    -- Admin notes updated
    IF (OLD.admin_notes IS DISTINCT FROM NEW.admin_notes AND
        LENGTH(COALESCE(NEW.admin_notes, '')) > LENGTH(COALESCE(OLD.admin_notes, ''))) THEN
      INSERT INTO consultation_activity_log (
        consultation_id,
        activity_type,
        description,
        is_system_generated
      ) VALUES (
        NEW.id,
        'note_added',
        '관리자 메모가 추가되었습니다.',
        true
      );
    END IF;

    -- Source updated
    IF (OLD.source IS DISTINCT FROM NEW.source) THEN
      INSERT INTO consultation_activity_log (
        consultation_id,
        activity_type,
        description,
        field_name,
        old_value,
        new_value,
        is_system_generated
      ) VALUES (
        NEW.id,
        'field_updated',
        '유입 경로가 ' ||
          CASE
            WHEN NEW.source IS NULL THEN '제거되었습니다'
            WHEN OLD.source IS NULL THEN NEW.source || '(으)로 설정되었습니다'
            ELSE OLD.source || '에서 ' || NEW.source || '(으)로 변경되었습니다'
          END,
        'source',
        OLD.source,
        NEW.source,
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic activity logging
DROP TRIGGER IF EXISTS trigger_log_consultation_activity ON consultations;
CREATE TRIGGER trigger_log_consultation_activity
  AFTER INSERT OR UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION log_consultation_activity();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get activity summary for a consultation
CREATE OR REPLACE FUNCTION get_consultation_activity_summary(consultation_uuid UUID)
RETURNS TABLE (
  total_activities BIGINT,
  last_activity_at TIMESTAMPTZ,
  status_changes BIGINT,
  schedule_changes BIGINT,
  notes_added BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_activities,
    MAX(created_at) as last_activity_at,
    COUNT(*) FILTER (WHERE activity_type = 'status_changed')::BIGINT as status_changes,
    COUNT(*) FILTER (WHERE activity_type IN ('scheduled', 'rescheduled'))::BIGINT as schedule_changes,
    COUNT(*) FILTER (WHERE activity_type = 'note_added')::BIGINT as notes_added
  FROM consultation_activity_log
  WHERE consultation_id = consultation_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for existing consultations)
-- ============================================================================

-- Add "created" activity for all existing consultations
INSERT INTO consultation_activity_log (
  consultation_id,
  activity_type,
  description,
  created_at,
  is_system_generated
)
SELECT
  id,
  'created',
  '상담 요청이 등록되었습니다. (마이그레이션)',
  created_at,
  true
FROM consultations
WHERE NOT EXISTS (
  SELECT 1 FROM consultation_activity_log cal
  WHERE cal.consultation_id = consultations.id AND cal.activity_type = 'created'
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE consultation_activity_log IS '상담 활동 이력 - 모든 상담 변경사항을 추적합니다';
COMMENT ON COLUMN consultation_activity_log.activity_type IS '활동 유형: created, status_changed, assigned, scheduled, rescheduled, cancelled, completed, field_updated, note_added';
COMMENT ON COLUMN consultation_activity_log.description IS '사람이 읽을 수 있는 활동 설명';
COMMENT ON COLUMN consultation_activity_log.actor_type IS '활동 주체: admin, system, customer';
