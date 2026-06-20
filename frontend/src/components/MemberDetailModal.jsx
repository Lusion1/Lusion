import React from 'react';
import { YAKU_MAP } from '../lib/yaku.js';

// props: playerName, allStats (기존 /api/stats), handStats (/api/hand-stats), yakuStats (/api/yaku-stats), onClose
export default function MemberDetailModal({ playerName, allStats = [], handStats = [], yakuStats = [], onClose }) {
    if (!playerName) return null;
    const s = allStats.find(x => x.player_name === playerName) || {};
    const h = handStats.find(x => x.player_name === playerName) || {};
    const myYaku = {};
    for (const row of yakuStats) {
        if (row.player_name === playerName) myYaku[row.yaku] = parseInt(row.cnt) || 0;
    }

    const pct = (num, den) => (den && num != null ? `${((num / den) * 100).toFixed(1)}%` : '-');
    const num = (v, digits = 1) => (v == null ? '-' : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits }));
    const int = (v) => (v == null ? '-' : Number(v).toLocaleString());

    // 平均 점수(승점) 계산 = total_uma / total_matches (대국당 우마 평균)
    const avgUma = s.total_matches > 0 ? Number(s.total_uma) / Number(s.total_matches) : null;
    const totalHands = parseInt(h.total_hands) || 0;
    const winC = parseInt(h.win_count) || 0;
    const dealInC = parseInt(h.deal_in_count) || 0;
    const oppTsumoC = parseInt(h.opp_tsumo_count) || 0;
    const drawC = parseInt(h.draw_count) || 0;
    const drawTenpaiC = parseInt(h.draw_tenpai_count) || 0;
    const riichiC = parseInt(h.riichi_count) || 0;
    const riichiWinC = parseInt(h.riichi_win_count) || 0;
    const riichiIppatsuC = parseInt(h.riichi_ippatsu_count) || 0;
    const riichiTsumoC = parseInt(h.riichi_tsumo_count) || 0;

    // 役 카탈로그 묶음
    const yakuSections = [
        // 5번: 역패/삼원패 분할. 옛 키(yakuhai/sangenpai)도 호환 카운트로 같이 표시
        { title: '1판역', keys: ['riichi','yakuhai_haku','yakuhai_hatsu','yakuhai_chun','yakuhai_seat','yakuhai_round','yakuhai','sangenpai','tanyao','pinfu','tsumo','ippatsu','iipeikou','haitei','houtei','rinshan','chankan'] },
        // 4번: sankantsu 키 그대로 (라벨만 '산깡즈'로 변경됨)
        { title: '2판역', keys: ['double_riichi','sanshoku','sanshoku_doukou','ittsu','chanta','toitoi','sanankou','sankantsu','chiitoitsu','honroutou','shousangen'] },
        { title: '3판역', keys: ['honitsu','junchan','ryanpeikou'] },
        { title: '6판역', keys: ['chinitsu'] },
        { title: '역만',  keys: ['kokushi','suuankou','daisangen','shousuushii','tsuiisou','ryuuiisou','chinroutou','chuuren','suukantsu','tenhou','chiihou'] },
        // 1번: 더블역만 3종 추가
        { title: '더블역만', keys: ['daisuushii','kokushi_13','suuankou_tanki','junsei_chuuren'] },
    ];

    // 표 한 행
    const Row = ({ label, value, hilite }) => (
        <tr className="border-b border-slate-100">
            <td className="px-3 py-1.5 text-slate-700 bg-slate-50 w-44">{label}</td>
            <td className={'px-3 py-1.5 text-right font-mono font-bold ' + (hilite || 'text-slate-800')}>{value}</td>
        </tr>
    );
    const Section = ({ title, children }) => (
        <div className="mb-4">
            <div className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-t">{title}</div>
            <table className="w-full text-sm border-collapse">{children}</table>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-stretch md:items-center justify-center">
            <div className="bg-white w-full max-w-2xl max-h-full overflow-y-auto md:rounded-2xl">
                {/* 헤더 */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                    <div>
                        <div className="text-xs text-slate-500">멤버 상세</div>
                        <div className="text-2xl font-black text-slate-900">{playerName}</div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 text-3xl px-2">×</button>
                </div>

                <div className="p-4">
                    {/* 좌측 요약 */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div className="bg-orange-50 border border-orange-200 rounded p-2">
                            <div className="text-xs text-orange-700">총 판수 (게임)</div>
                            <div className="text-xl font-black text-orange-800">{int(s.total_matches)}</div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded p-2">
                            <div className="text-xs text-amber-700">총 hand (국)</div>
                            <div className="text-xl font-black text-amber-800">{int(totalHands)}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                            <div className="text-xs text-green-700">총 우마</div>
                            <div className={'text-xl font-black ' + (Number(s.total_uma) >= 0 ? 'text-green-700' : 'text-red-500')}>{num(s.total_uma)}</div>
                        </div>
                    </div>

                    <Section title="간단 통계">
                        <tbody>
                            <Row label="1위율" value={pct(s.rank1_rate * (s.total_matches || 0), s.total_matches)} />
                            <Row label="2위율" value={pct(s.rank2_rate * (s.total_matches || 0), s.total_matches)} />
                            <Row label="3위율" value={pct(s.rank3_rate * (s.total_matches || 0), s.total_matches)} />
                            <Row label="4위율" value={pct(s.rank4_rate * (s.total_matches || 0), s.total_matches)} />
                            <Row label="토비율" value={pct(s.tobi_rate * (s.total_matches || 0), s.total_matches)} />
                            <Row label="평균 순위" value={num(s.avg_rank, 2)} />
                            <Row label="평균 승점 (대국당 우마)" value={num(avgUma, 2)} />
                        </tbody>
                    </Section>

                    <Section title="화료 통계">
                        <tbody>
                            <Row label="화료 횟수" value={int(winC)} />
                            <Row label="화료율" value={pct(winC, totalHands)} hilite="text-green-700" />
                            <Row label="평균 화료금액" value={int(Math.round(Number(h.avg_win_score) || 0))} />
                            <Row label="리치 포함 화료율" value={pct(riichiWinC, totalHands)} />
                            <Row label="리치 시 일발 화료율" value={pct(riichiIppatsuC, riichiWinC)} />
                            <Row label="리치 시 쯔모 화료율" value={pct(riichiTsumoC, riichiWinC)} />
                            <Row label="리치 횟수" value={int(riichiC)} />
                            <Row label="리치율" value={pct(riichiC, totalHands)} />
                            <Row label="후로 화료" value={int(s.furo_wins)} hilite="text-amber-700" />
                            <Row label="멘젠 화료" value={int(s.menzen_wins)} hilite="text-slate-700" />
                            <Row label="후로율 (화료 중)" value={Number(s.furo_known_wins) > 0 ? pct(s.furo_wins, s.furo_known_wins) : '- (신규 기록 필요)'} hilite="text-amber-700" />
                            <Row label="멘젠율 (화료 중)" value={Number(s.furo_known_wins) > 0 ? pct(s.menzen_wins, s.furo_known_wins) : '- (신규 기록 필요)'} hilite="text-slate-700" />
                        </tbody>
                    </Section>

                    <Section title="방총 / 상대 쯔모">
                        <tbody>
                            <Row label="방총 횟수" value={int(dealInC)} />
                            <Row label="방총율 (쏘인 비율)" value={pct(dealInC, totalHands)} hilite="text-rose-600" />
                            <Row label="평균 방총 금액" value={int(Math.round(Number(h.avg_deal_in_score) || 0))} />
                            <Row label="상대 쯔모율" value={pct(oppTsumoC, totalHands)} />
                        </tbody>
                    </Section>

                    <Section title="유국">
                        <tbody>
                            <Row label="유국 횟수" value={int(drawC)} />
                            <Row label="유국 시 텐파이율" value={pct(drawTenpaiC, drawC)} />
                        </tbody>
                    </Section>

                    <Section title="종료점">
                        <tbody>
                            <Row label="종료 시 최고점" value={int(s.max_score)} />
                            <Row label="종료 시 최저점" value={int(s.min_score)} />
                            <Row label="종료 시 평균점" value={num(s.avg_score, 0)} />
                        </tbody>
                    </Section>

                    <Section title="화료 판수 (등급별)">
                        <tbody>
                            <Row label="만관" value={int(s.total_mangan)} />
                            <Row label="하네만" value={int(s.total_haneman)} />
                            <Row label="배만" value={int(s.total_baiman)} />
                            <Row label="삼배만" value={int(s.total_sanbaiman)} />
                            <Row label="역만" value={int(s.total_yakuman)} />
                            <Row label="헤아림 역만" value={int(s.total_kazoeyakuman)} />
                            <Row label="더블 역만 이상" value={int(s.total_doubleyakuman)} />
                        </tbody>
                    </Section>

                    {/* 役 종합 */}
                    <div className="mb-2">
                        <div className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-t">役 종합</div>
                        {yakuSections.map(sec => (
                            <div key={sec.title} className="mb-2">
                                <div className="text-[11px] font-bold text-slate-500 px-3 pt-2">{sec.title}</div>
                                <table className="w-full text-sm border-collapse">
                                    <tbody>
                                        {sec.keys.map(k => {
                                            const y = YAKU_MAP[k];
                                            const label = y ? y.label : k;
                                            const cnt = myYaku[k] || 0;
                                            return (
                                                <tr key={k} className="border-b border-slate-100">
                                                    <td className="px-3 py-1 text-slate-700 w-44 bg-slate-50">{label}</td>
                                                    <td className={'px-3 py-1 text-right font-mono ' + (cnt > 0 ? 'text-slate-800 font-bold' : 'text-slate-400')}>{cnt}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
