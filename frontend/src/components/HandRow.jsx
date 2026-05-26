import React, { useState, useMemo } from 'react';
import { calcScore, classLabel } from '../lib/score.js';
import { YAKU_BY_GROUP, YAKU_GROUPS } from '../lib/yaku.js';

// 한 hand 의 모든 정보를 입력하는 컴포넌트
// props:
//   hand          : 현재 hand 객체
//   players       : [{ wind, name }, ...] 길이 4
//   onChange(updated) : 갱신 콜백
//   onRemove()    : 이 hand 삭제
export default function HandRow({ hand, players, onChange, onRemove }) {
    const [expanded, setExpanded] = useState(false);

    const set = (field, value) => onChange({ ...hand, [field]: value });
    const setMany = (patch) => onChange({ ...hand, ...patch });

    // 친 자리: hand_round_num 으로 결정 (동1국=동 친, 동2국=남 친, 동3국=서 친, 동4국=북 친)
    const DEALER_WINDS = ['동','남','서','북'];
    const dealerWind = DEALER_WINDS[(Number(hand.hand_round_num) || 1) - 1] || '동';
    const dealerPlayer = players.find(p => p.wind === dealerWind);
    const isDealerWinner = dealerPlayer && dealerPlayer.name === hand.winner_name;

    // 점수 자동 계산
    const calculated = useMemo(() => {
        if (!hand.win_type || hand.win_type === 'draw' || !hand.winner_name) return null;
        const hasClass = hand.score_class && hand.score_class !== 'normal';
        if (!hasClass && (!hand.han || !hand.fu)) return null;
        try {
            return calcScore({
                isDealerWinner,
                winType: hand.win_type,
                han: hand.han ? parseInt(hand.han) : undefined,
                fu:  hand.fu  ? parseInt(hand.fu)  : undefined,
                scoreClass: hand.score_class,
                honba: parseInt(hand.honba) || 0,
            });
        } catch (e) {
            return { error: e.message };
        }
    }, [hand.win_type, hand.winner_name, hand.han, hand.fu, hand.score_class, hand.honba, isDealerWinner]);

    const playerNames = players.map(p => p.name).filter(Boolean);
    const dealInOptions = playerNames.filter(n => n !== hand.winner_name);

    const yakuList = hand.yaku_list || [];
    const toggleYaku = (key) => {
        const next = yakuList.includes(key) ? yakuList.filter(k => k !== key) : [...yakuList, key];
        set('yaku_list', next);
    };

    return (
        <div className="border rounded-lg bg-white shadow-sm mb-3">
            {/* 기본 한 줄 */}
            <div className="flex flex-wrap items-center gap-2 p-2 text-sm">
                <span className="font-bold text-slate-500 w-6 text-center">{hand.hand_number}</span>
                {/* 국 */}
                <select value={hand.hand_wind} onChange={e => set('hand_wind', e.target.value)} className="p-1 text-xs border border-slate-300 rounded font-bold bg-slate-50">
                    {['동','남','서','북'].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <select value={hand.hand_round_num} onChange={e => set('hand_round_num', parseInt(e.target.value))} className="p-1 text-xs border border-slate-300 rounded font-bold bg-slate-50">
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-xs text-slate-400">국</span>
                {/* 본장 */}
                <label className="text-xs text-slate-500 ml-1">본장</label>
                <input type="number" min="0" value={hand.honba || 0} onChange={e => set('honba', e.target.value === '' ? 0 : parseInt(e.target.value))} className="w-12 p-1 text-xs border border-slate-300 rounded text-center" />

                {/* 결과 */}
                <select value={hand.win_type} onChange={e => set('win_type', e.target.value)} className={'p-1.5 text-sm border border-slate-300 rounded text-center font-bold ml-2 ' + (hand.win_type === 'tsumo' ? 'bg-green-50 text-green-700' : hand.win_type === 'ron' ? 'bg-orange-50 text-orange-700' : hand.win_type === 'draw' ? 'bg-slate-100 text-slate-600' : 'bg-white')}>
                    <option value="">결과 -</option>
                    <option value="tsumo">쯔모</option>
                    <option value="ron">론</option>
                    <option value="draw">유국</option>
                </select>

                {/* 유국 외 */}
                {hand.win_type && hand.win_type !== 'draw' && (
                    <>
                        <select value={hand.winner_name} onChange={e => set('winner_name', e.target.value)} className="p-1.5 text-sm border border-slate-300 rounded font-bold text-green-700">
                            <option value="">화료자</option>
                            {playerNames.map(name => <option key={name} value={name}>{name}{dealerPlayer?.name === name ? ' (친)' : ''}</option>)}
                        </select>
                        {hand.win_type === 'ron' && (
                            <select value={hand.deal_in_name} onChange={e => set('deal_in_name', e.target.value)} className="p-1.5 text-sm border border-slate-300 rounded font-bold text-rose-700">
                                <option value="">방총자</option>
                                {dealInOptions.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        )}
                    </>
                )}

                {/* 한·부 (등급 선택 가능) */}
                {hand.win_type && hand.win_type !== 'draw' && (
                    <>
                        <input type="number" min="0" placeholder="한" value={hand.han || ''} onChange={e => set('han', e.target.value === '' ? null : parseInt(e.target.value))} className="w-12 p-1.5 text-sm border border-slate-300 rounded text-center" />
                        <input type="number" min="0" placeholder="부" value={hand.fu || ''} onChange={e => set('fu', e.target.value === '' ? null : parseInt(e.target.value))} className="w-12 p-1.5 text-sm border border-slate-300 rounded text-center" />
                        <select value={hand.score_class || ''} onChange={e => set('score_class', e.target.value || null)} className="p-1.5 text-xs border border-slate-300 rounded">
                            <option value="">등급 -</option>
                            <option value="mangan">만관</option>
                            <option value="haneman">하네만</option>
                            <option value="baiman">배만</option>
                            <option value="sanbaiman">삼배만</option>
                            <option value="yakuman">역만</option>
                            <option value="kazoe_yakuman">헤아림역만</option>
                            <option value="double_yakuman">더블역만</option>
                        </select>
                    </>
                )}

                {/* 점수 표시 */}
                {calculated && !calculated.error && (
                    <span className="ml-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-800 font-bold text-sm">
                        {calculated.text} <span className="text-xs text-amber-500">({classLabel(calculated.scoreClass) || '일반'})</span>
                    </span>
                )}
                {calculated && calculated.error && (
                    <span className="ml-2 text-xs text-red-500">계산 실패: {calculated.error}</span>
                )}

                {/* 액션 */}
                <button type="button" onClick={() => setExpanded(!expanded)} className="ml-auto text-xs text-slate-600 hover:text-slate-900 px-2 py-1 border border-slate-300 rounded">
                    {expanded ? '접기 ▲' : '상세 ▼'}
                </button>
                <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500 text-lg font-bold px-2">×</button>
            </div>

            {/* 펼침: 役 + 도라 + 토글 + 유국 텐파이 */}
            {expanded && (
                <div className="border-t border-slate-100 p-3 bg-slate-50 space-y-3">
                    {hand.win_type === 'draw' ? (
                        <div>
                            <div className="text-xs font-bold text-slate-600 mb-2">유국 시 텐파이 (체크 = 텐파이)</div>
                            <div className="flex gap-3">
                                {[['tenpai_e','동'],['tenpai_s','남'],['tenpai_w','서'],['tenpai_n','북']].map(([k,label]) => {
                                    const p = players.find(pl => pl.wind === label);
                                    return (
                                        <label key={k} className="inline-flex items-center gap-1 text-sm">
                                            <input type="checkbox" checked={!!hand[k]} onChange={e => set(k, e.target.checked)} />
                                            <span className="font-bold">{label}</span>
                                            <span className="text-xs text-slate-500">{p?.name || ''}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 자리별 리치 (공탁금 정확 추적) */}
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className="font-bold text-slate-600">리치:</span>
                                {[['riichi_e','동'],['riichi_s','남'],['riichi_w','서'],['riichi_n','북']].map(([k,label]) => {
                                    const pl = players.find(pp => pp.wind === label);
                                    return (
                                        <label key={k} className="inline-flex items-center gap-1">
                                            <input type="checkbox" checked={!!hand[k]} onChange={e => set(k, e.target.checked)} />
                                            <span><b>{label}</b><span className="text-slate-400 ml-0.5">{pl?.name ? '·' + pl.name : ''}</span></span>
                                        </label>
                                    );
                                })}
                                <span className="text-slate-300 mx-1">|</span>
                                <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!hand.is_ippatsu} onChange={e => set('is_ippatsu', e.target.checked)} /><b>일발</b></label>
                                <span className="mx-2 text-slate-300">|</span>
                                <label className="inline-flex items-center gap-1">도라 <input type="number" min="0" value={hand.dora_count || 0} onChange={e => set('dora_count', parseInt(e.target.value) || 0)} className="w-12 p-1 border border-slate-300 rounded text-center" /></label>
                                <label className="inline-flex items-center gap-1">적도라 <input type="number" min="0" value={hand.aka_dora_count || 0} onChange={e => set('aka_dora_count', parseInt(e.target.value) || 0)} className="w-12 p-1 border border-slate-300 rounded text-center" /></label>
                                <label className="inline-flex items-center gap-1">우라도라 <input type="number" min="0" value={hand.ura_dora_count || 0} onChange={e => set('ura_dora_count', parseInt(e.target.value) || 0)} className="w-12 p-1 border border-slate-300 rounded text-center" /></label>
                            </div>

                            {/* 役 체크박스 (그룹별) */}
                            <div>
                                <div className="text-xs font-bold text-slate-600 mb-1">役 (선택)</div>
                                <div className="space-y-1">
                                    {YAKU_GROUPS.filter(g => YAKU_BY_GROUP[g]).map(grp => (
                                        <div key={grp} className="flex flex-wrap gap-1 items-baseline">
                                            <span className="text-[10px] text-slate-400 font-bold w-10">{grp}</span>
                                            {YAKU_BY_GROUP[grp].map(y => (
                                                <label key={y.key} className={'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer ' + (yakuList.includes(y.key) ? 'bg-orange-100 border-orange-300 text-orange-800 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100')}>
                                                    <input type="checkbox" className="hidden" checked={yakuList.includes(y.key)} onChange={() => toggleYaku(y.key)} />
                                                    {y.label}{y.han ? ` ${y.han}` : ''}
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 자유 텍스트 */}
                            <div>
                                <label className="text-xs font-bold text-slate-600">자유 役 텍스트 (체크박스로 못 잡는 케이스)</label>
                                <input type="text" value={hand.yaku_text || ''} onChange={e => set('yaku_text', e.target.value)} placeholder="예: 리치/일발/핑허/도라1" className="w-full p-1.5 text-sm border border-slate-300 rounded mt-1" />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
