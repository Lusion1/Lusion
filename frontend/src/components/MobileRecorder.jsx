import React, { useState, useMemo, useEffect } from 'react';
import { calcScore, calcRoundResult, calcClassCounts, classLabel } from '../lib/score.js';
import { YAKU_BY_GROUP, YAKU_GROUPS, YAKU_MAP, resolveYakuConflicts, yakuLabels, isYakuAllowedForWinType, filterYakuByWinType } from '../lib/yaku.js';

const DEALER_WINDS = ['동', '남', '서', '북'];
const WIND_TO_FIELD = { '동': 'e', '남': 's', '서': 'w', '북': 'n' };

const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 다음 hand 의 풍/순번 결정
//   - 직전 hand 가 친 화료 + 본장 유지면 본장 +1 (같은 풍·순번)
//   - 직전 hand 가 자 화료면 다음 풍/순번
//   - 직전 hand 가 유국이면 본장 +1 (같은 풍·순번)
function computeNextHandMeta(hands, multiRonMode = false) {
    if (hands.length === 0) {
        return { hand_number: 1, hand_wind: '동', hand_round_num: 1, honba: 0 };
    }
    const last = hands[hands.length - 1];
    // 더블론 모드 + 직전 ron 이면 같은 hand 유지 (다음 화료자 카드 탭 대기)
    if (multiRonMode && last.win_type === 'ron') {
        return {
            hand_number: last.hand_number,
            hand_wind: last.hand_wind,
            hand_round_num: last.hand_round_num,
            honba: last.honba || 0,
        };
    }
    const lastGroup = hands.filter(h => h.hand_number === last.hand_number);
    const WIND_FIELD = { '동': 'tenpai_e', '남': 'tenpai_s', '서': 'tenpai_w', '북': 'tenpai_n' };
    const dealerWind = DEALER_WINDS[(last.hand_round_num || 1) - 1];

    let isDealerKeep;
    if (last.win_type === 'abortion' || last.win_type === 'chombo' || last.win_type === 'late_penalty') {
        // 도중 유국 / 촌보 / 지각 패널티: 항상 친 유지 (본장 +1 또는 그대로)
        isDealerKeep = true;
    } else if (last.win_type === 'draw') {
        // 유국만관 우선 처리
        const NAGASHI = { '동': 'nagashi_e', '남': 'nagashi_s', '서': 'nagashi_w', '북': 'nagashi_n' };
        const anyNagashi = ['동','남','서','북'].some(w => last[NAGASHI[w]]);
        if (anyNagashi) {
            // 친 자리가 유국만관이면 친 유지, 자 자리가 유국만관이면 친 회전(텐파이 무관)
            isDealerKeep = !!last[NAGASHI[dealerWind]];
        } else {
            // 일반 유국: 친 텐파이면 유지, 노텐이면 회전
            isDealerKeep = !!last[WIND_FIELD[dealerWind]];
        }
    } else if (lastGroup.some(h => h.winner_name)) {
        // 더블/트리플론 대응: 그룹 내 화료자 중 친 자리 사람 있으면 친 유지
        isDealerKeep = lastGroup.some(h => h._winnerWind === dealerWind);
    } else {
        isDealerKeep = false;
    }

    if (isDealerKeep) {
        // 같은 국 유지. 촌보/지각 패널티는 본장 안 늘림, 그 외는 +1
        const keptHonba = (last.win_type === 'chombo' || last.win_type === 'late_penalty')
            ? (last.honba || 0)
            : (last.honba || 0) + 1;
        return {
            hand_number: last.hand_number + 1,
            hand_wind: last.hand_wind,
            hand_round_num: last.hand_round_num,
            honba: keptHonba,
        };
    }

    // 다음 친 자리로 진행
    let nextRound = (last.hand_round_num || 1) + 1;
    let nextWind = last.hand_wind;
    if (nextRound > 4) {
        nextRound = 1;
        nextWind = last.hand_wind === '동' ? '남' : '서';
    }
    // 유국/도중유국 후 친 노텐으로 다음 국 가는 경우도 본장 +1 (촌보는 제외)
    const nextHonba = ['draw','abortion'].includes(last.win_type) ? (last.honba || 0) + 1 : 0;
    return {
        hand_number: last.hand_number + 1,
        hand_wind: nextWind,
        hand_round_num: nextRound,
        honba: nextHonba,
    };
}

export default function MobileRecorder({ players, authToken, onClose, onSaved }) {
    const [step, setStep] = useState('setup'); // 'setup' | 'play' | 'done'
    const [date, setDate] = useState(getTodayString());
    const [seats, setSeats] = useState([
        { wind: '동', name: '' },
        { wind: '남', name: '' },
        { wind: '서', name: '' },
        { wind: '북', name: '' },
    ]);
    const [hands, setHands] = useState([]);
    const [editingHand, setEditingHand] = useState(null); // { mode, winnerWind?, lockedDealIn, isMultiRon, editIndex, draft }
    const [activeYakuGroup, setActiveYakuGroup] = useState('1판');
    const [yakuConflictMsg, setYakuConflictMsg] = useState('');
    const [multiRonMode, setMultiRonMode] = useState(false);
    const [pendingRiichi, setPendingRiichi] = useState({ e: false, s: false, w: false, n: false });
    const [suuchaConfirm, setSuuchaConfirm] = useState(false);
    const [showFuGuide, setShowFuGuide] = useState(false); // 부수 계산 안내 펼침 상태
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 8번: 브라우저 임시저장 (localStorage)
    const DRAFT_KEY = 'mahjong_draft_v1';
    const [restorePrompt, setRestorePrompt] = useState(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.hands) && data.hands.length > 0 && Array.isArray(data.seats)) {
                setRestorePrompt(data);
            }
        } catch {}
    }, []);

    useEffect(() => {
        if (step !== 'play') return;
        if (!hands || hands.length === 0) return;
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                date, seats, hands, multiRonMode, pendingRiichi, savedAt: new Date().toISOString(),
            }));
        } catch {}
    }, [step, date, seats, hands, multiRonMode, pendingRiichi]);

    // 4명 모두 리치 토글 시 사가리치 확인 모달 자동 표시
    useEffect(() => {
        const all4 = pendingRiichi.e && pendingRiichi.s && pendingRiichi.w && pendingRiichi.n;
        if (all4) setSuuchaConfirm(true);
    }, [pendingRiichi]);

    const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

    const acceptRestore = () => {
        if (!restorePrompt) return;
        setDate(restorePrompt.date || getTodayString());
        setSeats(restorePrompt.seats);
        setHands(restorePrompt.hands);
        setMultiRonMode(!!restorePrompt.multiRonMode);
        if (restorePrompt.pendingRiichi) setPendingRiichi(restorePrompt.pendingRiichi);
        setStep('play');
        setRestorePrompt(null);
    };
    const rejectRestore = () => { clearDraft(); setRestorePrompt(null); };

    const seatPlayers = seats.map(s => ({ wind: s.wind, name: s.name }));

    // 자동 누적 점수
    const autoResult = useMemo(() => {
        try {
            return calcRoundResult(seatPlayers, hands);
        } catch { return { scores: {}, riichiPool: 0, perHand: [], errors: [] }; }
    }, [seatPlayers, hands]);

    // ===== Step 1: 자리 배정 =====
    const renderSetup = () => {
        const allFilled = seats.every(s => s.name);
        const duplicates = new Set(seats.map(s => s.name).filter(Boolean)).size !== seats.filter(s => s.name).length;
        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold text-slate-800">🀄 대국 시작</h2>
                <div>
                    <label className="text-sm font-bold text-slate-700">날짜</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 p-3 border-2 border-slate-200 rounded-lg bg-slate-50" />
                </div>
                <div>
                    <label className="text-sm font-bold text-slate-700">자리 배정</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        {seats.map((s, idx) => (
                            <div key={s.wind} className="bg-white border-2 border-slate-200 rounded-xl p-3">
                                <div className="text-center text-lg font-black text-slate-800 mb-2">{s.wind}{idx === 0 && <span className="text-xs text-orange-500 ml-1">(시작 친)</span>}</div>
                                <select value={s.name} onChange={e => setSeats(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))} className="w-full p-2 border border-slate-300 rounded">
                                    <option value="">선택...</option>
                                    {players.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                    {duplicates && <div className="text-xs text-red-500 mt-2">⚠ 중복된 멤버가 있습니다</div>}
                </div>
                <div className="flex gap-2 pt-2">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold">닫기</button>
                    <button
                        disabled={!allFilled || duplicates}
                        onClick={() => setStep('play')}
                        className={'flex-1 py-3 rounded-lg font-bold ' + (allFilled && !duplicates ? 'bg-orange-500 text-white' : 'bg-slate-300 text-slate-500')}
                    >
                        대국 시작
                    </button>
                </div>
            </div>
        );
    };

    // ===== Step 2: 진행 화면 =====
    const meta = computeNextHandMeta(hands, multiRonMode);
    const dealerWindNow = DEALER_WINDS[(meta.hand_round_num || 1) - 1];

    const openHand = (winnerWind) => {
        const negList = seats
            .filter(p => p.name && (autoResult.scores[p.name] || 0) < 0)
            .map(p => `${p.wind} ${p.name} (${Math.round(autoResult.scores[p.name])})`);
        if (negList.length > 0) {
            const msg = '⚠ 토비(마이너스) 발생: ' + negList.join(', ') + '\n룰에 따라 보통 여기서 경기 종료입니다. 그래도 다음 국을 계속 진행하시겠습니까?';
            if (!window.confirm(msg)) return;
        }
        let handNum = meta.hand_number;
        let lockedDealIn = null;
        let isMultiRon = false;
        if (multiRonMode && winnerWind && hands.length > 0) {
            const last = hands[hands.length - 1];
            const sameMeta = last.hand_wind === meta.hand_wind && last.hand_round_num === meta.hand_round_num && (last.honba || 0) === (meta.honba || 0);
            if (sameMeta && last.win_type === 'ron') {
                handNum = last.hand_number;
                lockedDealIn = last.deal_in_name;
                isMultiRon = true;
            }
        }
        setEditingHand({
            mode: winnerWind ? 'win' : 'draw',
            winnerWind,
            lockedDealIn,
            isMultiRon,
            editIndex: null,
            draft: {
                hand_number: handNum,
                hand_wind: meta.hand_wind,
                hand_round_num: meta.hand_round_num,
                honba: meta.honba,
                win_type: lockedDealIn ? 'ron' : (winnerWind ? '' : 'draw'),
                winner_name: winnerWind ? (seats.find(s => s.wind === winnerWind)?.name || '') : null,
                deal_in_name: lockedDealIn || '',
                han: null,
                fu: null,
                score_class: null,
                is_riichi: false,
                is_ippatsu: false,
                dora_count: 0,
                aka_dora_count: 0,
                ura_dora_count: 0,
                yaku_list: (winnerWind && pendingRiichi[WIND_TO_FIELD[winnerWind]]) ? ['riichi'] : [],
                yaku_text: '',
                riichi_e: pendingRiichi.e, riichi_s: pendingRiichi.s, riichi_w: pendingRiichi.w, riichi_n: pendingRiichi.n,
                tenpai_e: false, tenpai_s: false, tenpai_w: false, tenpai_n: false,
                nagashi_e: false, nagashi_s: false, nagashi_w: false, nagashi_n: false,
                // 손패 형태(멘젠/후로) 초기값:
                //   리치 자리는 후로 불가(=멘젠 한정 役)이므로 자동 멘젠(false)
                //   그 외에는 null(미선택) — 사용자가 명시적으로 멘젠/후로 선택해야 함
                is_furo: (winnerWind && pendingRiichi[WIND_TO_FIELD[winnerWind]]) ? false : null,
                _winnerWind: winnerWind,
            }
        });
    };

    const ABORTION_LABELS = { kyuushu: '구종구패', sufon: '사풍연타', suucha_riichi: '사가리치', suukantsu: '사깡산료' };
    const recordAbortion = (abortionType) => {
        if (!window.confirm(`${ABORTION_LABELS[abortionType]} 으로 처리할까요? (점수 ${abortionType === 'suucha_riichi' ? '4명 -1000' : '변동 없음'}, 본장 +1, 친 유지)`)) return;
        setHands(prev => [...prev, {
            hand_number: meta.hand_number,
            hand_wind: meta.hand_wind,
            hand_round_num: meta.hand_round_num,
            honba: meta.honba,
            win_type: 'abortion',
            abortion_type: abortionType,
            winner_name: null,
            deal_in_name: null,
            riichi_e: abortionType === 'suucha_riichi',
            riichi_s: abortionType === 'suucha_riichi',
            riichi_w: abortionType === 'suucha_riichi',
            riichi_n: abortionType === 'suucha_riichi',
        }]);
        if (abortionType === 'suucha_riichi') {
            setPendingRiichi({ e: false, s: false, w: false, n: false });
        }
    };
    const recordNagashi = () => {
        const names = seats.filter(s => s.name).map(s => s.name);
        if (names.length === 0) return;
        const choice = window.prompt('유국만관 자리의 이름을 정확히 입력하세요 (1명):\n' + names.join(' / '));
        if (!choice) return;
        const nagashiName = choice.trim();
        if (!names.includes(nagashiName)) {
            alert('해당 이름이 자리에 없습니다.');
            return;
        }
        const seat = seats.find(s => s.name === nagashiName);
        const dealerWind = DEALER_WINDS[(meta.hand_round_num || 1) - 1];
        const isDealer = seat.wind === dealerWind;
        const desc = isDealer ? '친 유국만관 → 본인 +12,000, 자 3명 −4,000' : '자 유국만관 → 본인 +8,000, 친 −4,000, 자 2명 −2,000';
        if (!window.confirm(`유국만관: ${nagashiName} (${seat.wind})\n${desc}\n친 회전: ${isDealer ? '친 유지' : '친 넘어감'}. 진행할까요?`)) return;
        setHands(prev => [...prev, {
            hand_number: meta.hand_number,
            hand_wind: meta.hand_wind,
            hand_round_num: meta.hand_round_num,
            honba: meta.honba,
            win_type: 'draw',
            winner_name: null,
            deal_in_name: null,
            tenpai_e: false, tenpai_s: false, tenpai_w: false, tenpai_n: false,
            riichi_e: false, riichi_s: false, riichi_w: false, riichi_n: false,
            nagashi_e: seat.wind === '동',
            nagashi_s: seat.wind === '남',
            nagashi_w: seat.wind === '서',
            nagashi_n: seat.wind === '북',
        }]);
    };

    const recordChombo = () => {
        const names = seats.filter(s => s.name).map(s => s.name);
        if (names.length === 0) return;
        const choice = window.prompt('촌보한 사람 이름을 정확히 입력하세요:\n' + names.join(' / '));
        if (!choice) return;
        if (!names.includes(choice.trim())) {
            alert('해당 이름이 자리에 없습니다.');
            return;
        }
        const chomboName = choice.trim();
        if (!window.confirm(`촌보: ${chomboName} 가(이) 다른 3명에게 각 +3,000 배상 (촌보자 −9,000). 본장 그대로, 친 유지. 진행할까요?`)) return;
        setHands(prev => [...prev, {
            hand_number: meta.hand_number,
            hand_wind: meta.hand_wind,
            hand_round_num: meta.hand_round_num,
            honba: meta.honba,
            win_type: 'chombo',
            chombo_player: chomboName,
            winner_name: null,
            deal_in_name: null,
        }]);
    };

    // === 지각 패널티 ===
    // 1명당 분배 점수(100 단위)를 입력하면 지각자 -(N×3), 나머지 3명 각 +N
    // 여러 명 지각이면 콤마 구분 입력 → 각 지각자별 hand 1개씩 추가
    const recordLatePenalty = () => {
        const names = seats.filter(s => s.name).map(s => s.name);
        if (names.length === 0) return;
        const choice = window.prompt(
            '지각한 사람 이름을 입력하세요 (여러 명은 콤마로 구분):\n' + names.join(' / ')
        );
        if (!choice) return;
        const lateNames = choice.split(',').map(s => s.trim()).filter(Boolean);
        if (lateNames.length === 0) return;
        // 자리에 없는 이름 검증
        const invalidNames = lateNames.filter(n => !names.includes(n));
        if (invalidNames.length > 0) {
            alert('자리에 없는 이름: ' + invalidNames.join(', '));
            return;
        }
        // 중복 제거
        const uniqueLateNames = [...new Set(lateNames)];
        if (uniqueLateNames.length >= names.length) {
            alert('지각자가 모든 인원이 될 수는 없습니다.');
            return;
        }
        const scoreStr = window.prompt(
            '1명당 분배 점수를 입력하세요 (100 단위, 예: 100, 200, 500)\n' +
            '입력값 만큼 다른 3명에게 각각 지급되고 지각자는 ×3 만큼 차감됩니다.'
        );
        if (!scoreStr) return;
        const perPerson = parseInt(scoreStr);
        if (!perPerson || perPerson <= 0) { alert('양수를 입력해주세요.'); return; }
        if (perPerson % 100 !== 0) { alert('100 단위로 입력해주세요.'); return; }
        const totalDeduct = perPerson * 3;
        const desc = uniqueLateNames
            .map(n => `${n}: −${totalDeduct.toLocaleString()}`)
            .join(', ');
        if (!window.confirm(
            `지각 패널티 처리\n${desc}\n나머지 인원 각 +${perPerson.toLocaleString()}점 (각 지각자별 분배)\n본장 그대로, 친 유지. 진행할까요?`
        )) return;
        // 각 지각자별 hand 1개씩 추가 (같은 hand_number, multi_index 1, 2, 3...)
        setHands(prev => {
            const baseHand = meta.hand_number;
            const newHands = uniqueLateNames.map((n, idx) => ({
                hand_number: baseHand + idx, // 각 지각을 별도 hand 로 (calcNextMeta 가 친 유지 처리)
                hand_wind: meta.hand_wind,
                hand_round_num: meta.hand_round_num,
                honba: meta.honba,
                win_type: 'late_penalty',
                late_player: n,
                late_penalty: perPerson,
                winner_name: null,
                deal_in_name: null,
            }));
            return [...prev, ...newHands];
        });
    };

    const undoLastHand = () => {
        if (hands.length === 0) return;
        if (window.confirm('마지막 국 기록을 되돌리시겠습니까?')) {
            setHands(prev => prev.slice(0, -1));
        }
    };

    // 기존 hand 를 모달에 불러와 수정 모드로 진입
    const openHandForEdit = (index) => {
        const h = hands[index];
        if (!h) return;
        if (h.win_type === 'abortion' || h.win_type === 'chombo' || h.win_type === 'late_penalty') {
            alert('도중유국/촌보/지각은 수정 불가합니다. 🗑 삭제 후 재기록해주세요.');
            return;
        }
        const winnerSeat = h.winner_name ? seats.find(s => s.name === h.winner_name) : null;
        const winnerWind = winnerSeat?.wind || h._winnerWind || null;
        const groupRonCount = hands.filter(g => g.hand_number === h.hand_number && g.win_type === 'ron').length;
        const isMultiRon = groupRonCount >= 2;
        setEditingHand({
            mode: h.win_type === 'draw' ? 'draw' : 'win',
            winnerWind: h.win_type === 'draw' ? null : winnerWind,
            lockedDealIn: isMultiRon ? (h.deal_in_name || null) : null,
            isMultiRon,
            editIndex: index,
            draft: { ...h, _winnerWind: winnerWind },
        });
    };

    // 단일 또는 더블론 그룹 hand 삭제
    const deleteHand = (index) => {
        const h = hands[index];
        if (!h) return;
        const groupIdx = hands
            .map((g, i) => ({ g, i }))
            .filter(({ g }) => g.hand_number === h.hand_number && g.win_type === 'ron')
            .map(({ i }) => i);
        const isMultiRonRow = h.win_type === 'ron' && groupIdx.length >= 2;
        if (isMultiRonRow) {
            if (!window.confirm(`이 hand 는 더블론(${groupIdx.length}명 화료)입니다.\n같은 국의 화료자 ${groupIdx.length}명 기록이 모두 함께 삭제됩니다. 계속할까요?`)) return;
            setHands(prev => prev.filter((_, i) => !groupIdx.includes(i)));
        } else {
            const isLast = index === hands.length - 1;
            const msg = isLast
                ? '이 hand 기록을 삭제할까요?'
                : '이 hand 를 삭제할까요?\n주의: 뒤 국의 본장/풍은 자동 조정되지 않고 그대로 유지됩니다.';
            if (!window.confirm(msg)) return;
            setHands(prev => prev.filter((_, i) => i !== index));
        }
    };

    const finishGame = async () => {
        if (hands.length === 0) {
            alert('입력된 국이 없습니다.');
            return;
        }
        setStep('done');
    };

    const renderPlay = () => {
        const orderedSeats = ['동', '남', '서', '북'].map(w => seats.find(s => s.wind === w));
        return (
            <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="text-lg font-black text-slate-900">
                        ▶ {meta.hand_wind}{meta.hand_round_num}국
                        {meta.honba > 0 && <span className="ml-1 text-orange-500">{meta.honba}본장</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                        리치봉 {autoResult.riichiPool + (Object.values(pendingRiichi).filter(Boolean).length * 1000)}
                        {Object.values(pendingRiichi).some(Boolean) && <span className="ml-1 text-amber-600">(미반영 +{Object.values(pendingRiichi).filter(Boolean).length * 1000})</span>}
                          ·  완료 {hands.length}국
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {orderedSeats.map(s => {
                        const isDealer = s.wind === dealerWindNow;
                        const baseScore = autoResult.scores[s.name] != null ? Math.round(autoResult.scores[s.name]) : 25000;
                        const pendingDeduct = pendingRiichi[WIND_TO_FIELD[s.wind]] ? 1000 : 0;
                        const score = baseScore - pendingDeduct;
                        const isPending = pendingDeduct > 0;
                        return (
                            <button
                                key={s.wind}
                                onClick={() => openHand(s.wind)}
                                className={'p-4 rounded-xl border-2 text-left transition active:scale-95 ' + (isDealer ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50')}
                            >
                                <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                    <span>{s.wind} {isDealer && <span className="text-orange-600">친</span>}</span>
                                    {isPending && <span className="ml-auto px-1 py-0.5 bg-amber-500 text-white rounded text-[9px] font-bold">R</span>}
                                </div>
                                <div className="text-lg font-black text-slate-800 truncate">{s.name}</div>
                                <div className={'text-xl font-mono font-bold mt-1 ' + (isPending ? 'text-amber-600' : (score >= 25000 ? 'text-green-600' : 'text-red-500'))}>
                                    {score.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">{isPending ? '리치 미반영 −1,000' : '탭 = 이 사람 화료'}</div>
                            </button>
                        );
                    })}
                </div>

                {/* 리치 표시 (옵션 B - 카드 아래 별도 행, hand 입력 시 자동 반영) */}
                <div className="bg-white border-2 border-amber-200 rounded-lg p-2">
                    <div className="text-xs font-bold text-amber-800 mb-1.5 flex items-center justify-between">
                        <span>🔔 리치 표시 <span className="font-normal text-amber-600 text-[10px]">(미반영 — 화료/유국 시 자동 적용)</span></span>
                        {Object.values(pendingRiichi).some(Boolean) && (
                            <button type="button" onClick={() => setPendingRiichi({ e: false, s: false, w: false, n: false })} className="text-[10px] text-slate-500 underline">모두 해제</button>
                        )}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                        {['동','남','서','북'].map(w => {
                            const field = WIND_TO_FIELD[w];
                            const isOn = pendingRiichi[field];
                            const seat = seats.find(s => s.wind === w);
                            return (
                                <button
                                    key={w}
                                    type="button"
                                    onClick={() => setPendingRiichi(prev => ({ ...prev, [field]: !prev[field] }))}
                                    className={'py-1.5 rounded-lg text-xs font-bold border-2 transition active:scale-95 ' + (isOn ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200')}
                                >
                                    <div className="leading-tight">{w}</div>
                                    <div className={'text-[9px] font-normal truncate leading-tight ' + (isOn ? 'text-amber-50' : 'text-slate-400')}>{seat?.name || '-'}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <label className={'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer ' + (multiRonMode ? 'border-fuchsia-500 bg-fuchsia-50' : 'border-slate-200 bg-white')}>
                    <span className="text-sm font-bold">{multiRonMode ? '🎯 더블론 모드 ON' : '더블론 모드 OFF'}</span>
                    <input type="checkbox" className="sr-only" checked={multiRonMode} onChange={e => {
                        if (e.target.checked && hands.length > 0) {
                            const last = hands[hands.length - 1];
                            if (last.win_type === 'ron') {
                                if (!window.confirm('⚠ 직전 hand 가 화료(ron) 입니다.\n\n더블론은 첫 화료자 입력 전에 모드를 켜야 자리별 리치/점수가 정확히 기록됩니다.\n\n[권장] 취소 → [↶ 무르기] 로 직전 hand 취소 → 더블론 ON → 처음부터 다시 입력\n\n그래도 이대로 모드만 켜시려면 [확인].')) return;
                            }
                        }
                        setMultiRonMode(e.target.checked);
                    }} />
                    <span className="text-[10px] text-slate-500">{multiRonMode ? '같은 hand 로 묶임 · 방총자/리치 동일' : '⚠ 첫 화료 전에 켜야 정확'}</span>
                </label>

                <div className="flex gap-2">
                    <button onClick={() => openHand(null)} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold">유국</button>
                    <button onClick={undoLastHand} disabled={hands.length === 0} className={'flex-1 py-3 rounded-lg font-bold ' + (hands.length ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400')}>↶ 무르기</button>
                </div>

                <details className="border border-slate-200 rounded-lg">
                    <summary className="cursor-pointer px-3 py-2 text-sm text-slate-600">⚠ 도중유국 / 유국만관 / 촌보 / 지각</summary>
                    <div className="p-2 grid grid-cols-2 gap-2">
                        <button onClick={() => recordAbortion('kyuushu')} className="py-2 rounded bg-slate-100 text-slate-700 text-sm font-bold">구종구패</button>
                        <button onClick={() => recordAbortion('sufon')} className="py-2 rounded bg-slate-100 text-slate-700 text-sm font-bold">사풍연타</button>
                        <button onClick={() => recordAbortion('suucha_riichi')} className="py-2 rounded bg-slate-100 text-slate-700 text-sm font-bold">사가리치 <span className="text-[10px] text-red-500">(-1000×4)</span></button>
                        <button onClick={() => recordAbortion('suukantsu')} className="py-2 rounded bg-slate-100 text-slate-700 text-sm font-bold">사깡산료</button>
                        <button onClick={recordNagashi} className="col-span-2 py-2 rounded bg-pink-100 text-pink-800 text-sm font-bold">유국만관 <span className="text-[10px] text-pink-500">(자=만관 / 친=친 만관)</span></button>
                        <button onClick={recordChombo} className="col-span-2 py-2 rounded bg-rose-100 text-rose-800 text-sm font-bold">촌보 <span className="text-[10px] text-rose-500">(다른 3명에 각 +3,000)</span></button>
                        <button onClick={recordLatePenalty} className="col-span-2 py-2 rounded bg-amber-100 text-amber-800 text-sm font-bold">지각 <span className="text-[10px] text-amber-600">(1명당 N점 분배, 100 단위)</span></button>
                    </div>
                </details>

                <div className="border-t border-slate-200 pt-3 flex gap-2">
                    <button onClick={() => setStep('setup')} className="flex-1 py-2 text-xs text-slate-500 underline">자리 다시</button>
                    <button onClick={finishGame} className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-bold">경기 종료 → 저장</button>
                </div>

                {hands.length > 0 && (() => {
                    // hand_number → autoResult.perHand 인덱스 매핑 (더블론 그룹은 한 항목)
                    const hnToPi = {};
                    {
                        let pi = 0;
                        const seen = new Set();
                        for (const hh of hands) {
                            if (!seen.has(hh.hand_number)) {
                                hnToPi[hh.hand_number] = pi;
                                seen.add(hh.hand_number);
                                pi++;
                            }
                        }
                    }
                    const initScores = {};
                    for (const s of seats) if (s.name) initScores[s.name] = 25000;
                    const fmtDelta = (n) => (n > 0 ? '+' : (n < 0 ? '−' : '')) + Math.abs(n).toLocaleString();
                    return (
                        <div className="border border-slate-100 rounded-lg p-2 mt-2">
                            <div className="text-xs font-bold text-slate-500 mb-1">진행 기록 <span className="font-normal text-slate-400">— ✏ 수정 / 🗑 삭제</span></div>
                            <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                                {hands.map((h, i) => {
                                    const canEdit = h.win_type === 'tsumo' || h.win_type === 'ron' || h.win_type === 'draw';
                                    const groupRonCount = hands.filter(g => g.hand_number === h.hand_number && g.win_type === 'ron').length;
                                    const isMultiRow = h.win_type === 'ron' && groupRonCount >= 2;
                                    const prev = i > 0 ? hands[i - 1] : null;
                                    const isMultiSubRow = isMultiRow && prev && prev.hand_number === h.hand_number && prev.win_type === 'ron';

                                    // 점수 변동 계산 (perHand 기반: 리치봉/혼바료 자동 반영)
                                    const pi = hnToPi[h.hand_number];
                                    const prevScores = (pi == null || pi === 0) ? initScores : (autoResult.perHand?.[pi - 1]?.scores || initScores);
                                    const currScores = (pi == null) ? {} : (autoResult.perHand?.[pi]?.scores || {});
                                    const calcD = (nm) => Math.round((currScores[nm] || 0) - (prevScores[nm] || 0));
                                    let deltaText = null;
                                    let deltaColor = '';
                                    if ((h.win_type === 'tsumo' || h.win_type === 'ron') && h.winner_name) {
                                        const d = calcD(h.winner_name);
                                        if (d !== 0) { deltaText = fmtDelta(d); deltaColor = d > 0 ? 'text-green-600' : 'text-red-500'; }
                                    } else if (h.win_type === 'chombo' && h.chombo_player) {
                                        const d = calcD(h.chombo_player);
                                        if (d !== 0) { deltaText = fmtDelta(d); deltaColor = 'text-red-500'; }
                                    } else if (h.win_type === 'late_penalty' && h.late_player) {
                                        const d = calcD(h.late_player);
                                        if (d !== 0) { deltaText = fmtDelta(d); deltaColor = 'text-red-500'; }
                                    } else if (h.win_type === 'abortion' && h.abortion_type === 'suucha_riichi') {
                                        deltaText = '−1,000×4';
                                        deltaColor = 'text-red-500';
                                    } else if (h.win_type === 'draw') {
                                        const nagashiWind = ['동','남','서','북'].find(w => h['nagashi_' + WIND_TO_FIELD[w]]);
                                        if (nagashiWind) {
                                            const seat = seats.find(s => s.wind === nagashiWind);
                                            if (seat) {
                                                const d = calcD(seat.name);
                                                if (d !== 0) { deltaText = fmtDelta(d); deltaColor = d > 0 ? 'text-green-600' : 'text-red-500'; }
                                            }
                                        }
                                    }

                                    return (
                                        <div key={i} className={'flex justify-between items-center gap-1 text-slate-700 ' + (isMultiSubRow ? 'pl-2 border-l-2 border-fuchsia-300' : '')}>
                                            <span className="shrink-0 text-slate-500">{h.hand_wind}{h.hand_round_num}{h.honba ? `·${h.honba}본장` : ''}</span>
                                            <span className="flex-1 text-right truncate">
                                                {(() => {
                                                    if (h.win_type === 'draw') {
                                                        const nagashiWinds = ['동','남','서','북'].filter(w => h['nagashi_' + WIND_TO_FIELD[w]]);
                                                        if (nagashiWinds.length > 0) {
                                                            const names = nagashiWinds.map(w => (seats.find(s => s.wind === w)?.name) || w).join(',');
                                                            return `유국만관 (${names})`;
                                                        }
                                                        return '유국';
                                                    }
                                                    if (h.win_type === 'abortion') return `도중유국 (${({kyuushu:'구종구패',sufon:'사풍연타',suucha_riichi:'사가리치',suukantsu:'사깡산료'})[h.abortion_type] || '?'})`;
                                                    if (h.win_type === 'chombo') return `촌보 (${h.chombo_player || '?'})`;
                                                    if (h.win_type === 'late_penalty') return `지각 (${h.late_player || '?'}: −${((h.late_penalty || 0) * 3).toLocaleString()})`;
                                                    return `${h.winner_name} ${h.win_type === 'tsumo' ? '쯔모' : '론(' + (h.deal_in_name || '?') + ')'}`;
                                                })()}
                                                {deltaText && <span className={'ml-1 font-bold ' + deltaColor}>{deltaText}</span>}
                                            </span>
                                            <div className="flex gap-0.5 shrink-0">
                                                {canEdit ? (
                                                    <button type="button" onClick={() => openHandForEdit(i)} className="px-1.5 py-0.5 text-fuchsia-600 hover:bg-fuchsia-50 active:bg-fuchsia-100 rounded text-[12px] leading-none" title="수정">✏</button>
                                                ) : (
                                                    <span className="w-5"></span>
                                                )}
                                                <button type="button" onClick={() => deleteHand(i)} className="px-1.5 py-0.5 text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded text-[12px] leading-none" title="삭제">🗑</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>
        );
    };

    // ===== Step 3: 화료/유국 입력 모달 =====
    const recomputeHanFu = (draft) => {
        if (draft.win_type === 'draw') return {};
        const yakuList = draft.yaku_list || [];
        if (draft.score_class && draft.score_class !== 'normal') return {};

        let totalHan = 0;
        for (const k of yakuList) {
            const y = YAKU_MAP[k];
            if (!y || y.han == null) continue;
            const effHan = (draft.is_furo && y.kuisagari) ? Math.max(1, y.han - y.kuisagari) : y.han;
            totalHan += effHan;
        }
        totalHan += parseInt(draft.dora_count) || 0;
        totalHan += parseInt(draft.ura_dora_count) || 0;

        const out = {};
        out.han = totalHan > 0 ? totalHan : null;

        if (yakuList.includes('pinfu') && draft.win_type) {
            out.fu = draft.win_type === 'tsumo' ? 20 : 30;
        } else if (yakuList.includes('chiitoitsu')) {
            out.fu = 25;
        }
        return out;
    };

    const updateDraft = (patch) => setEditingHand(prev => {
        if (!prev) return prev;
        const merged = { ...prev.draft, ...patch };

        if ('win_type' in patch && Array.isArray(merged.yaku_list) && merged.yaku_list.length > 0) {
            const wt = merged.win_type;
            if (wt === 'tsumo' || wt === 'ron') {
                const { list, removed } = filterYakuByWinType(merged.yaku_list, wt);
                if (removed.length > 0) {
                    merged.yaku_list = list;
                    const labels = yakuLabels(removed).join(', ');
                    setYakuConflictMsg(`⚠ ${wt === 'tsumo' ? '쯔모' : '론'} 으로 변경 → 무효 役 자동 해제: ${labels}`);
                    setTimeout(() => setYakuConflictMsg(''), 4000);
                }
            }
        }

        const winnerWind = prev.winnerWind;
        if (winnerWind) {
            const rField = 'riichi_' + WIND_TO_FIELD[winnerWind];
            const yakuHasRiichi = (merged.yaku_list || []).includes('riichi');
            if ('yaku_list' in patch) {
                merged[rField] = yakuHasRiichi;
            }
            if (rField in patch) {
                const yl = merged.yaku_list || [];
                if (merged[rField] && !yakuHasRiichi) merged.yaku_list = [...yl, 'riichi'];
                else if (!merged[rField] && yakuHasRiichi) merged.yaku_list = yl.filter(k => k !== 'riichi');
            }
        }

        const ylNow = merged.yaku_list || [];
        const CLASS_RANK = { mangan: 1, haneman: 2, baiman: 3, sanbaiman: 4, kazoe_yakuman: 5, yakuman: 5, double_yakuman: 6, triple_yakuman: 7 };
        let bestClass = null; let bestRank = 0;
        for (const k of ylNow) {
            const y = YAKU_MAP[k];
            if (y && y.scoreClass) {
                const r = CLASS_RANK[y.scoreClass] || 0;
                if (r > bestRank) { bestRank = r; bestClass = y.scoreClass; }
            }
        }
        if (!('score_class' in patch)) {
            if (bestClass) merged.score_class = bestClass;
        }

        const triggerKeys = ['yaku_list', 'dora_count', 'ura_dora_count', 'is_furo', 'win_type', 'score_class', winnerWind ? ('riichi_' + WIND_TO_FIELD[winnerWind]) : ''];
        const shouldRecalc = Object.keys(patch).some(k => triggerKeys.includes(k));
        if (shouldRecalc) {
            const auto = recomputeHanFu(merged);
            if (auto.fu != null) merged.fu = auto.fu;
            if (auto.han != null) merged.han = auto.han;
        }
        return { ...prev, draft: merged };
    });

    const toggleYakuInDraft = (key) => {
        const cur = editingHand?.draft.yaku_list || [];
        const winType = editingHand?.draft.win_type || null;
        const result = resolveYakuConflicts(key, cur, winType);
        if (result.rejected) {
            const lbl = YAKU_MAP[result.rejected]?.label || result.rejected;
            const reason = YAKU_MAP[result.rejected]?.winType === 'tsumo' ? '쯔모 전용 役' : '론 전용 役';
            setYakuConflictMsg(`⚠ ${lbl} 는 ${reason} 입니다`);
            setTimeout(() => setYakuConflictMsg(''), 4000);
            return;
        }
        const { list, removed } = result;
        if (removed.length > 0) {
            const addedLabel = YAKU_MAP[key]?.label || key;
            const removedLabels = yakuLabels(removed).join(', ');
            setYakuConflictMsg(`⚠ ${addedLabel} 와(과) 양립 불가: ${removedLabels} 자동 해제됨`);
            setTimeout(() => setYakuConflictMsg(''), 4000);
        } else {
            setYakuConflictMsg('');
        }
        updateDraft({ yaku_list: list });
    };

    const confirmHand = () => {
        const d = editingHand.draft;
        if (editingHand.winnerWind && d.win_type !== 'tsumo' && d.win_type !== 'ron') {
            alert('쯔모 또는 론을 선택해주세요.');
            return;
        }
        if (d.win_type === 'ron' && !d.deal_in_name) {
            alert('방총자를 선택해주세요.');
            return;
        }
        if (d.win_type === 'ron' && d.deal_in_name === d.winner_name) {
            alert('화료자와 방총자가 같을 수 없습니다.');
            return;
        }
        if (d.win_type !== 'draw' && !d.winner_name) {
            alert('화료자가 없습니다.');
            return;
        }
        // 화료(tsumo/ron) 시 손패 형태(멘젠/후로) 필수 선택
        if ((d.win_type === 'tsumo' || d.win_type === 'ron') && d.is_furo == null) {
            alert('손패 형태(멘젠/후로)를 선택해주세요.');
            return;
        }
        const hasClass = d.score_class && d.score_class !== 'normal';
        const hanNum = d.han ? parseInt(d.han) : 0;
        const canAutoLimit = hanNum >= 5;
        if (d.win_type !== 'draw' && !hasClass && !canAutoLimit && (!d.han || !d.fu)) {
            if (!window.confirm('한·부 또는 등급이 비어있어 점수가 0 으로 저장됩니다. 계속할까요?')) return;
        }
        const editIdx = editingHand.editIndex;
        if (editIdx != null) {
            setHands(prev => prev.map((h, i) => i === editIdx ? { ...d } : h));
        } else {
            setHands(prev => [...prev, { ...d }]);
            // 더블론 모드의 ron 입력은 같은 hand 의 다음 화료자가 올 수 있으므로 임시 리치 유지
            // 그 외(단일 화료/유국/더블론 OFF)는 다음 hand 로 넘어가므로 리셋
            if (!(multiRonMode && d.win_type === 'ron')) {
                setPendingRiichi({ e: false, s: false, w: false, n: false });
            }
        }
        setShowFuGuide(false);
        setEditingHand(null);
    };

    const renderModal = () => {
        if (!editingHand) return null;
        const d = editingHand.draft;
        const isDraw = d.win_type === 'draw';
        const winnerWind = editingHand.winnerWind;
        const winnerName = d.winner_name;
        const isDealerWinner = winnerWind === DEALER_WINDS[(d.hand_round_num || 1) - 1];

        let calcPreview = null;
        let calcReason = '';
        if (isDraw) {
            calcReason = '';
        } else if (!d.win_type) {
            calcReason = '쯔모/론을 선택해주세요';
        } else if (!d.winner_name) {
            calcReason = '화료자를 선택해주세요';
        } else {
            try {
                const hasClass = d.score_class && d.score_class !== 'normal';
                const hanNum = d.han ? parseInt(d.han) : 0;
                const canAutoLimit = hanNum >= 5;
                if (hasClass || (d.han && d.fu) || canAutoLimit) {
                    calcPreview = calcScore({
                        isDealerWinner,
                        winType: d.win_type,
                        han: d.han ? parseInt(d.han) : undefined,
                        fu: d.fu ? parseInt(d.fu) : undefined,
                        scoreClass: d.score_class,
                        honba: parseInt(d.honba) || 0,
                    });
                } else {
                    calcReason = '판·부 또는 등급을 입력하면 자동 점수가 표시됩니다 (5판 이상은 부수 불필요)';
                }
            } catch (e) { calcReason = '계산 실패: ' + e.message; }
        }

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch md:items-center justify-center">
                <div className="bg-white w-full max-w-md max-h-full overflow-y-auto md:rounded-2xl">
                    <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                                {editingHand.editIndex != null && (
                                    <span className="px-1.5 py-0.5 bg-fuchsia-100 text-fuchsia-700 rounded text-[10px] font-bold">🛠 수정 중</span>
                                )}
                                <span>{d.hand_wind}{d.hand_round_num}국{d.honba ? ` · ${d.honba}본장` : ''}</span>
                            </div>
                            <div className="text-lg font-black text-slate-900 truncate">
                                {isDraw ? '유국' : `${winnerWind} ${winnerName} ${isDealerWinner ? '(친)' : ''} 화료`}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {!isDraw && (
                                <button
                                    type="button"
                                    onClick={() => setShowFuGuide(v => !v)}
                                    className={'px-2 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1 ' + (showFuGuide ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100')}
                                    title="부수 계산 안내"
                                >
                                    <span>❔ 부수</span><span className="text-[10px]">{showFuGuide ? '▴' : '▾'}</span>
                                </button>
                            )}
                            <button onClick={() => { setEditingHand(null); setYakuConflictMsg(''); setShowFuGuide(false); }} className="text-slate-400 text-2xl px-1">×</button>
                        </div>
                    </div>

                    {/* 부수 계산 안내 (인라인 펼침) */}
                    {!isDraw && showFuGuide && (
                        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-[11px] text-slate-800">
                            <div className="font-bold text-amber-800 mb-2 flex items-center gap-1">📋 부수 계산</div>
                            <div className="space-y-1.5">
                                <div className="flex gap-2 items-start">
                                    <span className="shrink-0 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-bold w-12 text-center">1. 기본</span>
                                    <span>항상 <b className="bg-white px-1.5 rounded">20부</b></span>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <span className="shrink-0 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-bold w-12 text-center">2. 화료</span>
                                    <span>멘젠론 <b className="bg-white px-1.5 rounded">+10</b>  쯔모 <b className="bg-white px-1.5 rounded">+2</b> <span className="text-slate-500">(핑허·영상개화 제외)</span></span>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <span className="shrink-0 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-bold w-12 text-center">3. 대기</span>
                                    <span>단기 / 변짱 / 간짱 <b className="bg-white px-1.5 rounded">+2</b></span>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <span className="shrink-0 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-bold w-12 text-center">4. 머리</span>
                                    <span>삼원·장풍·자풍 <b className="bg-white px-1.5 rounded">+2</b>  <span className="text-slate-500">이중자풍 +4</span></span>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <span className="shrink-0 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-bold w-12 text-center">5. 커쯔</span>
                                    <div className="grid grid-cols-2 gap-1.5 flex-1">
                                        <div className="bg-white rounded p-1.5">
                                            <div className="font-bold text-slate-700 text-[10px] mb-0.5">중장</div>
                                            <div className="flex justify-between"><span>뻥쯔</span><b>2</b></div>
                                            <div className="flex justify-between"><span>안커</span><b>4</b></div>
                                            <div className="flex justify-between"><span>명깡</span><b>8</b></div>
                                            <div className="flex justify-between"><span>암깡</span><b>16</b></div>
                                        </div>
                                        <div className="bg-amber-100 rounded p-1.5">
                                            <div className="font-bold text-amber-800 text-[10px] mb-0.5">귀족 (1·9·자패)</div>
                                            <div className="flex justify-between"><span>뻥쯔</span><b>4</b></div>
                                            <div className="flex justify-between"><span>안커</span><b>8</b></div>
                                            <div className="flex justify-between"><span>명깡</span><b>16</b></div>
                                            <div className="flex justify-between"><span>암깡</span><b>32</b></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-dashed border-amber-300 text-[10px] text-amber-800">
                                <b>예외(고정):</b> 핑허 론 30 · 핑허 쯔모 20 · 치또이츠 25
                            </div>
                        </div>
                    )}

                    <div className="p-4 space-y-4">
                        {isDraw ? (
                            <div className="space-y-3">
                                <div>
                                    <div className="text-sm font-bold text-slate-700 mb-2">텐파이 (체크 = 텐파이)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['동','남','서','북'].map(w => {
                                            const seat = seats.find(s => s.wind === w);
                                            const field = 'tenpai_' + WIND_TO_FIELD[w];
                                            return (
                                                <label key={w} className={'p-3 rounded-lg border-2 flex items-center gap-2 ' + (d[field] ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-white')}>
                                                    <input type="checkbox" checked={!!d[field]} onChange={e => updateDraft({ [field]: e.target.checked })} />
                                                    <span className="font-bold">{w}</span>
                                                    <span className="text-xs text-slate-500 truncate">{seat?.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-700 mb-2">리치 (이 국에서 리치한 자리 · 각 −1000 → 다음 국으로 이월)</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['동','남','서','북'].map(w => {
                                            const seat = seats.find(s => s.wind === w);
                                            const field = 'riichi_' + WIND_TO_FIELD[w];
                                            return (
                                                <label key={w} className={'p-2 rounded-lg border-2 text-center text-sm font-bold leading-tight ' + (d[field] ? 'border-amber-500 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-600')}>
                                                    <input type="checkbox" className="hidden" checked={!!d[field]} onChange={e => updateDraft({ [field]: e.target.checked })} />
                                                    <div>{w}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">{seat?.name || '-'}</div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* 손패 형태 (멘젠/후로) — 모달 상단 핵심 선택. 리치 자리는 후로 차단 */}
                                {(() => {
                                    const winnerRiichiOn = winnerWind && d['riichi_' + WIND_TO_FIELD[winnerWind]];
                                    const hasRiichiYaku = (d.yaku_list || []).includes('riichi');
                                    const isFuroBlocked = !!(winnerRiichiOn || hasRiichiYaku);
                                    return (
                                        <div>
                                            <div className="text-sm font-bold text-slate-700 mb-2">
                                                손패 형태
                                                {d.is_furo === null && !isFuroBlocked && <span className="text-[10px] font-normal text-rose-500 ml-1">(선택 필수)</span>}
                                                {isFuroBlocked && <span className="text-[10px] font-normal text-amber-700 ml-1">(리치 선언자 → 멘젠 고정)</span>}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateDraft({ is_furo: false })}
                                                    className={'py-3 rounded-lg font-bold border-2 text-base ' + (d.is_furo === false ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200')}
                                                >🀫 멘젠 (門前)</button>
                                                <button
                                                    type="button"
                                                    disabled={isFuroBlocked}
                                                    onClick={() => updateDraft({ is_furo: true })}
                                                    className={'py-3 rounded-lg font-bold border-2 text-base ' + (isFuroBlocked ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through' : (d.is_furo === true ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-200'))}
                                                >🃏 후로 (副露)</button>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                {isFuroBlocked
                                                    ? '리치는 멘젠 한정 役이라 후로(폰/치/명깡)와 양립 불가'
                                                    : '멘젠 = 폰/치 안 함 · 후로 = 폰/치/명깡 있음. 役 자동 차단/쿠이사가리 적용'}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const lockWinType = multiRonMode || (editingHand.isMultiRon && editingHand.editIndex != null);
                                    const lockHint = multiRonMode
                                        ? '(더블론 모드: 론만 가능)'
                                        : (editingHand.isMultiRon && editingHand.editIndex != null ? '(더블론 수정: 론 고정)' : '');
                                    return (
                                        <div>
                                            <div className="text-sm font-bold text-slate-700 mb-2">방식{lockHint && <span className="text-[10px] font-normal text-fuchsia-600 ml-1">{lockHint}</span>}</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    disabled={lockWinType}
                                                    onClick={() => updateDraft({ win_type: 'tsumo', deal_in_name: '' })}
                                                    className={'py-3 rounded-lg font-bold border-2 ' + (lockWinType ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : (d.win_type === 'tsumo' ? 'bg-green-500 text-white border-green-600' : 'bg-white text-slate-700 border-slate-200'))}
                                                >🎴 쯔모</button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateDraft({ win_type: 'ron' })}
                                                    className={'py-3 rounded-lg font-bold border-2 ' + (d.win_type === 'ron' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-700 border-slate-200')}
                                                >🎯 론</button>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {d.win_type === 'ron' && (
                                    <div>
                                        <div className="text-sm font-bold text-slate-700 mb-2">방총자{editingHand.lockedDealIn && <span className="text-[10px] font-normal text-fuchsia-600 ml-1">(더블론: 그룹 동일 — 잠금)</span>}</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {seats.filter(s => s.name && s.name !== winnerName).map(s => {
                                                const locked = !!editingHand.lockedDealIn;
                                                const selected = d.deal_in_name === s.name;
                                                return (
                                                    <button
                                                        key={s.wind}
                                                        type="button"
                                                        disabled={locked}
                                                        onClick={() => updateDraft({ deal_in_name: s.name })}
                                                        className={'py-3 rounded-lg font-bold border-2 text-sm ' + (selected ? 'bg-rose-500 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200') + (locked && !selected ? ' opacity-40 cursor-not-allowed' : '') + (locked && selected ? ' cursor-not-allowed' : '')}
                                                    >
                                                        {s.wind} {s.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="text-sm font-bold text-slate-700 mb-2">리치 (시작 자리 기준 · −1000)</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['동','남','서','북'].map(w => {
                                            const field = 'riichi_' + WIND_TO_FIELD[w];
                                            const seat = seats.find(s => s.wind === w);
                                            return (
                                                <label key={w} className={'p-2 rounded-lg border-2 text-center text-sm font-bold leading-tight ' + (d[field] ? 'border-amber-500 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-600')}>
                                                    <input type="checkbox" className="hidden" checked={!!d[field]} onChange={e => updateDraft({ [field]: e.target.checked })} />
                                                    <div>{w}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">{seat?.name || '-'}</div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-sm font-bold text-slate-700">役 선택 {d.is_furo === true && <span className="text-[10px] font-normal text-amber-600 ml-1">(후로 모드)</span>}{d.is_furo === false && <span className="text-[10px] font-normal text-slate-500 ml-1">(멘젠 모드)</span>}</div>
                                        <div className="text-[10px] text-slate-400">선택 {(d.yaku_list || []).length}개</div>
                                    </div>

                                    <div className="flex gap-1 mb-2 overflow-x-auto">
                                        {['1판','2판','3판','6판','역만','더블역만'].filter(g => YAKU_BY_GROUP[g]).map(grp => {
                                            const selectedInGroup = (YAKU_BY_GROUP[grp] || []).filter(y => (d.yaku_list || []).includes(y.key)).length;
                                            return (
                                                <button key={grp}
                                                    type="button"
                                                    onClick={() => setActiveYakuGroup(grp)}
                                                    className={'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border ' + (activeYakuGroup === grp ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200')}
                                                >
                                                    {grp}{selectedInGroup > 0 && <span className={'ml-1 ' + (activeYakuGroup === grp ? 'text-amber-200' : 'text-orange-500')}>·{selectedInGroup}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex flex-wrap gap-1 min-h-[3rem] border border-slate-100 rounded-lg p-2 bg-slate-50">
                                        {(YAKU_BY_GROUP[activeYakuGroup] || [])
                                            .filter(y => !(d.is_furo && y.menzenOnly))
                                            .map(y => {
                                                const isReduced = d.is_furo && y.kuisagari;
                                                const disabledByWinType = d.win_type && y.winType && y.winType !== d.win_type;
                                                return (
                                                    <label key={y.key} title={disabledByWinType ? `${y.winType === 'tsumo' ? '쯔모' : '론'} 전용 役` : ''} className={'px-2 py-1.5 rounded border text-[12px] ' + (disabledByWinType ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : 'cursor-pointer ' + ((d.yaku_list || []).includes(y.key) ? 'bg-orange-100 border-orange-300 text-orange-800 font-bold' : 'bg-white border-slate-200 text-slate-600')) + (isReduced ? ' italic' : '')}>
                                                        <input type="checkbox" className="hidden" disabled={disabledByWinType} checked={(d.yaku_list || []).includes(y.key)} onChange={() => !disabledByWinType && toggleYakuInDraft(y.key)} />
                                                        {y.label}{isReduced && <span className="ml-0.5 text-[9px] text-slate-400">↓</span>}
                                                    </label>
                                                );
                                            })}
                                        {d.is_furo && (YAKU_BY_GROUP[activeYakuGroup] || []).some(y => y.menzenOnly) && (
                                            <span className="text-[10px] text-slate-400 italic w-full">멘젠 한정 役은 후로 시 숨김</span>
                                        )}
                                    </div>

                                    {yakuConflictMsg && (
                                        <div className="mt-1 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{yakuConflictMsg}</div>
                                    )}
                                    {(d.yaku_list || []).length > 0 && (
                                        <div className="mt-1 text-[11px] text-slate-500">
                                            선택: {(d.yaku_list || []).map(k => {
                                                for (const grp of YAKU_GROUPS) {
                                                    const found = (YAKU_BY_GROUP[grp] || []).find(y => y.key === k);
                                                    if (found) return found.label;
                                                }
                                                return k;
                                            }).join(', ')}
                                        </div>
                                    )}

                                    <div className="mt-2 flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                                        <span className="text-xs font-bold text-slate-700">도라 <span className="text-[10px] font-normal text-slate-400">(적도라 포함)</span></span>
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => updateDraft({ dora_count: Math.max(0, (parseInt(d.dora_count) || 0) - 1) })} className="w-8 h-8 rounded bg-white border border-slate-300 text-lg font-black active:bg-slate-200">−</button>
                                            <button type="button" onClick={() => updateDraft({ dora_count: (parseInt(d.dora_count) || 0) + 1 })} className="w-10 h-8 rounded bg-white border border-slate-300 text-base font-black text-slate-800 active:bg-slate-100">
                                                {d.dora_count || 0}
                                            </button>
                                            <button type="button" onClick={() => updateDraft({ dora_count: (parseInt(d.dora_count) || 0) + 1 })} className="w-8 h-8 rounded bg-white border border-slate-300 text-lg font-black active:bg-slate-200">+</button>
                                        </div>
                                    </div>

                                    {(d.riichi_e || d.riichi_s || d.riichi_w || d.riichi_n) && (
                                        <div className="mt-2 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                                            <span className="text-xs font-bold text-amber-800">우라도라 <span className="text-[10px] font-normal text-amber-600">(리치 시)</span></span>
                                            <div className="flex items-center gap-1">
                                                <button type="button" onClick={() => updateDraft({ ura_dora_count: Math.max(0, (parseInt(d.ura_dora_count) || 0) - 1) })} className="w-8 h-8 rounded bg-white border border-amber-300 text-lg font-black active:bg-amber-200">−</button>
                                                <button type="button" onClick={() => updateDraft({ ura_dora_count: (parseInt(d.ura_dora_count) || 0) + 1 })} className="w-10 h-8 rounded bg-white border border-amber-300 text-base font-black text-slate-800 active:bg-amber-100">
                                                    {d.ura_dora_count || 0}
                                                </button>
                                                <button type="button" onClick={() => updateDraft({ ura_dora_count: (parseInt(d.ura_dora_count) || 0) + 1 })} className="w-8 h-8 rounded bg-white border border-amber-300 text-lg font-black active:bg-amber-200">+</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {(() => {
                                    const hanNum = d.han ? parseInt(d.han) : 0;
                                    const hasClass = d.score_class && d.score_class !== 'normal';
                                    const yl = d.yaku_list || [];
                                    const autoFu = yl.includes('pinfu') || yl.includes('chiitoitsu');
                                    const fuDisabled = hasClass || hanNum >= 5 || autoFu;
                                    const hanDisabled = hasClass;
                                    let hint = '';
                                    if (hasClass) hint = '등급 지정됨 → 판·부 불필요';
                                    else if (hanNum >= 5) hint = '5판 이상 → 부수 불필요 (자동 만관 이상)';
                                    else if (autoFu) hint = (yl.includes('pinfu') ? '핑허' : '치또이') + ' 자동 부수';
                                    return (
                                <div>
                                    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5">
                                        <span className="text-xs font-bold text-slate-700">판 · 부 {hint ? <span className="text-[10px] font-normal text-emerald-600 ml-1">({hint})</span> : <span className="text-[10px] font-normal text-slate-400">(役·도라 자동 합산)</span>}</span>
                                        <div className="flex items-center gap-1">
                                            <input type="number" min="0" placeholder="판" disabled={hanDisabled} value={d.han || ''} onChange={e => updateDraft({ han: e.target.value === '' ? null : parseInt(e.target.value) })} className={'w-14 h-8 border rounded text-center text-sm font-bold ' + (hanDisabled ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300')} />
                                            <input type="number" min="0" placeholder="부" disabled={fuDisabled} value={d.fu || ''} onChange={e => updateDraft({ fu: e.target.value === '' ? null : parseInt(e.target.value) })} className={'w-14 h-8 border rounded text-center text-sm font-bold ' + (fuDisabled ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300')} />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {[
                                            ['mangan','만관'],['haneman','하네만'],['baiman','배만'],['sanbaiman','삼배만'],
                                            ['yakuman','역만'],['kazoe_yakuman','헤아림'],['double_yakuman','더블역만']
                                        ].map(([k, label]) => (
                                            <button key={k} onClick={() => updateDraft({ score_class: d.score_class === k ? null : k })} className={'px-2 py-1 rounded text-[11px] font-bold border ' + (d.score_class === k ? 'bg-pink-500 text-white border-pink-600' : 'bg-white text-slate-600 border-slate-200')}>{label}</button>
                                        ))}
                                    </div>
                                </div>
                                    );
                                })()}

                                {calcPreview && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                                        <div className="text-xs text-amber-700">자동 점수</div>
                                        <div className="text-2xl font-black text-amber-800">{calcPreview.text}</div>
                                        <div className="text-xs text-amber-600">{classLabel(calcPreview.scoreClass) || '일반'} · 총 {calcPreview.total.toLocaleString()}</div>
                                    </div>
                                )}
                                {!calcPreview && calcReason && (
                                    <div className="text-xs text-slate-500 text-center py-1">{calcReason}</div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex gap-2">
                        <button onClick={() => { setEditingHand(null); setYakuConflictMsg(''); setShowFuGuide(false); }} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold">취소</button>
                        <button onClick={confirmHand} className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-bold">확정</button>
                    </div>
                </div>
            </div>
        );
    };

    // ===== Step 4: 종료 / 저장 =====
    const saveToDb = async () => {
        const finalScores = seats.map(s => ({ ...s, score: Math.round(autoResult.scores[s.name] || 25000) }));
        const sorted = [...finalScores].sort((a, b) => b.score - a.score);
        const umaBonus = [40, 10, -10, -20];
        sorted.forEach((p, i) => { p.calculatedRank = i + 1; p.calculatedUma = Number((((p.score - 30000) / 1000) + umaBonus[i]).toFixed(1)); });
        const finalScoresWithRank = finalScores.map(p => {
            const found = sorted.find(s => s.wind === p.wind);
            return { ...p, rank: found.calculatedRank, uma: found.calculatedUma };
        });

        const cc = calcClassCounts(seatPlayers, hands);

        const payload = {
            date,
            players: finalScoresWithRank.map(p => ({
                wind: p.wind,
                name: p.name,
                score: p.score,
                rank: p.rank,
                uma: p.uma,
                mangan: cc[p.name]?.mangan || 0,
                haneman: cc[p.name]?.haneman || 0,
                baiman: cc[p.name]?.baiman || 0,
                sanbaiman: cc[p.name]?.sanbaiman || 0,
                yakuman: cc[p.name]?.yakuman || 0,
                kazoeyakuman: cc[p.name]?.kazoeyakuman || 0,
                doubleyakuman: cc[p.name]?.doubleyakuman || 0,
            })),
            hands: hands.filter(h => h.win_type).map((h, i, arr) => {
                const multiIdx = arr.slice(0, i + 1).filter(x => x.hand_number === h.hand_number).length;
                    const isDealer = h._winnerWind === DEALER_WINDS[(h.hand_round_num || 1) - 1];
                    let calc = null;
                    try {
                        if ((h.score_class && h.score_class !== 'normal') || (h.han && h.fu)) {
                            calc = calcScore({
                                isDealerWinner: isDealer,
                                winType: h.win_type,
                                han: h.han ? parseInt(h.han) : undefined,
                                fu: h.fu ? parseInt(h.fu) : undefined,
                                scoreClass: h.score_class,
                                honba: parseInt(h.honba) || 0,
                            });
                        }
                    } catch {}
                    return {
                        hand_number: h.hand_number || (i + 1),
                        multi_index: multiIdx,
                        hand_wind: h.hand_wind,
                        hand_round_num: Number(h.hand_round_num),
                        win_type: h.win_type,
                        winner_name: (h.win_type === 'tsumo' || h.win_type === 'ron') ? h.winner_name : null,
                        deal_in_name: h.win_type === 'ron' ? h.deal_in_name : null,
                        abortion_type: h.win_type === 'abortion' ? h.abortion_type : null,
                        chombo_player: h.win_type === 'chombo' ? h.chombo_player : null,
                        late_player: h.win_type === 'late_penalty' ? h.late_player : null,
                        late_penalty: h.win_type === 'late_penalty' ? (parseInt(h.late_penalty) || null) : null,
                        win_score: null,
                        honba: parseInt(h.honba) || 0,
                        han: h.han || null,
                        fu: h.fu || null,
                        score_class: calc ? calc.scoreClass : (h.score_class || null),
                        is_dealer_winner: !!isDealer,
                        is_riichi: !!h.is_riichi || (Array.isArray(h.yaku_list) && h.yaku_list.includes('riichi')),
                        is_ippatsu: !!h.is_ippatsu || (Array.isArray(h.yaku_list) && h.yaku_list.includes('ippatsu')),
                        dora_count: parseInt(h.dora_count) || 0,
                        aka_dora_count: parseInt(h.aka_dora_count) || 0,
                        ura_dora_count: parseInt(h.ura_dora_count) || 0,
                        yaku_list: Array.isArray(h.yaku_list) ? h.yaku_list : [],
                        yaku_text: h.yaku_text || null,
                        point_total: calc ? calc.total : null,
                        point_from_dealer: calc ? calc.fromDealer : null,
                        point_from_non_dealer: calc ? calc.fromNonDealer : null,
                        tenpai_e: h.win_type === 'draw' ? !!h.tenpai_e : null,
                        tenpai_s: h.win_type === 'draw' ? !!h.tenpai_s : null,
                        tenpai_w: h.win_type === 'draw' ? !!h.tenpai_w : null,
                        tenpai_n: h.win_type === 'draw' ? !!h.tenpai_n : null,
                        riichi_e: !!h.riichi_e,
                        riichi_s: !!h.riichi_s,
                        riichi_w: !!h.riichi_w,
                        riichi_n: !!h.riichi_n,
                        nagashi_e: h.win_type === 'draw' ? !!h.nagashi_e : false,
                        nagashi_s: h.win_type === 'draw' ? !!h.nagashi_s : false,
                        nagashi_w: h.win_type === 'draw' ? !!h.nagashi_w : false,
                        nagashi_n: h.win_type === 'draw' ? !!h.nagashi_n : false,
                        // 화료(tsumo/ron) hand 의 멘젠/후로 여부. 유국/촌보/도중유국은 null
                        is_furo: (h.win_type === 'tsumo' || h.win_type === 'ron') ? (h.is_furo == null ? null : !!h.is_furo) : null,
                    };
                }),
        };

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                clearDraft();
                alert('저장 완료!');
                if (onSaved) onSaved();
                onClose();
            } else {
                const msg = await res.text();
                alert('저장 실패 (' + res.status + '): ' + msg);
            }
        } catch (e) {
            alert('서버 통신 실패: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderDone = () => {
        const orderedFinal = ['동','남','서','북'].map(w => {
            const s = seats.find(x => x.wind === w);
            const score = Math.round(autoResult.scores[s.name] || 25000);
            return { ...s, score };
        });
        const sorted = [...orderedFinal].sort((a, b) => b.score - a.score);
        return (
            <div className="p-4 space-y-4">
                <h2 className="text-xl font-bold text-slate-800">경기 종료 - 저장 확인</h2>
                <div className="text-sm text-slate-500">총 {hands.length}국 진행</div>
                <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                        <tr><th className="p-2 text-left">순위</th><th>자리</th><th>이름</th><th className="text-right">최종점수</th></tr>
                    </thead>
                    <tbody>
                        {sorted.map((p, i) => (
                            <tr key={p.wind} className="border-b">
                                <td className="p-2 font-bold">{i + 1}</td>
                                <td className="text-center">{p.wind}</td>
                                <td>{p.name}</td>
                                <td className={'text-right font-mono font-bold ' + (p.score >= 25000 ? 'text-green-600' : 'text-red-500')}>{p.score.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {autoResult.errors.length > 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                        <div className="font-bold mb-1">경고</div>
                        {autoResult.errors.map((e, i) => <div key={i}>· {e}</div>)}
                    </div>
                )}
                <div className="flex gap-2">
                    <button onClick={() => setStep('play')} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold">계속 진행</button>
                    <button onClick={saveToDb} disabled={isSubmitting} className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-bold">{isSubmitting ? '저장 중...' : '✓ DB 저장'}</button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-100 min-h-screen">
            <div className="max-w-md mx-auto bg-white shadow-lg min-h-screen">
                {step === 'setup' && renderSetup()}
                {step === 'play' && renderPlay()}
                {step === 'done' && renderDone()}
                {renderModal()}
                {/* 사가리치 자동 확인 모달 */}
                {suuchaConfirm && (
                    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">🎴 사가리치 확인</h3>
                            <div className="text-sm text-slate-600 mb-4">
                                4명 모두 리치를 선언했습니다.<br/>
                                <span className="text-amber-700 font-bold">사가리치 (도중유국)</span> 으로 처리하시겠습니까?
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4 text-xs text-amber-800">
                                ⚠ 처리 시: 4명 모두 −1,000 (리치봉 풀로 이월), 본장 +1, 친 유지
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setSuuchaConfirm(false)} className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm">취소 (계속 진행)</button>
                                <button onClick={() => { setSuuchaConfirm(false); recordAbortion('suucha_riichi'); }} className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-bold text-sm">사가리치로 처리</button>
                            </div>
                        </div>
                    </div>
                )}
                {restorePrompt && (
                    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">진행 중이던 대국이 있어요</h3>
                            <div className="text-xs text-slate-500 mb-3">
                                저장 시각: {restorePrompt.savedAt ? new Date(restorePrompt.savedAt).toLocaleString('ko-KR') : '-'}
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-sm">
                                <div className="font-bold text-slate-700 mb-1">자리</div>
                                <div className="text-xs text-slate-600 mb-2">
                                    {(restorePrompt.seats || []).map(s => `${s.wind}: ${s.name}`).join(' / ')}
                                </div>
                                <div className="font-bold text-slate-700 mb-1">진행</div>
                                <div className="text-xs text-slate-600">
                                    {(restorePrompt.hands || []).length}국 입력됨 (날짜: {restorePrompt.date || '-'})
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={rejectRestore} className="flex-1 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm">새로 시작</button>
                                <button onClick={acceptRestore} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg font-bold text-sm">이어서 진행</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
