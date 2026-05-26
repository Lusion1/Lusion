import React from 'react';
import { YAKU_MAP } from '../lib/yaku.js';

// handStats : [{player_name, total_hands, win_count, ...}, ...]
// yakuStats : [{player_name, yaku, cnt}, ...]
// allStats  : 기존 /api/stats 결과 (1~4위율 등 보조 표시용, 선택)
export default function HandStatsTable({ handStats = [], yakuStats = [], allStats = [], onMemberClick }) {
    const players = handStats.map(r => r.player_name);

    const pct = (num, den) => (den ? `${((num / den) * 100).toFixed(1)}%` : '-');
    const num = (v) => (v == null ? '-' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 }));

    const SECTIONS = [
        {
            title: '간단 통계 (hand 기준)',
            rows: [
                { label: '총 hand 수', get: r => r.total_hands },
                { label: '화료 횟수', get: r => r.win_count },
                { label: '화료율', get: r => pct(r.win_count, r.total_hands) },
                { label: '평균 화료금액', get: r => r.avg_win_score == null ? '-' : Number(r.avg_win_score).toFixed(0) },
                { label: '리치 포함 화료율', get: r => pct(r.riichi_win_count, r.total_hands) },
                { label: '리치 시 일발 화료율', get: r => pct(r.riichi_ippatsu_count, r.riichi_win_count) },
                { label: '리치 시 쯔모 화료율', get: r => pct(r.riichi_tsumo_count, r.riichi_win_count) },
                { label: '리치 횟수', get: r => r.riichi_count },
                { label: '리치율', get: r => pct(r.riichi_count, r.total_hands) },
            ],
        },
        {
            title: '방총 / 상대 쯔모',
            rows: [
                { label: '방총율', get: r => pct(r.deal_in_count, r.total_hands) },
                { label: '평균 방총 금액', get: r => r.avg_deal_in_score == null ? '-' : Number(r.avg_deal_in_score).toFixed(0) },
                { label: '상대 쯔모율', get: r => pct(r.opp_tsumo_count, r.total_hands) },
            ],
        },
        {
            title: '유국',
            rows: [
                { label: '유국 횟수', get: r => r.draw_count },
                { label: '유국 시 텐파이율', get: r => pct(r.draw_tenpai_count, r.draw_count) },
            ],
        },
        {
            title: '화료 판수 (등급별)',
            rows: [
                { label: '만관', get: r => r.mangan_h_count },
                { label: '하네만', get: r => r.haneman_h_count },
                { label: '배만', get: r => r.baiman_h_count },
                { label: '삼배만', get: r => r.sanbaiman_h_count },
                { label: '역만 (헤아림·더블 포함)', get: r => r.yakuman_h_count },
            ],
        },
    ];

    // 役 카운트를 pivot 으로 변환: yaku → { player → cnt }
    const yakuPivot = {};
    for (const row of yakuStats) {
        if (!yakuPivot[row.yaku]) yakuPivot[row.yaku] = {};
        yakuPivot[row.yaku][row.player_name] = parseInt(row.cnt) || 0;
    }
    const yakuKeys = Object.keys(yakuPivot).sort((a, b) => {
        const totalA = Object.values(yakuPivot[a]).reduce((s, v) => s + v, 0);
        const totalB = Object.values(yakuPivot[b]).reduce((s, v) => s + v, 0);
        return totalB - totalA;
    });

    if (handStats.length === 0) {
        return (
            <div className="bg-white shadow-lg rounded-xl p-6 mt-6 text-center text-slate-500">
                hand 정보가 입력된 경기가 없어 상세 통계를 표시할 수 없습니다.
            </div>
        );
    }

    return (
        <div className="bg-white shadow-lg rounded-xl p-6 mt-6 overflow-x-auto">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4">📊 상세 통계 (Hand 기반)</h2>

            {SECTIONS.map((sec, si) => (
                <div key={si} className="mb-6">
                    <h3 className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded">{sec.title}</h3>
                    <table className="w-full text-sm border-collapse mt-1 min-w-[600px]">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600">
                                <th className="p-2 text-left border-b border-slate-200 w-44">항목</th>
                                {players.map(name => (
                                    <th key={name} className="p-2 text-center border-b border-slate-200 cursor-pointer hover:underline" onClick={() => onMemberClick && onMemberClick(name)} title="클릭: 상세 통계">{name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sec.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-2 text-slate-700 font-medium">{row.label}</td>
                                    {handStats.map(r => (
                                        <td key={r.player_name} className="p-2 text-center font-mono">{row.get(r)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            {yakuKeys.length > 0 && (
                <div className="mb-2">
                    <h3 className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded">役별 카운트</h3>
                    <table className="w-full text-sm border-collapse mt-1 min-w-[600px]">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600">
                                <th className="p-2 text-left border-b border-slate-200 w-44">役</th>
                                {players.map(name => (
                                    <th key={name} className="p-2 text-center border-b border-slate-200 cursor-pointer hover:underline" onClick={() => onMemberClick && onMemberClick(name)} title="클릭: 상세 통계">{name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {yakuKeys.map(yk => {
                                const yakuDef = YAKU_MAP[yk];
                                const label = yakuDef ? yakuDef.label : yk;
                                return (
                                    <tr key={yk} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-2 text-slate-700 font-medium">{label}</td>
                                        {players.map(name => (
                                            <td key={name} className="p-2 text-center font-mono">{yakuPivot[yk][name] || '-'}</td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
