/**
 * 전국 법원 코드 매핑
 *
 * 나의사건검색 시스템에서 사용되는 법원 코드
 * 2024-12-31 기준 총 224개 법원
 */

// 법원 유형
export type CourtType =
  | 'supreme'      // 대법원
  | 'high'         // 고등법원
  | 'patent'       // 특허법원
  | 'district'     // 지방법원
  | 'branch'       // 지원
  | 'family'       // 가정법원
  | 'admin'        // 행정법원
  | 'bankruptcy'   // 회생법원
  | 'municipal';   // 시/군 법원

export interface CourtInfo {
  code: string;          // 법원 코드 (드롭다운 value)
  name: string;          // 법원 이름
  type: CourtType;       // 법원 유형
  region: string;        // 지역
  parent?: string;       // 상위 법원 (지원의 경우)
}

// 전국 법원 목록 (구분선 제외)
export const COURTS: CourtInfo[] = [
  // === 대법원 ===
  { code: '대법원', name: '대법원', type: 'supreme', region: '서울' },

  // === 고등법원 ===
  { code: '서울고등법원', name: '서울고등법원', type: 'high', region: '서울' },
  { code: '서울고등법원(춘천재판부)', name: '서울고등법원(춘천재판부)', type: 'high', region: '강원' },
  { code: '서울고등법원(인천재판부)', name: '서울고등법원(인천재판부)', type: 'high', region: '인천' },
  { code: '대전고등법원', name: '대전고등법원', type: 'high', region: '대전' },
  { code: '대전고등법원(청주재판부)', name: '대전고등법원(청주재판부)', type: 'high', region: '충북' },
  { code: '대구고등법원', name: '대구고등법원', type: 'high', region: '대구' },
  { code: '부산고등법원', name: '부산고등법원', type: 'high', region: '부산' },
  { code: '부산고등법원(창원재판부)', name: '부산고등법원(창원재판부)', type: 'high', region: '경남' },
  { code: '부산고등법원(울산재판부)', name: '부산고등법원(울산재판부)', type: 'high', region: '울산' },
  { code: '광주고등법원', name: '광주고등법원', type: 'high', region: '광주' },
  { code: '광주고등법원(제주재판부)', name: '광주고등법원(제주재판부)', type: 'high', region: '제주' },
  { code: '광주고등법원(전주재판부)', name: '광주고등법원(전주재판부)', type: 'high', region: '전북' },
  { code: '수원고등법원', name: '수원고등법원', type: 'high', region: '경기' },

  // === 특허법원 ===
  { code: '특허법원', name: '특허법원', type: 'patent', region: '대전' },

  // === 서울 지역 ===
  { code: '서울가정법원', name: '서울가정법원', type: 'family', region: '서울' },
  { code: '서울행정법원', name: '서울행정법원', type: 'admin', region: '서울' },
  { code: '서울회생법원', name: '서울회생법원', type: 'bankruptcy', region: '서울' },
  { code: '서울중앙지방법원', name: '서울중앙지방법원', type: 'district', region: '서울' },
  { code: '서울동부지방법원', name: '서울동부지방법원', type: 'district', region: '서울' },
  { code: '서울남부지방법원', name: '서울남부지방법원', type: 'district', region: '서울' },
  { code: '서울북부지방법원', name: '서울북부지방법원', type: 'district', region: '서울' },
  { code: '서울서부지방법원', name: '서울서부지방법원', type: 'district', region: '서울' },

  // === 의정부 지역 ===
  { code: '의정부지방법원', name: '의정부지방법원', type: 'district', region: '경기북부' },
  { code: '고양지원', name: '고양지원', type: 'branch', region: '경기북부', parent: '의정부지방법원' },
  { code: '남양주지원', name: '남양주지원', type: 'branch', region: '경기북부', parent: '의정부지방법원' },
  { code: '파주시법원', name: '파주시법원', type: 'municipal', region: '경기북부' },
  { code: '포천시법원', name: '포천시법원', type: 'municipal', region: '경기북부' },
  { code: '동두천시법원', name: '동두천시법원', type: 'municipal', region: '경기북부' },
  { code: '가평군법원', name: '가평군법원', type: 'municipal', region: '경기북부' },
  { code: '연천군법원', name: '연천군법원', type: 'municipal', region: '경기북부' },
  { code: '철원군법원', name: '철원군법원', type: 'municipal', region: '강원' },

  // === 인천 지역 ===
  { code: '인천지방법원', name: '인천지방법원', type: 'district', region: '인천' },
  { code: '인천지방법원 부천지원', name: '인천지방법원 부천지원', type: 'branch', region: '경기서부', parent: '인천지방법원' },
  { code: '김포시법원', name: '김포시법원', type: 'municipal', region: '경기서부' },
  { code: '강화군법원', name: '강화군법원', type: 'municipal', region: '인천' },
  { code: '인천가정법원', name: '인천가정법원', type: 'family', region: '인천' },
  { code: '인천가정법원 부천지원', name: '인천가정법원 부천지원', type: 'family', region: '경기서부', parent: '인천가정법원' },

  // === 수원 지역 ===
  { code: '수원지방법원', name: '수원지방법원', type: 'district', region: '경기남부' },
  { code: '성남지원', name: '성남지원', type: 'branch', region: '경기남부', parent: '수원지방법원' },
  { code: '여주지원', name: '여주지원', type: 'branch', region: '경기동부', parent: '수원지방법원' },
  { code: '평택지원', name: '평택지원', type: 'branch', region: '경기남부', parent: '수원지방법원' },
  { code: '안산지원', name: '안산지원', type: 'branch', region: '경기서부', parent: '수원지방법원' },
  { code: '안양지원', name: '안양지원', type: 'branch', region: '경기남부', parent: '수원지방법원' },
  { code: '용인시법원', name: '용인시법원', type: 'municipal', region: '경기남부' },
  { code: '오산시법원', name: '오산시법원', type: 'municipal', region: '경기남부' },
  { code: '광명시법원', name: '광명시법원', type: 'municipal', region: '경기서부' },
  { code: '안성시법원', name: '안성시법원', type: 'municipal', region: '경기남부' },
  { code: '광주시법원', name: '광주시법원', type: 'municipal', region: '경기동부' },
  { code: '양평군법원', name: '양평군법원', type: 'municipal', region: '경기동부' },
  { code: '이천시법원', name: '이천시법원', type: 'municipal', region: '경기동부' },
  { code: '수원가정법원', name: '수원가정법원', type: 'family', region: '경기남부' },
  { code: '수원가정법원 성남지원', name: '수원가정법원 성남지원', type: 'family', region: '경기남부', parent: '수원가정법원' },
  { code: '수원가정법원 여주지원', name: '수원가정법원 여주지원', type: 'family', region: '경기동부', parent: '수원가정법원' },
  { code: '수원가정법원 평택지원', name: '수원가정법원 평택지원', type: 'family', region: '경기남부', parent: '수원가정법원' },
  { code: '수원가정법원 안산지원', name: '수원가정법원 안산지원', type: 'family', region: '경기서부', parent: '수원가정법원' },
  { code: '수원가정법원 안양지원', name: '수원가정법원 안양지원', type: 'family', region: '경기남부', parent: '수원가정법원' },
  { code: '수원회생법원', name: '수원회생법원', type: 'bankruptcy', region: '경기남부' },

  // === 춘천 지역 ===
  { code: '춘천지방법원', name: '춘천지방법원', type: 'district', region: '강원' },
  { code: '강릉지원', name: '강릉지원', type: 'branch', region: '강원', parent: '춘천지방법원' },
  { code: '원주지원', name: '원주지원', type: 'branch', region: '강원', parent: '춘천지방법원' },
  { code: '속초지원', name: '속초지원', type: 'branch', region: '강원', parent: '춘천지방법원' },
  { code: '영월지원', name: '영월지원', type: 'branch', region: '강원', parent: '춘천지방법원' },
  { code: '홍천군법원', name: '홍천군법원', type: 'municipal', region: '강원' },
  { code: '양구군법원', name: '양구군법원', type: 'municipal', region: '강원' },
  { code: '삼척시법원', name: '삼척시법원', type: 'municipal', region: '강원' },
  { code: '동해시법원', name: '동해시법원', type: 'municipal', region: '강원' },
  { code: '정선군법원', name: '정선군법원', type: 'municipal', region: '강원' },
  { code: '평창군법원', name: '평창군법원', type: 'municipal', region: '강원' },
  { code: '태백시법원', name: '태백시법원', type: 'municipal', region: '강원' },
  { code: '횡성군법원', name: '횡성군법원', type: 'municipal', region: '강원' },
  { code: '인제군법원', name: '인제군법원', type: 'municipal', region: '강원' },
  { code: '화천군법원', name: '화천군법원', type: 'municipal', region: '강원' },
  { code: '고성군법원', name: '고성군법원', type: 'municipal', region: '강원' },
  { code: '양양군법원', name: '양양군법원', type: 'municipal', region: '강원' },

  // === 대전 지역 ===
  { code: '대전지방법원', name: '대전지방법원', type: 'district', region: '대전' },
  { code: '대전지방법원 홍성지원', name: '대전지방법원 홍성지원', type: 'branch', region: '충남', parent: '대전지방법원' },
  { code: '대전지방법원 공주지원', name: '대전지방법원 공주지원', type: 'branch', region: '충남', parent: '대전지방법원' },
  { code: '대전지방법원 논산지원', name: '대전지방법원 논산지원', type: 'branch', region: '충남', parent: '대전지방법원' },
  { code: '대전지방법원 서산지원', name: '대전지방법원 서산지원', type: 'branch', region: '충남', parent: '대전지방법원' },
  { code: '대전지방법원 천안지원', name: '대전지방법원 천안지원', type: 'branch', region: '충남', parent: '대전지방법원' },
  { code: '금산군법원', name: '금산군법원', type: 'municipal', region: '충남' },
  { code: '세종특별자치시법원', name: '세종특별자치시법원', type: 'municipal', region: '세종' },
  { code: '보령시법원', name: '보령시법원', type: 'municipal', region: '충남' },
  { code: '서천군법원', name: '서천군법원', type: 'municipal', region: '충남' },
  { code: '예산군법원', name: '예산군법원', type: 'municipal', region: '충남' },
  { code: '아산시법원', name: '아산시법원', type: 'municipal', region: '충남' },
  { code: '태안군법원', name: '태안군법원', type: 'municipal', region: '충남' },
  { code: '당진시법원', name: '당진시법원', type: 'municipal', region: '충남' },
  { code: '부여군법원', name: '부여군법원', type: 'municipal', region: '충남' },
  { code: '청양군법원', name: '청양군법원', type: 'municipal', region: '충남' },
  { code: '대전가정법원', name: '대전가정법원', type: 'family', region: '대전' },
  { code: '대전가정법원 홍성지원', name: '대전가정법원 홍성지원', type: 'family', region: '충남', parent: '대전가정법원' },
  { code: '대전가정법원 공주지원', name: '대전가정법원 공주지원', type: 'family', region: '충남', parent: '대전가정법원' },
  { code: '대전가정법원 논산지원', name: '대전가정법원 논산지원', type: 'family', region: '충남', parent: '대전가정법원' },
  { code: '대전가정법원 서산지원', name: '대전가정법원 서산지원', type: 'family', region: '충남', parent: '대전가정법원' },
  { code: '대전가정법원 천안지원', name: '대전가정법원 천안지원', type: 'family', region: '충남', parent: '대전가정법원' },

  // === 청주 지역 ===
  { code: '청주지방법원', name: '청주지방법원', type: 'district', region: '충북' },
  { code: '충주지원', name: '충주지원', type: 'branch', region: '충북', parent: '청주지방법원' },
  { code: '제천지원', name: '제천지원', type: 'branch', region: '충북', parent: '청주지방법원' },
  { code: '영동지원', name: '영동지원', type: 'branch', region: '충북', parent: '청주지방법원' },
  { code: '진천군법원', name: '진천군법원', type: 'municipal', region: '충북' },
  { code: '보은군법원', name: '보은군법원', type: 'municipal', region: '충북' },
  { code: '단양군법원', name: '단양군법원', type: 'municipal', region: '충북' },
  { code: '음성군법원', name: '음성군법원', type: 'municipal', region: '충북' },
  { code: '옥천군법원', name: '옥천군법원', type: 'municipal', region: '충북' },
  { code: '괴산군법원', name: '괴산군법원', type: 'municipal', region: '충북' },

  // === 대구 지역 ===
  { code: '대구지방법원', name: '대구지방법원', type: 'district', region: '대구' },
  { code: '대구지방법원 서부지원', name: '대구지방법원 서부지원', type: 'branch', region: '대구', parent: '대구지방법원' },
  { code: '대구지방법원 안동지원', name: '대구지방법원 안동지원', type: 'branch', region: '경북', parent: '대구지방법원' },
  { code: '대구지방법원 경주지원', name: '대구지방법원 경주지원', type: 'branch', region: '경북', parent: '대구지방법원' },
  { code: '대구지방법원 포항지원', name: '대구지방법원 포항지원', type: 'branch', region: '경북', parent: '대구지방법원' },
  { code: '대구지방법원 김천지원', name: '대구지방법원 김천지원', type: 'branch', region: '경북', parent: '대구지방법원' },
  { code: '대구지방법원 상주지원', name: '대구지방법원 상주지원', type: 'branch', region: '경북', parent: '대구지방법원' },
  { code: '대구지방법원 의성지원', name: '대구지방법원 의성지원', type: 'branch', region: '경북', parent: '대구지방법원' },
  { code: '대구지방법원 영덕지원', name: '대구지방법원 영덕지원', type: 'branch', region: '경북', parent: '대구지방법원' },
  { code: '경산시법원', name: '경산시법원', type: 'municipal', region: '경북' },
  { code: '칠곡군법원', name: '칠곡군법원', type: 'municipal', region: '경북' },
  { code: '청도군법원', name: '청도군법원', type: 'municipal', region: '경북' },
  { code: '영천시법원', name: '영천시법원', type: 'municipal', region: '경북' },
  { code: '성주군법원', name: '성주군법원', type: 'municipal', region: '경북' },
  { code: '고령군법원', name: '고령군법원', type: 'municipal', region: '경북' },
  { code: '영주시법원', name: '영주시법원', type: 'municipal', region: '경북' },
  { code: '봉화군법원', name: '봉화군법원', type: 'municipal', region: '경북' },
  { code: '구미시법원', name: '구미시법원', type: 'municipal', region: '경북' },
  { code: '문경시법원', name: '문경시법원', type: 'municipal', region: '경북' },
  { code: '예천군법원', name: '예천군법원', type: 'municipal', region: '경북' },
  { code: '청송군법원', name: '청송군법원', type: 'municipal', region: '경북' },
  { code: '군위군법원', name: '군위군법원', type: 'municipal', region: '경북' },
  { code: '울진군법원', name: '울진군법원', type: 'municipal', region: '경북' },
  { code: '영양군법원', name: '영양군법원', type: 'municipal', region: '경북' },
  { code: '대구가정법원', name: '대구가정법원', type: 'family', region: '대구' },
  { code: '대구가정법원 안동지원', name: '대구가정법원 안동지원', type: 'family', region: '경북', parent: '대구가정법원' },
  { code: '대구가정법원 경주지원', name: '대구가정법원 경주지원', type: 'family', region: '경북', parent: '대구가정법원' },
  { code: '대구가정법원 포항지원', name: '대구가정법원 포항지원', type: 'family', region: '경북', parent: '대구가정법원' },
  { code: '대구가정법원 김천지원', name: '대구가정법원 김천지원', type: 'family', region: '경북', parent: '대구가정법원' },
  { code: '대구가정법원 상주지원', name: '대구가정법원 상주지원', type: 'family', region: '경북', parent: '대구가정법원' },
  { code: '대구가정법원 의성지원', name: '대구가정법원 의성지원', type: 'family', region: '경북', parent: '대구가정법원' },
  { code: '대구가정법원 영덕지원', name: '대구가정법원 영덕지원', type: 'family', region: '경북', parent: '대구가정법원' },

  // === 부산 지역 ===
  { code: '부산지방법원', name: '부산지방법원', type: 'district', region: '부산' },
  { code: '부산지방법원 동부지원', name: '부산지방법원 동부지원', type: 'branch', region: '부산', parent: '부산지방법원' },
  { code: '부산지방법원 서부지원', name: '부산지방법원 서부지원', type: 'branch', region: '부산', parent: '부산지방법원' },
  { code: '부산가정법원', name: '부산가정법원', type: 'family', region: '부산' },
  { code: '부산회생법원', name: '부산회생법원', type: 'bankruptcy', region: '부산' },

  // === 울산 지역 ===
  { code: '울산지방법원', name: '울산지방법원', type: 'district', region: '울산' },
  { code: '양산시법원', name: '양산시법원', type: 'municipal', region: '경남' },
  { code: '울산가정법원', name: '울산가정법원', type: 'family', region: '울산' },

  // === 창원 지역 ===
  { code: '창원지방법원', name: '창원지방법원', type: 'district', region: '경남' },
  { code: '마산지원', name: '마산지원', type: 'branch', region: '경남', parent: '창원지방법원' },
  { code: '진주지원', name: '진주지원', type: 'branch', region: '경남', parent: '창원지방법원' },
  { code: '통영지원', name: '통영지원', type: 'branch', region: '경남', parent: '창원지방법원' },
  { code: '밀양지원', name: '밀양지원', type: 'branch', region: '경남', parent: '창원지방법원' },
  { code: '거창지원', name: '거창지원', type: 'branch', region: '경남', parent: '창원지방법원' },
  { code: '창원남부시법원', name: '창원남부시법원', type: 'municipal', region: '경남' },
  { code: '김해시법원', name: '김해시법원', type: 'municipal', region: '경남' },
  { code: '함안군법원', name: '함안군법원', type: 'municipal', region: '경남' },
  { code: '의령군법원', name: '의령군법원', type: 'municipal', region: '경남' },
  { code: '사천시법원', name: '사천시법원', type: 'municipal', region: '경남' },
  { code: '남해군법원', name: '남해군법원', type: 'municipal', region: '경남' },
  { code: '하동군법원', name: '하동군법원', type: 'municipal', region: '경남' },
  { code: '거제시법원', name: '거제시법원', type: 'municipal', region: '경남' },
  { code: '고성군법원(경)', name: '고성군법원(경)', type: 'municipal', region: '경남' },
  { code: '창녕군법원', name: '창녕군법원', type: 'municipal', region: '경남' },
  { code: '합천군법원', name: '합천군법원', type: 'municipal', region: '경남' },
  { code: '함양군법원', name: '함양군법원', type: 'municipal', region: '경남' },
  { code: '산청군법원', name: '산청군법원', type: 'municipal', region: '경남' },

  // === 광주 지역 ===
  { code: '광주지방법원', name: '광주지방법원', type: 'district', region: '광주' },
  { code: '광주지방법원 목포지원', name: '광주지방법원 목포지원', type: 'branch', region: '전남', parent: '광주지방법원' },
  { code: '광주지방법원 장흥지원', name: '광주지방법원 장흥지원', type: 'branch', region: '전남', parent: '광주지방법원' },
  { code: '광주지방법원 순천지원', name: '광주지방법원 순천지원', type: 'branch', region: '전남', parent: '광주지방법원' },
  { code: '광주지방법원 해남지원', name: '광주지방법원 해남지원', type: 'branch', region: '전남', parent: '광주지방법원' },
  { code: '담양군법원', name: '담양군법원', type: 'municipal', region: '전남' },
  { code: '함평군법원', name: '함평군법원', type: 'municipal', region: '전남' },
  { code: '강진군법원', name: '강진군법원', type: 'municipal', region: '전남' },
  { code: '구례군법원', name: '구례군법원', type: 'municipal', region: '전남' },
  { code: '영광군법원', name: '영광군법원', type: 'municipal', region: '전남' },
  { code: '나주시법원', name: '나주시법원', type: 'municipal', region: '전남' },
  { code: '장성군법원', name: '장성군법원', type: 'municipal', region: '전남' },
  { code: '화순군법원', name: '화순군법원', type: 'municipal', region: '전남' },
  { code: '곡성군법원', name: '곡성군법원', type: 'municipal', region: '전남' },
  { code: '광양시법원', name: '광양시법원', type: 'municipal', region: '전남' },
  { code: '고흥군법원', name: '고흥군법원', type: 'municipal', region: '전남' },
  { code: '여수시법원', name: '여수시법원', type: 'municipal', region: '전남' },
  { code: '보성군법원', name: '보성군법원', type: 'municipal', region: '전남' },
  { code: '무안군법원', name: '무안군법원', type: 'municipal', region: '전남' },
  { code: '영암군법원', name: '영암군법원', type: 'municipal', region: '전남' },
  { code: '완도군법원', name: '완도군법원', type: 'municipal', region: '전남' },
  { code: '진도군법원', name: '진도군법원', type: 'municipal', region: '전남' },
  { code: '광주가정법원', name: '광주가정법원', type: 'family', region: '광주' },
  { code: '광주가정법원 목포지원', name: '광주가정법원 목포지원', type: 'family', region: '전남', parent: '광주가정법원' },
  { code: '광주가정법원 장흥지원', name: '광주가정법원 장흥지원', type: 'family', region: '전남', parent: '광주가정법원' },
  { code: '광주가정법원 순천지원', name: '광주가정법원 순천지원', type: 'family', region: '전남', parent: '광주가정법원' },
  { code: '광주가정법원 해남지원', name: '광주가정법원 해남지원', type: 'family', region: '전남', parent: '광주가정법원' },

  // === 전주 지역 ===
  { code: '전주지방법원', name: '전주지방법원', type: 'district', region: '전북' },
  { code: '군산지원', name: '군산지원', type: 'branch', region: '전북', parent: '전주지방법원' },
  { code: '정읍지원', name: '정읍지원', type: 'branch', region: '전북', parent: '전주지방법원' },
  { code: '남원지원', name: '남원지원', type: 'branch', region: '전북', parent: '전주지방법원' },
  { code: '진안군법원', name: '진안군법원', type: 'municipal', region: '전북' },
  { code: '김제시법원', name: '김제시법원', type: 'municipal', region: '전북' },
  { code: '무주군법원', name: '무주군법원', type: 'municipal', region: '전북' },
  { code: '임실군법원', name: '임실군법원', type: 'municipal', region: '전북' },
  { code: '익산시법원', name: '익산시법원', type: 'municipal', region: '전북' },
  { code: '부안군법원', name: '부안군법원', type: 'municipal', region: '전북' },
  { code: '고창군법원', name: '고창군법원', type: 'municipal', region: '전북' },
  { code: '장수군법원', name: '장수군법원', type: 'municipal', region: '전북' },
  { code: '순창군법원', name: '순창군법원', type: 'municipal', region: '전북' },

  // === 제주 지역 ===
  { code: '제주지방법원', name: '제주지방법원', type: 'district', region: '제주' },
  { code: '서귀포시법원', name: '서귀포시법원', type: 'municipal', region: '제주' },

  // === 기타 ===
  { code: '법원행정처', name: '법원행정처', type: 'admin', region: '서울' },
];

// 코드로 법원 정보 조회
export function getCourtByCode(code: string): CourtInfo | undefined {
  return COURTS.find(c => c.code === code);
}

// 이름으로 법원 정보 조회
export function getCourtByName(name: string): CourtInfo | undefined {
  return COURTS.find(c => c.name === name || c.code === name);
}

// 유형별 법원 목록 조회
export function getCourtsByType(type: CourtType): CourtInfo[] {
  return COURTS.filter(c => c.type === type);
}

// 지역별 법원 목록 조회
export function getCourtsByRegion(region: string): CourtInfo[] {
  return COURTS.filter(c => c.region === region);
}

// 상위 법원의 하위 법원(지원) 목록 조회
export function getBranchCourts(parentCode: string): CourtInfo[] {
  return COURTS.filter(c => c.parent === parentCode);
}

// 법원 이름 자동완성용 검색
export function searchCourts(query: string): CourtInfo[] {
  const lowerQuery = query.toLowerCase();
  return COURTS.filter(c =>
    c.name.toLowerCase().includes(lowerQuery) ||
    c.code.toLowerCase().includes(lowerQuery)
  );
}

// 드롭다운용 법원 목록 (구분선 포함)
export function getCourtsForDropdown(): Array<{ value: string; label: string; disabled?: boolean }> {
  return COURTS.map(c => ({
    value: c.code,
    label: c.name,
    disabled: c.code === '------------'
  }));
}

// 법원 통계
export const COURT_STATS = {
  total: COURTS.length,
  byType: {
    supreme: COURTS.filter(c => c.type === 'supreme').length,
    high: COURTS.filter(c => c.type === 'high').length,
    patent: COURTS.filter(c => c.type === 'patent').length,
    district: COURTS.filter(c => c.type === 'district').length,
    branch: COURTS.filter(c => c.type === 'branch').length,
    family: COURTS.filter(c => c.type === 'family').length,
    admin: COURTS.filter(c => c.type === 'admin').length,
    bankruptcy: COURTS.filter(c => c.type === 'bankruptcy').length,
    municipal: COURTS.filter(c => c.type === 'municipal').length,
  }
};
