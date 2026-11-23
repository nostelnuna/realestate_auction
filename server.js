const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 20000,
});

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '2146';

// 금액 단위: 1 = 0.1억 원 (1,000만 원), 초기 자금 300 = 30.0억 원
const STARTING_CASH = 500;
const BID_STEP = 1; // 0.1억 원 (1,000만 원) 단위

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/api/qr', async (req, res) => {
  try {
    const targetUrl = req.query.url || `${req.protocol}://${req.get('host')}/`;
    const dataUrl = await QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    res.json({ dataUrl, targetUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR 생성 실패' });
  }
});

// ---------------------------------------------------------------------------
// 실제 한국 아파트 · 주상복합건물 카탈로그 (90곳)
// appraisal: 기준 감정가 (0.1억 단위, 예: 220 = 22.0억)
// ---------------------------------------------------------------------------
const PROPERTY_CATALOG = [
  { id: 'P01', name: '타워팰리스 (244㎡·90평)', region: '서울 강남구 도곡동', type: '주상복합', emoji: '🏙️', appraisal: 720 },
  { id: 'P02', name: '아크로리버파크 (84㎡·34평)', region: '서울 서초구 반포동', type: '아파트', emoji: '🌊', appraisal: 520 },
  { id: 'P03', name: '래미안 원베일리 (84㎡·34평)', region: '서울 서초구 반포동', type: '아파트', emoji: '🏛️', appraisal: 570 },
  { id: 'P04', name: '한남더힐 (240㎡·91평)', region: '서울 용산구 한남동', type: '아파트', emoji: '👑', appraisal: 1280 },
  { id: 'P05', name: '나인원 한남 (206㎡·75평)', region: '서울 용산구 한남동', type: '아파트', emoji: '💎', appraisal: 1430 },
  { id: 'P06', name: '시그니엘 레지던스 (205㎡·85평)', region: '서울 송파구 신천동', type: '주상복합', emoji: '🗼', appraisal: 1100 },
  { id: 'P07', name: '아크로 서울포레스트 (198㎡·77평)', region: '서울 성동구 성수동', type: '주상복합', emoji: '🌳', appraisal: 950 },
  { id: 'P08', name: '트리마제 (84㎡·38평)', region: '서울 성동구 성수동', type: '주상복합', emoji: '✨', appraisal: 400 },
  { id: 'P09', name: '갤러리아포레 (217㎡·80평)', region: '서울 성동구 성수동', type: '주상복합', emoji: '🏢', appraisal: 850 },
  { id: 'P10', name: '압구정 현대아파트 (196㎡·65평)', region: '서울 강남구 압구정동', type: '아파트', emoji: '🏘️', appraisal: 800 },
  { id: 'P11', name: '대치 은마아파트 (84㎡·34평)', region: '서울 강남구 대치동', type: '아파트', emoji: '📚', appraisal: 340 },
  { id: 'P12', name: '청담 PH129 (273㎡·100평)', region: '서울 강남구 청담동', type: '주상복합', emoji: '🥂', appraisal: 1550 },
  { id: 'P13', name: '잠실 엘스 (84㎡·33평)', region: '서울 송파구 잠실동', type: '아파트', emoji: '🏟️', appraisal: 325 },
  { id: 'P14', name: '잠실 주공5단지 (82㎡·36평)', region: '서울 송파구 잠실동', type: '아파트', emoji: '🏗️', appraisal: 350 },
  { id: 'P15', name: '마포 래미안 푸르지오 (84㎡·34평)', region: '서울 마포구 아현동', type: '아파트', emoji: '🚇', appraisal: 220 },
  { id: 'P16', name: '여의도 브라이튼 (101㎡·42평)', region: '서울 영등포구 여의도동', type: '주상복합', emoji: '💼', appraisal: 420 },
  { id: 'P17', name: '용산 센트럴파크 해링턴 (92㎡·40평)', region: '서울 용산구 한강로', type: '주상복합', emoji: '🚝', appraisal: 350 },
  { id: 'P18', name: '개포 디에이치 아너힐즈 (84㎡·34평)', region: '서울 강남구 개포동', type: '아파트', emoji: '🌿', appraisal: 390 },
  { id: 'P19', name: '서초 그랑자이 (84㎡·34평)', region: '서울 서초구 서초동', type: '아파트', emoji: '🏬', appraisal: 380 },
  { id: 'P20', name: '도곡 렉슬 (84㎡·34평)', region: '서울 강남구 도곡동', type: '아파트', emoji: '🏫', appraisal: 340 },
  { id: 'P21', name: '흑석 아크로 리버하임 (84㎡·34평)', region: '서울 동작구 흑석동', type: '아파트', emoji: '🌉', appraisal: 220 },
  { id: 'P22', name: '고덕 그라시움 (84㎡·34평)', region: '서울 강동구 고덕동', type: '아파트', emoji: '🌲', appraisal: 190 },
  { id: 'P23', name: '목동 신시가지 7단지 (66㎡·27평)', region: '서울 양천구 목동', type: '아파트', emoji: '🎓', appraisal: 220 },
  { id: 'P24', name: '반포 자이 (84㎡·35평)', region: '서울 서초구 반포동', type: '아파트', emoji: '⛲', appraisal: 440 },
  { id: 'P25', name: '과천 푸르지오 써밋 (84㎡·33평)', region: '경기 과천시 중앙동', type: '아파트', emoji: '⛰️', appraisal: 220 },
  { id: 'P26', name: '분당 파크뷰 (84㎡·33평)', region: '경기 성남시 정자동', type: '주상복합', emoji: '🏞️', appraisal: 180 },
  { id: 'P27', name: '판교 알파돔시티 (96㎡·39평)', region: '경기 성남시 백현동', type: '주상복합', emoji: '💻', appraisal: 200 },
  { id: 'P28', name: '해운대 엘시티 (144㎡·58평)', region: '부산 해운대구 중동', type: '주상복합', emoji: '🏖️', appraisal: 300 },
  { id: 'P29', name: '해운대 마린시티 아이파크 (84㎡·37평)', region: '부산 해운대구 우동', type: '주상복합', emoji: '⛵', appraisal: 120 },
  { id: 'P30', name: '송도 더샵 센트럴파크 (84㎡·34평)', region: '인천 연수구 송도동', type: '주상복합', emoji: '🌆', appraisal: 100 },
  { id: 'P31', name: '아크로 리버뷰 신반포 (84㎡·34평)', region: '서울 서초구 잠원동', type: '아파트', emoji: '🌊', appraisal: 430 },
  { id: 'P32', name: '래미안 대치 팰리스 (84㎡·34평)', region: '서울 강남구 대치동', type: '아파트', emoji: '📚', appraisal: 400 },
  { id: 'P33', name: '개포 래미안 포레스트 (84㎡·34평)', region: '서울 강남구 개포동', type: '아파트', emoji: '🌲', appraisal: 330 },
  { id: 'P34', name: '잠실 리센츠 (84㎡·33평)', region: '서울 송파구 잠실동', type: '아파트', emoji: '🏟️', appraisal: 320 },
  { id: 'P35', name: '잠실 트리지움 (84㎡·33평)', region: '서울 송파구 잠실동', type: '아파트', emoji: '🏘️', appraisal: 290 },
  { id: 'P36', name: '송파 헬리오시티 (84㎡·33평)', region: '서울 송파구 가락동', type: '아파트', emoji: '🏙️', appraisal: 260 },
  { id: 'P37', name: '래미안 용산 더 센트럴 (135㎡·53평)', region: '서울 용산구 한강로', type: '주상복합', emoji: '🚝', appraisal: 380 },
  { id: 'P38', name: '경희궁 자이 (84㎡·34평)', region: '서울 종로구 홍파동', type: '아파트', emoji: '🏯', appraisal: 230 },
  { id: 'P39', name: '왕십리 텐즈힐 (84㎡·33평)', region: '서울 성동구 하왕십리동', type: '아파트', emoji: '🚇', appraisal: 180 },
  { id: 'P40', name: '공덕 자이 (84㎡·34평)', region: '서울 마포구 아현동', type: '아파트', emoji: '🏢', appraisal: 210 },
  { id: 'P41', name: '동탄역 롯데캐슬 (84㎡·34평)', region: '경기 화성시 오산동', type: '주상복합', emoji: '🚄', appraisal: 150 },
  { id: 'P42', name: '광교 중흥S클래스 (84㎡·35평)', region: '경기 수원시 영통구 하동', type: '주상복합', emoji: '🏞️', appraisal: 160 },
  { id: 'P43', name: '수성 SK 리더스뷰 (84㎡·36평)', region: '대구 수성구 두산동', type: '주상복합', emoji: '🌆', appraisal: 85 },
  { id: 'P44', name: '대전 도안 트리풀시티 (84㎡·34평)', region: '대전 유성구 상대동', type: '아파트', emoji: '🌳', appraisal: 63 },
  { id: 'P45', name: '세종 더샵 레이크파크 (84㎡·34평)', region: '세종 어진동', type: '아파트', emoji: '🏛️', appraisal: 75 },
  // --- 5억 이하 (20개) ---
  { id: 'P46', name: '청주 지웰시티 1차 (59㎡·25평)', region: '충북 청주시 흥덕구 복대동', type: '주상복합', emoji: '🏢', appraisal: 38 },
  { id: 'P47', name: '천안 불당 지웰푸르지오 (59㎡·25평)', region: '충남 천안시 서북구 불당동', type: '아파트', emoji: '🏘️', appraisal: 42 },
  { id: 'P48', name: '원주 혁신 중흥S클래스 (84㎡·34평)', region: '강원 원주시 반곡동', type: '아파트', emoji: '⛰️', appraisal: 35 },
  { id: 'P49', name: '창원 중동 유니시티 (59㎡·25평)', region: '경남 창원시 의창구 중동', type: '아파트', emoji: '🌳', appraisal: 46 },
  { id: 'P50', name: '울산 문수로 아이파크 (59㎡·25평)', region: '울산 남구 신정동', type: '아파트', emoji: '🏙️', appraisal: 45 },
  { id: 'P51', name: '광주 상무 SK뷰 (84㎡·34평)', region: '광주 서구 치평동', type: '아파트', emoji: '🏛️', appraisal: 48 },
  { id: 'P52', name: '전주 에코시티 데시앙 (84㎡·34평)', region: '전북 전주시 덕진구 송천동', type: '아파트', emoji: '🌲', appraisal: 44 },
  { id: 'P53', name: '춘천 센트럴타워 푸르지오 (59㎡·25평)', region: '강원 춘천시 온의동', type: '주상복합', emoji: '🏞️', appraisal: 39 },
  { id: 'P54', name: '아산 배방 한성필하우스 (84㎡·33평)', region: '충남 아산시 배방읍', type: '아파트', emoji: '🚄', appraisal: 28 },
  { id: 'P55', name: '구미 문성 파크자이 (84㎡·34평)', region: '경북 구미시 고아읍', type: '아파트', emoji: '🌿', appraisal: 29 },
  { id: 'P56', name: '포항 자이 (84㎡·34평)', region: '경북 포항시 남구 대잠동', type: '아파트', emoji: '🌊', appraisal: 36 },
  { id: 'P57', name: '김해 율하 원메이저 (84㎡·34평)', region: '경남 김해시 장유동', type: '아파트', emoji: '🏡', appraisal: 37 },
  { id: 'P58', name: '양산 물금 대방노블랜드 (84㎡·34평)', region: '경남 양산시 물금읍', type: '아파트', emoji: '🚇', appraisal: 34 },
  { id: 'P59', name: '진주 충무공 중흥S클래스 (84㎡·34평)', region: '경남 진주시 충무공동', type: '아파트', emoji: '🏫', appraisal: 41 },
  { id: 'P60', name: '익산 모현 e편한세상 (84㎡·33평)', region: '전북 익산시 모현동', type: '아파트', emoji: '🏘️', appraisal: 26 },
  { id: 'P61', name: '군산 디오션시티 푸르지오 (84㎡·34평)', region: '전북 군산시 조촌동', type: '아파트', emoji: '⛵', appraisal: 31 },
  { id: 'P62', name: '충주 호암 힐스테이트 (84㎡·34평)', region: '충북 충주시 호암동', type: '아파트', emoji: '🏞️', appraisal: 33 },
  { id: 'P63', name: '제천 강저 롯데캐슬 (84㎡·33평)', region: '충북 제천시 강제동', type: '아파트', emoji: '🌲', appraisal: 22 },
  { id: 'P64', name: '여수 웅천 꿈에그린 (84㎡·34평)', region: '전남 여수시 웅천동', type: '아파트', emoji: '🏖️', appraisal: 43 },
  { id: 'P65', name: '순천 신대 중흥S클래스 (84㎡·34평)', region: '전남 순천시 해룡면', type: '아파트', emoji: '🌿', appraisal: 32 },

  // --- 5억 ~ 20억 (15개) ---
  { id: 'P66', name: '수원 영통 아이파크 캐슬 (84㎡·34평)', region: '경기 수원시 영통구 망포동', type: '아파트', emoji: '🏫', appraisal: 95 },
  { id: 'P67', name: '일산 킨텍스 꿈에그린 (84㎡·34평)', region: '경기 고양시 일산서구 대화동', type: '주상복합', emoji: '🏢', appraisal: 115 },
  { id: 'P68', name: '평촌 어바인퍼스트 (84㎡·34평)', region: '경기 안양시 동안구 호계동', type: '아파트', emoji: '🚇', appraisal: 105 },
  { id: 'P69', name: '위례 자이 (101㎡·39평)', region: '경기 성남시 수정구 창곡동', type: '아파트', emoji: '🌳', appraisal: 175 },
  { id: 'P70', name: '미사강변 푸르지오 (84㎡·34평)', region: '경기 하남시 망월동', type: '아파트', emoji: '🌊', appraisal: 100 },
  { id: 'P71', name: '하남 감일 포웰시티 (84㎡·34평)', region: '경기 하남시 감이동', type: '아파트', emoji: '🌲', appraisal: 110 },
  { id: 'P72', name: '안양 평촌 래미안 푸르지오 (84㎡·34평)', region: '경기 안양시 동안구 비산동', type: '아파트', emoji: '🏬', appraisal: 115 },
  { id: 'P73', name: '청라 한양수자인 (84㎡·34평)', region: '인천 서구 청라동', type: '아파트', emoji: '🌆', appraisal: 68 },
  { id: 'P74', name: '부천 중동 리첸시아 (117㎡·48평)', region: '경기 부천시 원미구 중동', type: '주상복합', emoji: '🏙️', appraisal: 90 },
  { id: 'P75', name: '노원 포레나 (84㎡·34평)', region: '서울 노원구 상계동', type: '아파트', emoji: '🎓', appraisal: 105 },
  { id: 'P76', name: '창동 삼성래미안 (84㎡·33평)', region: '서울 도봉구 창동', type: '아파트', emoji: '🚇', appraisal: 88 },
  { id: 'P77', name: '길음 래미안 센터피스 (84㎡·34평)', region: '서울 성북구 길음동', type: '아파트', emoji: '🏘️', appraisal: 135 },
  { id: 'P78', name: '상도 롯데캐슬 파크엘 (84㎡·34평)', region: '서울 동작구 상도동', type: '아파트', emoji: '⛰️', appraisal: 145 },
  { id: 'P79', name: 'DMC 래미안 e편한세상 (84㎡·34평)', region: '서울 서대문구 북가좌동', type: '아파트', emoji: '💻', appraisal: 130 },
  { id: 'P80', name: '옥수 파크힐스 (59㎡·25평)', region: '서울 성동구 옥수동', type: '아파트', emoji: '🌉', appraisal: 185 },

  // --- 20억 ~ 40억 (10개) ---
  { id: 'P81', name: '용산 아스테리움 (121㎡·48평)', region: '서울 용산구 한강로', type: '주상복합', emoji: '🚝', appraisal: 330 },
  { id: 'P82', name: '반포 래미안 퍼스티지 (59㎡·26평)', region: '서울 서초구 반포동', type: '아파트', emoji: '⛲', appraisal: 350 },
  { id: 'P83', name: '잠실 아시아선수촌 (99㎡·38평)', region: '서울 송파구 잠실동', type: '아파트', emoji: '🏟️', appraisal: 370 },
  { id: 'P84', name: '대치 래미안 청실 (84㎡·35평)', region: '서울 강남구 대치동', type: '아파트', emoji: '📚', appraisal: 360 },
  { id: 'P85', name: '개포 래미안 블레스티지 (84㎡·34평)', region: '서울 강남구 개포동', type: '아파트', emoji: '🌿', appraisal: 320 },
  { id: 'P86', name: '이촌 한가람 (84㎡·32평)', region: '서울 용산구 이촌동', type: '아파트', emoji: '🌊', appraisal: 250 },
  { id: 'P87', name: '마포 프레스티지 자이 (84㎡·34평)', region: '서울 마포구 염리동', type: '아파트', emoji: '🚇', appraisal: 245 },
  { id: 'P88', name: '서울숲 리버뷰 자이 (84㎡·34평)', region: '서울 성동구 행당동', type: '아파트', emoji: '🌳', appraisal: 270 },
  { id: 'P89', name: '방배 그랑자이 (84㎡·34평)', region: '서울 서초구 방배동', type: '아파트', emoji: '🏬', appraisal: 310 },
  { id: 'P90', name: '목동 하이페리온 (137㎡·53평)', region: '서울 양천구 목동', type: '주상복합', emoji: '🏙️', appraisal: 290 },
];

// ---------------------------------------------------------------------------
// 게임 상태 저장소
// ---------------------------------------------------------------------------
const state = {
  phase: 'LOBBY', // LOBBY | BIDDING | RESULT | GAME_OVER
  round: 0,
  totalRounds: 15,
  timer: 0,
  paused: false,
  phaseNonce: 0,
  players: new Map(), // token -> playerObj
  hostTokens: new Set(),
  deck: [],
  currentLots: [], // 3 properties per round
  bids: new Map(), // token -> { lotId, amount, timestamp }
  resultLogs: [],
  secretHistory: [], // list of secret wins for final reveal
  chatHistory: [],
};

let timerInterval = null;
let lastManualAdvanceAt = 0;

function generateToken() {
  return crypto.randomBytes(12).toString('hex');
}

function formatBillion(units) {
  return `${(units / 10).toFixed(1)}억`;
}

function getPlayerBySocket(socketId) {
  for (const p of state.players.values()) {
    if (p.socketId === socketId) return p;
  }
  return null;
}

function isHostSocket(socket) {
  if (socket.data && socket.data.isHost) return true;
  if (socket.data && socket.data.hostToken && state.hostTokens.has(socket.data.hostToken)) {
    return true;
  }
  return false;
}

function cleanupDeadSockets() {
  let removed = 0;
  for (const [token, p] of state.players.entries()) {
    const activeSocket = p.socketId ? io.sockets.sockets.get(p.socketId) : null;
    if (!p.connected || !activeSocket || !activeSocket.connected) {
      state.players.delete(token);
      removed += 1;
    }
  }
  return removed;
}

function computeFinalRankings() {
  const arr = Array.from(state.players.values()).map((p) => {
    const propTotal = p.properties.reduce((acc, pr) => acc + pr.finalValue, 0);
    const totalAsset = p.cash + propTotal;
    return {
      token: p.token,
      nickname: p.nickname,
      cash: p.cash,
      propTotal,
      totalAsset,
      propertyCount: p.properties.length,
      properties: p.properties,
    };
  });

  arr.sort((a, b) => {
    if (b.totalAsset !== a.totalAsset) return b.totalAsset - a.totalAsset;
    return b.propTotal - a.propTotal;
  });

  let rank = 1;
  arr.forEach((item, idx) => {
    if (idx > 0 && item.totalAsset < arr[idx - 1].totalAsset) {
      rank = idx + 1;
    }
    item.rank = rank;
  });
  return arr;
}

function broadcastState() {
  const rawRankings = (state.phase === 'RESULT' || state.phase === 'GAME_OVER') ? computeFinalRankings() : [];
  const safeRankings = state.phase === 'RESULT'
    ? rawRankings.map((r) => ({ rank: r.rank, token: r.token, nickname: r.nickname }))
    : rawRankings;

  for (const s of io.sockets.sockets.values()) {
    const myToken = s.data?.playerToken || null;
    const isHost = isHostSocket(s);

    // 시크릿 낙찰로 인해 타인의 잔여 현금을 역산하지 못하도록 진행 중에는 본인 현금만 노출
    const publicPlayers = Array.from(state.players.values()).map((p) => {
      const revealFinance = state.phase === 'GAME_OVER' || p.token === myToken;
      return {
        token: p.token,
        nickname: p.nickname,
        connected: p.connected,
        hasBid: state.bids.has(p.token),
        cash: revealFinance ? p.cash : null,
        properties: revealFinance ? p.properties : null,
        wonPropertiesSummary: p.properties.map((pr) => ({
          round: pr.round,
          name: pr.name,
          region: pr.region,
          emoji: pr.emoji,
          wasSecret: pr.wasSecret,
        })),
        propertyCount: p.properties.length,
      };
    });

    const sanitizedLots = state.currentLots.map((lot) => {
      const baseLot = {
        id: lot.id,
        name: lot.name,
        region: lot.region,
        type: lot.type,
        emoji: lot.emoji,
        winnerToken: lot.winnerToken,
        winnerNickname: lot.winnerNickname,
        winningBid: lot.winningBid,
        allTied: lot.allTied,
        wonByFallback: lot.wonByFallback,
        isSecret: lot.isSecret,
        isSecretMasked: false,
      };
      if (state.phase === 'RESULT' && lot.isSecret) {
        baseLot.winningBid = null;
        baseLot.isSecretMasked = true;
      }
      return baseLot;
    });

    s.emit('game:state', {
      phase: state.phase,
      round: state.round,
      totalRounds: state.totalRounds,
      timer: state.timer,
      paused: state.paused,
      phaseNonce: state.phaseNonce,
      lots: sanitizedLots,
      resultLogs: state.resultLogs,
      secretHistory: state.phase === 'GAME_OVER' ? state.secretHistory : [],
      players: publicPlayers,
      rankings: (state.phase === 'GAME_OVER' || isHost) ? rawRankings : safeRankings,
      isHostView: isHost,
    });
  }
}

function startTimer(seconds, onExpire) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const expectedNonce = state.phaseNonce;
  state.timer = seconds;
  state.paused = false;
  broadcastState();

  timerInterval = setInterval(() => {
    if (state.phaseNonce !== expectedNonce) {
      clearInterval(timerInterval);
      timerInterval = null;
      return;
    }
    if (state.paused) return;
    state.timer -= 1;
    if (state.timer <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      state.timer = 0;
      if (state.phaseNonce === expectedNonce) {
        onExpire();
      }
    } else {
      io.emit('game:tick', { timer: state.timer, paused: state.paused });
    }
  }, 1000);
}

// ---------------------------------------------------------------------------
// 라운드 진행 로직 (라운드당 3개 매물 출품)
// ---------------------------------------------------------------------------
function prepareDeck() {
  const copy = [...PROPERTY_CATALOG];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  state.deck = copy;
}

function startBiddingPhase() {
  state.round += 1;
  state.phase = 'BIDDING';
  state.phaseNonce += 1;
  state.bids.clear();
  state.resultLogs = [];

  if (state.deck.length < 3) {
    prepareDeck();
  }
  const picked = state.deck.splice(0, 3);
  state.currentLots = picked.map((p) => {
    // 최종 평가가 = 기준 감정가 고정
    const finalValue = p.appraisal;
    return {
      ...p,
      finalValue,
      winnerToken: null,
      winnerNickname: null,
      winningBid: 0,
      isSecret: false,
    };
  });

  startTimer(90, settleRound);
}

function settleRound() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  state.phase = 'RESULT';
  state.phaseNonce += 1;

  // 1) 매물별 최고 단독 입찰자 결정 (동일 금액 2인 이상 중복 시 차순위로 내려가며 단독 입찰자 탐색)
  for (const lot of state.currentLots) {
    const byAmount = new Map();
    let totalValidBids = 0;
    for (const [token, bid] of state.bids.entries()) {
      if (bid.lotId === lot.id && bid.amount > 0) {
        totalValidBids += 1;
        if (!byAmount.has(bid.amount)) byAmount.set(bid.amount, []);
        byAmount.get(bid.amount).push({ token, amount: bid.amount, timestamp: bid.timestamp });
      }
    }

    const sortedAmounts = Array.from(byAmount.keys()).sort((a, b) => b - a);
    let skippedTies = false;
    lot.allTied = false;
    lot.wonByFallback = false;

    for (const amt of sortedAmounts) {
      const group = byAmount.get(amt);
      if (group.length === 1) {
        const winner = state.players.get(group[0].token);
        if (winner) {
          lot.winnerToken = winner.token;
          lot.winnerNickname = winner.nickname;
          lot.winningBid = amt;
          lot.winningTimestamp = group[0].timestamp;
          lot.wonByFallback = skippedTies;
        }
        break;
      } else {
        skippedTies = true;
      }
    }

    if (totalValidBids > 0 && !lot.winnerToken) {
      lot.allTied = true;
    }
  }

  // 2) 3개 매물 중 가장 높게 입찰된(최고 낙찰가) 1개 건물에 시크릿(비공개) 적용
  const soldLots = state.currentLots.filter((l) => l.winningBid > 0);
  if (soldLots.length > 0) {
    soldLots.sort((a, b) => {
      if (b.winningBid !== a.winningBid) return b.winningBid - a.winningBid;
      return (a.winningTimestamp || 0) - (b.winningTimestamp || 0);
    });
    soldLots[0].isSecret = true;
  }

  // 3) 낙찰자 현금 차감 및 보유 부동산 추가 + 공개 로그 작성
  const logs = [];
  for (const lot of state.currentLots) {
    if (lot.winningBid > 0 && lot.winnerToken) {
      const winner = state.players.get(lot.winnerToken);
      if (winner) {
        winner.cash = Math.max(0, winner.cash - lot.winningBid);
        winner.properties.push({
          round: state.round,
          name: lot.name,
          region: lot.region,
          type: lot.type,
          emoji: lot.emoji,
          appraisal: lot.appraisal,
          paidBid: lot.winningBid,
          finalValue: lot.finalValue,
          wasSecret: lot.isSecret,
        });
      }

      const fallbackNote = lot.wonByFallback ? ' · 상위 금액 중복으로 차순위 낙찰' : '';
      if (lot.isSecret) {
        state.secretHistory.push({
          round: state.round,
          name: lot.name,
          region: lot.region,
          winnerNickname: lot.winnerNickname,
          winningBid: lot.winningBid,
        });
        logs.push(`🔒 [${lot.name}] → ${lot.winnerNickname}님 낙찰 (최고가 낙찰 금액 시크릿${fallbackNote})`);
      } else {
        logs.push(`🏠 [${lot.name}] → ${lot.winnerNickname}님 낙찰 (${formatBillion(lot.winningBid)}${fallbackNote})`);
      }
    } else if (lot.allTied) {
      logs.push(`💥 [${lot.name}] 모든 입찰 금액이 중복되어 유찰되었습니다.`);
    } else {
      logs.push(`💨 [${lot.name}] 입찰자가 없어 유찰되었습니다.`);
    }
  }

  state.resultLogs = logs;

  startTimer(30, () => {
    if (state.round >= state.totalRounds) {
      state.phase = 'GAME_OVER';
      state.phaseNonce += 1;
      broadcastState();
    } else {
      startBiddingPhase();
    }
  });
}

function advancePhaseManually() {
  if (state.phase === 'BIDDING') {
    settleRound();
  } else if (state.phase === 'RESULT') {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (state.round >= state.totalRounds) {
      state.phase = 'GAME_OVER';
      state.phaseNonce += 1;
      broadcastState();
    } else {
      startBiddingPhase();
    }
  }
}

// ---------------------------------------------------------------------------
// Socket.io 이벤트 핸들러
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  socket.on('host:auth', ({ pin, hostToken }, callback) => {
    if (hostToken && state.hostTokens.has(hostToken)) {
      socket.data.isHost = true;
      socket.data.hostToken = hostToken;
      broadcastState();
      return callback?.({ ok: true, hostToken });
    }
    if (String(pin || '').trim() === ADMIN_PIN) {
      const newHostToken = generateToken();
      state.hostTokens.add(newHostToken);
      socket.data.isHost = true;
      socket.data.hostToken = newHostToken;
      broadcastState();
      return callback?.({ ok: true, hostToken: newHostToken });
    }
    return callback?.({ ok: false, error: '관리자 PIN이 올바르지 않습니다.' });
  });

  socket.on('player:join', ({ nickname, token }, callback) => {
    if (token && state.players.has(token)) {
      const existing = state.players.get(token);
      existing.socketId = socket.id;
      existing.connected = true;
      socket.data.playerToken = token;
      broadcastState();
      return callback?.({
        ok: true,
        token: existing.token,
        nickname: existing.nickname,
        myBid: state.bids.get(existing.token) || null,
        chatHistory: state.chatHistory.slice(-40),
      });
    }

    const cleanName = String(nickname || '').trim().slice(0, 16);
    if (!cleanName) return callback?.({ ok: false, error: '닉네임을 입력해 주세요.' });
    if (state.phase !== 'LOBBY') {
      return callback?.({ ok: false, error: '이미 경매가 진행 중입니다. 다음 판을 기다려 주세요.' });
    }
    if (state.players.size >= 35) {
      return callback?.({ ok: false, error: '최대 정원(35명)이 가득 찼습니다.' });
    }
    for (const p of state.players.values()) {
      if (p.nickname.toLowerCase() === cleanName.toLowerCase()) {
        return callback?.({ ok: false, error: '이미 사용 중인 닉네임입니다.' });
      }
    }

    const newToken = generateToken();
    state.players.set(newToken, {
      token: newToken,
      socketId: socket.id,
      nickname: cleanName,
      connected: true,
      cash: STARTING_CASH,
      properties: [],
    });
    socket.data.playerToken = newToken;
    broadcastState();
    return callback?.({
      ok: true,
      token: newToken,
      nickname: cleanName,
      myBid: null,
      chatHistory: state.chatHistory.slice(-40),
    });
  });

  socket.on('game:request_state', () => {
    broadcastState();
  });

  socket.on('host:start_game', ({ totalRounds }, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false, error: '방장 권한이 없습니다.' });
    cleanupDeadSockets();

    if (state.players.size < 1) {
      return callback?.({ ok: false, error: '최소 1명 이상의 참가자가 필요합니다.' });
    }

    const roundsNum = Math.floor(Number(totalRounds));
    state.totalRounds = (Number.isFinite(roundsNum) && roundsNum >= 1 && roundsNum <= 15) ? roundsNum : 15;
    state.round = 0;
    state.secretHistory = [];
    state.chatHistory = [];
    prepareDeck();

    for (const p of state.players.values()) {
      p.cash = STARTING_CASH;
      p.properties = [];
    }

    startBiddingPhase();
    return callback?.({ ok: true });
  });

  socket.on('host:pause_resume', (_, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    state.paused = !state.paused;
    io.emit('game:tick', { timer: state.timer, paused: state.paused });
    broadcastState();
    return callback?.({ ok: true, paused: state.paused });
  });

  socket.on('host:extend_time', ({ seconds = 30 }, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    state.timer += Number(seconds) || 30;
    io.emit('game:tick', { timer: state.timer, paused: state.paused });
    return callback?.({ ok: true, timer: state.timer });
  });

  socket.on('host:next_phase', (_, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    const now = Date.now();
    if (now - lastManualAdvanceAt < 1500) {
      return callback?.({ ok: false, error: '잠시 후 다시 시도해 주세요.' });
    }
    lastManualAdvanceAt = now;
    advancePhaseManually();
    return callback?.({ ok: true });
  });

  socket.on('host:kick_player', ({ targetToken }, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    const target = state.players.get(targetToken);
    if (target) {
      if (target.socketId) io.to(target.socketId).emit('player:kicked');
      state.players.delete(targetToken);
      state.bids.delete(targetToken);
      broadcastState();
    }
    return callback?.({ ok: true });
  });

  socket.on('host:reset_game', (_, callback) => {
    if (!isHostSocket(socket)) return callback?.({ ok: false });
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    cleanupDeadSockets();
    state.phase = 'LOBBY';
    state.round = 0;
    state.timer = 0;
    state.paused = false;
    state.phaseNonce += 1;
    state.currentLots = [];
    state.bids.clear();
    state.resultLogs = [];
    state.secretHistory = [];

    for (const p of state.players.values()) {
      p.cash = STARTING_CASH;
      p.properties = [];
    }
    broadcastState();
    return callback?.({ ok: true });
  });

  // 3개 매물 중 1곳에만 입찰
  socket.on('bid:submit', ({ lotId, amount }, callback) => {
    const p = getPlayerBySocket(socket.id);
    if (!p) return callback?.({ ok: false, error: '참가자 정보를 찾을 수 없습니다.' });
    if (state.phase !== 'BIDDING') {
      return callback?.({ ok: false, error: '입찰 시간이 아닙니다.' });
    }

    const lot = state.currentLots.find((l) => l.id === lotId);
    if (!lot) return callback?.({ ok: false, error: '유효하지 않은 매물입니다.' });

    const bidAmount = Math.floor(Number(amount));
    if (!Number.isFinite(bidAmount) || bidAmount < 0 || bidAmount > p.cash || bidAmount % BID_STEP !== 0) {
      return callback?.({ ok: false, error: '입찰금은 0.1억(1천만 원) 단위의 보유 현금 이내여야 합니다.' });
    }

    state.bids.set(p.token, {
      lotId,
      amount: bidAmount,
      timestamp: Date.now(),
    });

    broadcastState();
    return callback?.({ ok: true, bid: state.bids.get(p.token) });
  });

  socket.on('chat:send', ({ text }) => {
    const p = getPlayerBySocket(socket.id);
    const cleanText = String(text || '').trim().slice(0, 200);
    if (!cleanText) return;
    const sender = p ? p.nickname : (isHostSocket(socket) ? '진행자' : null);
    if (!sender) return;

    const msg = {
      id: generateToken().slice(0, 8),
      sender,
      text: cleanText,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    state.chatHistory.push(msg);
    if (state.chatHistory.length > 80) state.chatHistory.shift();
    io.emit('chat:message', msg);
  });

  socket.on('disconnect', () => {
    const p = getPlayerBySocket(socket.id);
    if (p) {
      p.connected = false;
      broadcastState();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Real Estate Secret Auction server running on port ${PORT}`);
});
