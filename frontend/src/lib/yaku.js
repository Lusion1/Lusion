// =====================================================================
// 일본 마작 役 카탈로그 (한 수 포함)
//   - 멘젠(門前) 시 한 수와 식하(食下) 시 한 수가 다른 役은 둘 다 표기 ('1/-' 형식)
//   - 食下 -1 은 멘젠일 때만 인정 (예: 핑허, 이페코)
//   - winType: 'tsumo' 면 쯔모 전용 / 'ron' 이면 론 전용 / undefined 면 둘 다
// =====================================================================

export const YAKU_CATALOG = [
    // 1판 役
    { key: 'riichi',     label: '리치',         han: 1, group: '1판', menzenOnly: true,  note: '문전 한정' },
    { key: 'ippatsu',    label: '일발',         han: 1, group: '1판', menzenOnly: true,  note: '리치 후 1순' },
    { key: 'tsumo',      label: '멘젠쯔모',     han: 1, group: '1판', menzenOnly: true, winType: 'tsumo' },
    { key: 'pinfu',      label: '핑허',         han: 1, group: '1판', menzenOnly: true },
    { key: 'iipeikou',   label: '이페코',       han: 1, group: '1판', menzenOnly: true },
    { key: 'tanyao',     label: '탕야오',       han: 1, group: '1판' },

    // 역패 분할 (5번): 백·발·중 / 자풍 / 장풍
    { key: 'yakuhai_haku',  label: '역패: 백',  han: 1, group: '1판' },
    { key: 'yakuhai_hatsu', label: '역패: 발',  han: 1, group: '1판' },
    { key: 'yakuhai_chun',  label: '역패: 중',  han: 1, group: '1판' },
    { key: 'yakuhai_seat',  label: '자풍패',    han: 1, group: '1판', note: '본인 자리 패 (동→동가 등)' },
    { key: 'yakuhai_round', label: '장풍패',    han: 1, group: '1판', note: '진행 패 (동장→동 등)' },

    { key: 'haitei',     label: '하이테이',     han: 1, group: '1판', winType: 'tsumo' },
    { key: 'houtei',     label: '호우테이',     han: 1, group: '1판', winType: 'ron' },
    { key: 'rinshan',    label: '영상개화',     han: 1, group: '1판', winType: 'tsumo' },
    { key: 'chankan',    label: '창깡',         han: 1, group: '1판', winType: 'ron' },

    // 2판 役
    { key: 'double_riichi', label: '더블 리치',  han: 2, group: '2판', menzenOnly: true },
    { key: 'sanshoku',   label: '삼색동순',     han: 2, group: '2판', kuisagari: 1, note: '울면 1판' },
    { key: 'sanshoku_doukou', label: '삼색동각', han: 2, group: '2판' },
    { key: 'ittsu',      label: '일기통관',     han: 2, group: '2판', kuisagari: 1 },
    { key: 'chanta',     label: '찬타',         han: 2, group: '2판', kuisagari: 1 },
    { key: 'toitoi',     label: '또이또이',     han: 2, group: '2판' },
    { key: 'sanankou',   label: '산안커',       han: 2, group: '2판' },
    { key: 'sankantsu',  label: '산깡즈',       han: 2, group: '2판' },  // 4번: 삼깡자 → 산깡즈
    { key: 'chiitoitsu', label: '치또이',       han: 2, group: '2판', menzenOnly: true },
    { key: 'honroutou',  label: '혼노두',       han: 2, group: '2판' },
    { key: 'shousangen', label: '소삼원',       han: 2, group: '2판' },

    // 3판 役
    { key: 'honitsu',    label: '혼일색',       han: 3, group: '3판', kuisagari: 1 },
    { key: 'junchan',    label: '준찬타',       han: 3, group: '3판', kuisagari: 1 },
    { key: 'ryanpeikou', label: '량페코',       han: 3, group: '3판', menzenOnly: true },

    // 6판 役
    { key: 'chinitsu',   label: '청일색',       han: 6, group: '6판', kuisagari: 1 },

    // 만관 등급 (역 자체로 분류)
    { key: 'mangan',     label: '만관',         han: null, group: '등급', scoreClass: 'mangan' },
    { key: 'haneman',    label: '하네만',       han: null, group: '등급', scoreClass: 'haneman' },
    { key: 'baiman',     label: '배만',         han: null, group: '등급', scoreClass: 'baiman' },
    { key: 'sanbaiman',  label: '삼배만',       han: null, group: '등급', scoreClass: 'sanbaiman' },
    { key: 'kazoe_yakuman', label: '헤아림역만', han: null, group: '등급', scoreClass: 'kazoe_yakuman' },

    // 역만
    { key: 'kokushi',         label: '국사무쌍',    han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'suuankou',        label: '스안커',      han: null, group: '역만', scoreClass: 'yakuman', winType: 'tsumo', note: '론이면 단기 대기여야 → 스안커 단기로' },
    { key: 'daisangen',       label: '대삼원',      han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'shousuushii',     label: '소사희',      han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'tsuiisou',        label: '자일색',      han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'ryuuiisou',       label: '녹일색',      han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'chinroutou',      label: '청노두',      han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'chuuren',         label: '구련보등',    han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'suukantsu',       label: '스깡즈',      han: null, group: '역만', scoreClass: 'yakuman' },
    { key: 'tenhou',          label: '천화',        han: null, group: '역만', scoreClass: 'yakuman', winType: 'tsumo' },
    { key: 'chiihou',         label: '지화',        han: null, group: '역만', scoreClass: 'yakuman', winType: 'tsumo' },

    // 더블역만 (1번: 추가)
    { key: 'daisuushii',         label: '대사희',         han: null, group: '더블역만', scoreClass: 'double_yakuman' },
    { key: 'kokushi_13',         label: '국사무쌍 13면',  han: null, group: '더블역만', scoreClass: 'double_yakuman' },
    { key: 'suuankou_tanki',     label: '스안커 단기',    han: null, group: '더블역만', scoreClass: 'double_yakuman' },
    { key: 'junsei_chuuren',     label: '순정 구련보등',  han: null, group: '더블역만', scoreClass: 'double_yakuman' },

    // 호환: 옛 키 (5번 분할 전 데이터 보존용 — 통계에는 잡히되 새 입력 화면에 안 보임)
    { key: 'yakuhai',    label: '역패(구)',     han: 1, group: '호환', deprecated: true },
    { key: 'sangenpai',  label: '삼원패(구)',   han: 1, group: '호환', deprecated: true },
];

// 그룹별로 묶기 (UI 렌더링용)
export const YAKU_BY_GROUP = YAKU_CATALOG.reduce((acc, y) => {
    if (!acc[y.group]) acc[y.group] = [];
    acc[y.group].push(y);
    return acc;
}, {});

// key → 정의
export const YAKU_MAP = Object.fromEntries(YAKU_CATALOG.map(y => [y.key, y]));

// label → 정의 (자유 텍스트 매칭용)
export const YAKU_LABEL_MAP = Object.fromEntries(YAKU_CATALOG.map(y => [y.label, y]));

// 카테고리 순서 (1번: 더블역만 추가)
export const YAKU_GROUPS = ['1판', '2판', '3판', '6판', '등급', '역만', '더블역만', '특수'];


// =====================================================================
// 役 충돌(상호 배타) 규칙
//   - 한 그룹의 役은 동시에 1개만 가능
//   - 핑허/치또이/탕야오는 양립 불가 役 목록이 별도
// =====================================================================
export const YAKU_EXCLUSIVE_GROUPS = [
    ['riichi', 'double_riichi'],          // 리치 / 더블리치
    ['iipeikou', 'ryanpeikou'],           // 이페코 / 량페코
    ['chanta', 'junchan'],                // 찬타 / 준찬타 (준찬타가 상위)
    ['honitsu', 'chinitsu'],              // 혼일색 / 청일색
    ['honroutou', 'chinroutou'],          // 혼노두 / 청노두
    ['shousangen', 'daisangen'],          // 소삼원 / 대삼원
    ['shousuushii', 'daisuushii'],        // 소사희 / 대사희
    ['haitei', 'houtei'],                 // 3번: 하이테이(쯔모) ↔ 호우테이(론)
    ['chuuren', 'junsei_chuuren'],        // 구련보등 / 순정 구련보등
    ['suuankou', 'suuankou_tanki'],       // 스안커 / 스안커 단기
    ['kokushi', 'kokushi_13'],            // 국사무쌍 / 국사 13면
];

// 핑허 양립 불가 (5번: yakuhai/sangenpai 키를 새 키들로 분리)
export const PINFU_INCOMPATIBLE = [
    'toitoi','sanankou','suuankou','sankantsu','suukantsu','sanshoku_doukou',
    'yakuhai_haku','yakuhai_hatsu','yakuhai_chun','yakuhai_seat','yakuhai_round',
    'shousangen','daisangen','shousuushii','daisuushii',
    'tsuiisou','chiitoitsu','honroutou','chinroutou','ryuuiisou','kokushi','kokushi_13','suuankou_tanki'
];

// 치또이 양립 불가
export const CHIITOITSU_INCOMPATIBLE = [
    'toitoi','iipeikou','ryanpeikou','sanankou','suuankou','sanshoku','ittsu',
    'chanta','junchan','sankantsu','suukantsu','sanshoku_doukou','pinfu',
    'kokushi','kokushi_13','chuuren','junsei_chuuren','suuankou_tanki'
];

// 탕야오 양립 불가 (자패·1·9 들어가는 役)
export const TANYAO_INCOMPATIBLE = [
    'yakuhai_haku','yakuhai_hatsu','yakuhai_chun','yakuhai_seat','yakuhai_round',
    'chanta','junchan','honroutou','chinroutou','tsuiisou',
    'shousangen','daisangen','shousuushii','daisuushii','kokushi','kokushi_13','ryuuiisou',
    'ittsu' // 일기통관(123/456/789) 은 1과 9 포함 → 탕야오 불가
];


// 2번: 론일 때 무효 役 / 쯔모일 때 무효 役 차단
//   yaku.winType: 'tsumo' 면 쯔모 시에만, 'ron' 이면 론 시에만 선택 가능
export function isYakuAllowedForWinType(yakuKey, winType) {
    const def = YAKU_MAP[yakuKey];
    if (!def || !def.winType) return true;  // 제약 없음
    return def.winType === winType;
}

// 주어진 winType 에서 무효인 役들을 자동으로 list 에서 제거
export function filterYakuByWinType(currentList, winType) {
    if (!winType) return { list: currentList, removed: [] };
    const removed = [];
    const list = currentList.filter(k => {
        if (isYakuAllowedForWinType(k, winType)) return true;
        removed.push(k);
        return false;
    });
    return { list, removed };
}


// 일발은 리치 없이는 불가 - 일발 토글 시 리치도 자동 포함
// 새 役을 토글할 때 충돌하는 기존 役을 자동 제거
// returns: { list, removed: string[] }
export function resolveYakuConflicts(newKey, currentList, winType = null) {
    // 이미 들어있으면 단순 제거 (충돌 검사 불필요)
    if (currentList.includes(newKey)) {
        return { list: currentList.filter(k => k !== newKey), removed: [] };
    }
    // 2번: winType 으로 무효면 자체 거부
    if (winType && !isYakuAllowedForWinType(newKey, winType)) {
        return { list: currentList, removed: [], rejected: newKey };
    }
    let updated = [...currentList, newKey];
    const removed = [];
    const drop = (k) => {
        if (updated.includes(k)) {
            updated = updated.filter(x => x !== k);
            removed.push(k);
        }
    };

    // 1) 상호 배타 그룹
    for (const grp of YAKU_EXCLUSIVE_GROUPS) {
        if (grp.includes(newKey)) {
            for (const k of grp) if (k !== newKey) drop(k);
        }
    }

    // 2) 핑허
    if (newKey === 'pinfu') {
        for (const k of PINFU_INCOMPATIBLE) drop(k);
    } else if (PINFU_INCOMPATIBLE.includes(newKey)) {
        drop('pinfu');
    }

    // 3) 치또이
    if (newKey === 'chiitoitsu') {
        for (const k of CHIITOITSU_INCOMPATIBLE) drop(k);
    } else if (CHIITOITSU_INCOMPATIBLE.includes(newKey)) {
        drop('chiitoitsu');
    }

    // 4) 탕야오
    if (newKey === 'tanyao') {
        for (const k of TANYAO_INCOMPATIBLE) drop(k);
    } else if (TANYAO_INCOMPATIBLE.includes(newKey)) {
        drop('tanyao');
    }

    // 5) 슌즈 役 그룹 ↔ 코쯔 役 그룹 (전체 cross 충돌)
    const SHUNTSU_HEAVY = ['sanshoku', 'ittsu', 'iipeikou', 'ryanpeikou'];
    const KOTSU_HEAVY   = ['toitoi', 'sanankou', 'suuankou', 'sankantsu', 'suukantsu', 'sanshoku_doukou'];
    if (KOTSU_HEAVY.includes(newKey)) {
        for (const k of SHUNTSU_HEAVY) drop(k);
    } else if (SHUNTSU_HEAVY.includes(newKey)) {
        for (const k of KOTSU_HEAVY) drop(k);
    }

    // 6) 슌즈 그룹 내 추가 충돌
    if (newKey === 'ittsu') {
        for (const k of ['sanshoku','iipeikou','ryanpeikou']) drop(k);
    } else if (['sanshoku','iipeikou','ryanpeikou'].includes(newKey)) {
        drop('ittsu');
    }
    if (newKey === 'sanshoku') drop('ryanpeikou');
    else if (newKey === 'ryanpeikou') drop('sanshoku');

    // 일발은 리치 동반 필수
    if (updated.includes('ippatsu') && !updated.includes('riichi')) {
        updated.push('riichi');
    }
    return { list: updated, removed };
}


// key 배열을 label 배열로
export function yakuLabels(keys) {
    return keys.map(k => YAKU_MAP[k]?.label || k);
}

