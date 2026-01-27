#!/bin/bash
# ============================================================================
# 새 Supabase 프로젝트에 스키마 적용 스크립트
# 프로젝트: feqxrodutqwliucfllgr.supabase.co
# ============================================================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Supabase 스키마 마이그레이션 스크립트${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 새 프로젝트 정보
NEW_PROJECT_REF="feqxrodutqwliucfllgr"
NEW_PROJECT_URL="https://${NEW_PROJECT_REF}.supabase.co"

# 마이그레이션 파일 목록 (순서대로)
MIGRATIONS=(
  "20260201_000_core_functions.sql"
  "20260201_001_core_types.sql"
  "20260201_002_core_tenant.sql"
  "20260201_003_domain_clients.sql"
  "20260201_004_domain_cases.sql"
  "20260201_005_domain_schedules.sql"
  "20260201_006_domain_consultations.sql"
  "20260201_007_domain_finance.sql"
  "20260201_008_domain_notifications.sql"
  "20260201_009_domain_scourt.sql"
  "20260201_010_views.sql"
)

# 현재 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

echo -e "${YELLOW}프로젝트 루트:${NC} $PROJECT_ROOT"
echo -e "${YELLOW}마이그레이션 폴더:${NC} $MIGRATIONS_DIR"
echo ""

# 마이그레이션 파일 확인
echo -e "${GREEN}마이그레이션 파일 확인 중...${NC}"
MISSING_FILES=0
for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$MIGRATIONS_DIR/$migration" ]; then
    echo -e "  ${GREEN}✓${NC} $migration"
  else
    echo -e "  ${RED}✗${NC} $migration (파일 없음)"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done
echo ""

if [ $MISSING_FILES -gt 0 ]; then
  echo -e "${RED}오류: $MISSING_FILES 개의 마이그레이션 파일이 없습니다.${NC}"
  exit 1
fi

# 적용 방법 안내
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  마이그레이션 적용 방법${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}방법 1: Supabase CLI 사용 (권장)${NC}"
echo ""
echo "  # 1. 새 프로젝트에 연결"
echo "  supabase link --project-ref $NEW_PROJECT_REF"
echo ""
echo "  # 2. 마이그레이션 적용"
echo "  supabase db push"
echo ""
echo -e "${YELLOW}방법 2: Supabase Dashboard SQL Editor 사용${NC}"
echo ""
echo "  1. https://supabase.com/dashboard/project/$NEW_PROJECT_REF/sql 접속"
echo "  2. 아래 순서대로 각 파일 내용을 복사하여 실행:"
echo ""
for migration in "${MIGRATIONS[@]}"; do
  echo "     - $migration"
done
echo ""
echo -e "${YELLOW}방법 3: 통합 SQL 파일 생성${NC}"
echo ""
echo "  아래 명령어로 모든 마이그레이션을 하나의 파일로 병합:"
echo ""
echo "  cat \\"
for i in "${!MIGRATIONS[@]}"; do
  if [ $i -eq $((${#MIGRATIONS[@]} - 1)) ]; then
    echo "    \"\$MIGRATIONS_DIR/${MIGRATIONS[$i]}\" \\"
  else
    echo "    \"\$MIGRATIONS_DIR/${MIGRATIONS[$i]}\" \\"
  fi
done
echo "    > combined_migration.sql"
echo ""

# 통합 파일 생성 옵션
echo -e "${GREEN}========================================${NC}"
echo ""
read -p "통합 SQL 파일을 생성하시겠습니까? (y/N): " CREATE_COMBINED

if [[ "$CREATE_COMBINED" =~ ^[Yy]$ ]]; then
  COMBINED_FILE="$PROJECT_ROOT/supabase/combined_schema.sql"
  echo "" > "$COMBINED_FILE"

  echo "-- ============================================================================" >> "$COMBINED_FILE"
  echo "-- 법률 사무소 SaaS - 통합 스키마" >> "$COMBINED_FILE"
  echo "-- 생성일: $(date '+%Y-%m-%d %H:%M:%S')" >> "$COMBINED_FILE"
  echo "-- 프로젝트: $NEW_PROJECT_URL" >> "$COMBINED_FILE"
  echo "-- ============================================================================" >> "$COMBINED_FILE"
  echo "" >> "$COMBINED_FILE"

  for migration in "${MIGRATIONS[@]}"; do
    echo "" >> "$COMBINED_FILE"
    echo "-- ============================================================================" >> "$COMBINED_FILE"
    echo "-- 파일: $migration" >> "$COMBINED_FILE"
    echo "-- ============================================================================" >> "$COMBINED_FILE"
    echo "" >> "$COMBINED_FILE"
    cat "$MIGRATIONS_DIR/$migration" >> "$COMBINED_FILE"
    echo "" >> "$COMBINED_FILE"
  done

  echo -e "${GREEN}✓${NC} 통합 파일 생성 완료: $COMBINED_FILE"
  echo ""
  echo "  파일 크기: $(du -h "$COMBINED_FILE" | cut -f1)"
  echo ""
fi

echo -e "${GREEN}완료!${NC}"
