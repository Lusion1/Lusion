// =====================================================================
// 일본 마작 점수 계산 라이브러리 (ESM)
// =====================================================================
// 함수: calcScore({ isDealerWinner, winType, han, fu, scoreClass, honba })
//   - winType: 'tsumo' | 'ron'
//   - scoreClass: 'normal' | 'mangan' | 'haneman' | 'baiman' | 'sanbaiman'
//                 | 'yakuman' | 'double_yakuman' | 'triple_yakuman' | 'kazoe_yakuman'
//     'normal' 이면 han + fu 로 자동 판정, 만관 이상이면 그 등급 고정
// 반환: { total, fromDealer, fromNonDealer, scoreClass, text }
//   - total          : 화료자가 얻는 총점수
//   - fromDealer     : 자쯔모 시 친 1명에게서 받는 점수 (그 외는 0)
//   - fromNonDealer  : 쯔모 시 자(子) 1명에게서 받는 점수 (그 외는 0)
//   - scoreClass     : 최종 적용된 등급 ('normal' / 'mangan' / 'haneman' ...)
//   - text           : 표시용 문자열  "12000" / "4000all" / "2000/4000" 등
// =====================================================================

// 만관~삼배만~역만 등급별 base 점수 (base × 4 = 자 론 액)
const LIMIT_BASE = {
    mangan:         2000,
    haneman:        3000,
    baiman:         4000,
    sanbaiman:      6000,
    yakuman:        8000,
    kazoe_yakuman:  8000, // 헤아림역만 = 역만 동일
    double_yakuman: 16000,
    triple_yakuman: 24000,
};

const CLASS_LABEL = {
    normal:         '',
    mangan:         '만관',
    haneman:        '하네만',
    baiman:         '배만',
    sanbaiman:      '삼배만',
    yakuman:        '역만',
    kazoe_yakuman:  '헤아림역만',
    double_yakuman: '더블역만',
    triple_yakuman: '삼중역만',
};

function roundUp100(n) {
    return Math.ceil(n / 100) * 100;
}

// han + fu 로부터 등급 자동 판정 (만관 룰 포함)
export function classifyByHanFu(han, fu) {
    if (han >= 13) return 'kazoe_yakuman';
    if (han >= 11) return 'sanbaiman';
    if (han >= 8)  return 'baiman';
    if (han >= 6)  return 'haneman';
    if (han >= 5)  return 'mangan';
    if (han === 4 && fu >= 40) return 'mangan';
    if (han === 3 && fu >= 70) return 'mangan';
    return 'normal';
}

export function calcScore({ isDealerWinner = false, winType, han, fu, scoreClass, honba = 0 } = {}) {
    if (!['tsumo', 'ron'].includes(winType)) {
        throw new Error('winType 은 tsumo 또는 ron 이어야 합니다.');
    }

    let cls = (scoreClass && scoreClass !== 'normal') ? scoreClass : classifyByHanFu(Number(han) || 0, Number(fu) || 0);
    let base;

    if (cls === 'normal') {
        if (!han || !fu) throw new Error('일반 점수 계산에는 han / fu 가 필요합니다.');
        base = Math.min(fu * Math.pow(2, han + 2), LIMIT_BASE.mangan);
    } else {
        base = LIMIT_BASE[cls];
        if (!base) throw new Error('알 수 없는 scoreClass: ' + cls);
    }

    const h = Number(honba) || 0;

    if (winType === 'ron') {
        const mult = isDealerWinner ? 6 : 4;
        const total = roundUp100(base * mult) + h * 300;
        return {
            total,
            fromDealer: 0,
            fromNonDealer: 0,
            scoreClass: cls,
            text: String(total),
        };
    }

    // 쯔모
    if (isDealerWinner) {
        // 친 쯔모: 자 3명에게서 base×2씩
        const fromND = roundUp100(base * 2) + h * 100;
        const total = fromND * 3;
        return {
            total,
            fromDealer: 0,
            fromNonDealer: fromND,
            scoreClass: cls,
            text: `${fromND}all`,
        };
    } else {
        // 자 쯔모: 친에게서 base×2, 자(子) 2명에게서 base×1 씩
        const fromD  = roundUp100(base * 2) + h * 100;
        const fromND = roundUp100(base * 1) + h * 100;
        const total  = fromD + fromND * 2;
        return {
            total,
            fromDealer: fromD,
            fromNonDealer: fromND,
            scoreClass: cls,
            text: `${fromND}/${fromD}`,
        };
    }
}

// 등급 한글명
export function classLabel(scoreClass) {
    return CLASS_LABEL[scoreClass] || '';
}

// 한·부 텍스트 (예: "3판30부", "만관", "하네만")
export function hanFuLabel({ han, fu, scoreClass }) {
    if (scoreClass && scoreClass !== 'normal') return CLASS_LABEL[scoreClass] || '';
    if (han && fu) return `${han}판${fu}부`;
    return '';
}

// =====================================================================
// 한 round(반장전) 점수 자동 누적 계산
//   - players: [{wind:'동', name:'김종호'}, ...] 4명
//   - hands  : 입력된 hand 배열 (hand_number 순서 권장)
//   - opts.startScore (기본 25000)
//
//   반환: {
//     scores: {name: finalScore},
//     riichiPool: 마지막 국 종료 후 남은 리치봉 (다음 round 이월)
//     perHand: [{ handNumber, scores, riichiPool }, ...]
//     errors: 계산 중 발생한 경고
//   }
// =====================================================================
export function calcRoundResult(players, hands, opts = {}) {
    const { startScore = 25000 } = opts;

    const scores = {};
    for (const p of players) {
        if (p && p.name) scores[p.name] = startScore;
    }
    let riichiPool = 0;
    const perHand = [];
    const errors = [];

    const windField = { '동': 'tenpai_e', '남': 'tenpai_s', '서': 'tenpai_w', '북': 'tenpai_n' };

    const DEALER_WINDS = ['동', '남', '서', '북'];

    // hand_number 별로 그룹화 (더블론/트리플론 = 같은 hand_number 의 row 2~3개)
    const groups = {};
    const order = [];
    for (const h of hands) {
        if (!h || !h.win_type) continue;
        const key = h.hand_number;
        if (!(key in groups)) { groups[key] = []; order.push(key); }
        groups[key].push(h);
    }
    for (const key of order) {
        const grp = groups[key];
        const h = grp[0]; // 메타데이터는 첫 row 사용

        // 친 자리: hand_round_num 으로 결정 (동1국=동 친, 동2국=남 친, 동3국=서 친, 동4국=북 친)
        const dealerWindForRound = DEALER_WINDS[(Number(h.hand_round_num) || 1) - 1] || '동';
        const dealerPlayer = players.find(p => p.wind === dealerWindForRound);
        const isDealerWinner = dealerPlayer && dealerPlayer.name === h.winner_name;

        if (h.win_type === 'abortion') {
            // 도중 유국 (구종구패/사풍연타/사깡산료): 점수 변동 없음.
            // 사가리치 만 모든 자리 -1000, 리치봉 풀로 누적 후 다음 국으로 이월.
            if (h.abortion_type === 'suucha_riichi') {
                for (const p of players) {
                    if (!p || !p.name) continue;
                    scores[p.name] = (scores[p.name] || 0) - 1000;
                    riichiPool += 1000;
                }
            }
            // 그 외는 점수 무변동, 리치봉도 그대로 (이월)
        } else if (h.win_type === 'chombo') {
            // 촌보: 다른 3명에게 각 3000 씩 배상 (촌보자 -9000)
            const chomboName = h.chombo_player;
            if (chomboName && scores[chomboName] != null) {
                scores[chomboName] = (scores[chomboName] || 0) - 9000;
                for (const p of players) {
                    if (!p || !p.name || p.name === chomboName) continue;
                    scores[p.name] = (scores[p.name] || 0) + 3000;
                }
            }
        } else if (h.win_type === 'draw') {
            // 유국이라도 리치한 자리 사람은 -1000, 리치봉 풀에 +1000 (이월)
            const riichiSeats2 = { '동': h.riichi_e, '남': h.riichi_s, '서': h.riichi_w, '북': h.riichi_n };
            for (const p of players) {
                if (!p || !p.name) continue;
                if (riichiSeats2[p.wind]) {
                    scores[p.name] = (scores[p.name] || 0) - 1000;
                    riichiPool += 1000;
                }
            }
            const tenpai = [];
            const noten  = [];
            for (const p of players) {
                if (!p || !p.name) continue;
                if (h[windField[p.wind]]) tenpai.push(p);
                else noten.push(p);
            }
            if (tenpai.length > 0 && noten.length > 0) {
                const pay  = 3000 / noten.length;
                const gain = 3000 / tenpai.length;
                for (const p of noten)  scores[p.name] = (scores[p.name] || 0) - pay;
                for (const p of tenpai) scores[p.name] = (scores[p.name] || 0) + gain;
            }
            // === 유국만관 처리 (자리별) ===
            // 자=8000(친에서 4000, 자에서 2000×2), 친=12000(자 3명에서 4000씩)
            const nagashiSeats = { '동': h.nagashi_e, '남': h.nagashi_s, '서': h.nagashi_w, '북': h.nagashi_n };
            for (const p of players) {
                if (!p || !p.name) continue;
                if (!nagashiSeats[p.wind]) continue;
                const isP_Dealer = p.wind === dealerWindForRound;
                if (isP_Dealer) {
                    scores[p.name] = (scores[p.name] || 0) + 12000;
                    for (const o of players) {
                        if (!o || !o.name || o.name === p.name) continue;
                        scores[o.name] = (scores[o.name] || 0) - 4000;
                    }
                } else {
                    scores[p.name] = (scores[p.name] || 0) + 8000;
                    for (const o of players) {
                        if (!o || !o.name || o.name === p.name) continue;
                        if (o.wind === dealerWindForRound) scores[o.name] = (scores[o.name] || 0) - 4000;
                        else                                scores[o.name] = (scores[o.name] || 0) - 2000;
                    }
                }
            }
            // 리치봉은 다음 국으로 이월 (변화 없음)
        } else if (h.win_type === 'tsumo' || h.win_type === 'ron') {
            // === 리치봉 차감 (그룹의 첫 row 만으로 처리) ===
            const riichiSeats = { '동': h.riichi_e, '남': h.riichi_s, '서': h.riichi_w, '북': h.riichi_n };
            let anySeatRiichi = false;
            for (const p of players) {
                if (!p || !p.name) continue;
                if (riichiSeats[p.wind]) {
                    scores[p.name] = (scores[p.name] || 0) - 1000;
                    riichiPool += 1000;
                    anySeatRiichi = true;
                }
            }
            if (!anySeatRiichi && h.is_riichi && h.winner_name && scores[h.winner_name] != null) {
                scores[h.winner_name] -= 1000;
                riichiPool += 1000;
            }

            // === 각 화료자별 점수 계산 ===
            // 더블/트리플론 = grp.length >= 2 (ron 다수)
            const isMulti = grp.length >= 2;
            const dealInName = h.deal_in_name; // 같은 hand 내 방총자는 동일
            // 下家 우선 리치봉: 방총자 다음 자리(반시계 동→남→서→북→동) 부터 화료자 검색
            let riichiReceiver = null;
            if (isMulti && dealInName) {
                const dealInSeat = players.find(p => p.name === dealInName);
                if (dealInSeat) {
                    const orderArr = ['동','남','서','북'];
                    const start = orderArr.indexOf(dealInSeat.wind);
                    for (let off = 1; off < 4; off++) {
                        const w = orderArr[(start + off) % 4];
                        const cand = grp.find(g => {
                            const ws = players.find(p => p.name === g.winner_name);
                            return ws && ws.wind === w;
                        });
                        if (cand) { riichiReceiver = cand.winner_name; break; }
                    }
                }
            } else if (grp.length === 1) {
                riichiReceiver = h.winner_name;
            }

            for (const gh of grp) {
                const ghDealerWinner = (() => {
                    const ws = players.find(p => p.name === gh.winner_name);
                    return ws && ws.wind === dealerWindForRound;
                })();
                try {
                    const hasClass = gh.score_class && gh.score_class !== 'normal';
                    const ghHan = gh.han ? parseInt(gh.han) : 0;
                    if (!hasClass && !(gh.han && gh.fu) && ghHan < 5) {
                        errors.push(`${gh.hand_number || '?'}국 (${gh.winner_name}): 한·부/등급 미입력`);
                        continue;
                    }
                    const calc = calcScore({
                        isDealerWinner: ghDealerWinner,
                        winType: gh.win_type,
                        han: gh.han ? parseInt(gh.han) : undefined,
                        fu:  gh.fu  ? parseInt(gh.fu)  : undefined,
                        scoreClass: gh.score_class,
                        // 룰 B: 더블론 시 본장료(혼바료)는 방총자의 下家 우선 화료자(=riichiReceiver) 1명만 수령
                        honba: (isMulti && gh.winner_name !== riichiReceiver) ? 0 : (parseInt(gh.honba) || 0),
                    });

                    if (gh.win_type === 'ron') {
                        // 화료자 = +total (리치봉은 별도)
                        if (gh.winner_name) scores[gh.winner_name] = (scores[gh.winner_name] || 0) + calc.total;
                        // 방총자 차감
                        if (dealInName) scores[dealInName] = (scores[dealInName] || 0) - calc.total;
                    } else { // tsumo (단일만 가능)
                        if (gh.winner_name) scores[gh.winner_name] = (scores[gh.winner_name] || 0) + calc.total;
                        if (ghDealerWinner) {
                            for (const p of players) {
                                if (!p || !p.name || p.name === gh.winner_name) continue;
                                scores[p.name] = (scores[p.name] || 0) - calc.fromNonDealer;
                            }
                        } else {
                            for (const p of players) {
                                if (!p || !p.name || p.name === gh.winner_name) continue;
                                if (p.wind === dealerWindForRound) scores[p.name] = (scores[p.name] || 0) - calc.fromDealer;
                                else                                scores[p.name] = (scores[p.name] || 0) - calc.fromNonDealer;
                            }
                        }
                    }
                } catch (e) {
                    errors.push(`${gh.hand_number || '?'}국 (${gh.winner_name}): ${e.message}`);
                }
            }

            // 리치봉 회수 (가장 가까운 화료자 1명)
            if (riichiReceiver && scores[riichiReceiver] != null) {
                scores[riichiReceiver] += riichiPool;
            }
            riichiPool = 0;
        }

        perHand.push({ handNumber: h.hand_number, scores: { ...scores }, riichiPool });
    }

    return { scores, riichiPool, perHand, errors };
}


// =====================================================================
// 각 플레이어가 hands 안에서 만관/하네만/... 을 몇 번 화료했는지 집계
// 반환: { playerName: { mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman } }
// =====================================================================
export function calcClassCounts(players, hands) {
    const counts = {};
    for (const p of players) {
        if (p && p.name) {
            counts[p.name] = {
                mangan: 0, haneman: 0, baiman: 0, sanbaiman: 0,
                yakuman: 0, kazoeyakuman: 0, doubleyakuman: 0,
            };
        }
    }
    for (const h of (hands || [])) {
        if (!h || h.win_type === 'draw' || !h.winner_name) continue;
        if (!counts[h.winner_name]) continue;

        let cls = h.score_class && h.score_class !== 'normal' ? h.score_class : null;
        if (!cls && h.han && h.fu) {
            cls = classifyByHanFu(parseInt(h.han), parseInt(h.fu));
            if (cls === 'normal') cls = null;
        }
        if (!cls) continue;

        switch (cls) {
            case 'mangan':         counts[h.winner_name].mangan++; break;
            case 'haneman':        counts[h.winner_name].haneman++; break;
            case 'baiman':         counts[h.winner_name].baiman++; break;
            case 'sanbaiman':      counts[h.winner_name].sanbaiman++; break;
            case 'yakuman':        counts[h.winner_name].yakuman++; break;
            case 'kazoe_yakuman':  counts[h.winner_name].kazoeyakuman++; break;
            case 'double_yakuman':
            case 'triple_yakuman': counts[h.winner_name].doubleyakuman++; break;
        }
    }
    return counts;
}
