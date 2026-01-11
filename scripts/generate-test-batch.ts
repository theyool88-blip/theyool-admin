/**
 * Lawdesk 데이터로 테스트 배치 파일 생성
 * 의뢰인 이름이 동일하면 같은 의뢰인으로 처리하여 정보 통일
 */

import * as XLSX from 'xlsx'

// 수집된 데이터 (1~3페이지)
const rawCases = [
  // === 1페이지 ===
  { caseNumber: '평택가정2025드단20616', caseName: '이혼 등', client: '정정희', clientRole: '원고', opponent: '김윤길', lawyer: '임은지' },
  { caseNumber: '수원가정법원2024드단26718', caseName: '이혼 등', client: '김윤한', clientRole: '원고', opponent: '김진희', lawyer: '임은지' },
  { caseNumber: '평택가정2024드단22722', caseName: '이혼', client: '이대경', clientRole: '원고', opponent: '성나연', lawyer: '임은지' },
  { caseNumber: '평택가정2024드단25547', caseName: '이혼 등 청구', client: '엄현식', clientRole: '피고', opponent: '심민선', lawyer: '임은지' },
  { caseNumber: '수원고법2025르10433', caseName: '이혼 및 재산분할', client: '조유경', clientRole: '피고', opponent: '유창수', lawyer: '임은지' },
  { caseNumber: '수원가정법원2025드단22986', caseName: '이혼 및 위자료 등', client: '임청아', clientRole: '원고', opponent: '김재환', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20932', caseName: '손해배상(기)', client: '권순영', clientRole: '원고', opponent: '이원재', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20956', caseName: '이혼 등', client: '김재영', clientRole: '원고', opponent: '박근', lawyer: '임은지' },
  { caseNumber: '평택지원2025가단55158', caseName: '손해배상(기)', client: '이명규', clientRole: '원고', opponent: '이정호', lawyer: '임은지' },
  { caseNumber: '평택가정2026드단20014', caseName: '손해배상(기)', client: '김은성', clientRole: '원고', opponent: '김근웅', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단61', caseName: '이혼 등', client: '이미옥', clientRole: '원고', opponent: '김현석', lawyer: '임은지' },
  { caseNumber: '서산가정2025드단50218', caseName: '이혼 및 재산분할', client: '김동원', clientRole: '피고', opponent: '황장옥', lawyer: '임은지' },
  { caseNumber: '평택지원2025가단53626', caseName: '손해배상(기)', client: '편수지', clientRole: '원고', opponent: '이설미', lawyer: '임은지' },
  { caseNumber: '서울가정법원2025드단57177', caseName: '이혼 등', client: '박세원', clientRole: '원고', opponent: '김경태', lawyer: '임은지' },
  { caseNumber: '수원고법2025르10717', caseName: '이혼 등', client: '장원석', clientRole: '원고', opponent: '고학순', lawyer: '' },
  { caseNumber: '평택가정2026즈기1014', caseName: '증거보전', client: '김은성', clientRole: '신청인', opponent: '김근웅', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20579', caseName: '이혼 등', client: '이혜진', clientRole: '원고', opponent: '김성민', lawyer: '임은지' },
  { caseNumber: '천안가정2025느단3513', caseName: '재산분할', client: '김지영', clientRole: '청구인', opponent: '윤영균', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈단10057', caseName: '채권가압류', client: '한영미', clientRole: '채권자', opponent: '손선용', lawyer: '임은지' },
  { caseNumber: '평택가정2025너2096', caseName: '이혼 등', client: '조주성', clientRole: '신청인', opponent: '신부영', lawyer: '임은지' },
  { caseNumber: '천안가정2025드단5817', caseName: '이혼등', client: '김정아', clientRole: '피고', opponent: '이시찬', lawyer: '임은지' },
  { caseNumber: '서울북부지법2025가단109347', caseName: '손해배상(기)', client: '강미자', clientRole: '피고', opponent: '조윤혜', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20790', caseName: '이혼 및 위자료', client: '장혜진', clientRole: '피고', opponent: '김태권', lawyer: '임은지' },
  { caseNumber: '부산가정법원2025너20462', caseName: '이혼', client: '박준범', clientRole: '신청인', opponent: '방수진', lawyer: '임은지' },
  { caseNumber: '청주지법2025머51837', caseName: '위자료', client: '박선희', clientRole: '피고', opponent: '최하윤', lawyer: '임은지' },
  { caseNumber: '천안가정2024드단16575', caseName: '이혼 등', client: '이진산', clientRole: '원고', opponent: '김아린', lawyer: '임은지' },
  { caseNumber: '수원가정법원2025드단1488', caseName: '이혼', client: '명미정', clientRole: '원고', opponent: '김성태', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20908', caseName: '손해배상(기)', client: '조주성', clientRole: '원고', opponent: '최주성', lawyer: '' },
  { caseNumber: '평택지원2025카기10680', caseName: '증거보전', client: '이명규', clientRole: '신청인', opponent: '이정호', lawyer: '임은지' },
  { caseNumber: '천안가정2025느단3520', caseName: '친권자 및 양육자 변경 등', client: '김지영', clientRole: '청구인', opponent: '윤영균', lawyer: '임은지' },
  { caseNumber: '평택지원2025카확1339', caseName: '소송비용액확정', client: '엄규철', clientRole: '신청인', opponent: '김윤영', lawyer: '임은지' },
  { caseNumber: '안성시법원2025가소6582', caseName: '약정금', client: '임승태', clientRole: '원고', opponent: '안선영', lawyer: '임은지' },
  { caseNumber: '청주지법2025가단55301', caseName: '위자료', client: '최하윤', clientRole: '피고', opponent: '박선희', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20538', caseName: '사실혼 파기로 인한 위자료 및 재산분할', client: '김근령', clientRole: '원고', opponent: '김숙향', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20540', caseName: '이혼 등', client: '한영미', clientRole: '피고', opponent: '손선용', lawyer: '임은지' },
  { caseNumber: '천안지원2025카불6034', caseName: '채무불이행자명부등재', client: '강호현', clientRole: '채권자', opponent: '허지훈', lawyer: '임은지' },
  { caseNumber: '천안지원2025카기5747', caseName: '증거보전', client: '이명규', clientRole: '신청인', opponent: '이정호', lawyer: '' },
  { caseNumber: '평택지원2025가소75559', caseName: '구상금', client: '윤승연', clientRole: '원고', opponent: '정현일', lawyer: '임은지' },
  { caseNumber: '평택가정2025너2110', caseName: '이혼 등', client: '권순영', clientRole: '신청인', opponent: '황아름', lawyer: '임은지' },
  { caseNumber: '의정부지법2024가단109296', caseName: '기타(금전)', client: '린유지', clientRole: '원고', opponent: '지옥녀', lawyer: '김현성' },
  { caseNumber: '평택가정2025드단20433', caseName: '손해배상(기)', client: '김요한', clientRole: '피고', opponent: '정우진', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20513', caseName: '이혼 등', client: '장은서', clientRole: '피고', opponent: '권혁용', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20704', caseName: '이혼 등', client: '박유경', clientRole: '원고', opponent: '임재완', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20629', caseName: '손해배상(기)', client: '김동구', clientRole: '피고', opponent: '장영현', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20643', caseName: '이혼 청구의 소', client: '김인경', clientRole: '피고', opponent: '임일모', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20799', caseName: '이혼 등', client: '양미석', clientRole: '피고', opponent: '윤석희', lawyer: '임은지' },
  { caseNumber: '평택가정2025느단10799', caseName: '양육비 변경 심판청구', client: '백민지', clientRole: '청구인', opponent: '안영언', lawyer: '임은지' },
  { caseNumber: '수원고법2025르10595', caseName: '이혼 및 재산분할', client: '최재영', clientRole: '피고', opponent: '정은화', lawyer: '임은지' },
  { caseNumber: '평택지원2025가단54136', caseName: '손해배상(기)', client: '박종각', clientRole: '원고', opponent: '김동섭', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20734', caseName: '이혼 등', client: '장혜진', clientRole: '원고', opponent: '김태권', lawyer: '임은지' },
  { caseNumber: '수원가정법원2025즈단5380', caseName: '채권가압류', client: '임청아', clientRole: '채권자', opponent: '김재환', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈기1188', caseName: '소송비용액확정', client: '장지원', clientRole: '신청인', opponent: '이강열', lawyer: '임은지' },
  { caseNumber: '천안가정2025드단5823', caseName: '손해배상(기)', client: '김태일', clientRole: '피고', opponent: '권형철', lawyer: '임은지' },
  { caseNumber: '평택가정2025드합2016', caseName: '이혼 등', client: '장원석', clientRole: '원고', opponent: '고학순', lawyer: '임은지' },
  { caseNumber: '평택가정2025너2054', caseName: '이혼 등', client: '이향은', clientRole: '신청인', opponent: '우윤제', lawyer: '임은지' },
  { caseNumber: '수원가정법원2025너3762', caseName: '이혼 등', client: '김홍숙', clientRole: '신청인', opponent: '정수길', lawyer: '임은지' },
  { caseNumber: '제주지법2025카기1453', caseName: '증거보전', client: '현세인', clientRole: '신청인', opponent: '김진영', lawyer: '임은지' },
  { caseNumber: '평택지원2025가소73623', caseName: '손해배상(기)', client: '박지원', clientRole: '피고', opponent: '조아라', lawyer: '임은지' },
  { caseNumber: '수원지법2025머57057', caseName: '손해배상(기)', client: '윤기석', clientRole: '피고', opponent: '신용윤', lawyer: '임은지' },
  { caseNumber: '수원지법2025나56298', caseName: '손해배상(기)', client: '윤기석', clientRole: '피고', opponent: '신용윤', lawyer: '임은지' },
  { caseNumber: '평택가정2025너2080', caseName: '이혼 등', client: '김재영', clientRole: '신청인', opponent: '박근', lawyer: '임은지' },
  { caseNumber: '평택지원2025가단54671', caseName: '손해배상(기)', client: '박해용', clientRole: '원고', opponent: '정재훈', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈기21', caseName: '사전처분(양육비)', client: '이미옥', clientRole: '신청인', opponent: '김현석', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈기22', caseName: '사전처분(접근금지)', client: '이미옥', clientRole: '신청인', opponent: '김현석', lawyer: '임은지' },
  { caseNumber: '서울가정법원2025드단56066', caseName: '이혼 등', client: '한숙영', clientRole: '원고', opponent: '오병삼', lawyer: '임은지' },
  { caseNumber: '대전가정법원2025브5093', caseName: '사전처분', client: '김지영', clientRole: '상대방', opponent: '윤영균', lawyer: '임은지' },
  { caseNumber: '고양지원2024드단58330', caseName: '이혼 등 청구', client: '박정현', clientRole: '피고', opponent: '임지혜', lawyer: '임은지' },
  { caseNumber: '고양지원2024드단56174', caseName: '이혼 등', client: '박정현', clientRole: '원고', opponent: '임지혜', lawyer: '임은지' },
  { caseNumber: '천안가정2025느단174', caseName: '양육비', client: '송희영', clientRole: '청구인', opponent: '김동석', lawyer: '임은지' },
  { caseNumber: '평택지원2025가단53130', caseName: '손해배상(기)', client: '조주성', clientRole: '원고', opponent: '최주성', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20432', caseName: '손해배상(기)', client: '홍강의', clientRole: '원고', opponent: '조희태', lawyer: '임은지' },
  { caseNumber: '안성시법원2025차전2850', caseName: '약정금', client: '임승태', clientRole: '채권자', opponent: '안선영', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈기1136', caseName: '소송비용액확정', client: '홍종범', clientRole: '신청인', opponent: '김승하', lawyer: '임은지' },
  { caseNumber: '천안가정2025너3163', caseName: '이혼 등', client: '김태일', clientRole: '피신청인', opponent: '서효정', lawyer: '임은지' },
  { caseNumber: '천안가정2025드단78', caseName: '이혼 등', client: '김정언', clientRole: '원고', opponent: '정찬덕', lawyer: '임은지' },
  { caseNumber: '평택가정2025너2059', caseName: '이혼 등', client: '신희정', clientRole: '신청인', opponent: '김동경', lawyer: '임은지' },
  { caseNumber: '평택가정2025너7', caseName: '이혼 등', client: '윤은영', clientRole: '신청인', opponent: '이택주', lawyer: '임은지' },
  { caseNumber: '평택지원2025카확1397', caseName: '소송비용액확정', client: '한수연', clientRole: '신청인', opponent: '이대겸', lawyer: '김현성' },
  { caseNumber: '천안가정2025즈기446', caseName: '사전처분', client: '김지영', clientRole: '피신청인', opponent: '윤영균', lawyer: '임은지' },
  { caseNumber: '평택가정2024느단10878', caseName: '친권자 및 양육자 변경 등', client: '안병용', clientRole: '상대방', opponent: '김성희', lawyer: '임은지' },
  { caseNumber: '수원가정법원2025즈기181', caseName: '사전처분', client: '명미정', clientRole: '신청인', opponent: '김성태', lawyer: '임은지' },
  { caseNumber: '서울가정법원2025즈단30625', caseName: '부동산가압류', client: '한숙영', clientRole: '채권자', opponent: '오병삼', lawyer: '임은지' },
  { caseNumber: '천안가정2025너3143', caseName: '이혼 등', client: '이보배', clientRole: '신청인', opponent: '이상인', lawyer: '' },
  { caseNumber: '아산시법원2025차전4449', caseName: '대여금', client: '김경회', clientRole: '채권자', opponent: '권순옥', lawyer: '김현성' },
  { caseNumber: '평택가정2024드단23022', caseName: '이혼등', client: '양수경', clientRole: '원고', opponent: '최현용', lawyer: '임은지' },
  { caseNumber: '서울가정법원2025너12588', caseName: '이혼 등', client: '박세원', clientRole: '신청인', opponent: '김경태', lawyer: '임은지' },
  { caseNumber: '평택가정2024드단24315', caseName: '이혼 및 위자료', client: '양수경', clientRole: '피고', opponent: '최현용', lawyer: '임은지' },
  { caseNumber: '청주지법2025가단53832', caseName: '손해배상(기)', client: '윤가연', clientRole: '피고', opponent: '곽수진', lawyer: '임은지' },
  { caseNumber: '순천지원2025카불10526', caseName: '채무불이행자명부등재', client: '법무법인 더율', clientRole: '채권자', opponent: '권용관', lawyer: '김현성' },
  { caseNumber: '평택지원2025가소73430', caseName: '구상금', client: '문재웅', clientRole: '피고', opponent: '현채원', lawyer: '임은지' },
  { caseNumber: '천안지원2025카불5736', caseName: '채무불이행자명부등재', client: '법무법인 더율', clientRole: '채권자', opponent: '윤영일', lawyer: '김현성' },
  { caseNumber: '평택가정2025너2072', caseName: '이혼 등 조정신청', client: '양미석', clientRole: '피신청인', opponent: '윤석희', lawyer: '임은지' },
  { caseNumber: '천안지원2025카명6586', caseName: '재산명시', client: '강호현', clientRole: '채권자', opponent: '허지훈', lawyer: '' },
  { caseNumber: '서산가정2025드단50375', caseName: '이혼 등', client: '김동원', clientRole: '원고', opponent: '황장옥', lawyer: '임은지' },
  { caseNumber: '평택가정2024드단23848', caseName: '이혼 및 재산분할', client: '최재영', clientRole: '피고', opponent: '정은화', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈단10050', caseName: '부동산가압류', client: '장혜진', clientRole: '채권자', opponent: '김태권', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20731', caseName: '사실혼 파기로 인한 위자료 및 재산분할', client: '김근령', clientRole: '피고', opponent: '김숙향', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈단10045', caseName: '채권가압류', client: '윤은영', clientRole: '채권자', opponent: '이택주', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20727', caseName: '이혼 등', client: '한영미', clientRole: '원고', opponent: '손선용', lawyer: '임은지' },
  { caseNumber: '천안가정2025즈기27', caseName: '이행명령', client: '이윤주', clientRole: '신청인', opponent: '홍지수', lawyer: '임은지' },

  // === 2페이지 ===
  { caseNumber: '수원고법2025너10082', caseName: '이혼 및 재산분할', client: '조유경', clientRole: '피고', opponent: '유창수', lawyer: '임은지' },
  { caseNumber: '평택가정2025드단20696', caseName: '이혼 등', client: '이대경', clientRole: '피고', opponent: '성나연', lawyer: '임은지' },
  { caseNumber: '평택가정2024드단21231', caseName: '이혼 등', client: '장원석', clientRole: '원고', opponent: '고학순', lawyer: '임은지' },
  { caseNumber: '평택가정2024즈단10056', caseName: '부동산가압류', client: '양명원', clientRole: '채권자', opponent: '이진', lawyer: '' },
  { caseNumber: '평택가정2024즈기1077', caseName: '사전처분', client: '이대경', clientRole: '피신청인', opponent: '성나연', lawyer: '' },
  { caseNumber: '평택가정2024즈단10083', caseName: '가압류취소', client: '최재영', clientRole: '신청인', opponent: '정은화', lawyer: '임은지' },
  { caseNumber: '천안지원2024고단2703', caseName: '특정범죄가중처벌등에관한법률위반(도주치상)등', client: '김현성', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '평택지원2024가단75190', caseName: '손해배상(기)', client: '홍강의', clientRole: '원고', opponent: '조희태', lawyer: '임은지' },
  { caseNumber: '평택가정2024즈단10133', caseName: '채권가압류', client: '엄현식', clientRole: '채권자', opponent: '심민선', lawyer: '임은지' },
  { caseNumber: '의정부지법2025머70829', caseName: '기타(금전)', client: '린유지', clientRole: '원고', opponent: '지옥녀', lawyer: '임은지' },
  { caseNumber: '천안지원2025가소33628', caseName: '구상금', client: '김정례', clientRole: '원고', opponent: '정준석', lawyer: '임은지' },
  { caseNumber: '평택지원2025카단10332', caseName: '부동산가압류', client: '주식회사 제일케미칼', clientRole: '채권자', opponent: '박영은', lawyer: '김현성' },
  { caseNumber: '천안가정2025즈기10', caseName: '사전처분', client: '김정언', clientRole: '신청인', opponent: '정찬덕', lawyer: '임은지' },
  { caseNumber: '공주지원2025카불3033', caseName: '채무불이행자명부등재', client: '한수연', clientRole: '채권자', opponent: '이대겸', lawyer: '김현성' },
  { caseNumber: '평택가정2025드단20475', caseName: '이혼 등', client: '엄현식', clientRole: '피고', opponent: '심민선', lawyer: '임은지' },
  { caseNumber: '서울동부지법2025카불50529', caseName: '채무불이행자명부등재', client: '황윤희', clientRole: '채권자', opponent: '주식회사 헤이더팜', lawyer: '김현성' },
  { caseNumber: '광주지법2025카단51793', caseName: '채권가압류', client: '주식회사 한일전력공사', clientRole: '채권자', opponent: '유한회사 거담', lawyer: '김현성' },
  { caseNumber: '광주지법2025차전107692', caseName: '대여금', client: '주식회사 한일전력공사', clientRole: '채권자', opponent: '유한회사 거담', lawyer: '김현성' },
  { caseNumber: '평택가정2025너2046', caseName: '이혼 등', client: '정정희', clientRole: '신청인', opponent: '김윤길', lawyer: '임은지' },
  { caseNumber: '대전지법2025노887', caseName: '특정범죄가중처벌등에관한법률위반(도주치상) 등', client: '김현성', clientRole: '피고인', opponent: '', lawyer: '' },
  { caseNumber: '천안가정2025즈기28', caseName: '사전처분', client: '이윤주', clientRole: '신청인', opponent: '홍지수', lawyer: '임은지' },
  { caseNumber: '평택가정2025즈단10029', caseName: '자동차(건설기계)가압류', client: '장원석', clientRole: '채권자', opponent: '고학순', lawyer: '임은지' },
  { caseNumber: '광주지법2025카담50323', caseName: '담보취소', client: '주식회사 한일전력공사', clientRole: '신청인', opponent: '유한회사 거담', lawyer: '김현성' },
  { caseNumber: '평택지원2024가단79215', caseName: '손해배상(기)', client: '윤기석', clientRole: '피고', opponent: '신용윤', lawyer: '임은지' },
  { caseNumber: '천안가정2025즈단358', caseName: '부동산가압류', client: '김지영', clientRole: '채권자', opponent: '윤영균', lawyer: '임은지' },
  { caseNumber: '의정부지법2024가단107023', caseName: '손해배상(기)', client: '주식회사 한성일렉트릭', clientRole: '피고', opponent: '임만희', lawyer: '김현성' },
  { caseNumber: '평택지원2024카확1171', caseName: '소송비용확정', client: '제일케미칼', clientRole: '신청인', opponent: '홍영탁', lawyer: '김현성' },
  { caseNumber: '평택가정2024즈단10080', caseName: '부동산가압류', client: '김효진', clientRole: '채권자', opponent: '이주현', lawyer: '임은지' },
  { caseNumber: '서울중앙지법2024카확38919', caseName: '소송비용액확정', client: '글로벌코리아부동산중개법인 주식회사', clientRole: '신청인', opponent: '윤영문', lawyer: '김현성' },
  { caseNumber: '평택가정2024즈기1174', caseName: '사전처분', client: '양수경', clientRole: '신청인', opponent: '최현용', lawyer: '임은지' },
  { caseNumber: '평택가정2024즈기80', caseName: '소송구조', client: '장지원', clientRole: '신청인', opponent: '이강열', lawyer: '임은지' },
  { caseNumber: '평택지원2024가소104535', caseName: '약정금', client: '법무법인 더율', clientRole: '원고', opponent: '이정귀', lawyer: '김현성' },
  { caseNumber: '여주지원2024가단23417', caseName: '손해배상(기)', client: '김요한', clientRole: '피고', opponent: '정우진', lawyer: '임은지' },
  { caseNumber: '평택지원2024차전8467', caseName: '약정금', client: '법무법인 더율', clientRole: '채권자', opponent: '권용관', lawyer: '김현성' },
  { caseNumber: '평택지원2024차전8427', caseName: '약정금', client: '법무법인 더율', clientRole: '채권자', opponent: '이정귀', lawyer: '김현성' },
  { caseNumber: '아산시법원2024차전4011', caseName: '약정금', client: '법무법인 더율', clientRole: '채권자', opponent: '윤영일', lawyer: '김현성' },
  { caseNumber: '천안가정2024드단14548', caseName: '이혼 등', client: '박정현', clientRole: '원고', opponent: '임지혜', lawyer: '임은지' },
  { caseNumber: '대전지법2024카합50031', caseName: '가압류신청', client: '최장호', clientRole: '채권자', opponent: '농업회사법인 주식회사 앤에프씨', lawyer: '김현성' },
  { caseNumber: '서울중앙지법2023카단836268', caseName: '채권가압류', client: '린유지', clientRole: '채권자', opponent: '치윤유', lawyer: '김현성' },
  { caseNumber: '수원가정법원2024즈단5231', caseName: '부동산가압류', client: '양수경', clientRole: '신청인', opponent: '최현용', lawyer: '' },
  { caseNumber: '평택가정2024즈기1012', caseName: '사전처분', client: '이영기', clientRole: '신청인', opponent: '김효정', lawyer: '김현성' },
  { caseNumber: '평택가정2023드단22527', caseName: '이혼 등', client: '이은경', clientRole: '원고', opponent: '박성규', lawyer: '임은지' },
  { caseNumber: '평택가정2024즈단10024', caseName: '부동산가압류', client: '장원석', clientRole: '채권자', opponent: '고학순', lawyer: '임은지' },
  { caseNumber: '천안가정2022드단13107', caseName: '이혼 및 재산분할 등', client: '김수정', clientRole: '원고', opponent: '정철진', lawyer: '임은지' },
  { caseNumber: '대구가정법원2024느단10799', caseName: '양육자 및 친권자 변경 청구', client: '정병수', clientRole: '청구인', opponent: '김상미', lawyer: '김현성' },
  { caseNumber: '수원가정법원2024드단29380', caseName: '이혼 등', client: '양수경', clientRole: '원고', opponent: '최현용', lawyer: '' },
  { caseNumber: '평택지원2024카기10125', caseName: '증거보전신청', client: '이혜지', clientRole: '신청인', opponent: '기예빈', lawyer: '임은지' },
  { caseNumber: '평택가정2024너2387', caseName: '이혼 등', client: '서민지', clientRole: '신청인', opponent: '김주명', lawyer: '' },
  { caseNumber: '평택가정2023드단23759', caseName: '이혼 등', client: '나윤정', clientRole: '원고', opponent: '박상민', lawyer: '임은지' },
  { caseNumber: '평택가정2023드단22879', caseName: '이혼 등', client: '나윤정', clientRole: '피고', opponent: '박상민', lawyer: '' },
  { caseNumber: '수원지법2023나51670', caseName: '대여금', client: '한수연', clientRole: '원고', opponent: '이대겸', lawyer: '김현성' },
  { caseNumber: '대전가정법원2022드단59652', caseName: '이혼 및 위자료 등', client: '이지안', clientRole: '원고', opponent: '길재식', lawyer: '임은지' },
  { caseNumber: '수원가정법원2024너269', caseName: '이혼 등', client: '양수경', clientRole: '신청인', opponent: '최현용', lawyer: '임은지' },
  { caseNumber: '인천가정법원2024너101028', caseName: '이혼', client: '유제희', clientRole: '신청인', opponent: '이다향', lawyer: '임은지' },
  { caseNumber: '평택가정2023드단22015', caseName: '이혼 및 위자료', client: '이아연', clientRole: '원고', opponent: '양연식', lawyer: '임은지' },
  { caseNumber: '수원지법2023노3123', caseName: '성폭력범죄의처벌등에관한특례법위반(카메라등이용촬영.반포등)등', client: '곽명섭', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '여주지원2023가단12915', caseName: '유류분반환', client: '장순옥', clientRole: '피고', opponent: '장사환', lawyer: '김현성' },
  { caseNumber: '평택지원2024카불10144', caseName: '채무불이행자명부등재', client: '김진성', clientRole: '채권자', opponent: '서정혜', lawyer: '김현성' },
  { caseNumber: '여주지원2024카기10063', caseName: '증거보전신청', client: '윤지은', clientRole: '신청인', opponent: '박은애', lawyer: '' },
  { caseNumber: '대전지법2023머205062', caseName: '근저당권말소', client: '김명희', clientRole: '피고', opponent: '주식회사 드림', lawyer: '김현성' },
  { caseNumber: '평택지원2024가소71284', caseName: '물품대금', client: '주식회사 제일케미칼', clientRole: '원고', opponent: '홍영탁', lawyer: '김현성' },
  { caseNumber: '수원지법2024가소333662', caseName: '구상금', client: '홍지안', clientRole: '원고', opponent: '박주아', lawyer: '김현성' },
  { caseNumber: '수원가정법원2024즈단5129', caseName: '채권가압류', client: '김윤한', clientRole: '채권자', opponent: '김진희', lawyer: '임은지' },
  { caseNumber: '서울행정법원2020구합59055', caseName: '법인지방소득세 경정청구 거부처부 취소 청구', client: '서산시', clientRole: '피고', opponent: '에스케이이노베이션 주식회사', lawyer: '김현성' },
  { caseNumber: '대전지법2024카단50578', caseName: '부동산가압류', client: '최장호', clientRole: '채권자', opponent: '농업회사법인 주식회사 앤에프씨', lawyer: '김현성' },
  { caseNumber: '대법원2024므10561', caseName: '이혼 등', client: '이정귀', clientRole: '피고', opponent: '김설화', lawyer: '임은지' },
  { caseNumber: '평택가정2024즈기1048', caseName: '증거보전신청', client: '장국희', clientRole: '신청인', opponent: '이지은', lawyer: '임은지' },
  { caseNumber: '천안지원2023카단12803', caseName: '부동산가압류신청', client: '조영인', clientRole: '채권자', opponent: '이성은', lawyer: '김현성' },
  { caseNumber: '천안지원2023카단12527', caseName: '부동산처분금지가처분', client: '김해김씨안경공승지공파현영문중', clientRole: '채권자', opponent: '김용원', lawyer: '김현성' },
  { caseNumber: '천안가정2023드단15070', caseName: '이혼 등', client: '권미영', clientRole: '원고', opponent: '전찬희', lawyer: '임은지' },
  { caseNumber: '평택지원2024타채33630', caseName: '채권압류 및 추심명령', client: '김진성', clientRole: '채권자', opponent: '서정혜', lawyer: '' },
  { caseNumber: '천안지원2024타채13040', caseName: '채권압류 및 추심명령', client: '김진성', clientRole: '채권자', opponent: '서정혜', lawyer: '김현성' },
  { caseNumber: '수원가정법원2024즈기5067', caseName: '증거보전신청', client: '최금하', clientRole: '신청인', opponent: '박현철', lawyer: '' },
  { caseNumber: '수원가정법원2024느단251', caseName: '친권자 및 양육자 변경', client: '이윤주', clientRole: '청구인', opponent: '홍지수', lawyer: '임은지' },
  { caseNumber: '성남지원2024카단60930', caseName: '부동산점유이전금지가처분', client: '오영모', clientRole: '채권자', opponent: '주식회사 신스웨이브', lawyer: '김현성' },
  { caseNumber: '수원지법2023가단534488', caseName: '투자금 반환', client: '오명근', clientRole: '피고', opponent: '신형만', lawyer: '김현성' },
  { caseNumber: '천안가정2022드단13411', caseName: '사실혼 파기로 인한 위자료 및 재산분할', client: '김재이', clientRole: '원고', opponent: '여창열', lawyer: '임은지' },
  { caseNumber: '수원가정법원2024즈기49', caseName: '양육비 사전처분', client: '이윤주', clientRole: '신청인', opponent: '홍지수', lawyer: '임은지' },
  { caseNumber: '평택지원2023가단75933', caseName: '손해배상(기)', client: '이준범', clientRole: '피고', opponent: '이종철', lawyer: '' },
  { caseNumber: '수원가정법원2023드단25398', caseName: '이혼 등', client: '진윤희', clientRole: '피고', opponent: '심은지', lawyer: '임은지' },
  { caseNumber: '수원지법2023머80422', caseName: '투자금반환', client: '오명근', clientRole: '피고', opponent: '신형만', lawyer: '김현성' },
  { caseNumber: '평택가정2023드단23872', caseName: '위자료 청구의 소', client: '손진호', clientRole: '원고', opponent: '이민혁', lawyer: '임은지' },
  { caseNumber: '천안가정2023즈기95', caseName: '소송비용액확정', client: '노수인', clientRole: '피신청인', opponent: '임명숙', lawyer: '김현성' },
  { caseNumber: '평택가정2023즈기1133', caseName: '사전처분', client: '이은경', clientRole: '신청인', opponent: '박성규', lawyer: '' },
  { caseNumber: '수원가정법원2023드단22795', caseName: '이혼 등', client: '이금녀', clientRole: '피고', opponent: '이성호', lawyer: '김현성' },
  { caseNumber: '대전가정법원2023드단312', caseName: '이혼 및 위자료 등', client: '이지안', clientRole: '피고', opponent: '길재식', lawyer: '임은지' },
  { caseNumber: '천안가정2023즈기1149', caseName: '소송비용확정', client: '윤미애', clientRole: '신청인', opponent: '정희태', lawyer: '임은지' },
  { caseNumber: '천안지원2023가단100700', caseName: '공유물분할', client: '윤미애', clientRole: '피고', opponent: '정희태', lawyer: '김현성' },
  { caseNumber: '대법원2023스794', caseName: '이혼 및 양육자 지정 등(사전처분)', client: '최한나', clientRole: '상대방', opponent: '공준권', lawyer: '김현성' },
  { caseNumber: '천안지원2023가소114345', caseName: '구상금 청구의 소', client: '류영오', clientRole: '원고', opponent: '안예림', lawyer: '김현성' },
  { caseNumber: '대전고법2023르1322', caseName: '이혼 등', client: '이정귀', clientRole: '피고', opponent: '김설화', lawyer: '임은지' },
  { caseNumber: '서산지원2023가단55561', caseName: '손해배상(기)', client: '지재연', clientRole: '원고', opponent: '이강균', lawyer: '김현성' },
  { caseNumber: '평택가정2023드단23735', caseName: '이혼 및 위자료', client: '허채민', clientRole: '피고', opponent: '전찬희', lawyer: '김현성' },
  { caseNumber: '평택지원2023고단1508', caseName: '상해 등', client: '김성우', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '천안지원2023가단114273', caseName: '손해배상(기)', client: '지재연', clientRole: '원고', opponent: '김경배', lawyer: '김현성' },
  { caseNumber: '대전고법2023르1339', caseName: '이혼 등', client: '이정귀', clientRole: '원고', opponent: '김설화', lawyer: '임은지' },
  { caseNumber: '순천지원2023카확10305', caseName: '소송비용확정신청', client: '이미정', clientRole: '신청인', opponent: '이광희', lawyer: '김현성' },
  { caseNumber: '천안가정2022드단12920', caseName: '이혼 등', client: '황봉연', clientRole: '원고', opponent: '김문규', lawyer: '임은지' },

  // === 3페이지 ===
  { caseNumber: '천안지원2021가단101396', caseName: '부당이득 반환 등 청구의 소', client: '김해김씨안경공승지공파현영문중', clientRole: '원고', opponent: '김용원', lawyer: '김현성' },
  { caseNumber: '수원가정법원2023브107', caseName: '이혼 및 양육자 지정 등(사전처분)', client: '최한나', clientRole: '상대방', opponent: '공준권', lawyer: '임은지' },
  { caseNumber: '평택가정2023즈기1116', caseName: '사전처분', client: '홍지연', clientRole: '피신청인', opponent: '김병도', lawyer: '임은지' },
  { caseNumber: '평택가정2023드단21951', caseName: '이혼 등', client: '유현상', clientRole: '원고', opponent: '이미선', lawyer: '임은지' },
  { caseNumber: '수원가정법원2023브108', caseName: '이혼 및 양육자 지정 등(사전처분)', client: '최한나', clientRole: '상대방', opponent: '공준권', lawyer: '임은지' },
  { caseNumber: '수원지법2023머63816', caseName: '대여금', client: '한수연', clientRole: '원고', opponent: '이대겸', lawyer: '김현성' },
  { caseNumber: '서산가정2023드단289', caseName: '이혼 청구의 소', client: '유서현', clientRole: '원고', opponent: '신용민', lawyer: '' },
  { caseNumber: '천안지원2023고단419', caseName: '도로교통법위반(음주운전)등', client: '윤영일', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '평택지원2023가단66700', caseName: '손해배상(기)', client: '임윤정', clientRole: '원고', opponent: '남영주', lawyer: '' },
  { caseNumber: '천안가정2023즈합1014', caseName: '부동산가압류', client: '이정분', clientRole: '채권자', opponent: '유기종', lawyer: '임은지' },
  { caseNumber: '평택가정2023너2458', caseName: '이혼 등', client: '홍지연', clientRole: '신청인', opponent: '김병도', lawyer: '임은지' },
  { caseNumber: '천안가정2023즈단1045', caseName: '부동산가압류', client: '김수정', clientRole: '채권자', opponent: '정철진', lawyer: '임은지' },
  { caseNumber: '서울중앙지법2022카단820512', caseName: '가압류취소', client: '윤미애', clientRole: '신청인', opponent: '정희태', lawyer: '임은지' },
  { caseNumber: '평택가정2023즈단10048', caseName: '부동산가압류', client: '이은경', clientRole: '채권자', opponent: '박성규', lawyer: '임은지' },
  { caseNumber: '천안지원2023고단593', caseName: '특정범죄가중처벌등에관한법률위반(위험운전치상) 등', client: '유태규', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '수원가정법원2023즈합523', caseName: '부동산가압류', client: '최한나', clientRole: '원고', opponent: '공준권', lawyer: '임은지' },
  { caseNumber: '평택지원2023고단676', caseName: '성폭력범죄의처벌등에관한특례법위반(카메라등이용촬영) 외 1건', client: '곽명섭', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '홍성지원2022고단956', caseName: '도로교통법위반(음주운전)', client: '이건영', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '천안지원2023카단10674', caseName: '부동산가압류신청', client: '김경회', clientRole: '채권자', opponent: '권순옥', lawyer: '김현성' },
  { caseNumber: '수원가정법원2022너7556', caseName: '이혼 등', client: '진윤희', clientRole: '피신청인', opponent: '심은지', lawyer: '임은지' },
  { caseNumber: '여주가정2022즈단10054', caseName: '부동산가압류', client: '김민혜', clientRole: '채권자', opponent: '윤호순', lawyer: '임은지' },
  { caseNumber: '홍성지원2023카기5005', caseName: '해방공탁에의한 가압류집행취소신청', client: '김진구', clientRole: '신청인', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '서울중앙지법2021가단5076435', caseName: '약정금', client: '글로벌코리아부동산중개법인 주식회사', clientRole: '원고', opponent: '윤영문', lawyer: '김현성' },
  { caseNumber: '홍성지원2022가합30720', caseName: '손해배상(기)', client: '김진구', clientRole: '피고', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '홍성지원2022가합30737', caseName: '건물인도', client: '김진구', clientRole: '원고', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '서울중앙지법2021가단5351150', caseName: '손해배상(기)', client: '글로벌코리아부동산중개법인 주식회사', clientRole: '원고', opponent: '윤영문', lawyer: '김현성' },
  { caseNumber: '홍성지원2022가단30891', caseName: '건물인도', client: '김진구', clientRole: '원고', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '홍성지원2021가단35219', caseName: '손해배상(기)', client: '김진구', clientRole: '피고', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '평택지원2022가단52681', caseName: '대여금', client: '한수연', clientRole: '원고', opponent: '이대겸', lawyer: '김현성' },
  { caseNumber: '천안지원2022카단11691', caseName: '부동산가압류', client: '임태희', clientRole: '채권자', opponent: '주식회사 드림', lawyer: '김현성' },
  { caseNumber: '천안지원2021가단108540', caseName: '근저당권말소', client: '김명희', clientRole: '피고', opponent: '주식회사 드림', lawyer: '김현성' },
  { caseNumber: '홍성지원2022카합5027', caseName: '부동산명도단행가처분', client: '김진구', clientRole: '채권자', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '평택가정2022즈단10046', caseName: '부동산가압류', client: '김승휘', clientRole: '채권자', opponent: '최은애', lawyer: '임은지' },
  { caseNumber: '평택가정2022즈합1014', caseName: '부동산가압류', client: '노선미', clientRole: '채권자', opponent: '장한수', lawyer: '임은지' },
  { caseNumber: '천안가정2022즈단1071', caseName: '부동산가압류', client: '김재이', clientRole: '채권자', opponent: '여창렬', lawyer: '임은지' },
  { caseNumber: '천안지원2022카단10978', caseName: '채권가압류', client: '김근옥', clientRole: '채권자', opponent: 'JIN XINGJI', lawyer: '임은지' },
  { caseNumber: '천안가정2022즈단1064', caseName: '부동산가압류', client: '황봉연', clientRole: '원고', opponent: '김문규', lawyer: '임은지' },
  { caseNumber: '평택지원2022차전937', caseName: '물품대금', client: '주식회사 제일케미칼', clientRole: '채권자', opponent: '태영인더스트리 주식회사', lawyer: '김현성' },
  { caseNumber: '천안가정2022너10040', caseName: '이혼 및 재산분할 등', client: '김수정', clientRole: '신청인', opponent: '정철진', lawyer: '임은지' },
  { caseNumber: '천안지원2021카단11842', caseName: '부동산가압류', client: '김해김씨 안경공승지공파 현영문중', clientRole: '채권자', opponent: '김용원', lawyer: '김현성' },
  { caseNumber: '평택가정2022즈단10025', caseName: '채권가압류', client: '박미경', clientRole: '채권자', opponent: '문영훈', lawyer: '임은지' },
  { caseNumber: '서울중앙지법2021가소1970263', caseName: '기타(금전)', client: '김광필', clientRole: '원고', opponent: '주식회사 나임', lawyer: '김현성' },
  { caseNumber: '천안가정2021즈합1031', caseName: '부동산가압류', client: '이영애', clientRole: '채권자', opponent: '오병오', lawyer: '임은지' },
  { caseNumber: '홍성지원2022카단5064', caseName: '부동산점유이전금지가처분', client: '김진구', clientRole: '채권자', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '평택가정2022즈단10008', caseName: '부동산가압류', client: '고현경', clientRole: '채권자', opponent: '김성배', lawyer: '임은지' },
  { caseNumber: '평택지원2021카단11533', caseName: '부동산점유이전금지가처분', client: '하성석', clientRole: '채권자', opponent: '김기수', lawyer: '김현성' },
  { caseNumber: '고양지원2021카단743', caseName: '가압류이의', client: '김광필', clientRole: '채무자', opponent: '주식회사 강산종합개발', lawyer: '김현성' },
  { caseNumber: '대전지법2021카단54787', caseName: '부동산가압류', client: '황옥란', clientRole: '채권자', opponent: '고병순', lawyer: '임은지' },
  { caseNumber: '천안지원2021가단102429', caseName: '정산금 등 청구의 소', client: '주재남', clientRole: '원고', opponent: '노신의', lawyer: '김현성' },
  { caseNumber: '천안가정2021즈합1033', caseName: '부동산가압류', client: '이정귀', clientRole: '채권자', opponent: '김설화', lawyer: '임은지' },
  { caseNumber: '청주지법2021차전8747', caseName: '보증금반환', client: '김광필', clientRole: '채무자', opponent: '주식회사 원영씨엔티', lawyer: '김현성' },
  { caseNumber: '수원가정법원2021즈합670', caseName: '부동산가압류', client: '노유리', clientRole: '채권자', opponent: '김광수', lawyer: '임은지' },
  { caseNumber: '홍성지원2021카기5290', caseName: '가압류집행취소', client: '김진구', clientRole: '채무자', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '평택가정2021즈단10125', caseName: '부동산가압류', client: '정완수', clientRole: '채권자', opponent: '이청월', lawyer: '임은지' },
  { caseNumber: '평택가정2021즈단10100', caseName: '부동산가압류', client: '정완수', clientRole: '채무자', opponent: '이청월', lawyer: '임은지' },
  { caseNumber: '천안지원2021카단11527', caseName: '채권가압류', client: '조종희', clientRole: '채권자', opponent: '오병순', lawyer: '김현성' },
  { caseNumber: '서울가정법원2021즈단30961', caseName: '부동산가압류', client: '신승엽', clientRole: '채권자', opponent: '이건화', lawyer: '임은지' },
  { caseNumber: '서울중앙지법2021카확34336', caseName: '소송비용액확정', client: '김광필', clientRole: '신청인', opponent: '김은영', lawyer: '김현성' },
  { caseNumber: '안산가정2021즈단50016', caseName: '부동산가압류', client: '한혜연', clientRole: '채권자', opponent: '하헌섭', lawyer: '임은지' },
  { caseNumber: '인천지법2021타채551441', caseName: '채권압류 및 추심명령', client: '김광필', clientRole: '채권자', opponent: '김은영', lawyer: '김현성' },
  { caseNumber: '천안가정2021즈기1017', caseName: '소송비용액확정신청서', client: '최민승', clientRole: '원고', opponent: '김주호', lawyer: '임은지' },
  { caseNumber: '서울중앙지법2021차전229266', caseName: '기타(금전)', client: '김광필', clientRole: '채권자', opponent: '주식회사 나임', lawyer: '김현성' },
  { caseNumber: '천안가정2021즈합1000', caseName: '부동산가압류', client: '박상애', clientRole: '채권자', opponent: '서정봉', lawyer: '임은지' },
  { caseNumber: '서울중앙지법2021차전1004', caseName: '약정금', client: '김광필', clientRole: '채무자', opponent: '정미희', lawyer: '김현성' },
  { caseNumber: '평택가정2021즈단10014', caseName: '부동산가압류', client: '정설희', clientRole: '채권자', opponent: '장성민', lawyer: '임은지' },
  { caseNumber: '천안지원2020카확10311', caseName: '소송비용확정 신청', client: '임지환', clientRole: '원고', opponent: '김성영', lawyer: '김현성' },
  { caseNumber: '천안지원2020카단12059', caseName: '부동산가압류', client: '주재남', clientRole: '채권자', opponent: '노신의', lawyer: '김현성' },
  { caseNumber: '천안가정2020즈단1113', caseName: '부동산가압류', client: '김남순', clientRole: '채권자', opponent: '최종배', lawyer: '임은지' },
  { caseNumber: '천안가정2020즈단1096', caseName: '부동산가압류', client: '김지혜', clientRole: '채권자', opponent: '윤경섭', lawyer: '임은지' },
  { caseNumber: '천안지원2020카합10473', caseName: '부동산가압류', client: '주재남', clientRole: '채권자', opponent: '노신의', lawyer: '김현성' },
  { caseNumber: '천안지원2021타경102002', caseName: '부동산강제경매', client: '유승일', clientRole: '채권자', opponent: '심해숙', lawyer: '김현성' },
  { caseNumber: '평택가정2021즈합1017', caseName: '부동산가압류', client: '임경희', clientRole: '채권자', opponent: '이용선', lawyer: '임은지' },
  { caseNumber: '홍성지원2023본42', caseName: '부동산인도', client: '김진구', clientRole: '채권자', opponent: '김수환', lawyer: '김현성' },
  { caseNumber: '평택지원2023타경864', caseName: '부동산강제경매', client: '김승휘', clientRole: '이해관계인', opponent: '최은애', lawyer: '임은지' },
  { caseNumber: '천안지원2023고약5406', caseName: '도로교통법위반(음주운전)', client: '홍성오', clientRole: '피고인', opponent: '', lawyer: '김현성' },
  { caseNumber: '평택지원2023타경49579', caseName: '부동산강제경매', client: '임윤정', clientRole: '채권자', opponent: '남영주', lawyer: '김현성,임은지' },
  { caseNumber: '성남지원2024가100', caseName: '부동산점유이전금지가처분 강제집행', client: '오영모', clientRole: '채권자', opponent: '주식회사 신스웨이브', lawyer: '김현성' },
  { caseNumber: '공주지원2024타경21640', caseName: '부동산강제경매', client: '한수연', clientRole: '채권자', opponent: '이대겸', lawyer: '김현성' },
  { caseNumber: '광주지법2025카단51631', caseName: '채권가압류', client: '주식회사 한성일렉트릭', clientRole: '채권자', opponent: '유한회사 거담', lawyer: '김현성' },
  { caseNumber: '천안지원2025타경11515', caseName: '부동산강제경매', client: '황봉연', clientRole: '채권자', opponent: '김문규', lawyer: '임은지' },
  { caseNumber: '서울북부지법2025타경12746', caseName: '부동산강제경매', client: '신승현', clientRole: '채권자', opponent: '이건화', lawyer: '임은지' },
]

// 사건번호에서 법원명 추출
function extractCourtName(caseNumber: string): string {
  const courtMap: Record<string, string> = {
    '평택가정': '수원가정법원 평택지원',
    '평택지원': '수원지방법원 평택지원',
    '수원가정법원': '수원가정법원',
    '수원고법': '수원고등법원',
    '수원지법': '수원지방법원',
    '천안가정': '대전가정법원 천안지원',
    '천안지원': '대전지방법원 천안지원',
    '서산가정': '대전가정법원 서산지원',
    '서울가정법원': '서울가정법원',
    '서울북부지법': '서울북부지방법원',
    '서울중앙지법': '서울중앙지방법원',
    '서울행정법원': '서울행정법원',
    '부산가정법원': '부산가정법원',
    '청주지법': '청주지방법원',
    '대전가정법원': '대전가정법원',
    '대전지법': '대전지방법원',
    '대전고법': '대전고등법원',
    '대법원': '대법원',
    '의정부지법': '의정부지방법원',
    '고양지원': '의정부지방법원 고양지원',
    '인천가정법원': '인천가정법원',
    '인천지법': '인천지방법원',
    '제주지법': '제주지방법원',
    '대구가정법원': '대구가정법원',
    '여주지원': '수원지방법원 여주지원',
    '여주가정': '수원가정법원 여주지원',
    '안성시법원': '수원지방법원 안성시법원',
    '순천지원': '광주지방법원 순천지원',
    '아산시법원': '대전지방법원 아산시법원',
    '광주지법': '광주지방법원',
    '홍성지원': '대전지방법원 홍성지원',
    '서산지원': '대전지방법원 서산지원',
    '공주지원': '대전지방법원 공주지원',
    '성남지원': '수원지방법원 성남지원',
    '안산가정': '수원가정법원 안산지원',
  }

  for (const [key, value] of Object.entries(courtMap)) {
    if (caseNumber.startsWith(key)) {
      return value
    }
  }
  return '기타'
}

// 의뢰인별 고유 정보 생성 (동일 의뢰인은 같은 정보)
interface ClientInfo {
  phone: string
  email: string
  birthDate: string
  address: string
  bankAccount: string
}

function generateClientInfo(): Map<string, ClientInfo> {
  const clientMap = new Map<string, ClientInfo>()
  const uniqueClients = [...new Set(rawCases.map(c => c.client))]

  uniqueClients.forEach((name, index) => {
    // 법인인 경우 다르게 처리
    const isCompany = name.includes('주식회사') || name.includes('법무법인') || name.includes('문중') || name.includes('유한회사')

    if (isCompany) {
      clientMap.set(name, {
        phone: `02-${String(1000 + index).padStart(4, '0')}-${String(1000 + index).padStart(4, '0')}`,
        email: '',
        birthDate: '',
        address: `서울특별시 강남구 테헤란로 ${100 + index}`,
        bankAccount: `기업 110-${String(100 + index).padStart(6, '0')}-${String(10 + index).padStart(5, '0')}`
      })
    } else {
      // 개인인 경우
      const phonePrefix = ['010', '010', '010', '011', '016', '017', '018', '019'][index % 8]
      const year = 1960 + (index % 40)
      const month = String(1 + (index % 12)).padStart(2, '0')
      const day = String(1 + (index % 28)).padStart(2, '0')

      const cities = ['서울특별시', '경기도', '인천광역시', '충청남도', '충청북도', '대전광역시', '세종특별자치시']
      const districts = ['강남구', '서초구', '송파구', '마포구', '용산구', '평택시', '천안시', '수원시', '성남시']

      clientMap.set(name, {
        phone: `${phonePrefix}-${String(1000 + index * 7).slice(-4)}-${String(1000 + index * 13).slice(-4)}`,
        email: `client${index + 1}@example.com`,
        birthDate: `${year}-${month}-${day}`,
        address: `${cities[index % cities.length]} ${districts[index % districts.length]} 테스트로 ${index + 1}`,
        bankAccount: `신한 110-${String(100 + index).padStart(3, '0')}-${String(100000 + index).padStart(6, '0')}`
      })
    }
  })

  return clientMap
}

// 역할 매핑
function mapRole(role: string): string {
  const roleMap: Record<string, string> = {
    '원고': '원고',
    '피고': '피고',
    '신청인': '신청인',
    '피신청인': '상대방',
    '채권자': '채권자',
    '채무자': '채무자',
    '청구인': '신청인',
    '상대방': '상대방',
    '피고인': '피고',
    '이해관계인': '기타'
  }
  return roleMap[role] || role
}

// 메인 실행
async function main() {
  console.log('테스트 배치 파일 생성 시작...')

  const clientInfoMap = generateClientInfo()

  // 컬럼 헤더
  const headers = [
    '계약일',
    '담당변호사',
    '담당직원',
    '법원명',
    '사건번호',
    '사건명',
    '의뢰인명',
    '상대방명',
    '착수금',
    '성공보수약정',
    '발생성공보수',
    '의뢰인연락처',
    '계좌번호',
    '의뢰인이메일',
    '생년월일',
    '주소',
    '메모'
  ]

  // 데이터 행 생성
  const rows = rawCases.map((caseData, index) => {
    const courtName = extractCourtName(caseData.caseNumber)
    const clientInfo = clientInfoMap.get(caseData.client) || {
      phone: '',
      email: '',
      birthDate: '',
      address: '',
      bankAccount: ''
    }

    // 착수금 랜덤 생성 (100만원 ~ 1000만원)
    const retainerFee = (Math.floor(Math.random() * 10) + 1) * 1000000

    return [
      '2025-01-10',                    // 계약일
      caseData.lawyer || '임은지',      // 담당변호사
      '',                               // 담당직원
      courtName,                        // 법원명
      caseData.caseNumber,              // 사건번호
      caseData.caseName,                // 사건명
      caseData.client,                  // 의뢰인명
      caseData.opponent,                // 상대방명
      retainerFee,                      // 착수금
      '',                               // 성공보수약정
      '',                               // 발생성공보수
      clientInfo.phone,                 // 의뢰인연락처
      clientInfo.bankAccount,           // 계좌번호
      clientInfo.email,                 // 의뢰인이메일
      clientInfo.birthDate,             // 생년월일
      clientInfo.address,               // 주소
      `Lawdesk에서 가져온 테스트 데이터 #${index + 1}` // 메모
    ]
  })

  // 워크북 생성
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 12 },  // 계약일
    { wch: 12 },  // 담당변호사
    { wch: 12 },  // 담당직원
    { wch: 25 },  // 법원명
    { wch: 30 },  // 사건번호
    { wch: 40 },  // 사건명
    { wch: 20 },  // 의뢰인명
    { wch: 20 },  // 상대방명
    { wch: 12 },  // 착수금
    { wch: 15 },  // 성공보수약정
    { wch: 15 },  // 발생성공보수
    { wch: 15 },  // 의뢰인연락처
    { wch: 25 },  // 계좌번호
    { wch: 25 },  // 의뢰인이메일
    { wch: 12 },  // 생년월일
    { wch: 40 },  // 주소
    { wch: 40 },  // 메모
  ]

  XLSX.utils.book_append_sheet(wb, ws, '사건목록')

  // 파일 저장
  const outputPath = './테스트_배치_281건.xlsx'
  XLSX.writeFile(wb, outputPath)

  console.log(`\n✅ 배치 파일 생성 완료: ${outputPath}`)
  console.log(`   - 총 ${rawCases.length}건의 사건 데이터`)
  console.log(`   - 고유 의뢰인 수: ${clientInfoMap.size}명`)
  console.log(`   - 동일 의뢰인의 연락처/이메일/주소 등은 통일됨`)
}

main().catch(console.error)
