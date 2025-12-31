/**
 * 로데스크에서 추출한 전체 278건 사건을 대법원 나의사건검색에 등록
 *
 * 3개 페이지에서 추출한 모든 사건 데이터 포함
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';

// 로데스크에서 추출한 전체 사건 목록 (페이지 1, 2, 3 통합)
const lawdeskCases = [
  // === 페이지 1 (100건) ===
  { court: '천안가정', year: '2024', type: '드단', serial: '16575', party: '이진산' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20538', party: '김근령' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20540', party: '한영미' },
  { court: '평택가정', year: '2025', type: '즈단', serial: '10057', party: '한영미' },
  { court: '안성시법원', year: '2025', type: '가소', serial: '6582', party: '임승태' },
  { court: '청주지법', year: '2025', type: '가단', serial: '55301', party: '최하윤' },
  { court: '평택지원', year: '2025', type: '카기', serial: '10680', party: '이명규' },
  { court: '수원고법', year: '2025', type: '르', serial: '10717', party: '장원석' },
  { court: '수원고법', year: '2025', type: '르', serial: '10433', party: '조유경' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20908', party: '조주성' },
  { court: '평택지원', year: '2025', type: '가단', serial: '55158', party: '이명규' },
  { court: '평택가정', year: '2025', type: '드단', serial: '61', party: '이미옥' },
  { court: '천안지원', year: '2025', type: '카불', serial: '6034', party: '강호현' },
  { court: '평택지원', year: '2025', type: '카확', serial: '1339', party: '엄규철' },
  { court: '서울가정법원', year: '2025', type: '드단', serial: '57177', party: '박세원' },
  { court: '천안지원', year: '2025', type: '카기', serial: '5747', party: '이명규' },
  { court: '수원가정법원', year: '2024', type: '드단', serial: '26718', party: '김윤한' },
  { court: '평택지원', year: '2025', type: '가소', serial: '75559', party: '윤승연' },
  { court: '평택가정', year: '2025', type: '너', serial: '2110', party: '권순영' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20932', party: '권순영' },
  { court: '의정부지법', year: '2024', type: '가단', serial: '109296', party: '린유지' },
  { court: '평택가정', year: '2024', type: '드단', serial: '22722', party: '이대경' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20433', party: '김요한' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20513', party: '장은서' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20616', party: '정정희' },
  { court: '서산가정', year: '2025', type: '드단', serial: '50218', party: '김동원' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20704', party: '박유경' },
  { court: '평택지원', year: '2025', type: '가단', serial: '53626', party: '편수지' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20629', party: '김동구' },
  { court: '수원가정법원', year: '2025', type: '드단', serial: '1488', party: '명미정' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20643', party: '김인경' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20799', party: '양미석' },
  { court: '평택가정', year: '2025', type: '너', serial: '2096', party: '조주성' },
  { court: '평택가정', year: '2025', type: '느단', serial: '10799', party: '백민지' },
  { court: '천안가정', year: '2025', type: '드단', serial: '5817', party: '김정아' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20790', party: '장혜진' },
  { court: '수원고법', year: '2025', type: '르', serial: '10595', party: '최재영' },
  { court: '평택가정', year: '2024', type: '드단', serial: '25547', party: '엄현식' },
  { court: '수원가정법원', year: '2025', type: '드단', serial: '22986', party: '임청아' },
  { court: '평택지원', year: '2025', type: '가단', serial: '54136', party: '박종각' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20734', party: '장혜진' },
  { court: '수원가정법원', year: '2025', type: '즈단', serial: '5380', party: '임청아' },
  { court: '평택가정', year: '2025', type: '즈기', serial: '1188', party: '장지원' },
  { court: '천안가정', year: '2025', type: '드단', serial: '5823', party: '김태일' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20579', party: '이혜진' },
  { court: '평택가정', year: '2025', type: '드합', serial: '2016', party: '장원석' },
  { court: '평택가정', year: '2025', type: '너', serial: '2054', party: '이향은' },
  { court: '천안가정', year: '2025', type: '느단', serial: '3520', party: '김지영' },
  { court: '수원가정법원', year: '2025', type: '너', serial: '3762', party: '김홍숙' },
  { court: '제주지법', year: '2025', type: '카기', serial: '1453', party: '현세인' },
  { court: '서울북부지법', year: '2025', type: '가단', serial: '109347', party: '강미자' },
  { court: '평택지원', year: '2025', type: '가소', serial: '73623', party: '박지원' },
  { court: '수원지법', year: '2025', type: '머', serial: '57057', party: '윤기석' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20956', party: '김재영' },
  { court: '수원지법', year: '2025', type: '나', serial: '56298', party: '윤기석' },
  { court: '평택가정', year: '2025', type: '너', serial: '2080', party: '김재영' },
  { court: '평택지원', year: '2025', type: '가단', serial: '54671', party: '박해용' },
  { court: '평택가정', year: '2025', type: '즈기', serial: '21', party: '이미옥' },
  { court: '평택가정', year: '2025', type: '즈기', serial: '22', party: '이미옥' },
  { court: '서울가정법원', year: '2025', type: '드단', serial: '56066', party: '한숙영' },
  { court: '천안가정', year: '2025', type: '느단', serial: '3513', party: '김지영' },
  { court: '대전가정법원', year: '2025', type: '브', serial: '5093', party: '김지영' },
  { court: '고양지원', year: '2024', type: '드단', serial: '58330', party: '박정현' },
  { court: '고양지원', year: '2024', type: '드단', serial: '56174', party: '박정현' },
  { court: '부산가정법원', year: '2025', type: '너', serial: '20462', party: '박준범' },
  { court: '천안가정', year: '2025', type: '느단', serial: '174', party: '송희영' },
  { court: '평택지원', year: '2025', type: '가단', serial: '53130', party: '조주성' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20432', party: '홍강의' },
  { court: '안성시법원', year: '2025', type: '차전', serial: '2850', party: '임승태' },
  { court: '평택가정', year: '2025', type: '즈기', serial: '1136', party: '홍종범' },
  { court: '천안가정', year: '2025', type: '너', serial: '3163', party: '김태일' },
  { court: '천안가정', year: '2025', type: '드단', serial: '78', party: '김정언' },
  { court: '평택가정', year: '2025', type: '너', serial: '2059', party: '신희정' },
  { court: '평택가정', year: '2025', type: '너', serial: '7', party: '윤은영' },
  { court: '평택지원', year: '2025', type: '카확', serial: '1397', party: '한수연' },
  { court: '천안가정', year: '2025', type: '즈기', serial: '446', party: '김지영' },
  { court: '평택가정', year: '2024', type: '느단', serial: '10878', party: '안병용' },
  { court: '수원가정법원', year: '2025', type: '즈기', serial: '181', party: '명미정' },
  { court: '서울가정법원', year: '2025', type: '즈단', serial: '30625', party: '한숙영' },
  { court: '천안가정', year: '2025', type: '너', serial: '3143', party: '이보배' },
  { court: '아산시법원', year: '2025', type: '차전', serial: '4449', party: '김경회' },
  { court: '평택가정', year: '2024', type: '드단', serial: '23022', party: '양수경' },
  { court: '서울가정법원', year: '2025', type: '너', serial: '12588', party: '박세원' },
  { court: '평택가정', year: '2024', type: '드단', serial: '24315', party: '양수경' },
  { court: '청주지법', year: '2025', type: '가단', serial: '53832', party: '윤가연' },
  { court: '순천지원', year: '2025', type: '카불', serial: '10526', party: '법무법인' },
  { court: '평택지원', year: '2025', type: '가소', serial: '73430', party: '문재웅' },
  { court: '천안지원', year: '2025', type: '카불', serial: '5736', party: '법무법인' },
  { court: '평택가정', year: '2025', type: '너', serial: '2072', party: '양미석' },
  { court: '천안지원', year: '2025', type: '카명', serial: '6586', party: '강호현' },
  { court: '서산가정', year: '2025', type: '드단', serial: '50375', party: '김동원' },
  { court: '평택가정', year: '2024', type: '드단', serial: '23848', party: '최재영' },
  { court: '평택가정', year: '2025', type: '즈단', serial: '10050', party: '장혜진' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20731', party: '김근령' },
  { court: '평택가정', year: '2025', type: '즈단', serial: '10045', party: '윤은영' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20727', party: '한영미' },
  { court: '천안가정', year: '2025', type: '즈기', serial: '27', party: '이윤주' },
  { court: '수원고법', year: '2025', type: '너', serial: '10082', party: '조유경' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20696', party: '이대경' },
  { court: '평택가정', year: '2024', type: '드단', serial: '21231', party: '장원석' },

  // === 페이지 2 (100건) ===
  { court: '평택가정', year: '2024', type: '즈단', serial: '10056', party: '양명원' },
  { court: '평택가정', year: '2024', type: '즈기', serial: '1077', party: '이대경' },
  { court: '평택가정', year: '2024', type: '즈단', serial: '10083', party: '최재영' },
  { court: '천안지원', year: '2024', type: '고단', serial: '2703', party: '김현성' },
  { court: '평택지원', year: '2024', type: '가단', serial: '75190', party: '홍강의' },
  { court: '평택가정', year: '2024', type: '즈단', serial: '10133', party: '엄현식' },
  { court: '의정부지법', year: '2025', type: '머', serial: '70829', party: '린유지' },
  { court: '천안지원', year: '2025', type: '가소', serial: '33628', party: '김정례' },
  { court: '평택지원', year: '2025', type: '카단', serial: '10332', party: '주식회사' },
  { court: '천안가정', year: '2025', type: '즈기', serial: '10', party: '김정언' },
  { court: '공주지원', year: '2025', type: '카불', serial: '3033', party: '한수연' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20475', party: '엄현식' },
  { court: '서울동부지법', year: '2025', type: '카불', serial: '50529', party: '황윤희' },
  { court: '광주지법', year: '2025', type: '카단', serial: '51793', party: '주식회사' },
  { court: '광주지법', year: '2025', type: '차전', serial: '107692', party: '주식회사' },
  { court: '평택가정', year: '2025', type: '너', serial: '2046', party: '정정희' },
  { court: '대전지법', year: '2025', type: '노', serial: '887', party: '김현성' },
  { court: '천안가정', year: '2025', type: '즈기', serial: '28', party: '이윤주' },
  { court: '평택가정', year: '2025', type: '즈단', serial: '10029', party: '장원석' },
  { court: '광주지법', year: '2025', type: '카담', serial: '50323', party: '주식회사' },
  { court: '평택지원', year: '2024', type: '가단', serial: '79215', party: '윤기석' },
  { court: '천안가정', year: '2025', type: '즈단', serial: '358', party: '김지영' },
  { court: '의정부지법', year: '2024', type: '가단', serial: '107023', party: '주식회사' },
  { court: '평택지원', year: '2024', type: '카확', serial: '1171', party: '제일케미칼' },
  { court: '평택가정', year: '2024', type: '즈단', serial: '10080', party: '김효진' },
  { court: '서울중앙지법', year: '2024', type: '카확', serial: '38919', party: '글로벌코리아부동산중개법인' },
  { court: '평택가정', year: '2024', type: '즈기', serial: '1174', party: '양수경' },
  { court: '평택가정', year: '2024', type: '즈기', serial: '80', party: '장지원' },
  { court: '평택지원', year: '2024', type: '가소', serial: '104535', party: '법무법인' },
  { court: '여주지원', year: '2024', type: '가단', serial: '23417', party: '김요한' },
  { court: '평택지원', year: '2024', type: '차전', serial: '8467', party: '법무법인' },
  { court: '평택지원', year: '2024', type: '차전', serial: '8427', party: '법무법인' },
  { court: '아산시법원', year: '2024', type: '차전', serial: '4011', party: '법무법인' },
  { court: '천안가정', year: '2024', type: '드단', serial: '14548', party: '박정현' },
  { court: '대전지법', year: '2024', type: '카합', serial: '50031', party: '최장호' },
  { court: '서울중앙지법', year: '2023', type: '카단', serial: '836268', party: '린유지' },
  { court: '수원가정법원', year: '2024', type: '즈단', serial: '5231', party: '양수경' },
  { court: '평택가정', year: '2024', type: '즈기', serial: '1012', party: '이영기' },
  { court: '평택가정', year: '2023', type: '드단', serial: '22527', party: '이은경' },
  { court: '평택가정', year: '2024', type: '즈단', serial: '10024', party: '장원석' },
  { court: '천안가정', year: '2022', type: '드단', serial: '13107', party: '김수정' },
  { court: '대구가정법원', year: '2024', type: '느단', serial: '10799', party: '정병수' },
  { court: '수원가정법원', year: '2024', type: '드단', serial: '29380', party: '양수경' },
  { court: '평택지원', year: '2024', type: '카기', serial: '10125', party: '이혜지' },
  { court: '평택가정', year: '2024', type: '너', serial: '2387', party: '서민지' },
  { court: '평택가정', year: '2023', type: '드단', serial: '23759', party: '나윤정' },
  { court: '평택가정', year: '2023', type: '드단', serial: '22879', party: '나윤정' },
  { court: '수원지법', year: '2023', type: '나', serial: '51670', party: '한수연' },
  { court: '대전가정법원', year: '2022', type: '드단', serial: '59652', party: '이지안' },
  { court: '수원가정법원', year: '2024', type: '너', serial: '269', party: '양수경' },
  { court: '인천가정법원', year: '2024', type: '너', serial: '101028', party: '유제희' },
  { court: '평택가정', year: '2023', type: '드단', serial: '22015', party: '이아연' },
  { court: '수원지법', year: '2023', type: '노', serial: '3123', party: '곽명섭' },
  { court: '여주지원', year: '2023', type: '가단', serial: '12915', party: '장순옥' },
  { court: '평택지원', year: '2024', type: '카불', serial: '10144', party: '김진성' },
  { court: '여주지원', year: '2024', type: '카기', serial: '10063', party: '윤지은' },
  { court: '대전지법', year: '2023', type: '머', serial: '205062', party: '김명희' },
  { court: '평택지원', year: '2024', type: '가소', serial: '71284', party: '주식회사' },
  { court: '수원지법', year: '2024', type: '가소', serial: '333662', party: '홍지안' },
  { court: '수원가정법원', year: '2024', type: '즈단', serial: '5129', party: '김윤한' },
  { court: '서울행정법원', year: '2020', type: '구합', serial: '59055', party: '서산시' },
  { court: '대전지법', year: '2024', type: '카단', serial: '50578', party: '최장호' },
  { court: '대법원', year: '2024', type: '므', serial: '10561', party: '이정귀' },
  { court: '평택가정', year: '2024', type: '즈기', serial: '1048', party: '장국희' },
  { court: '천안지원', year: '2023', type: '카단', serial: '12803', party: '조영인' },
  { court: '천안지원', year: '2023', type: '카단', serial: '12527', party: '김해김씨안경공승지공파현영문중' },
  { court: '천안가정', year: '2023', type: '드단', serial: '15070', party: '권미영' },
  { court: '평택지원', year: '2024', type: '타채', serial: '33630', party: '김진성' },
  { court: '천안지원', year: '2024', type: '타채', serial: '13040', party: '김진성' },
  { court: '수원가정법원', year: '2024', type: '즈기', serial: '5067', party: '최금하' },
  { court: '수원가정법원', year: '2024', type: '느단', serial: '251', party: '이윤주' },
  { court: '성남지원', year: '2024', type: '카단', serial: '60930', party: '오영모' },
  { court: '수원지법', year: '2023', type: '가단', serial: '534488', party: '오명근' },
  { court: '천안가정', year: '2022', type: '드단', serial: '13411', party: '김재이' },
  { court: '수원가정법원', year: '2024', type: '즈기', serial: '49', party: '이윤주' },
  { court: '평택지원', year: '2023', type: '가단', serial: '75933', party: '이준범' },
  { court: '수원가정법원', year: '2023', type: '드단', serial: '25398', party: '진윤희' },
  { court: '수원지법', year: '2023', type: '머', serial: '80422', party: '오명근' },
  { court: '평택가정', year: '2023', type: '드단', serial: '23872', party: '손진호' },
  { court: '천안가정', year: '2023', type: '즈기', serial: '95', party: '노수인' },
  { court: '평택가정', year: '2023', type: '즈기', serial: '1133', party: '이은경' },
  { court: '수원가정법원', year: '2023', type: '드단', serial: '22795', party: '이금녀' },
  { court: '대전가정법원', year: '2023', type: '드단', serial: '312', party: '이지안' },
  { court: '천안가정', year: '2023', type: '즈기', serial: '1149', party: '윤미애' },
  { court: '천안지원', year: '2023', type: '가단', serial: '100700', party: '윤미애' },
  { court: '대법원', year: '2023', type: '스', serial: '794', party: '최한나' },
  { court: '천안지원', year: '2023', type: '가소', serial: '114345', party: '류영오' },
  { court: '대전고법', year: '2023', type: '르', serial: '1322', party: '이정귀' },
  { court: '서산지원', year: '2023', type: '가단', serial: '55561', party: '지재연' },
  { court: '평택가정', year: '2023', type: '드단', serial: '23735', party: '허채민' },
  { court: '평택지원', year: '2023', type: '고단', serial: '1508', party: '김성우' },
  { court: '천안지원', year: '2023', type: '가단', serial: '114273', party: '지재연' },
  { court: '대전고법', year: '2023', type: '르', serial: '1339', party: '이정귀' },
  { court: '순천지원', year: '2023', type: '카확', serial: '10305', party: '이미정' },
  { court: '천안가정', year: '2022', type: '드단', serial: '12920', party: '황봉연' },
  { court: '천안지원', year: '2021', type: '가단', serial: '101396', party: '김해김씨안경공승지공파현영문중' },
  { court: '수원가정법원', year: '2023', type: '브', serial: '107', party: '최한나' },
  { court: '평택가정', year: '2023', type: '즈기', serial: '1116', party: '홍지연' },

  // === 페이지 3 (78건) ===
  { court: '평택가정', year: '2023', type: '드단', serial: '21951', party: '유현상' },
  { court: '수원가정법원', year: '2023', type: '브', serial: '108', party: '최한나' },
  { court: '수원지법', year: '2023', type: '머', serial: '63816', party: '한수연' },
  { court: '서산가정', year: '2023', type: '드단', serial: '289', party: '유서현' },
  { court: '천안지원', year: '2023', type: '고단', serial: '419', party: '윤영일' },
  { court: '평택지원', year: '2023', type: '가단', serial: '66700', party: '임윤정' },
  { court: '천안가정', year: '2023', type: '즈합', serial: '1014', party: '이정분' },
  { court: '평택가정', year: '2023', type: '너', serial: '2458', party: '홍지연' },
  { court: '천안가정', year: '2023', type: '즈단', serial: '1045', party: '김수정' },
  { court: '서울중앙지법', year: '2022', type: '카단', serial: '820512', party: '윤미애' },
  { court: '평택가정', year: '2023', type: '즈단', serial: '10048', party: '이은경' },
  { court: '천안지원', year: '2023', type: '고단', serial: '593', party: '유태규' },
  { court: '수원가정법원', year: '2023', type: '즈합', serial: '523', party: '최한나' },
  { court: '평택지원', year: '2023', type: '고단', serial: '676', party: '곽명섭' },
  { court: '홍성지원', year: '2022', type: '고단', serial: '956', party: '이건영' },
  { court: '천안지원', year: '2023', type: '카단', serial: '10674', party: '김경회' },
  { court: '수원가정법원', year: '2022', type: '너', serial: '7556', party: '진윤희' },
  { court: '여주가정', year: '2022', type: '즈단', serial: '10054', party: '김민혜' },
  { court: '홍성지원', year: '2023', type: '카기', serial: '5005', party: '김진구' },
  { court: '서울중앙지법', year: '2021', type: '가단', serial: '5076435', party: '글로벌코리아부동산중개법인' },
  { court: '홍성지원', year: '2022', type: '가합', serial: '30720', party: '김진구' },
  { court: '홍성지원', year: '2022', type: '가합', serial: '30737', party: '김진구' },
  { court: '서울중앙지법', year: '2021', type: '가단', serial: '5351150', party: '글로벌코리아부동산중개법인' },
  { court: '홍성지원', year: '2022', type: '가단', serial: '30891', party: '김진구' },
  { court: '홍성지원', year: '2021', type: '가단', serial: '35219', party: '김진구' },
  { court: '평택지원', year: '2022', type: '가단', serial: '52681', party: '한수연' },
  { court: '천안지원', year: '2022', type: '카단', serial: '11691', party: '임태희' },
  { court: '천안지원', year: '2021', type: '가단', serial: '108540', party: '김명희' },
  { court: '홍성지원', year: '2022', type: '카합', serial: '5027', party: '김진구' },
  { court: '평택가정', year: '2022', type: '즈단', serial: '10046', party: '김승휘' },
  { court: '평택가정', year: '2022', type: '즈합', serial: '1014', party: '노선미' },
  { court: '천안가정', year: '2022', type: '즈단', serial: '1071', party: '김재이' },
  { court: '천안지원', year: '2022', type: '카단', serial: '10978', party: '김근옥' },
  { court: '천안가정', year: '2022', type: '즈단', serial: '1064', party: '황봉연' },
  { court: '평택지원', year: '2022', type: '차전', serial: '937', party: '주식회사' },
  { court: '천안가정', year: '2022', type: '너', serial: '10040', party: '김수정' },
  { court: '천안지원', year: '2021', type: '카단', serial: '11842', party: '김해김씨' },
  { court: '평택가정', year: '2022', type: '즈단', serial: '10025', party: '박미경' },
  { court: '서울중앙지법', year: '2021', type: '가소', serial: '1970263', party: '김광필' },
  { court: '천안가정', year: '2021', type: '즈합', serial: '1031', party: '이영애' },
  { court: '홍성지원', year: '2022', type: '카단', serial: '5064', party: '김진구' },
  { court: '평택가정', year: '2022', type: '즈단', serial: '10008', party: '고현경' },
  { court: '평택지원', year: '2021', type: '카단', serial: '11533', party: '하성석' },
  { court: '고양지원', year: '2021', type: '카단', serial: '743', party: '김광필' },
  { court: '대전지법', year: '2021', type: '카단', serial: '54787', party: '황옥란' },
  { court: '천안지원', year: '2021', type: '가단', serial: '102429', party: '주재남' },
  { court: '천안가정', year: '2021', type: '즈합', serial: '1033', party: '이정귀' },
  { court: '청주지법', year: '2021', type: '차전', serial: '8747', party: '김광필' },
  { court: '수원가정법원', year: '2021', type: '즈합', serial: '670', party: '노유리' },
  { court: '홍성지원', year: '2021', type: '카기', serial: '5290', party: '김진구' },
  { court: '평택가정', year: '2021', type: '즈단', serial: '10125', party: '정완수' },
  { court: '평택가정', year: '2021', type: '즈단', serial: '10100', party: '정완수' },
  { court: '천안지원', year: '2021', type: '카단', serial: '11527', party: '조종희' },
  { court: '서울가정법원', year: '2021', type: '즈단', serial: '30961', party: '신승엽' },
  { court: '서울중앙지법', year: '2021', type: '카확', serial: '34336', party: '김광필' },
  { court: '안산가정', year: '2021', type: '즈단', serial: '50016', party: '한혜연' },
  { court: '인천지법', year: '2021', type: '타채', serial: '551441', party: '김광필' },
  { court: '천안가정', year: '2021', type: '즈기', serial: '1017', party: '최민승' },
  { court: '서울중앙지법', year: '2021', type: '차전', serial: '229266', party: '김광필' },
  { court: '천안가정', year: '2021', type: '즈합', serial: '1000', party: '박상애' },
  { court: '서울중앙지법', year: '2021', type: '차전', serial: '1004', party: '김광필' },
  { court: '평택가정', year: '2021', type: '즈단', serial: '10014', party: '정설희' },
  { court: '천안지원', year: '2020', type: '카확', serial: '10311', party: '임지환' },
  { court: '천안지원', year: '2020', type: '카단', serial: '12059', party: '주재남' },
  { court: '천안가정', year: '2020', type: '즈단', serial: '1113', party: '김남순' },
  { court: '천안가정', year: '2020', type: '즈단', serial: '1096', party: '김지혜' },
  { court: '천안지원', year: '2020', type: '카합', serial: '10473', party: '주재남' },
  { court: '천안지원', year: '2021', type: '타경', serial: '102002', party: '유승일' },
  { court: '평택가정', year: '2021', type: '즈합', serial: '1017', party: '임경희' },
  { court: '홍성지원', year: '2023', type: '본', serial: '42', party: '김진구' },
  { court: '평택지원', year: '2023', type: '타경', serial: '864', party: '김승휘' },
  { court: '천안지원', year: '2023', type: '고약', serial: '5406', party: '홍성오' },
  { court: '평택지원', year: '2023', type: '타경', serial: '49579', party: '임윤정' },
  { court: '성남지원', year: '2024', type: '가', serial: '100', party: '오영모' },
  { court: '공주지원', year: '2024', type: '타경', serial: '21640', party: '한수연' },
  { court: '광주지법', year: '2025', type: '카단', serial: '51631', party: '주식회사' },
  { court: '천안지원', year: '2025', type: '타경', serial: '11515', party: '황봉연' },
  { court: '서울북부지법', year: '2025', type: '타경', serial: '12746', party: '신승현' },
];

// 법원명 매핑 (로데스크 -> 대법원)
function mapCourtName(court: string): string {
  const mapping: Record<string, string> = {
    '천안가정': '대전가정법원 천안지원',
    '평택가정': '수원가정법원 평택지원',
    '안성시법원': '수원지방법원 안성시법원',
    '청주지법': '청주지방법원',
    '평택지원': '수원지방법원 평택지원',
    '수원고법': '수원고등법원',
    '서울가정법원': '서울가정법원',
    '천안지원': '대전지방법원 천안지원',
    '의정부지법': '의정부지방법원',
    '서산가정': '대전가정법원 서산지원',
    '수원가정법원': '수원가정법원',
    '고양지원': '의정부지방법원 고양지원',
    '부산가정법원': '부산가정법원',
    '제주지법': '제주지방법원',
    '서울북부지법': '서울북부지방법원',
    '수원지법': '수원지방법원',
    '대전가정법원': '대전가정법원',
    '순천지원': '광주지방법원 순천지원',
    '아산시법원': '대전지방법원 천안지원 아산시법원',
    '광주지법': '광주지방법원',
    '여주지원': '수원지방법원 여주지원',
    '여주가정': '수원가정법원 여주지원',
    '대법원': '대법원',
    '서울중앙지법': '서울중앙지방법원',
    '홍성지원': '대전지방법원 홍성지원',
    '대전지법': '대전지방법원',
    '성남지원': '수원지방법원 성남지원',
    '안산가정': '수원가정법원 안산지원',
    '대구가정법원': '대구가정법원',
    '인천가정법원': '인천가정법원',
    '서울행정법원': '서울행정법원',
    '인천지법': '인천지방법원',
    '공주지원': '대전지방법원 공주지원',
    '대전고법': '대전고등법원',
    '서산지원': '대전지방법원 서산지원',
    '서울동부지법': '서울동부지방법원',
  };
  return mapping[court] || court;
}

// 진행 상태 저장
interface ProgressState {
  completed: string[];
  failed: Array<{ caseNumber: string; error: string }>;
  lastIndex: number;
}

async function main() {
  console.log('=== 로데스크 전체 사건 대법원 등록 ===\n');
  console.log(`총 ${lawdeskCases.length}건의 사건을 등록합니다.\n`);

  const client = getScourtApiClient();
  const results: Array<{ case: string; success: boolean; error?: string }> = [];

  // 시작 인덱스 (이미 처리한 건수가 있으면 조정)
  const startIndex = 0;  // 처음부터 시작

  for (let i = startIndex; i < lawdeskCases.length; i++) {
    const c = lawdeskCases[i];
    const caseNumber = `${c.court}${c.year}${c.type}${c.serial}`;
    const courtName = mapCourtName(c.court);

    console.log(`\n[${i + 1}/${lawdeskCases.length}] ${caseNumber}`);
    console.log(`  법원: ${courtName}, 당사자: ${c.party}`);

    // 법인/회사 사건은 당사자명이 짧아서 검색 어려울 수 있음
    if (c.party.length < 2 || c.party === '주식회사' || c.party === '법무법인') {
      console.log(`  ⏭️ 건너뜀 (당사자명 부족: "${c.party}")`);
      results.push({ case: caseNumber, success: false, error: '당사자명 2자 이상 필요' });
      continue;
    }

    try {
      const result = await client.searchWithCaptcha({
        cortCd: courtName,
        csYr: c.year,
        csDvsCd: c.type,
        csSerial: c.serial,
        btprNm: c.party.substring(0, 2),  // 당사자명 2글자만 사용
      });

      if (result.success) {
        console.log(`  ✅ 등록 성공! (시도: ${result.captchaAttempts}회)`);
        results.push({ case: caseNumber, success: true });
      } else {
        console.log(`  ❌ 등록 실패: ${result.error}`);
        results.push({ case: caseNumber, success: false, error: result.error });
      }
    } catch (error) {
      console.log(`  ❌ 에러: ${error}`);
      results.push({ case: caseNumber, success: false, error: String(error) });
    }

    // API 부하 방지를 위한 대기 (1.5초)
    await new Promise(r => setTimeout(r, 1500));

    // 매 50건마다 중간 결과 출력
    if ((i + 1) % 50 === 0) {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      console.log(`\n--- 중간 결과 (${i + 1}건 처리) ---`);
      console.log(`성공: ${successCount}건, 실패: ${failCount}건`);
    }
  }

  // 최종 결과 요약
  console.log('\n\n=== 등록 결과 요약 ===');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const skipCount = results.filter(r => r.error === '당사자명 2자 이상 필요').length;
  console.log(`성공: ${successCount}건`);
  console.log(`실패: ${failCount}건 (건너뜀: ${skipCount}건)`);

  if (failCount > 0) {
    console.log('\n실패한 사건:');
    results.filter(r => !r.success && r.error !== '당사자명 2자 이상 필요').forEach(r => {
      console.log(`  - ${r.case}: ${r.error}`);
    });
  }
}

main().catch(console.error);
