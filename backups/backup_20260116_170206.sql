


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "the0";


ALTER SCHEMA "the0" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "theai";


ALTER SCHEMA "theai" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."admissibility_status_enum" AS ENUM (
    'undisputed',
    'disputed_by_us',
    'disputed_by_opponent',
    'excluded',
    'admitted'
);


ALTER TYPE "public"."admissibility_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."authenticity_status_enum" AS ENUM (
    'unverified',
    'verified',
    'disputed',
    'forged'
);


ALTER TYPE "public"."authenticity_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."case_intent_enum" AS ENUM (
    'new_case_complaint',
    'answer_or_prep_brief',
    'appeal',
    'review_only'
);


ALTER TYPE "public"."case_intent_enum" OWNER TO "postgres";


CREATE TYPE "public"."case_stage_enum" AS ENUM (
    'intake',
    'complaint_drafting',
    'first_instance',
    'first_judgment',
    'appeal_pending',
    'appeal_instance',
    'closed'
);


ALTER TYPE "public"."case_stage_enum" OWNER TO "postgres";


CREATE TYPE "public"."claim_type_enum" AS ENUM (
    'factual',
    'legal'
);


ALTER TYPE "public"."claim_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."counter_position_enum" AS ENUM (
    'admit',
    'deny',
    'partial',
    'silent'
);


ALTER TYPE "public"."counter_position_enum" OWNER TO "postgres";


CREATE TYPE "public"."deadline_status" AS ENUM (
    'PENDING',
    'COMPLETED',
    'OVERDUE'
);


ALTER TYPE "public"."deadline_status" OWNER TO "postgres";


CREATE TYPE "public"."deadline_type" AS ENUM (
    'DL_APPEAL',
    'DL_MEDIATION_OBJ',
    'DL_IMM_APPEAL',
    'DL_APPEAL_BRIEF',
    'DL_RETRIAL',
    'DL_FINAL_APPEAL_BRIEF',
    'DL_PAYMENT_ORDER_OBJ',
    'DL_RECONCILIATION_OBJ',
    'DL_APPEAL_DISMISSAL_IMMED',
    'DL_FAMILY_APPEAL',
    'DL_FAMILY_RETRIAL',
    'DL_EXECUTION_OBJECTION',
    'DL_PROVISIONAL_APPEAL',
    'DL_CRIMINAL_APPEAL',
    'DL_FAMILY_NONLIT',
    'DL_PAYMENT_ORDER'
);


ALTER TYPE "public"."deadline_type" OWNER TO "postgres";


CREATE TYPE "public"."evidence_mode_enum" AS ENUM (
    'documentary',
    'testimonial',
    'physical',
    'digital'
);


ALTER TYPE "public"."evidence_mode_enum" OWNER TO "postgres";


CREATE TYPE "public"."evidence_role_enum" AS ENUM (
    'supports',
    'refutes',
    'context'
);


ALTER TYPE "public"."evidence_role_enum" OWNER TO "postgres";


CREATE TYPE "public"."evidence_strength_enum" AS ENUM (
    'strong',
    'medium',
    'weak'
);


ALTER TYPE "public"."evidence_strength_enum" OWNER TO "postgres";


CREATE TYPE "public"."fact_type_enum" AS ENUM (
    'direct',
    'circumstantial'
);


ALTER TYPE "public"."fact_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."hearing_result" AS ENUM (
    'CONTINUED',
    'CONCLUDED',
    'POSTPONED',
    'DISMISSED'
);


ALTER TYPE "public"."hearing_result" OWNER TO "postgres";


CREATE TYPE "public"."hearing_status" AS ENUM (
    'SCHEDULED',
    'COMPLETED',
    'POSTPONED',
    'CANCELLED'
);


ALTER TYPE "public"."hearing_status" OWNER TO "postgres";


CREATE TYPE "public"."hearing_type" AS ENUM (
    'HEARING_MAIN',
    'HEARING_INTERIM',
    'HEARING_MEDIATION',
    'HEARING_INVESTIGATION',
    'HEARING_PARENTING',
    'HEARING_JUDGMENT',
    'HEARING_LAWYER_MEETING'
);


ALTER TYPE "public"."hearing_type" OWNER TO "postgres";


CREATE TYPE "public"."judgment_outcome_enum" AS ENUM (
    'full_win',
    'partial_win',
    'loss',
    'dismissed',
    'settled'
);


ALTER TYPE "public"."judgment_outcome_enum" OWNER TO "postgres";


CREATE TYPE "public"."norm_type_enum" AS ENUM (
    'statute',
    'precedent',
    'regulation'
);


ALTER TYPE "public"."norm_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."receivable_grade" AS ENUM (
    'normal',
    'watch',
    'collection'
);


ALTER TYPE "public"."receivable_grade" OWNER TO "postgres";


CREATE TYPE "public"."side_enum" AS ENUM (
    'ours',
    'opponent',
    'court'
);


ALTER TYPE "public"."side_enum" OWNER TO "postgres";


CREATE TYPE "public"."work_session_status_enum" AS ENUM (
    'planning',
    'executing',
    'paused',
    'completed',
    'failed'
);


ALTER TYPE "public"."work_session_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."work_session_type_enum" AS ENUM (
    'brief_writing',
    'case_analysis',
    'strategy',
    'general'
);


ALTER TYPE "public"."work_session_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."work_task_status_enum" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'skipped'
);


ALTER TYPE "public"."work_task_status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_assign_wmonid"("p_member_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_wmonid_id UUID;
BEGIN
  -- 가장 여유있는 활성 WMONID 찾기
  SELECT id INTO v_wmonid_id
  FROM scourt_user_wmonid
  WHERE member_id = p_member_id
    AND status = 'active'
    AND case_count < 50
  ORDER BY case_count ASC
  LIMIT 1;

  -- 찾지 못하면 NULL 반환 (새 WMONID 발급 필요)
  RETURN v_wmonid_id;
END;
$$;


ALTER FUNCTION "public"."auto_assign_wmonid"("p_member_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_assign_wmonid"("p_member_id" "uuid") IS '멤버에게 가장 여유있는 WMONID 자동 할당. 없으면 NULL 반환.';



CREATE OR REPLACE FUNCTION "public"."auto_calculate_deadline"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    IF NEW.deadline_date IS NULL THEN
      NEW.deadline_date :=
  calculate_deadline_date(NEW.trigger_date,
  NEW.deadline_type);
    END IF;

    IF NEW.days_count IS NULL THEN
      SELECT days_count INTO NEW.days_count
      FROM deadline_types
      WHERE type = NEW.deadline_type;
    END IF;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."auto_calculate_deadline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."blog_search_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
      setweight(to_tsvector('simple', COALESCE(NEW.excerpt, '')), 'B') ||
      setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C') ||
      setweight(to_tsvector('simple', array_to_string(NEW.tags, ' ')), 'B');
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."blog_search_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_deadline_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    v_days INTEGER;
    v_deadline_date DATE;
    v_deadline_datetime TIMESTAMPTZ;
    v_exclude_initial_day BOOLEAN := FALSE;
  BEGIN
    SELECT days INTO v_days
    FROM deadline_types
    WHERE type = NEW.deadline_type;

    IF v_days IS NULL THEN
      RAISE EXCEPTION 'Invalid deadline_type: %', NEW.deadline_type;
    END IF;

    v_deadline_date := calculate_legal_deadline(
      NEW.trigger_date,
      v_days,
      v_exclude_initial_day
    );

    v_deadline_datetime := (v_deadline_date || ' 00:00:00')::TIMESTAMPTZ;

    NEW.deadline_date := v_deadline_date;
    NEW.deadline_datetime := v_deadline_datetime;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."calculate_deadline_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_legal_deadline"("trigger_date" "date", "days" integer, "exclude_initial_day" boolean DEFAULT false) RETURNS "date"
    LANGUAGE "plpgsql" STABLE
    AS $$
  DECLARE
    v_start_date DATE;
    v_deadline DATE;
  BEGIN
    v_start_date := trigger_date;

    IF exclude_initial_day THEN
      v_start_date := v_start_date + INTERVAL '1 day';
    END IF;

    v_deadline := v_start_date + (days || ' days')::INTERVAL;
    v_deadline := get_next_business_day(v_deadline);

    RETURN v_deadline;
  END;
  $$;


ALTER FUNCTION "public"."calculate_legal_deadline"("trigger_date" "date", "days" integer, "exclude_initial_day" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_memory_retention"("last_accessed" timestamp with time zone, "decay_rate" double precision, "importance" double precision) RETURNS double precision
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  hours_passed FLOAT;
  stability FLOAT;
  retention FLOAT;
BEGIN
  hours_passed := EXTRACT(EPOCH FROM (NOW() - last_accessed)) / 3600;
  stability := (1 - decay_rate) * (1 + importance); -- importance가 높으면 더 오래 유지
  retention := EXP(-hours_passed / (stability * 24 * 7)); -- 주 단위 decay
  RETURN GREATEST(retention, 0.01); -- 최소 1% 유지
END;
$$;


ALTER FUNCTION "public"."calculate_memory_retention"("last_accessed" timestamp with time zone, "decay_rate" double precision, "importance" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cases_search_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.highlight_text, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.full_story, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.story_before, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.story_journey, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.story_after, '')), 'C');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cases_search_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_wmonid_case_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_count INTEGER;
  max_cases INTEGER := 50;  -- WMONID당 최대 사건 수
BEGIN
  -- user_wmonid_id가 없으면 체크하지 않음
  IF NEW.user_wmonid_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 현재 WMONID의 사건 수 조회
  SELECT case_count INTO current_count
  FROM scourt_user_wmonid
  WHERE id = NEW.user_wmonid_id;

  -- 제한 초과 확인
  IF current_count >= max_cases THEN
    RAISE EXCEPTION 'WMONID case limit exceeded. Maximum % cases allowed per WMONID. Current: %',
      max_cases, current_count;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_wmonid_case_limit"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_wmonid_case_limit"() IS 'WMONID당 50건 제한을 체크하는 트리거 함수';



CREATE OR REPLACE FUNCTION "public"."cleanup_episodic_memory"("target_user_id" "uuid", "retention_threshold" double precision DEFAULT 0.3) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INT;
BEGIN
  -- 낮은 retention의 에피소드를 삭제 (summary만 남김)
  WITH to_cleanup AS (
    SELECT id
    FROM episodic_memory
    WHERE user_id = target_user_id
      AND calculate_memory_retention(last_accessed_at, decay_rate, importance) < retention_threshold
      AND summary IS NOT NULL
  )
  UPDATE episodic_memory
  SET content = '{"compressed": true}'::jsonb
  WHERE id IN (SELECT id FROM to_cleanup);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_episodic_memory"("target_user_id" "uuid", "retention_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_case_evidence"("case_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  photo_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO photo_count
  FROM testimonial_evidence_photos
  WHERE case_id = case_uuid
    AND blur_applied = true;
  RETURN photo_count;
END;
$$;


ALTER FUNCTION "public"."count_case_evidence"("case_uuid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."scourt_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_case_id" "uuid",
    "tenant_id" "uuid",
    "sync_type" character varying(20) NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "status" character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "backoff_until" timestamp with time zone,
    "last_error" "text",
    "lock_token" "text",
    "dedup_key" "text",
    "requested_by" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scourt_sync_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dequeue_scourt_sync_jobs"("p_limit" integer, "p_worker_id" "text") RETURNS SETOF "public"."scourt_sync_jobs"
    LANGUAGE "sql"
    AS $$
  UPDATE scourt_sync_jobs
  SET status = 'running',
      started_at = NOW(),
      lock_token = p_worker_id,
      attempts = attempts + 1,
      updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM scourt_sync_jobs
    WHERE status = 'queued'
      AND scheduled_at <= NOW()
      AND (backoff_until IS NULL OR backoff_until <= NOW())
    ORDER BY priority DESC, scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
$$;


ALTER FUNCTION "public"."dequeue_scourt_sync_jobs"("p_limit" integer, "p_worker_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."faqs_search_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.search_vector :=
      setweight(to_tsvector('simple', COALESCE(NEW.question, '')), 'A') ||
      setweight(to_tsvector('simple', COALESCE(NEW.summary, '')), 'B') ||
      setweight(to_tsvector('simple', COALESCE(NEW.answer, '')), 'C');
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."faqs_search_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_available_wmonid_for_member"("p_member_id" "uuid") RETURNS TABLE("wmonid_id" "uuid", "wmonid" character varying, "case_count" integer, "remaining_capacity" integer)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id AS wmonid_id,
    w.wmonid,
    w.case_count,
    GREATEST(0, 50 - w.case_count) AS remaining_capacity
  FROM scourt_user_wmonid w
  WHERE w.member_id = p_member_id
    AND w.status = 'active'
    AND w.case_count < 50
  ORDER BY w.case_count ASC  -- 가장 여유있는 WMONID 먼저
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."find_available_wmonid_for_member"("p_member_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_available_wmonid_for_member"("p_member_id" "uuid") IS '멤버에게 할당된 사용 가능한 WMONID 목록 반환 (50건 미만인 것만)';



CREATE OR REPLACE FUNCTION "public"."get_case_with_evidence"("case_uuid" "uuid") RETURNS TABLE("case_data" json, "evidence_photos" json)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    row_to_json(c.*) as case_data,
    COALESCE(
      json_agg(
        row_to_json(e.*)
        ORDER BY e.display_order ASC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::json
    ) as evidence_photos
  FROM testimonial_cases c
  LEFT JOIN testimonial_evidence_photos e ON e.case_id = c.id AND e.blur_applied = true
  WHERE c.id = case_uuid
    AND c.published = true
    AND c.consent_given = true
  GROUP BY c.id;
END;
$$;


ALTER FUNCTION "public"."get_case_with_evidence"("case_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_consultation_activity_summary"("consultation_uuid" "uuid") RETURNS TABLE("total_activities" bigint, "last_activity_at" timestamp with time zone, "status_changes" bigint, "schedule_changes" bigint, "notes_added" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_consultation_activity_summary"("consultation_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_member_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_member_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_member_id"() IS '현재 로그인한 사용자의 멤버 ID 반환';



CREATE OR REPLACE FUNCTION "public"."get_current_member_role"() RETURNS character varying
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_member_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT tenant_id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_tenant_id"() IS '현재 로그인한 사용자의 활성 테넌트 ID 반환';



CREATE OR REPLACE FUNCTION "public"."get_next_business_day"("from_date" "date") RETURNS "date"
    LANGUAGE "plpgsql" STABLE
    AS $$
  DECLARE
    v_next_day DATE;
    v_max_iterations INTEGER := 10;
    v_counter INTEGER := 0;
  BEGIN
    v_next_day := from_date;

    LOOP
      v_counter := v_counter + 1;
      IF v_counter > v_max_iterations THEN
        EXIT;
      END IF;

      IF NOT is_non_business_day(v_next_day) THEN
        RETURN v_next_day;
      END IF;

      v_next_day := v_next_day + INTERVAL '1 day';
    END LOOP;

    RETURN from_date;
  END;
  $$;


ALTER FUNCTION "public"."get_next_business_day"("from_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_testimonial_stats_by_category"() RETURNS TABLE("category" "text", "total_count" bigint, "total_amount" bigint, "evidence_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.category,
    COUNT(*) as total_count,
    SUM(COALESCE(c.case_result_amount, 0)) as total_amount,
    COUNT(e.id) as evidence_count
  FROM testimonial_cases c
  LEFT JOIN testimonial_evidence_photos e ON e.case_id = c.id AND e.blur_applied = true
  WHERE c.published = true AND c.consent_given = true
  GROUP BY c.category
  ORDER BY total_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_testimonial_stats_by_category"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_wmonid_remaining_capacity"("p_wmonid_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  current_count INTEGER;
  max_cases INTEGER := 50;
BEGIN
  SELECT case_count INTO current_count
  FROM scourt_user_wmonid
  WHERE id = p_wmonid_id;

  IF current_count IS NULL THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(0, max_cases - current_count);
END;
$$;


ALTER FUNCTION "public"."get_wmonid_remaining_capacity"("p_wmonid_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_wmonid_remaining_capacity"("p_wmonid_id" "uuid") IS 'WMONID의 남은 사건 등록 용량 반환 (최대 50건)';



CREATE OR REPLACE FUNCTION "public"."get_wmonid_stats"("p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("total_wmonids" integer, "active_wmonids" integer, "expiring_wmonids" integer, "expired_wmonids" integer, "total_cases" integer, "total_capacity" integer, "remaining_capacity" integer, "usage_percent" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_wmonids,
    COUNT(CASE WHEN w.status = 'active' THEN 1 END)::INTEGER AS active_wmonids,
    COUNT(CASE WHEN w.status = 'expiring' THEN 1 END)::INTEGER AS expiring_wmonids,
    COUNT(CASE WHEN w.status = 'expired' THEN 1 END)::INTEGER AS expired_wmonids,
    COALESCE(SUM(w.case_count), 0)::INTEGER AS total_cases,
    (COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) * 50)::INTEGER AS total_capacity,
    (COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) * 50 -
      COALESCE(SUM(CASE WHEN w.status IN ('active', 'expiring') THEN w.case_count ELSE 0 END), 0))::INTEGER AS remaining_capacity,
    CASE
      WHEN COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) > 0
      THEN ROUND(
        COALESCE(SUM(CASE WHEN w.status IN ('active', 'expiring') THEN w.case_count ELSE 0 END), 0)::NUMERIC /
        (COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) * 50) * 100,
        2
      )
      ELSE 0
    END AS usage_percent
  FROM scourt_user_wmonid w
  WHERE (p_tenant_id IS NULL OR w.tenant_id = p_tenant_id);
END;
$$;


ALTER FUNCTION "public"."get_wmonid_stats"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_wmonid_stats"("p_tenant_id" "uuid") IS 'WMONID 사용 통계 반환. tenant_id가 NULL이면 전체 통계.';



CREATE OR REPLACE FUNCTION "public"."handle_consultation_status_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Set contacted_at when status changes to 'contacted'
  IF NEW.status = 'contacted' AND (OLD.status IS NULL OR OLD.status != 'contacted') THEN
    NEW.contacted_at = timezone('utc'::text, now());
  END IF;

  -- Set confirmed_at when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    NEW.confirmed_at = timezone('utc'::text, now());
  END IF;

  -- Set completed_at when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = timezone('utc'::text, now());
  END IF;

  -- Set cancelled_at when status changes to 'cancelled' or 'no_show'
  IF NEW.status IN ('cancelled', 'no_show') AND (OLD.status IS NULL OR OLD.status NOT IN ('cancelled', 'no_show')) THEN
    NEW.cancelled_at = timezone('utc'::text, now());
  END IF;

  -- Set paid_at when payment_status changes to 'completed'
  IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
    NEW.paid_at = timezone('utc'::text, now());
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_consultation_status_timestamps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role_or_higher"("required_role" character varying) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  user_role VARCHAR;
  role_hierarchy INTEGER;
  required_hierarchy INTEGER;
BEGIN
  -- 슈퍼 어드민은 모든 역할 접근 가능
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 역할 계층: owner(4) > admin(3) > lawyer(2) > staff(1)
  SELECT CASE user_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO role_hierarchy;

  SELECT CASE required_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO required_hierarchy;

  RETURN role_hierarchy >= required_hierarchy;
END;
$$;


ALTER FUNCTION "public"."has_role_or_higher"("required_role" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_blog_views"("post_slug" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  BEGIN
    UPDATE blog_posts SET views = views + 1 WHERE slug = post_slug;
  END;
  $$;


ALTER FUNCTION "public"."increment_blog_views"("post_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_case_views"("case_slug" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  BEGIN
    UPDATE cases SET views = views + 1 WHERE slug = case_slug;
  END;
  $$;


ALTER FUNCTION "public"."increment_case_views"("case_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_faq_views"("faq_slug" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  BEGIN
    UPDATE faqs SET views = views + 1 WHERE slug = faq_slug;
  END;
  $$;


ALTER FUNCTION "public"."increment_faq_views"("faq_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_instagram_likes"("post_slug" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  BEGIN
    UPDATE instagram_posts SET likes = likes + 1 WHERE slug = post_slug;
  END;
  $$;


ALTER FUNCTION "public"."increment_instagram_likes"("post_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_instagram_views"("post_slug" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  BEGIN
    UPDATE instagram_posts SET views = views + 1 WHERE slug = post_slug;
  END;
  $$;


ALTER FUNCTION "public"."increment_instagram_views"("post_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_testimonial_helpful"("testimonial_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE testimonials
  SET helpful_count = helpful_count + 1
  WHERE id = testimonial_id AND published = true;
END;
$$;


ALTER FUNCTION "public"."increment_testimonial_helpful"("testimonial_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_testimonial_views"("testimonial_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE testimonials
  SET views = views + 1
  WHERE id = testimonial_id AND published = true;
END;
$$;


ALTER FUNCTION "public"."increment_testimonial_views"("testimonial_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_non_business_day"("check_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
  BEGIN
    RETURN is_saturday(check_date) OR is_public_holiday(check_date);
  END;
  $$;


ALTER FUNCTION "public"."is_non_business_day"("check_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_public_holiday"("check_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
  BEGIN
    IF is_sunday(check_date) THEN
      RETURN TRUE;
    END IF;

    RETURN EXISTS (
      SELECT 1 FROM korean_public_holidays
      WHERE holiday_date = check_date
    );
  END;
  $$;


ALTER FUNCTION "public"."is_public_holiday"("check_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_saturday"("check_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
  BEGIN
    RETURN EXTRACT(DOW FROM check_date) = 6;
  END;
  $$;


ALTER FUNCTION "public"."is_saturday"("check_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_sunday"("check_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
  BEGIN
    RETURN EXTRACT(DOW FROM check_date) = 0;
  END;
  $$;


ALTER FUNCTION "public"."is_sunday"("check_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS(
    SELECT 1 FROM super_admins
    WHERE user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_super_admin"() IS '현재 사용자가 슈퍼 어드민인지 확인';



CREATE OR REPLACE FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS(
    SELECT 1 FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."learn_persona_pattern"("target_user_id" "uuid", "pattern_type" "text", "pattern_value" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  patterns JSONB;
  existing_idx INT;
  new_pattern JSONB;
BEGIN
  -- 현재 패턴 가져오기
  SELECT learned_patterns INTO patterns
  FROM user_personas
  WHERE user_id = target_user_id;

  IF patterns IS NULL THEN
    patterns := '[]'::jsonb;
  END IF;

  -- 기존 패턴 찾기
  SELECT i INTO existing_idx
  FROM jsonb_array_elements(patterns) WITH ORDINALITY AS x(elem, i)
  WHERE x.elem->>'type' = pattern_type AND x.elem->>'pattern' = pattern_value
  LIMIT 1;

  IF existing_idx IS NOT NULL THEN
    -- 빈도 증가
    patterns := jsonb_set(
      patterns,
      ARRAY[(existing_idx - 1)::text, 'frequency'],
      to_jsonb((patterns->(existing_idx - 1)->>'frequency')::int + 1)
    );
    patterns := jsonb_set(
      patterns,
      ARRAY[(existing_idx - 1)::text, 'lastUsed'],
      to_jsonb(NOW()::text)
    );
  ELSE
    -- 새 패턴 추가
    new_pattern := jsonb_build_object(
      'type', pattern_type,
      'pattern', pattern_value,
      'frequency', 1,
      'lastUsed', NOW()::text,
      'positive', true
    );
    patterns := patterns || jsonb_build_array(new_pattern);
  END IF;

  -- 상위 20개만 유지 (빈도순)
  WITH ranked AS (
    SELECT elem
    FROM jsonb_array_elements(patterns) AS elem
    ORDER BY (elem->>'frequency')::int DESC
    LIMIT 20
  )
  SELECT jsonb_agg(elem) INTO patterns FROM ranked;

  -- 저장
  INSERT INTO user_personas (user_id, learned_patterns, updated_at)
  VALUES (target_user_id, COALESCE(patterns, '[]'::jsonb), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    learned_patterns = COALESCE(patterns, '[]'::jsonb),
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."learn_persona_pattern"("target_user_id" "uuid", "pattern_type" "text", "pattern_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_consultation_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    IF (TG_OP = 'INSERT') THEN
      INSERT INTO consultation_activity_log (
        consultation_id, activity_type, description, new_value, is_system_generated
      ) VALUES (
        NEW.id, 'created', '새로운 상담 요청이 등록되었습니다.',
        json_build_object('request_type', NEW.request_type, 'name', NEW.name, 'phone', NEW.phone,
  'status', NEW.status)::TEXT,
        true
      );

    ELSIF (TG_OP = 'UPDATE') THEN
      -- Status changed
      IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO consultation_activity_log (
          consultation_id, activity_type, description, field_name, old_value, new_value,
  is_system_generated
        ) VALUES (
          NEW.id, 'status_changed', '상담 상태가 변경되었습니다: ' || COALESCE(OLD.status, '없음')
   || ' → ' || NEW.status,
          'status', OLD.status, NEW.status, true
        );
      END IF;

      -- Lawyer assigned
      IF (OLD.assigned_lawyer IS DISTINCT FROM NEW.assigned_lawyer) THEN
        INSERT INTO consultation_activity_log (
          consultation_id, activity_type, description, field_name, old_value, new_value,
  is_system_generated
        ) VALUES (
          NEW.id, 'assigned',
          '담당 변호사가 ' || CASE WHEN NEW.assigned_lawyer IS NULL THEN '해제되었습니다'
            WHEN OLD.assigned_lawyer IS NULL THEN NEW.assigned_lawyer || '님으로 지정되었습니다'
            ELSE OLD.assigned_lawyer || '님에서 ' || NEW.assigned_lawyer || '님으로 
  변경되었습니다' END,
          'assigned_lawyer', OLD.assigned_lawyer, NEW.assigned_lawyer, true
        );
      END IF;

      -- Schedule confirmed/changed
      IF (OLD.confirmed_date IS DISTINCT FROM NEW.confirmed_date OR OLD.confirmed_time IS DISTINCT
   FROM NEW.confirmed_time) THEN
        IF (NEW.confirmed_date IS NULL AND OLD.confirmed_date IS NOT NULL) THEN
          INSERT INTO consultation_activity_log (
            consultation_id, activity_type, description, field_name, old_value,
  is_system_generated
          ) VALUES (
            NEW.id, 'rescheduled', '확정된 일정이 삭제되었습니다: ' || OLD.confirmed_date || ' '
  || OLD.confirmed_time,
            'confirmed_schedule', json_build_object('date', OLD.confirmed_date, 'time',
  OLD.confirmed_time)::TEXT, true
          );
        ELSIF (NEW.confirmed_date IS NOT NULL AND OLD.confirmed_date IS NULL) THEN
          INSERT INTO consultation_activity_log (
            consultation_id, activity_type, description, field_name, new_value,
  is_system_generated
          ) VALUES (
            NEW.id, 'scheduled', '상담 일정이 확정되었습니다: ' || NEW.confirmed_date || ' ' ||
  NEW.confirmed_time,
            'confirmed_schedule', json_build_object('date', NEW.confirmed_date, 'time',
  NEW.confirmed_time)::TEXT, true
          );
        ELSIF (NEW.confirmed_date IS NOT NULL AND OLD.confirmed_date IS NOT NULL) THEN
          INSERT INTO consultation_activity_log (
            consultation_id, activity_type, description, field_name, old_value, new_value,
  is_system_generated
          ) VALUES (
            NEW.id, 'rescheduled', '상담 일정이 변경되었습니다',
            'confirmed_schedule',
            json_build_object('date', OLD.confirmed_date, 'time', OLD.confirmed_time)::TEXT,
            json_build_object('date', NEW.confirmed_date, 'time', NEW.confirmed_time)::TEXT, true
          );
        END IF;
      END IF;

      -- Case linked (수정된 부분: case_id → converted_to_case_id)
      IF (OLD.converted_to_case_id IS DISTINCT FROM NEW.converted_to_case_id AND
  NEW.converted_to_case_id IS NOT NULL) THEN
        INSERT INTO consultation_activity_log (
          consultation_id, activity_type, description, field_name, new_value, is_system_generated
        ) VALUES (
          NEW.id, 'field_updated', '사건이 연결되었습니다.', 'converted_to_case_id',
  NEW.converted_to_case_id::TEXT, true
        );
      END IF;

      -- Source updated
      IF (OLD.source IS DISTINCT FROM NEW.source) THEN
        INSERT INTO consultation_activity_log (
          consultation_id, activity_type, description, field_name, old_value, new_value,
  is_system_generated
        ) VALUES (
          NEW.id, 'field_updated',
          '유입 경로가 ' || CASE WHEN NEW.source IS NULL THEN '제거되었습니다'
            WHEN OLD.source IS NULL THEN NEW.source || '(으)로 설정되었습니다'
            ELSE OLD.source || '에서 ' || NEW.source || '(으)로 변경되었습니다' END,
          'source', OLD.source, NEW.source, true
        );
      END IF;
    END IF;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."log_consultation_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_wmonid_limit_warning"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 45건 이상(90%)이면 경고 로그
  IF NEW.case_count >= 45 THEN
    -- 향후 알림 시스템과 연동 가능
    RAISE NOTICE 'WMONID % is reaching capacity: %/50 cases',
      NEW.wmonid, NEW.case_count;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_wmonid_limit_warning"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."testimonials_search_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.client_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.case_result, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.story_before, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.story_journey, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.story_after, '')), 'C');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."testimonials_search_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_blocked_times_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_blocked_times_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_case_contracts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_case_contracts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_case_parties_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_case_parties_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_consultation_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_consultation_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_consultation_source_usage_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- INSERT or UPDATE with source change
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.source IS DISTINCT FROM NEW.source)) THEN
    -- Increment new source count
    IF NEW.source IS NOT NULL AND NEW.source != '' THEN
      UPDATE consultation_sources
      SET usage_count = usage_count + 1
      WHERE name = NEW.source;
    END IF;

    -- Decrement old source count (UPDATE only)
    IF TG_OP = 'UPDATE' AND OLD.source IS NOT NULL AND OLD.source != '' THEN
      UPDATE consultation_sources
      SET usage_count = GREATEST(0, usage_count - 1)
      WHERE name = OLD.source;
    END IF;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' AND OLD.source IS NOT NULL AND OLD.source != '' THEN
    UPDATE consultation_sources
    SET usage_count = GREATEST(0, usage_count - 1)
    WHERE name = OLD.source;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_consultation_source_usage_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_consultation_sources_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_consultation_sources_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_date_exceptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_date_exceptions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dfc_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dfc_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_expenses_month_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.month_key := TO_CHAR(NEW.expense_date, 'YYYY-MM');
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_expenses_month_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_expenses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_expenses_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_monthly_settlements_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_monthly_settlements_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notification_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_overdue_deadlines"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    v_updated_count INTEGER;
  BEGIN
    UPDATE case_deadlines
    SET status = 'OVERDUE'
    WHERE status = 'PENDING'
      AND deadline_date < CURRENT_DATE;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN v_updated_count;
  END;
  $$;


ALTER FUNCTION "public"."update_overdue_deadlines"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_partner_withdrawals_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_partner_withdrawals_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payments_month_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.month_key := TO_CHAR(NEW.payment_date, 'YYYY-MM');
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_payments_month_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_persona_adjustments"("target_user_id" "uuid", "delta" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_adj JSONB;
  new_adj JSONB;
  learning_rate FLOAT := 0.1;
BEGIN
  -- 현재 조정값 가져오기
  SELECT adjustments INTO current_adj
  FROM user_personas
  WHERE user_id = target_user_id;

  IF current_adj IS NULL THEN
    current_adj := '{
      "formality": 0,
      "verbosity": 0,
      "emojiUsage": 0,
      "empathy": 0.5,
      "technicalLevel": 0.5
    }'::jsonb;
  END IF;

  -- 새 조정값 계산 (clamp 적용)
  new_adj := jsonb_build_object(
    'formality', GREATEST(-1, LEAST(1,
      (current_adj->>'formality')::float + COALESCE((delta->>'formality')::float, 0) * learning_rate
    )),
    'verbosity', GREATEST(-1, LEAST(1,
      (current_adj->>'verbosity')::float + COALESCE((delta->>'verbosity')::float, 0) * learning_rate
    )),
    'emojiUsage', GREATEST(0, LEAST(1,
      (current_adj->>'emojiUsage')::float + COALESCE((delta->>'emojiUsage')::float, 0) * learning_rate
    )),
    'empathy', GREATEST(0, LEAST(1,
      (current_adj->>'empathy')::float + COALESCE((delta->>'empathy')::float, 0) * learning_rate
    )),
    'technicalLevel', GREATEST(0, LEAST(1,
      (current_adj->>'technicalLevel')::float + COALESCE((delta->>'technicalLevel')::float, 0) * learning_rate
    ))
  );

  -- 저장
  INSERT INTO user_personas (user_id, adjustments, updated_at)
  VALUES (target_user_id, new_adj, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    adjustments = new_adj,
    updated_at = NOW();

  RETURN new_adj;
END;
$$;


ALTER FUNCTION "public"."update_persona_adjustments"("target_user_id" "uuid", "delta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_recurring_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."update_recurring_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scourt_profile_case_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE scourt_profiles
    SET case_count = case_count + 1,
        status = CASE WHEN case_count + 1 >= max_cases THEN 'full' ELSE status END
    WHERE id = NEW.profile_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE scourt_profiles
    SET case_count = GREATEST(case_count - 1, 0),
        status = CASE WHEN status = 'full' THEN 'active' ELSE status END
    WHERE id = OLD.profile_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_scourt_profile_case_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scourt_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scourt_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scourt_sync_jobs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scourt_sync_jobs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scourt_unread_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 해당 사건의 미읽음 업데이트 수 갱신
  UPDATE legal_cases
  SET scourt_unread_updates = (
    SELECT COUNT(*)
    FROM scourt_case_updates
    WHERE legal_case_id = COALESCE(NEW.legal_case_id, OLD.legal_case_id)
      AND is_read_by_client = FALSE
  )
  WHERE id = COALESCE(NEW.legal_case_id, OLD.legal_case_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_scourt_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scourt_user_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scourt_user_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scourt_user_wmonid_case_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_wmonid_id IS NOT NULL THEN
    UPDATE scourt_user_wmonid
    SET case_count = case_count + 1
    WHERE id = NEW.user_wmonid_id;
  ELSIF TG_OP = 'DELETE' AND OLD.user_wmonid_id IS NOT NULL THEN
    UPDATE scourt_user_wmonid
    SET case_count = GREATEST(case_count - 1, 0)
    WHERE id = OLD.user_wmonid_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_wmonid_id IS DISTINCT FROM NEW.user_wmonid_id THEN
      IF OLD.user_wmonid_id IS NOT NULL THEN
        UPDATE scourt_user_wmonid
        SET case_count = GREATEST(case_count - 1, 0)
        WHERE id = OLD.user_wmonid_id;
      END IF;
      IF NEW.user_wmonid_id IS NOT NULL THEN
        UPDATE scourt_user_wmonid
        SET case_count = case_count + 1
        WHERE id = NEW.user_wmonid_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_scourt_user_wmonid_case_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scourt_user_wmonid_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scourt_user_wmonid_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tenant_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tenant_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_memory_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_memory_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_v4_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_v4_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_weekly_schedule_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_weekly_schedule_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."cleanup_expired_citation_cache"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER := 0;
BEGIN
  -- 만료된 판례 캐시 삭제
  DELETE FROM the0.precedent_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := temp_count;

  -- 만료된 법령 캐시 삭제
  DELETE FROM the0.statute_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "the0"."cleanup_expired_citation_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."cleanup_expired_drafts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM the0.drafts_temp
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "the0"."cleanup_expired_drafts"() OWNER TO "postgres";


COMMENT ON FUNCTION "the0"."cleanup_expired_drafts"() IS '만료된 임시 초안 정리 (크론에서 호출)';



CREATE OR REPLACE FUNCTION "the0"."cleanup_expired_temp_uploads"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 만료된 pending 상태 업로드를 expired로 변경
  UPDATE the0.temp_uploads
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 7일 이상 지난 expired/deleted 레코드 삭제 (실제 파일 삭제는 별도 크론에서)
  DELETE FROM the0.temp_uploads
  WHERE status IN ('expired', 'deleted')
    AND updated_at < NOW() - INTERVAL '7 days';

  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "the0"."cleanup_expired_temp_uploads"() OWNER TO "postgres";


COMMENT ON FUNCTION "the0"."cleanup_expired_temp_uploads"() IS '만료된 임시 업로드 정리 (크론에서 호출)';



CREATE OR REPLACE FUNCTION "the0"."ensure_single_default_model"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE the0.ai_models SET is_default = false WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."ensure_single_default_model"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."expand_query"("query_text" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  expanded TEXT := query_text;
  synonym_rec RECORD;
BEGIN
  -- 각 동의어 쌍에 대해 OR 조건 추가
  FOR synonym_rec IN
    SELECT term, synonyms FROM the0.legal_synonyms
    WHERE query_text ILIKE '%' || term || '%'
  LOOP
    expanded := expanded || ' OR ' || array_to_string(synonym_rec.synonyms, ' OR ');
  END LOOP;

  RETURN expanded;
END;
$$;


ALTER FUNCTION "the0"."expand_query"("query_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "the0"."expand_query"("query_text" "text") IS '검색 쿼리에 동의어 확장';



CREATE OR REPLACE FUNCTION "the0"."expire_old_invitations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- 30일 지난 pending 초대를 expired로 변경
    UPDATE the0.user_invitations
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW();

    RETURN NULL;
END;
$$;


ALTER FUNCTION "the0"."expire_old_invitations"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."financial_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "evidence_id" "uuid",
    "document_id" "uuid",
    "account_holder" "text",
    "account_number" "text",
    "bank_name" "text",
    "transaction_date" "date" NOT NULL,
    "transaction_time" time without time zone,
    "transaction_type" "text",
    "amount" numeric(15,2) NOT NULL,
    "balance_after" numeric(15,2),
    "description" "text",
    "counterparty" "text",
    "memo" "text",
    "category" "text",
    "is_disputed" boolean DEFAULT false,
    "brief_references" "jsonb" DEFAULT '[]'::"jsonb",
    "proof_purpose" "text",
    "source_file" "text",
    "page_number" integer,
    "row_number" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."financial_records" OWNER TO "postgres";


COMMENT ON TABLE "the0"."financial_records" IS '금융거래 내역 (재산분할 계산용)';



COMMENT ON COLUMN "the0"."financial_records"."is_disputed" IS '상대방과 다툼이 있는 거래';



COMMENT ON COLUMN "the0"."financial_records"."brief_references" IS '이 거래를 참조하는 서면 목록';



CREATE OR REPLACE FUNCTION "the0"."find_transactions_by_date"("p_case_id" "uuid", "p_date" "date", "p_amount" numeric DEFAULT NULL::numeric, "p_description" "text" DEFAULT NULL::"text") RETURNS SETOF "the0"."financial_records"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM the0.financial_records
  WHERE case_id = p_case_id
    AND transaction_date = p_date
    AND (p_amount IS NULL OR ABS(amount - p_amount) < 1)  -- 금액 ±1원 허용
    AND (p_description IS NULL OR description ILIKE '%' || p_description || '%');
END;
$$;


ALTER FUNCTION "the0"."find_transactions_by_date"("p_case_id" "uuid", "p_date" "date", "p_amount" numeric, "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."get_active_prompt"("p_domain" "text", "p_name" "text") RETURNS TABLE("id" "uuid", "domain" "text", "name" "text", "content" "text", "version" integer, "variables" "text"[], "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.domain,
    pr.name,
    pr.content,
    pr.version,
    pr.variables,
    pr.updated_at
  FROM the0.prompts pr
  WHERE pr.domain = p_domain
    AND pr.name = p_name
    AND pr.is_active = true
  ORDER BY pr.version DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "the0"."get_active_prompt"("p_domain" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."get_case_files"("p_case_id" "uuid") RETURNS TABLE("id" "uuid", "drive_file_id" "text", "filename" "text", "doc_type" "text", "evidence_type" "text", "chunk_count" integer, "ingested_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.drive_file_id,
    f.filename,
    f.doc_type,
    f.evidence_type,
    f.chunk_count,
    f.ingested_at,
    f.metadata
  FROM the0.ingested_files f
  WHERE f.case_id = p_case_id
  ORDER BY f.ingested_at DESC;
END;
$$;


ALTER FUNCTION "the0"."get_case_files"("p_case_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "the0"."get_case_files"("p_case_id" "uuid") IS '특정 사건에 연결된 파일 목록 조회';



CREATE OR REPLACE FUNCTION "the0"."get_evidence_stats"("p_case_id" "uuid") RETURNS TABLE("total_files" integer, "plaintiff_files" integer, "defendant_files" integer, "rag_completed" integer, "rag_pending" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS total_files,
    COUNT(*) FILTER (WHERE party_side = 'plaintiff')::INT AS plaintiff_files,
    COUNT(*) FILTER (WHERE party_side = 'defendant')::INT AS defendant_files,
    COUNT(*) FILTER (WHERE rag_status = 'completed')::INT AS rag_completed,
    COUNT(*) FILTER (WHERE rag_status = 'pending')::INT AS rag_pending
  FROM the0.evidence_files
  WHERE case_id = p_case_id;
END;
$$;


ALTER FUNCTION "the0"."get_evidence_stats"("p_case_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."get_financial_summary"("p_case_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_category" "text" DEFAULT NULL::"text") RETURNS TABLE("total_income" numeric, "total_expense" numeric, "net_amount" numeric, "transaction_count" integer, "categories" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT *
    FROM the0.financial_records
    WHERE case_id = p_case_id
      AND (p_start_date IS NULL OR transaction_date >= p_start_date)
      AND (p_end_date IS NULL OR transaction_date <= p_end_date)
      AND (p_category IS NULL OR category = p_category)
  ),
  summary AS (
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expense,
      COUNT(*) as cnt
    FROM filtered
  ),
  by_category AS (
    SELECT jsonb_object_agg(
      COALESCE(category, '미분류'),
      jsonb_build_object(
        'income', COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
        'expense', COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
        'count', COUNT(*)
      )
    ) as cats
    FROM filtered
    GROUP BY category
  )
  SELECT
    s.income,
    s.expense,
    s.income - s.expense,
    s.cnt::INTEGER,
    COALESCE(c.cats, '{}'::jsonb)
  FROM summary s
  CROSS JOIN (SELECT jsonb_object_agg(key, value) as cats FROM by_category, jsonb_each(cats)) c;
END;
$$;


ALTER FUNCTION "the0"."get_financial_summary"("p_case_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."get_hierarchical_context"("p_case_id" "uuid", "p_max_level" integer DEFAULT 2) RETURNS TABLE("level" integer, "summary_type" "text", "reference_id" "uuid", "content" "text", "token_count" integer, "is_stale" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.level,
    cs.summary_type,
    cs.reference_id,
    cs.content,
    cs.token_count,
    cs.is_stale
  FROM the0.context_summaries cs
  WHERE cs.case_id = p_case_id
    AND cs.level <= p_max_level
  ORDER BY cs.level, cs.summary_type;
END;
$$;


ALTER FUNCTION "the0"."get_hierarchical_context"("p_case_id" "uuid", "p_max_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."get_mergeable_chunks"("p_case_id" "uuid", "p_brief_session_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("chunk_id" "uuid", "issue_type" "text", "issue_name" "text", "content" "text", "chunk_order" integer, "token_count" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    dc.issue_type,
    dc.issue_name,
    dc.content,
    dc.chunk_order,
    dc.token_count
  FROM the0.draft_chunks dc
  WHERE dc.case_id = p_case_id
    AND dc.status IN ('reviewed', 'approved')
    AND (p_brief_session_id IS NULL OR dc.brief_session_id = p_brief_session_id)
  ORDER BY dc.chunk_order NULLS LAST, dc.created_at;
END;
$$;


ALTER FUNCTION "the0"."get_mergeable_chunks"("p_case_id" "uuid", "p_brief_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."get_parent_content"("child_id" "uuid") RETURNS TABLE("parent_id" "uuid", "parent_content" "text", "parent_section_path" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.section_path
  FROM the0.documents c
  JOIN the0.documents p ON c.parent_id = p.id
  WHERE c.id = child_id;
END;
$$;


ALTER FUNCTION "the0"."get_parent_content"("child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."handle_auth_user_created_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO the0.users_profiles (id, email, name, full_name, display_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(
            CASE
                WHEN NEW.raw_user_meta_data->>'role' IN ('master', 'operator', 'counselor', 'client')
                THEN NEW.raw_user_meta_data->>'role'
                ELSE 'client'
            END,
            'client'
        )
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, the0.users_profiles.name),
        updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."handle_auth_user_created_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO the0.user_profiles (id, full_name, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "filter_case_id" "uuid" DEFAULT NULL::"uuid", "filter_doc_type" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 10, "vector_weight" double precision DEFAULT 0.7, "fts_weight" double precision DEFAULT 0.3) RETURNS TABLE("id" "uuid", "content" "text", "domain" "text", "source" "text", "section_path" "text", "doc_type" "text", "case_id" "uuid", "similarity" double precision, "fts_rank" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      d.id,
      d.content,
      d.domain,
      d.source,
      d.section_path,
      d.doc_type,
      d.case_id,
      (1 - (d.embedding <=> query_embedding))::DOUBLE PRECISION AS vector_similarity
    FROM the0.documents d
    WHERE
      (filter_domain IS NULL OR d.domain = filter_domain)
      AND (filter_case_id IS NULL OR d.case_id = filter_case_id)
      AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
      AND d.embedding IS NOT NULL
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  fts_results AS (
    SELECT
      d.id,
      ts_rank(d.fts_content, websearch_to_tsquery('simple', query_text))::DOUBLE PRECISION AS fts_rank
    FROM the0.documents d
    WHERE
      d.fts_content @@ websearch_to_tsquery('simple', query_text)
      AND (filter_domain IS NULL OR d.domain = filter_domain)
      AND (filter_case_id IS NULL OR d.case_id = filter_case_id)
      AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
    LIMIT match_count * 2
  )
  SELECT
    v.id,
    v.content,
    v.domain,
    v.source,
    v.section_path,
    v.doc_type,
    v.case_id,
    v.vector_similarity AS similarity,
    COALESCE(f.fts_rank, 0)::DOUBLE PRECISION AS fts_rank,
    (v.vector_similarity * vector_weight + COALESCE(f.fts_rank, 0) * fts_weight)::DOUBLE PRECISION AS combined_score
  FROM vector_results v
  LEFT JOIN fts_results f ON v.id = f.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "the0"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."invalidate_context_summaries"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- case_claims 변경 시 관련 요약 무효화
  IF TG_TABLE_NAME = 'case_claims' THEN
    UPDATE the0.context_summaries
    SET is_stale = true, last_source_update = NOW()
    WHERE case_id = NEW.case_id;
  END IF;

  -- case_issues 변경 시 관련 요약 무효화
  IF TG_TABLE_NAME = 'case_issues' THEN
    UPDATE the0.context_summaries
    SET is_stale = true, last_source_update = NOW()
    WHERE case_id = NEW.case_id
      AND (summary_type = 'issue_summary' OR level <= 1);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."invalidate_context_summaries"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."link_drive_file_to_case"("p_drive_file_id" "text", "p_case_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE the0.ingested_files
  SET case_id = p_case_id
  WHERE drive_file_id = p_drive_file_id;
END;
$$;


ALTER FUNCTION "the0"."link_drive_file_to_case"("p_drive_file_id" "text", "p_case_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "the0"."link_drive_file_to_case"("p_drive_file_id" "text", "p_case_id" "uuid") IS 'Drive 파일 ID로 사건 연결';



CREATE OR REPLACE FUNCTION "the0"."link_file_to_case"("p_file_id" "uuid", "p_case_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE the0.ingested_files
  SET case_id = p_case_id
  WHERE id = p_file_id;
END;
$$;


ALTER FUNCTION "the0"."link_file_to_case"("p_file_id" "uuid", "p_case_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "the0"."link_file_to_case"("p_file_id" "uuid", "p_case_id" "uuid") IS '파일을 특정 사건에 연결';



CREATE OR REPLACE FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 5, "match_threshold" double precision DEFAULT 0.7) RETURNS TABLE("id" "uuid", "content" "text", "domain" "text", "source" "text", "title" "text", "category" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.domain,
    d.source,
    d.title,
    d.category,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM the0.documents d
  WHERE
    (filter_domain IS NULL OR d.domain = filter_domain)
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer, "match_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "filter_case_id" "uuid" DEFAULT NULL::"uuid", "filter_doc_type" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 5, "match_threshold" double precision DEFAULT 0.7) RETURNS TABLE("id" "uuid", "content" "text", "domain" "text", "source" "text", "section_path" "text", "doc_type" "text", "case_id" "uuid", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.domain,
    d.source,
    d.section_path,
    d.doc_type,
    d.case_id,
    (1 - (d.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
  FROM the0.documents d
  WHERE
    (filter_domain IS NULL OR d.domain = filter_domain)
    AND (filter_case_id IS NULL OR d.case_id = filter_case_id)
    AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."normalize_invitation_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.phone := the0.normalize_phone(NEW.phone);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."normalize_invitation_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."normalize_phone"("phone" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    digits TEXT;
BEGIN
    -- 숫자만 추출
    digits := regexp_replace(phone, '[^0-9]', '', 'g');

    -- +82로 시작하면 0으로 변환
    IF digits LIKE '82%' THEN
        digits := '0' || substring(digits from 3);
    END IF;

    RETURN digits;
END;
$$;


ALTER FUNCTION "the0"."normalize_phone"("phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."recommend_evidence_for_claim"("p_case_id" "uuid", "p_claim_embedding" "public"."vector", "p_limit" integer DEFAULT 10) RETURNS TABLE("evidence_file_id" "uuid", "span_id" "uuid", "file_name" "text", "exhibit_label" "text", "content" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ef.id AS evidence_file_id,
    d.id AS span_id,
    ef.file_name,
    ef.exhibit_label,
    d.content,
    1 - (d.embedding <=> p_claim_embedding) AS similarity
  FROM the0.documents d
  JOIN the0.evidence_files ef ON ef.drive_file_id = d.source
  WHERE ef.case_id = p_case_id
    AND d.embedding IS NOT NULL
  ORDER BY d.embedding <=> p_claim_embedding
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "the0"."recommend_evidence_for_claim"("p_case_id" "uuid", "p_claim_embedding" "public"."vector", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."search_legal_norms"("p_query_embedding" "public"."vector", "p_norm_type" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "norm_type" "text", "code" "text", "title" "text", "summary" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ln.id,
    ln.norm_type,
    ln.code,
    ln.title,
    ln.summary,
    1 - (ln.embedding <=> p_query_embedding) AS similarity
  FROM the0.legal_norms ln
  WHERE (p_norm_type IS NULL OR ln.norm_type = p_norm_type)
    AND (p_tags IS NULL OR ln.tags && p_tags)
    AND ln.embedding IS NOT NULL
  ORDER BY ln.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "the0"."search_legal_norms"("p_query_embedding" "public"."vector", "p_norm_type" "text", "p_tags" "text"[], "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 5) RETURNS TABLE("child_id" "uuid", "child_content" "text", "child_section_path" "text", "child_score" double precision, "parent_id" "uuid", "parent_content" "text", "parent_section_path" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH matched_children AS (
    SELECT
      d.id,
      d.content,
      d.section_path,
      d.parent_id as p_id,
      1 - (d.embedding <=> query_embedding) as similarity
    FROM the0.documents d
    WHERE d.is_parent = FALSE
      AND d.is_deleted = FALSE
      AND (filter_domain IS NULL OR d.domain = filter_domain)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count
  )
  SELECT
    mc.id as child_id,
    mc.content as child_content,
    mc.section_path as child_section_path,
    mc.similarity as child_score,
    p.id as parent_id,
    p.content as parent_content,
    p.section_path as parent_section_path
  FROM matched_children mc
  LEFT JOIN the0.documents p ON mc.p_id = p.id;
END;
$$;


ALTER FUNCTION "the0"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "filter_case_id" "uuid" DEFAULT NULL::"uuid", "filter_doc_type" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "content" "text", "domain" "text", "source" "text", "section_path" "text", "doc_type" "text", "case_id" "uuid", "combined_score" double precision)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  expanded_query TEXT;
BEGIN
  -- 쿼리 확장 (동의어)
  expanded_query := the0.expand_query(query_text);

  -- Hybrid Search 실행
  RETURN QUERY
  SELECT
    h.id,
    h.content,
    h.domain,
    h.source,
    h.section_path,
    h.doc_type,
    h.case_id,
    h.combined_score
  FROM the0.hybrid_search(
    expanded_query,
    query_embedding,
    filter_domain,
    filter_case_id,
    filter_doc_type,
    match_count,
    0.7,
    0.3
  ) h;
END;
$$;


ALTER FUNCTION "the0"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_ai_models_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_ai_models_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_brief_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_brief_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_case_claims_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_case_claims_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_case_issues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_case_issues_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_case_summaries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_case_summaries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_claims_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_claims_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_draft_chunks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_draft_chunks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_evidence_files_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_evidence_files_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_legal_cases_ext_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_legal_cases_ext_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_prompt_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_prompt_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_session_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE the0.chat_sessions
    SET
        message_count = message_count + 1,
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_session_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_temp_uploads_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_temp_uploads_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_users_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_users_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "the0"."update_work_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "the0"."update_work_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."expand_query"("query_text" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  expanded TEXT := query_text;
  synonym_record RECORD;
BEGIN
  FOR synonym_record IN
    SELECT term, synonyms FROM theai.legal_synonyms
  LOOP
    IF query_text ILIKE '%' || synonym_record.term || '%' THEN
      expanded := expanded || ' ' || array_to_string(synonym_record.synonyms, ' ');
    END IF;
  END LOOP;
  RETURN expanded;
END;
$$;


ALTER FUNCTION "theai"."expand_query"("query_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."get_parent_content"("child_id" "uuid") RETURNS TABLE("parent_id" "uuid", "parent_content" "text", "parent_section_path" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.section_path
  FROM theai.documents c
  JOIN theai.documents p ON c.parent_id = p.id
  WHERE c.id = child_id;
END;
$$;


ALTER FUNCTION "theai"."get_parent_content"("child_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "filter_case_id" "uuid" DEFAULT NULL::"uuid", "filter_doc_type" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 10, "vector_weight" double precision DEFAULT 0.7, "fts_weight" double precision DEFAULT 0.3) RETURNS TABLE("id" "uuid", "content" "text", "domain" "text", "source" "text", "section_path" "text", "doc_type" "text", "case_id" "uuid", "similarity" double precision, "fts_rank" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      d.id,
      d.content,
      d.domain,
      d.source,
      d.section_path,
      d.doc_type,
      d.case_id,
      (1 - (d.embedding <=> query_embedding))::DOUBLE PRECISION AS vector_similarity
    FROM theai.documents d
    WHERE
      (filter_domain IS NULL OR d.domain = filter_domain)
      AND (filter_case_id IS NULL OR d.case_id = filter_case_id)
      AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
      AND d.embedding IS NOT NULL
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  fts_results AS (
    SELECT
      d.id,
      ts_rank(d.fts_content, websearch_to_tsquery('simple', query_text))::DOUBLE PRECISION AS fts_rank
    FROM theai.documents d
    WHERE
      d.fts_content @@ websearch_to_tsquery('simple', query_text)
      AND (filter_domain IS NULL OR d.domain = filter_domain)
      AND (filter_case_id IS NULL OR d.case_id = filter_case_id)
      AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
    LIMIT match_count * 2
  )
  SELECT
    v.id,
    v.content,
    v.domain,
    v.source,
    v.section_path,
    v.doc_type,
    v.case_id,
    v.vector_similarity AS similarity,
    COALESCE(f.fts_rank, 0)::DOUBLE PRECISION AS fts_rank,
    (v.vector_similarity * vector_weight + COALESCE(f.fts_rank, 0) * fts_weight)::DOUBLE PRECISION AS combined_score
  FROM vector_results v
  LEFT JOIN fts_results f ON v.id = f.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "theai"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "filter_case_id" "uuid" DEFAULT NULL::"uuid", "filter_doc_type" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 5, "match_threshold" double precision DEFAULT 0.7) RETURNS TABLE("id" "uuid", "content" "text", "domain" "text", "source" "text", "section_path" "text", "doc_type" "text", "case_id" "uuid", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.domain,
    d.source,
    d.section_path,
    d.doc_type,
    d.case_id,
    (1 - (d.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
  FROM theai.documents d
  WHERE
    (filter_domain IS NULL OR d.domain = filter_domain)
    AND (filter_case_id IS NULL OR d.case_id = filter_case_id)
    AND (filter_doc_type IS NULL OR d.doc_type = filter_doc_type)
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "theai"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 5) RETURNS TABLE("child_id" "uuid", "child_content" "text", "child_section_path" "text", "child_score" double precision, "parent_id" "uuid", "parent_content" "text", "parent_section_path" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH matched_children AS (
    SELECT
      d.id,
      d.content,
      d.section_path,
      d.parent_id as p_id,
      1 - (d.embedding <=> query_embedding) as similarity
    FROM theai.documents d
    WHERE d.is_parent = FALSE
      AND d.is_deleted = FALSE
      AND (filter_domain IS NULL OR d.domain = filter_domain)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count
  )
  SELECT
    mc.id as child_id,
    mc.content as child_content,
    mc.section_path as child_section_path,
    mc.similarity as child_score,
    p.id as parent_id,
    p.content as parent_content,
    p.section_path as parent_section_path
  FROM matched_children mc
  LEFT JOIN theai.documents p ON mc.p_id = p.id;
END;
$$;


ALTER FUNCTION "theai"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text" DEFAULT NULL::"text", "filter_case_id" "uuid" DEFAULT NULL::"uuid", "filter_doc_type" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "content" "text", "domain" "text", "source" "text", "section_path" "text", "doc_type" "text", "case_id" "uuid", "combined_score" double precision)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  expanded_query TEXT;
BEGIN
  -- 쿼리 확장 (동의어)
  expanded_query := theai.expand_query(query_text);

  -- Hybrid Search 실행
  RETURN QUERY
  SELECT
    h.id,
    h.content,
    h.domain,
    h.source,
    h.section_path,
    h.doc_type,
    h.case_id,
    h.combined_score
  FROM theai.hybrid_search(
    expanded_query,
    query_embedding,
    filter_domain,
    filter_case_id,
    filter_doc_type,
    match_count,
    0.7,
    0.3
  ) h;
END;
$$;


ALTER FUNCTION "theai"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."update_case_summaries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "theai"."update_case_summaries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."update_claims_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "theai"."update_claims_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "theai"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "theai"."update_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "block_type" "text" NOT NULL,
    "blocked_date" "date",
    "blocked_time_start" "text",
    "blocked_time_end" "text",
    "office_location" "text",
    "reason" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocked_times_block_type_check" CHECK (("block_type" = ANY (ARRAY['date'::"text", 'time_slot'::"text"]))),
    CONSTRAINT "blocked_times_office_location_check" CHECK ((("office_location" = ANY (ARRAY['천안'::"text", '평택'::"text"])) OR ("office_location" IS NULL))),
    CONSTRAINT "valid_date_block" CHECK (((("block_type" = 'date'::"text") AND ("blocked_date" IS NOT NULL)) OR (("block_type" = 'time_slot'::"text") AND ("blocked_date" IS NOT NULL) AND ("blocked_time_start" IS NOT NULL) AND ("blocked_time_end" IS NOT NULL))))
);


ALTER TABLE "public"."blocked_times" OWNER TO "postgres";


COMMENT ON TABLE "public"."blocked_times" IS 'Stores blocked dates and time slots for booking system';



CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "notion_id" "text",
    "title" "text" NOT NULL,
    "slug" "text",
    "categories" "text"[],
    "tags" "text"[],
    "excerpt" "text",
    "content" "text",
    "published" boolean DEFAULT false,
    "featured" boolean DEFAULT false,
    "views" integer DEFAULT 0,
    "author" "text" DEFAULT '법무법인 더율'::"text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "illustration_image" "text"
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."blog_posts"."illustration_image" IS 'URL to illustration image displayed in blog post cards';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "category" "text",
    "message" "text",
    "preferred_date" "date" NOT NULL,
    "preferred_time" "text" NOT NULL,
    "office_location" "text",
    "video_link" "text",
    "admin_notes" "text",
    "confirmed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "tenant_id" "uuid",
    CONSTRAINT "bookings_office_location_check" CHECK (("office_location" = ANY (ARRAY['천안'::"text", '평택'::"text"]))),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "bookings_type_check" CHECK (("type" = ANY (ARRAY['visit'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_case_id" "uuid" NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_path" character varying(500) NOT NULL,
    "file_size" integer,
    "file_type" character varying(100),
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."case_contracts" OWNER TO "postgres";


COMMENT ON TABLE "public"."case_contracts" IS '계약서 파일 저장 테이블';



COMMENT ON COLUMN "public"."case_contracts"."file_path" IS 'Supabase Storage 경로: {tenant_id}/{case_id}/{filename}';



CREATE TABLE IF NOT EXISTS "public"."case_deadlines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_number" character varying(100),
    "deadline_type" "public"."deadline_type" NOT NULL,
    "trigger_date" "date" NOT NULL,
    "deadline_date" "date" NOT NULL,
    "deadline_datetime" timestamp with time zone NOT NULL,
    "notes" "text",
    "status" "public"."deadline_status" DEFAULT 'PENDING'::"public"."deadline_status",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "case_id" "uuid",
    "scourt_update_id" "uuid",
    "party_id" "uuid",
    "party_side" character varying(30)
);


ALTER TABLE "public"."case_deadlines" OWNER TO "postgres";


COMMENT ON COLUMN "public"."case_deadlines"."case_number" IS '사건번호 (선택적, case_id로 사건 연결 권장)';



COMMENT ON COLUMN "public"."case_deadlines"."case_id" IS '사건 ID (legal_cases 참조, 필수 권장)';



COMMENT ON COLUMN "public"."case_deadlines"."scourt_update_id" IS 'SCOURT 자동 등록 시 연결된 업데이트 ID (중복 방지용)';



COMMENT ON COLUMN "public"."case_deadlines"."party_id" IS '연관된 당사자 ID (NULL이면 사건 전체 적용)';



COMMENT ON COLUMN "public"."case_deadlines"."party_side" IS '당사자 측: plaintiff_side(원고측), defendant_side(피고측), NULL(전체)';



CREATE TABLE IF NOT EXISTS "public"."case_parties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "case_id" "uuid" NOT NULL,
    "party_name" "text" NOT NULL,
    "party_type" character varying(30) NOT NULL,
    "party_type_label" character varying(30),
    "party_order" integer DEFAULT 1,
    "client_id" "uuid",
    "is_our_client" boolean DEFAULT false,
    "fee_allocation_amount" bigint,
    "scourt_synced" boolean DEFAULT false,
    "scourt_party_index" integer,
    "adjdoc_rch_ymd" character varying(8),
    "indvd_cfmtn_ymd" character varying(8),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "success_fee_terms" "text",
    "manual_override" boolean DEFAULT false,
    "scourt_label_raw" "text",
    "scourt_name_raw" "text",
    "is_primary" boolean DEFAULT false
);


ALTER TABLE "public"."case_parties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."case_parties"."fee_allocation_amount" IS '착수금 (원)';



COMMENT ON COLUMN "public"."case_parties"."success_fee_terms" IS '성공보수 약정내용';



COMMENT ON COLUMN "public"."case_parties"."manual_override" IS '사용자 수동 수정 보존';



COMMENT ON COLUMN "public"."case_parties"."scourt_label_raw" IS 'SCOURT 당사자 원본 지위 라벨';



COMMENT ON COLUMN "public"."case_parties"."scourt_name_raw" IS 'SCOURT 당사자 원본 이름(마스킹 포함)';



COMMENT ON COLUMN "public"."case_parties"."is_primary" IS '측 대표 당사자 표시(히어로/기본내용용)';



CREATE TABLE IF NOT EXISTS "public"."legal_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_number" "text",
    "case_name" "text" NOT NULL,
    "client_id" "uuid",
    "assigned_lawyer" "text",
    "status" "text" DEFAULT '진행중'::"text",
    "case_type" "text",
    "court_case_number" "text",
    "court_name" "text",
    "default_courtroom" "text",
    "contract_date" "date",
    "completion_date" "date",
    "retainer_fee" bigint DEFAULT 0,
    "total_received" bigint DEFAULT 0,
    "outstanding_balance" bigint DEFAULT 0,
    "success_fee_agreement" "text",
    "calculated_success_fee" bigint DEFAULT 0,
    "installment_terms" "text",
    "payment_plan_notes" "text",
    "related_case_info" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "judge_name" "text",
    "receivable_grade" "public"."receivable_grade" DEFAULT 'normal'::"public"."receivable_grade",
    "onedrive_folder_url" "text",
    "client_role" character varying(20),
    "drive_folder_id" "text",
    "main_case_id" "uuid",
    "case_relation" "text",
    "plaintiffs" "jsonb" DEFAULT '[]'::"jsonb",
    "defendants" "jsonb" DEFAULT '[]'::"jsonb",
    "scourt_last_sync" timestamp with time zone,
    "scourt_raw_data" "jsonb",
    "scourt_sync_status" character varying(20),
    "scourt_last_snapshot_id" "uuid",
    "scourt_unread_updates" integer DEFAULT 0,
    "scourt_next_hearing" "jsonb",
    "tenant_id" "uuid" NOT NULL,
    "assigned_member_id" "uuid",
    "scourt_case_name" "text",
    "case_result" "text",
    "case_result_date" "date",
    "enc_cs_no" "text",
    "assigned_to" "uuid",
    "application_type" "text",
    "scourt_wmonid" "text",
    "opponent_name" "text",
    "case_level" character varying(20),
    "scourt_sync_enabled" boolean DEFAULT true,
    "scourt_last_progress_sync_at" timestamp with time zone,
    "scourt_last_general_sync_at" timestamp with time zone,
    "scourt_next_progress_sync_at" timestamp with time zone,
    "scourt_next_general_sync_at" timestamp with time zone,
    "scourt_progress_hash" character varying(64),
    "scourt_general_hash" character varying(64),
    "scourt_last_manual_sync_at" timestamp with time zone,
    "scourt_sync_cooldown_until" timestamp with time zone,
    "scourt_sync_locked_at" timestamp with time zone,
    "scourt_sync_lock_token" "text",
    "client_role_status" character varying(20) DEFAULT 'provisional'::character varying,
    CONSTRAINT "legal_cases_client_role_check" CHECK ((("client_role")::"text" = ANY ((ARRAY['plaintiff'::character varying, 'defendant'::character varying])::"text"[]))),
    CONSTRAINT "legal_cases_client_role_status_check" CHECK ((("client_role_status")::"text" = ANY ((ARRAY['provisional'::character varying, 'confirmed'::character varying])::"text"[]))),
    CONSTRAINT "legal_cases_status_check" CHECK (("status" = ANY (ARRAY['진행중'::"text", '종결'::"text"])))
);


ALTER TABLE "public"."legal_cases" OWNER TO "postgres";


COMMENT ON TABLE "public"."legal_cases" IS '법률 사건 (단일 진실 소스 - THE0, theyool-admin 공유). main_case_id로 관련 사건 연결 지원.';



COMMENT ON COLUMN "public"."legal_cases"."judge_name" IS '담당 판사명';



COMMENT ON COLUMN "public"."legal_cases"."onedrive_folder_url" IS '원드라이브 공유 폴더 URL (소송 서류)';



COMMENT ON COLUMN "public"."legal_cases"."client_role" IS '의뢰인 역할: plaintiff(원고/신청인), defendant(피고/상대방)';



COMMENT ON COLUMN "public"."legal_cases"."drive_folder_id" IS 'Google Drive 
  폴더 ID (파이프라인에서 사용)';



COMMENT ON COLUMN "public"."legal_cases"."main_case_id" IS '주사건 ID (현재 최상위 심급 - 항소하면 항소심, 상고하면 상고심)';



COMMENT ON COLUMN "public"."legal_cases"."case_relation" IS '관련 사건 유형: main(본안), appeal(항소), supreme(상고), preservation(보전), mediation(조정), transfer(이송), counterclaim(반소)';



COMMENT ON COLUMN "public"."legal_cases"."plaintiffs" IS '원고 목록 (다수 당사자용): [{"index": 1, "label": "가", "name": "홍길동", "counsel": "법무법인 A"}]';



COMMENT ON COLUMN "public"."legal_cases"."defendants" IS '피고 목록 (다수 당사자용): [{"index": 1, "label": "가", "name": "김철수", "counsel": "법무법인 B"}]';



COMMENT ON COLUMN "public"."legal_cases"."tenant_id" IS '소속 테넌트 ID';



COMMENT ON COLUMN "public"."legal_cases"."assigned_member_id" IS '담당 변호사 (멤버) ID';



COMMENT ON COLUMN "public"."legal_cases"."scourt_case_name" IS '대법원 등록 사건명';



COMMENT ON COLUMN "public"."legal_cases"."case_result" IS '종국결과 (조정성립, 판결선고, 취하 등)';



COMMENT ON COLUMN "public"."legal_cases"."case_result_date" IS '종국일자';



COMMENT ON COLUMN "public"."legal_cases"."enc_cs_no" IS '대법원 나의사건검색 연동키 (암호화된 사건번호)';



COMMENT ON COLUMN "public"."legal_cases"."assigned_to" IS '담당 변호사 (tenant_members.id 참조)';



COMMENT ON COLUMN "public"."legal_cases"."application_type" IS '신청사건 유형 (가압류, 가처분, 조정신청 등)';



COMMENT ON COLUMN "public"."legal_cases"."case_level" IS '심급 (1심, 항소심, 상고심)';



COMMENT ON COLUMN "public"."legal_cases"."client_role_status" IS '의뢰인 역할 상태: provisional(임시지정), confirmed(확정)';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_date" "date" NOT NULL,
    "depositor_name" "text" NOT NULL,
    "amount" integer NOT NULL,
    "payment_category" "text" NOT NULL,
    "case_id" "uuid",
    "case_name" "text",
    "consultation_id" "uuid",
    "receipt_type" "text",
    "receipt_issued_at" timestamp with time zone,
    "phone" "text",
    "memo" "text",
    "admin_notes" "text",
    "imported_from_csv" boolean DEFAULT false,
    "month_key" character varying(7),
    "is_confirmed" boolean DEFAULT false,
    "confirmed_at" timestamp with time zone,
    "confirmed_by" "text",
    "client_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "case_party_id" "uuid",
    CONSTRAINT "chk_either_case_or_consultation" CHECK (((("case_id" IS NOT NULL) AND ("consultation_id" IS NULL)) OR (("case_id" IS NULL) AND ("consultation_id" IS NOT NULL)) OR (("case_id" IS NULL) AND ("consultation_id" IS NULL)))),
    CONSTRAINT "chk_payment_category" CHECK (("payment_category" = ANY (ARRAY['착수금'::"text", '잔금'::"text", '성공보수'::"text", '모든 상담'::"text", '내용증명'::"text", '집행(소송비용)'::"text", '기타'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."payments" IS '입금 관리 테이블: 사건별/상담별 입금 내역 추적';



COMMENT ON COLUMN "public"."payments"."payment_date" IS '입금일 (YYYY-MM-DD)';



COMMENT ON COLUMN "public"."payments"."depositor_name" IS '입금자 이름';



COMMENT ON COLUMN "public"."payments"."amount" IS '입금액 (원 단위 정수)';



COMMENT ON COLUMN "public"."payments"."payment_category" IS '입금 명목 (착수금/잔금/성공보수/모든 상담/내용증명/집행/기타)';



COMMENT ON COLUMN "public"."payments"."case_id" IS '연결된 사건 ID (legal_cases FK)';



COMMENT ON COLUMN "public"."payments"."case_name" IS '사건명 백업 (Notion URL 포함 가능)';



COMMENT ON COLUMN "public"."payments"."consultation_id" IS '연결된 상담 ID (consultations FK)';



COMMENT ON COLUMN "public"."payments"."receipt_type" IS '영수증 유형 (현금영수증/카드결제/세금계산서/현금/네이버페이 등)';



COMMENT ON COLUMN "public"."payments"."receipt_issued_at" IS '영수증 발행일시';



COMMENT ON COLUMN "public"."payments"."phone" IS '연락처';



COMMENT ON COLUMN "public"."payments"."memo" IS '메모 (CSV 임포트 시 원본 메모)';



COMMENT ON COLUMN "public"."payments"."admin_notes" IS '관리자 메모';



COMMENT ON COLUMN "public"."payments"."imported_from_csv" IS 'CSV 임포트 여부 플래그';



COMMENT ON COLUMN "public"."payments"."month_key" IS '월 키 (YYYY-MM 형식), 정산 시스템 연동용';



COMMENT ON COLUMN "public"."payments"."is_confirmed" IS '입금 확인 여부 (false: 미확인, true: 확인 완료)';



COMMENT ON COLUMN "public"."payments"."confirmed_at" IS '입금 확인 일시';



COMMENT ON COLUMN "public"."payments"."confirmed_by" IS '입금 확인자 (관리자 이메일 또는 이름)';



COMMENT ON COLUMN "public"."payments"."client_id" IS '의뢰인 직접 연결';



COMMENT ON COLUMN "public"."payments"."tenant_id" IS '소속 테넌트 ID';



CREATE OR REPLACE VIEW "public"."case_payment_summary" AS
 SELECT "lc"."id" AS "case_id",
    "lc"."court_case_number",
    "lc"."case_name",
    "count"("p"."id") AS "payment_count",
    "sum"("p"."amount") AS "total_amount",
    "sum"(
        CASE
            WHEN ("p"."payment_category" = '착수금'::"text") THEN "p"."amount"
            ELSE 0
        END) AS "retainer_amount",
    "sum"(
        CASE
            WHEN ("p"."payment_category" = '잔금'::"text") THEN "p"."amount"
            ELSE 0
        END) AS "balance_amount",
    "sum"(
        CASE
            WHEN ("p"."payment_category" = '성공보수'::"text") THEN "p"."amount"
            ELSE 0
        END) AS "success_fee_amount",
    "min"("p"."payment_date") AS "first_payment_date",
    "max"("p"."payment_date") AS "last_payment_date"
   FROM ("public"."legal_cases" "lc"
     LEFT JOIN "public"."payments" "p" ON (("lc"."id" = "p"."case_id")))
  GROUP BY "lc"."id", "lc"."court_case_number", "lc"."case_name";


ALTER VIEW "public"."case_payment_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "related_case_id" "uuid",
    "relation_type" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "scourt_enc_cs_no" character varying(100),
    "relation_type_code" character varying(50),
    "direction" character varying(20),
    "auto_detected" boolean DEFAULT false,
    "detected_at" timestamp with time zone,
    "confirmed" boolean DEFAULT false,
    "confirmed_at" timestamp with time zone
);


ALTER TABLE "public"."case_relations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."case_relations"."scourt_enc_cs_no" IS 'SCOURT 연관사건 encCsNo';



COMMENT ON COLUMN "public"."case_relations"."relation_type_code" IS '관계 유형 코드 (appeal, provisional, related, cross)';



COMMENT ON COLUMN "public"."case_relations"."direction" IS '관계 방향 (parent, child)';



COMMENT ON COLUMN "public"."case_relations"."auto_detected" IS 'SCOURT에서 자동 감지됨';



CREATE TABLE IF NOT EXISTS "public"."case_representatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "case_id" "uuid" NOT NULL,
    "case_party_id" "uuid",
    "representative_name" "text" NOT NULL,
    "representative_type_label" character varying(50),
    "law_firm_name" "text",
    "is_our_firm" boolean DEFAULT false,
    "scourt_synced" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "manual_override" boolean DEFAULT false
);


ALTER TABLE "public"."case_representatives" OWNER TO "postgres";


COMMENT ON COLUMN "public"."case_representatives"."manual_override" IS '사용자 수동 수정 보존';



CREATE TABLE IF NOT EXISTS "public"."case_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "schedule_type" "text" DEFAULT 'trial'::"text",
    "title" "text" NOT NULL,
    "description" "text",
    "scheduled_date" "date" NOT NULL,
    "scheduled_time" time without time zone,
    "location" "text",
    "courtroom" "text",
    "assigned_lawyer" "text",
    "status" "text" DEFAULT 'scheduled'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "case_schedules_schedule_type_check" CHECK (("schedule_type" = ANY (ARRAY['trial'::"text", 'consultation'::"text", 'meeting'::"text"]))),
    CONSTRAINT "case_schedules_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."case_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."case_schedules" IS '사건 일정 (재판, 상담, 미팅)';



CREATE TABLE IF NOT EXISTS "public"."cases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "notion_id" "text",
    "title" "text" NOT NULL,
    "badge" "text",
    "categories" "text"[],
    "background" "text",
    "strategy" "text",
    "result" "text",
    "icon" "text",
    "published" boolean DEFAULT false,
    "views" integer DEFAULT 0,
    "sort_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "case_number" character varying(100)
);


ALTER TABLE "public"."cases" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cases"."case_number" IS '사건번호 (예: 2024드단12345) - court_hearings, case_deadlines와 연동';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "phone2" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "notion_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "account_number" "text",
    "resident_number" "text",
    "kakao_id" "text",
    "birth_date" "date",
    "gender" character varying(1),
    "tenant_id" "uuid" NOT NULL,
    "bank_account" character varying(100)
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON TABLE "public"."clients" IS '의뢰인 정보';



COMMENT ON COLUMN "public"."clients"."account_number" IS '의뢰인 계좌번호';



COMMENT ON COLUMN "public"."clients"."resident_number" IS '주민등록번호';



COMMENT ON COLUMN "public"."clients"."tenant_id" IS '소속 테넌트 ID';



COMMENT ON COLUMN "public"."clients"."bank_account" IS '의뢰인 계좌번호 (은행명 포함, 예: 국민 123-456-789012)';



CREATE TABLE IF NOT EXISTS "public"."consultation_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "field_name" "text",
    "old_value" "text",
    "new_value" "text",
    "actor_type" "text" DEFAULT 'admin'::"text" NOT NULL,
    "actor_id" "text",
    "actor_name" "text",
    "metadata" "jsonb",
    "is_system_generated" boolean DEFAULT false
);


ALTER TABLE "public"."consultation_activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultation_activity_log" IS '상담 활동 이력 - 모든 상담 변경사항을 추적합니다';



COMMENT ON COLUMN "public"."consultation_activity_log"."activity_type" IS '활동 유형: created, status_changed, assigned, scheduled, rescheduled, cancelled, completed, field_updated, note_added';



COMMENT ON COLUMN "public"."consultation_activity_log"."description" IS '사람이 읽을 수 있는 활동 설명';



COMMENT ON COLUMN "public"."consultation_activity_log"."actor_type" IS '활동 주체: admin, system, customer';



CREATE TABLE IF NOT EXISTS "public"."consultation_date_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "exception_date" "date" NOT NULL,
    "is_blocked" boolean DEFAULT false,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "lawyer_name" "text",
    "office_location" "text",
    "reason" "text",
    "tenant_id" "uuid",
    CONSTRAINT "valid_exception_time_range" CHECK (((("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("end_time" > "start_time"))))
);


ALTER TABLE "public"."consultation_date_exceptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultation_date_exceptions" IS '상담 예약 특정 날짜 예외 처리';



COMMENT ON COLUMN "public"."consultation_date_exceptions"."is_blocked" IS 'true: 휴무, false: 특별 운영';



CREATE TABLE IF NOT EXISTS "public"."consultations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "request_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "category" "text",
    "message" "text",
    "preferred_date" "date",
    "preferred_time" "text",
    "confirmed_date" "date",
    "confirmed_time" "text",
    "video_link" "text",
    "preferred_lawyer" "text",
    "assigned_lawyer" "text",
    "consultation_fee" integer DEFAULT 0,
    "payment_method" "text",
    "payment_status" "text",
    "paid_at" timestamp with time zone,
    "payment_transaction_id" "text",
    "admin_notes" "text",
    "contacted_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "source" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "lead_score" integer DEFAULT 0,
    "assigned_to" "text",
    "scheduled_date" timestamp with time zone,
    "converted_to_case_id" "uuid",
    "tenant_id" "uuid",
    "assigned_member_id" "uuid",
    CONSTRAINT "consultations_unified_assigned_lawyer_check" CHECK (("assigned_lawyer" = ANY (ARRAY['육심원'::"text", '임은지'::"text", NULL::"text"]))),
    CONSTRAINT "consultations_unified_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['card'::"text", 'transfer'::"text", 'cash'::"text", 'free'::"text", NULL::"text"]))),
    CONSTRAINT "consultations_unified_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'refunded'::"text", 'free'::"text", NULL::"text"]))),
    CONSTRAINT "consultations_unified_preferred_lawyer_check" CHECK (("preferred_lawyer" = ANY (ARRAY['육심원'::"text", '임은지'::"text", NULL::"text"]))),
    CONSTRAINT "consultations_unified_request_type_check" CHECK (("request_type" = ANY (ARRAY['callback'::"text", 'visit'::"text", 'video'::"text", 'info'::"text"]))),
    CONSTRAINT "consultations_unified_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'contacted'::"text", 'confirmed'::"text", 'payment_pending'::"text", 'payment_completed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'no_show'::"text"]))),
    CONSTRAINT "payment_consistency" CHECK (((("payment_status" IS NULL) AND ("payment_method" IS NULL)) OR (("payment_status" IS NOT NULL) AND ("payment_method" IS NOT NULL)))),
    CONSTRAINT "scheduled_must_have_datetime" CHECK ((("request_type" <> ALL (ARRAY['visit'::"text", 'video'::"text"])) OR (("preferred_date" IS NOT NULL) AND ("preferred_time" IS NOT NULL))))
);


ALTER TABLE "public"."consultations" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultations" IS 'Unified table for all consultation requests: callback, visit, video, and info';



COMMENT ON COLUMN "public"."consultations"."request_type" IS 'Type of consultation request';



COMMENT ON COLUMN "public"."consultations"."status" IS 'Current status in the consultation workflow';



COMMENT ON COLUMN "public"."consultations"."consultation_fee" IS 'Consultation fee in KRW (0 = free consultation)';



COMMENT ON COLUMN "public"."consultations"."completed_at" IS '상담 완료 일시';



COMMENT ON COLUMN "public"."consultations"."source" IS 'Traffic source: website, landing_page, phone, referral, etc.';



COMMENT ON COLUMN "public"."consultations"."lead_score" IS 'Auto-calculated score for prioritization (higher = more urgent)';



COMMENT ON COLUMN "public"."consultations"."assigned_to" IS '담당 변호사명';



COMMENT ON COLUMN "public"."consultations"."scheduled_date" IS '상담 예정 일시';



COMMENT ON COLUMN "public"."consultations"."converted_to_case_id" IS '사건으로 전환된 경우 사건 ID';



COMMENT ON COLUMN "public"."consultations"."tenant_id" IS '소속 테넌트 ID';



COMMENT ON COLUMN "public"."consultations"."assigned_member_id" IS '담당자 ID';



CREATE OR REPLACE VIEW "public"."consultation_payment_summary" AS
 SELECT "c"."id" AS "consultation_id",
    "c"."name",
    "c"."phone",
    "c"."request_type",
    "count"("p"."id") AS "payment_count",
    "sum"("p"."amount") AS "total_amount",
    "min"("p"."payment_date") AS "first_payment_date",
    "max"("p"."payment_date") AS "last_payment_date"
   FROM ("public"."consultations" "c"
     LEFT JOIN "public"."payments" "p" ON (("c"."id" = "p"."consultation_id")))
  GROUP BY "c"."id", "c"."name", "c"."phone", "c"."request_type";


ALTER VIEW "public"."consultation_payment_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultation_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."consultation_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultation_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "color" "text" DEFAULT 'gray'::"text",
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "usage_count" integer DEFAULT 0,
    "description" "text",
    CONSTRAINT "name_not_empty" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."consultation_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultation_sources" IS '상담 유입 경로 관리 테이블';



COMMENT ON COLUMN "public"."consultation_sources"."name" IS '유입 경로 이름 (예: 네이버, 홈페이지, 기타)';



COMMENT ON COLUMN "public"."consultation_sources"."display_order" IS '표시 순서 (낮을수록 먼저 표시)';



COMMENT ON COLUMN "public"."consultation_sources"."color" IS 'UI 표시 색상 (tailwind color name)';



COMMENT ON COLUMN "public"."consultation_sources"."is_active" IS '활성화 여부 (비활성화된 항목은 선택 불가)';



COMMENT ON COLUMN "public"."consultation_sources"."is_default" IS '기본값 여부 (신규 상담 시 자동 선택)';



COMMENT ON COLUMN "public"."consultation_sources"."usage_count" IS '사용 횟수 (통계용)';



CREATE TABLE IF NOT EXISTS "public"."consultation_weekly_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "slot_duration_minutes" integer DEFAULT 30,
    "max_bookings_per_slot" integer DEFAULT 1,
    "lawyer_name" "text",
    "is_available" boolean DEFAULT true,
    "description" "text",
    "tenant_id" "uuid",
    CONSTRAINT "consultation_weekly_schedule_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "valid_max_bookings" CHECK (("max_bookings_per_slot" > 0)),
    CONSTRAINT "valid_slot_duration" CHECK (("slot_duration_minutes" > 0)),
    CONSTRAINT "valid_time_range" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."consultation_weekly_schedule" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultation_weekly_schedule" IS '상담 예약 주간 반복 일정';



COMMENT ON COLUMN "public"."consultation_weekly_schedule"."day_of_week" IS '요일 (0=일요일, 1=월요일, ..., 6=토요일)';



COMMENT ON COLUMN "public"."consultation_weekly_schedule"."slot_duration_minutes" IS '슬롯 길이 (분), 기본 30분';



COMMENT ON COLUMN "public"."consultation_weekly_schedule"."max_bookings_per_slot" IS '슬롯당 최대 예약 수';



CREATE TABLE IF NOT EXISTS "public"."court_hearings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_number" character varying(100),
    "hearing_type" "public"."hearing_type" NOT NULL,
    "hearing_date" timestamp with time zone NOT NULL,
    "location" character varying(200),
    "judge_name" character varying(100),
    "notes" "text",
    "status" "public"."hearing_status" DEFAULT 'SCHEDULED'::"public"."hearing_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "report" "text",
    "case_id" "uuid",
    "result" "public"."hearing_result",
    "google_event_id" "text",
    "scourt_hearing_hash" "text",
    "source" "text",
    "attending_lawyer_id" "uuid",
    "scourt_type_raw" "text",
    "scourt_result_raw" "text",
    "hearing_sequence" integer,
    "video_participant_side" "text"
);


ALTER TABLE "public"."court_hearings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."court_hearings"."case_number" IS '사건번호 (선택적, case_id로 사건 연결 권장)';



COMMENT ON COLUMN "public"."court_hearings"."report" IS '재판기일 보고서 (텍스트)';



COMMENT ON COLUMN "public"."court_hearings"."case_id" IS '사건 ID (legal_cases 참조, 필수 권장)';



COMMENT ON COLUMN "public"."court_hearings"."result" IS '변론기일 결과: CONTINUED(속행), CONCLUDED(종결), POSTPONED(연기), 
  DISMISSED(추정)';



COMMENT ON COLUMN "public"."court_hearings"."attending_lawyer_id" IS '출석 변호사 (기본값: 사건 담당변호사)';



COMMENT ON COLUMN "public"."court_hearings"."scourt_type_raw" IS 'SCOURT 원본 기일명';



COMMENT ON COLUMN "public"."court_hearings"."scourt_result_raw" IS 'SCOURT 원본 기일 결과';



COMMENT ON COLUMN "public"."court_hearings"."hearing_sequence" IS '기일 회차 번호';



COMMENT ON COLUMN "public"."court_hearings"."video_participant_side" IS '화상 참여자 측: plaintiff_side(원고측), defendant_side(피고측), both(쌍방), NULL(화상기일 아님)';



CREATE TABLE IF NOT EXISTS "public"."deadline_extensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deadline_id" "uuid" NOT NULL,
    "extension_number" integer NOT NULL,
    "original_deadline" "date" NOT NULL,
    "extended_deadline" "date" NOT NULL,
    "reason" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deadline_extensions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deadline_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."deadline_type" NOT NULL,
    "name" character varying(100) NOT NULL,
    "days" integer NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_extendable" boolean DEFAULT false,
    "max_extensions" integer DEFAULT 0,
    "extension_days" integer DEFAULT 0
);


ALTER TABLE "public"."deadline_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dismissed_case_notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "notice_id" "text" NOT NULL,
    "dismissed_by" "uuid",
    "dismissed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dismissed_case_notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dismissed_related_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "related_case_no" "text" NOT NULL,
    "related_case_type" "text" NOT NULL,
    "dismissed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dismissed_related_cases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drive_file_classifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drive_file_id" character varying(255) NOT NULL,
    "file_name" character varying(500) NOT NULL,
    "folder_path" character varying(1000),
    "mime_type" character varying(100),
    "parsed_case_number" character varying(50),
    "parsed_date" "date",
    "parsed_document_type" character varying(50),
    "parsed_document_name" character varying(200),
    "parsed_evidence_number" character varying(50),
    "parsed_submitter" character varying(50),
    "match_type" character varying(20),
    "match_score" integer DEFAULT 0,
    "case_id" "uuid",
    "manually_classified" boolean DEFAULT false,
    "classified_by" "uuid",
    "classified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "client_visible" boolean DEFAULT false,
    "client_doc_type" character varying(50),
    "is_large_file" boolean DEFAULT false,
    "file_size" bigint,
    "original_filename" character varying(500),
    "submitter_party_index" integer,
    "evidence_party_label" "text",
    "rag_status" character varying(20) DEFAULT 'pending'::character varying,
    "rag_text_length" integer DEFAULT 0,
    "rag_chunk_count" integer DEFAULT 0,
    "rag_error" "text",
    "rag_method" character varying(20),
    "rag_ingested_at" timestamp with time zone,
    CONSTRAINT "drive_file_classifications_match_type_check" CHECK ((("match_type")::"text" = ANY ((ARRAY['exact'::character varying, 'partial'::character varying, 'folder'::character varying, 'none'::character varying, 'manual'::character varying])::"text"[])))
);


ALTER TABLE "public"."drive_file_classifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."drive_file_classifications" IS 'Drive 파일 자동 분류 결과';



COMMENT ON COLUMN "public"."drive_file_classifications"."drive_file_id" IS 'Google Drive 파일 ID';



COMMENT ON COLUMN "public"."drive_file_classifications"."match_type" IS '매칭 유형: exact(사건번호), partial(부분), folder(폴더명), none(미매칭), manual(수동)';



COMMENT ON COLUMN "public"."drive_file_classifications"."match_score" IS '매칭 점수 (0-100)';



COMMENT ON COLUMN "public"."drive_file_classifications"."original_filename" IS '원본 파일명 (전자소송 등, AI 분석용)';



COMMENT ON COLUMN "public"."drive_file_classifications"."submitter_party_index" IS '제출자 당사자 인덱스 (다수 당사자용): 1=피고1/원고1, 2=피고2/원고2 등';



COMMENT ON COLUMN "public"."drive_file_classifications"."evidence_party_label" IS '증거번호에서 추출한 당사자 라벨: 가, 나, 다, 라 등';



COMMENT ON COLUMN "public"."drive_file_classifications"."rag_status" IS 'RAG 인덱싱 상태: pending(대기), success(성공), failed(실패), partial(부분성공), skipped(스킵)';



COMMENT ON COLUMN "public"."drive_file_classifications"."rag_text_length" IS '추출된 텍스트 길이 (문자 수)';



COMMENT ON COLUMN "public"."drive_file_classifications"."rag_chunk_count" IS '생성된 RAG 청크 수';



COMMENT ON COLUMN "public"."drive_file_classifications"."rag_error" IS 'RAG 실패 시 에러 메시지';



COMMENT ON COLUMN "public"."drive_file_classifications"."rag_method" IS '텍스트 추출 방법: pdf_parse, ocr, direct';



COMMENT ON COLUMN "public"."drive_file_classifications"."rag_ingested_at" IS 'RAG 인덱싱 완료 시간';



CREATE TABLE IF NOT EXISTS "public"."drive_watch_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "resource_uri" "text",
    "expiration" bigint NOT NULL,
    "inbox_folder_id" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drive_watch_channels" OWNER TO "postgres";


COMMENT ON TABLE "public"."drive_watch_channels" IS 'Google Drive Push Notification 채널 상태';



CREATE TABLE IF NOT EXISTS "public"."drive_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "files_count" integer DEFAULT 0,
    "result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drive_webhook_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."drive_webhook_logs" IS 'Drive Webhook 이벤트 로그';



CREATE TABLE IF NOT EXISTS "public"."episodic_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "domain" "text" DEFAULT 'general'::"text" NOT NULL,
    "episode_type" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "summary" "text",
    "importance" double precision DEFAULT 0.5,
    "decay_rate" double precision DEFAULT 0.1,
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "access_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."episodic_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."episodic_memory" IS 'V4 에피소드 메모리 - Ebbinghaus decay 적용';



COMMENT ON COLUMN "public"."episodic_memory"."decay_rate" IS 'Ebbinghaus forgetting curve decay rate (0.0~1.0)';



CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expense_date" "date" NOT NULL,
    "amount" integer NOT NULL,
    "expense_category" "text" NOT NULL,
    "subcategory" "text",
    "is_recurring" boolean DEFAULT false,
    "recurring_template_id" "uuid",
    "vendor_name" "text",
    "memo" "text",
    "receipt_url" "text",
    "payment_method" "text",
    "paid_by" "text",
    "created_by" "text",
    "admin_notes" "text",
    "month_key" character varying(7),
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "chk_expense_category" CHECK (("expense_category" = ANY (ARRAY['임대료'::"text", '인건비'::"text", '필수운영비'::"text", '마케팅비'::"text", '광고비'::"text", '세금'::"text", '식대'::"text", '구독료'::"text", '기타'::"text"]))),
    CONSTRAINT "chk_payment_method" CHECK ((("payment_method" = ANY (ARRAY['카드'::"text", '현금'::"text", '계좌이체'::"text", '자동이체'::"text", '기타'::"text"])) OR ("payment_method" IS NULL))),
    CONSTRAINT "expenses_amount_check" CHECK (("amount" >= 0))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."expenses" IS '지출 내역 테이블';



COMMENT ON COLUMN "public"."expenses"."tenant_id" IS '소속 테넌트 ID';



CREATE OR REPLACE VIEW "public"."expense_stats_by_category" AS
 SELECT "tenant_id",
    "expense_category",
    "count"(*) AS "expense_count",
    "sum"("amount") AS "total_amount",
    "avg"("amount") AS "avg_amount"
   FROM "public"."expenses"
  WHERE ("tenant_id" IS NOT NULL)
  GROUP BY "tenant_id", "expense_category";


ALTER VIEW "public"."expense_stats_by_category" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faqs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "question" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text" NOT NULL,
    "summary" "text",
    "answer" "text" NOT NULL,
    "featured" boolean DEFAULT false,
    "published" boolean DEFAULT true,
    "views" integer DEFAULT 0,
    "sort_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "search_vector" "tsvector",
    "related_blog_posts" "text"[],
    "related_cases" "text"[]
);


ALTER TABLE "public"."faqs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."faqs"."related_blog_posts" IS 'Array of blog_posts.slug values for manually curated 
  references';



COMMENT ON COLUMN "public"."faqs"."related_cases" IS 'Array of cases.slug values for manually curated references';



CREATE TABLE IF NOT EXISTS "public"."general_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "schedule_type" "text" NOT NULL,
    "schedule_date" "date" NOT NULL,
    "schedule_time" time without time zone,
    "location" "text",
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    CONSTRAINT "general_schedules_schedule_type_check" CHECK (("schedule_type" = ANY (ARRAY['meeting'::"text", 'appointment'::"text", 'task'::"text", 'other'::"text"]))),
    CONSTRAINT "general_schedules_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."general_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instagram_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "notion_id" "text",
    "title" "text",
    "post_type" "text",
    "linked_case_id" "text",
    "linked_blog_id" "text",
    "thumbnail_url" "text",
    "images" "text"[],
    "caption" "text",
    "views" integer DEFAULT 0,
    "likes" integer DEFAULT 0,
    "published" boolean DEFAULT false,
    "post_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "published_at" timestamp with time zone,
    CONSTRAINT "instagram_posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['릴스'::"text", '일상'::"text", '성공사례'::"text", '칼럼'::"text", '일반'::"text", '홍보'::"text"])))
);


ALTER TABLE "public"."instagram_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."korean_public_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "holiday_date" "date" NOT NULL,
    "holiday_name" character varying(100) NOT NULL,
    "year" integer GENERATED ALWAYS AS ((EXTRACT(year FROM "holiday_date"))::integer) STORED,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."korean_public_holidays" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."monthly_expense_summary" AS
 SELECT "tenant_id",
    "to_char"(("expense_date")::timestamp with time zone, 'YYYY-MM'::"text") AS "month",
    "expense_category",
    "count"(*) AS "expense_count",
    "sum"("amount") AS "total_amount"
   FROM "public"."expenses"
  WHERE ("tenant_id" IS NOT NULL)
  GROUP BY "tenant_id", ("to_char"(("expense_date")::timestamp with time zone, 'YYYY-MM'::"text")), "expense_category";


ALTER VIEW "public"."monthly_expense_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."monthly_revenue_summary" AS
 SELECT "tenant_id",
    "to_char"(("payment_date")::timestamp with time zone, 'YYYY-MM'::"text") AS "month",
    "count"(*) AS "payment_count",
    "sum"("amount") AS "total_amount",
    "sum"(
        CASE
            WHEN "is_confirmed" THEN "amount"
            ELSE 0
        END) AS "confirmed_amount"
   FROM "public"."payments"
  WHERE ("tenant_id" IS NOT NULL)
  GROUP BY "tenant_id", ("to_char"(("payment_date")::timestamp with time zone, 'YYYY-MM'::"text"));


ALTER VIEW "public"."monthly_revenue_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "settlement_month" "text" NOT NULL,
    "total_revenue" bigint DEFAULT 0,
    "pyeongtaek_revenue" bigint DEFAULT 0,
    "cheonan_revenue" bigint DEFAULT 0,
    "total_expenses" bigint DEFAULT 0,
    "pyeongtaek_expenses" bigint DEFAULT 0,
    "cheonan_expenses" bigint DEFAULT 0,
    "fixed_expenses" bigint DEFAULT 0,
    "marketing_expenses" bigint DEFAULT 0,
    "tax_expenses" bigint DEFAULT 0,
    "kim_withdrawals" bigint DEFAULT 0,
    "lim_withdrawals" bigint DEFAULT 0,
    "net_profit" bigint GENERATED ALWAYS AS (("total_revenue" - "total_expenses")) STORED,
    "kim_share" bigint GENERATED ALWAYS AS ((("total_revenue" - "total_expenses") / 2)) STORED,
    "lim_share" bigint GENERATED ALWAYS AS ((("total_revenue" - "total_expenses") / 2)) STORED,
    "kim_net_balance" bigint GENERATED ALWAYS AS (((("total_revenue" - "total_expenses") / 2) - "kim_withdrawals")) STORED,
    "lim_net_balance" bigint GENERATED ALWAYS AS (((("total_revenue" - "total_expenses") / 2) - "lim_withdrawals")) STORED,
    "kim_accumulated_debt" bigint DEFAULT 0,
    "lim_accumulated_debt" bigint DEFAULT 0,
    "is_settled" boolean DEFAULT false,
    "settled_at" timestamp with time zone,
    "settled_by" "text",
    "excel_file_url" "text",
    "settlement_notes" "text",
    "admin_notes" "text"
);


ALTER TABLE "public"."monthly_settlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."monthly_settlements" IS '월별 정산 테이블';



CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "recipient_type" "text" NOT NULL,
    "recipient_id" "uuid",
    "recipient_phone" "text" NOT NULL,
    "recipient_name" "text",
    "channel" "text" NOT NULL,
    "message_type" "text" DEFAULT 'SMS'::"text",
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "provider_message_id" "text",
    "cost" numeric(10,2),
    "related_type" "text",
    "related_id" "uuid",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_logs" IS '알림 발송 이력';



COMMENT ON COLUMN "public"."notification_logs"."status" IS '발송 상태: pending(대기), sent(발송), delivered(전달), failed(실패)';



CREATE TABLE IF NOT EXISTS "public"."notification_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "template_id" "uuid",
    "days_before" integer DEFAULT 1,
    "time_of_day" time without time zone DEFAULT '09:00:00'::time without time zone,
    "is_active" boolean DEFAULT true,
    "channel" "text" DEFAULT 'sms'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_schedules" IS '자동 발송 설정';



CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "channel" "text" DEFAULT 'sms'::"text" NOT NULL,
    "category" "text" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "message_type" "text" DEFAULT 'SMS'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_templates" IS '알림 메시지 템플릿 관리';



COMMENT ON COLUMN "public"."notification_templates"."variables" IS '템플릿에서 사용 가능한 변수 목록 (예: ["이름", "날짜"])';



CREATE TABLE IF NOT EXISTS "public"."oauth_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state" character varying(500) NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" character varying(50) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:10:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."oauth_states" OWNER TO "postgres";


COMMENT ON TABLE "public"."oauth_states" IS 'OAuth 인증 중 CSRF 방지용 임시 state 저장';



CREATE OR REPLACE VIEW "public"."partner_debt_status" AS
 SELECT '임은지'::"text" AS "partner_name",
    "sum"("monthly_settlements"."lim_accumulated_debt") AS "accumulated_debt",
    "max"("monthly_settlements"."settlement_month") AS "last_settlement_month",
    "count"(*) AS "total_settlements"
   FROM "public"."monthly_settlements"
UNION ALL
 SELECT '김현성'::"text" AS "partner_name",
    "sum"("monthly_settlements"."kim_accumulated_debt") AS "accumulated_debt",
    "max"("monthly_settlements"."settlement_month") AS "last_settlement_month",
    "count"(*) AS "total_settlements"
   FROM "public"."monthly_settlements";


ALTER VIEW "public"."partner_debt_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_withdrawals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "withdrawal_date" "date" NOT NULL,
    "partner_name" "text" NOT NULL,
    "amount" integer NOT NULL,
    "withdrawal_type" "text" NOT NULL,
    "payment_method" "text",
    "office_location" "text",
    "month_key" "text" NOT NULL,
    "settlement_id" "uuid",
    "description" "text",
    "memo" "text",
    "admin_notes" "text",
    CONSTRAINT "chk_partner_name" CHECK (("partner_name" = ANY (ARRAY['임은지'::"text", '김현성'::"text"]))),
    CONSTRAINT "chk_pw_office_location" CHECK ((("office_location" = ANY (ARRAY['평택'::"text", '천안'::"text", '공통'::"text"])) OR ("office_location" IS NULL))),
    CONSTRAINT "chk_withdrawal_type" CHECK (("withdrawal_type" = ANY (ARRAY['입금'::"text", '카드'::"text", '현금'::"text", '법인지출'::"text"]))),
    CONSTRAINT "partner_withdrawals_amount_check" CHECK (("amount" >= 0))
);


ALTER TABLE "public"."partner_withdrawals" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_withdrawals" IS '변호사별 인출/지급 테이블';



CREATE OR REPLACE VIEW "public"."payment_conversion_funnel" AS
 SELECT "to_char"(("payment_date")::timestamp with time zone, 'YYYY-MM'::"text") AS "month",
    "count"(DISTINCT
        CASE
            WHEN ("payment_category" = '모든 상담'::"text") THEN "consultation_id"
            ELSE NULL::"uuid"
        END) AS "consultation_count",
    "sum"(
        CASE
            WHEN ("payment_category" = '모든 상담'::"text") THEN "amount"
            ELSE 0
        END) AS "consultation_revenue",
    "avg"(
        CASE
            WHEN ("payment_category" = '모든 상담'::"text") THEN "amount"
            ELSE NULL::integer
        END) AS "avg_consultation_fee",
    "count"(DISTINCT
        CASE
            WHEN ("payment_category" = '착수금'::"text") THEN "case_id"
            ELSE NULL::"uuid"
        END) AS "case_count",
    "sum"(
        CASE
            WHEN ("payment_category" = ANY (ARRAY['착수금'::"text", '잔금'::"text", '성공보수'::"text"])) THEN "amount"
            ELSE 0
        END) AS "case_revenue",
    "avg"(
        CASE
            WHEN ("payment_category" = '착수금'::"text") THEN "amount"
            ELSE NULL::integer
        END) AS "avg_retainer",
        CASE
            WHEN ("count"(DISTINCT
            CASE
                WHEN ("payment_category" = '모든 상담'::"text") THEN "consultation_id"
                ELSE NULL::"uuid"
            END) > 0) THEN "round"(((("count"(DISTINCT
            CASE
                WHEN ("payment_category" = '착수금'::"text") THEN "case_id"
                ELSE NULL::"uuid"
            END))::numeric / ("count"(DISTINCT
            CASE
                WHEN ("payment_category" = '모든 상담'::"text") THEN "consultation_id"
                ELSE NULL::"uuid"
            END))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "conversion_rate"
   FROM "public"."payments"
  GROUP BY ("to_char"(("payment_date")::timestamp with time zone, 'YYYY-MM'::"text"))
  ORDER BY ("to_char"(("payment_date")::timestamp with time zone, 'YYYY-MM'::"text")) DESC;


ALTER VIEW "public"."payment_conversion_funnel" OWNER TO "postgres";


COMMENT ON VIEW "public"."payment_conversion_funnel" IS '전환율 분석 뷰 (상담 → 사건 전환 추적)';



CREATE OR REPLACE VIEW "public"."payment_stats_by_category" AS
 SELECT "tenant_id",
    "payment_category",
    "count"(*) AS "payment_count",
    "sum"("amount") AS "total_amount",
    "avg"("amount") AS "avg_amount",
    "min"("payment_date") AS "first_payment",
    "max"("payment_date") AS "last_payment"
   FROM "public"."payments"
  WHERE ("tenant_id" IS NOT NULL)
  GROUP BY "tenant_id", "payment_category";


ALTER VIEW "public"."payment_stats_by_category" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."payment_stats_by_month" AS
 SELECT "tenant_id",
    "to_char"(("payment_date")::timestamp with time zone, 'YYYY-MM'::"text") AS "month",
    "payment_category",
    "count"(*) AS "payment_count",
    "sum"("amount") AS "total_amount"
   FROM "public"."payments"
  WHERE ("tenant_id" IS NOT NULL)
  GROUP BY "tenant_id", ("to_char"(("payment_date")::timestamp with time zone, 'YYYY-MM'::"text")), "payment_category";


ALTER VIEW "public"."payment_stats_by_month" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "google_event_id" "text" NOT NULL,
    "summary" "text",
    "description" "text",
    "location" "text",
    "start_datetime" timestamp with time zone,
    "parsed_case_number" "text",
    "parsed_hearing_type" "text",
    "parsed_hearing_detail" "text",
    "parsed_court_name" "text",
    "parsed_courtroom" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "match_attempted_at" timestamp with time zone,
    "match_attempts" integer DEFAULT 1,
    "matched_case_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pending_calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."persona_feedback_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "feedback_type" "text" NOT NULL,
    "signal" "text" NOT NULL,
    "context" "text",
    "adjustment_applied" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "persona_feedback_logs_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['explicit'::"text", 'implicit'::"text"]))),
    CONSTRAINT "persona_feedback_logs_signal_check" CHECK (("signal" = ANY (ARRAY['positive'::"text", 'negative'::"text", 'neutral'::"text"])))
);


ALTER TABLE "public"."persona_feedback_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."persona_feedback_logs" IS 'V4 페르소나 피드백 로그';



CREATE TABLE IF NOT EXISTS "public"."receivable_memos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "content" "text" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid",
    "tenant_id" "uuid"
);


ALTER TABLE "public"."receivable_memos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receivable_writeoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "case_name" "text" NOT NULL,
    "client_name" "text",
    "original_amount" numeric DEFAULT 0 NOT NULL,
    "reason" "text",
    "written_off_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "written_off_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid"
);


ALTER TABLE "public"."receivable_writeoffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text" NOT NULL,
    "amount" integer NOT NULL,
    "expense_category" "text" NOT NULL,
    "subcategory" "text",
    "vendor_name" "text",
    "payment_method" "text",
    "memo" "text",
    "is_active" boolean DEFAULT true,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "day_of_month" integer DEFAULT 1,
    "created_by" "text",
    "admin_notes" "text",
    CONSTRAINT "chk_rt_expense_category" CHECK (("expense_category" = ANY (ARRAY['임대료'::"text", '인건비'::"text", '필수운영비'::"text", '마케팅비'::"text", '광고비'::"text", '세금'::"text", '식대'::"text", '구독료'::"text", '기타'::"text"]))),
    CONSTRAINT "recurring_templates_amount_check" CHECK (("amount" >= 0)),
    CONSTRAINT "recurring_templates_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 28)))
);


ALTER TABLE "public"."recurring_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."recurring_templates" IS '고정 지출 템플릿 테이블';



CREATE TABLE IF NOT EXISTS "public"."scourt_case_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_case_id" "uuid",
    "profile_id" "uuid",
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "basic_info" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "hearings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "progress" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "documents" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "lower_court" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "case_type" character varying(20),
    "court_code" character varying(20),
    "case_number" character varying(50),
    "content_hash" character varying(64),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "related_cases" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "raw_data" "jsonb"
);


ALTER TABLE "public"."scourt_case_snapshots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scourt_case_snapshots"."related_cases" IS '연계사건 정보 [{caseNo, caseName, relation}]';



CREATE TABLE IF NOT EXISTS "public"."scourt_case_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_case_id" "uuid",
    "snapshot_id" "uuid",
    "detected_at" timestamp with time zone DEFAULT "now"(),
    "update_type" character varying(50) NOT NULL,
    "update_summary" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "importance" character varying(20) DEFAULT 'normal'::character varying,
    "is_read_by_admin" boolean DEFAULT false,
    "is_read_by_client" boolean DEFAULT false,
    "read_at_admin" timestamp with time zone,
    "read_at_client" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."scourt_case_updates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."scourt_case_update_summary" AS
 SELECT "id" AS "legal_case_id",
    "court_case_number" AS "case_number",
    "case_name",
    "scourt_unread_updates",
    "scourt_next_hearing",
    ( SELECT "json_agg"("u".* ORDER BY "u"."detected_at" DESC) AS "json_agg"
           FROM ( SELECT "scourt_case_updates"."id",
                    "scourt_case_updates"."update_type",
                    "scourt_case_updates"."update_summary",
                    "scourt_case_updates"."detected_at",
                    "scourt_case_updates"."importance",
                    "scourt_case_updates"."is_read_by_client"
                   FROM "public"."scourt_case_updates"
                  WHERE ("scourt_case_updates"."legal_case_id" = "lc"."id")
                  ORDER BY "scourt_case_updates"."detected_at" DESC
                 LIMIT 5) "u") AS "recent_updates",
    ( SELECT "max"("scourt_case_updates"."detected_at") AS "max"
           FROM "public"."scourt_case_updates"
          WHERE ("scourt_case_updates"."legal_case_id" = "lc"."id")) AS "last_update_at"
   FROM "public"."legal_cases" "lc"
  WHERE ("scourt_last_sync" IS NOT NULL);


ALTER VIEW "public"."scourt_case_update_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scourt_user_wmonid" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "wmonid" character varying(20) NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "case_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "member_id" "uuid"
);


ALTER TABLE "public"."scourt_user_wmonid" OWNER TO "postgres";


COMMENT ON TABLE "public"."scourt_user_wmonid" IS '사용자별 대법원 WMONID 관리. encCsNo가 WMONID에 바인딩됨.';



COMMENT ON COLUMN "public"."scourt_user_wmonid"."wmonid" IS '대법원 세션 식별자. 관측 기준 1년 유효.';



COMMENT ON COLUMN "public"."scourt_user_wmonid"."expires_at" IS '만료일. 만료 30~45일 전 갱신 필요.';



COMMENT ON COLUMN "public"."scourt_user_wmonid"."status" IS 'active: 사용중, expiring: 만료임박, expired: 만료됨, migrating: 마이그레이션중';



COMMENT ON COLUMN "public"."scourt_user_wmonid"."tenant_id" IS '소속 테넌트 ID';



COMMENT ON COLUMN "public"."scourt_user_wmonid"."member_id" IS '담당 멤버 ID (WMONID 소유자)';



CREATE OR REPLACE VIEW "public"."scourt_expiring_wmonids" AS
 SELECT "id",
    "user_id",
    "wmonid",
    "issued_at",
    "expires_at",
    "status",
    "case_count",
    "created_at",
    "updated_at",
    ("expires_at" - '1 mon'::interval) AS "renewal_date",
    ("expires_at" - "now"()) AS "time_remaining"
   FROM "public"."scourt_user_wmonid" "w"
  WHERE ((("status")::"text" = 'active'::"text") AND ("expires_at" <= ("now"() + '1 mon'::interval)));


ALTER VIEW "public"."scourt_expiring_wmonids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scourt_profile_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "legal_case_id" "uuid",
    "court_code" character varying(10),
    "court_name" character varying(100),
    "case_number" character varying(50) NOT NULL,
    "case_name" character varying(200),
    "enc_cs_no" "text",
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_wmonid_id" "uuid",
    "wmonid" character varying(20),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."scourt_profile_cases" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scourt_profile_cases"."profile_id" IS 'Puppeteer 프로필 ID (API 기반은 null)';



COMMENT ON COLUMN "public"."scourt_profile_cases"."enc_cs_no" IS '암호화된 사건번호. WMONID와 함께 사용해야 캡챠 없이 상세조회 가능.';



COMMENT ON COLUMN "public"."scourt_profile_cases"."user_wmonid_id" IS 'WMONID 레코드 참조 (API 기반 접근용)';



COMMENT ON COLUMN "public"."scourt_profile_cases"."wmonid" IS 'encCsNo가 바인딩된 WMONID 쿠키값. 관측 기준 1년 유효.';



COMMENT ON COLUMN "public"."scourt_profile_cases"."tenant_id" IS '소속 테넌트 ID';



CREATE TABLE IF NOT EXISTS "public"."scourt_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lawyer_id" "uuid",
    "profile_name" character varying(100) NOT NULL,
    "case_count" integer DEFAULT 0,
    "max_cases" integer DEFAULT 50,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "member_id" "uuid"
);


ALTER TABLE "public"."scourt_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scourt_profiles"."tenant_id" IS '소속 테넌트 ID';



COMMENT ON COLUMN "public"."scourt_profiles"."member_id" IS '담당 멤버 ID';



CREATE TABLE IF NOT EXISTS "public"."scourt_user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "max_profiles" integer DEFAULT 6,
    "max_cases_per_profile" integer DEFAULT 50,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scourt_user_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."scourt_profile_usage" AS
 SELECT "p"."lawyer_id" AS "user_id",
    "count"("p"."id") AS "profile_count",
    "sum"("p"."case_count") AS "total_cases",
    "sum"("p"."max_cases") AS "total_capacity",
    COALESCE("s"."max_profiles", 6) AS "max_profiles",
    (COALESCE("s"."max_profiles", 6) - "count"("p"."id")) AS "remaining_profiles",
    (COALESCE("s"."max_profiles", 6) * COALESCE("s"."max_cases_per_profile", 50)) AS "max_total_cases"
   FROM ("public"."scourt_profiles" "p"
     LEFT JOIN "public"."scourt_user_settings" "s" ON ((("s"."user_id" = "p"."lawyer_id") OR ("s"."user_id" IS NULL))))
  GROUP BY "p"."lawyer_id", "s"."max_profiles", "s"."max_cases_per_profile";


ALTER VIEW "public"."scourt_profile_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scourt_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "legal_case_id" "uuid",
    "action" character varying(50) NOT NULL,
    "status" character varying(20) NOT NULL,
    "captcha_attempts" integer DEFAULT 0,
    "response_data" "jsonb",
    "error_message" "text",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."scourt_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scourt_update_types" (
    "code" character varying(50) NOT NULL,
    "name_ko" character varying(100) NOT NULL,
    "name_en" character varying(100),
    "description" "text",
    "importance" character varying(20) DEFAULT 'normal'::character varying,
    "icon" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scourt_update_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scourt_xml_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "xml_path" "text" NOT NULL,
    "xml_content" "text" NOT NULL,
    "case_type" "text",
    "data_list_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scourt_xml_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."scourt_xml_cache" IS 'SCOURT XML 파일 캐시 (일반내용 렌더링용)';



COMMENT ON COLUMN "public"."scourt_xml_cache"."xml_path" IS 'XML 파일 경로 (예: ssgo003/SSGO003F70.xml)';



COMMENT ON COLUMN "public"."scourt_xml_cache"."xml_content" IS 'XML 파일 원본 내용';



COMMENT ON COLUMN "public"."scourt_xml_cache"."case_type" IS '사건유형 코드 (ssgo102=가사, ssgo101=민사 등)';



COMMENT ON COLUMN "public"."scourt_xml_cache"."data_list_id" IS '데이터 리스트 ID (dlt_agntCttLst 등)';



CREATE TABLE IF NOT EXISTS "public"."semantic_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "domain" "text" DEFAULT 'general'::"text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_key" "text" NOT NULL,
    "entity_value" "jsonb" NOT NULL,
    "related_to" "uuid"[],
    "confidence" double precision DEFAULT 0.5,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "access_count" integer DEFAULT 0
);


ALTER TABLE "public"."semantic_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."semantic_memory" IS 'V4 시맨틱 메모리 - 추출된 엔티티/관계';



COMMENT ON COLUMN "public"."semantic_memory"."entity_key" IS '고유 키 형식: type:value (예: person:김철수)';



CREATE OR REPLACE VIEW "public"."settlement_dashboard" AS
 SELECT "settlement_month",
    "total_revenue",
    "total_expenses",
    "net_profit",
    "kim_withdrawals",
    "lim_withdrawals",
    "kim_net_balance",
    "lim_net_balance",
    "kim_accumulated_debt",
    "lim_accumulated_debt",
    "is_settled",
    "settled_at"
   FROM "public"."monthly_settlements"
  ORDER BY "settlement_month" DESC
 LIMIT 12;


ALTER VIEW "public"."settlement_dashboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "consultation_id" "uuid",
    "template_key" "text",
    "recipient_phone" "text" NOT NULL,
    "recipient_type" "text" NOT NULL,
    "message_content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "failure_reason" "text",
    "provider" "text" DEFAULT 'solapi'::"text" NOT NULL,
    "provider_message_id" "text",
    "provider_response" "jsonb",
    "cost" integer,
    "metadata" "jsonb",
    CONSTRAINT "sms_logs_recipient_type_check" CHECK (("recipient_type" = ANY (ARRAY['customer'::"text", 'admin'::"text"]))),
    CONSTRAINT "sms_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sms_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender" "text" NOT NULL,
    "body" "text" NOT NULL,
    "received_at" timestamp with time zone NOT NULL,
    "is_processed" boolean DEFAULT false,
    "classification" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."sms_messages" IS '수신된 SMS 원본 메시지 및 AI 분류 결과';



COMMENT ON COLUMN "public"."sms_messages"."classification" IS 'AI가 분류한 결과 (JSON)';



CREATE TABLE IF NOT EXISTS "public"."sms_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "template_key" "text" NOT NULL,
    "template_name" "text" NOT NULL,
    "description" "text",
    "message_template" "text" NOT NULL,
    "request_types" "text"[] NOT NULL,
    "trigger_status" "text",
    "trigger_event" "text",
    "is_active" boolean DEFAULT true,
    "send_to" "text" NOT NULL,
    "priority" integer DEFAULT 0,
    "variables" "jsonb",
    CONSTRAINT "sms_templates_send_to_check" CHECK (("send_to" = ANY (ARRAY['customer'::"text", 'admin'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."sms_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" character varying(50) NOT NULL,
    "name" character varying(100) NOT NULL,
    "name_ko" character varying(100),
    "description" "text",
    "features" "jsonb" DEFAULT '{"homepage": false, "maxCases": 100, "maxClients": 100, "maxMembers": 5, "scourtSync": true, "clientPortal": true}'::"jsonb",
    "price_monthly" integer DEFAULT 0,
    "price_yearly" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_plans" IS '구독 플랜 정의';



COMMENT ON COLUMN "public"."subscription_plans"."features" IS '플랜에 포함된 기능 및 제한';



CREATE TABLE IF NOT EXISTS "public"."super_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permissions" "jsonb" DEFAULT '["*"]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."super_admins" OWNER TO "postgres";


COMMENT ON TABLE "public"."super_admins" IS '슈퍼 어드민 (모든 테넌트 관리 권한)';



COMMENT ON COLUMN "public"."super_admins"."permissions" IS '슈퍼 어드민 권한 목록 ("*" = 전체 권한)';



CREATE TABLE IF NOT EXISTS "public"."tenant_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" character varying(50) NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "token_expiry" timestamp with time zone,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "status" character varying(20) DEFAULT 'disconnected'::character varying,
    "connected_at" timestamp with time zone,
    "connected_by" "uuid",
    "webhook_channel_id" character varying(200),
    "webhook_resource_id" character varying(200),
    "webhook_expiry" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_integrations" IS '테넌트별 외부 서비스 연동 (Google Calendar, Drive 등)';



COMMENT ON COLUMN "public"."tenant_integrations"."provider" IS '연동 서비스: google_calendar, google_drive';



COMMENT ON COLUMN "public"."tenant_integrations"."access_token" IS 'OAuth access token (만료 시 자동 갱신)';



COMMENT ON COLUMN "public"."tenant_integrations"."refresh_token" IS 'OAuth refresh token (장기 보관)';



COMMENT ON COLUMN "public"."tenant_integrations"."settings" IS '연동별 설정 (calendarId, folderId 등)';



COMMENT ON COLUMN "public"."tenant_integrations"."status" IS 'connected: 연결됨, disconnected: 해제됨, expired: 토큰 만료';



CREATE TABLE IF NOT EXISTS "public"."tenant_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" character varying(100) NOT NULL,
    "role" character varying(50) DEFAULT 'staff'::character varying NOT NULL,
    "token" character varying(100) DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "invited_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone
);


ALTER TABLE "public"."tenant_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_invitations" IS '테넌트 팀원 초대';



COMMENT ON COLUMN "public"."tenant_invitations"."token" IS '초대 링크용 토큰';



CREATE TABLE IF NOT EXISTS "public"."tenant_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(50) DEFAULT 'staff'::character varying NOT NULL,
    "display_name" character varying(100),
    "title" character varying(100),
    "bar_number" character varying(50),
    "phone" character varying(20),
    "email" character varying(100),
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "status" character varying(20) DEFAULT 'active'::character varying,
    "invited_at" timestamp with time zone,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_members" IS '테넌트 멤버십 (변호사, 직원)';



COMMENT ON COLUMN "public"."tenant_members"."role" IS 'owner: 소유자, admin: 관리자, lawyer: 변호사, staff: 직원';



COMMENT ON COLUMN "public"."tenant_members"."bar_number" IS '변호사 등록번호 (변호사인 경우)';



COMMENT ON COLUMN "public"."tenant_members"."permissions" IS '추가 세부 권한 설정';



CREATE TABLE IF NOT EXISTS "public"."tenant_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category" character varying(50) NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_settings" IS '테넌트별 서비스 설정 (카테고리, 옵션 등)';



COMMENT ON COLUMN "public"."tenant_settings"."category" IS '설정 카테고리: cases, payments, expenses, consultations, clients';



COMMENT ON COLUMN "public"."tenant_settings"."settings" IS 'JSON 형식의 설정 데이터';



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(200) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "type" character varying(50) DEFAULT 'individual'::character varying,
    "phone" character varying(20),
    "email" character varying(100),
    "address" "text",
    "has_homepage" boolean DEFAULT false,
    "homepage_domain" character varying(200),
    "homepage_subdomain" character varying(100),
    "plan" character varying(50) DEFAULT 'basic'::character varying,
    "plan_started_at" timestamp with time zone,
    "plan_expires_at" timestamp with time zone,
    "features" "jsonb" DEFAULT '{"maxCases": 100, "maxClients": 100, "maxMembers": 5, "scourtSync": true, "clientPortal": true}'::"jsonb",
    "settings" "jsonb" DEFAULT '{"timezone": "Asia/Seoul", "dateFormat": "YYYY-MM-DD", "workingHours": {"end": "18:00", "start": "09:00"}}'::"jsonb",
    "status" character varying(20) DEFAULT 'active'::character varying,
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "logo_dark_url" "text"
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS '테넌트 (법무법인/개인사무소) 정보';



COMMENT ON COLUMN "public"."tenants"."slug" IS 'URL에 사용되는 고유 식별자';



COMMENT ON COLUMN "public"."tenants"."type" IS 'individual: 개인변호사, firm: 법무법인';



COMMENT ON COLUMN "public"."tenants"."has_homepage" IS '홈페이지 서비스 연결 여부';



COMMENT ON COLUMN "public"."tenants"."features" IS '테넌트 기능 제한: maxCases, maxClients, maxMembers, maxLawyers(-1=무제한), scourtSync, clientPortal, homepage';



COMMENT ON COLUMN "public"."tenants"."logo_url" IS '테넌트 로고 URL (밝은 배경용)';



COMMENT ON COLUMN "public"."tenants"."logo_dark_url" IS '테넌트 로고 URL (어두운 배경용, 선택)';



CREATE OR REPLACE VIEW "public"."tenant_wmonid_usage" AS
 SELECT "t"."id" AS "tenant_id",
    "t"."name" AS "tenant_name",
    "tm"."id" AS "member_id",
    "tm"."display_name" AS "member_name",
    "tm"."role" AS "member_role",
    "count"("w"."id") AS "wmonid_count",
    COALESCE("sum"("w"."case_count"), (0)::bigint) AS "total_cases",
    COALESCE("sum"(GREATEST(0, (50 - "w"."case_count"))), (0)::bigint) AS "total_remaining_capacity",
    "count"(
        CASE
            WHEN (("w"."status")::"text" = 'active'::"text") THEN 1
            ELSE NULL::integer
        END) AS "active_wmonid_count",
    "count"(
        CASE
            WHEN (("w"."status")::"text" = 'expiring'::"text") THEN 1
            ELSE NULL::integer
        END) AS "expiring_wmonid_count"
   FROM (("public"."tenants" "t"
     LEFT JOIN "public"."tenant_members" "tm" ON (("tm"."tenant_id" = "t"."id")))
     LEFT JOIN "public"."scourt_user_wmonid" "w" ON (("w"."member_id" = "tm"."id")))
  WHERE (("tm"."role")::"text" = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'lawyer'::character varying])::"text"[]))
  GROUP BY "t"."id", "t"."name", "tm"."id", "tm"."display_name", "tm"."role"
  ORDER BY "t"."name", "tm"."display_name";


ALTER VIEW "public"."tenant_wmonid_usage" OWNER TO "postgres";


COMMENT ON VIEW "public"."tenant_wmonid_usage" IS '테넌트별/멤버별 WMONID 사용 현황';



CREATE TABLE IF NOT EXISTS "public"."testimonial_cases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category" "text" NOT NULL,
    "highlight_text" "text" NOT NULL,
    "case_result_amount" bigint,
    "client_initial" "text" NOT NULL,
    "client_role" "text",
    "client_age_group" "text",
    "full_story" "text",
    "story_before" "text",
    "story_journey" "text",
    "story_after" "text",
    "case_date" "text" NOT NULL,
    "case_duration" "text",
    "attorney_name" "text",
    "attorney_id" "uuid",
    "verified" boolean DEFAULT false,
    "consent_given" boolean DEFAULT false,
    "consent_date" timestamp with time zone,
    "featured" boolean DEFAULT false,
    "published" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "views" integer DEFAULT 0,
    "helpful_count" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "search_vector" "tsvector"
);


ALTER TABLE "public"."testimonial_cases" OWNER TO "postgres";


COMMENT ON TABLE "public"."testimonial_cases" IS '의뢰인 후기 케이스 - 증빙 중심 신뢰 구축 시스템';



COMMENT ON COLUMN "public"."testimonial_cases"."highlight_text" IS '카드에 표시될 짧은 텍스트 (예: 위자료 2억 승소)';



COMMENT ON COLUMN "public"."testimonial_cases"."case_result_amount" IS '사건 결과 금액 (원 단위)';



COMMENT ON COLUMN "public"."testimonial_cases"."full_story" IS '라이트박스에 표시될 전체 스토리';



COMMENT ON COLUMN "public"."testimonial_cases"."consent_given" IS '[CRITICAL] 게시 동의 필수';



CREATE TABLE IF NOT EXISTS "public"."testimonial_evidence_photos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "evidence_type" "text" NOT NULL,
    "photo_url" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "caption" "text",
    "original_date" timestamp with time zone,
    "file_size" integer,
    "file_type" "text",
    "width" integer,
    "height" integer,
    "alt_text" "text",
    "blur_applied" boolean DEFAULT true,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "testimonial_evidence_photos_evidence_type_check" CHECK (("evidence_type" = ANY (ARRAY['kakao'::"text", 'sms'::"text", 'naver'::"text", 'letter'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."testimonial_evidence_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."testimonial_evidence_photos" IS '후기 증빙 사진 - 카톡, 문자, 네이버 리뷰, 편지 등';



COMMENT ON COLUMN "public"."testimonial_evidence_photos"."evidence_type" IS 'kakao, sms, naver, letter, other';



COMMENT ON COLUMN "public"."testimonial_evidence_photos"."blur_applied" IS '[CRITICAL] 개인정보 블러 처리 확인';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "amount" bigint NOT NULL,
    "description" "text",
    "balance" bigint,
    "bank" "text",
    "raw_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sms_message_id" "uuid",
    "category" "text",
    "related_case_id" "uuid",
    "related_client" "text",
    "ai_confidence" numeric,
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['입금'::"text", '출금'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactions" IS '은행 SMS에서 파싱한 입출금 거래 내역';



COMMENT ON COLUMN "public"."transactions"."type" IS '거래 유형 (입금/출금)';



COMMENT ON COLUMN "public"."transactions"."amount" IS '거래 금액';



COMMENT ON COLUMN "public"."transactions"."description" IS '거래처/사유';



COMMENT ON COLUMN "public"."transactions"."balance" IS '거래 후 잔액';



COMMENT ON COLUMN "public"."transactions"."bank" IS '은행명';



COMMENT ON COLUMN "public"."transactions"."raw_message" IS '원본 SMS 메시지';



CREATE OR REPLACE VIEW "public"."unified_calendar" AS
 SELECT "ch"."id",
    'COURT_HEARING'::"text" AS "event_type",
    '법원기일'::"text" AS "event_type_kr",
    ("ch"."hearing_type")::"text" AS "event_subtype",
    "concat"('(', COALESCE("ch"."scourt_type_raw",
        CASE ("ch"."hearing_type")::"text"
            WHEN 'HEARING_MAIN'::"text" THEN '변론기일'::"text"
            WHEN 'HEARING_INTERIM'::"text" THEN '중간심문'::"text"
            WHEN 'HEARING_MEDIATION'::"text" THEN '조정기일'::"text"
            WHEN 'HEARING_INVESTIGATION'::"text" THEN '심문기일'::"text"
            WHEN 'HEARING_PARENTING'::"text" THEN '양육상담'::"text"
            WHEN 'HEARING_JUDGMENT'::"text" THEN '선고기일'::"text"
            WHEN 'HEARING_LAWYER_MEETING'::"text" THEN '변호사 미팅'::"text"
            ELSE ("ch"."hearing_type")::"text"
        END), ') ',
        CASE
            WHEN (("client_party"."party_name" IS NOT NULL) AND ("opponent_party"."party_name" IS NOT NULL)) THEN ((((("client_party"."party_name" || 'v'::"text") || "opponent_party"."party_name") || '('::"text") || COALESCE("lc"."case_name", ''::"text")) || ')'::"text")
            WHEN ("client_party"."party_name" IS NOT NULL) THEN ((("client_party"."party_name" || '('::"text") || COALESCE("lc"."case_name", ''::"text")) || ')'::"text")
            ELSE COALESCE("lc"."case_name", ("ch"."case_number")::"text", '미지정 사건'::"text")
        END) AS "title",
    COALESCE("lc"."case_name", ("ch"."case_number")::"text") AS "case_name",
    "date"(("ch"."hearing_date" AT TIME ZONE 'Asia/Seoul'::"text")) AS "event_date",
    "to_char"(("ch"."hearing_date" AT TIME ZONE 'Asia/Seoul'::"text"), 'HH24:MI'::"text") AS "event_time",
    "ch"."hearing_date" AS "event_datetime",
    (COALESCE("ch"."case_number", ("lc"."court_case_number")::character varying))::"text" AS "reference_id",
    (
        CASE
            WHEN (("lc"."court_name" IS NOT NULL) AND ("ch"."location" IS NOT NULL)) THEN ((("lc"."court_name" || ' '::"text") || ("ch"."location")::"text"))::character varying
            WHEN ("lc"."court_name" IS NOT NULL) THEN ("lc"."court_name")::character varying
            ELSE "ch"."location"
        END)::"text" AS "location",
    "ch"."notes" AS "description",
    ("ch"."status")::"text" AS "status",
    ("ch"."case_id")::"text" AS "case_id",
    ("lc"."tenant_id")::"text" AS "tenant_id",
    (COALESCE("ch"."attending_lawyer_id", "lc"."assigned_to"))::"text" AS "attending_lawyer_id",
    (COALESCE("tm_attending"."display_name", "tm_assigned"."display_name"))::"text" AS "attending_lawyer_name",
    "ch"."scourt_type_raw",
    "ch"."scourt_result_raw",
    "ch"."hearing_sequence",
        CASE
            WHEN ("to_char"(("ch"."hearing_date" AT TIME ZONE 'Asia/Seoul'::"text"), 'HH24:MI'::"text") = '00:00'::"text") THEN 1
            ELSE 2
        END AS "sort_priority",
    NULL::"uuid" AS "party_id",
    NULL::"text" AS "party_side",
    NULL::"text" AS "deadline_party_name",
    NULL::"text" AS "deadline_party_type_label",
    "ch"."video_participant_side",
        CASE
            WHEN ((("client_party"."party_type_label")::"text" ~~* '%원고%'::"text") OR (("client_party"."party_type_label")::"text" ~~* '%청구인%'::"text") OR (("client_party"."party_type_label")::"text" ~~* '%신청인%'::"text")) THEN 'plaintiff_side'::"text"
            WHEN ((("client_party"."party_type_label")::"text" ~~* '%피고%'::"text") OR (("client_party"."party_type_label")::"text" ~~* '%상대방%'::"text") OR (("client_party"."party_type_label")::"text" ~~* '%피신청인%'::"text")) THEN 'defendant_side'::"text"
            ELSE NULL::"text"
        END AS "our_client_side"
   FROM ((((("public"."court_hearings" "ch"
     LEFT JOIN "public"."legal_cases" "lc" ON (("ch"."case_id" = "lc"."id")))
     LEFT JOIN "public"."tenant_members" "tm_attending" ON (("ch"."attending_lawyer_id" = "tm_attending"."id")))
     LEFT JOIN "public"."tenant_members" "tm_assigned" ON (("lc"."assigned_to" = "tm_assigned"."id")))
     LEFT JOIN LATERAL ( SELECT "cp"."party_name",
            "cp"."party_type_label"
           FROM "public"."case_parties" "cp"
          WHERE (("cp"."case_id" = "ch"."case_id") AND ("cp"."is_our_client" = true))
          ORDER BY "cp"."is_primary" DESC NULLS LAST, "cp"."party_order"
         LIMIT 1) "client_party" ON (true))
     LEFT JOIN LATERAL ( SELECT "cp"."party_name"
           FROM "public"."case_parties" "cp"
          WHERE (("cp"."case_id" = "ch"."case_id") AND ("cp"."is_our_client" = false))
          ORDER BY "cp"."is_primary" DESC NULLS LAST, "cp"."party_order"
         LIMIT 1) "opponent_party" ON (true))
UNION ALL
 SELECT "cd"."id",
    'DEADLINE'::"text" AS "event_type",
    '데드라인'::"text" AS "event_type_kr",
    ("cd"."deadline_type")::"text" AS "event_subtype",
    "concat"(
        CASE
            WHEN (("cd"."party_side")::"text" = 'plaintiff_side'::"text") THEN '[기한/원고] '::"text"
            WHEN (("cd"."party_side")::"text" = 'defendant_side'::"text") THEN '[기한/피고] '::"text"
            ELSE '[기한] '::"text"
        END,
        CASE ("cd"."deadline_type")::"text"
            WHEN 'DL_APPEAL'::"text" THEN '항소기간'::"text"
            WHEN 'DL_FAMILY_NONLIT'::"text" THEN '항고기간'::"text"
            WHEN 'DL_CRIMINAL_APPEAL'::"text" THEN '형사항소기간'::"text"
            WHEN 'DL_IMM_APPEAL'::"text" THEN '즉시항고기간'::"text"
            WHEN 'DL_APPEAL_BRIEF'::"text" THEN '항소이유서제출기한'::"text"
            WHEN 'DL_MEDIATION_OBJ'::"text" THEN '조정이의기간'::"text"
            WHEN 'DL_RETRIAL'::"text" THEN '재심기한'::"text"
            WHEN 'DL_PAYMENT_ORDER'::"text" THEN '지급명령이의기간'::"text"
            ELSE ("cd"."deadline_type")::"text"
        END, ' - ',
        CASE
            WHEN (("client_party"."party_name" IS NOT NULL) AND ("opponent_party"."party_name" IS NOT NULL)) THEN ((((("client_party"."party_name" || 'v'::"text") || "opponent_party"."party_name") || '('::"text") || COALESCE("lc"."case_name", ''::"text")) || ')'::"text")
            WHEN ("client_party"."party_name" IS NOT NULL) THEN ((("client_party"."party_name" || '('::"text") || COALESCE("lc"."case_name", ''::"text")) || ')'::"text")
            ELSE COALESCE("lc"."case_name", ("cd"."case_number")::"text", '미지정 사건'::"text")
        END) AS "title",
    COALESCE("lc"."case_name", ("cd"."case_number")::"text") AS "case_name",
    "cd"."deadline_date" AS "event_date",
    '00:00'::"text" AS "event_time",
    ((("cd"."deadline_date")::"text" || ' 00:00:00'::"text"))::timestamp without time zone AS "event_datetime",
    (COALESCE("cd"."case_number", ("lc"."court_case_number")::character varying))::"text" AS "reference_id",
    NULL::"text" AS "location",
    "cd"."notes" AS "description",
    ("cd"."status")::"text" AS "status",
    ("cd"."case_id")::"text" AS "case_id",
    ("lc"."tenant_id")::"text" AS "tenant_id",
    ("lc"."assigned_to")::"text" AS "attending_lawyer_id",
    ("tm_assigned"."display_name")::"text" AS "attending_lawyer_name",
    NULL::"text" AS "scourt_type_raw",
    NULL::"text" AS "scourt_result_raw",
    NULL::integer AS "hearing_sequence",
    1 AS "sort_priority",
    "cd"."party_id",
    ("cd"."party_side")::"text" AS "party_side",
    "deadline_party"."party_name" AS "deadline_party_name",
    ("deadline_party"."party_type_label")::"text" AS "deadline_party_type_label",
    NULL::"text" AS "video_participant_side",
    NULL::"text" AS "our_client_side"
   FROM ((((("public"."case_deadlines" "cd"
     LEFT JOIN "public"."legal_cases" "lc" ON (("cd"."case_id" = "lc"."id")))
     LEFT JOIN "public"."tenant_members" "tm_assigned" ON (("lc"."assigned_to" = "tm_assigned"."id")))
     LEFT JOIN "public"."case_parties" "deadline_party" ON (("cd"."party_id" = "deadline_party"."id")))
     LEFT JOIN LATERAL ( SELECT "cp"."party_name"
           FROM "public"."case_parties" "cp"
          WHERE (("cp"."case_id" = "cd"."case_id") AND ("cp"."is_our_client" = true))
          ORDER BY "cp"."is_primary" DESC NULLS LAST, "cp"."party_order"
         LIMIT 1) "client_party" ON (true))
     LEFT JOIN LATERAL ( SELECT "cp"."party_name"
           FROM "public"."case_parties" "cp"
          WHERE (("cp"."case_id" = "cd"."case_id") AND ("cp"."is_our_client" = false))
          ORDER BY "cp"."is_primary" DESC NULLS LAST, "cp"."party_order"
         LIMIT 1) "opponent_party" ON (true))
UNION ALL
 SELECT "c"."id",
    'CONSULTATION'::"text" AS "event_type",
    '상담'::"text" AS "event_type_kr",
    "c"."request_type" AS "event_subtype",
    ('(상담) '::"text" || "c"."name") AS "title",
    "c"."name" AS "case_name",
    "c"."preferred_date" AS "event_date",
    COALESCE("c"."preferred_time", '00:00'::"text") AS "event_time",
    ((((("c"."preferred_date")::"text" || ' '::"text") || COALESCE("c"."preferred_time", '00:00'::"text")) || ':00'::"text"))::timestamp without time zone AS "event_datetime",
    "c"."phone" AS "reference_id",
    NULL::"text" AS "location",
    "c"."message" AS "description",
    "c"."status",
    NULL::"text" AS "case_id",
    ("c"."tenant_id")::"text" AS "tenant_id",
    NULL::"text" AS "attending_lawyer_id",
    NULL::"text" AS "attending_lawyer_name",
    NULL::"text" AS "scourt_type_raw",
    NULL::"text" AS "scourt_result_raw",
    NULL::integer AS "hearing_sequence",
        CASE
            WHEN (("c"."preferred_time" IS NULL) OR ("c"."preferred_time" = '00:00'::"text")) THEN 1
            ELSE 2
        END AS "sort_priority",
    NULL::"uuid" AS "party_id",
    NULL::"text" AS "party_side",
    NULL::"text" AS "deadline_party_name",
    NULL::"text" AS "deadline_party_type_label",
    NULL::"text" AS "video_participant_side",
    NULL::"text" AS "our_client_side"
   FROM "public"."consultations" "c"
  WHERE ("c"."preferred_date" IS NOT NULL);


ALTER VIEW "public"."unified_calendar" OWNER TO "postgres";


COMMENT ON VIEW "public"."unified_calendar" IS '법원기일, 데드라인, 상담 통합 캘린더 뷰 (당사자별 데드라인 + 화상기일 지원)';



CREATE OR REPLACE VIEW "public"."upcoming_hearings" AS
 SELECT "id",
    "case_number",
    "hearing_type",
    "hearing_date",
    "location",
    "judge_name",
    "notes",
    "status",
    "created_at",
    "updated_at",
    ("date"("hearing_date") - CURRENT_DATE) AS "days_until_hearing"
   FROM "public"."court_hearings" "ch"
  WHERE (("status" = 'SCHEDULED'::"public"."hearing_status") AND ("hearing_date" >= "now"()))
  ORDER BY "hearing_date";


ALTER VIEW "public"."upcoming_hearings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."urgent_deadlines" AS
 SELECT "cd"."id",
    "cd"."case_number",
    "cd"."deadline_type",
    "cd"."trigger_date",
    "cd"."deadline_date",
    "cd"."deadline_datetime",
    "cd"."notes",
    "cd"."status",
    "cd"."completed_at",
    "cd"."created_at",
    "cd"."updated_at",
    "dt"."name" AS "deadline_type_name",
    ("cd"."deadline_date" - CURRENT_DATE) AS "days_until_deadline"
   FROM ("public"."case_deadlines" "cd"
     JOIN "public"."deadline_types" "dt" ON (("cd"."deadline_type" = "dt"."type")))
  WHERE (("cd"."status" = 'PENDING'::"public"."deadline_status") AND ("cd"."deadline_date" >= CURRENT_DATE))
  ORDER BY "cd"."deadline_date";


ALTER VIEW "public"."urgent_deadlines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "memory_type" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "importance" double precision DEFAULT 0.5,
    "access_count" integer DEFAULT 0,
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_memory_importance_check" CHECK ((("importance" >= (0)::double precision) AND ("importance" <= (1)::double precision))),
    CONSTRAINT "user_memory_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['profile'::"text", 'preference'::"text", 'pattern'::"text", 'entity'::"text"])))
);


ALTER TABLE "public"."user_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_memory" IS 'Gateway V3: 사용자별 장기 메모리 저장';



COMMENT ON COLUMN "public"."user_memory"."memory_type" IS 'profile: 사용자 프로필, preference: 선호도, pattern: 대화 패턴, entity: 자주 사용하는 엔티티';



COMMENT ON COLUMN "public"."user_memory"."importance" IS '메모리 중요도 (0-1), 높을수록 자주 참조';



COMMENT ON COLUMN "public"."user_memory"."access_count" IS '메모리 접근 횟수, 자주 사용되는 메모리 파악용';



CREATE TABLE IF NOT EXISTS "public"."user_personas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "adjustments" "jsonb" DEFAULT '{"empathy": 0.5, "formality": 0, "verbosity": 0, "emojiUsage": 0, "technicalLevel": 0.5}'::"jsonb" NOT NULL,
    "learned_patterns" "jsonb" DEFAULT '[]'::"jsonb",
    "feedback_history" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_personas" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_personas" IS 'V4 동적 페르소나 - SPDA 알고리즘';



COMMENT ON COLUMN "public"."user_personas"."adjustments" IS '페르소나 조정값: formality(-1~1), verbosity(-1~1), emojiUsage(0~1), empathy(0~1), technicalLevel(0~1)';



COMMENT ON COLUMN "public"."user_personas"."learned_patterns" IS '학습된 사용자 표현 패턴';



CREATE TABLE IF NOT EXISTS "public"."user_profiles_v4" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "preferred_style" "text",
    "domains" "jsonb" DEFAULT '{}'::"jsonb",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles_v4" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles_v4" IS 'V4 사용자 프로필 - 도메인별 역할 및 선호도';



COMMENT ON COLUMN "public"."user_profiles_v4"."domains" IS '도메인별 역할: {"legal": "operator", "personal": "user"}';



CREATE TABLE IF NOT EXISTS "public"."users_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_profiles_role_check" CHECK (("role" = ANY (ARRAY['master'::"text", 'operator'::"text", 'counselor'::"text", 'client'::"text"])))
);


ALTER TABLE "public"."users_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."users_profiles" IS '사내 사용자 프로필 (관리자, 직원)';



CREATE OR REPLACE VIEW "public"."v_notification_statistics" AS
 SELECT "date"("created_at") AS "date",
    "channel",
    "count"(*) AS "total_sent",
    "sum"(
        CASE
            WHEN ("status" = 'delivered'::"text") THEN 1
            ELSE 0
        END) AS "delivered",
    "sum"(
        CASE
            WHEN ("status" = 'sent'::"text") THEN 1
            ELSE 0
        END) AS "sent",
    "sum"(
        CASE
            WHEN ("status" = 'failed'::"text") THEN 1
            ELSE 0
        END) AS "failed",
    "sum"(COALESCE("cost", (0)::numeric)) AS "total_cost"
   FROM "public"."notification_logs"
  GROUP BY ("date"("created_at")), "channel"
  ORDER BY ("date"("created_at")) DESC;


ALTER VIEW "public"."v_notification_statistics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_recent_notification_activity" AS
 SELECT "nl"."id",
    "nl"."created_at",
    "nl"."recipient_name",
    "nl"."recipient_phone",
    "nl"."channel",
    "nl"."message_type",
    "nl"."status",
    "nl"."cost",
    "nl"."related_type",
    "nt"."name" AS "template_name",
    "nt"."category" AS "template_category"
   FROM ("public"."notification_logs" "nl"
     LEFT JOIN "public"."notification_templates" "nt" ON (("nl"."template_id" = "nt"."id")))
  ORDER BY "nl"."created_at" DESC
 LIMIT 100;


ALTER VIEW "public"."v_recent_notification_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "source" "text" NOT NULL,
    "title" "text",
    "category" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "fts_content" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", COALESCE("content", ''::"text"))) STORED,
    "normalized_content" "text",
    "section_path" "text",
    "hierarchy_level" integer DEFAULT 0,
    "parent_chunk_id" "uuid",
    "chunk_index" integer DEFAULT 0,
    "total_chunks" integer DEFAULT 1,
    "case_id" "uuid",
    "doc_type" "text",
    "embedding" "public"."vector"(2000),
    "proof_purpose" "text",
    "analysis_status" "text" DEFAULT 'pending'::"text",
    "evidence_number" "text",
    "is_deleted" boolean DEFAULT false,
    "is_parent" boolean DEFAULT false,
    "parent_id" "uuid",
    CONSTRAINT "chk_documents_analysis_status" CHECK ((("analysis_status" IS NULL) OR ("analysis_status" = ANY (ARRAY['pending'::"text", 'analyzed'::"text", 'skipped'::"text"])))),
    CONSTRAINT "chk_documents_doc_type" CHECK ((("doc_type" IS NULL) OR ("doc_type" = ANY (ARRAY['ruling'::"text", 'brief'::"text", 'evidence'::"text", 'statute'::"text", 'book'::"text", 'paper'::"text", 'internal'::"text", 'legal_book'::"text", 'legal_paper'::"text", 'case_law'::"text"])))),
    CONSTRAINT "chk_documents_domain" CHECK (("domain" = ANY (ARRAY['legal'::"text", 'marketing'::"text", 'operations'::"text", 'meta'::"text"])))
);


ALTER TABLE "the0"."documents" OWNER TO "postgres";


COMMENT ON COLUMN "the0"."documents"."is_parent" IS 'Parent 청크 여부 (legal_book, legal_paper)';



COMMENT ON COLUMN "the0"."documents"."parent_id" IS 'Child가 참조하는 Parent의 DB ID';



COMMENT ON CONSTRAINT "chk_documents_doc_type" ON "the0"."documents" IS '문서 유형 제약 조건';



CREATE OR REPLACE VIEW "the0"."active_documents" AS
 SELECT "id",
    "content",
    "domain",
    "source",
    "title",
    "category",
    "metadata",
    "created_at",
    "updated_at",
    "fts_content",
    "normalized_content",
    "section_path",
    "hierarchy_level",
    "parent_chunk_id",
    "chunk_index",
    "total_chunks",
    "case_id",
    "doc_type",
    "embedding",
    "proof_purpose",
    "analysis_status",
    "evidence_number",
    "is_deleted"
   FROM "the0"."documents"
  WHERE (("is_deleted" = false) OR ("is_deleted" IS NULL));


ALTER VIEW "the0"."active_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "related_case_id" "uuid",
    "related_pending_id" "uuid",
    "metadata" "jsonb",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "read_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['linkable_preservation'::"text", 'pending_review'::"text", 'batch_complete'::"text", 'error_alert'::"text"])))
);


ALTER TABLE "the0"."admin_notifications" OWNER TO "postgres";


COMMENT ON TABLE "the0"."admin_notifications" IS '관리자 알림 (연결 가능한 보전사건, 검토 필요 파일 등)';



COMMENT ON COLUMN "the0"."admin_notifications"."notification_type" IS '알림 유형: linkable_preservation(연결가능보전사건), pending_review(검토필요), batch_complete(배치완료), error_alert(에러)';



CREATE TABLE IF NOT EXISTS "the0"."ai_models" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "provider" "text" NOT NULL,
    "model_id" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "supports_tools" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "input_price_per_mtok" numeric(10,4) DEFAULT 0,
    "output_price_per_mtok" numeric(10,4) DEFAULT 0,
    "pricing_updated_at" timestamp with time zone
);


ALTER TABLE "the0"."ai_models" OWNER TO "postgres";


COMMENT ON TABLE "the0"."ai_models" IS 'AI 모델 설정 - 어드민에서 관리';



COMMENT ON COLUMN "the0"."ai_models"."id" IS '모델 식별자 (claude, gpt4, gemini 등)';



COMMENT ON COLUMN "the0"."ai_models"."model_id" IS '실제 API에 전달되는 모델 ID';



COMMENT ON COLUMN "the0"."ai_models"."supports_tools" IS '도구/함수 호출 지원 여부. Claude, GPT, Gemini 모두 지원';



COMMENT ON COLUMN "the0"."ai_models"."settings" IS '모델별 설정 (temperature, max_tokens 등)';



CREATE TABLE IF NOT EXISTS "the0"."brief_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_version_id" "uuid" NOT NULL,
    "export_format" "text" NOT NULL,
    "file_path" "text",
    "file_size" integer,
    "exported_by" "uuid" NOT NULL,
    "exported_at" timestamp with time zone DEFAULT "now"(),
    "google_doc_id" "text",
    "google_doc_link" "text",
    "template_id" "uuid"
);


ALTER TABLE "the0"."brief_exports" OWNER TO "postgres";


COMMENT ON TABLE "the0"."brief_exports" IS '서면 내보내기 이력';



COMMENT ON COLUMN "the0"."brief_exports"."google_doc_id" IS 'Google Docs 문서 ID';



COMMENT ON COLUMN "the0"."brief_exports"."google_doc_link" IS 'Google Docs 공유 링크';



COMMENT ON COLUMN "the0"."brief_exports"."template_id" IS '사용된 템플릿 ID';



CREATE TABLE IF NOT EXISTS "the0"."brief_guidelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_type" "text" NOT NULL,
    "case_type" "text" NOT NULL,
    "guidelines" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."brief_guidelines" OWNER TO "postgres";


COMMENT ON TABLE "the0"."brief_guidelines" IS '사건 유형별 서면 작성 추가 지침';



CREATE TABLE IF NOT EXISTS "the0"."brief_inputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "brief_type" "text" NOT NULL,
    "user_request" "text" NOT NULL,
    "opponent_analysis" "jsonb",
    "lawyer_decisions" "jsonb",
    "style_options" "jsonb",
    "evidence_context" "jsonb",
    "our_claims" "jsonb",
    "additional_instructions" "text",
    "mode" "text" DEFAULT 'full'::"text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_hash" "text"
);


ALTER TABLE "the0"."brief_inputs" OWNER TO "postgres";


COMMENT ON TABLE "the0"."brief_inputs" IS '서면 생성 입력 스냅샷 - 재생성 워크플로우용';



COMMENT ON COLUMN "the0"."brief_inputs"."opponent_analysis" IS '상대방 서면 분석 결과 (OpponentBriefAnalysis JSON)';



COMMENT ON COLUMN "the0"."brief_inputs"."lawyer_decisions" IS '변호사 인부 선택 결과 (LawyerDecisionContext JSON)';



COMMENT ON COLUMN "the0"."brief_inputs"."style_options" IS '서면 스타일 옵션 (BriefStyleOptions JSON)';



COMMENT ON COLUMN "the0"."brief_inputs"."evidence_context" IS '사용된 증거 컨텍스트';



COMMENT ON COLUMN "the0"."brief_inputs"."content_hash" IS '입력 필드 해시 (중복 방지/캐시용)';



CREATE TABLE IF NOT EXISTS "the0"."brief_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "brief_type" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "current_stage" integer DEFAULT 1,
    "stage_status" "jsonb" DEFAULT '{"1": "pending", "2": "pending", "3": "pending", "4": "pending", "5": "pending"}'::"jsonb",
    "user_input" "jsonb",
    "selected_briefs" "jsonb",
    "fact_structure" "jsonb",
    "strategies" "jsonb",
    "selected_strategy" "text",
    "skeleton" "jsonb",
    "section_drafts" "jsonb",
    "critiques" "jsonb",
    "final_brief" "text",
    "final_version_id" "uuid",
    "models_used" "jsonb",
    "total_tokens" integer,
    "total_cost" numeric(10,4),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "brief_sessions_current_stage_check" CHECK ((("current_stage" >= 1) AND ("current_stage" <= 5)))
);


ALTER TABLE "the0"."brief_sessions" OWNER TO "postgres";


COMMENT ON TABLE "the0"."brief_sessions" IS '5단계 Professional Workflow 세션';



COMMENT ON COLUMN "the0"."brief_sessions"."fact_structure" IS 'Stage 1: RAG 자료 정리, 타임라인/증거 구조화';



COMMENT ON COLUMN "the0"."brief_sessions"."strategies" IS 'Stage 2: ToT로 생성된 3가지 전략';



COMMENT ON COLUMN "the0"."brief_sessions"."skeleton" IS 'Stage 3: 서면 뼈대 + 증거/판례 매핑';



COMMENT ON COLUMN "the0"."brief_sessions"."section_drafts" IS 'Stage 4: IRAC 기반 섹션별 작성';



COMMENT ON COLUMN "the0"."brief_sessions"."critiques" IS 'Stage 5: 적대적 비평 (상대방 변호사/까다로운 판사)';



CREATE TABLE IF NOT EXISTS "the0"."brief_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "structure" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "guidelines" "text"[] DEFAULT '{}'::"text"[],
    "samples" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "the0"."brief_templates" OWNER TO "postgres";


COMMENT ON TABLE "the0"."brief_templates" IS '서면 템플릿 (소장, 준비서면, 답변서 등)';



CREATE TABLE IF NOT EXISTS "the0"."brief_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "brief_type" "text" NOT NULL,
    "title" "text",
    "draft" "text" NOT NULL,
    "critique" "text",
    "refinement" "text",
    "final_version" "text",
    "selected_option" "text",
    "lawyer_notes" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "version" integer DEFAULT 1,
    "model_used" "text",
    "total_tokens" integer,
    "generation_time_ms" integer,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "critique_structured" "jsonb",
    "validation_result" "jsonb",
    "refinement_structured" "jsonb",
    "lawyer_feedback" "jsonb",
    "citation_validation" "jsonb" DEFAULT '{}'::"jsonb",
    "input_id" "uuid",
    "parent_version_id" "uuid",
    "regeneration_reason" "text",
    "edited_critique" "jsonb",
    "user_feedback" "jsonb",
    "stage_models" "jsonb",
    "google_doc_id" "text",
    "google_doc_link" "text"
);


ALTER TABLE "the0"."brief_versions" OWNER TO "postgres";


COMMENT ON TABLE "the0"."brief_versions" IS 'Self-Refining 서면 버전 관리';



COMMENT ON COLUMN "the0"."brief_versions"."draft" IS '1단계: AI 초안';



COMMENT ON COLUMN "the0"."brief_versions"."critique" IS '2단계: 자기 비평 (약점, 반론 가능성)';



COMMENT ON COLUMN "the0"."brief_versions"."refinement" IS '3단계: 개선안';



COMMENT ON COLUMN "the0"."brief_versions"."final_version" IS '변호사가 최종 확정한 버전';



COMMENT ON COLUMN "the0"."brief_versions"."selected_option" IS '선택 옵션: draft(원안), refinement(개선안), custom(직접수정)';



COMMENT ON COLUMN "the0"."brief_versions"."critique_structured" IS 'AI Critique 결과의 구조화된 JSON (legal_issues, opponent_risks, evidence_gaps, must_fix 등)';



COMMENT ON COLUMN "the0"."brief_versions"."validation_result" IS 'Citation Validator 결과 (isValid, unverifiedCitations, verifiedCount, totalCount, summary)';



COMMENT ON COLUMN "the0"."brief_versions"."refinement_structured" IS '구조화된 서면 JSON (StructuredBrief - title, sections, metadata)';



COMMENT ON COLUMN "the0"."brief_versions"."lawyer_feedback" IS '변호사 피드백 구조화 JSON (LawyerFeedback - selectedOption, overallScore, rejectReasons, improvements 등)';



COMMENT ON COLUMN "the0"."brief_versions"."citation_validation" IS '증거 인용 검증 결과 (isValid, usedEvidIds, invalidEvidIds 등)';



COMMENT ON COLUMN "the0"."brief_versions"."parent_version_id" IS '이전 버전 ID (재생성 시)';



COMMENT ON COLUMN "the0"."brief_versions"."regeneration_reason" IS '재생성 사유: critique_edit, model_change, additional_instruction, style_change';



COMMENT ON COLUMN "the0"."brief_versions"."edited_critique" IS '사용자가 수정한 크리틱 {must_fix, additional_instructions}';



COMMENT ON COLUMN "the0"."brief_versions"."user_feedback" IS '사용자 피드백 {rating, selected, note, timestamp}';



COMMENT ON COLUMN "the0"."brief_versions"."stage_models" IS '단계별 사용 모델 {draft, critique, refinement}';



COMMENT ON COLUMN "the0"."brief_versions"."google_doc_id" IS 'Google Docs 문서 ID';



COMMENT ON COLUMN "the0"."brief_versions"."google_doc_link" IS 'Google Docs 공유 링크';



CREATE TABLE IF NOT EXISTS "the0"."case_claim_norms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "norm_id" "uuid" NOT NULL,
    "relation_type" "text",
    "relevance" double precision DEFAULT 1.0,
    "note" "text",
    "source" "text" DEFAULT 'ai'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."case_claim_norms" OWNER TO "postgres";


COMMENT ON TABLE "the0"."case_claim_norms" IS '주장-법령 연결';



CREATE TABLE IF NOT EXISTS "the0"."case_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "claim_type" "text" NOT NULL,
    "claim_subtype" "text",
    "side" "text" NOT NULL,
    "current_content" "text" NOT NULL,
    "current_summary" "text",
    "current_embedding" "public"."vector"(1536),
    "counter_position" "text",
    "counter_rationale" "text",
    "importance_score" double precision DEFAULT 0.5,
    "mention_count" integer DEFAULT 1,
    "version_count" integer DEFAULT 1,
    "first_mentioned_at" timestamp with time zone DEFAULT "now"(),
    "last_mentioned_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."case_claims" OWNER TO "postgres";


COMMENT ON TABLE "the0"."case_claims" IS '쌍방 주장 관리 (ours/opponent/court)';



CREATE TABLE IF NOT EXISTS "the0"."case_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "issue_type" "text" NOT NULL,
    "issue_name" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "our_claimed_amount" numeric,
    "opponent_claimed_amount" numeric,
    "court_decided_amount" numeric,
    "our_position" "text",
    "our_position_detail" "text",
    "our_position_version" integer DEFAULT 1,
    "opponent_position" "text",
    "opponent_position_detail" "text",
    "is_position_decided" boolean DEFAULT false,
    "position_decided_at" timestamp with time zone,
    "importance_score" double precision DEFAULT 0.5,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."case_issues" OWNER TO "postgres";


COMMENT ON TABLE "the0"."case_issues" IS '사건별 쟁점 및 입장';



CREATE TABLE IF NOT EXISTS "the0"."case_judgments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "instance_level" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "judgment_date" "date",
    "awarded_amounts" "jsonb",
    "main_reasoning" "text"[],
    "accepted_claims" "uuid"[],
    "rejected_claims" "uuid"[],
    "weakness_analysis" "text",
    "appeal_points" "text"[],
    "source_document_id" "uuid",
    "judgment_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."case_judgments" OWNER TO "postgres";


COMMENT ON TABLE "the0"."case_judgments" IS '판결 분석 결과';



CREATE TABLE IF NOT EXISTS "the0"."case_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "case_number" "text",
    "plaintiff" "text",
    "defendant" "text",
    "client_role" "text",
    "case_summary" "text",
    "issues" "jsonb" DEFAULT '[]'::"jsonb",
    "timeline" "jsonb" DEFAULT '[]'::"jsonb",
    "briefs" "jsonb" DEFAULT '[]'::"jsonb",
    "evidence" "jsonb" DEFAULT '[]'::"jsonb",
    "last_document_date" "date",
    "document_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."case_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."case_type_issue_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_type" "text" NOT NULL,
    "issue_type" "text" NOT NULL,
    "issue_name" "text" NOT NULL,
    "is_required" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "position_options" "jsonb" DEFAULT '["admit", "deny", "partial"]'::"jsonb",
    "position_labels" "jsonb",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."case_type_issue_templates" OWNER TO "postgres";


COMMENT ON TABLE "the0"."case_type_issue_templates" IS '사건 유형별 쟁점 템플릿';



CREATE TABLE IF NOT EXISTS "the0"."case_types" (
    "code" "text" NOT NULL,
    "label_ko" "text" NOT NULL,
    "category" "text",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "the0"."case_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "tool_calls" "jsonb",
    "tool_call_id" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "model" "text",
    "provider" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text", 'tool'::"text"])))
);


ALTER TABLE "the0"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "case_id" "text",
    "title" "text",
    "summary" "text",
    "status" "text" DEFAULT 'active'::"text",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "message_count" integer DEFAULT 0,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'deleted'::"text"])))
);


ALTER TABLE "the0"."chat_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."citation_validation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_version_id" "uuid",
    "case_id" "uuid",
    "validation_type" "text" NOT NULL,
    "citation_count" integer DEFAULT 0,
    "valid_count" integer DEFAULT 0,
    "invalid_count" integer DEFAULT 0,
    "issues" "jsonb",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."citation_validation_logs" OWNER TO "postgres";


COMMENT ON TABLE "the0"."citation_validation_logs" IS '인용 검증 로그 (감사/디버깅용)';



CREATE TABLE IF NOT EXISTS "the0"."claim_change_types" (
    "code" "text" NOT NULL,
    "label_ko" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "the0"."claim_change_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."claim_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "span_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "strength" "text" DEFAULT 'medium'::"text",
    "citation_label" "text",
    "page_reference" "text",
    "relationship" "text",
    "source" "text" DEFAULT 'ai'::"text",
    "status" "text" DEFAULT 'proposed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."claim_evidence" OWNER TO "postgres";


COMMENT ON TABLE "the0"."claim_evidence" IS '주장-증거 연결 (4층) - 주장별 증거 매핑';



COMMENT ON COLUMN "the0"."claim_evidence"."role" IS 'supports: 지지, refutes: 반박, context: 맥락';



COMMENT ON COLUMN "the0"."claim_evidence"."strength" IS 'strong: 강함, medium: 보통, weak: 약함';



CREATE TABLE IF NOT EXISTS "the0"."claim_issues" (
    "claim_id" "uuid" NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "relevance" double precision DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."claim_issues" OWNER TO "postgres";


COMMENT ON TABLE "the0"."claim_issues" IS '주장-쟁점 연결';



CREATE TABLE IF NOT EXISTS "the0"."claim_subtypes" (
    "code" "text" NOT NULL,
    "label_ko" "text" NOT NULL,
    "group_type" "text",
    "issue_type" "text",
    "description" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "the0"."claim_subtypes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."claim_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "content" "text" NOT NULL,
    "summary" "text",
    "embedding" "public"."vector"(1536),
    "source_brief_id" "uuid",
    "change_type" "text",
    "change_note" "text",
    "evidence_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."claim_versions" OWNER TO "postgres";


COMMENT ON TABLE "the0"."claim_versions" IS '주장 변경 이력';



CREATE TABLE IF NOT EXISTS "the0"."claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "document_id" "uuid",
    "party" "text" NOT NULL,
    "claim_type" "text",
    "claim_text" "text" NOT NULL,
    "claim_summary" "text",
    "page_number" integer,
    "paragraph_number" integer,
    "status" "text" DEFAULT 'pending'::"text",
    "priority" integer DEFAULT 5,
    "extracted_at" timestamp with time zone DEFAULT "now"(),
    "extracted_by" "text" DEFAULT 'ai'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "content" "text",
    "source_document_id" "uuid",
    "page_reference" "text",
    "is_confirmed" boolean DEFAULT false,
    "is_addressed" boolean DEFAULT false,
    "ai_confidence" double precision,
    "ai_summary" "text",
    "created_by" "uuid",
    CONSTRAINT "chk_claims_claim_type" CHECK ((("claim_type" IS NULL) OR ("claim_type" = ANY (ARRAY['fact'::"text", 'legal'::"text", 'procedural'::"text"])))),
    CONSTRAINT "chk_claims_party" CHECK (("party" = ANY (ARRAY['plaintiff'::"text", 'defendant'::"text"]))),
    CONSTRAINT "chk_claims_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'addressed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "the0"."claims" OWNER TO "postgres";


COMMENT ON TABLE "the0"."claims" IS '서면에서 추출된 개별 주장 (상대방/우리측)';



COMMENT ON COLUMN "the0"."claims"."content" IS '주장 내용 (도구 호환용)';



COMMENT ON COLUMN "the0"."claims"."is_confirmed" IS '변호사 확인 여부';



COMMENT ON COLUMN "the0"."claims"."is_addressed" IS '대응 완료 여부';



COMMENT ON COLUMN "the0"."claims"."ai_confidence" IS 'AI 분석 확신도 (0-1)';



COMMENT ON COLUMN "the0"."claims"."ai_summary" IS 'AI가 요약한 주장 핵심';



COMMENT ON COLUMN "the0"."claims"."created_by" IS '생성자 (user_id)';



CREATE TABLE IF NOT EXISTS "the0"."collaboration_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "ai_version" "text" NOT NULL,
    "lawyer_version" "text" NOT NULL,
    "reason" "text",
    "feedback_category" "text",
    "edited_by" "uuid" NOT NULL,
    "edited_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."collaboration_history" OWNER TO "postgres";


COMMENT ON TABLE "the0"."collaboration_history" IS '변호사-AI 협업 이력 (수정 내용 추적)';



COMMENT ON COLUMN "the0"."collaboration_history"."target_type" IS '수정 대상 타입: claim, rebuttal, brief, strategy';



COMMENT ON COLUMN "the0"."collaboration_history"."feedback_category" IS '피드백 분류: style, content, legal, factual, other';



CREATE TABLE IF NOT EXISTS "the0"."confirmed_strategies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "issue" "text" NOT NULL,
    "strategy" "text" NOT NULL,
    "details" "text",
    "related_claim_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "related_evidence_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "confirmed_by" "uuid" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."confirmed_strategies" OWNER TO "postgres";


COMMENT ON TABLE "the0"."confirmed_strategies" IS '변호사가 확정한 사건 전략';



CREATE TABLE IF NOT EXISTS "the0"."context_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "summary_type" "text" NOT NULL,
    "level" integer NOT NULL,
    "reference_id" "uuid",
    "content" "text" NOT NULL,
    "token_count" integer,
    "source_ids" "uuid"[],
    "source_count" integer,
    "is_stale" boolean DEFAULT false,
    "last_source_update" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "the0"."context_summaries" OWNER TO "postgres";


COMMENT ON TABLE "the0"."context_summaries" IS '계층적 컨텍스트 요약 캐시';



COMMENT ON COLUMN "the0"."context_summaries"."level" IS '0: 사건 전체, 1: 쟁점별, 2: 주장별';



COMMENT ON COLUMN "the0"."context_summaries"."is_stale" IS '원본 데이터 변경 시 true로 설정됨';



CREATE TABLE IF NOT EXISTS "the0"."doc_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "brief_type" "text" NOT NULL,
    "drive_file_id" "text" NOT NULL,
    "drive_folder_id" "text",
    "placeholders" "jsonb" DEFAULT '[]'::"jsonb",
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."doc_templates" OWNER TO "postgres";


COMMENT ON TABLE "the0"."doc_templates" IS 'Google Docs 서면 템플릿 관리';



COMMENT ON COLUMN "the0"."doc_templates"."drive_file_id" IS 'Google Docs 템플릿 파일 ID';



COMMENT ON COLUMN "the0"."doc_templates"."placeholders" IS '템플릿 내 플레이스홀더 목록 (JSON 배열)';



CREATE TABLE IF NOT EXISTS "the0"."document_evidence_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_document_id" "uuid" NOT NULL,
    "evidence_document_id" "uuid",
    "evidence_number" "text" NOT NULL,
    "extracted_proof_purpose" "text",
    "context_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."document_evidence_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."draft_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_input_id" "uuid",
    "brief_session_id" "uuid",
    "case_id" "uuid",
    "issue_id" "uuid",
    "issue_type" "text",
    "issue_name" "text",
    "content" "text" NOT NULL,
    "summary" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "token_count" integer,
    "model" "text",
    "reasoning_strategy" "text",
    "chunk_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."draft_chunks" OWNER TO "postgres";


COMMENT ON TABLE "the0"."draft_chunks" IS 'Divide+Merge 패턴용 쟁점별 초안 청크';



COMMENT ON COLUMN "the0"."draft_chunks"."status" IS 'draft: 초안, reviewed: 검토됨, approved: 승인됨, merged: 병합됨';



CREATE TABLE IF NOT EXISTS "the0"."drafts_temp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "case_id" "uuid",
    "session_id" "text" NOT NULL,
    "draft_type" "text" DEFAULT 'chat'::"text" NOT NULL,
    "content" "text",
    "model_settings" "jsonb",
    "temp_upload_ids" "uuid"[],
    "citation_registry" "jsonb",
    "last_saved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "drafts_temp_draft_type_check" CHECK (("draft_type" = ANY (ARRAY['chat'::"text", 'brief'::"text", 'analysis'::"text"])))
);


ALTER TABLE "the0"."drafts_temp" OWNER TO "postgres";


COMMENT ON TABLE "the0"."drafts_temp" IS '서버측 임시 초안 저장 - 오토세이브';



CREATE TABLE IF NOT EXISTS "the0"."evidence_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "page_number" integer,
    "text" "text" NOT NULL,
    "ocr_status" "text",
    "language" "text" DEFAULT 'ko'::"text",
    "key_phrases" "text"[],
    "entities" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."evidence_documents" OWNER TO "postgres";


COMMENT ON TABLE "the0"."evidence_documents" IS '증거 문서 페이지 (2층) - OCR 텍스트';



CREATE TABLE IF NOT EXISTS "the0"."evidence_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "drive_file_id" "text",
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "party_side" "text",
    "exhibit_label" "text",
    "exhibit_number" integer,
    "doc_type" "text",
    "doc_name" "text",
    "doc_date" "date",
    "evidence_mode" "text" DEFAULT 'documentary'::"text",
    "fact_type" "text" DEFAULT 'direct'::"text",
    "admissibility_status" "text" DEFAULT 'undisputed'::"text",
    "authenticity_status" "text" DEFAULT 'unverified'::"text",
    "rag_status" "text" DEFAULT 'pending'::"text",
    "ai_summary" "text",
    "key_facts" "jsonb",
    "proof_purpose" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "evidence_files_party_side_check" CHECK (("party_side" = ANY (ARRAY['plaintiff'::"text", 'defendant'::"text", 'nonparty'::"text"])))
);


ALTER TABLE "the0"."evidence_files" OWNER TO "postgres";


COMMENT ON TABLE "the0"."evidence_files" IS '증거 파일 (1층) - 갑/을호증 메타데이터';



COMMENT ON COLUMN "the0"."evidence_files"."exhibit_label" IS '증거 라벨 (갑 제1호증)';



COMMENT ON COLUMN "the0"."evidence_files"."proof_purpose" IS '입증취지';



CREATE TABLE IF NOT EXISTS "the0"."evidence_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid",
    "document_id" "uuid",
    "link_type" "text",
    "relevance_score" double precision,
    "ai_analysis" "text",
    "excerpt" "text",
    "linked_at" timestamp with time zone DEFAULT "now"(),
    "linked_by" "text" DEFAULT 'ai'::"text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "case_id" "uuid",
    "rebuttal_id" "uuid",
    "evidence_type" "text" DEFAULT 'document'::"text",
    "evidence_number" "text",
    "evidence_title" "text",
    "relevance" "text",
    "page_reference" "text",
    "ai_strength" double precision,
    "ai_notes" "text",
    "evidence_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "storage_path" "text",
    "title" "text",
    "description" "text",
    "sub_number" "text",
    "party" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "drive_file_id" "text",
    CONSTRAINT "chk_evidence_links_type" CHECK (("link_type" = ANY (ARRAY['supports'::"text", 'refutes'::"text", 'related'::"text"])))
);


ALTER TABLE "the0"."evidence_links" OWNER TO "postgres";


COMMENT ON TABLE "the0"."evidence_links" IS '주장과 증거 문서의 연결 관계';



COMMENT ON COLUMN "the0"."evidence_links"."claim_id" IS '연결된 주장 ID (선택, null이면 사건 레벨 증거)';



COMMENT ON COLUMN "the0"."evidence_links"."case_id" IS '사건 ID';



COMMENT ON COLUMN "the0"."evidence_links"."rebuttal_id" IS '반박에 연결 (선택)';



COMMENT ON COLUMN "the0"."evidence_links"."evidence_type" IS '증거 유형 (document|testimony|material|inspection)';



COMMENT ON COLUMN "the0"."evidence_links"."evidence_number" IS '증거 번호 (갑 제1호증 등)';



COMMENT ON COLUMN "the0"."evidence_links"."evidence_title" IS '증거 제목';



COMMENT ON COLUMN "the0"."evidence_links"."relevance" IS '증거가 증명하는 사실';



COMMENT ON COLUMN "the0"."evidence_links"."ai_strength" IS '증거력 평가 (0-1)';



COMMENT ON COLUMN "the0"."evidence_links"."ai_notes" IS 'AI 분석 코멘트';



COMMENT ON COLUMN "the0"."evidence_links"."status" IS '증거 연결 상태: active (확정), pending (검토중), inactive (삭제)';



COMMENT ON COLUMN "the0"."evidence_links"."storage_path" IS '증거 파일 저장 경로';



COMMENT ON COLUMN "the0"."evidence_links"."title" IS '증거 제목 (약어)';



COMMENT ON COLUMN "the0"."evidence_links"."description" IS '증거 설명/입증취지';



COMMENT ON COLUMN "the0"."evidence_links"."sub_number" IS '호증 부번호 (1, 2 등)';



COMMENT ON COLUMN "the0"."evidence_links"."party" IS '증거 제출 당사자: plaintiff, defendant';



COMMENT ON COLUMN "the0"."evidence_links"."source" IS '증거 출처: manual, drive, api';



COMMENT ON COLUMN "the0"."evidence_links"."drive_file_id" IS 'Google Drive 파일 ID';



CREATE TABLE IF NOT EXISTS "the0"."evidence_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "target_entity" "text",
    "request_date" "date",
    "request_content" "text",
    "response_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "response_date" "date",
    "response_document_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evidence_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['document_production'::"text", 'inquiry'::"text", 'interrogatory'::"text", 'witness'::"text", 'appraisal'::"text"]))),
    CONSTRAINT "evidence_requests_response_status_check" CHECK (("response_status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'partial'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "the0"."evidence_requests" OWNER TO "postgres";


COMMENT ON TABLE "the0"."evidence_requests" IS '증거신청 및 회신 수집 현황 (evidence_links와 별개 목적)';



COMMENT ON COLUMN "the0"."evidence_requests"."request_type" IS '신청 유형: document_production(문서제출명령), inquiry(사실조회), interrogatory(당사자신문), witness(증인신문), appraisal(감정)';



COMMENT ON COLUMN "the0"."evidence_requests"."target_entity" IS '대상 기관/개인 (예: 국민은행, 삼성전자)';



COMMENT ON COLUMN "the0"."evidence_requests"."response_status" IS '회신 상태: pending(대기), received(완료), partial(일부), rejected(거부), expired(기한도과)';



CREATE TABLE IF NOT EXISTS "the0"."ingested_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drive_file_id" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "doc_type" "text" NOT NULL,
    "evidence_type" "text",
    "case_id" "uuid",
    "chunk_count" integer DEFAULT 0,
    "chunk_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "ingested_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_deleted" boolean DEFAULT false,
    "drive_modified_time" timestamp with time zone,
    "original_filename" "text"
);


ALTER TABLE "the0"."ingested_files" OWNER TO "postgres";


COMMENT ON TABLE "the0"."ingested_files" IS 'Google Drive에서 수집된 파일 기록';



COMMENT ON COLUMN "the0"."ingested_files"."original_filename" IS '원본 파일명 (전자소송 등, AI 분석용)';



CREATE TABLE IF NOT EXISTS "the0"."issue_position_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "our_position" "text",
    "our_position_detail" "text",
    "opponent_position" "text",
    "opponent_position_detail" "text",
    "our_claimed_amount" numeric,
    "opponent_claimed_amount" numeric,
    "change_reason" "text",
    "change_type" "text",
    "source_brief_id" "uuid",
    "source_session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "the0"."issue_position_versions" OWNER TO "postgres";


COMMENT ON TABLE "the0"."issue_position_versions" IS '쟁점 입장 변경 이력';



CREATE TABLE IF NOT EXISTS "the0"."legal_cases_ext" (
    "case_id" "uuid" NOT NULL,
    "case_key" "text",
    "title" "text",
    "our_role" "text",
    "case_state" "jsonb" DEFAULT '{"stage": "intake", "last_intent": null, "current_task": null, "last_brief_date": null, "last_brief_type": null, "summary_for_lawyer": null, "next_recommended_step": null}'::"jsonb",
    "brief_statuses" "jsonb" DEFAULT '{"answer": {"exists": false}, "complaint": {"exists": false}, "prep_briefs": [], "appeal_notice": {"exists": false}, "appeal_reason": {"exists": false}}'::"jsonb",
    "strategy_state" "jsonb" DEFAULT '{"notes": [], "objective": null, "judge_attitude": null, "internal_targets": {}}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "legal_cases_ext_our_role_check" CHECK (("our_role" = ANY (ARRAY['plaintiff'::"text", 'defendant'::"text", 'nonparty'::"text"])))
);


ALTER TABLE "the0"."legal_cases_ext" OWNER TO "postgres";


COMMENT ON TABLE "the0"."legal_cases_ext" IS 'AI 에이전트용 사건 확장 정보 (Long-term Memory)';



COMMENT ON COLUMN "the0"."legal_cases_ext"."case_state" IS '사건 단계, 현재 작업, 마지막 서면 등 상태 정보';



COMMENT ON COLUMN "the0"."legal_cases_ext"."brief_statuses" IS '서면별 제출 상태 (소장/답변서/준비서면)';



COMMENT ON COLUMN "the0"."legal_cases_ext"."strategy_state" IS '내부 전략, 판사 평가, 협상 한도 등';



CREATE TABLE IF NOT EXISTS "the0"."legal_norms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "norm_type" "text" NOT NULL,
    "code" "text",
    "law_name" "text",
    "article" "text",
    "paragraph" "text",
    "court" "text",
    "case_number" "text",
    "decision_date" "date",
    "title" "text",
    "summary" "text",
    "full_text" "text",
    "tags" "text"[],
    "embedding" "public"."vector"(1536),
    "source_url" "text",
    "source_doc_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."legal_norms" OWNER TO "postgres";


COMMENT ON TABLE "the0"."legal_norms" IS '법령 및 판례 데이터베이스';



CREATE TABLE IF NOT EXISTS "the0"."legal_synonyms" (
    "id" integer NOT NULL,
    "term" "text" NOT NULL,
    "synonyms" "text"[] NOT NULL,
    "domain" "text" DEFAULT 'legal'::"text"
);


ALTER TABLE "the0"."legal_synonyms" OWNER TO "postgres";


COMMENT ON TABLE "the0"."legal_synonyms" IS '법률 용어 동의어 사전';



CREATE SEQUENCE IF NOT EXISTS "the0"."legal_synonyms_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "the0"."legal_synonyms_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "the0"."legal_synonyms_id_seq" OWNED BY "the0"."legal_synonyms"."id";



CREATE TABLE IF NOT EXISTS "the0"."norm_relation_types" (
    "code" "text" NOT NULL,
    "label_ko" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "the0"."norm_relation_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."opponent_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "brief_type" "text" NOT NULL,
    "party" "text" NOT NULL,
    "filed_date" "date",
    "content" "text" NOT NULL,
    "analysis" "jsonb" NOT NULL,
    "claims" "jsonb" NOT NULL,
    "summary" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "opponent_briefs_party_check" CHECK (("party" = ANY (ARRAY['plaintiff'::"text", 'defendant'::"text"])))
);


ALTER TABLE "the0"."opponent_briefs" OWNER TO "postgres";


COMMENT ON TABLE "the0"."opponent_briefs" IS '상대방 서면 분석 결과 저장';



COMMENT ON COLUMN "the0"."opponent_briefs"."analysis" IS '전체 분석 결과 (OpponentBriefAnalysis)';



COMMENT ON COLUMN "the0"."opponent_briefs"."claims" IS 'AI가 추출한 논점 테이블 (OpponentClaim 배열)';



CREATE TABLE IF NOT EXISTS "the0"."pending_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drive_file_id" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "mime_type" "text",
    "suggested_case_name" "text",
    "suggested_parties" "jsonb",
    "suggested_case_type" "text",
    "classification_details" "jsonb",
    "confidence" numeric(3,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "linked_case_id" "uuid",
    "processed_at" timestamp with time zone,
    "processed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pending_reason" "text" DEFAULT 'new_case'::"text",
    "related_case_type" "text",
    "candidate_case_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    CONSTRAINT "pending_files_pending_reason_check" CHECK (("pending_reason" = ANY (ARRAY['new_case'::"text", 'client_role_required'::"text", 'main_case_required'::"text", 'related_case_detected'::"text", 'multiple_case_candidates'::"text", 'low_confidence'::"text"]))),
    CONSTRAINT "pending_files_related_case_type_check" CHECK (("related_case_type" = ANY (ARRAY['appeal'::"text", 'supreme'::"text", 'transfer'::"text", 'mediation'::"text", 'counterclaim'::"text"]))),
    CONSTRAINT "pending_files_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'linked'::"text", 'rejected'::"text"])))
);


ALTER TABLE "the0"."pending_files" OWNER TO "postgres";


COMMENT ON TABLE "the0"."pending_files" IS '새 사건 파일 대기 테이블 - 사용자 확인 후 처리';



COMMENT ON COLUMN "the0"."pending_files"."suggested_parties" IS 'AI가 추정한 당사자 정보 JSON: { plaintiff, defendant }';



COMMENT ON COLUMN "the0"."pending_files"."classification_details" IS 'AI 분류 상세 결과 JSON';



COMMENT ON COLUMN "the0"."pending_files"."pending_reason" IS '대기 이유: new_case(새사건), client_role_required(원피고구분), main_case_required(본안연결), related_case_detected(관련사건감지), multiple_case_candidates(동명이인), low_confidence(낮은신뢰도)';



COMMENT ON COLUMN "the0"."pending_files"."related_case_type" IS '관련 사건 유형: appeal(항소), supreme(상고), transfer(이송), mediation(조정), counterclaim(반소)';



COMMENT ON COLUMN "the0"."pending_files"."candidate_case_ids" IS '후보 사건 ID 배열 (동명이인, 관련 사건 추천용)';



CREATE TABLE IF NOT EXISTS "the0"."pipeline_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "text" NOT NULL,
    "filename" "text",
    "mime_type" "text",
    "case_id" "uuid",
    "suggested_doc_type" "text",
    "suggested_case_type" "text",
    "suggested_evidence_type" "text",
    "suggested_party" "text",
    "confidence" numeric(3,2) DEFAULT 0,
    "reason" "text" NOT NULL,
    "classification_details" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "modifications" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "pipeline_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'modified'::"text"])))
);


ALTER TABLE "the0"."pipeline_reviews" OWNER TO "postgres";


COMMENT ON TABLE "the0"."pipeline_reviews" IS '파일 처리 파이프라인 검토 대기 항목';



COMMENT ON COLUMN "the0"."pipeline_reviews"."file_id" IS 'Google Drive 파일 ID';



COMMENT ON COLUMN "the0"."pipeline_reviews"."confidence" IS 'AI 분류 신뢰도 (0.00-1.00)';



COMMENT ON COLUMN "the0"."pipeline_reviews"."reason" IS '검토가 필요한 이유';



COMMENT ON COLUMN "the0"."pipeline_reviews"."classification_details" IS '전체 분류 결과 JSON';



COMMENT ON COLUMN "the0"."pipeline_reviews"."modifications" IS '사용자 수정 내용 JSON';



CREATE TABLE IF NOT EXISTS "the0"."precedent_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_number" "text" NOT NULL,
    "court" "text",
    "decision_date" "text",
    "case_type" "text",
    "summary" "text",
    "key_points" "text"[],
    "source" "text" DEFAULT 'law_api'::"text",
    "verified" boolean DEFAULT false,
    "raw_response" "jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."precedent_cache" OWNER TO "postgres";


COMMENT ON TABLE "the0"."precedent_cache" IS '판례 검증을 위한 캐시 테이블 (법제처 API 결과 저장)';



CREATE TABLE IF NOT EXISTS "the0"."prompt_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "feedback_type" "text" NOT NULL,
    "feedback_content" "text" NOT NULL,
    "suggested_content" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_by" "uuid",
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone
);


ALTER TABLE "the0"."prompt_feedback" OWNER TO "postgres";


COMMENT ON TABLE "the0"."prompt_feedback" IS '프롬프트 개선 피드백';



CREATE TABLE IF NOT EXISTS "the0"."prompt_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prompt_id" "uuid" NOT NULL,
    "previous_content" "text" NOT NULL,
    "previous_version" integer NOT NULL,
    "change_reason" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."prompt_history" OWNER TO "postgres";


COMMENT ON TABLE "the0"."prompt_history" IS '프롬프트 변경 이력';



CREATE TABLE IF NOT EXISTS "the0"."prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "domain" "text" NOT NULL,
    "name" "text" NOT NULL,
    "content" "text" NOT NULL,
    "description" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "variables" "text"[],
    "tags" "text"[],
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'general'::"text"
);


ALTER TABLE "the0"."prompts" OWNER TO "postgres";


COMMENT ON TABLE "the0"."prompts" IS '프롬프트 저장 및 버전 관리';



COMMENT ON COLUMN "the0"."prompts"."category" IS '프롬프트 카테고리: general, brief_template, analysis, style';



CREATE TABLE IF NOT EXISTS "the0"."reasoning_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "brief_session_id" "uuid",
    "complexity_score" "jsonb",
    "selected_strategy" "text",
    "selected_model" "text",
    "selection_reason" "text",
    "estimated_tokens" integer,
    "actual_tokens" integer,
    "estimated_cost" numeric(10,4),
    "actual_cost" numeric(10,4),
    "was_downgraded" boolean DEFAULT false,
    "downgrade_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."reasoning_logs" OWNER TO "postgres";


COMMENT ON TABLE "the0"."reasoning_logs" IS '추론 전략 선택 로그 (Route-To-Reason)';



COMMENT ON COLUMN "the0"."reasoning_logs"."was_downgraded" IS '예산 제약으로 다운그레이드되었는지 여부';



CREATE TABLE IF NOT EXISTS "the0"."rebuttals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "rebuttal_type" "text",
    "rebuttal_text" "text" NOT NULL,
    "supporting_evidence" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "version" integer DEFAULT 1,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "generated_by" "text" DEFAULT 'ai'::"text",
    "lawyer_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "case_id" "uuid",
    "content" "text",
    "strategy" "text",
    "evidence_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "precedent_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "statute_refs" "text"[] DEFAULT '{}'::"text"[],
    "is_draft" boolean DEFAULT true,
    "is_confirmed" boolean DEFAULT false,
    CONSTRAINT "chk_rebuttals_status" CHECK (("status" = ANY (ARRAY['draft'::"text", 'reviewed'::"text", 'approved'::"text", 'used'::"text"])))
);


ALTER TABLE "the0"."rebuttals" OWNER TO "postgres";


COMMENT ON TABLE "the0"."rebuttals" IS 'AI 생성 반박 내용 (변호사 검토용)';



COMMENT ON COLUMN "the0"."rebuttals"."case_id" IS '사건 ID (직접 참조)';



COMMENT ON COLUMN "the0"."rebuttals"."content" IS '반박 내용';



COMMENT ON COLUMN "the0"."rebuttals"."strategy" IS '반박 전략 요약';



COMMENT ON COLUMN "the0"."rebuttals"."evidence_ids" IS '연결된 증거 ID 배열';



COMMENT ON COLUMN "the0"."rebuttals"."precedent_ids" IS '인용할 판례 ID 배열';



COMMENT ON COLUMN "the0"."rebuttals"."statute_refs" IS '관련 법령 조문 배열';



COMMENT ON COLUMN "the0"."rebuttals"."is_draft" IS '초안 여부';



COMMENT ON COLUMN "the0"."rebuttals"."is_confirmed" IS '변호사 확인 여부';



CREATE TABLE IF NOT EXISTS "the0"."statute_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "law_name" "text" NOT NULL,
    "article_number" "text" NOT NULL,
    "paragraph" "text",
    "article_title" "text",
    "article_content" "text",
    "effective_date" "text",
    "source" "text" DEFAULT 'law_api'::"text",
    "verified" boolean DEFAULT false,
    "raw_response" "jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "the0"."statute_cache" OWNER TO "postgres";


COMMENT ON TABLE "the0"."statute_cache" IS '법령 조문 검증을 위한 캐시 테이블';



CREATE TABLE IF NOT EXISTS "the0"."temp_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "case_id" "uuid",
    "session_id" "text",
    "extracted_text" "text",
    "analysis_result" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "confirmed_at" timestamp with time zone,
    "confirmed_doc_type" "text",
    "confirmed_document_id" "uuid",
    "confirmed_evidence_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_drive_file_id" "text",
    CONSTRAINT "temp_uploads_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'expired'::"text", 'deleted'::"text"])))
);


ALTER TABLE "the0"."temp_uploads" OWNER TO "postgres";


COMMENT ON TABLE "the0"."temp_uploads" IS '임시 파일 업로드 - 분류 확정 전 대기 상태';



COMMENT ON COLUMN "the0"."temp_uploads"."confirmed_drive_file_id" IS '확정된 Google Drive 파일 ID';



CREATE TABLE IF NOT EXISTS "the0"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    "full_name" "text",
    "invited_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "accepted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    CONSTRAINT "user_invitations_role_check" CHECK (("role" = ANY (ARRAY['master'::"text", 'operator'::"text", 'counselor'::"text", 'client'::"text"]))),
    CONSTRAINT "user_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "the0"."user_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."user_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "display_name" "text",
    "avatar_url" "text",
    "phone" "text",
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    "organization_id" "uuid",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['master'::"text", 'operator'::"text", 'counselor'::"text", 'client'::"text"])))
);


ALTER TABLE "the0"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "the0"."users_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "full_name" "text",
    "display_name" "text",
    "avatar_url" "text",
    "phone" "text",
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    "organization_id" "uuid",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_profiles_role_check" CHECK (("role" = ANY (ARRAY['master'::"text", 'operator'::"text", 'counselor'::"text", 'client'::"text"])))
);


ALTER TABLE "the0"."users_profiles" OWNER TO "postgres";


COMMENT ON TABLE "the0"."users_profiles" IS '사용자 프로필 테이블 - 역할: master, operator, counselor, client';



CREATE TABLE IF NOT EXISTS "the0"."work_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "session_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "plan" "jsonb" DEFAULT '{"goal": null, "approach": null, "estimated_tasks": 0}'::"jsonb",
    "status" "text" DEFAULT 'planning'::"text" NOT NULL,
    "current_task_id" "uuid",
    "context" "jsonb" DEFAULT '{"user_inputs": {}, "last_question": null, "intermediate_results": []}'::"jsonb",
    "result" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


ALTER TABLE "the0"."work_sessions" OWNER TO "postgres";


COMMENT ON TABLE "the0"."work_sessions" IS 'Orchestrator 작업 세션 (Plan Mode 세션)';



CREATE TABLE IF NOT EXISTS "the0"."work_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "active_form" "text" NOT NULL,
    "task_order" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "result" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone
);


ALTER TABLE "the0"."work_tasks" OWNER TO "postgres";


COMMENT ON TABLE "the0"."work_tasks" IS 'Orchestrator 태스크 (TodoWrite 스타일)';



CREATE TABLE IF NOT EXISTS "theai"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "source" "text" NOT NULL,
    "title" "text",
    "category" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "case_id" "uuid",
    "parent_case_id" "uuid",
    "case_type" "text",
    "case_category" "text",
    "case_instance" "text",
    "proceeding_type" "text",
    "party" "text",
    "doc_type" "text",
    "doc_subtype" "text",
    "media_type" "text" DEFAULT 'document'::"text",
    "fts_content" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", COALESCE("content", ''::"text"))) STORED,
    "normalized_content" "text",
    "section_path" "text",
    "hierarchy_level" integer DEFAULT 0,
    "parent_chunk_id" "uuid",
    "chunk_index" integer DEFAULT 0,
    "total_chunks" integer DEFAULT 1,
    "embedding" "public"."vector"(2000),
    "proof_purpose" "text",
    "analysis_status" "text" DEFAULT 'pending'::"text",
    "evidence_number" "text",
    "is_deleted" boolean DEFAULT false,
    "is_parent" boolean DEFAULT false,
    "parent_id" "uuid",
    CONSTRAINT "chk_documents_analysis_status" CHECK ((("analysis_status" IS NULL) OR ("analysis_status" = ANY (ARRAY['pending'::"text", 'analyzed'::"text", 'skipped'::"text"])))),
    CONSTRAINT "chk_documents_doc_type" CHECK ((("doc_type" IS NULL) OR ("doc_type" = ANY (ARRAY['ruling'::"text", 'brief'::"text", 'evidence'::"text", 'statute'::"text", 'book'::"text", 'paper'::"text", 'internal'::"text", 'legal_book'::"text", 'legal_paper'::"text", 'case_law'::"text"])))),
    CONSTRAINT "chk_documents_domain" CHECK (("domain" = ANY (ARRAY['legal'::"text", 'marketing'::"text", 'operations'::"text", 'meta'::"text"])))
);


ALTER TABLE "theai"."documents" OWNER TO "postgres";


COMMENT ON COLUMN "theai"."documents"."case_type" IS '가사 | 민사 | 형사';



COMMENT ON COLUMN "theai"."documents"."case_category" IS '본안 | 보전 | 집행';



COMMENT ON COLUMN "theai"."documents"."case_instance" IS '1심 | 항소심 | 상고심 | 이송';



COMMENT ON COLUMN "theai"."documents"."party" IS 'plaintiff | defendant | court | third_party';



COMMENT ON COLUMN "theai"."documents"."doc_type" IS 'brief | evidence | ruling | reference';



COMMENT ON COLUMN "theai"."documents"."is_parent" IS 'Parent 청크 여부 (legal_book, legal_paper)';



COMMENT ON COLUMN "theai"."documents"."parent_id" IS 'Child가 참조하는 Parent의 DB ID';



CREATE OR REPLACE VIEW "theai"."active_documents" AS
 SELECT "id",
    "content",
    "domain",
    "source",
    "title",
    "category",
    "metadata",
    "created_at",
    "updated_at",
    "case_id",
    "parent_case_id",
    "case_type",
    "case_category",
    "case_instance",
    "proceeding_type",
    "party",
    "doc_type",
    "doc_subtype",
    "media_type",
    "fts_content",
    "normalized_content",
    "section_path",
    "hierarchy_level",
    "parent_chunk_id",
    "chunk_index",
    "total_chunks",
    "embedding",
    "proof_purpose",
    "analysis_status",
    "evidence_number",
    "is_deleted"
   FROM "theai"."documents"
  WHERE (("is_deleted" = false) OR ("is_deleted" IS NULL));


ALTER VIEW "theai"."active_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "theai"."case_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "case_number" "text",
    "plaintiff" "text",
    "defendant" "text",
    "client_role" "text",
    "case_summary" "text",
    "issues" "jsonb" DEFAULT '[]'::"jsonb",
    "timeline" "jsonb" DEFAULT '[]'::"jsonb",
    "briefs" "jsonb" DEFAULT '[]'::"jsonb",
    "evidence" "jsonb" DEFAULT '[]'::"jsonb",
    "last_document_date" "date",
    "document_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "theai"."case_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "theai"."chat_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "domain" "text",
    "task" "text",
    "provider" "text",
    "model" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "theai"."chat_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "theai"."claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "document_id" "uuid",
    "party" "text" NOT NULL,
    "claim_type" "text",
    "claim_text" "text" NOT NULL,
    "claim_summary" "text",
    "page_number" integer,
    "paragraph_number" integer,
    "status" "text" DEFAULT 'pending'::"text",
    "priority" integer DEFAULT 5,
    "extracted_at" timestamp with time zone DEFAULT "now"(),
    "extracted_by" "text" DEFAULT 'ai'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_claims_claim_type" CHECK ((("claim_type" IS NULL) OR ("claim_type" = ANY (ARRAY['fact'::"text", 'legal'::"text", 'procedural'::"text"])))),
    CONSTRAINT "chk_claims_party" CHECK (("party" = ANY (ARRAY['plaintiff'::"text", 'defendant'::"text"]))),
    CONSTRAINT "chk_claims_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'addressed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "theai"."claims" OWNER TO "postgres";


COMMENT ON TABLE "theai"."claims" IS '서면에서 추출된 개별 주장 (상대방/우리측)';



CREATE TABLE IF NOT EXISTS "theai"."document_evidence_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_document_id" "uuid" NOT NULL,
    "evidence_document_id" "uuid",
    "evidence_number" "text" NOT NULL,
    "extracted_proof_purpose" "text",
    "context_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "theai"."document_evidence_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "theai"."evidence_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "link_type" "text" NOT NULL,
    "relevance_score" double precision,
    "ai_analysis" "text",
    "excerpt" "text",
    "linked_at" timestamp with time zone DEFAULT "now"(),
    "linked_by" "text" DEFAULT 'ai'::"text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_evidence_links_type" CHECK (("link_type" = ANY (ARRAY['supports'::"text", 'refutes'::"text", 'related'::"text"])))
);


ALTER TABLE "theai"."evidence_links" OWNER TO "postgres";


COMMENT ON TABLE "theai"."evidence_links" IS '주장과 증거 문서의 연결 관계';



CREATE TABLE IF NOT EXISTS "theai"."financial_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "evidence_id" "uuid",
    "document_id" "uuid",
    "account_holder" "text",
    "account_number" "text",
    "bank_name" "text",
    "transaction_date" "date" NOT NULL,
    "transaction_time" time without time zone,
    "transaction_type" "text",
    "amount" numeric(15,2) NOT NULL,
    "balance_after" numeric(15,2),
    "description" "text",
    "counterparty" "text",
    "memo" "text",
    "category" "text",
    "is_disputed" boolean DEFAULT false,
    "brief_references" "jsonb" DEFAULT '[]'::"jsonb",
    "proof_purpose" "text",
    "source_file" "text",
    "page_number" integer,
    "row_number" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "theai"."financial_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "theai"."ingested_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drive_file_id" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "doc_type" "text" NOT NULL,
    "evidence_type" "text",
    "case_id" "uuid",
    "chunk_count" integer DEFAULT 0,
    "chunk_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "ingested_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_deleted" boolean DEFAULT false,
    "drive_modified_time" timestamp with time zone
);


ALTER TABLE "theai"."ingested_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "theai"."legal_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_name" "text" NOT NULL,
    "court_case_number" "text",
    "client_role" "text",
    "court" "text",
    "case_type" "text",
    "opposing_party" "text",
    "opposing_counsel" "text",
    "status" "text" DEFAULT 'active'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "legal_cases_client_role_check" CHECK (("client_role" = ANY (ARRAY['plaintiff'::"text", 'defendant'::"text"]))),
    CONSTRAINT "legal_cases_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "theai"."legal_cases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "theai"."legal_synonyms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "term" "text" NOT NULL,
    "synonyms" "text"[] NOT NULL,
    "domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "theai"."legal_synonyms" OWNER TO "postgres";


COMMENT ON TABLE "theai"."legal_synonyms" IS '법률 용어 동의어 사전';



CREATE TABLE IF NOT EXISTS "theai"."rebuttals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "rebuttal_type" "text",
    "rebuttal_text" "text" NOT NULL,
    "supporting_evidence" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "version" integer DEFAULT 1,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "generated_by" "text" DEFAULT 'ai'::"text",
    "lawyer_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_rebuttals_status" CHECK (("status" = ANY (ARRAY['draft'::"text", 'reviewed'::"text", 'approved'::"text", 'used'::"text"])))
);


ALTER TABLE "theai"."rebuttals" OWNER TO "postgres";


COMMENT ON TABLE "theai"."rebuttals" IS 'AI 생성 반박 내용 (변호사 검토용)';



ALTER TABLE ONLY "the0"."legal_synonyms" ALTER COLUMN "id" SET DEFAULT "nextval"('"the0"."legal_synonyms_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_times"
    ADD CONSTRAINT "blocked_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_notion_id_key" UNIQUE ("notion_id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_contracts"
    ADD CONSTRAINT "case_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_deadlines"
    ADD CONSTRAINT "case_deadlines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_parties"
    ADD CONSTRAINT "case_parties_case_id_party_type_party_name_key" UNIQUE ("case_id", "party_type", "party_name");



ALTER TABLE ONLY "public"."case_parties"
    ADD CONSTRAINT "case_parties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_relations"
    ADD CONSTRAINT "case_relations_case_id_related_case_id_key" UNIQUE ("case_id", "related_case_id");



ALTER TABLE ONLY "public"."case_relations"
    ADD CONSTRAINT "case_relations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_representatives"
    ADD CONSTRAINT "case_representatives_case_id_representative_type_label_repr_key" UNIQUE ("case_id", "representative_type_label", "representative_name");



ALTER TABLE ONLY "public"."case_representatives"
    ADD CONSTRAINT "case_representatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_schedules"
    ADD CONSTRAINT "case_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_notion_id_key" UNIQUE ("notion_id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_kakao_id_key" UNIQUE ("kakao_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultation_activity_log"
    ADD CONSTRAINT "consultation_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultation_date_exceptions"
    ADD CONSTRAINT "consultation_date_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultation_settings"
    ADD CONSTRAINT "consultation_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultation_settings"
    ADD CONSTRAINT "consultation_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."consultation_sources"
    ADD CONSTRAINT "consultation_sources_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."consultation_sources"
    ADD CONSTRAINT "consultation_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultation_weekly_schedule"
    ADD CONSTRAINT "consultation_weekly_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_unified_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_hearings"
    ADD CONSTRAINT "court_hearings_google_event_id_key" UNIQUE ("google_event_id");



ALTER TABLE ONLY "public"."court_hearings"
    ADD CONSTRAINT "court_hearings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deadline_extensions"
    ADD CONSTRAINT "deadline_extensions_deadline_id_extension_number_key" UNIQUE ("deadline_id", "extension_number");



ALTER TABLE ONLY "public"."deadline_extensions"
    ADD CONSTRAINT "deadline_extensions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deadline_types"
    ADD CONSTRAINT "deadline_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deadline_types"
    ADD CONSTRAINT "deadline_types_type_key" UNIQUE ("type");



ALTER TABLE ONLY "public"."dismissed_case_notices"
    ADD CONSTRAINT "dismissed_case_notices_case_id_notice_id_key" UNIQUE ("case_id", "notice_id");



ALTER TABLE ONLY "public"."dismissed_case_notices"
    ADD CONSTRAINT "dismissed_case_notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dismissed_related_cases"
    ADD CONSTRAINT "dismissed_related_cases_case_id_related_case_no_related_cas_key" UNIQUE ("case_id", "related_case_no", "related_case_type");



ALTER TABLE ONLY "public"."dismissed_related_cases"
    ADD CONSTRAINT "dismissed_related_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drive_file_classifications"
    ADD CONSTRAINT "drive_file_classifications_drive_file_id_key" UNIQUE ("drive_file_id");



ALTER TABLE ONLY "public"."drive_file_classifications"
    ADD CONSTRAINT "drive_file_classifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drive_watch_channels"
    ADD CONSTRAINT "drive_watch_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drive_webhook_logs"
    ADD CONSTRAINT "drive_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episodic_memory"
    ADD CONSTRAINT "episodic_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."general_schedules"
    ADD CONSTRAINT "general_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instagram_posts"
    ADD CONSTRAINT "instagram_posts_notion_id_key" UNIQUE ("notion_id");



ALTER TABLE ONLY "public"."instagram_posts"
    ADD CONSTRAINT "instagram_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."korean_public_holidays"
    ADD CONSTRAINT "korean_public_holidays_holiday_date_key" UNIQUE ("holiday_date");



ALTER TABLE ONLY "public"."korean_public_holidays"
    ADD CONSTRAINT "korean_public_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_cases"
    ADD CONSTRAINT "legal_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_settlements"
    ADD CONSTRAINT "monthly_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_settlements"
    ADD CONSTRAINT "monthly_settlements_settlement_month_key" UNIQUE ("settlement_month");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_schedules"
    ADD CONSTRAINT "notification_schedules_category_key" UNIQUE ("category");



ALTER TABLE ONLY "public"."notification_schedules"
    ADD CONSTRAINT "notification_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_state_key" UNIQUE ("state");



ALTER TABLE ONLY "public"."partner_withdrawals"
    ADD CONSTRAINT "partner_withdrawals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_calendar_events"
    ADD CONSTRAINT "pending_calendar_events_google_event_id_key" UNIQUE ("google_event_id");



ALTER TABLE ONLY "public"."pending_calendar_events"
    ADD CONSTRAINT "pending_calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."persona_feedback_logs"
    ADD CONSTRAINT "persona_feedback_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receivable_memos"
    ADD CONSTRAINT "receivable_memos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receivable_writeoffs"
    ADD CONSTRAINT "receivable_writeoffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_templates"
    ADD CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_case_snapshots"
    ADD CONSTRAINT "scourt_case_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_case_updates"
    ADD CONSTRAINT "scourt_case_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_profile_cases"
    ADD CONSTRAINT "scourt_profile_cases_legal_case_id_key" UNIQUE ("legal_case_id");



ALTER TABLE ONLY "public"."scourt_profile_cases"
    ADD CONSTRAINT "scourt_profile_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_profile_cases"
    ADD CONSTRAINT "scourt_profile_cases_profile_id_case_number_key" UNIQUE ("profile_id", "case_number");



ALTER TABLE ONLY "public"."scourt_profiles"
    ADD CONSTRAINT "scourt_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_profiles"
    ADD CONSTRAINT "scourt_profiles_profile_name_key" UNIQUE ("profile_name");



ALTER TABLE ONLY "public"."scourt_sync_jobs"
    ADD CONSTRAINT "scourt_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_sync_logs"
    ADD CONSTRAINT "scourt_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_update_types"
    ADD CONSTRAINT "scourt_update_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."scourt_user_settings"
    ADD CONSTRAINT "scourt_user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_user_settings"
    ADD CONSTRAINT "scourt_user_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."scourt_user_wmonid"
    ADD CONSTRAINT "scourt_user_wmonid_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_user_wmonid"
    ADD CONSTRAINT "scourt_user_wmonid_user_id_wmonid_key" UNIQUE ("user_id", "wmonid");



ALTER TABLE ONLY "public"."scourt_xml_cache"
    ADD CONSTRAINT "scourt_xml_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scourt_xml_cache"
    ADD CONSTRAINT "scourt_xml_cache_xml_path_key" UNIQUE ("xml_path");



ALTER TABLE ONLY "public"."semantic_memory"
    ADD CONSTRAINT "semantic_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."semantic_memory"
    ADD CONSTRAINT "semantic_memory_user_id_domain_entity_key_key" UNIQUE ("user_id", "domain", "entity_key");



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_templates"
    ADD CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_templates"
    ADD CONSTRAINT "sms_templates_template_key_key" UNIQUE ("template_key");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_tenant_id_provider_key" UNIQUE ("tenant_id", "provider");



ALTER TABLE ONLY "public"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_category_key" UNIQUE ("tenant_id", "category");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."testimonial_cases"
    ADD CONSTRAINT "testimonial_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonial_evidence_photos"
    ADD CONSTRAINT "testimonial_evidence_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_personas"
    ADD CONSTRAINT "user_personas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_personas"
    ADD CONSTRAINT "user_personas_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles_v4"
    ADD CONSTRAINT "user_profiles_v4_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles_v4"
    ADD CONSTRAINT "user_profiles_v4_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users_profiles"
    ADD CONSTRAINT "users_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users_profiles"
    ADD CONSTRAINT "users_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."ai_models"
    ADD CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."brief_exports"
    ADD CONSTRAINT "brief_exports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."brief_guidelines"
    ADD CONSTRAINT "brief_guidelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."brief_inputs"
    ADD CONSTRAINT "brief_inputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."brief_sessions"
    ADD CONSTRAINT "brief_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."brief_templates"
    ADD CONSTRAINT "brief_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."brief_versions"
    ADD CONSTRAINT "brief_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."case_claim_norms"
    ADD CONSTRAINT "case_claim_norms_claim_id_norm_id_key" UNIQUE ("claim_id", "norm_id");



ALTER TABLE ONLY "the0"."case_claim_norms"
    ADD CONSTRAINT "case_claim_norms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."case_claims"
    ADD CONSTRAINT "case_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."case_issues"
    ADD CONSTRAINT "case_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."case_judgments"
    ADD CONSTRAINT "case_judgments_case_id_instance_level_key" UNIQUE ("case_id", "instance_level");



ALTER TABLE ONLY "the0"."case_judgments"
    ADD CONSTRAINT "case_judgments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."case_summaries"
    ADD CONSTRAINT "case_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."case_type_issue_templates"
    ADD CONSTRAINT "case_type_issue_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."case_types"
    ADD CONSTRAINT "case_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "the0"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."citation_validation_logs"
    ADD CONSTRAINT "citation_validation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."claim_change_types"
    ADD CONSTRAINT "claim_change_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "the0"."claim_evidence"
    ADD CONSTRAINT "claim_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."claim_issues"
    ADD CONSTRAINT "claim_issues_pkey" PRIMARY KEY ("claim_id", "issue_id");



ALTER TABLE ONLY "the0"."claim_subtypes"
    ADD CONSTRAINT "claim_subtypes_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "the0"."claim_versions"
    ADD CONSTRAINT "claim_versions_claim_id_version_number_key" UNIQUE ("claim_id", "version_number");



ALTER TABLE ONLY "the0"."claim_versions"
    ADD CONSTRAINT "claim_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."claims"
    ADD CONSTRAINT "claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."collaboration_history"
    ADD CONSTRAINT "collaboration_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."confirmed_strategies"
    ADD CONSTRAINT "confirmed_strategies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."context_summaries"
    ADD CONSTRAINT "context_summaries_case_id_summary_type_level_reference_id_key" UNIQUE ("case_id", "summary_type", "level", "reference_id");



ALTER TABLE ONLY "the0"."context_summaries"
    ADD CONSTRAINT "context_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."doc_templates"
    ADD CONSTRAINT "doc_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_brief_document_id_evidence_number_key" UNIQUE ("brief_document_id", "evidence_number");



ALTER TABLE ONLY "the0"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."draft_chunks"
    ADD CONSTRAINT "draft_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."drafts_temp"
    ADD CONSTRAINT "drafts_temp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."evidence_documents"
    ADD CONSTRAINT "evidence_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."evidence_files"
    ADD CONSTRAINT "evidence_files_drive_file_id_key" UNIQUE ("drive_file_id");



ALTER TABLE ONLY "the0"."evidence_files"
    ADD CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."evidence_links"
    ADD CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."evidence_requests"
    ADD CONSTRAINT "evidence_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."financial_records"
    ADD CONSTRAINT "financial_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."ingested_files"
    ADD CONSTRAINT "ingested_files_drive_file_id_key" UNIQUE ("drive_file_id");



ALTER TABLE ONLY "the0"."ingested_files"
    ADD CONSTRAINT "ingested_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."issue_position_versions"
    ADD CONSTRAINT "issue_position_versions_issue_id_version_number_key" UNIQUE ("issue_id", "version_number");



ALTER TABLE ONLY "the0"."issue_position_versions"
    ADD CONSTRAINT "issue_position_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."legal_cases_ext"
    ADD CONSTRAINT "legal_cases_ext_case_key_key" UNIQUE ("case_key");



ALTER TABLE ONLY "the0"."legal_cases_ext"
    ADD CONSTRAINT "legal_cases_ext_pkey" PRIMARY KEY ("case_id");



ALTER TABLE ONLY "the0"."legal_norms"
    ADD CONSTRAINT "legal_norms_code_key" UNIQUE ("code");



ALTER TABLE ONLY "the0"."legal_norms"
    ADD CONSTRAINT "legal_norms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."legal_synonyms"
    ADD CONSTRAINT "legal_synonyms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."norm_relation_types"
    ADD CONSTRAINT "norm_relation_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "the0"."opponent_briefs"
    ADD CONSTRAINT "opponent_briefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."pending_files"
    ADD CONSTRAINT "pending_files_drive_file_id_key" UNIQUE ("drive_file_id");



ALTER TABLE ONLY "the0"."pending_files"
    ADD CONSTRAINT "pending_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."pipeline_reviews"
    ADD CONSTRAINT "pipeline_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."precedent_cache"
    ADD CONSTRAINT "precedent_cache_case_number_unique" UNIQUE ("case_number");



ALTER TABLE ONLY "the0"."precedent_cache"
    ADD CONSTRAINT "precedent_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."prompt_feedback"
    ADD CONSTRAINT "prompt_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."prompt_history"
    ADD CONSTRAINT "prompt_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."prompts"
    ADD CONSTRAINT "prompts_domain_name_version_key" UNIQUE ("domain", "name", "version");



ALTER TABLE ONLY "the0"."prompts"
    ADD CONSTRAINT "prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."reasoning_logs"
    ADD CONSTRAINT "reasoning_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."rebuttals"
    ADD CONSTRAINT "rebuttals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."statute_cache"
    ADD CONSTRAINT "statute_cache_law_article_unique" UNIQUE ("law_name", "article_number", "paragraph");



ALTER TABLE ONLY "the0"."statute_cache"
    ADD CONSTRAINT "statute_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."temp_uploads"
    ADD CONSTRAINT "temp_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."user_invitations"
    ADD CONSTRAINT "unique_pending_phone" UNIQUE ("phone") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "the0"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."users_profiles"
    ADD CONSTRAINT "users_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."work_sessions"
    ADD CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "the0"."work_tasks"
    ADD CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."case_summaries"
    ADD CONSTRAINT "case_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."chat_logs"
    ADD CONSTRAINT "chat_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."claims"
    ADD CONSTRAINT "claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_brief_document_id_evidence_number_key" UNIQUE ("brief_document_id", "evidence_number");



ALTER TABLE ONLY "theai"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."evidence_links"
    ADD CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."financial_records"
    ADD CONSTRAINT "financial_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."ingested_files"
    ADD CONSTRAINT "ingested_files_drive_file_id_key" UNIQUE ("drive_file_id");



ALTER TABLE ONLY "theai"."ingested_files"
    ADD CONSTRAINT "ingested_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."legal_cases"
    ADD CONSTRAINT "legal_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."legal_synonyms"
    ADD CONSTRAINT "legal_synonyms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "theai"."rebuttals"
    ADD CONSTRAINT "rebuttals_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_app_settings_key" ON "public"."app_settings" USING "btree" ("key");



CREATE INDEX "idx_blocked_times_date" ON "public"."blocked_times" USING "btree" ("blocked_date");



CREATE INDEX "idx_blocked_times_office" ON "public"."blocked_times" USING "btree" ("office_location");



CREATE INDEX "idx_blocked_times_type" ON "public"."blocked_times" USING "btree" ("block_type");



CREATE INDEX "idx_blog_categories" ON "public"."blog_posts" USING "gin" ("categories");



CREATE INDEX "idx_blog_published" ON "public"."blog_posts" USING "btree" ("published");



CREATE INDEX "idx_blog_slug" ON "public"."blog_posts" USING "btree" ("slug");



CREATE INDEX "idx_blog_tags" ON "public"."blog_posts" USING "gin" ("tags");



CREATE INDEX "idx_bookings_created_at" ON "public"."bookings" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_bookings_preferred_date" ON "public"."bookings" USING "btree" ("preferred_date");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_bookings_status_date" ON "public"."bookings" USING "btree" ("status", "preferred_date");



CREATE INDEX "idx_bookings_tenant_id" ON "public"."bookings" USING "btree" ("tenant_id");



CREATE INDEX "idx_bookings_type" ON "public"."bookings" USING "btree" ("type");



CREATE INDEX "idx_case_contracts_legal_case_id" ON "public"."case_contracts" USING "btree" ("legal_case_id");



CREATE INDEX "idx_case_contracts_tenant_id" ON "public"."case_contracts" USING "btree" ("tenant_id");



CREATE INDEX "idx_case_deadlines_case_id" ON "public"."case_deadlines" USING "btree" ("case_id");



CREATE INDEX "idx_case_deadlines_case_number" ON "public"."case_deadlines" USING "btree" ("case_number");



CREATE INDEX "idx_case_deadlines_deadline_date" ON "public"."case_deadlines" USING "btree" ("deadline_date");



CREATE INDEX "idx_case_deadlines_party_id" ON "public"."case_deadlines" USING "btree" ("party_id") WHERE ("party_id" IS NOT NULL);



CREATE INDEX "idx_case_deadlines_party_side" ON "public"."case_deadlines" USING "btree" ("party_side") WHERE ("party_side" IS NOT NULL);



CREATE INDEX "idx_case_deadlines_scourt_update_id" ON "public"."case_deadlines" USING "btree" ("scourt_update_id") WHERE ("scourt_update_id" IS NOT NULL);



CREATE INDEX "idx_case_deadlines_status" ON "public"."case_deadlines" USING "btree" ("status");



CREATE INDEX "idx_case_parties_case" ON "public"."case_parties" USING "btree" ("case_id");



CREATE UNIQUE INDEX "idx_case_parties_case_scourt_index" ON "public"."case_parties" USING "btree" ("case_id", "scourt_party_index") WHERE ("scourt_party_index" IS NOT NULL);



CREATE INDEX "idx_case_parties_client" ON "public"."case_parties" USING "btree" ("client_id");



CREATE INDEX "idx_case_parties_tenant" ON "public"."case_parties" USING "btree" ("tenant_id");



CREATE INDEX "idx_case_relations_case_id" ON "public"."case_relations" USING "btree" ("case_id");



CREATE INDEX "idx_case_relations_related_case_id" ON "public"."case_relations" USING "btree" ("related_case_id");



CREATE INDEX "idx_case_representatives_case" ON "public"."case_representatives" USING "btree" ("case_id");



CREATE INDEX "idx_case_representatives_party" ON "public"."case_representatives" USING "btree" ("case_party_id");



CREATE INDEX "idx_case_representatives_tenant" ON "public"."case_representatives" USING "btree" ("tenant_id");



CREATE INDEX "idx_case_schedules_case_id" ON "public"."case_schedules" USING "btree" ("case_id");



CREATE INDEX "idx_case_schedules_scheduled_date" ON "public"."case_schedules" USING "btree" ("scheduled_date");



CREATE INDEX "idx_case_schedules_status" ON "public"."case_schedules" USING "btree" ("status");



CREATE INDEX "idx_cases_case_number" ON "public"."cases" USING "btree" ("case_number");



CREATE INDEX "idx_cases_categories" ON "public"."cases" USING "gin" ("categories");



CREATE INDEX "idx_cases_category" ON "public"."testimonial_cases" USING "btree" ("category");



CREATE INDEX "idx_cases_created_at" ON "public"."testimonial_cases" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cases_display_order" ON "public"."testimonial_cases" USING "btree" ("display_order");



CREATE INDEX "idx_cases_featured" ON "public"."testimonial_cases" USING "btree" ("featured");



CREATE INDEX "idx_cases_published" ON "public"."cases" USING "btree" ("published");



CREATE INDEX "idx_cases_published_order" ON "public"."testimonial_cases" USING "btree" ("published", "display_order") WHERE (("published" = true) AND ("consent_given" = true));



CREATE INDEX "idx_cases_search" ON "public"."testimonial_cases" USING "gin" ("search_vector");



CREATE UNIQUE INDEX "idx_cases_slug" ON "public"."cases" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_classifications_party_index" ON "public"."drive_file_classifications" USING "btree" ("submitter_party_index") WHERE ("submitter_party_index" IS NOT NULL);



CREATE INDEX "idx_clients_kakao_id" ON "public"."clients" USING "btree" ("kakao_id");



CREATE INDEX "idx_clients_name" ON "public"."clients" USING "btree" ("name");



CREATE INDEX "idx_clients_phone" ON "public"."clients" USING "btree" ("phone");



CREATE INDEX "idx_clients_tenant_id" ON "public"."clients" USING "btree" ("tenant_id");



CREATE INDEX "idx_consultation_activity_log_activity_type" ON "public"."consultation_activity_log" USING "btree" ("activity_type");



CREATE INDEX "idx_consultation_activity_log_consultation_id" ON "public"."consultation_activity_log" USING "btree" ("consultation_id");



CREATE INDEX "idx_consultation_activity_log_created_at" ON "public"."consultation_activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_consultation_date_exceptions_tenant_id" ON "public"."consultation_date_exceptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_consultation_sources_active" ON "public"."consultation_sources" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_consultation_sources_usage" ON "public"."consultation_sources" USING "btree" ("usage_count" DESC);



CREATE INDEX "idx_consultation_weekly_schedule_tenant_id" ON "public"."consultation_weekly_schedule" USING "btree" ("tenant_id");



CREATE INDEX "idx_consultations_assigned_member" ON "public"."consultations" USING "btree" ("assigned_member_id");



CREATE INDEX "idx_consultations_assigned_to" ON "public"."consultations" USING "btree" ("assigned_to");



CREATE INDEX "idx_consultations_category" ON "public"."consultations" USING "btree" ("category");



CREATE INDEX "idx_consultations_converted_to_case_id" ON "public"."consultations" USING "btree" ("converted_to_case_id");



CREATE INDEX "idx_consultations_created_at" ON "public"."consultations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_consultations_scheduled_date" ON "public"."consultations" USING "btree" ("scheduled_date");



CREATE INDEX "idx_consultations_status" ON "public"."consultations" USING "btree" ("status");



CREATE INDEX "idx_consultations_tenant_id" ON "public"."consultations" USING "btree" ("tenant_id");



CREATE INDEX "idx_consultations_uni_assigned_lawyer" ON "public"."consultations" USING "btree" ("assigned_lawyer", "status") WHERE ("assigned_lawyer" IS NOT NULL);



CREATE INDEX "idx_consultations_uni_created_at" ON "public"."consultations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_consultations_uni_email" ON "public"."consultations" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_consultations_uni_payment" ON "public"."consultations" USING "btree" ("payment_status", "paid_at") WHERE ("payment_status" IS NOT NULL);



CREATE INDEX "idx_consultations_uni_phone" ON "public"."consultations" USING "btree" ("phone");



CREATE INDEX "idx_consultations_uni_request_type" ON "public"."consultations" USING "btree" ("request_type");



CREATE INDEX "idx_consultations_uni_scheduling" ON "public"."consultations" USING "btree" ("request_type", "preferred_date", "preferred_time") WHERE (("request_type" = ANY (ARRAY['visit'::"text", 'video'::"text"])) AND ("status" <> ALL (ARRAY['cancelled'::"text", 'no_show'::"text"])));



CREATE INDEX "idx_consultations_uni_status" ON "public"."consultations" USING "btree" ("status") WHERE ("status" <> ALL (ARRAY['completed'::"text", 'cancelled'::"text"]));



CREATE INDEX "idx_consultations_uni_status_date" ON "public"."consultations" USING "btree" ("status", "preferred_date") WHERE ("preferred_date" IS NOT NULL);



CREATE INDEX "idx_consultations_uni_status_type" ON "public"."consultations" USING "btree" ("status", "request_type");



CREATE INDEX "idx_court_hearings_attending_lawyer" ON "public"."court_hearings" USING "btree" ("attending_lawyer_id");



CREATE INDEX "idx_court_hearings_case_id" ON "public"."court_hearings" USING "btree" ("case_id");



CREATE INDEX "idx_court_hearings_case_number" ON "public"."court_hearings" USING "btree" ("case_number");



CREATE INDEX "idx_court_hearings_date" ON "public"."court_hearings" USING "btree" ("hearing_date");



CREATE INDEX "idx_court_hearings_google_event_id" ON "public"."court_hearings" USING "btree" ("google_event_id");



CREATE INDEX "idx_court_hearings_sequence" ON "public"."court_hearings" USING "btree" ("case_id", "hearing_sequence") WHERE ("hearing_sequence" IS NOT NULL);



CREATE INDEX "idx_court_hearings_status" ON "public"."court_hearings" USING "btree" ("status");



CREATE INDEX "idx_court_hearings_video_participant" ON "public"."court_hearings" USING "btree" ("video_participant_side") WHERE ("video_participant_side" IS NOT NULL);



CREATE INDEX "idx_date_exceptions_date" ON "public"."consultation_date_exceptions" USING "btree" ("exception_date");



CREATE INDEX "idx_date_exceptions_lawyer" ON "public"."consultation_date_exceptions" USING "btree" ("lawyer_name");



CREATE INDEX "idx_date_exceptions_office" ON "public"."consultation_date_exceptions" USING "btree" ("office_location");



CREATE INDEX "idx_dfc_case_client_visible" ON "public"."drive_file_classifications" USING "btree" ("case_id", "client_visible") WHERE ("client_visible" = true);



CREATE INDEX "idx_dfc_case_id" ON "public"."drive_file_classifications" USING "btree" ("case_id");



CREATE INDEX "idx_dfc_client_doc_type" ON "public"."drive_file_classifications" USING "btree" ("client_doc_type") WHERE ("client_visible" = true);



CREATE INDEX "idx_dfc_client_visible" ON "public"."drive_file_classifications" USING "btree" ("client_visible") WHERE ("client_visible" = true);



CREATE INDEX "idx_dfc_drive_file_id" ON "public"."drive_file_classifications" USING "btree" ("drive_file_id");



CREATE INDEX "idx_dfc_folder_path" ON "public"."drive_file_classifications" USING "btree" ("folder_path");



CREATE INDEX "idx_dfc_match_type" ON "public"."drive_file_classifications" USING "btree" ("match_type");



CREATE INDEX "idx_dfc_rag_status" ON "public"."drive_file_classifications" USING "btree" ("rag_status");



CREATE INDEX "idx_dismissed_notices_case_id" ON "public"."dismissed_case_notices" USING "btree" ("case_id");



CREATE INDEX "idx_dismissed_related_cases_case" ON "public"."dismissed_related_cases" USING "btree" ("case_id");



CREATE INDEX "idx_drive_watch_channels_active" ON "public"."drive_watch_channels" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_episodic_memory_domain" ON "public"."episodic_memory" USING "btree" ("user_id", "domain");



CREATE INDEX "idx_episodic_memory_importance" ON "public"."episodic_memory" USING "btree" ("user_id", "importance" DESC);



CREATE INDEX "idx_episodic_memory_recent" ON "public"."episodic_memory" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_episodic_memory_user" ON "public"."episodic_memory" USING "btree" ("user_id");



CREATE INDEX "idx_evidence_case" ON "public"."testimonial_evidence_photos" USING "btree" ("case_id");



CREATE INDEX "idx_evidence_order" ON "public"."testimonial_evidence_photos" USING "btree" ("case_id", "display_order");



CREATE INDEX "idx_evidence_type" ON "public"."testimonial_evidence_photos" USING "btree" ("evidence_type");



CREATE INDEX "idx_expenses_created_at" ON "public"."expenses" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_expenses_expense_category" ON "public"."expenses" USING "btree" ("expense_category");



CREATE INDEX "idx_expenses_expense_date" ON "public"."expenses" USING "btree" ("expense_date" DESC);



CREATE INDEX "idx_expenses_is_recurring" ON "public"."expenses" USING "btree" ("is_recurring");



CREATE INDEX "idx_expenses_month_key" ON "public"."expenses" USING "btree" ("month_key");



CREATE INDEX "idx_expenses_recurring_template_id" ON "public"."expenses" USING "btree" ("recurring_template_id");



CREATE INDEX "idx_expenses_tenant_id" ON "public"."expenses" USING "btree" ("tenant_id");



CREATE INDEX "idx_faqs_category" ON "public"."faqs" USING "btree" ("category");



CREATE INDEX "idx_faqs_featured" ON "public"."faqs" USING "btree" ("featured") WHERE ("featured" = true);



CREATE INDEX "idx_faqs_published" ON "public"."faqs" USING "btree" ("published");



CREATE INDEX "idx_faqs_related_blog_posts" ON "public"."faqs" USING "gin" ("related_blog_posts");



CREATE INDEX "idx_faqs_related_cases" ON "public"."faqs" USING "gin" ("related_cases");



CREATE INDEX "idx_faqs_search" ON "public"."faqs" USING "gin" ("search_vector");



CREATE INDEX "idx_faqs_slug" ON "public"."faqs" USING "btree" ("slug");



CREATE INDEX "idx_faqs_sort_order" ON "public"."faqs" USING "btree" ("sort_order");



CREATE INDEX "idx_general_schedules_created_by" ON "public"."general_schedules" USING "btree" ("created_by");



CREATE INDEX "idx_general_schedules_date" ON "public"."general_schedules" USING "btree" ("schedule_date");



CREATE INDEX "idx_general_schedules_status" ON "public"."general_schedules" USING "btree" ("status");



CREATE INDEX "idx_general_schedules_tenant_id" ON "public"."general_schedules" USING "btree" ("tenant_id");



CREATE INDEX "idx_general_schedules_type" ON "public"."general_schedules" USING "btree" ("schedule_type");



CREATE INDEX "idx_holidays_date" ON "public"."korean_public_holidays" USING "btree" ("holiday_date");



CREATE INDEX "idx_holidays_year" ON "public"."korean_public_holidays" USING "btree" ("year");



CREATE INDEX "idx_instagram_notion_id" ON "public"."instagram_posts" USING "btree" ("notion_id");



CREATE INDEX "idx_instagram_post_date" ON "public"."instagram_posts" USING "btree" ("post_date" DESC);



CREATE INDEX "idx_instagram_published" ON "public"."instagram_posts" USING "btree" ("published");



CREATE INDEX "idx_instagram_slug" ON "public"."instagram_posts" USING "btree" ("slug");



CREATE INDEX "idx_instagram_type" ON "public"."instagram_posts" USING "btree" ("post_type");



CREATE INDEX "idx_legal_cases_assigned_lawyer" ON "public"."legal_cases" USING "btree" ("assigned_lawyer");



CREATE INDEX "idx_legal_cases_assigned_member" ON "public"."legal_cases" USING "btree" ("assigned_member_id");



CREATE INDEX "idx_legal_cases_assigned_to" ON "public"."legal_cases" USING "btree" ("assigned_to");



CREATE INDEX "idx_legal_cases_client_id" ON "public"."legal_cases" USING "btree" ("client_id");



CREATE INDEX "idx_legal_cases_client_role" ON "public"."legal_cases" USING "btree" ("client_role");



CREATE INDEX "idx_legal_cases_client_role_status" ON "public"."legal_cases" USING "btree" ("client_role_status");



CREATE INDEX "idx_legal_cases_contract_date" ON "public"."legal_cases" USING "btree" ("contract_date");



CREATE INDEX "idx_legal_cases_defendants" ON "public"."legal_cases" USING "gin" ("defendants");



CREATE INDEX "idx_legal_cases_enc_cs_no" ON "public"."legal_cases" USING "btree" ("enc_cs_no") WHERE ("enc_cs_no" IS NOT NULL);



CREATE INDEX "idx_legal_cases_main_case_id" ON "public"."legal_cases" USING "btree" ("main_case_id") WHERE ("main_case_id" IS NOT NULL);



CREATE INDEX "idx_legal_cases_plaintiffs" ON "public"."legal_cases" USING "gin" ("plaintiffs");



CREATE INDEX "idx_legal_cases_receivable_grade" ON "public"."legal_cases" USING "btree" ("receivable_grade");



CREATE INDEX "idx_legal_cases_scourt_next_general" ON "public"."legal_cases" USING "btree" ("scourt_next_general_sync_at");



CREATE INDEX "idx_legal_cases_scourt_next_progress" ON "public"."legal_cases" USING "btree" ("scourt_next_progress_sync_at");



CREATE INDEX "idx_legal_cases_scourt_progress_hash" ON "public"."legal_cases" USING "btree" ("scourt_progress_hash");



CREATE INDEX "idx_legal_cases_scourt_sync_cooldown" ON "public"."legal_cases" USING "btree" ("scourt_sync_cooldown_until");



CREATE INDEX "idx_legal_cases_scourt_sync_enabled" ON "public"."legal_cases" USING "btree" ("scourt_sync_enabled");



CREATE INDEX "idx_legal_cases_scourt_sync_status" ON "public"."legal_cases" USING "btree" ("scourt_sync_status");



CREATE INDEX "idx_legal_cases_status" ON "public"."legal_cases" USING "btree" ("status");



CREATE INDEX "idx_legal_cases_tenant_id" ON "public"."legal_cases" USING "btree" ("tenant_id");



CREATE INDEX "idx_notification_logs_created" ON "public"."notification_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notification_logs_recipient" ON "public"."notification_logs" USING "btree" ("recipient_phone");



CREATE INDEX "idx_notification_logs_related" ON "public"."notification_logs" USING "btree" ("related_type", "related_id");



CREATE INDEX "idx_notification_logs_status" ON "public"."notification_logs" USING "btree" ("status");



CREATE INDEX "idx_notification_logs_template" ON "public"."notification_logs" USING "btree" ("template_id");



CREATE INDEX "idx_notification_logs_tenant_id" ON "public"."notification_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_notification_templates_active" ON "public"."notification_templates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_notification_templates_category" ON "public"."notification_templates" USING "btree" ("category");



CREATE INDEX "idx_notification_templates_channel" ON "public"."notification_templates" USING "btree" ("channel");



CREATE INDEX "idx_notification_templates_tenant_id" ON "public"."notification_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_oauth_states_expires_at" ON "public"."oauth_states" USING "btree" ("expires_at");



CREATE INDEX "idx_payments_case_id" ON "public"."payments" USING "btree" ("case_id");



CREATE INDEX "idx_payments_client_id" ON "public"."payments" USING "btree" ("client_id");



CREATE INDEX "idx_payments_consultation_id" ON "public"."payments" USING "btree" ("consultation_id");



CREATE INDEX "idx_payments_created_at" ON "public"."payments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_payments_depositor_name" ON "public"."payments" USING "btree" ("depositor_name");



CREATE INDEX "idx_payments_is_confirmed" ON "public"."payments" USING "btree" ("is_confirmed");



CREATE INDEX "idx_payments_month_key" ON "public"."payments" USING "btree" ("month_key");



CREATE INDEX "idx_payments_payment_category" ON "public"."payments" USING "btree" ("payment_category");



CREATE INDEX "idx_payments_payment_date" ON "public"."payments" USING "btree" ("payment_date" DESC);



CREATE INDEX "idx_payments_tenant_id" ON "public"."payments" USING "btree" ("tenant_id");



CREATE INDEX "idx_pending_calendar_events_google_event_id" ON "public"."pending_calendar_events" USING "btree" ("google_event_id");



CREATE INDEX "idx_pending_calendar_events_parsed_case_number" ON "public"."pending_calendar_events" USING "btree" ("parsed_case_number");



CREATE INDEX "idx_pending_calendar_events_status" ON "public"."pending_calendar_events" USING "btree" ("status");



CREATE INDEX "idx_persona_feedback_session" ON "public"."persona_feedback_logs" USING "btree" ("session_id");



CREATE INDEX "idx_persona_feedback_time" ON "public"."persona_feedback_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_persona_feedback_user" ON "public"."persona_feedback_logs" USING "btree" ("user_id");



CREATE INDEX "idx_receivable_memos_case_id" ON "public"."receivable_memos" USING "btree" ("case_id");



CREATE INDEX "idx_receivable_memos_client_id" ON "public"."receivable_memos" USING "btree" ("client_id");



CREATE INDEX "idx_receivable_memos_tenant_id" ON "public"."receivable_memos" USING "btree" ("tenant_id");



CREATE INDEX "idx_receivable_writeoffs_case_id" ON "public"."receivable_writeoffs" USING "btree" ("case_id");



CREATE INDEX "idx_receivable_writeoffs_tenant_id" ON "public"."receivable_writeoffs" USING "btree" ("tenant_id");



CREATE INDEX "idx_receivable_writeoffs_written_off_at" ON "public"."receivable_writeoffs" USING "btree" ("written_off_at" DESC);



CREATE INDEX "idx_recurring_templates_expense_category" ON "public"."recurring_templates" USING "btree" ("expense_category");



CREATE INDEX "idx_recurring_templates_is_active" ON "public"."recurring_templates" USING "btree" ("is_active");



CREATE INDEX "idx_recurring_templates_start_date" ON "public"."recurring_templates" USING "btree" ("start_date");



CREATE INDEX "idx_scourt_case_snapshots_tenant_id" ON "public"."scourt_case_snapshots" USING "btree" ("tenant_id");



CREATE INDEX "idx_scourt_case_updates_tenant_id" ON "public"."scourt_case_updates" USING "btree" ("tenant_id");



CREATE INDEX "idx_scourt_profile_cases_case_number" ON "public"."scourt_profile_cases" USING "btree" ("case_number");



CREATE INDEX "idx_scourt_profile_cases_legal_case_id" ON "public"."scourt_profile_cases" USING "btree" ("legal_case_id");



CREATE INDEX "idx_scourt_profile_cases_profile_id" ON "public"."scourt_profile_cases" USING "btree" ("profile_id");



CREATE INDEX "idx_scourt_profile_cases_tenant_id" ON "public"."scourt_profile_cases" USING "btree" ("tenant_id");



CREATE INDEX "idx_scourt_profile_cases_user_wmonid_id" ON "public"."scourt_profile_cases" USING "btree" ("user_wmonid_id");



CREATE INDEX "idx_scourt_profile_cases_wmonid" ON "public"."scourt_profile_cases" USING "btree" ("wmonid");



CREATE INDEX "idx_scourt_profiles_lawyer_id" ON "public"."scourt_profiles" USING "btree" ("lawyer_id");



CREATE INDEX "idx_scourt_profiles_member_id" ON "public"."scourt_profiles" USING "btree" ("member_id");



CREATE INDEX "idx_scourt_profiles_status" ON "public"."scourt_profiles" USING "btree" ("status");



CREATE INDEX "idx_scourt_profiles_tenant_id" ON "public"."scourt_profiles" USING "btree" ("tenant_id");



CREATE INDEX "idx_scourt_snapshots_case_number" ON "public"."scourt_case_snapshots" USING "btree" ("case_number");



CREATE INDEX "idx_scourt_snapshots_legal_case" ON "public"."scourt_case_snapshots" USING "btree" ("legal_case_id");



CREATE INDEX "idx_scourt_snapshots_scraped_at" ON "public"."scourt_case_snapshots" USING "btree" ("scraped_at" DESC);



CREATE INDEX "idx_scourt_sync_jobs_backoff" ON "public"."scourt_sync_jobs" USING "btree" ("backoff_until");



CREATE UNIQUE INDEX "idx_scourt_sync_jobs_dedup_key" ON "public"."scourt_sync_jobs" USING "btree" ("dedup_key") WHERE ("dedup_key" IS NOT NULL);



CREATE INDEX "idx_scourt_sync_jobs_legal_case_id" ON "public"."scourt_sync_jobs" USING "btree" ("legal_case_id");



CREATE INDEX "idx_scourt_sync_jobs_priority" ON "public"."scourt_sync_jobs" USING "btree" ("priority" DESC);



CREATE INDEX "idx_scourt_sync_jobs_scheduled_at" ON "public"."scourt_sync_jobs" USING "btree" ("scheduled_at");



CREATE INDEX "idx_scourt_sync_jobs_status" ON "public"."scourt_sync_jobs" USING "btree" ("status");



CREATE INDEX "idx_scourt_sync_jobs_sync_type" ON "public"."scourt_sync_jobs" USING "btree" ("sync_type");



CREATE INDEX "idx_scourt_sync_jobs_tenant_id" ON "public"."scourt_sync_jobs" USING "btree" ("tenant_id");



CREATE INDEX "idx_scourt_sync_logs_action" ON "public"."scourt_sync_logs" USING "btree" ("action");



CREATE INDEX "idx_scourt_sync_logs_created_at" ON "public"."scourt_sync_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_scourt_sync_logs_legal_case_id" ON "public"."scourt_sync_logs" USING "btree" ("legal_case_id");



CREATE INDEX "idx_scourt_sync_logs_profile_id" ON "public"."scourt_sync_logs" USING "btree" ("profile_id");



CREATE INDEX "idx_scourt_sync_logs_status" ON "public"."scourt_sync_logs" USING "btree" ("status");



CREATE INDEX "idx_scourt_sync_logs_tenant_id" ON "public"."scourt_sync_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_scourt_updates_detected_at" ON "public"."scourt_case_updates" USING "btree" ("detected_at" DESC);



CREATE INDEX "idx_scourt_updates_importance" ON "public"."scourt_case_updates" USING "btree" ("importance");



CREATE INDEX "idx_scourt_updates_legal_case" ON "public"."scourt_case_updates" USING "btree" ("legal_case_id");



CREATE INDEX "idx_scourt_updates_type" ON "public"."scourt_case_updates" USING "btree" ("update_type");



CREATE INDEX "idx_scourt_updates_unread_client" ON "public"."scourt_case_updates" USING "btree" ("legal_case_id") WHERE ("is_read_by_client" = false);



CREATE INDEX "idx_scourt_user_settings_user_id" ON "public"."scourt_user_settings" USING "btree" ("user_id");



CREATE INDEX "idx_scourt_user_wmonid_expires_at" ON "public"."scourt_user_wmonid" USING "btree" ("expires_at");



CREATE INDEX "idx_scourt_user_wmonid_expiring" ON "public"."scourt_user_wmonid" USING "btree" ("expires_at") WHERE (("status")::"text" = 'active'::"text");



CREATE INDEX "idx_scourt_user_wmonid_member_id" ON "public"."scourt_user_wmonid" USING "btree" ("member_id");



CREATE INDEX "idx_scourt_user_wmonid_status" ON "public"."scourt_user_wmonid" USING "btree" ("status");



CREATE INDEX "idx_scourt_user_wmonid_tenant_id" ON "public"."scourt_user_wmonid" USING "btree" ("tenant_id");



CREATE INDEX "idx_scourt_user_wmonid_user_id" ON "public"."scourt_user_wmonid" USING "btree" ("user_id");



CREATE INDEX "idx_scourt_xml_cache_case_type" ON "public"."scourt_xml_cache" USING "btree" ("case_type");



CREATE INDEX "idx_scourt_xml_cache_path" ON "public"."scourt_xml_cache" USING "btree" ("xml_path");



CREATE INDEX "idx_semantic_memory_domain" ON "public"."semantic_memory" USING "btree" ("user_id", "domain");



CREATE INDEX "idx_semantic_memory_key" ON "public"."semantic_memory" USING "btree" ("user_id", "entity_key");



CREATE INDEX "idx_semantic_memory_type" ON "public"."semantic_memory" USING "btree" ("user_id", "entity_type");



CREATE INDEX "idx_semantic_memory_user" ON "public"."semantic_memory" USING "btree" ("user_id");



CREATE INDEX "idx_settlements_created_at" ON "public"."monthly_settlements" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_settlements_is_settled" ON "public"."monthly_settlements" USING "btree" ("is_settled");



CREATE INDEX "idx_settlements_settlement_month" ON "public"."monthly_settlements" USING "btree" ("settlement_month" DESC);



CREATE INDEX "idx_sms_logs_consultation" ON "public"."sms_logs" USING "btree" ("consultation_id");



CREATE INDEX "idx_sms_logs_created_at" ON "public"."sms_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sms_logs_status" ON "public"."sms_logs" USING "btree" ("status");



CREATE INDEX "idx_sms_messages_classification" ON "public"."sms_messages" USING "gin" ("classification");



CREATE INDEX "idx_sms_messages_is_processed" ON "public"."sms_messages" USING "btree" ("is_processed");



CREATE INDEX "idx_sms_messages_received_at" ON "public"."sms_messages" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_sms_messages_sender" ON "public"."sms_messages" USING "btree" ("sender");



CREATE INDEX "idx_sms_templates_active" ON "public"."sms_templates" USING "btree" ("is_active");



CREATE INDEX "idx_sms_templates_key" ON "public"."sms_templates" USING "btree" ("template_key");



CREATE INDEX "idx_sms_templates_status" ON "public"."sms_templates" USING "btree" ("trigger_status");



CREATE INDEX "idx_tenant_integrations_provider" ON "public"."tenant_integrations" USING "btree" ("provider");



CREATE INDEX "idx_tenant_integrations_status" ON "public"."tenant_integrations" USING "btree" ("status");



CREATE INDEX "idx_tenant_integrations_tenant_id" ON "public"."tenant_integrations" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_integrations_tenant_provider" ON "public"."tenant_integrations" USING "btree" ("tenant_id", "provider");



CREATE INDEX "idx_tenant_invitations_email" ON "public"."tenant_invitations" USING "btree" ("email");



CREATE INDEX "idx_tenant_invitations_status" ON "public"."tenant_invitations" USING "btree" ("status");



CREATE INDEX "idx_tenant_invitations_tenant_id" ON "public"."tenant_invitations" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_invitations_token" ON "public"."tenant_invitations" USING "btree" ("token");



CREATE INDEX "idx_tenant_members_role" ON "public"."tenant_members" USING "btree" ("role");



CREATE INDEX "idx_tenant_members_status" ON "public"."tenant_members" USING "btree" ("status");



CREATE INDEX "idx_tenant_members_tenant_id" ON "public"."tenant_members" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_members_user_id" ON "public"."tenant_members" USING "btree" ("user_id");



CREATE INDEX "idx_tenant_settings_category" ON "public"."tenant_settings" USING "btree" ("category");



CREATE INDEX "idx_tenant_settings_tenant_id" ON "public"."tenant_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_created_at" ON "public"."tenants" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "idx_tenants_slug" ON "public"."tenants" USING "btree" ("slug");



CREATE INDEX "idx_tenants_status" ON "public"."tenants" USING "btree" ("status");



CREATE INDEX "idx_tenants_type" ON "public"."tenants" USING "btree" ("type");



CREATE INDEX "idx_transactions_created_at" ON "public"."transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_transactions_type" ON "public"."transactions" USING "btree" ("type");



CREATE INDEX "idx_user_memory_importance" ON "public"."user_memory" USING "btree" ("user_id", "importance" DESC);



CREATE INDEX "idx_user_memory_type" ON "public"."user_memory" USING "btree" ("user_id", "memory_type");



CREATE INDEX "idx_user_memory_user_id" ON "public"."user_memory" USING "btree" ("user_id");



CREATE INDEX "idx_user_personas_user" ON "public"."user_personas" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_v4_user" ON "public"."user_profiles_v4" USING "btree" ("user_id");



CREATE INDEX "idx_users_profiles_email" ON "public"."users_profiles" USING "btree" ("email");



CREATE INDEX "idx_users_profiles_role" ON "public"."users_profiles" USING "btree" ("role");



CREATE INDEX "idx_weekly_schedule_day" ON "public"."consultation_weekly_schedule" USING "btree" ("day_of_week", "is_available");



CREATE INDEX "idx_weekly_schedule_lawyer" ON "public"."consultation_weekly_schedule" USING "btree" ("lawyer_name");



CREATE INDEX "idx_withdrawals_month_key" ON "public"."partner_withdrawals" USING "btree" ("month_key");



CREATE INDEX "idx_withdrawals_partner_name" ON "public"."partner_withdrawals" USING "btree" ("partner_name");



CREATE INDEX "idx_withdrawals_settlement_id" ON "public"."partner_withdrawals" USING "btree" ("settlement_id");



CREATE INDEX "idx_withdrawals_withdrawal_date" ON "public"."partner_withdrawals" USING "btree" ("withdrawal_date" DESC);



CREATE INDEX "documents_category_idx" ON "the0"."documents" USING "btree" ("category");



CREATE INDEX "documents_domain_idx" ON "the0"."documents" USING "btree" ("domain");



CREATE INDEX "idx_admin_notifications_created_at" ON "the0"."admin_notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_notifications_type" ON "the0"."admin_notifications" USING "btree" ("notification_type");



CREATE INDEX "idx_admin_notifications_unread" ON "the0"."admin_notifications" USING "btree" ("is_read", "created_at" DESC) WHERE ("is_read" = false);



CREATE INDEX "idx_ai_models_active" ON "the0"."ai_models" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_ai_models_default" ON "the0"."ai_models" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_brief_exports_brief_version_id" ON "the0"."brief_exports" USING "btree" ("brief_version_id");



CREATE INDEX "idx_brief_exports_exported_by" ON "the0"."brief_exports" USING "btree" ("exported_by");



CREATE INDEX "idx_brief_exports_google_doc" ON "the0"."brief_exports" USING "btree" ("google_doc_id");



CREATE INDEX "idx_brief_guidelines_is_active" ON "the0"."brief_guidelines" USING "btree" ("is_active");



CREATE INDEX "idx_brief_guidelines_type" ON "the0"."brief_guidelines" USING "btree" ("brief_type", "case_type");



CREATE INDEX "idx_brief_inputs_case_id" ON "the0"."brief_inputs" USING "btree" ("case_id");



CREATE INDEX "idx_brief_inputs_content_hash" ON "the0"."brief_inputs" USING "btree" ("content_hash");



CREATE INDEX "idx_brief_inputs_created_at" ON "the0"."brief_inputs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_brief_inputs_created_by" ON "the0"."brief_inputs" USING "btree" ("created_by");



CREATE INDEX "idx_brief_sessions_case" ON "the0"."brief_sessions" USING "btree" ("case_id");



CREATE INDEX "idx_brief_sessions_stage" ON "the0"."brief_sessions" USING "btree" ("current_stage");



CREATE INDEX "idx_brief_sessions_type" ON "the0"."brief_sessions" USING "btree" ("brief_type");



CREATE INDEX "idx_brief_templates_brief_type" ON "the0"."brief_templates" USING "btree" ("brief_type");



CREATE INDEX "idx_brief_templates_is_active" ON "the0"."brief_templates" USING "btree" ("is_active");



CREATE INDEX "idx_brief_versions_brief_type" ON "the0"."brief_versions" USING "btree" ("brief_type");



CREATE INDEX "idx_brief_versions_case_id" ON "the0"."brief_versions" USING "btree" ("case_id");



CREATE INDEX "idx_brief_versions_created_by" ON "the0"."brief_versions" USING "btree" ("created_by");



CREATE INDEX "idx_brief_versions_google_doc" ON "the0"."brief_versions" USING "btree" ("google_doc_id");



CREATE INDEX "idx_brief_versions_input_id" ON "the0"."brief_versions" USING "btree" ("input_id");



CREATE INDEX "idx_brief_versions_parent" ON "the0"."brief_versions" USING "btree" ("parent_version_id");



CREATE INDEX "idx_brief_versions_session_id" ON "the0"."brief_versions" USING "btree" ("session_id");



CREATE INDEX "idx_brief_versions_status" ON "the0"."brief_versions" USING "btree" ("status");



CREATE INDEX "idx_case_claim_norms_claim" ON "the0"."case_claim_norms" USING "btree" ("claim_id");



CREATE INDEX "idx_case_claim_norms_norm" ON "the0"."case_claim_norms" USING "btree" ("norm_id");



CREATE INDEX "idx_case_claims_case" ON "the0"."case_claims" USING "btree" ("case_id");



CREATE INDEX "idx_case_claims_embedding" ON "the0"."case_claims" USING "ivfflat" ("current_embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_case_claims_importance" ON "the0"."case_claims" USING "btree" ("importance_score" DESC);



CREATE INDEX "idx_case_claims_side" ON "the0"."case_claims" USING "btree" ("side");



CREATE INDEX "idx_case_claims_type" ON "the0"."case_claims" USING "btree" ("claim_type");



CREATE INDEX "idx_case_issues_case" ON "the0"."case_issues" USING "btree" ("case_id");



CREATE INDEX "idx_case_issues_type" ON "the0"."case_issues" USING "btree" ("issue_type");



CREATE INDEX "idx_case_judgments_case" ON "the0"."case_judgments" USING "btree" ("case_id");



CREATE INDEX "idx_case_judgments_instance" ON "the0"."case_judgments" USING "btree" ("instance_level");



CREATE INDEX "idx_case_judgments_outcome" ON "the0"."case_judgments" USING "btree" ("outcome");



CREATE INDEX "idx_case_summaries_case_id" ON "the0"."case_summaries" USING "btree" ("case_id");



CREATE INDEX "idx_case_summaries_case_number" ON "the0"."case_summaries" USING "btree" ("case_number");



CREATE INDEX "idx_chat_messages_created" ON "the0"."chat_messages" USING "btree" ("created_at");



CREATE INDEX "idx_chat_messages_session" ON "the0"."chat_messages" USING "btree" ("session_id");



CREATE INDEX "idx_chat_sessions_case" ON "the0"."chat_sessions" USING "btree" ("case_id");



CREATE INDEX "idx_chat_sessions_status" ON "the0"."chat_sessions" USING "btree" ("status");



CREATE INDEX "idx_chat_sessions_updated" ON "the0"."chat_sessions" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_chat_sessions_user" ON "the0"."chat_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_citation_validation_logs_case_id" ON "the0"."citation_validation_logs" USING "btree" ("case_id");



CREATE INDEX "idx_citation_validation_logs_created_at" ON "the0"."citation_validation_logs" USING "btree" ("created_at");



CREATE INDEX "idx_claim_evidence_claim" ON "the0"."claim_evidence" USING "btree" ("claim_id");



CREATE INDEX "idx_claim_evidence_role" ON "the0"."claim_evidence" USING "btree" ("role");



CREATE INDEX "idx_claim_evidence_span" ON "the0"."claim_evidence" USING "btree" ("span_id");



CREATE INDEX "idx_claim_evidence_status" ON "the0"."claim_evidence" USING "btree" ("status");



CREATE INDEX "idx_claim_issues_issue" ON "the0"."claim_issues" USING "btree" ("issue_id");



CREATE INDEX "idx_claim_versions_claim" ON "the0"."claim_versions" USING "btree" ("claim_id");



CREATE INDEX "idx_claims_case_id" ON "the0"."claims" USING "btree" ("case_id");



CREATE INDEX "idx_claims_case_party_status" ON "the0"."claims" USING "btree" ("case_id", "party", "status");



CREATE INDEX "idx_claims_created_by" ON "the0"."claims" USING "btree" ("created_by");



CREATE INDEX "idx_claims_document_id" ON "the0"."claims" USING "btree" ("document_id");



CREATE INDEX "idx_claims_is_addressed" ON "the0"."claims" USING "btree" ("is_addressed");



CREATE INDEX "idx_claims_is_confirmed" ON "the0"."claims" USING "btree" ("is_confirmed");



CREATE INDEX "idx_claims_party" ON "the0"."claims" USING "btree" ("party");



CREATE INDEX "idx_claims_status" ON "the0"."claims" USING "btree" ("status");



CREATE INDEX "idx_collab_history_case_id" ON "the0"."collaboration_history" USING "btree" ("case_id");



CREATE INDEX "idx_collab_history_category" ON "the0"."collaboration_history" USING "btree" ("feedback_category");



CREATE INDEX "idx_collab_history_edited_by" ON "the0"."collaboration_history" USING "btree" ("edited_by");



CREATE INDEX "idx_collab_history_target" ON "the0"."collaboration_history" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_confirmed_strategies_case_id" ON "the0"."confirmed_strategies" USING "btree" ("case_id");



CREATE INDEX "idx_confirmed_strategies_confirmed_by" ON "the0"."confirmed_strategies" USING "btree" ("confirmed_by");



CREATE INDEX "idx_context_summaries_case" ON "the0"."context_summaries" USING "btree" ("case_id");



CREATE INDEX "idx_context_summaries_level" ON "the0"."context_summaries" USING "btree" ("level");



CREATE INDEX "idx_context_summaries_stale" ON "the0"."context_summaries" USING "btree" ("is_stale") WHERE ("is_stale" = true);



CREATE INDEX "idx_context_summaries_type" ON "the0"."context_summaries" USING "btree" ("summary_type");



CREATE INDEX "idx_doc_evidence_links_brief" ON "the0"."document_evidence_links" USING "btree" ("brief_document_id");



CREATE INDEX "idx_doc_evidence_links_evidence" ON "the0"."document_evidence_links" USING "btree" ("evidence_document_id");



CREATE INDEX "idx_doc_evidence_links_evidence_number" ON "the0"."document_evidence_links" USING "btree" ("evidence_number");



CREATE INDEX "idx_doc_templates_brief_type" ON "the0"."doc_templates" USING "btree" ("brief_type");



CREATE UNIQUE INDEX "idx_doc_templates_default_per_type" ON "the0"."doc_templates" USING "btree" ("brief_type") WHERE (("is_default" = true) AND ("is_active" = true));



CREATE INDEX "idx_doc_templates_is_active" ON "the0"."doc_templates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_doc_templates_is_default" ON "the0"."doc_templates" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_documents_analysis_status" ON "the0"."documents" USING "btree" ("analysis_status");



CREATE INDEX "idx_documents_case_doc_type" ON "the0"."documents" USING "btree" ("case_id", "doc_type") WHERE ("case_id" IS NOT NULL);



CREATE INDEX "idx_documents_case_id" ON "the0"."documents" USING "btree" ("case_id");



CREATE INDEX "idx_documents_doc_type" ON "the0"."documents" USING "btree" ("doc_type");



CREATE INDEX "idx_documents_domain_doc_type" ON "the0"."documents" USING "btree" ("domain", "doc_type");



CREATE INDEX "idx_documents_embedding_hnsw" ON "the0"."documents" USING "hnsw" ("embedding" "public"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_documents_fts" ON "the0"."documents" USING "gin" ("fts_content");



CREATE INDEX "idx_documents_is_deleted" ON "the0"."documents" USING "btree" ("is_deleted");



CREATE INDEX "idx_documents_is_parent" ON "the0"."documents" USING "btree" ("is_parent");



CREATE INDEX "idx_documents_parent_id" ON "the0"."documents" USING "btree" ("parent_id");



CREATE INDEX "idx_draft_chunks_case" ON "the0"."draft_chunks" USING "btree" ("case_id");



CREATE INDEX "idx_draft_chunks_issue" ON "the0"."draft_chunks" USING "btree" ("issue_id");



CREATE INDEX "idx_draft_chunks_session" ON "the0"."draft_chunks" USING "btree" ("brief_session_id");



CREATE INDEX "idx_draft_chunks_status" ON "the0"."draft_chunks" USING "btree" ("status");



CREATE INDEX "idx_drafts_temp_case" ON "the0"."drafts_temp" USING "btree" ("case_id");



CREATE INDEX "idx_drafts_temp_expires" ON "the0"."drafts_temp" USING "btree" ("expires_at");



CREATE UNIQUE INDEX "idx_drafts_temp_unique" ON "the0"."drafts_temp" USING "btree" ("user_id", "session_id", "draft_type");



CREATE INDEX "idx_drafts_temp_user" ON "the0"."drafts_temp" USING "btree" ("user_id");



CREATE INDEX "idx_evidence_documents_file" ON "the0"."evidence_documents" USING "btree" ("file_id");



CREATE INDEX "idx_evidence_documents_page" ON "the0"."evidence_documents" USING "btree" ("file_id", "page_number");



CREATE INDEX "idx_evidence_files_case" ON "the0"."evidence_files" USING "btree" ("case_id");



CREATE INDEX "idx_evidence_files_drive" ON "the0"."evidence_files" USING "btree" ("drive_file_id");



CREATE INDEX "idx_evidence_files_label" ON "the0"."evidence_files" USING "btree" ("exhibit_label");



CREATE INDEX "idx_evidence_files_side" ON "the0"."evidence_files" USING "btree" ("party_side");



CREATE INDEX "idx_evidence_links_case_id" ON "the0"."evidence_links" USING "btree" ("case_id");



CREATE INDEX "idx_evidence_links_claim_id" ON "the0"."evidence_links" USING "btree" ("claim_id");



CREATE INDEX "idx_evidence_links_document_id" ON "the0"."evidence_links" USING "btree" ("document_id");



CREATE INDEX "idx_evidence_links_drive_file" ON "the0"."evidence_links" USING "btree" ("drive_file_id");



CREATE INDEX "idx_evidence_links_evidence_id" ON "the0"."evidence_links" USING "btree" ("evidence_id");



CREATE INDEX "idx_evidence_links_rebuttal_id" ON "the0"."evidence_links" USING "btree" ("rebuttal_id");



CREATE INDEX "idx_evidence_links_status" ON "the0"."evidence_links" USING "btree" ("status");



CREATE INDEX "idx_evidence_links_type" ON "the0"."evidence_links" USING "btree" ("link_type");



CREATE INDEX "idx_evidence_requests_case" ON "the0"."evidence_requests" USING "btree" ("case_id");



CREATE INDEX "idx_evidence_requests_status" ON "the0"."evidence_requests" USING "btree" ("response_status");



CREATE INDEX "idx_evidence_requests_type" ON "the0"."evidence_requests" USING "btree" ("request_type");



CREATE INDEX "idx_financial_records_amount" ON "the0"."financial_records" USING "btree" ("amount");



CREATE INDEX "idx_financial_records_case_id" ON "the0"."financial_records" USING "btree" ("case_id");



CREATE INDEX "idx_financial_records_category" ON "the0"."financial_records" USING "btree" ("category");



CREATE INDEX "idx_financial_records_date" ON "the0"."financial_records" USING "btree" ("transaction_date");



CREATE INDEX "idx_financial_records_disputed" ON "the0"."financial_records" USING "btree" ("is_disputed") WHERE ("is_disputed" = true);



CREATE INDEX "idx_ingested_files_case_id" ON "the0"."ingested_files" USING "btree" ("case_id");



CREATE INDEX "idx_ingested_files_doc_type" ON "the0"."ingested_files" USING "btree" ("doc_type");



CREATE INDEX "idx_ingested_files_drive_id" ON "the0"."ingested_files" USING "btree" ("drive_file_id");



CREATE INDEX "idx_ingested_files_is_deleted" ON "the0"."ingested_files" USING "btree" ("is_deleted");



CREATE INDEX "idx_invitations_invited_by" ON "the0"."user_invitations" USING "btree" ("invited_by");



CREATE INDEX "idx_invitations_phone" ON "the0"."user_invitations" USING "btree" ("phone");



CREATE INDEX "idx_invitations_status" ON "the0"."user_invitations" USING "btree" ("status");



CREATE INDEX "idx_issue_position_versions_issue" ON "the0"."issue_position_versions" USING "btree" ("issue_id");



CREATE INDEX "idx_issue_templates_case_type" ON "the0"."case_type_issue_templates" USING "btree" ("case_type");



CREATE INDEX "idx_legal_cases_ext_case_key" ON "the0"."legal_cases_ext" USING "btree" ("case_key");



CREATE INDEX "idx_legal_norms_code" ON "the0"."legal_norms" USING "btree" ("code");



CREATE INDEX "idx_legal_norms_embedding" ON "the0"."legal_norms" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_legal_norms_tags" ON "the0"."legal_norms" USING "gin" ("tags");



CREATE INDEX "idx_legal_norms_type" ON "the0"."legal_norms" USING "btree" ("norm_type");



CREATE INDEX "idx_opponent_briefs_case_id" ON "the0"."opponent_briefs" USING "btree" ("case_id");



CREATE INDEX "idx_opponent_briefs_created_at" ON "the0"."opponent_briefs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pending_files_created_at" ON "the0"."pending_files" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pending_files_status" ON "the0"."pending_files" USING "btree" ("status");



CREATE INDEX "idx_pipeline_reviews_case_id" ON "the0"."pipeline_reviews" USING "btree" ("case_id");



CREATE INDEX "idx_pipeline_reviews_created_at" ON "the0"."pipeline_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pipeline_reviews_file_id" ON "the0"."pipeline_reviews" USING "btree" ("file_id");



CREATE INDEX "idx_pipeline_reviews_status" ON "the0"."pipeline_reviews" USING "btree" ("status");



CREATE INDEX "idx_precedent_cache_case_number" ON "the0"."precedent_cache" USING "btree" ("case_number");



CREATE INDEX "idx_precedent_cache_court" ON "the0"."precedent_cache" USING "btree" ("court");



CREATE INDEX "idx_precedent_cache_expires_at" ON "the0"."precedent_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_prompt_feedback_prompt" ON "the0"."prompt_feedback" USING "btree" ("prompt_id");



CREATE INDEX "idx_prompt_history_prompt" ON "the0"."prompt_history" USING "btree" ("prompt_id");



CREATE INDEX "idx_prompts_active" ON "the0"."prompts" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_prompts_category" ON "the0"."prompts" USING "btree" ("category");



CREATE INDEX "idx_prompts_domain" ON "the0"."prompts" USING "btree" ("domain");



CREATE INDEX "idx_prompts_domain_category" ON "the0"."prompts" USING "btree" ("domain", "category");



CREATE INDEX "idx_prompts_domain_name" ON "the0"."prompts" USING "btree" ("domain", "name");



CREATE INDEX "idx_reasoning_logs_brief_session" ON "the0"."reasoning_logs" USING "btree" ("brief_session_id");



CREATE INDEX "idx_reasoning_logs_session" ON "the0"."reasoning_logs" USING "btree" ("session_id");



CREATE INDEX "idx_reasoning_logs_strategy" ON "the0"."reasoning_logs" USING "btree" ("selected_strategy");



CREATE INDEX "idx_rebuttals_case_id" ON "the0"."rebuttals" USING "btree" ("case_id");



CREATE INDEX "idx_rebuttals_claim_id" ON "the0"."rebuttals" USING "btree" ("claim_id");



CREATE INDEX "idx_rebuttals_claim_status" ON "the0"."rebuttals" USING "btree" ("claim_id", "status");



CREATE INDEX "idx_rebuttals_is_confirmed" ON "the0"."rebuttals" USING "btree" ("is_confirmed");



CREATE INDEX "idx_rebuttals_is_draft" ON "the0"."rebuttals" USING "btree" ("is_draft");



CREATE INDEX "idx_rebuttals_status" ON "the0"."rebuttals" USING "btree" ("status");



CREATE INDEX "idx_statute_cache_expires_at" ON "the0"."statute_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_statute_cache_law_article" ON "the0"."statute_cache" USING "btree" ("law_name", "article_number");



CREATE INDEX "idx_statute_cache_law_name" ON "the0"."statute_cache" USING "btree" ("law_name");



CREATE INDEX "idx_temp_uploads_case" ON "the0"."temp_uploads" USING "btree" ("case_id");



CREATE INDEX "idx_temp_uploads_expires" ON "the0"."temp_uploads" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_temp_uploads_session" ON "the0"."temp_uploads" USING "btree" ("session_id");



CREATE INDEX "idx_temp_uploads_status" ON "the0"."temp_uploads" USING "btree" ("status");



CREATE INDEX "idx_temp_uploads_user" ON "the0"."temp_uploads" USING "btree" ("uploaded_by");



CREATE INDEX "idx_user_profiles_organization" ON "the0"."user_profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_user_profiles_role" ON "the0"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_users_profiles_email" ON "the0"."users_profiles" USING "btree" ("email");



CREATE INDEX "idx_users_profiles_role" ON "the0"."users_profiles" USING "btree" ("role");



CREATE INDEX "idx_work_sessions_case" ON "the0"."work_sessions" USING "btree" ("case_id");



CREATE INDEX "idx_work_sessions_status" ON "the0"."work_sessions" USING "btree" ("status");



CREATE INDEX "idx_work_sessions_user" ON "the0"."work_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_work_tasks_session" ON "the0"."work_tasks" USING "btree" ("session_id");



CREATE INDEX "idx_work_tasks_status" ON "the0"."work_tasks" USING "btree" ("status");



CREATE INDEX "chat_logs_session_idx" ON "theai"."chat_logs" USING "btree" ("session_id", "created_at");



CREATE INDEX "documents_category_idx" ON "theai"."documents" USING "btree" ("category");



CREATE INDEX "documents_domain_idx" ON "theai"."documents" USING "btree" ("domain");



CREATE INDEX "idx_case_summaries_case_id" ON "theai"."case_summaries" USING "btree" ("case_id");



CREATE INDEX "idx_case_summaries_case_number" ON "theai"."case_summaries" USING "btree" ("case_number");



CREATE INDEX "idx_claims_case_id" ON "theai"."claims" USING "btree" ("case_id");



CREATE INDEX "idx_claims_case_party_status" ON "theai"."claims" USING "btree" ("case_id", "party", "status");



CREATE INDEX "idx_claims_document_id" ON "theai"."claims" USING "btree" ("document_id");



CREATE INDEX "idx_claims_party" ON "theai"."claims" USING "btree" ("party");



CREATE INDEX "idx_claims_status" ON "theai"."claims" USING "btree" ("status");



CREATE INDEX "idx_doc_evidence_links_brief" ON "theai"."document_evidence_links" USING "btree" ("brief_document_id");



CREATE INDEX "idx_doc_evidence_links_evidence" ON "theai"."document_evidence_links" USING "btree" ("evidence_document_id");



CREATE INDEX "idx_doc_evidence_links_evidence_number" ON "theai"."document_evidence_links" USING "btree" ("evidence_number");



CREATE INDEX "idx_documents_analysis_status" ON "theai"."documents" USING "btree" ("analysis_status");



CREATE INDEX "idx_documents_case_doc_type" ON "theai"."documents" USING "btree" ("case_id", "doc_type") WHERE ("case_id" IS NOT NULL);



CREATE INDEX "idx_documents_case_id" ON "theai"."documents" USING "btree" ("case_id");



CREATE INDEX "idx_documents_doc_type" ON "theai"."documents" USING "btree" ("doc_type");



CREATE INDEX "idx_documents_domain_doc_type" ON "theai"."documents" USING "btree" ("domain", "doc_type");



CREATE INDEX "idx_documents_embedding_hnsw" ON "theai"."documents" USING "hnsw" ("embedding" "public"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_documents_fts" ON "theai"."documents" USING "gin" ("fts_content");



CREATE INDEX "idx_documents_is_deleted" ON "theai"."documents" USING "btree" ("is_deleted");



CREATE INDEX "idx_documents_is_parent" ON "theai"."documents" USING "btree" ("is_parent");



CREATE INDEX "idx_documents_parent_id" ON "theai"."documents" USING "btree" ("parent_id");



CREATE INDEX "idx_documents_party" ON "theai"."documents" USING "btree" ("party");



CREATE INDEX "idx_evidence_links_claim_id" ON "theai"."evidence_links" USING "btree" ("claim_id");



CREATE INDEX "idx_evidence_links_document_id" ON "theai"."evidence_links" USING "btree" ("document_id");



CREATE INDEX "idx_evidence_links_type" ON "theai"."evidence_links" USING "btree" ("link_type");



CREATE INDEX "idx_financial_records_amount" ON "theai"."financial_records" USING "btree" ("amount");



CREATE INDEX "idx_financial_records_case_id" ON "theai"."financial_records" USING "btree" ("case_id");



CREATE INDEX "idx_financial_records_date" ON "theai"."financial_records" USING "btree" ("transaction_date");



CREATE INDEX "idx_ingested_files_case_id" ON "theai"."ingested_files" USING "btree" ("case_id");



CREATE INDEX "idx_ingested_files_doc_type" ON "theai"."ingested_files" USING "btree" ("doc_type");



CREATE INDEX "idx_ingested_files_drive_id" ON "theai"."ingested_files" USING "btree" ("drive_file_id");



CREATE INDEX "idx_ingested_files_is_deleted" ON "theai"."ingested_files" USING "btree" ("is_deleted");



CREATE INDEX "idx_legal_cases_case_type" ON "theai"."legal_cases" USING "btree" ("case_type");



CREATE INDEX "idx_legal_cases_court_case_number" ON "theai"."legal_cases" USING "btree" ("court_case_number");



CREATE INDEX "idx_legal_cases_status" ON "theai"."legal_cases" USING "btree" ("status");



CREATE INDEX "idx_rebuttals_claim_id" ON "theai"."rebuttals" USING "btree" ("claim_id");



CREATE INDEX "idx_rebuttals_claim_status" ON "theai"."rebuttals" USING "btree" ("claim_id", "status");



CREATE INDEX "idx_rebuttals_status" ON "theai"."rebuttals" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "blocked_times_updated_at" BEFORE UPDATE ON "public"."blocked_times" FOR EACH ROW EXECUTE FUNCTION "public"."update_blocked_times_updated_at"();



CREATE OR REPLACE TRIGGER "bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "calculate_deadline_dates_trigger" BEFORE INSERT OR UPDATE OF "trigger_date", "deadline_type" ON "public"."case_deadlines" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_deadline_dates"();



CREATE OR REPLACE TRIGGER "cases_search_update" BEFORE INSERT OR UPDATE ON "public"."testimonial_cases" FOR EACH ROW EXECUTE FUNCTION "public"."cases_search_trigger"();



CREATE OR REPLACE TRIGGER "check_wmonid_limit_before_insert" BEFORE INSERT ON "public"."scourt_profile_cases" FOR EACH ROW WHEN (("new"."user_wmonid_id" IS NOT NULL)) EXECUTE FUNCTION "public"."check_wmonid_case_limit"();



CREATE OR REPLACE TRIGGER "consultation_settings_updated_at" BEFORE UPDATE ON "public"."consultation_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_consultation_settings_updated_at"();



CREATE OR REPLACE TRIGGER "consultations_updated_at" BEFORE UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "expenses_updated_at_trigger" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_expenses_updated_at"();



CREATE OR REPLACE TRIGGER "faqs_search_update" BEFORE INSERT OR UPDATE ON "public"."faqs" FOR EACH ROW EXECUTE FUNCTION "public"."faqs_search_trigger"();



CREATE OR REPLACE TRIGGER "general_schedules_updated_at" BEFORE UPDATE ON "public"."general_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "monthly_settlements_updated_at_trigger" BEFORE UPDATE ON "public"."monthly_settlements" FOR EACH ROW EXECUTE FUNCTION "public"."update_monthly_settlements_updated_at"();



CREATE OR REPLACE TRIGGER "partner_withdrawals_updated_at_trigger" BEFORE UPDATE ON "public"."partner_withdrawals" FOR EACH ROW EXECUTE FUNCTION "public"."update_partner_withdrawals_updated_at"();



CREATE OR REPLACE TRIGGER "payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "recurring_templates_updated_at_trigger" BEFORE UPDATE ON "public"."recurring_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_recurring_templates_updated_at"();



CREATE OR REPLACE TRIGGER "set_consultations_status_timestamps" BEFORE UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_consultation_status_timestamps"();



CREATE OR REPLACE TRIGGER "set_consultations_updated_at" BEFORE UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_case_contracts_updated_at" BEFORE UPDATE ON "public"."case_contracts" FOR EACH ROW EXECUTE FUNCTION "public"."update_case_contracts_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_case_parties_updated_at" BEFORE UPDATE ON "public"."case_parties" FOR EACH ROW EXECUTE FUNCTION "public"."update_case_parties_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_consultation_sources_updated_at" BEFORE UPDATE ON "public"."consultation_sources" FOR EACH ROW EXECUTE FUNCTION "public"."update_consultation_sources_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_date_exceptions_updated_at" BEFORE UPDATE ON "public"."consultation_date_exceptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_date_exceptions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_dfc_updated_at" BEFORE UPDATE ON "public"."drive_file_classifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_dfc_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_log_consultation_activity" AFTER INSERT OR UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."log_consultation_activity"();



CREATE OR REPLACE TRIGGER "trigger_scourt_profile_case_count" AFTER INSERT OR DELETE ON "public"."scourt_profile_cases" FOR EACH ROW EXECUTE FUNCTION "public"."update_scourt_profile_case_count"();



CREATE OR REPLACE TRIGGER "trigger_scourt_profile_cases_wmonid_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."scourt_profile_cases" FOR EACH ROW EXECUTE FUNCTION "public"."update_scourt_user_wmonid_case_count"();



CREATE OR REPLACE TRIGGER "trigger_scourt_profiles_updated_at" BEFORE UPDATE ON "public"."scourt_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_scourt_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_scourt_sync_jobs_updated_at" BEFORE UPDATE ON "public"."scourt_sync_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_scourt_sync_jobs_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_scourt_unread_count" AFTER INSERT OR DELETE OR UPDATE OF "is_read_by_client" ON "public"."scourt_case_updates" FOR EACH ROW EXECUTE FUNCTION "public"."update_scourt_unread_count"();



CREATE OR REPLACE TRIGGER "trigger_scourt_user_settings_updated_at" BEFORE UPDATE ON "public"."scourt_user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_scourt_user_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_scourt_user_wmonid_updated_at" BEFORE UPDATE ON "public"."scourt_user_wmonid" FOR EACH ROW EXECUTE FUNCTION "public"."update_scourt_user_wmonid_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_tenant_settings_updated_at" BEFORE UPDATE ON "public"."tenant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_tenant_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_consultation_source_usage" AFTER INSERT OR DELETE OR UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."update_consultation_source_usage_count"();



CREATE OR REPLACE TRIGGER "trigger_update_expenses_month_key" BEFORE INSERT OR UPDATE OF "expense_date" ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_expenses_month_key"();



CREATE OR REPLACE TRIGGER "trigger_update_payments_month_key" BEFORE INSERT OR UPDATE OF "payment_date" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_payments_month_key"();



CREATE OR REPLACE TRIGGER "trigger_user_memory_updated_at" BEFORE UPDATE ON "public"."user_memory" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_memory_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_weekly_schedule_updated_at" BEFORE UPDATE ON "public"."consultation_weekly_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_weekly_schedule_updated_at"();



CREATE OR REPLACE TRIGGER "update_case_deadlines_updated_at" BEFORE UPDATE ON "public"."case_deadlines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_court_hearings_updated_at" BEFORE UPDATE ON "public"."court_hearings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_schedules_updated_at" BEFORE UPDATE ON "public"."notification_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_updated_at"();



CREATE OR REPLACE TRIGGER "update_notification_templates_updated_at" BEFORE UPDATE ON "public"."notification_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_updated_at"();



CREATE OR REPLACE TRIGGER "update_semantic_memory_updated_at" BEFORE UPDATE ON "public"."semantic_memory" FOR EACH ROW EXECUTE FUNCTION "public"."update_v4_updated_at"();



CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_integrations_updated_at" BEFORE UPDATE ON "public"."tenant_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_members_updated_at" BEFORE UPDATE ON "public"."tenant_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_personas_updated_at" BEFORE UPDATE ON "public"."user_personas" FOR EACH ROW EXECUTE FUNCTION "public"."update_v4_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_profiles_v4_updated_at" BEFORE UPDATE ON "public"."user_profiles_v4" FOR EACH ROW EXECUTE FUNCTION "public"."update_v4_updated_at"();



CREATE OR REPLACE TRIGGER "wmonid_limit_warning_trigger" AFTER UPDATE OF "case_count" ON "public"."scourt_user_wmonid" FOR EACH ROW WHEN (("new"."case_count" >= 45)) EXECUTE FUNCTION "public"."notify_wmonid_limit_warning"();



CREATE OR REPLACE TRIGGER "ai_models_single_default" BEFORE INSERT OR UPDATE ON "the0"."ai_models" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "the0"."ensure_single_default_model"();



CREATE OR REPLACE TRIGGER "ai_models_updated_at" BEFORE UPDATE ON "the0"."ai_models" FOR EACH ROW EXECUTE FUNCTION "the0"."update_ai_models_timestamp"();



CREATE OR REPLACE TRIGGER "brief_templates_updated_at" BEFORE UPDATE ON "the0"."brief_templates" FOR EACH ROW EXECUTE FUNCTION "the0"."update_updated_at"();



CREATE OR REPLACE TRIGGER "brief_versions_updated_at" BEFORE UPDATE ON "the0"."brief_versions" FOR EACH ROW EXECUTE FUNCTION "the0"."update_updated_at"();



CREATE OR REPLACE TRIGGER "case_summaries_updated_at" BEFORE UPDATE ON "the0"."case_summaries" FOR EACH ROW EXECUTE FUNCTION "the0"."update_case_summaries_updated_at"();



CREATE OR REPLACE TRIGGER "claims_updated_at" BEFORE UPDATE ON "the0"."claims" FOR EACH ROW EXECUTE FUNCTION "the0"."update_claims_timestamp"();



CREATE OR REPLACE TRIGGER "doc_templates_updated_at" BEFORE UPDATE ON "the0"."doc_templates" FOR EACH ROW EXECUTE FUNCTION "the0"."update_updated_at"();



CREATE OR REPLACE TRIGGER "documents_updated_at" BEFORE UPDATE ON "the0"."documents" FOR EACH ROW EXECUTE FUNCTION "the0"."update_updated_at"();



CREATE OR REPLACE TRIGGER "ingested_files_updated_at" BEFORE UPDATE ON "the0"."ingested_files" FOR EACH ROW EXECUTE FUNCTION "the0"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "normalize_phone_before_insert" BEFORE INSERT ON "the0"."user_invitations" FOR EACH ROW EXECUTE FUNCTION "the0"."normalize_invitation_phone"();



CREATE OR REPLACE TRIGGER "on_chat_message_insert" AFTER INSERT ON "the0"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "the0"."update_session_on_message"();



CREATE OR REPLACE TRIGGER "rebuttals_updated_at" BEFORE UPDATE ON "the0"."rebuttals" FOR EACH ROW EXECUTE FUNCTION "the0"."update_claims_timestamp"();



CREATE OR REPLACE TRIGGER "trg_brief_sessions_updated_at" BEFORE UPDATE ON "the0"."brief_sessions" FOR EACH ROW EXECUTE FUNCTION "the0"."update_brief_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "trg_case_claims_updated_at" BEFORE UPDATE ON "the0"."case_claims" FOR EACH ROW EXECUTE FUNCTION "the0"."update_case_claims_updated_at"();



CREATE OR REPLACE TRIGGER "trg_case_issues_updated_at" BEFORE UPDATE ON "the0"."case_issues" FOR EACH ROW EXECUTE FUNCTION "the0"."update_case_issues_updated_at"();



CREATE OR REPLACE TRIGGER "trg_draft_chunks_updated_at" BEFORE UPDATE ON "the0"."draft_chunks" FOR EACH ROW EXECUTE FUNCTION "the0"."update_draft_chunks_updated_at"();



CREATE OR REPLACE TRIGGER "trg_evidence_files_updated_at" BEFORE UPDATE ON "the0"."evidence_files" FOR EACH ROW EXECUTE FUNCTION "the0"."update_evidence_files_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invalidate_summaries_claims" AFTER INSERT OR UPDATE ON "the0"."case_claims" FOR EACH ROW EXECUTE FUNCTION "the0"."invalidate_context_summaries"();



CREATE OR REPLACE TRIGGER "trg_invalidate_summaries_issues" AFTER INSERT OR UPDATE ON "the0"."case_issues" FOR EACH ROW EXECUTE FUNCTION "the0"."invalidate_context_summaries"();



CREATE OR REPLACE TRIGGER "trg_legal_cases_ext_updated_at" BEFORE UPDATE ON "the0"."legal_cases_ext" FOR EACH ROW EXECUTE FUNCTION "the0"."update_legal_cases_ext_updated_at"();



CREATE OR REPLACE TRIGGER "trg_work_sessions_updated_at" BEFORE UPDATE ON "the0"."work_sessions" FOR EACH ROW EXECUTE FUNCTION "the0"."update_work_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_drafts_temp_updated" BEFORE UPDATE ON "the0"."drafts_temp" FOR EACH ROW EXECUTE FUNCTION "the0"."update_temp_uploads_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_prompts_updated_at" BEFORE UPDATE ON "the0"."prompts" FOR EACH ROW EXECUTE FUNCTION "the0"."update_prompt_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_temp_uploads_updated" BEFORE UPDATE ON "the0"."temp_uploads" FOR EACH ROW EXECUTE FUNCTION "the0"."update_temp_uploads_timestamp"();



CREATE OR REPLACE TRIGGER "update_chat_sessions_updated_at" BEFORE UPDATE ON "the0"."chat_sessions" FOR EACH ROW EXECUTE FUNCTION "the0"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "the0"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "the0"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_users_profiles_updated_at" BEFORE UPDATE ON "the0"."users_profiles" FOR EACH ROW EXECUTE FUNCTION "the0"."update_users_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "case_summaries_updated_at" BEFORE UPDATE ON "theai"."case_summaries" FOR EACH ROW EXECUTE FUNCTION "theai"."update_case_summaries_updated_at"();



CREATE OR REPLACE TRIGGER "claims_updated_at" BEFORE UPDATE ON "theai"."claims" FOR EACH ROW EXECUTE FUNCTION "theai"."update_claims_timestamp"();



CREATE OR REPLACE TRIGGER "legal_cases_updated_at" BEFORE UPDATE ON "theai"."legal_cases" FOR EACH ROW EXECUTE FUNCTION "theai"."update_updated_at"();



CREATE OR REPLACE TRIGGER "rebuttals_updated_at" BEFORE UPDATE ON "theai"."rebuttals" FOR EACH ROW EXECUTE FUNCTION "theai"."update_claims_timestamp"();



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_contracts"
    ADD CONSTRAINT "case_contracts_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_contracts"
    ADD CONSTRAINT "case_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."case_deadlines"
    ADD CONSTRAINT "case_deadlines_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id");



ALTER TABLE ONLY "public"."case_deadlines"
    ADD CONSTRAINT "case_deadlines_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."case_parties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_deadlines"
    ADD CONSTRAINT "case_deadlines_scourt_update_id_fkey" FOREIGN KEY ("scourt_update_id") REFERENCES "public"."scourt_case_updates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_parties"
    ADD CONSTRAINT "case_parties_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_parties"
    ADD CONSTRAINT "case_parties_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."case_parties"
    ADD CONSTRAINT "case_parties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."case_relations"
    ADD CONSTRAINT "case_relations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_relations"
    ADD CONSTRAINT "case_relations_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_representatives"
    ADD CONSTRAINT "case_representatives_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_representatives"
    ADD CONSTRAINT "case_representatives_case_party_id_fkey" FOREIGN KEY ("case_party_id") REFERENCES "public"."case_parties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_representatives"
    ADD CONSTRAINT "case_representatives_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."case_schedules"
    ADD CONSTRAINT "case_schedules_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultation_activity_log"
    ADD CONSTRAINT "consultation_activity_log_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultation_date_exceptions"
    ADD CONSTRAINT "consultation_date_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultation_weekly_schedule"
    ADD CONSTRAINT "consultation_weekly_schedule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_assigned_member_id_fkey" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."tenant_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_converted_to_case_id_fkey" FOREIGN KEY ("converted_to_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_hearings"
    ADD CONSTRAINT "court_hearings_attending_lawyer_id_fkey" FOREIGN KEY ("attending_lawyer_id") REFERENCES "public"."tenant_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."court_hearings"
    ADD CONSTRAINT "court_hearings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id");



ALTER TABLE ONLY "public"."deadline_extensions"
    ADD CONSTRAINT "deadline_extensions_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "public"."case_deadlines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dismissed_case_notices"
    ADD CONSTRAINT "dismissed_case_notices_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dismissed_case_notices"
    ADD CONSTRAINT "dismissed_case_notices_dismissed_by_fkey" FOREIGN KEY ("dismissed_by") REFERENCES "public"."tenant_members"("id");



ALTER TABLE ONLY "public"."dismissed_related_cases"
    ADD CONSTRAINT "dismissed_related_cases_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drive_file_classifications"
    ADD CONSTRAINT "drive_file_classifications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."episodic_memory"
    ADD CONSTRAINT "episodic_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "fk_expenses_recurring_template" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."recurring_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_withdrawals"
    ADD CONSTRAINT "fk_partner_withdrawals_settlement" FOREIGN KEY ("settlement_id") REFERENCES "public"."monthly_settlements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."general_schedules"
    ADD CONSTRAINT "general_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users_profiles"("id");



ALTER TABLE ONLY "public"."general_schedules"
    ADD CONSTRAINT "general_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legal_cases"
    ADD CONSTRAINT "legal_cases_assigned_member_id_fkey" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."tenant_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_cases"
    ADD CONSTRAINT "legal_cases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."tenant_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_cases"
    ADD CONSTRAINT "legal_cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_cases"
    ADD CONSTRAINT "legal_cases_main_case_id_fkey" FOREIGN KEY ("main_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_cases"
    ADD CONSTRAINT "legal_cases_scourt_last_snapshot_id_fkey" FOREIGN KEY ("scourt_last_snapshot_id") REFERENCES "public"."scourt_case_snapshots"("id");



ALTER TABLE ONLY "public"."legal_cases"
    ADD CONSTRAINT "legal_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_schedules"
    ADD CONSTRAINT "notification_schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_case_party_id_fkey" FOREIGN KEY ("case_party_id") REFERENCES "public"."case_parties"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_calendar_events"
    ADD CONSTRAINT "pending_calendar_events_matched_case_id_fkey" FOREIGN KEY ("matched_case_id") REFERENCES "public"."legal_cases"("id");



ALTER TABLE ONLY "public"."persona_feedback_logs"
    ADD CONSTRAINT "persona_feedback_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receivable_memos"
    ADD CONSTRAINT "receivable_memos_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receivable_memos"
    ADD CONSTRAINT "receivable_memos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receivable_memos"
    ADD CONSTRAINT "receivable_memos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receivable_writeoffs"
    ADD CONSTRAINT "receivable_writeoffs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receivable_writeoffs"
    ADD CONSTRAINT "receivable_writeoffs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."receivable_writeoffs"
    ADD CONSTRAINT "receivable_writeoffs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_case_snapshots"
    ADD CONSTRAINT "scourt_case_snapshots_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_case_snapshots"
    ADD CONSTRAINT "scourt_case_snapshots_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."scourt_profiles"("id");



ALTER TABLE ONLY "public"."scourt_case_snapshots"
    ADD CONSTRAINT "scourt_case_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_case_updates"
    ADD CONSTRAINT "scourt_case_updates_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_case_updates"
    ADD CONSTRAINT "scourt_case_updates_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."scourt_case_snapshots"("id");



ALTER TABLE ONLY "public"."scourt_case_updates"
    ADD CONSTRAINT "scourt_case_updates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_profile_cases"
    ADD CONSTRAINT "scourt_profile_cases_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scourt_profile_cases"
    ADD CONSTRAINT "scourt_profile_cases_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."scourt_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_profile_cases"
    ADD CONSTRAINT "scourt_profile_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_profile_cases"
    ADD CONSTRAINT "scourt_profile_cases_user_wmonid_id_fkey" FOREIGN KEY ("user_wmonid_id") REFERENCES "public"."scourt_user_wmonid"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scourt_profiles"
    ADD CONSTRAINT "scourt_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."tenant_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scourt_profiles"
    ADD CONSTRAINT "scourt_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_sync_jobs"
    ADD CONSTRAINT "scourt_sync_jobs_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_sync_jobs"
    ADD CONSTRAINT "scourt_sync_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scourt_sync_logs"
    ADD CONSTRAINT "scourt_sync_logs_legal_case_id_fkey" FOREIGN KEY ("legal_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scourt_sync_logs"
    ADD CONSTRAINT "scourt_sync_logs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."scourt_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scourt_sync_logs"
    ADD CONSTRAINT "scourt_sync_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_user_wmonid"
    ADD CONSTRAINT "scourt_user_wmonid_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."tenant_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scourt_user_wmonid"
    ADD CONSTRAINT "scourt_user_wmonid_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scourt_user_wmonid"
    ADD CONSTRAINT "scourt_user_wmonid_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."semantic_memory"
    ADD CONSTRAINT "semantic_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenant_invitations"
    ADD CONSTRAINT "tenant_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testimonial_evidence_photos"
    ADD CONSTRAINT "testimonial_evidence_photos_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."testimonial_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_sms_message_id_fkey" FOREIGN KEY ("sms_message_id") REFERENCES "public"."sms_messages"("id");



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_personas"
    ADD CONSTRAINT "user_personas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles_v4"
    ADD CONSTRAINT "user_profiles_v4_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users_profiles"
    ADD CONSTRAINT "users_profiles_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_read_by_fkey" FOREIGN KEY ("read_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_related_pending_id_fkey" FOREIGN KEY ("related_pending_id") REFERENCES "the0"."pending_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."brief_exports"
    ADD CONSTRAINT "brief_exports_brief_version_id_fkey" FOREIGN KEY ("brief_version_id") REFERENCES "the0"."brief_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."brief_exports"
    ADD CONSTRAINT "brief_exports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "the0"."doc_templates"("id");



ALTER TABLE ONLY "the0"."brief_inputs"
    ADD CONSTRAINT "brief_inputs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."brief_inputs"
    ADD CONSTRAINT "brief_inputs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."brief_sessions"
    ADD CONSTRAINT "brief_sessions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."brief_versions"
    ADD CONSTRAINT "brief_versions_input_id_fkey" FOREIGN KEY ("input_id") REFERENCES "the0"."brief_inputs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."brief_versions"
    ADD CONSTRAINT "brief_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "the0"."brief_versions"("id");



ALTER TABLE ONLY "the0"."case_claim_norms"
    ADD CONSTRAINT "case_claim_norms_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "the0"."case_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."case_claim_norms"
    ADD CONSTRAINT "case_claim_norms_norm_id_fkey" FOREIGN KEY ("norm_id") REFERENCES "the0"."legal_norms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."case_claims"
    ADD CONSTRAINT "case_claims_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."case_issues"
    ADD CONSTRAINT "case_issues_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."case_issues"
    ADD CONSTRAINT "case_issues_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "the0"."case_type_issue_templates"("id");



ALTER TABLE ONLY "the0"."case_judgments"
    ADD CONSTRAINT "case_judgments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."case_summaries"
    ADD CONSTRAINT "case_summaries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."chat_messages"
    ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "the0"."chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."citation_validation_logs"
    ADD CONSTRAINT "citation_validation_logs_brief_version_id_fkey" FOREIGN KEY ("brief_version_id") REFERENCES "the0"."brief_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."claim_evidence"
    ADD CONSTRAINT "claim_evidence_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "the0"."case_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."claim_evidence"
    ADD CONSTRAINT "claim_evidence_span_id_fkey" FOREIGN KEY ("span_id") REFERENCES "the0"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."claim_issues"
    ADD CONSTRAINT "claim_issues_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "the0"."case_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."claim_issues"
    ADD CONSTRAINT "claim_issues_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "the0"."case_issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."claim_versions"
    ADD CONSTRAINT "claim_versions_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "the0"."case_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."claims"
    ADD CONSTRAINT "claims_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "the0"."documents"("id");



ALTER TABLE ONLY "the0"."context_summaries"
    ADD CONSTRAINT "context_summaries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_brief_document_id_fkey" FOREIGN KEY ("brief_document_id") REFERENCES "the0"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "the0"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."documents"
    ADD CONSTRAINT "documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."documents"
    ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "the0"."documents"("id");



ALTER TABLE ONLY "the0"."draft_chunks"
    ADD CONSTRAINT "draft_chunks_brief_session_id_fkey" FOREIGN KEY ("brief_session_id") REFERENCES "the0"."brief_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."draft_chunks"
    ADD CONSTRAINT "draft_chunks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."draft_chunks"
    ADD CONSTRAINT "draft_chunks_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "the0"."case_issues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."drafts_temp"
    ADD CONSTRAINT "drafts_temp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."evidence_documents"
    ADD CONSTRAINT "evidence_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "the0"."evidence_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."evidence_files"
    ADD CONSTRAINT "evidence_files_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."evidence_links"
    ADD CONSTRAINT "evidence_links_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "the0"."claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."evidence_links"
    ADD CONSTRAINT "evidence_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "the0"."documents"("id");



ALTER TABLE ONLY "the0"."evidence_links"
    ADD CONSTRAINT "evidence_links_rebuttal_id_fkey" FOREIGN KEY ("rebuttal_id") REFERENCES "the0"."rebuttals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."evidence_requests"
    ADD CONSTRAINT "evidence_requests_response_document_id_fkey" FOREIGN KEY ("response_document_id") REFERENCES "the0"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."ingested_files"
    ADD CONSTRAINT "ingested_files_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."issue_position_versions"
    ADD CONSTRAINT "issue_position_versions_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "the0"."case_issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."issue_position_versions"
    ADD CONSTRAINT "issue_position_versions_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "the0"."work_sessions"("id");



ALTER TABLE ONLY "the0"."legal_cases_ext"
    ADD CONSTRAINT "legal_cases_ext_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."opponent_briefs"
    ADD CONSTRAINT "opponent_briefs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."opponent_briefs"
    ADD CONSTRAINT "opponent_briefs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."pending_files"
    ADD CONSTRAINT "pending_files_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."pipeline_reviews"
    ADD CONSTRAINT "pipeline_reviews_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."pipeline_reviews"
    ADD CONSTRAINT "pipeline_reviews_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."prompt_feedback"
    ADD CONSTRAINT "prompt_feedback_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."prompt_feedback"
    ADD CONSTRAINT "prompt_feedback_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "the0"."prompts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."prompt_feedback"
    ADD CONSTRAINT "prompt_feedback_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."prompt_history"
    ADD CONSTRAINT "prompt_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."prompt_history"
    ADD CONSTRAINT "prompt_history_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "the0"."prompts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."prompts"
    ADD CONSTRAINT "prompts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."prompts"
    ADD CONSTRAINT "prompts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."reasoning_logs"
    ADD CONSTRAINT "reasoning_logs_brief_session_id_fkey" FOREIGN KEY ("brief_session_id") REFERENCES "the0"."brief_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."reasoning_logs"
    ADD CONSTRAINT "reasoning_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "the0"."work_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."rebuttals"
    ADD CONSTRAINT "rebuttals_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "the0"."claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."temp_uploads"
    ADD CONSTRAINT "temp_uploads_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."temp_uploads"
    ADD CONSTRAINT "temp_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "the0"."user_invitations"
    ADD CONSTRAINT "user_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."user_invitations"
    ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "the0"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."users_profiles"
    ADD CONSTRAINT "users_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."work_sessions"
    ADD CONSTRAINT "work_sessions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "the0"."work_tasks"
    ADD CONSTRAINT "work_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "the0"."work_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "theai"."case_summaries"
    ADD CONSTRAINT "case_summaries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "theai"."legal_cases"("id");



ALTER TABLE ONLY "theai"."claims"
    ADD CONSTRAINT "claims_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "theai"."documents"("id");



ALTER TABLE ONLY "theai"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_brief_document_id_fkey" FOREIGN KEY ("brief_document_id") REFERENCES "theai"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "theai"."document_evidence_links"
    ADD CONSTRAINT "document_evidence_links_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "theai"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "theai"."documents"
    ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "theai"."documents"("id");



ALTER TABLE ONLY "theai"."evidence_links"
    ADD CONSTRAINT "evidence_links_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "theai"."claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "theai"."evidence_links"
    ADD CONSTRAINT "evidence_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "theai"."documents"("id");



ALTER TABLE ONLY "theai"."documents"
    ADD CONSTRAINT "fk_documents_case" FOREIGN KEY ("case_id") REFERENCES "theai"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "theai"."ingested_files"
    ADD CONSTRAINT "fk_ingested_files_case" FOREIGN KEY ("case_id") REFERENCES "theai"."legal_cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "theai"."rebuttals"
    ADD CONSTRAINT "rebuttals_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "theai"."claims"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage cases" ON "public"."testimonial_cases" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admins can manage evidence" ON "public"."testimonial_evidence_photos" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admins can view all activity logs" ON "public"."consultation_activity_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admins have full access to case_schedules" ON "public"."case_schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."role" = 'admin'::"text") AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "Admins have full access to clients" ON "public"."clients" USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."role" = 'admin'::"text") AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "Admins have full access to legal_cases" ON "public"."legal_cases" USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."role" = 'admin'::"text") AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "Admins have full access to users_profiles" ON "public"."users_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles" "up"
  WHERE (("up"."auth_user_id" = "auth"."uid"()) AND ("up"."role" = 'admin'::"text") AND ("up"."is_active" = true)))));



CREATE POLICY "Allow admin to delete consultations" ON "public"."consultations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow admin to manage sms_templates" ON "public"."sms_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow admin to read all consultations" ON "public"."consultations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow admin to update consultations" ON "public"."consultations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow admin to view sms_logs" ON "public"."sms_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."notification_logs" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."notification_schedules" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."notification_templates" USING (true);



CREATE POLICY "Allow all for receivable_memos" ON "public"."receivable_memos" USING (true);



CREATE POLICY "Allow all for receivable_writeoffs" ON "public"."receivable_writeoffs" USING (true);



CREATE POLICY "Allow public to create consultations" ON "public"."consultations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow system to insert sms_logs" ON "public"."sms_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Anyone can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view published FAQs" ON "public"."faqs" FOR SELECT USING (("published" = true));



CREATE POLICY "Anyone can view published blog posts" ON "public"."blog_posts" FOR SELECT USING (("published" = true));



CREATE POLICY "Anyone can view published cases" ON "public"."cases" FOR SELECT USING (("published" = true));



CREATE POLICY "Anyone can view published instagram posts" ON "public"."instagram_posts" FOR SELECT USING (("published" = true));



CREATE POLICY "Authenticated users can create blocked times" ON "public"."blocked_times" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can delete blocked times" ON "public"."blocked_times" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can manage FAQs" ON "public"."faqs" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can manage app_settings" ON "public"."app_settings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can manage blog posts" ON "public"."blog_posts" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can manage case_deadlines" ON "public"."case_deadlines" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can manage cases" ON "public"."cases" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can manage court_hearings" ON "public"."court_hearings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can manage general_schedules" ON "public"."general_schedules" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can manage instagram posts" ON "public"."instagram_posts" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can manage payments" ON "public"."payments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can manage pending_calendar_events" ON "public"."pending_calendar_events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can read deadline_types" ON "public"."deadline_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update blocked times" ON "public"."blocked_times" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view blocked times" ON "public"."blocked_times" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view extensions" ON "public"."deadline_extensions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view holidays" ON "public"."korean_public_holidays" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public can view blocked times" ON "public"."blocked_times" FOR SELECT USING (true);



CREATE POLICY "Public can view evidence for published cases" ON "public"."testimonial_evidence_photos" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."testimonial_cases"
  WHERE (("testimonial_cases"."id" = "testimonial_evidence_photos"."case_id") AND ("testimonial_cases"."published" = true) AND ("testimonial_cases"."consent_given" = true)))) AND ("blur_applied" = true)));



CREATE POLICY "Public can view published cases" ON "public"."testimonial_cases" FOR SELECT USING ((("published" = true) AND ("consent_given" = true)));



CREATE POLICY "Service role can do everything on case_deadlines" ON "public"."case_deadlines" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can do everything on court_hearings" ON "public"."court_hearings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can do everything on deadline_types" ON "public"."deadline_types" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."user_memory" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role has full access to extensions" ON "public"."deadline_extensions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to general_schedules" ON "public"."general_schedules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to holidays" ON "public"."korean_public_holidays" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Staff can update their own profile" ON "public"."users_profiles" FOR UPDATE USING (("auth_user_id" = "auth"."uid"())) WITH CHECK ((("auth_user_id" = "auth"."uid"()) AND ("role" = ( SELECT "users_profiles_1"."role"
   FROM "public"."users_profiles" "users_profiles_1"
  WHERE ("users_profiles_1"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "Staff can view case_schedules" ON "public"."case_schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "Staff can view clients" ON "public"."clients" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "Staff can view legal_cases" ON "public"."legal_cases" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "Staff can view their own profile" ON "public"."users_profiles" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "System can insert activity logs" ON "public"."consultation_activity_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can delete own memory" ON "public"."user_memory" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own memory" ON "public"."user_memory" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own memory" ON "public"."user_memory" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own memory" ON "public"."user_memory" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "admin_manage_invitations" ON "public"."tenant_invitations" USING (("public"."is_super_admin"() OR (("tenant_id" = "public"."get_current_tenant_id"()) AND "public"."has_role_or_higher"('admin'::character varying)))) WITH CHECK (("public"."is_super_admin"() OR (("tenant_id" = "public"."get_current_tenant_id"()) AND "public"."has_role_or_higher"('admin'::character varying))));



CREATE POLICY "admin_manage_members" ON "public"."tenant_members" USING ((("tenant_id" = "public"."get_current_tenant_id"()) AND "public"."has_role_or_higher"('admin'::character varying))) WITH CHECK ((("tenant_id" = "public"."get_current_tenant_id"()) AND "public"."has_role_or_higher"('admin'::character varying)));



CREATE POLICY "admin_update_tenant" ON "public"."tenants" FOR UPDATE USING (("public"."is_tenant_member"("id") AND "public"."has_role_or_higher"('admin'::character varying))) WITH CHECK (("public"."is_tenant_member"("id") AND "public"."has_role_or_higher"('admin'::character varying)));



CREATE POLICY "anyone_can_view_plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_times" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "case_contracts_tenant_isolation" ON "public"."case_contracts" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text", true))::"uuid"));



ALTER TABLE "public"."case_deadlines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_parties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_relations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_representatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultation_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultation_date_exceptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consultation_date_exceptions_admin_all" ON "public"."consultation_date_exceptions" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "consultation_date_exceptions_select_all" ON "public"."consultation_date_exceptions" FOR SELECT USING (true);



ALTER TABLE "public"."consultation_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consultation_settings_admin_all" ON "public"."consultation_settings" USING (true);



CREATE POLICY "consultation_settings_public_read" ON "public"."consultation_settings" FOR SELECT USING (("setting_key" = ANY (ARRAY['phone_availability'::"text", 'modal_config'::"text"])));



ALTER TABLE "public"."consultation_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consultation_sources_admin_all" ON "public"."consultation_sources" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "consultation_sources_select_all" ON "public"."consultation_sources" FOR SELECT USING (true);



ALTER TABLE "public"."consultation_weekly_schedule" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consultation_weekly_schedule_admin_all" ON "public"."consultation_weekly_schedule" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "consultation_weekly_schedule_select_all" ON "public"."consultation_weekly_schedule" FOR SELECT USING (true);



ALTER TABLE "public"."consultations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_hearings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deadline_extensions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deadline_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dismissed_case_notices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dismissed_related_cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dismissed_related_cases_tenant_isolation" ON "public"."dismissed_related_cases" USING ((EXISTS ( SELECT 1
   FROM "public"."legal_cases" "lc"
  WHERE (("lc"."id" = "dismissed_related_cases"."case_id") AND ("lc"."tenant_id" = ("current_setting"('app.current_tenant_id'::"text", true))::"uuid")))));



ALTER TABLE "public"."episodic_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faqs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."general_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instagram_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."korean_public_holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_view_members" ON "public"."tenant_members" FOR SELECT USING (("tenant_id" = "public"."get_current_tenant_id"()));



CREATE POLICY "member_view_tenant" ON "public"."tenants" FOR SELECT USING ("public"."is_tenant_member"("id"));



ALTER TABLE "public"."monthly_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_withdrawals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."persona_feedback_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_create_consultations" ON "public"."consultations" FOR INSERT WITH CHECK (true);



CREATE POLICY "public_view_invitation_by_token" ON "public"."tenant_invitations" FOR SELECT USING (((("status")::"text" = 'pending'::"text") AND ("expires_at" > "now"())));



ALTER TABLE "public"."receivable_memos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receivable_writeoffs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scourt_xml_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scourt_xml_cache_delete" ON "public"."scourt_xml_cache" FOR DELETE USING (true);



CREATE POLICY "scourt_xml_cache_insert" ON "public"."scourt_xml_cache" FOR INSERT WITH CHECK (true);



CREATE POLICY "scourt_xml_cache_read" ON "public"."scourt_xml_cache" FOR SELECT USING (true);



CREATE POLICY "scourt_xml_cache_update" ON "public"."scourt_xml_cache" FOR UPDATE USING (true);



ALTER TABLE "public"."semantic_memory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_episodic_memory" ON "public"."episodic_memory" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access_integrations" ON "public"."tenant_integrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full_access_oauth_states" ON "public"."oauth_states" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_persona_feedback" ON "public"."persona_feedback_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_semantic_memory" ON "public"."semantic_memory" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_user_personas" ON "public"."user_personas" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_user_profiles_v4" ON "public"."user_profiles_v4" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sms_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_messages_insert" ON "public"."sms_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "sms_messages_select" ON "public"."sms_messages" FOR SELECT USING (true);



CREATE POLICY "sms_messages_update" ON "public"."sms_messages" FOR UPDATE USING (true);



ALTER TABLE "public"."sms_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admin_manage_super_admins" ON "public"."super_admins" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_members" ON "public"."tenant_members" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_tenant_settings" ON "public"."tenant_settings" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_tenants" ON "public"."tenants" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_view_super_admins" ON "public"."super_admins" FOR SELECT USING ("public"."is_super_admin"());



ALTER TABLE "public"."super_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_admin_expenses" ON "public"."expenses" USING (("public"."is_super_admin"() OR (("tenant_id" = "public"."get_current_tenant_id"()) AND "public"."has_role_or_higher"('admin'::character varying)))) WITH CHECK (("public"."is_super_admin"() OR (("tenant_id" = "public"."get_current_tenant_id"()) AND "public"."has_role_or_higher"('admin'::character varying))));



CREATE POLICY "tenant_admins_can_manage_integrations" ON "public"."tenant_integrations" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE ("super_admins"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("tm"."tenant_id" = "tenant_integrations"."tenant_id") AND (("tm"."status")::"text" = 'active'::"text") AND (("tm"."role")::"text" = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::"text"[]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE ("super_admins"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("tm"."tenant_id" = "tenant_integrations"."tenant_id") AND (("tm"."status")::"text" = 'active'::"text") AND (("tm"."role")::"text" = ANY ((ARRAY['owner'::character varying, 'admin'::character varying])::"text"[])))))));



CREATE POLICY "tenant_bookings" ON "public"."bookings" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_case_deadlines" ON "public"."case_deadlines" USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."legal_cases"
  WHERE (("legal_cases"."id" = "case_deadlines"."case_id") AND ("legal_cases"."tenant_id" = "public"."get_current_tenant_id"())))))) WITH CHECK (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."legal_cases"
  WHERE (("legal_cases"."id" = "case_deadlines"."case_id") AND ("legal_cases"."tenant_id" = "public"."get_current_tenant_id"()))))));



CREATE POLICY "tenant_cases" ON "public"."legal_cases" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_clients" ON "public"."clients" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_court_hearings" ON "public"."court_hearings" USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."legal_cases"
  WHERE (("legal_cases"."id" = "court_hearings"."case_id") AND ("legal_cases"."tenant_id" = "public"."get_current_tenant_id"())))))) WITH CHECK (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."legal_cases"
  WHERE (("legal_cases"."id" = "court_hearings"."case_id") AND ("legal_cases"."tenant_id" = "public"."get_current_tenant_id"()))))));



CREATE POLICY "tenant_delete_consultations" ON "public"."consultations" FOR DELETE USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_general_schedules" ON "public"."general_schedules" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



ALTER TABLE "public"."tenant_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation_case_parties" ON "public"."case_parties" USING (("tenant_id" = ("current_setting"('app.current_tenant_id'::"text", true))::"uuid"));



CREATE POLICY "tenant_isolation_case_representatives" ON "public"."case_representatives" USING (("tenant_id" = ("current_setting"('app.current_tenant_id'::"text", true))::"uuid"));



CREATE POLICY "tenant_manage_consultations" ON "public"."consultations" FOR UPDATE USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_member_settings" ON "public"."tenant_settings" TO "authenticated" USING (("public"."is_tenant_member"("tenant_id") AND "public"."has_role_or_higher"('admin'::character varying))) WITH CHECK (("public"."is_tenant_member"("tenant_id") AND "public"."has_role_or_higher"('admin'::character varying)));



ALTER TABLE "public"."tenant_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_can_manage_dismissed_notices" ON "public"."dismissed_case_notices" USING (true) WITH CHECK (true);



CREATE POLICY "tenant_members_can_view_integrations" ON "public"."tenant_integrations" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."super_admins"
  WHERE ("super_admins"."user_id" = "auth"."uid"()))) OR ("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = "auth"."uid"()) AND (("tm"."status")::"text" = 'active'::"text"))))));



CREATE POLICY "tenant_payments" ON "public"."payments" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_scourt_profile_cases" ON "public"."scourt_profile_cases" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_scourt_profiles" ON "public"."scourt_profiles" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



CREATE POLICY "tenant_scourt_user_wmonid" ON "public"."scourt_user_wmonid" USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"()))) WITH CHECK (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



ALTER TABLE "public"."tenant_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_view_consultations" ON "public"."consultations" FOR SELECT USING (("public"."is_super_admin"() OR ("tenant_id" = "public"."get_current_tenant_id"())));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testimonial_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."testimonial_evidence_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_insert" ON "public"."transactions" FOR INSERT WITH CHECK (true);



CREATE POLICY "transactions_select" ON "public"."transactions" FOR SELECT USING (true);



ALTER TABLE "public"."user_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles_v4" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_own_episodic" ON "public"."episodic_memory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_own_persona" ON "public"."user_personas" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_own_profile_v4" ON "public"."user_profiles_v4" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_own_semantic" ON "public"."semantic_memory" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."users_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "관리자만 expenses 삽입" ON "public"."expenses" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 monthly_settlements 삭제" ON "public"."monthly_settlements" FOR DELETE USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 monthly_settlements 삽입" ON "public"."monthly_settlements" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 monthly_settlements 수정" ON "public"."monthly_settlements" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 monthly_settlements 조회" ON "public"."monthly_settlements" FOR SELECT USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 partner_withdrawals 삭제" ON "public"."partner_withdrawals" FOR DELETE USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 partner_withdrawals 삽입" ON "public"."partner_withdrawals" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 partner_withdrawals 수정" ON "public"."partner_withdrawals" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 partner_withdrawals 조회" ON "public"."partner_withdrawals" FOR SELECT USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 recurring_templates 삭제" ON "public"."recurring_templates" FOR DELETE USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 recurring_templates 삽입" ON "public"."recurring_templates" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 recurring_templates 수정" ON "public"."recurring_templates" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자만 recurring_templates 조회" ON "public"."recurring_templates" FOR SELECT USING (("auth"."uid"() IN ( SELECT "users_profiles"."auth_user_id"
   FROM "public"."users_profiles"
  WHERE ("users_profiles"."role" = 'admin'::"text"))));



CREATE POLICY "관리자와 직원은 모든 사건 관계를 볼 수 있습" ON "public"."case_relations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "관리자와 직원은 모든 일정을 볼 수 있습니다" ON "public"."case_schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "관리자와 직원은 사건 관계를 삭제할 수 있습니" ON "public"."case_relations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "관리자와 직원은 사건 관계를 추가할 수 있습니" ON "public"."case_relations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "관리자와 직원은 일정을 삭제할 수 있습니다" ON "public"."case_schedules" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "관리자와 직원은 일정을 수정할 수 있습니다" ON "public"."case_schedules" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "관리자와 직원은 일정을 추가할 수 있습니다" ON "public"."case_schedules" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users_profiles"
  WHERE (("users_profiles"."auth_user_id" = "auth"."uid"()) AND ("users_profiles"."is_active" = true)))));



CREATE POLICY "Admins can view all profiles" ON "the0"."user_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "the0"."user_profiles" "user_profiles_1"
  WHERE (("user_profiles_1"."id" = "auth"."uid"()) AND ("user_profiles_1"."role" = ANY (ARRAY['master'::"text", 'operator'::"text"]))))));



CREATE POLICY "Authenticated read access" ON "the0"."case_type_issue_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access" ON "the0"."case_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access" ON "the0"."claim_change_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access" ON "the0"."claim_subtypes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access" ON "the0"."legal_norms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read access" ON "the0"."norm_relation_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read precedent cache" ON "the0"."precedent_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read statute cache" ON "the0"."statute_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Masters can manage invitations" ON "the0"."user_invitations" USING ((EXISTS ( SELECT 1
   FROM "the0"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'master'::"text")))));



CREATE POLICY "Service role can manage precedent cache" ON "the0"."precedent_cache" TO "service_role" USING (true);



CREATE POLICY "Service role can manage statute cache" ON "the0"."statute_cache" TO "service_role" USING (true);



CREATE POLICY "Service role can manage validation logs" ON "the0"."citation_validation_logs" TO "service_role" USING (true);



CREATE POLICY "Service role full access" ON "the0"."brief_sessions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."case_claim_norms" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."case_claims" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."case_issues" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."case_judgments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."case_type_issue_templates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."case_types" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."claim_change_types" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."claim_evidence" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."claim_issues" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."claim_subtypes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."claim_versions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."context_summaries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."draft_chunks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."evidence_documents" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."evidence_files" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."issue_position_versions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."legal_norms" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."norm_relation_types" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "the0"."reasoning_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on document_evidence_links" ON "the0"."document_evidence_links" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on documents" ON "the0"."documents" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to brief_exports" ON "the0"."brief_exports" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to brief_guidelines" ON "the0"."brief_guidelines" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to brief_templates" ON "the0"."brief_templates" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to brief_versions" ON "the0"."brief_versions" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to claims" ON "the0"."claims" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to collaboration_history" ON "the0"."collaboration_history" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to confirmed_strategies" ON "the0"."confirmed_strategies" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to doc_templates" ON "the0"."doc_templates" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to evidence_links" ON "the0"."evidence_links" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to ingested_files" ON "the0"."ingested_files" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to legal_cases_ext" ON "the0"."legal_cases_ext" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to rebuttals" ON "the0"."rebuttals" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to work_sessions" ON "the0"."work_sessions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to work_tasks" ON "the0"."work_tasks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can access own session messages" ON "the0"."chat_messages" USING ((EXISTS ( SELECT 1
   FROM "the0"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can access own sessions" ON "the0"."chat_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own brief inputs" ON "the0"."brief_inputs" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can delete own brief inputs" ON "the0"."brief_inputs" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can delete own drafts" ON "the0"."drafts_temp" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own temp uploads" ON "the0"."temp_uploads" FOR DELETE USING (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can insert own drafts" ON "the0"."drafts_temp" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own temp uploads" ON "the0"."temp_uploads" FOR INSERT WITH CHECK (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can update own drafts" ON "the0"."drafts_temp" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "the0"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own temp uploads" ON "the0"."temp_uploads" FOR UPDATE USING (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can view own brief inputs" ON "the0"."brief_inputs" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can view own drafts" ON "the0"."drafts_temp" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "the0"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own temp uploads" ON "the0"."temp_uploads" FOR SELECT USING (("auth"."uid"() = "uploaded_by"));



ALTER TABLE "the0"."admin_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_notifications_delete_policy" ON "the0"."admin_notifications" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "admin_notifications_insert_policy" ON "the0"."admin_notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "admin_notifications_select_policy" ON "the0"."admin_notifications" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "admin_notifications_service_role_policy" ON "the0"."admin_notifications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "admin_notifications_update_policy" ON "the0"."admin_notifications" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "the0"."ai_models" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_models_all_master" ON "the0"."ai_models" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "the0"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'master'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "the0"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'master'::"text")))));



CREATE POLICY "ai_models_select_authenticated" ON "the0"."ai_models" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "the0"."brief_exports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."brief_guidelines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."brief_inputs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."brief_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."brief_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."brief_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."case_claim_norms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."case_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."case_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."case_judgments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."case_type_issue_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."case_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."chat_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."citation_validation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."claim_change_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."claim_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."claim_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."claim_subtypes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."claim_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."collaboration_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."confirmed_strategies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."context_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."doc_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."document_evidence_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."draft_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."drafts_temp" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."evidence_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."evidence_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."evidence_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."evidence_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evidence_requests_delete_policy" ON "the0"."evidence_requests" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "evidence_requests_insert_policy" ON "the0"."evidence_requests" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "evidence_requests_select_policy" ON "the0"."evidence_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "evidence_requests_service_role_policy" ON "the0"."evidence_requests" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "evidence_requests_update_policy" ON "the0"."evidence_requests" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "the0"."ingested_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."issue_position_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."legal_cases_ext" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."legal_norms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "masters_full_access" ON "the0"."users_profiles" USING ((EXISTS ( SELECT 1
   FROM "the0"."users_profiles" "users_profiles_1"
  WHERE (("users_profiles_1"."id" = "auth"."uid"()) AND ("users_profiles_1"."role" = ANY (ARRAY['master'::"text", 'operator'::"text"]))))));



ALTER TABLE "the0"."norm_relation_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."opponent_briefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "opponent_briefs_insert_policy" ON "the0"."opponent_briefs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "opponent_briefs_select_policy" ON "the0"."opponent_briefs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "opponent_briefs_update_policy" ON "the0"."opponent_briefs" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "the0"."pending_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pending_files_insert_policy" ON "the0"."pending_files" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "pending_files_select_policy" ON "the0"."pending_files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pending_files_service_role_policy" ON "the0"."pending_files" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "pending_files_update_policy" ON "the0"."pending_files" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "the0"."pipeline_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_reviews_insert_policy" ON "the0"."pipeline_reviews" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "pipeline_reviews_select_policy" ON "the0"."pipeline_reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pipeline_reviews_service_role_policy" ON "the0"."pipeline_reviews" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "pipeline_reviews_update_policy" ON "the0"."pipeline_reviews" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "the0"."precedent_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."prompt_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_feedback_insert_authenticated" ON "the0"."prompt_feedback" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "prompt_feedback_modify_staff" ON "the0"."prompt_feedback" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "the0"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = ANY (ARRAY['master'::"text", 'operator'::"text"]))))));



CREATE POLICY "prompt_feedback_select_authenticated" ON "the0"."prompt_feedback" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "the0"."prompt_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_history_select_staff" ON "the0"."prompt_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "the0"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = ANY (ARRAY['master'::"text", 'operator'::"text"]))))));



ALTER TABLE "the0"."prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompts_modify_staff" ON "the0"."prompts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "the0"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = ANY (ARRAY['master'::"text", 'operator'::"text"]))))));



CREATE POLICY "prompts_select_authenticated" ON "the0"."prompts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "the0"."reasoning_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."rebuttals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."statute_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."temp_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."user_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."users_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_own_profile" ON "the0"."users_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "users_update_own_profile" ON "the0"."users_profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND ("role" = ( SELECT "users_profiles_1"."role"
   FROM "the0"."users_profiles" "users_profiles_1"
  WHERE ("users_profiles_1"."id" = "auth"."uid"())))));



ALTER TABLE "the0"."work_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "the0"."work_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Service role full access on document_evidence_links" ON "theai"."document_evidence_links" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to claims" ON "theai"."claims" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to evidence_links" ON "theai"."evidence_links" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to ingested_files" ON "theai"."ingested_files" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to legal_cases" ON "theai"."legal_cases" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to rebuttals" ON "theai"."rebuttals" USING (true) WITH CHECK (true);



ALTER TABLE "theai"."claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "theai"."document_evidence_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "theai"."evidence_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "theai"."ingested_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "theai"."legal_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "theai"."rebuttals" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "the0" TO "anon";
GRANT USAGE ON SCHEMA "the0" TO "authenticated";
GRANT USAGE ON SCHEMA "the0" TO "service_role";



GRANT USAGE ON SCHEMA "theai" TO "anon";
GRANT USAGE ON SCHEMA "theai" TO "authenticated";
GRANT USAGE ON SCHEMA "theai" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_assign_wmonid"("p_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auto_assign_wmonid"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_assign_wmonid"("p_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_calculate_deadline"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_calculate_deadline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_calculate_deadline"() TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."blog_search_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."blog_search_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."blog_search_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_deadline_dates"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_deadline_dates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_deadline_dates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_legal_deadline"("trigger_date" "date", "days" integer, "exclude_initial_day" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_legal_deadline"("trigger_date" "date", "days" integer, "exclude_initial_day" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_legal_deadline"("trigger_date" "date", "days" integer, "exclude_initial_day" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_memory_retention"("last_accessed" timestamp with time zone, "decay_rate" double precision, "importance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_memory_retention"("last_accessed" timestamp with time zone, "decay_rate" double precision, "importance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_memory_retention"("last_accessed" timestamp with time zone, "decay_rate" double precision, "importance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cases_search_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."cases_search_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cases_search_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_wmonid_case_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_wmonid_case_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_wmonid_case_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_episodic_memory"("target_user_id" "uuid", "retention_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_episodic_memory"("target_user_id" "uuid", "retention_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_episodic_memory"("target_user_id" "uuid", "retention_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_case_evidence"("case_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_case_evidence"("case_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_case_evidence"("case_uuid" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."scourt_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."scourt_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_sync_jobs" TO "service_role";



GRANT ALL ON FUNCTION "public"."dequeue_scourt_sync_jobs"("p_limit" integer, "p_worker_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dequeue_scourt_sync_jobs"("p_limit" integer, "p_worker_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dequeue_scourt_sync_jobs"("p_limit" integer, "p_worker_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."faqs_search_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."faqs_search_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."faqs_search_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_available_wmonid_for_member"("p_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."find_available_wmonid_for_member"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_available_wmonid_for_member"("p_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_case_with_evidence"("case_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_case_with_evidence"("case_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_case_with_evidence"("case_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_consultation_activity_summary"("consultation_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_consultation_activity_summary"("consultation_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_consultation_activity_summary"("consultation_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_member_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_member_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_member_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_member_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_member_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_member_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_business_day"("from_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_business_day"("from_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_business_day"("from_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_testimonial_stats_by_category"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_testimonial_stats_by_category"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_testimonial_stats_by_category"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_wmonid_remaining_capacity"("p_wmonid_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_wmonid_remaining_capacity"("p_wmonid_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_wmonid_remaining_capacity"("p_wmonid_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_wmonid_stats"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_wmonid_stats"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_wmonid_stats"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_consultation_status_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_consultation_status_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_consultation_status_timestamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role_or_higher"("required_role" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."has_role_or_higher"("required_role" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role_or_higher"("required_role" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_blog_views"("post_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_blog_views"("post_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_blog_views"("post_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_case_views"("case_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_case_views"("case_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_case_views"("case_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_faq_views"("faq_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_faq_views"("faq_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_faq_views"("faq_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_instagram_likes"("post_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_instagram_likes"("post_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_instagram_likes"("post_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_instagram_views"("post_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_instagram_views"("post_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_instagram_views"("post_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_testimonial_helpful"("testimonial_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_testimonial_helpful"("testimonial_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_testimonial_helpful"("testimonial_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_testimonial_views"("testimonial_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_testimonial_views"("testimonial_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_testimonial_views"("testimonial_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_non_business_day"("check_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."is_non_business_day"("check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_non_business_day"("check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_public_holiday"("check_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."is_public_holiday"("check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_public_holiday"("check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_saturday"("check_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."is_saturday"("check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_saturday"("check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_sunday"("check_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."is_sunday"("check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_sunday"("check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."learn_persona_pattern"("target_user_id" "uuid", "pattern_type" "text", "pattern_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."learn_persona_pattern"("target_user_id" "uuid", "pattern_type" "text", "pattern_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."learn_persona_pattern"("target_user_id" "uuid", "pattern_type" "text", "pattern_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_consultation_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_consultation_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_consultation_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_wmonid_limit_warning"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_wmonid_limit_warning"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_wmonid_limit_warning"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."testimonials_search_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."testimonials_search_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."testimonials_search_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_blocked_times_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_blocked_times_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_blocked_times_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_case_contracts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_case_contracts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_case_contracts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_case_parties_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_case_parties_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_case_parties_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_consultation_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_consultation_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_consultation_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_consultation_source_usage_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_consultation_source_usage_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_consultation_source_usage_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_consultation_sources_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_consultation_sources_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_consultation_sources_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_date_exceptions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_date_exceptions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_date_exceptions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dfc_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dfc_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dfc_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_expenses_month_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_expenses_month_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_expenses_month_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_expenses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_expenses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_expenses_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_monthly_settlements_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_monthly_settlements_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_monthly_settlements_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_overdue_deadlines"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_overdue_deadlines"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_overdue_deadlines"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_partner_withdrawals_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_partner_withdrawals_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_partner_withdrawals_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payments_month_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_payments_month_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payments_month_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_persona_adjustments"("target_user_id" "uuid", "delta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_persona_adjustments"("target_user_id" "uuid", "delta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_persona_adjustments"("target_user_id" "uuid", "delta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_recurring_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_recurring_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_recurring_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scourt_profile_case_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scourt_profile_case_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scourt_profile_case_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scourt_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scourt_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scourt_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scourt_sync_jobs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scourt_sync_jobs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scourt_sync_jobs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scourt_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scourt_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scourt_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scourt_user_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scourt_user_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scourt_user_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scourt_user_wmonid_case_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scourt_user_wmonid_case_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scourt_user_wmonid_case_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scourt_user_wmonid_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scourt_user_wmonid_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scourt_user_wmonid_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tenant_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tenant_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tenant_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_memory_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_memory_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_memory_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_v4_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_v4_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_v4_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_weekly_schedule_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_weekly_schedule_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_weekly_schedule_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "the0"."cleanup_expired_citation_cache"() TO "anon";
GRANT ALL ON FUNCTION "the0"."cleanup_expired_citation_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."cleanup_expired_citation_cache"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."cleanup_expired_drafts"() TO "anon";
GRANT ALL ON FUNCTION "the0"."cleanup_expired_drafts"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."cleanup_expired_drafts"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."cleanup_expired_temp_uploads"() TO "anon";
GRANT ALL ON FUNCTION "the0"."cleanup_expired_temp_uploads"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."cleanup_expired_temp_uploads"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."ensure_single_default_model"() TO "anon";
GRANT ALL ON FUNCTION "the0"."ensure_single_default_model"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."ensure_single_default_model"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."expand_query"("query_text" "text") TO "anon";
GRANT ALL ON FUNCTION "the0"."expand_query"("query_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."expand_query"("query_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "the0"."expire_old_invitations"() TO "anon";
GRANT ALL ON FUNCTION "the0"."expire_old_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."expire_old_invitations"() TO "service_role";



GRANT ALL ON TABLE "the0"."financial_records" TO "anon";
GRANT ALL ON TABLE "the0"."financial_records" TO "authenticated";
GRANT ALL ON TABLE "the0"."financial_records" TO "service_role";



GRANT ALL ON FUNCTION "the0"."find_transactions_by_date"("p_case_id" "uuid", "p_date" "date", "p_amount" numeric, "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "the0"."find_transactions_by_date"("p_case_id" "uuid", "p_date" "date", "p_amount" numeric, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."find_transactions_by_date"("p_case_id" "uuid", "p_date" "date", "p_amount" numeric, "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "the0"."get_active_prompt"("p_domain" "text", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "the0"."get_active_prompt"("p_domain" "text", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."get_active_prompt"("p_domain" "text", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "the0"."get_case_files"("p_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "the0"."get_case_files"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."get_case_files"("p_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "the0"."get_evidence_stats"("p_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "the0"."get_evidence_stats"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."get_evidence_stats"("p_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "the0"."get_financial_summary"("p_case_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "the0"."get_financial_summary"("p_case_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."get_financial_summary"("p_case_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "the0"."get_hierarchical_context"("p_case_id" "uuid", "p_max_level" integer) TO "anon";
GRANT ALL ON FUNCTION "the0"."get_hierarchical_context"("p_case_id" "uuid", "p_max_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."get_hierarchical_context"("p_case_id" "uuid", "p_max_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "the0"."get_mergeable_chunks"("p_case_id" "uuid", "p_brief_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "the0"."get_mergeable_chunks"("p_case_id" "uuid", "p_brief_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."get_mergeable_chunks"("p_case_id" "uuid", "p_brief_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "the0"."get_parent_content"("child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "the0"."get_parent_content"("child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."get_parent_content"("child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "the0"."handle_auth_user_created_v2"() TO "anon";
GRANT ALL ON FUNCTION "the0"."handle_auth_user_created_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."handle_auth_user_created_v2"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "the0"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) TO "anon";
GRANT ALL ON FUNCTION "the0"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) TO "service_role";



GRANT ALL ON FUNCTION "the0"."invalidate_context_summaries"() TO "anon";
GRANT ALL ON FUNCTION "the0"."invalidate_context_summaries"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."invalidate_context_summaries"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."link_drive_file_to_case"("p_drive_file_id" "text", "p_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "the0"."link_drive_file_to_case"("p_drive_file_id" "text", "p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."link_drive_file_to_case"("p_drive_file_id" "text", "p_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "the0"."link_file_to_case"("p_file_id" "uuid", "p_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "the0"."link_file_to_case"("p_file_id" "uuid", "p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."link_file_to_case"("p_file_id" "uuid", "p_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer, "match_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer, "match_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer, "match_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "the0"."normalize_invitation_phone"() TO "anon";
GRANT ALL ON FUNCTION "the0"."normalize_invitation_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."normalize_invitation_phone"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."normalize_phone"("phone" "text") TO "anon";
GRANT ALL ON FUNCTION "the0"."normalize_phone"("phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "the0"."normalize_phone"("phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "the0"."recommend_evidence_for_claim"("p_case_id" "uuid", "p_claim_embedding" "public"."vector", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "the0"."recommend_evidence_for_claim"("p_case_id" "uuid", "p_claim_embedding" "public"."vector", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."recommend_evidence_for_claim"("p_case_id" "uuid", "p_claim_embedding" "public"."vector", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "the0"."search_legal_norms"("p_query_embedding" "public"."vector", "p_norm_type" "text", "p_tags" "text"[], "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "the0"."search_legal_norms"("p_query_embedding" "public"."vector", "p_norm_type" "text", "p_tags" "text"[], "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."search_legal_norms"("p_query_embedding" "public"."vector", "p_norm_type" "text", "p_tags" "text"[], "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "the0"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "the0"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "the0"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "the0"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "the0"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_ai_models_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_ai_models_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_ai_models_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_brief_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_brief_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_brief_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_case_claims_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_case_claims_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_case_claims_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_case_issues_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_case_issues_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_case_issues_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_case_summaries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_case_summaries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_case_summaries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_claims_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_claims_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_claims_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_draft_chunks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_draft_chunks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_draft_chunks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_evidence_files_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_evidence_files_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_evidence_files_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_legal_cases_ext_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_legal_cases_ext_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_legal_cases_ext_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_prompt_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_prompt_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_prompt_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_session_on_message"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_session_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_session_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_temp_uploads_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_temp_uploads_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_temp_uploads_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_users_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_users_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_users_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "the0"."update_work_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "the0"."update_work_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "the0"."update_work_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "theai"."expand_query"("query_text" "text") TO "anon";
GRANT ALL ON FUNCTION "theai"."expand_query"("query_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "theai"."expand_query"("query_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "theai"."get_parent_content"("child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "theai"."get_parent_content"("child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "theai"."get_parent_content"("child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "theai"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) TO "anon";
GRANT ALL ON FUNCTION "theai"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "theai"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "vector_weight" double precision, "fts_weight" double precision) TO "service_role";



GRANT ALL ON FUNCTION "theai"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "theai"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "theai"."match_documents"("query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer, "match_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "theai"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "theai"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "theai"."search_with_parent"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "theai"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "theai"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "theai"."smart_search"("query_text" "text", "query_embedding" "public"."vector", "filter_domain" "text", "filter_case_id" "uuid", "filter_doc_type" "text", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "theai"."update_case_summaries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "theai"."update_case_summaries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "theai"."update_case_summaries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "theai"."update_claims_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "theai"."update_claims_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "theai"."update_claims_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "theai"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "theai"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "theai"."update_updated_at"() TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_times" TO "anon";
GRANT ALL ON TABLE "public"."blocked_times" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_times" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."case_contracts" TO "anon";
GRANT ALL ON TABLE "public"."case_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."case_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."case_deadlines" TO "anon";
GRANT ALL ON TABLE "public"."case_deadlines" TO "authenticated";
GRANT ALL ON TABLE "public"."case_deadlines" TO "service_role";



GRANT ALL ON TABLE "public"."case_parties" TO "anon";
GRANT ALL ON TABLE "public"."case_parties" TO "authenticated";
GRANT ALL ON TABLE "public"."case_parties" TO "service_role";



GRANT ALL ON TABLE "public"."legal_cases" TO "anon";
GRANT ALL ON TABLE "public"."legal_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_cases" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."case_payment_summary" TO "anon";
GRANT ALL ON TABLE "public"."case_payment_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."case_payment_summary" TO "service_role";



GRANT ALL ON TABLE "public"."case_relations" TO "anon";
GRANT ALL ON TABLE "public"."case_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."case_relations" TO "service_role";



GRANT ALL ON TABLE "public"."case_representatives" TO "anon";
GRANT ALL ON TABLE "public"."case_representatives" TO "authenticated";
GRANT ALL ON TABLE "public"."case_representatives" TO "service_role";



GRANT ALL ON TABLE "public"."case_schedules" TO "anon";
GRANT ALL ON TABLE "public"."case_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."case_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."cases" TO "anon";
GRANT ALL ON TABLE "public"."cases" TO "authenticated";
GRANT ALL ON TABLE "public"."cases" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."consultation_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_date_exceptions" TO "anon";
GRANT ALL ON TABLE "public"."consultation_date_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_date_exceptions" TO "service_role";



GRANT ALL ON TABLE "public"."consultations" TO "anon";
GRANT ALL ON TABLE "public"."consultations" TO "authenticated";
GRANT ALL ON TABLE "public"."consultations" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_payment_summary" TO "anon";
GRANT ALL ON TABLE "public"."consultation_payment_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_payment_summary" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_settings" TO "anon";
GRANT ALL ON TABLE "public"."consultation_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_settings" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_sources" TO "anon";
GRANT ALL ON TABLE "public"."consultation_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_sources" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_weekly_schedule" TO "anon";
GRANT ALL ON TABLE "public"."consultation_weekly_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_weekly_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."court_hearings" TO "anon";
GRANT ALL ON TABLE "public"."court_hearings" TO "authenticated";
GRANT ALL ON TABLE "public"."court_hearings" TO "service_role";



GRANT ALL ON TABLE "public"."deadline_extensions" TO "anon";
GRANT ALL ON TABLE "public"."deadline_extensions" TO "authenticated";
GRANT ALL ON TABLE "public"."deadline_extensions" TO "service_role";



GRANT ALL ON TABLE "public"."deadline_types" TO "anon";
GRANT ALL ON TABLE "public"."deadline_types" TO "authenticated";
GRANT ALL ON TABLE "public"."deadline_types" TO "service_role";



GRANT ALL ON TABLE "public"."dismissed_case_notices" TO "anon";
GRANT ALL ON TABLE "public"."dismissed_case_notices" TO "authenticated";
GRANT ALL ON TABLE "public"."dismissed_case_notices" TO "service_role";



GRANT ALL ON TABLE "public"."dismissed_related_cases" TO "anon";
GRANT ALL ON TABLE "public"."dismissed_related_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."dismissed_related_cases" TO "service_role";



GRANT ALL ON TABLE "public"."drive_file_classifications" TO "anon";
GRANT ALL ON TABLE "public"."drive_file_classifications" TO "authenticated";
GRANT ALL ON TABLE "public"."drive_file_classifications" TO "service_role";



GRANT ALL ON TABLE "public"."drive_watch_channels" TO "anon";
GRANT ALL ON TABLE "public"."drive_watch_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."drive_watch_channels" TO "service_role";



GRANT ALL ON TABLE "public"."drive_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."drive_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."drive_webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."episodic_memory" TO "anon";
GRANT ALL ON TABLE "public"."episodic_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."episodic_memory" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."expense_stats_by_category" TO "anon";
GRANT ALL ON TABLE "public"."expense_stats_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_stats_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."faqs" TO "anon";
GRANT ALL ON TABLE "public"."faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."faqs" TO "service_role";



GRANT ALL ON TABLE "public"."general_schedules" TO "anon";
GRANT ALL ON TABLE "public"."general_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."general_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."instagram_posts" TO "anon";
GRANT ALL ON TABLE "public"."instagram_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."instagram_posts" TO "service_role";



GRANT ALL ON TABLE "public"."korean_public_holidays" TO "anon";
GRANT ALL ON TABLE "public"."korean_public_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."korean_public_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_expense_summary" TO "anon";
GRANT ALL ON TABLE "public"."monthly_expense_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_expense_summary" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_revenue_summary" TO "anon";
GRANT ALL ON TABLE "public"."monthly_revenue_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_revenue_summary" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_settlements" TO "anon";
GRANT ALL ON TABLE "public"."monthly_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_schedules" TO "anon";
GRANT ALL ON TABLE "public"."notification_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_states" TO "anon";
GRANT ALL ON TABLE "public"."oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."partner_debt_status" TO "anon";
GRANT ALL ON TABLE "public"."partner_debt_status" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_debt_status" TO "service_role";



GRANT ALL ON TABLE "public"."partner_withdrawals" TO "anon";
GRANT ALL ON TABLE "public"."partner_withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_withdrawals" TO "service_role";



GRANT ALL ON TABLE "public"."payment_conversion_funnel" TO "anon";
GRANT ALL ON TABLE "public"."payment_conversion_funnel" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_conversion_funnel" TO "service_role";



GRANT ALL ON TABLE "public"."payment_stats_by_category" TO "anon";
GRANT ALL ON TABLE "public"."payment_stats_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_stats_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."payment_stats_by_month" TO "anon";
GRANT ALL ON TABLE "public"."payment_stats_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_stats_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."pending_calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."pending_calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."persona_feedback_logs" TO "anon";
GRANT ALL ON TABLE "public"."persona_feedback_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."persona_feedback_logs" TO "service_role";



GRANT ALL ON TABLE "public"."receivable_memos" TO "anon";
GRANT ALL ON TABLE "public"."receivable_memos" TO "authenticated";
GRANT ALL ON TABLE "public"."receivable_memos" TO "service_role";



GRANT ALL ON TABLE "public"."receivable_writeoffs" TO "anon";
GRANT ALL ON TABLE "public"."receivable_writeoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."receivable_writeoffs" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_templates" TO "anon";
GRANT ALL ON TABLE "public"."recurring_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_templates" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_case_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."scourt_case_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_case_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_case_updates" TO "anon";
GRANT ALL ON TABLE "public"."scourt_case_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_case_updates" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_case_update_summary" TO "anon";
GRANT ALL ON TABLE "public"."scourt_case_update_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_case_update_summary" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_user_wmonid" TO "anon";
GRANT ALL ON TABLE "public"."scourt_user_wmonid" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_user_wmonid" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_expiring_wmonids" TO "anon";
GRANT ALL ON TABLE "public"."scourt_expiring_wmonids" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_expiring_wmonids" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_profile_cases" TO "anon";
GRANT ALL ON TABLE "public"."scourt_profile_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_profile_cases" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_profiles" TO "anon";
GRANT ALL ON TABLE "public"."scourt_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_user_settings" TO "anon";
GRANT ALL ON TABLE "public"."scourt_user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_profile_usage" TO "anon";
GRANT ALL ON TABLE "public"."scourt_profile_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_profile_usage" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."scourt_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_update_types" TO "anon";
GRANT ALL ON TABLE "public"."scourt_update_types" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_update_types" TO "service_role";



GRANT ALL ON TABLE "public"."scourt_xml_cache" TO "anon";
GRANT ALL ON TABLE "public"."scourt_xml_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."scourt_xml_cache" TO "service_role";



GRANT ALL ON TABLE "public"."semantic_memory" TO "anon";
GRANT ALL ON TABLE "public"."semantic_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."semantic_memory" TO "service_role";



GRANT ALL ON TABLE "public"."settlement_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."settlement_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_dashboard" TO "service_role";



GRANT ALL ON TABLE "public"."sms_logs" TO "anon";
GRANT ALL ON TABLE "public"."sms_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "anon";
GRANT ALL ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";



GRANT ALL ON TABLE "public"."sms_templates" TO "anon";
GRANT ALL ON TABLE "public"."sms_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_templates" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."super_admins" TO "anon";
GRANT ALL ON TABLE "public"."super_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."super_admins" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_integrations" TO "anon";
GRANT ALL ON TABLE "public"."tenant_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_invitations" TO "anon";
GRANT ALL ON TABLE "public"."tenant_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_members" TO "anon";
GRANT ALL ON TABLE "public"."tenant_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_members" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_wmonid_usage" TO "anon";
GRANT ALL ON TABLE "public"."tenant_wmonid_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_wmonid_usage" TO "service_role";



GRANT ALL ON TABLE "public"."testimonial_cases" TO "anon";
GRANT ALL ON TABLE "public"."testimonial_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonial_cases" TO "service_role";



GRANT ALL ON TABLE "public"."testimonial_evidence_photos" TO "anon";
GRANT ALL ON TABLE "public"."testimonial_evidence_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonial_evidence_photos" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."unified_calendar" TO "anon";
GRANT ALL ON TABLE "public"."unified_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."upcoming_hearings" TO "anon";
GRANT ALL ON TABLE "public"."upcoming_hearings" TO "authenticated";
GRANT ALL ON TABLE "public"."upcoming_hearings" TO "service_role";



GRANT ALL ON TABLE "public"."urgent_deadlines" TO "anon";
GRANT ALL ON TABLE "public"."urgent_deadlines" TO "authenticated";
GRANT ALL ON TABLE "public"."urgent_deadlines" TO "service_role";



GRANT ALL ON TABLE "public"."user_memory" TO "anon";
GRANT ALL ON TABLE "public"."user_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."user_memory" TO "service_role";



GRANT ALL ON TABLE "public"."user_personas" TO "anon";
GRANT ALL ON TABLE "public"."user_personas" TO "authenticated";
GRANT ALL ON TABLE "public"."user_personas" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles_v4" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles_v4" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles_v4" TO "service_role";



GRANT ALL ON TABLE "public"."users_profiles" TO "anon";
GRANT ALL ON TABLE "public"."users_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."users_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."v_notification_statistics" TO "anon";
GRANT ALL ON TABLE "public"."v_notification_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."v_notification_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."v_recent_notification_activity" TO "anon";
GRANT ALL ON TABLE "public"."v_recent_notification_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."v_recent_notification_activity" TO "service_role";



GRANT ALL ON TABLE "the0"."documents" TO "anon";
GRANT ALL ON TABLE "the0"."documents" TO "authenticated";
GRANT ALL ON TABLE "the0"."documents" TO "service_role";



GRANT ALL ON TABLE "the0"."active_documents" TO "anon";
GRANT ALL ON TABLE "the0"."active_documents" TO "authenticated";
GRANT ALL ON TABLE "the0"."active_documents" TO "service_role";



GRANT ALL ON TABLE "the0"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "the0"."admin_notifications" TO "authenticated";
GRANT ALL ON TABLE "the0"."admin_notifications" TO "service_role";



GRANT ALL ON TABLE "the0"."ai_models" TO "anon";
GRANT ALL ON TABLE "the0"."ai_models" TO "authenticated";
GRANT ALL ON TABLE "the0"."ai_models" TO "service_role";



GRANT ALL ON TABLE "the0"."brief_exports" TO "anon";
GRANT ALL ON TABLE "the0"."brief_exports" TO "authenticated";
GRANT ALL ON TABLE "the0"."brief_exports" TO "service_role";



GRANT ALL ON TABLE "the0"."brief_guidelines" TO "anon";
GRANT ALL ON TABLE "the0"."brief_guidelines" TO "authenticated";
GRANT ALL ON TABLE "the0"."brief_guidelines" TO "service_role";



GRANT ALL ON TABLE "the0"."brief_inputs" TO "anon";
GRANT ALL ON TABLE "the0"."brief_inputs" TO "authenticated";
GRANT ALL ON TABLE "the0"."brief_inputs" TO "service_role";



GRANT ALL ON TABLE "the0"."brief_sessions" TO "anon";
GRANT ALL ON TABLE "the0"."brief_sessions" TO "authenticated";
GRANT ALL ON TABLE "the0"."brief_sessions" TO "service_role";



GRANT ALL ON TABLE "the0"."brief_templates" TO "anon";
GRANT ALL ON TABLE "the0"."brief_templates" TO "authenticated";
GRANT ALL ON TABLE "the0"."brief_templates" TO "service_role";



GRANT ALL ON TABLE "the0"."brief_versions" TO "anon";
GRANT ALL ON TABLE "the0"."brief_versions" TO "authenticated";
GRANT ALL ON TABLE "the0"."brief_versions" TO "service_role";



GRANT ALL ON TABLE "the0"."case_claim_norms" TO "anon";
GRANT ALL ON TABLE "the0"."case_claim_norms" TO "authenticated";
GRANT ALL ON TABLE "the0"."case_claim_norms" TO "service_role";



GRANT ALL ON TABLE "the0"."case_claims" TO "anon";
GRANT ALL ON TABLE "the0"."case_claims" TO "authenticated";
GRANT ALL ON TABLE "the0"."case_claims" TO "service_role";



GRANT ALL ON TABLE "the0"."case_issues" TO "anon";
GRANT ALL ON TABLE "the0"."case_issues" TO "authenticated";
GRANT ALL ON TABLE "the0"."case_issues" TO "service_role";



GRANT ALL ON TABLE "the0"."case_judgments" TO "anon";
GRANT ALL ON TABLE "the0"."case_judgments" TO "authenticated";
GRANT ALL ON TABLE "the0"."case_judgments" TO "service_role";



GRANT ALL ON TABLE "the0"."case_summaries" TO "anon";
GRANT ALL ON TABLE "the0"."case_summaries" TO "authenticated";
GRANT ALL ON TABLE "the0"."case_summaries" TO "service_role";



GRANT ALL ON TABLE "the0"."case_type_issue_templates" TO "anon";
GRANT ALL ON TABLE "the0"."case_type_issue_templates" TO "authenticated";
GRANT ALL ON TABLE "the0"."case_type_issue_templates" TO "service_role";



GRANT ALL ON TABLE "the0"."case_types" TO "anon";
GRANT ALL ON TABLE "the0"."case_types" TO "authenticated";
GRANT ALL ON TABLE "the0"."case_types" TO "service_role";



GRANT ALL ON TABLE "the0"."chat_messages" TO "anon";
GRANT ALL ON TABLE "the0"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "the0"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "the0"."chat_sessions" TO "anon";
GRANT ALL ON TABLE "the0"."chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "the0"."chat_sessions" TO "service_role";



GRANT ALL ON TABLE "the0"."citation_validation_logs" TO "anon";
GRANT ALL ON TABLE "the0"."citation_validation_logs" TO "authenticated";
GRANT ALL ON TABLE "the0"."citation_validation_logs" TO "service_role";



GRANT ALL ON TABLE "the0"."claim_change_types" TO "anon";
GRANT ALL ON TABLE "the0"."claim_change_types" TO "authenticated";
GRANT ALL ON TABLE "the0"."claim_change_types" TO "service_role";



GRANT ALL ON TABLE "the0"."claim_evidence" TO "anon";
GRANT ALL ON TABLE "the0"."claim_evidence" TO "authenticated";
GRANT ALL ON TABLE "the0"."claim_evidence" TO "service_role";



GRANT ALL ON TABLE "the0"."claim_issues" TO "anon";
GRANT ALL ON TABLE "the0"."claim_issues" TO "authenticated";
GRANT ALL ON TABLE "the0"."claim_issues" TO "service_role";



GRANT ALL ON TABLE "the0"."claim_subtypes" TO "anon";
GRANT ALL ON TABLE "the0"."claim_subtypes" TO "authenticated";
GRANT ALL ON TABLE "the0"."claim_subtypes" TO "service_role";



GRANT ALL ON TABLE "the0"."claim_versions" TO "anon";
GRANT ALL ON TABLE "the0"."claim_versions" TO "authenticated";
GRANT ALL ON TABLE "the0"."claim_versions" TO "service_role";



GRANT ALL ON TABLE "the0"."claims" TO "anon";
GRANT ALL ON TABLE "the0"."claims" TO "authenticated";
GRANT ALL ON TABLE "the0"."claims" TO "service_role";



GRANT ALL ON TABLE "the0"."collaboration_history" TO "anon";
GRANT ALL ON TABLE "the0"."collaboration_history" TO "authenticated";
GRANT ALL ON TABLE "the0"."collaboration_history" TO "service_role";



GRANT ALL ON TABLE "the0"."confirmed_strategies" TO "anon";
GRANT ALL ON TABLE "the0"."confirmed_strategies" TO "authenticated";
GRANT ALL ON TABLE "the0"."confirmed_strategies" TO "service_role";



GRANT ALL ON TABLE "the0"."context_summaries" TO "anon";
GRANT ALL ON TABLE "the0"."context_summaries" TO "authenticated";
GRANT ALL ON TABLE "the0"."context_summaries" TO "service_role";



GRANT ALL ON TABLE "the0"."doc_templates" TO "anon";
GRANT ALL ON TABLE "the0"."doc_templates" TO "authenticated";
GRANT ALL ON TABLE "the0"."doc_templates" TO "service_role";



GRANT ALL ON TABLE "the0"."document_evidence_links" TO "anon";
GRANT ALL ON TABLE "the0"."document_evidence_links" TO "authenticated";
GRANT ALL ON TABLE "the0"."document_evidence_links" TO "service_role";



GRANT ALL ON TABLE "the0"."draft_chunks" TO "anon";
GRANT ALL ON TABLE "the0"."draft_chunks" TO "authenticated";
GRANT ALL ON TABLE "the0"."draft_chunks" TO "service_role";



GRANT ALL ON TABLE "the0"."drafts_temp" TO "anon";
GRANT ALL ON TABLE "the0"."drafts_temp" TO "authenticated";
GRANT ALL ON TABLE "the0"."drafts_temp" TO "service_role";



GRANT ALL ON TABLE "the0"."evidence_documents" TO "anon";
GRANT ALL ON TABLE "the0"."evidence_documents" TO "authenticated";
GRANT ALL ON TABLE "the0"."evidence_documents" TO "service_role";



GRANT ALL ON TABLE "the0"."evidence_files" TO "anon";
GRANT ALL ON TABLE "the0"."evidence_files" TO "authenticated";
GRANT ALL ON TABLE "the0"."evidence_files" TO "service_role";



GRANT ALL ON TABLE "the0"."evidence_links" TO "anon";
GRANT ALL ON TABLE "the0"."evidence_links" TO "authenticated";
GRANT ALL ON TABLE "the0"."evidence_links" TO "service_role";



GRANT ALL ON TABLE "the0"."evidence_requests" TO "anon";
GRANT ALL ON TABLE "the0"."evidence_requests" TO "authenticated";
GRANT ALL ON TABLE "the0"."evidence_requests" TO "service_role";



GRANT ALL ON TABLE "the0"."ingested_files" TO "anon";
GRANT ALL ON TABLE "the0"."ingested_files" TO "authenticated";
GRANT ALL ON TABLE "the0"."ingested_files" TO "service_role";



GRANT ALL ON TABLE "the0"."issue_position_versions" TO "anon";
GRANT ALL ON TABLE "the0"."issue_position_versions" TO "authenticated";
GRANT ALL ON TABLE "the0"."issue_position_versions" TO "service_role";



GRANT ALL ON TABLE "the0"."legal_cases_ext" TO "anon";
GRANT ALL ON TABLE "the0"."legal_cases_ext" TO "authenticated";
GRANT ALL ON TABLE "the0"."legal_cases_ext" TO "service_role";



GRANT ALL ON TABLE "the0"."legal_norms" TO "anon";
GRANT ALL ON TABLE "the0"."legal_norms" TO "authenticated";
GRANT ALL ON TABLE "the0"."legal_norms" TO "service_role";



GRANT ALL ON TABLE "the0"."legal_synonyms" TO "anon";
GRANT ALL ON TABLE "the0"."legal_synonyms" TO "authenticated";
GRANT ALL ON TABLE "the0"."legal_synonyms" TO "service_role";



GRANT ALL ON SEQUENCE "the0"."legal_synonyms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "the0"."legal_synonyms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "the0"."legal_synonyms_id_seq" TO "service_role";



GRANT ALL ON TABLE "the0"."norm_relation_types" TO "anon";
GRANT ALL ON TABLE "the0"."norm_relation_types" TO "authenticated";
GRANT ALL ON TABLE "the0"."norm_relation_types" TO "service_role";



GRANT ALL ON TABLE "the0"."opponent_briefs" TO "anon";
GRANT ALL ON TABLE "the0"."opponent_briefs" TO "authenticated";
GRANT ALL ON TABLE "the0"."opponent_briefs" TO "service_role";



GRANT ALL ON TABLE "the0"."pending_files" TO "anon";
GRANT ALL ON TABLE "the0"."pending_files" TO "authenticated";
GRANT ALL ON TABLE "the0"."pending_files" TO "service_role";



GRANT ALL ON TABLE "the0"."pipeline_reviews" TO "anon";
GRANT ALL ON TABLE "the0"."pipeline_reviews" TO "authenticated";
GRANT ALL ON TABLE "the0"."pipeline_reviews" TO "service_role";



GRANT ALL ON TABLE "the0"."precedent_cache" TO "anon";
GRANT ALL ON TABLE "the0"."precedent_cache" TO "authenticated";
GRANT ALL ON TABLE "the0"."precedent_cache" TO "service_role";



GRANT ALL ON TABLE "the0"."prompt_feedback" TO "anon";
GRANT ALL ON TABLE "the0"."prompt_feedback" TO "authenticated";
GRANT ALL ON TABLE "the0"."prompt_feedback" TO "service_role";



GRANT ALL ON TABLE "the0"."prompt_history" TO "anon";
GRANT ALL ON TABLE "the0"."prompt_history" TO "authenticated";
GRANT ALL ON TABLE "the0"."prompt_history" TO "service_role";



GRANT ALL ON TABLE "the0"."prompts" TO "anon";
GRANT ALL ON TABLE "the0"."prompts" TO "authenticated";
GRANT ALL ON TABLE "the0"."prompts" TO "service_role";



GRANT ALL ON TABLE "the0"."reasoning_logs" TO "anon";
GRANT ALL ON TABLE "the0"."reasoning_logs" TO "authenticated";
GRANT ALL ON TABLE "the0"."reasoning_logs" TO "service_role";



GRANT ALL ON TABLE "the0"."rebuttals" TO "anon";
GRANT ALL ON TABLE "the0"."rebuttals" TO "authenticated";
GRANT ALL ON TABLE "the0"."rebuttals" TO "service_role";



GRANT ALL ON TABLE "the0"."statute_cache" TO "anon";
GRANT ALL ON TABLE "the0"."statute_cache" TO "authenticated";
GRANT ALL ON TABLE "the0"."statute_cache" TO "service_role";



GRANT ALL ON TABLE "the0"."temp_uploads" TO "anon";
GRANT ALL ON TABLE "the0"."temp_uploads" TO "authenticated";
GRANT ALL ON TABLE "the0"."temp_uploads" TO "service_role";



GRANT ALL ON TABLE "the0"."user_invitations" TO "anon";
GRANT ALL ON TABLE "the0"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "the0"."user_invitations" TO "service_role";



GRANT ALL ON TABLE "the0"."user_profiles" TO "anon";
GRANT ALL ON TABLE "the0"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "the0"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "the0"."users_profiles" TO "anon";
GRANT ALL ON TABLE "the0"."users_profiles" TO "authenticated";
GRANT ALL ON TABLE "the0"."users_profiles" TO "service_role";



GRANT ALL ON TABLE "the0"."work_sessions" TO "anon";
GRANT ALL ON TABLE "the0"."work_sessions" TO "authenticated";
GRANT ALL ON TABLE "the0"."work_sessions" TO "service_role";



GRANT ALL ON TABLE "the0"."work_tasks" TO "anon";
GRANT ALL ON TABLE "the0"."work_tasks" TO "authenticated";
GRANT ALL ON TABLE "the0"."work_tasks" TO "service_role";



GRANT ALL ON TABLE "theai"."documents" TO "anon";
GRANT ALL ON TABLE "theai"."documents" TO "authenticated";
GRANT ALL ON TABLE "theai"."documents" TO "service_role";



GRANT ALL ON TABLE "theai"."active_documents" TO "anon";
GRANT ALL ON TABLE "theai"."active_documents" TO "authenticated";
GRANT ALL ON TABLE "theai"."active_documents" TO "service_role";



GRANT ALL ON TABLE "theai"."case_summaries" TO "anon";
GRANT ALL ON TABLE "theai"."case_summaries" TO "authenticated";
GRANT ALL ON TABLE "theai"."case_summaries" TO "service_role";



GRANT ALL ON TABLE "theai"."chat_logs" TO "anon";
GRANT ALL ON TABLE "theai"."chat_logs" TO "authenticated";
GRANT ALL ON TABLE "theai"."chat_logs" TO "service_role";



GRANT ALL ON TABLE "theai"."claims" TO "anon";
GRANT ALL ON TABLE "theai"."claims" TO "authenticated";
GRANT ALL ON TABLE "theai"."claims" TO "service_role";



GRANT ALL ON TABLE "theai"."document_evidence_links" TO "anon";
GRANT ALL ON TABLE "theai"."document_evidence_links" TO "authenticated";
GRANT ALL ON TABLE "theai"."document_evidence_links" TO "service_role";



GRANT ALL ON TABLE "theai"."evidence_links" TO "anon";
GRANT ALL ON TABLE "theai"."evidence_links" TO "authenticated";
GRANT ALL ON TABLE "theai"."evidence_links" TO "service_role";



GRANT ALL ON TABLE "theai"."financial_records" TO "anon";
GRANT ALL ON TABLE "theai"."financial_records" TO "authenticated";
GRANT ALL ON TABLE "theai"."financial_records" TO "service_role";



GRANT ALL ON TABLE "theai"."ingested_files" TO "anon";
GRANT ALL ON TABLE "theai"."ingested_files" TO "authenticated";
GRANT ALL ON TABLE "theai"."ingested_files" TO "service_role";



GRANT ALL ON TABLE "theai"."legal_cases" TO "anon";
GRANT ALL ON TABLE "theai"."legal_cases" TO "authenticated";
GRANT ALL ON TABLE "theai"."legal_cases" TO "service_role";



GRANT ALL ON TABLE "theai"."legal_synonyms" TO "anon";
GRANT ALL ON TABLE "theai"."legal_synonyms" TO "authenticated";
GRANT ALL ON TABLE "theai"."legal_synonyms" TO "service_role";



GRANT ALL ON TABLE "theai"."rebuttals" TO "anon";
GRANT ALL ON TABLE "theai"."rebuttals" TO "authenticated";
GRANT ALL ON TABLE "theai"."rebuttals" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "the0" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "theai" GRANT ALL ON TABLES TO "service_role";




























