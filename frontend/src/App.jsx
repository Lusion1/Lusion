import React, { useState, useEffect } from 'react';
import HandRow from './components/HandRow.jsx';

import MobileRecorder from './components/MobileRecorder.jsx';
import MemberDetailModal from './components/MemberDetailModal.jsx';
import SuggestionBoard from './components/SuggestionBoard.jsx';
import { calcScore, calcRoundResult, calcClassCounts } from './lib/score.js';

const API_BASE = '/api';

export default function App() {
    const [authToken, setAuthToken] = useState(localStorage.getItem('mahjong_token') || null);
    const [userRole, setUserRole] = useState(localStorage.getItem('mahjong_role') || null);
    const [loginId, setLoginId] = useState(localStorage.getItem('mahjong_login_id') || '');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [activeTab, setActiveTab] = useState(localStorage.getItem('mahjong_role') === 'admin' ? 'new-record' : 'stats');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [stats, setStats] = useState([]);
    const [dailyStats, setDailyStats] = useState([]);
    const [handStats, setHandStats] = useState([]);
    const [detailMember, setDetailMember] = useState(null);
    const [yakuStats, setYakuStats] = useState([]);
    const [players, setPlayers] = useState([]);
    const [newPlayerName, setNewPlayerName] = useState('');

    // Rival comparison state
    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    const [rivalData, setRivalData] = useState(null);

    const [records, setRecords] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statsSearchQuery, setStatsSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [globalYear, setGlobalYear] = useState('2026');

    // New Record State
    const getTodayString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const emptyPlayerRow = { name: '', score: '', mangan: '', haneman: '', baiman: '', sanbaiman: '', yakuman: '', kazoeyakuman: '', doubleyakuman: '' };
    const [newRecordDate, setNewRecordDate] = useState(getTodayString());
    const [editingRound, setEditingRound] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newPlayers, setNewPlayers] = useState([
        { ...emptyPlayerRow, wind: '동' },
        { ...emptyPlayerRow, wind: '남' },
        { ...emptyPlayerRow, wind: '서' },
        { ...emptyPlayerRow, wind: '북' }
    ]);

    // === Hand(국) 기록 관련 ===
    // 기본 동남전 = 8국 (동1~동4, 남1~남4). 부족하면 "국 추가" 로 늘릴 수 있음.
    const makeEmptyHand = (handNumber) => {
        const windOrder = ['동', '남', '서', '북'];
        const wind = windOrder[Math.floor((handNumber - 1) / 4)] || '북';
        const roundNum = ((handNumber - 1) % 4) + 1;
        return {
            hand_number: handNumber,
            hand_wind: wind,
            hand_round_num: roundNum,
            win_type: '',
            winner_name: '',
            deal_in_name: '',
            win_score: '',
            honba: 0,
            han: null,
            fu: null,
            score_class: null,
            is_riichi: false,
            is_ippatsu: false,
            riichi_e: false,
            riichi_s: false,
            riichi_w: false,
            riichi_n: false,
            dora_count: 0,
            aka_dora_count: 0,
            ura_dora_count: 0,
            yaku_list: [],
            yaku_text: '',
            tenpai_e: false,
            tenpai_s: false,
            tenpai_w: false,
            tenpai_n: false,
        };
    };
    const getDefaultHands = () => Array.from({ length: 8 }, (_, i) => makeEmptyHand(i + 1));
    const [newHands, setNewHands] = useState(getDefaultHands());

    // Stats sort state
    const [sortConfig, setSortConfig] = useState({ key: 'total_uma', direction: 'desc' });

    useEffect(() => {
        fetch(`${API_BASE}/records?limit=10000&year=${globalYear}`)
            .then(res => res.json())
            .then(data => setRecords(data))
            .catch(err => console.error(err));

        fetch(`${API_BASE}/stats?year=${globalYear}`)
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error(err));

        fetch(`${API_BASE}/daily-stats`)
            .then(res => res.json())
            .then(data => setDailyStats(data))
            .catch(err => console.error(err));

        fetch(`${API_BASE}/hand-stats?year=${globalYear}`)
            .then(res => res.json())
            .then(data => setHandStats(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));

        fetch(`${API_BASE}/yaku-stats?year=${globalYear}`)
            .then(res => res.json())
            .then(data => setYakuStats(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));

        fetch(`${API_BASE}/players`)
            .then(res => res.json())
            .then(data => {
                console.log('Players fetched:', data);
                setPlayers(data);
            })
            .catch(err => console.error(err));
    }, [globalYear]);

    // Fetch players once on mount too
    useEffect(() => {
        fetch(`${API_BASE}/players`)
            .then(res => res.json())
            .then(data => setPlayers(data))
            .catch(err => console.error(err));
    }, []);

    // user 권한일 때 관리자 전용 탭에 들어와 있으면 자동으로 stats 로 이동
    useEffect(() => {
        if (userRole !== 'admin' && activeTab === 'member-admin') {
            setActiveTab('stats');
        }
    }, [userRole, activeTab]);

    const handleRivalCompare = () => {
        if (!p1 || !p2) return;
        fetch(`${API_BASE}/rival-comparison?p1=${p1}&p2=${p2}&year=${globalYear}`)
            .then(res => res.json())
            .then(data => setRivalData({ p1, p2, ...data }))
            .catch(err => console.error(err));
    };

    // Re-fetch rival comparison if globalYear changes
    useEffect(() => {
        if (p1 && p2) handleRivalCompare();
    }, [globalYear]);

    const calcRankAndUma = (players) => {
        const parsed = players.map(p => ({ ...p, parsedScore: parseInt(p.score) }));
        if (parsed.some(p => isNaN(p.parsedScore))) return players;

        const sorted = [...parsed].sort((a, b) => b.parsedScore - a.parsedScore);
        const umaBonus = [40, 10, -10, -20];

        sorted.forEach((p, idx) => {
            p.calculatedRank = idx + 1;
            p.calculatedUma = Number((((p.parsedScore - 30000) / 1000) + umaBonus[idx]).toFixed(1));
        });

        return players.map(p => {
            const found = sorted.find(s => s.wind === p.wind);
            return { ...p, rank: found.calculatedRank, uma: found.calculatedUma };
        });
    };

    const handleSubmitRecord = async () => {
        const parsed = newPlayers.map(p => ({ ...p, parsedScore: parseInt(p.score) }));
        if (parsed.some(p => isNaN(p.parsedScore) || !p.name)) {
            alert('모든 플레이어의 이름과 점수를 올바르게 입력해주세요.');
            return;
        }

        // Validate names against registered players
        const registeredNames = new Set(players.map(p => p.name));
        const unregistered = parsed.filter(p => !registeredNames.has(p.name));
        if (unregistered.length > 0) {
            alert(`등록되지 않은 멤버가 있습니다: ${unregistered.map(p => p.name).join(', ')}\n'멤버 관리' 탭에서 먼저 등록해주세요.`);
            return;
        }

        const totalScore = parsed.reduce((sum, p) => sum + p.parsedScore, 0);
        if (totalScore !== 100000) {
            alert(`점수 합계가 100,000점이 아닙니다. 현재: ${totalScore}`);
            return;
        }

        // === hand 데이터 검증 (입력된 행만 추출) ===
        const filledHands = newHands.filter(h => h.win_type);
        for (const h of filledHands) {
            if (h.win_type !== 'draw' && !h.winner_name) {
                alert(`${h.hand_wind}${h.hand_round_num}국: 화료자를 선택해주세요.`);
                return;
            }
            if (h.win_type === 'ron' && !h.deal_in_name) {
                alert(`${h.hand_wind}${h.hand_round_num}국: 방총자를 선택해주세요.`);
                return;
            }
            if (h.win_type === 'ron' && h.winner_name === h.deal_in_name) {
                alert(`${h.hand_wind}${h.hand_round_num}국: 화료자와 방총자가 같을 수 없습니다.`);
                return;
            }
        }
        const handsToSend = filledHands
            .sort((a, b) => a.hand_number - b.hand_number)
            .map((h, i) => {
                // 친 자리 자동 판정
                const dealerPlayer = newPlayers.find(p => p.wind === h.hand_wind);
                const isDealerWinner = dealerPlayer && dealerPlayer.name === h.winner_name;
                // 자동 점수 계산
                let calc = null;
                if (h.win_type !== 'draw' && h.winner_name) {
                    try {
                        if ((h.score_class && h.score_class !== 'normal') || (h.han && h.fu)) {
                            calc = calcScore({
                                isDealerWinner,
                                winType: h.win_type,
                                han: h.han ? parseInt(h.han) : undefined,
                                fu:  h.fu  ? parseInt(h.fu)  : undefined,
                                scoreClass: h.score_class,
                                honba: parseInt(h.honba) || 0,
                            });
                        }
                    } catch (e) { console.warn('점수계산 실패 hand_number=' + h.hand_number, e.message); }
                }
                return {
                    hand_number: i + 1,
                    hand_wind: h.hand_wind,
                    hand_round_num: Number(h.hand_round_num),
                    win_type: h.win_type,
                    winner_name: h.win_type === 'draw' ? null : h.winner_name,
                    deal_in_name: h.win_type === 'ron'  ? h.deal_in_name : null,
                    win_score: h.win_score === '' ? null : parseInt(h.win_score),
                    honba: parseInt(h.honba) || 0,
                    han: h.han || null,
                    fu: h.fu || null,
                    score_class: calc ? calc.scoreClass : (h.score_class || null),
                    is_dealer_winner: !!isDealerWinner,
                    is_riichi: !!h.is_riichi,
                    is_ippatsu: !!h.is_ippatsu,
                    riichi_e: !!h.riichi_e,
                    riichi_s: !!h.riichi_s,
                    riichi_w: !!h.riichi_w,
                    riichi_n: !!h.riichi_n,
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
                };
            });

        setIsSubmitting(true);
        try {
            const url = editingRound ? `${API_BASE}/records/${editingRound}` : `${API_BASE}/records`;
            const method = editingRound ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    date: newRecordDate,
                    players: newPlayers.map(p => ({
                        wind: p.wind,
                        name: p.name,
                        score: parseInt(p.score),
                        rank: p.rank,
                        uma: p.uma,
                        mangan: parseInt(p.mangan) || 0,
                        haneman: parseInt(p.haneman) || 0,
                        baiman: parseInt(p.baiman) || 0,
                        sanbaiman: parseInt(p.sanbaiman) || 0,
                        yakuman: parseInt(p.yakuman) || 0,
                        kazoeyakuman: parseInt(p.kazoeyakuman) || 0,
                        doubleyakuman: parseInt(p.doubleyakuman) || 0
                    })),
                    hands: handsToSend
                })
            });

            if (res.ok) {
                alert(editingRound ? '기록이 성공적으로 수정되었습니다!' : '기록이 성공적으로 저장되었습니다!');
                window.location.reload();
            } else {
                const msg = await res.text();
                console.error('save failed:', res.status, msg);
                if (res.status === 401 || res.status === 403) {
                    alert('인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.\n(' + (msg || res.status) + ')');
                } else if (msg && msg.includes('hand_results') && msg.toLowerCase().includes('does not exist')) {
                    alert('hand_results 테이블이 없습니다. Supabase SQL Editor 에서 sql/001_hand_results.sql 을 실행해주세요.\n\n원본 에러: ' + msg);
                } else {
                    alert('저장 중 오류가 발생했습니다 (' + res.status + '): ' + (msg || '응답 본문 없음'));
                }
            }
        } catch (e) {
            console.error(e);
            alert('저장 중 서버와 통신할 수 없습니다.\n(' + e.message + ')');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClearRecord = () => {
        if (window.confirm(editingRound ? '수정 중인 내용을 취소하시겠습니까?' : '입력된 모든 경기 기록을 초기화하시겠습니까?')) {
            setNewRecordDate(getTodayString());
            setEditingRound(null);
            setNewPlayers([
                { ...emptyPlayerRow, wind: '동' },
                { ...emptyPlayerRow, wind: '남' },
                { ...emptyPlayerRow, wind: '서' },
                { ...emptyPlayerRow, wind: '북' }
            ]);
            setNewHands(getDefaultHands());
        }
    };

    // === Hand 입력 UI 헬퍼 ===
    const updateHand = (idx, field, value) => {
        setNewHands(prev => prev.map((h, i) => {
            if (i !== idx) return h;
            const updated = { ...h, [field]: value };
            if (field === 'win_type') {
                if (value === 'draw') {
                    updated.winner_name = '';
                    updated.deal_in_name = '';
                } else if (value === 'tsumo') {
                    updated.deal_in_name = '';
                }
            }
            return updated;
        }));
    };
    const addHandRow = () => {
        setNewHands(prev => [...prev, makeEmptyHand(prev.length + 1)]);
    };
    const removeHandRow = (idx) => {
        setNewHands(prev => prev.filter((_, i) => i !== idx).map((h, i) => ({ ...h, hand_number: i + 1 })));
    };

    const renderDashboard = () => {
        const dashboardCategories = [
            { title: '🏫 개근상', item: '최다경기', key: 'total_matches', sort: 'desc', format: v => v },
            { title: '👑 시즌 MVP', item: '총 우마', key: 'total_uma', sort: 'desc', format: v => Number(v).toFixed(1) },
            { title: '👑 천상천하', item: '평균우마', key: 'avg_uma', sort: 'desc', format: v => Number(v).toFixed(2) },
            { title: '👊 파괴신', item: '평균득점', key: 'avg_score', sort: 'desc', format: v => Number(v).toFixed(0) },
            { title: '🎯 승률왕', item: '1위율', key: 'rank1_rate', sort: 'desc', format: v => `${(v * 100).toFixed(1)}%` },
            { title: '🚪 뒤에서 1등', item: '4위율', key: 'rank4_rate', sort: 'desc', format: v => `${(v * 100).toFixed(1)}%` },
            { title: '🛡️ 철벽 수비', item: '4위율(최저)', key: 'rank4_rate', sort: 'asc', format: v => `${(v * 100).toFixed(1)}%` },
            { title: '🔝 상위권 지박령', item: '연대율', key: 'rank12_rate', sort: 'desc', format: v => `${(v * 100).toFixed(1)}%` },
            { title: '💪 금강불괴', item: '토비방어율', key: 'tobi_rate', sort: 'asc', format: v => (v === 0 || v === '0' || Number(v) === 0 ? '-' : `${(v * 100).toFixed(1)}%`) },
            { title: '🎓 수석 졸업', item: '평균 순위', key: 'avg_rank', sort: 'asc', format: v => Number(v).toFixed(2) },
            { title: '💣 한방의 제왕', item: '종료시 최고점', key: 'max_score', sort: 'desc', format: v => v === null ? '-' : Number(v).toLocaleString() },
            { title: '📉 나락의 끝', item: '종료시 최저점', key: 'min_score', sort: 'asc', format: v => v === null ? '-' : Number(v).toLocaleString() },
            { title: '😭 억울한 2등', item: '2위 최고점', key: 'max_score_rank2', sort: 'desc', format: v => v === null ? '-' : Number(v).toLocaleString() },
            { title: '💸 기부천사', item: '토비율', key: 'tobi_rate', sort: 'desc', format: v => `${(v * 100).toFixed(1)}%` },
        ];

        const minMatchesInfo = (() => {
            // 전체 모드: 2026년 6월부터 40국 시작, 매월 +5국 누적 증가
            if (globalYear === 'all') {
                const baseYear = 2026, baseMonth = 6, baseMin = 40, incPerMonth = 5;
                const now = new Date();
                const elapsed = (now.getFullYear() - baseYear) * 12 + (now.getMonth() + 1 - baseMonth);
                const min = baseMin + Math.max(0, elapsed) * incPerMonth;
                return { min, label: `전체 기록 · ${min}국 이상 기준 (2026년 6월부터 매월 +5국)` };
            }
            const year = parseInt(globalYear);
            if (year <= 2025) return { min: 10, label: `${year}년 · 10국 이상 기준` };
            const currentMonth = new Date().getMonth() + 1; // 1~12
            const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
            const min = 5 * currentMonth;
            return { min, label: `${year}년 ${monthNames[currentMonth - 1]} 기준: ${min}국 이상 (매월 5국씩 증가)` };
        })();
        const minMatches = minMatchesInfo.min;

        const getSortedForCategory = (key, direction) => {
            const list = key === 'total_matches' ? stats : stats.filter(s => s.total_matches >= minMatches);
            if (list.length === 0) return [];

            return [...list].sort((a, b) => {
                let valA = a[key] === null || a[key] === undefined ? (direction === 'asc' ? Infinity : -Infinity) : Number(a[key]);
                let valB = b[key] === null || b[key] === undefined ? (direction === 'asc' ? Infinity : -Infinity) : Number(b[key]);

                if (valA !== valB) {
                    return direction === 'asc' ? valA - valB : valB - valA;
                }
                // If tied, sort by total_matches desc
                return Number(b.total_matches) - Number(a.total_matches);
            }).slice(0, 3);
        };

        return (
            <div className="bg-white shadow-lg rounded-xl p-6 overflow-x-auto">
                <div className="flex justify-between items-center border-b pb-3 mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 gap-2 flex items-center">
                        <span>🏛️</span> 명예의 전당
                    </h2>
                    <span className="text-sm font-bold bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full border border-slate-200">
                        {minMatchesInfo.label} (동점시 판수 우선)
                    </span>
                </div>

                <table className="w-full text-center border-collapse text-sm whitespace-nowrap min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-900 text-white border-b-2 border-slate-700 sticky-top">
                            <th className="p-3 border-r border-slate-700 rounded-tl-lg font-bold">타이틀</th>
                            <th className="p-3 border-r border-slate-700 font-bold">항목</th>
                            <th colSpan="2" className="p-3 border-r border-slate-700 font-bold text-yellow-500">🥇 1위</th>
                            <th colSpan="2" className="p-3 border-r border-slate-700 font-bold text-slate-400">🥈 2위</th>
                            <th colSpan="2" className="p-3 rounded-tr-lg font-bold text-orange-400">🥉 3위</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dashboardCategories.map((cat, idx) => {
                            const top3 = getSortedForCategory(cat.key, cat.sort);
                            return (
                                <tr key={idx} className="border-b transition hover:bg-slate-50 border-slate-100">
                                    <td className="p-3 font-bold text-slate-800 border-r border-slate-100 bg-slate-50 text-left">{cat.title}</td>
                                    <td className="p-3 font-medium text-slate-600 border-r border-slate-100">{cat.item}</td>

                                    <td className="p-3 font-black text-slate-800 border-r border-slate-100">{top3[0]?.player_name || '-'}</td>
                                    <td className={`p-3 font-bold border-r border-slate-100 ${top3[0] ? 'text-orange-600' : 'text-slate-400'}`}>
                                        {top3[0] && top3[0][cat.key] !== null && top3[0][cat.key] !== undefined ? cat.format(top3[0][cat.key]) : '-'}
                                    </td>

                                    <td className="p-3 font-bold text-slate-700 border-r border-slate-100">{top3[1]?.player_name || '-'}</td>
                                    <td className={`p-3 font-medium border-r border-slate-100 ${top3[1] ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {top3[1] && top3[1][cat.key] !== null && top3[1][cat.key] !== undefined ? cat.format(top3[1][cat.key]) : '-'}
                                    </td>

                                    <td className="p-3 font-bold text-slate-700 border-r border-slate-100">{top3[2]?.player_name || '-'}</td>
                                    <td className={`p-3 font-medium ${top3[2] ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {top3[2] && top3[2][cat.key] !== null && top3[2][cat.key] !== undefined ? cat.format(top3[2][cat.key]) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const getRankColor = (index) => {
        if (index === 0) return 'text-green-600 font-bold';
        if (index === stats.length - 1) return 'text-red-500 font-bold';
        return 'text-slate-700 font-medium';
    };

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return null;
        return <span className="ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    const sortedStats = [...stats].sort((a, b) => {
        const valA = a[sortConfig.key] === null || a[sortConfig.key] === undefined ? 0 : a[sortConfig.key];
        const valB = b[sortConfig.key] === null || b[sortConfig.key] === undefined ? 0 : b[sortConfig.key];

        let numA = Number(valA);
        let numB = Number(valB);

        if (sortConfig.key === 'player_name') {
            numA = valA.toString();
            numB = valB.toString();
        }

        if (numA < numB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (numA > numB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const renderStats = () => (
        <div className="bg-white shadow-lg rounded-xl p-6 overflow-auto max-h-[85vh]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                <h2 className="text-2xl font-bold text-slate-800">
                    전체 통계 <span className="text-sm font-normal text-slate-400 ml-2">(헤더를 클릭하면 정렬됩니다)</span>
                </h2>
                <input
                    type="text"
                    placeholder="플레이어 이름 검색 (강조)..."
                    value={statsSearchQuery}
                    onChange={(e) => setStatsSearchQuery(e.target.value)}
                    className="w-full md:w-64 border-2 border-slate-200 p-2 rounded-lg bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
                />
            </div>
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-900 text-white text-center cursor-pointer select-none">
                        <th className="p-3 border-r border-slate-700 font-bold hover:bg-slate-800 transition sticky-left bg-slate-900 z-[31]" onClick={() => requestSort('player_name')}>이름 {getSortIndicator('player_name')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('total_matches')}>총 게임수 {getSortIndicator('total_matches')}</th>
                        <th className="p-3 border-r border-slate-700 text-orange-400 hover:bg-slate-800 transition" onClick={() => requestSort('avg_rank')}>평균 순위 {getSortIndicator('avg_rank')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('avg_uma')}>평균 우마 {getSortIndicator('avg_uma')}</th>
                        <th className="p-3 border-r border-slate-700 font-bold hover:bg-slate-800 transition" onClick={() => requestSort('total_uma')}>총 우마 {getSortIndicator('total_uma')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('rank1_rate')}>1위율 {getSortIndicator('rank1_rate')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('rank2_rate')}>2위율 {getSortIndicator('rank2_rate')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('rank3_rate')}>3위율 {getSortIndicator('rank3_rate')}</th>
                        <th className="p-3 border-r border-slate-700 text-red-300 hover:bg-slate-800 transition" onClick={() => requestSort('rank4_rate')}>4위율 {getSortIndicator('rank4_rate')}</th>
                        <th className="p-3 border-r border-slate-700 text-purple-300 hover:bg-slate-800 transition" onClick={() => requestSort('tobi_rate')}>토비율 {getSortIndicator('tobi_rate')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('rank12_rate')}>연대율 {getSortIndicator('rank12_rate')}</th>
                        <th className="p-3 border-r border-slate-700 text-green-300 hover:bg-slate-800 transition" onClick={() => requestSort('win_rate')}>화료율 {getSortIndicator('win_rate')}</th>
                        <th className="p-3 border-r border-slate-700 text-emerald-300 hover:bg-slate-800 transition" onClick={() => requestSort('tsumo_rate')}>쯔모율 {getSortIndicator('tsumo_rate')}</th>
                        <th className="p-3 border-r border-slate-700 text-rose-300 hover:bg-slate-800 transition" onClick={() => requestSort('deal_in_rate')}>방총율 {getSortIndicator('deal_in_rate')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('max_score')}>최고 점수 {getSortIndicator('max_score')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('min_score')}>최저 점수 {getSortIndicator('min_score')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('avg_score')}>평균 득점 {getSortIndicator('avg_score')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('count_east')}>동 착석 {getSortIndicator('count_east')}</th>
                        <th className="p-3 border-r border-slate-700 text-blue-300 hover:bg-slate-800 transition" onClick={() => requestSort('avg_rank_east')}>동 평균순위 {getSortIndicator('avg_rank_east')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('count_south')}>남 착석 {getSortIndicator('count_south')}</th>
                        <th className="p-3 border-r border-slate-700 text-blue-300 hover:bg-slate-800 transition" onClick={() => requestSort('avg_rank_south')}>남 평균순위 {getSortIndicator('avg_rank_south')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('count_west')}>서 착석 {getSortIndicator('count_west')}</th>
                        <th className="p-3 border-r border-slate-700 text-blue-300 hover:bg-slate-800 transition" onClick={() => requestSort('avg_rank_west')}>서 평균순위 {getSortIndicator('avg_rank_west')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('count_north')}>북 착석 {getSortIndicator('count_north')}</th>
                        <th className="p-3 border-r border-slate-700 text-blue-300 hover:bg-slate-800 transition" onClick={() => requestSort('avg_rank_north')}>북 평균순위 {getSortIndicator('avg_rank_north')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('total_mangan')}>만관 {getSortIndicator('total_mangan')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('total_haneman')}>하네만 {getSortIndicator('total_haneman')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('total_baiman')}>배만 {getSortIndicator('total_baiman')}</th>
                        <th className="p-3 border-r border-slate-700 text-orange-400 hover:bg-slate-800 transition" onClick={() => requestSort('total_sanbaiman')}>삼배만 {getSortIndicator('total_sanbaiman')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('total_yakuman')}>역만 {getSortIndicator('total_yakuman')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('total_kazoeyakuman')}>헤아림역만 {getSortIndicator('total_kazoeyakuman')}</th>
                        <th className="p-3 rounded-tr-lg hover:bg-slate-800 transition" onClick={() => requestSort('total_doubleyakuman')}>더블역만 이상 {getSortIndicator('total_doubleyakuman')}</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedStats.map((s, idx) => {
                        const isHighlighted = statsSearchQuery.trim() !== '' && s.player_name.toLowerCase().includes(statsSearchQuery.toLowerCase());
                        return (
                            <tr key={s.player_name} className={`border-b transition text-center ${isHighlighted ? 'bg-orange-100 hover:bg-orange-200 border-orange-300' : 'hover:bg-slate-50 border-slate-100'}`}>
                                <td className={`p-3 font-bold border-r sticky-left z-20 cursor-pointer hover:underline ${isHighlighted ? 'border-orange-200 text-orange-900 bg-orange-100' : 'border-slate-100 text-slate-800 bg-white'}`} onClick={() => setDetailMember(s.player_name)} title="클릭: 상세 통계"><span className="text-xs text-slate-400 mr-1">{idx + 1}</span> {s.player_name}</td>
                                <td className={`p-3 font-medium border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{s.total_matches}</td>
                                <td className={`p-3 font-black border-r ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${getRankColor(idx)}`}>{Number(s.avg_rank).toFixed(2)}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.avg_uma > 0 ? 'text-green-600' : 'text-red-500'}`}>{Number(s.avg_uma).toFixed(2)}</td>
                                <td className={`p-3 font-black border-r ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.total_uma > 0 ? 'text-green-600' : 'text-red-500'}`}>{Number(s.total_uma).toFixed(1)}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{(s.rank1_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{(s.rank2_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{(s.rank3_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 border-r text-red-500 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{(s.rank4_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 font-bold border-r text-purple-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{(s.tobi_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 font-bold border-r ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${(s.rank12_rate * 100) >= 50 ? 'text-green-600' : ''}`}>{(s.rank12_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 font-bold border-r text-green-700 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>
                                    {s.win_rate == null ? '-' : `${(s.win_rate * 100).toFixed(1)}%`}
                                    {s.hands_participated > 0 && <span className="ml-1 text-[10px] text-slate-400">({s.win_count}/{s.hands_participated})</span>}
                                </td>
                                <td className={`p-3 font-bold border-r text-emerald-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>
                                    {s.tsumo_rate == null ? '-' : `${(s.tsumo_rate * 100).toFixed(1)}%`}
                                </td>
                                <td className={`p-3 font-bold border-r text-rose-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>
                                    {s.deal_in_rate == null ? '-' : `${(s.deal_in_rate * 100).toFixed(1)}%`}
                                    {s.hands_participated > 0 && <span className="ml-1 text-[10px] text-slate-400">({s.deal_in_count}/{s.hands_participated})</span>}
                                </td>
                                <td className={`p-3 border-r text-blue-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{Number(s.max_score).toLocaleString()}</td>
                                <td className={`p-3 border-r text-red-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{Number(s.min_score).toLocaleString()}</td>
                                <td className={`p-3 border-r w-full whitespace-nowrap ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{Number(s.avg_score).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{s.count_east}</td>
                                <td className={`p-3 border-r font-bold ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.avg_rank_east ? 'text-blue-600' : 'text-slate-400'}`}>{s.avg_rank_east ? Number(s.avg_rank_east).toFixed(2) : '-'}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{s.count_south}</td>
                                <td className={`p-3 border-r font-bold ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.avg_rank_south ? 'text-blue-600' : 'text-slate-400'}`}>{s.avg_rank_south ? Number(s.avg_rank_south).toFixed(2) : '-'}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{s.count_west}</td>
                                <td className={`p-3 border-r font-bold ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.avg_rank_west ? 'text-blue-600' : 'text-slate-400'}`}>{s.avg_rank_west ? Number(s.avg_rank_west).toFixed(2) : '-'}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{s.count_north}</td>
                                <td className={`p-3 border-r font-bold ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.avg_rank_north ? 'text-blue-600' : 'text-slate-400'}`}>{s.avg_rank_north ? Number(s.avg_rank_north).toFixed(2) : '-'}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{Number(s.total_mangan) || '-'}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{Number(s.total_haneman) || '-'}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{Number(s.total_baiman) || '-'}</td>
                                <td className={`p-3 font-bold border-r text-orange-500 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{Number(s.total_sanbaiman) || '-'}</td>
                                <td className={`p-3 font-black border-r text-pink-500 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{Number(s.total_yakuman) || '-'}</td>
                                <td className={`p-3 font-black border-r text-pink-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{Number(s.total_kazoeyakuman) || '-'}</td>
                                <td className={`p-3 font-black text-pink-700`}>{Number(s.total_doubleyakuman) || '-'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderRival = () => (
        <div className="space-y-6">
            <div className="bg-white shadow-lg rounded-xl p-6">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 border-b pb-2">라이벌 분석 (Rival Comparison)</h2>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <select value={p1} onChange={(e) => setP1(e.target.value)} className="border-2 border-slate-200 p-3 rounded-lg flex-1 bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition">
                        <option value="">플레이어 1 선택</option>
                        {stats.map(s => <option key={s.player_name} value={s.player_name}>{s.player_name}</option>)}
                    </select>
                    <div className="flex items-center justify-center font-black text-2xl text-slate-400 italic px-4">VS</div>
                    <select value={p2} onChange={(e) => setP2(e.target.value)} className="border-2 border-slate-200 p-3 rounded-lg flex-1 bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition">
                        <option value="">플레이어 2 선택</option>
                        {stats.map(s => <option key={s.player_name} value={s.player_name}>{s.player_name}</option>)}
                    </select>
                    <button onClick={handleRivalCompare} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-lg shadow-md transition-colors whitespace-nowrap">분석하기</button>
                </div>
            </div>

            {rivalData && rivalData.headToHead && (
                <div className="space-y-6">
                    {/* Section 3: Compatibility Flag */}
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl rounded-xl p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 border-[40px] border-transparent border-t-orange-500 border-r-orange-500 opacity-20"></div>
                        <h3 className="text-sm font-bold tracking-widest text-orange-400 mb-2">MATCH COMPATIBILITY</h3>
                        <div className="text-4xl font-black mb-4">{rivalData.headToHead.title}</div>
                        <p className="text-lg text-slate-300">{rivalData.headToHead.desc}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section 1: Individual Stats */}
                        <div className="bg-white shadow-lg rounded-xl p-6">
                            <h3 className="text-lg font-bold mb-4 text-slate-800 border-b pb-2">개인 통계 (전체 기록)</h3>
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg">
                                <div className="text-center w-5/12">
                                    <div className="font-black text-xl text-slate-900 mb-1">{p1}</div>
                                    <div className="text-sm text-slate-500">평균 순위 <span className="font-bold text-slate-800">{Number(rivalData.p1Stats?.avg_rank || 0).toFixed(2)}</span></div>
                                    <div className="text-sm text-slate-500">누적 우마 <span className={`font-bold ${rivalData.p1Stats?.total_uma > 0 ? 'text-green-600' : 'text-red-500'}`}>{Number(rivalData.p1Stats?.total_uma || 0).toFixed(1)}</span></div>
                                </div>
                                <div className="w-2/12 text-center text-slate-300 font-bold text-xl">/</div>
                                <div className="text-center w-5/12">
                                    <div className="font-black text-xl text-slate-900 mb-1">{p2}</div>
                                    <div className="text-sm text-slate-500">평균 순위 <span className="font-bold text-slate-800">{Number(rivalData.p2Stats?.avg_rank || 0).toFixed(2)}</span></div>
                                    <div className="text-sm text-slate-500">누적 우마 <span className={`font-bold ${rivalData.p2Stats?.total_uma > 0 ? 'text-green-600' : 'text-red-500'}`}>{Number(rivalData.p2Stats?.total_uma || 0).toFixed(1)}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Head-to-Head */}
                        <div className="bg-white shadow-lg rounded-xl p-6">
                            <h3 className="text-lg font-bold mb-4 text-slate-800 border-b pb-2">상대 전적 (맞대결)</h3>
                            <div className="text-center flex flex-col justify-center h-full pb-6">
                                <div className="text-sm font-bold text-slate-500 mb-2">동반 출전: {rivalData.headToHead.matchesCount}판</div>
                                <div className="flex justify-center items-center gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-4xl font-black text-slate-900">{rivalData.headToHead.p1Wins}승</span>
                                        <span className="text-sm text-slate-400 mt-1">{p1}</span>
                                    </div>
                                    <div className="text-slate-300 font-bold text-lg">무승부 {rivalData.headToHead.draws}</div>
                                    <div className="flex flex-col">
                                        <span className="text-4xl font-black text-slate-900">{rivalData.headToHead.p2Wins}승</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Match List */}
                        <div className="bg-white shadow-lg rounded-xl p-6 md:col-span-2 overflow-x-auto">
                            <h3 className="text-lg font-bold mb-4 text-slate-800 border-b pb-2">경기 목록</h3>
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-900 text-white font-bold">
                                        <th className="p-3 rounded-tl-lg whitespace-nowrap min-w-[100px]">날짜</th>
                                        <th className="p-3 whitespace-nowrap min-w-[70px]">라운드</th>
                                        <th className="p-3 text-center">순위/점수 ({p1})</th>
                                        <th className="p-3 text-center rounded-tr-lg">순위/점수 ({p2})</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rivalData.matches.map((m, idx) => (
                                        <tr key={idx} className="border-b hover:bg-slate-50 transition border-slate-100">
                                            <td className="p-3 whitespace-nowrap text-slate-600">{new Date(m.match_date).toLocaleDateString()}</td>
                                            <td className="p-3 font-bold text-slate-800 whitespace-nowrap">R{m.round}</td>
                                            <td className={`p-3 text-center font-bold ${m.rank1 === 1 ? 'text-yellow-600' : m.rank1 === 4 ? 'text-slate-400' : 'text-slate-700'}`}>
                                                {m.rank1}위 / {m.score1}점
                                            </td>
                                            <td className={`p-3 text-center font-bold ${m.rank2 === 1 ? 'text-yellow-600' : m.rank2 === 4 ? 'text-slate-400' : 'text-slate-700'}`}>
                                                {m.rank2}위 / {m.score2}점
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const handleEditRound = async (group) => {
        if (!group || group.length === 0) return;
        const round = group[0].round;
        const date = new Date(group[0].match_date);
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const mappedPlayers = ['동', '남', '서', '북'].map(wind => {
            const player = group.find(p => p.wind === wind);
            if (player) {
                return {
                    wind,
                    name: player.player_name,
                    score: player.final_score,
                    rank: player.rank,
                    uma: player.uma,
                    mangan: player.mangan || '',
                    haneman: player.haneman || '',
                    baiman: player.baiman || '',
                    sanbaiman: player.sanbaiman || '',
                    yakuman: player.yakuman || '',
                    kazoeyakuman: player.kazoeyakuman || '',
                    doubleyakuman: player.doubleyakuman || ''
                };
            }
            return { ...emptyPlayerRow, wind };
        });

        let handsFromDb = [];
        try {
            const handRes = await fetch(`${API_BASE}/records/${round}/hands`);
            if (handRes.ok) handsFromDb = await handRes.json();
        } catch (e) {
            console.error('hand fetch 실패', e);
        }
        const minRows = Math.max(8, handsFromDb.length);
        const mappedHands = Array.from({ length: minRows }, (_, i) => {
            const existing = handsFromDb.find(h => h.hand_number === i + 1);
            if (existing) {
                return {
                    hand_number: existing.hand_number,
                    hand_wind: existing.hand_wind,
                    hand_round_num: existing.hand_round_num,
                    win_type: existing.win_type,
                    winner_name: existing.winner_name || '',
                    deal_in_name: existing.deal_in_name || '',
                    win_score: existing.win_score == null ? '' : existing.win_score,
                    honba: existing.honba || 0,
                    han: existing.han,
                    fu: existing.fu,
                    score_class: existing.score_class,
                    is_riichi: !!existing.is_riichi,
                    is_ippatsu: !!existing.is_ippatsu,
                    riichi_e: !!existing.riichi_e,
                    riichi_s: !!existing.riichi_s,
                    riichi_w: !!existing.riichi_w,
                    riichi_n: !!existing.riichi_n,
                    dora_count: existing.dora_count || 0,
                    aka_dora_count: existing.aka_dora_count || 0,
                    ura_dora_count: existing.ura_dora_count || 0,
                    yaku_list: existing.yaku_list || [],
                    yaku_text: existing.yaku_text || '',
                    tenpai_e: !!existing.tenpai_e,
                    tenpai_s: !!existing.tenpai_s,
                    tenpai_w: !!existing.tenpai_w,
                    tenpai_n: !!existing.tenpai_n,
                };
            }
            return makeEmptyHand(i + 1);
        });

        setEditingRound(round);
        setNewRecordDate(dateString);
        setNewPlayers(mappedPlayers);
        setNewHands(mappedHands);
        setActiveTab('new-record');
    };

    const handleDeleteRound = async (round) => {
        if (!window.confirm(`정말로 라운드 ${round}의 기록을 삭제하시겠습니까?`)) return;
        try {
            const res = await fetch(`${API_BASE}/records/${round}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) {
                alert('기록이 성공적으로 삭제되었습니다.');
                window.location.reload();
            } else {
                alert('삭제 중 오류가 발생했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('삭제 중 서버와 통신할 수 없습니다.');
        }
    };

    const renderRecords = () => {
        const groupedRecords = [];
        let currentGroup = [];
        let currentGroupKey = '';

        // Filter valid round keys based on search query
        const matchingRounds = new Set();
        if (searchQuery.trim() !== '') {
            records.forEach(r => {
                if (r.player_name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    matchingRounds.add(`${r.match_date}_${r.round}`);
                }
            });
        }

        const filteredRecords = searchQuery.trim() !== ''
            ? records.filter(r => matchingRounds.has(`${r.match_date}_${r.round}`))
            : records;

        filteredRecords.forEach(r => {
            const key = `${r.match_date}_${r.round}`;
            if (key !== currentGroupKey) {
                if (currentGroup.length > 0) groupedRecords.push(currentGroup);
                currentGroup = [r];
                currentGroupKey = key;
            } else {
                currentGroup.push(r);
            }
        });
        if (currentGroup.length > 0) groupedRecords.push(currentGroup);

        // Pagination
        const itemsPerPage = 10;
        const totalPages = Math.ceil(groupedRecords.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const currentGroups = groupedRecords.slice(startIndex, startIndex + itemsPerPage);

        return (
            <div className="bg-white shadow-lg rounded-xl p-6 overflow-x-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                    <h2 className="text-2xl font-bold text-slate-800">전체 경기 기록 (Round 그룹핑)</h2>
                    <input
                        type="text"
                        placeholder="이름으로 검색..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                        className="w-full md:w-64 border-2 border-slate-200 p-2 rounded-lg bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
                    />
                </div>

                <div className="flex items-center gap-2 mb-4 bg-orange-50 p-3 rounded-lg border border-orange-100 w-fit">
                    <span className="text-orange-500 font-bold">🔥</span>
                    <span className="text-slate-600 text-xs font-bold">표시는 '만관 이상' 기록을 의미합니다.</span>
                </div>

                <table className="w-full text-left border-collapse text-sm min-w-[500px]">
                    <thead>
                        <tr className="bg-slate-900 text-white sticky-top">
                            <th className="p-2 text-center border-r border-slate-700 w-16">날짜</th>
                            <th className="p-2 text-center border-r border-slate-700 w-12">라운드</th>
                            <th className="p-1 text-center w-8">바람</th>
                            <th className="p-2 w-16 whitespace-nowrap">이름</th>
                            <th className="p-2 w-8">순위</th>
                            <th className="p-2 w-16">점수</th>
                            <th className="p-2 w-12">우마</th>
                            <th className="p-2 w-12 text-center">특이</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentGroups.length > 0 ? currentGroups.map((group, groupIdx) => {
                            const bgClass = groupIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                            return (
                                <React.Fragment key={groupIdx}>
                                    {groupIdx > 0 && <tr className="border-t-4 border-slate-200"></tr>}
                                    {group.map((r, itemIdx) => {
                                        const isManganPlus = r.mangan > 0 || r.haneman > 0 || r.baiman > 0 || r.sanbaiman > 0 || r.yakuman > 0 || r.kazoeyakuman > 0 || r.doubleyakuman > 0;
                                        const rankColor = r.rank === 1 ? 'text-yellow-600' : r.rank === 4 ? 'text-slate-400' : 'text-slate-700';
                                        return (
                                            <tr key={r.id} className={`${bgClass} hover:bg-orange-100 transition border-b border-slate-100`}>
                                                {itemIdx === 0 && (
                                                    <td rowSpan={group.length} className="p-1 align-middle text-center border-r border-slate-200 bg-white">
                                                        <div className="font-bold text-slate-600 whitespace-nowrap text-sm md:text-base">{new Date(r.match_date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}</div>
                                                    </td>
                                                )}
                                                {itemIdx === 0 && (
                                                    <td rowSpan={group.length} className="p-1 align-middle text-center border-r border-slate-200 bg-slate-100 min-w-[50px]">
                                                        <div className="font-black text-slate-800 text-base whitespace-nowrap mb-2">R{r.round}</div>
                                                        {userRole === 'admin' && (
                                                            <div className="flex flex-col gap-1 items-center px-0.5">
                                                                <button
                                                                    onClick={() => handleEditRound(group)}
                                                                    className="w-full py-1 bg-white border border-slate-300 text-slate-600 rounded-[4px] text-[8px] md:text-xs font-bold hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition-colors shadow-sm whitespace-nowrap"
                                                                >
                                                                    수정
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteRound(r.round)}
                                                                    className="w-full py-1 bg-white border border-red-200 text-red-500 rounded-[4px] text-[8px] md:text-xs font-bold hover:bg-red-50 hover:text-red-700 hover:border-red-400 transition-colors shadow-sm whitespace-nowrap"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="p-1 text-center font-black text-slate-500">{r.wind}</td>
                                                <td className="p-1 font-bold text-slate-800 whitespace-nowrap">{r.player_name}</td>
                                                <td className={`p-1 font-black ${rankColor}`}>{r.rank}</td>
                                                <td className="p-1">{r.final_score.toLocaleString()}</td>
                                                <td className={`p-1 ${r.uma > 0 ? 'text-green-600 font-bold' : 'text-red-500 font-medium'}`}>{Number(r.uma).toFixed(1)}</td>
                                                <td className="p-1 text-center">
                                                    {isManganPlus ? (
                                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-orange-100 text-orange-600 rounded-full font-bold shadow-inner text-[10px]">
                                                            <span>🔥</span>
                                                        </span>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        }) : (
                            <tr>
                                <td colSpan="8" className="p-6 text-center text-slate-500">검색 결과가 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {
                    totalPages > 1 && (
                        <div className="mt-6 flex justify-center items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-4 py-2 border rounded font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition"
                            >
                                이전
                            </button>
                            <span className="text-slate-600 font-bold">
                                {currentPage} / {totalPages} 페이지
                            </span>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="px-4 py-2 border rounded font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition"
                            >
                                다음
                            </button>
                        </div>
                    )
                }
            </div >
        );
    };

    const handleSyncPlayers = async () => {
        try {
            const res = await fetch(`${API_BASE}/sync-players`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            if (data.success) {
                alert(`${data.count || 0}명의 멤버가 새롭게 동기화되었습니다.`);
                const pRes = await fetch(`${API_BASE}/players`);
                const pData = await pRes.json();
                setPlayers(pData);
            }
        } catch (e) { alert('동기화 실패: ' + e.message); }
    };

    const handleAddPlayer = async () => {
        if (!newPlayerName.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ name: newPlayerName })
            });
            if (res.ok) {
                setNewPlayerName('');
                const pRes = await fetch(`${API_BASE}/players`);
                const pData = await pRes.json();
                setPlayers(pData);
            } else {
                // 사용자 피드백 보강 - 401/403 인 경우 로그아웃 유도
                const msg = await res.text();
                if (res.status === 401 || res.status === 403) {
                    alert('인증이 만료되었거나 권한이 없습니다. 로그아웃 후 다시 로그인해주세요.\n(상세: ' + (msg || res.status) + ')');
                } else {
                    alert('멤버 추가 실패 (' + res.status + '): ' + (msg || '알 수 없는 오류'));
                }
            }
        } catch (e) {
            console.error(e);
            alert('서버와 통신할 수 없습니다. API 서버(npm run dev:api)가 떠 있는지 확인해주세요.\n(' + e.message + ')');
        }
    };

    const renderMemberAdmin = () => (
        <div className="bg-white shadow-lg rounded-xl p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-2">
                <h2 className="text-2xl font-bold text-slate-800">👥 멤버 관리 (Admin)</h2>
                <button
                    onClick={handleSyncPlayers}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold border border-slate-200 transition"
                >
                    🔄 기존 기록과 동기화
                </button>
            </div>
            <div className="flex gap-2 mb-8">
                <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="신규 멤버 이름 입력..."
                    className="flex-1 border-2 border-slate-200 p-3 rounded-lg focus:border-orange-500 outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPlayer()}
                />
                <button
                    onClick={handleAddPlayer}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-lg transition"
                >
                    멤버 추가
                </button>
            </div>
            <div className="flex flex-wrap gap-3">
                {players.length > 0 ? players.map(p => (
                    <div key={p.id} className="bg-slate-50 border-2 border-slate-200 px-4 py-2 rounded-full font-bold text-slate-700 shadow-sm flex items-center gap-2">
                        <span className="text-orange-500 text-xs">●</span>
                        {p.name}
                    </div>
                )) : (
                    <div className="w-full py-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold mb-1">등록된 멤버가 없습니다.</p>
                        <p className="text-xs text-slate-500">우측 상단의 [🔄 기존 기록과 동기화] 버튼을 눌러 과거 기록을 불러오세요!</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderNewRecord = () => {
        const totalScore = newPlayers.reduce((sum, p) => sum + (parseInt(p.score) || 0), 0);
        // 자동 점수 누적 계산 (시작 25000 기준)
        const filledHandsForCalc = newHands.filter(h => h.win_type);
        let autoResult = { scores: {}, riichiPool: 0, errors: [] };
        try {
            autoResult = calcRoundResult(newPlayers, filledHandsForCalc);
        } catch (e) { console.error('자동누적 계산 실패:', e.message); }
        const autoTotal = newPlayers.reduce((s, p) => s + (autoResult.scores[p.name] || 0), 0);
        // 등급(만관/하네만/...) 자동 카운트
        const autoClassCounts = calcClassCounts(newPlayers, filledHandsForCalc);
        const applyAutoScores = () => {
            setNewPlayers(prev => {
                const updated = prev.map(p => {
                    const s = autoResult.scores[p.name];
                    const c = autoClassCounts[p.name];
                    const next = { ...p };
                    if (s != null) next.score = String(Math.round(s));
                    if (c) {
                        next.mangan        = c.mangan;
                        next.haneman       = c.haneman;
                        next.baiman        = c.baiman;
                        next.sanbaiman     = c.sanbaiman;
                        next.yakuman       = c.yakuman;
                        next.kazoeyakuman  = c.kazoeyakuman;
                        next.doubleyakuman = c.doubleyakuman;
                    }
                    return next;
                });
                return calcRankAndUma(updated);
            });
        };
        return (
            <div className="bg-white shadow-lg rounded-xl p-6">
                <div className="flex justify-between items-center border-b pb-2 mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {editingRound ? `✍️ 경기 기록 수정 (R${editingRound})` : '새로운 경기 기록 입력'}
                    </h2>
                    {editingRound && (
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-bold border border-orange-200 shadow-sm animate-pulse">
                            수정 모드
                        </span>
                    )}
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">경기 날짜</label>
                    <input
                        type="date"
                        value={newRecordDate}
                        onChange={(e) => setNewRecordDate(e.target.value)}
                        className="border-2 border-slate-200 p-3 rounded-lg bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
                    />
                </div>

                <div className="overflow-x-auto mb-6 border rounded-xl shadow-inner bg-slate-50">

                    <table className="w-full text-left border-collapse text-sm min-w-[650px] table-fixed">
                        <thead>
                            <tr className="bg-slate-900 text-white text-center text-sm sticky-top">
                                <th className="p-2 font-black border-r border-slate-700 w-10 sticky-left bg-slate-900 z-[31] whitespace-nowrap">바람</th>
                                <th className="p-2 font-black border-r border-slate-700 w-24 whitespace-nowrap">이름</th>
                                <th className="p-2 font-black border-r border-slate-700 w-28 whitespace-nowrap">최종 점수</th>
                                <th className="p-2 font-black border-r border-slate-700 text-orange-400 w-10 whitespace-nowrap">순위</th>
                                <th className="p-2 font-black border-r border-slate-700 text-orange-400 w-12 whitespace-nowrap">우마</th>
                                <th className="p-2 font-black border-r border-slate-700 w-12 text-[11px] whitespace-nowrap">만관</th>
                                <th className="p-2 font-black border-r border-slate-700 w-12 text-[11px] whitespace-nowrap">하네만</th>
                                <th className="p-2 font-black border-r border-slate-700 w-12 text-[11px] whitespace-nowrap">배만</th>
                                <th className="p-2 font-black border-r border-slate-700 text-orange-400 w-12 text-[11px] whitespace-nowrap">삼배만</th>
                                <th className="p-2 font-black border-r border-slate-700 text-pink-500 w-12 text-[11px] whitespace-nowrap">역만</th>
                                <th className="p-2 font-black border-r border-slate-700 text-pink-600 w-12 text-[11px] whitespace-nowrap">헤아림</th>
                                <th className="p-2 font-black text-pink-700 w-12 text-[11px] whitespace-nowrap">더블+</th>
                            </tr>
                        </thead>
                        <tbody>
                            {newPlayers.map((p, idx) => (
                                <tr key={idx} className="border-b transition text-center hover:bg-slate-50 border-slate-100">
                                    <td className="p-2 font-black text-slate-800 bg-slate-100 border-r border-white sticky-left z-20">{p.wind}</td>
                                    <td className="p-1 border-r border-slate-200" onClick={(e) => {
                                        // Force list to show on some browsers by clearing if empty
                                        const input = e.currentTarget.querySelector('input');
                                        if (input && !input.value) input.focus();
                                    }}>
                                        <input
                                            list="player-names"
                                            value={p.name}
                                            autoComplete="off"
                                            onChange={(e) => {
                                                const updated = [...newPlayers];
                                                updated[idx].name = e.target.value;
                                                setNewPlayers(updated);
                                            }}
                                            onFocus={(e) => {
                                                // Trigger dropdown on focus for better UX
                                                e.target.setAttribute('placeholder', '검색 또는 선택...');
                                            }}
                                            onBlur={(e) => {
                                                e.target.setAttribute('placeholder', '이름');
                                            }}
                                            placeholder="이름"
                                            className="w-full p-2 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none text-center font-bold"
                                        />
                                    </td>
                                    <td className="p-1 border-r border-slate-200">
                                        <input
                                            type="text"
                                            inputMode="text"
                                            value={p.score}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                // Allow empty string, single minus sign, or a number
                                                if (val === '' || val === '-' || !isNaN(Number(val))) {
                                                    const updated = [...newPlayers];
                                                    updated[idx].score = val;
                                                    setNewPlayers(calcRankAndUma(updated));
                                                }
                                            }}
                                            placeholder="점수 (예: 25000)"
                                            className="w-full p-2 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none text-center font-bold"
                                        />
                                    </td>
                                    <td className="p-2 text-sm font-black border-r border-slate-200 bg-slate-50">{p.rank || '-'}</td>
                                    <td className={`p-2 text-sm font-black border-r border-slate-200 bg-slate-50 ${p.uma > 0 ? 'text-green-600' : p.uma < 0 ? 'text-red-500' : ''}`}>{p.uma !== undefined ? p.uma : '-'}</td>

                                    {['mangan', 'haneman', 'baiman', 'sanbaiman', 'yakuman', 'kazoeyakuman', 'doubleyakuman'].map((field) => (
                                        <td key={field} className="p-1 border-r border-slate-200">
                                            <input
                                                type="number"
                                                min="0"
                                                value={p[field] === 0 ? '' : p[field]}
                                                onChange={(e) => {
                                                    const updated = [...newPlayers];
                                                    updated[idx][field] = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                    setNewPlayers(updated);
                                                }}
                                                className="w-full min-w-[2.5rem] p-1 text-xs border border-slate-300 rounded focus:border-orange-500 focus:outline-none text-center"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <datalist id="player-names">
                        {players.map(p => <option key={p.id} value={p.name} />)}
                    </datalist>
                </div>
{/*<table className="w-full text-left border-collapse text-sm min-w-[700px] table-fixed">
                        <thead>
                            <tr className="bg-slate-900 text-white text-center text-sm sticky-top">
                                <th className="p-2 font-black border-r border-slate-700 w-12 whitespace-nowrap">#</th>
                                <th className="p-2 font-black border-r border-slate-700 w-20 whitespace-nowrap">국</th>
                                <th className="p-2 font-black border-r border-slate-700 w-24 whitespace-nowrap">결과</th>
                                <th className="p-2 font-black border-r border-slate-700 w-28 whitespace-nowrap text-green-300">화료자</th>
                                <th className="p-2 font-black border-r border-slate-700 w-28 whitespace-nowrap text-red-300">방총자 (론)</th>
                                <th className="p-2 font-black border-r border-slate-700 w-20 whitespace-nowrap">점수(선택)</th>
                                <th className="p-2 font-black w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {newHands.map((h, idx) => {
                                const playerNames = newPlayers.map(p => p.name).filter(Boolean);
                                const dealInOptions = playerNames.filter(n => n !== h.winner_name);
                                return (
                                    <tr key={idx} className="border-b transition text-center hover:bg-white border-slate-100 bg-white">
                                        <td className="p-2 font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                                        <td className="p-1 border-r border-slate-200">
                                            <div className="flex items-center justify-center gap-1">
                                                <select
                                                    value={h.hand_wind}
                                                    onChange={(e) => updateHand(idx, 'hand_wind', e.target.value)}
                                                    className="p-1 text-xs border border-slate-300 rounded font-bold bg-slate-50"
                                                >
                                                    <option value="동">동</option>
                                                    <option value="남">남</option>
                                                    <option value="서">서</option>
                                                    <option value="북">북</option>
                                                </select>
                                                <select
                                                    value={h.hand_round_num}
                                                    onChange={(e) => updateHand(idx, 'hand_round_num', parseInt(e.target.value))}
                                                    className="p-1 text-xs border border-slate-300 rounded font-bold bg-slate-50"
                                                >
                                                    <option value={1}>1</option>
                                                    <option value={2}>2</option>
                                                    <option value={3}>3</option>
                                                    <option value={4}>4</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="p-1 border-r border-slate-200">
                                            <select
                                                value={h.win_type}
                                                onChange={(e) => updateHand(idx, 'win_type', e.target.value)}
                                                className={'w-full p-1.5 text-sm border border-slate-300 rounded text-center font-bold ' + (h.win_type === 'tsumo' ? 'bg-green-50 text-green-700' : h.win_type === 'ron' ? 'bg-orange-50 text-orange-700' : h.win_type === 'draw' ? 'bg-slate-100 text-slate-600' : 'bg-white')}
                                            >
                                                <option value="">-</option>
                                                <option value="tsumo">쯔모</option>
                                                <option value="ron">론</option>
                                                <option value="draw">유국</option>
                                            </select>
                                        </td>
                                        <td className="p-1 border-r border-slate-200">
                                            <select
                                                value={h.winner_name}
                                                onChange={(e) => updateHand(idx, 'winner_name', e.target.value)}
                                                disabled={!h.win_type || h.win_type === 'draw'}
                                                className="w-full p-1.5 text-sm border border-slate-300 rounded text-center font-bold disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                <option value="">-</option>
                                                {playerNames.map(name => <option key={name} value={name}>{name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-1 border-r border-slate-200">
                                            <select
                                                value={h.deal_in_name}
                                                onChange={(e) => updateHand(idx, 'deal_in_name', e.target.value)}
                                                disabled={h.win_type !== 'ron'}
                                                className="w-full p-1.5 text-sm border border-slate-300 rounded text-center font-bold disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                <option value="">-</option>
                                                {dealInOptions.map(name => <option key={name} value={name}>{name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-1 border-r border-slate-200">
                                            <input
                                                type="number"
                                                value={h.win_score}
                                                onChange={(e) => updateHand(idx, 'win_score', e.target.value)}
                                                disabled={h.win_type === 'draw' || !h.win_type}
                                                placeholder=""
                                                className="w-full p-1.5 text-sm border border-slate-300 rounded text-center disabled:bg-slate-100"
                                            />
                                        </td>
                                        <td className="p-1">
                                            <button
                                                type="button"
                                                onClick={() => removeHandRow(idx)}
                                                className="text-slate-400 hover:text-red-500 text-lg font-bold px-2"
                                                title="이 국 삭제"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>*/}

                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="mb-4 md:mb-0">
                        <span className="text-slate-600 font-bold mr-4">점수 검증 (총합 10만점) :</span>
                        <span className={`text-2xl font-black ${totalScore === 100000 ? 'text-green-600' : 'text-red-500'}`}>
                            {totalScore.toLocaleString()}
                        </span>
                        {totalScore !== 100000 && (
                            <span className="ml-3 text-sm text-red-500 font-bold">
                                {isNaN(totalScore) ? '' : (100000 - totalScore) > 0 ? `(${(100000 - totalScore).toLocaleString()}점 부족)` : `(${(totalScore - 100000).toLocaleString()}점 초과)`}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleClearRecord}
                            disabled={isSubmitting}
                            className={`px-6 py-3 rounded-lg font-bold shadow-md transition-colors border ${isSubmitting ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
                        >
                            전체 지우기
                        </button>
                        <button
                            onClick={handleSubmitRecord}
                            disabled={totalScore !== 100000 || isSubmitting}
                            className={`px-8 py-3 rounded-lg font-bold shadow-md transition-colors border border-transparent flex items-center gap-2 ${totalScore === 100000 && !isSubmitting ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    저장 중...
                                </>
                            ) : (
                                editingRound ? '수정 완료' : '기록 DB에 저장'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDailyStats = () => {
        // Group by match_day
        const grouped = dailyStats.reduce((acc, current) => {
            const day = current.match_day;
            if (!acc[day]) acc[day] = [];
            acc[day].push(current);
            return acc;
        }, {});

        const sortedDays = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

        if (dailyStats.length === 0) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중이거나 기록이 없습니다.</div>;

        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-800 border-b pb-2 mb-4 italic flex items-center gap-2">
                    <span>📅</span> 일자별 요약 리포트
                </h2>
                {sortedDays.map(day => (
                    <div key={day} className="bg-white shadow-lg rounded-xl overflow-hidden border border-slate-200 transition-all hover:shadow-xl">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <span className="font-black text-lg">{day} ({new Date(day).toLocaleDateString('ko-KR', { weekday: 'short' })})</span>
                            <span className="text-xs text-slate-400">총 {new Set(grouped[day].map(p => p.player_name)).size}명 참가</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                        <th className="p-3 pl-6 sticky-left bg-slate-50 z-20">이름</th>
                                        <th className="p-3 text-center">게임수</th>
                                        <th className="p-3 text-center">총 우마</th>
                                        <th className="p-3 text-center">평균순위</th>
                                        <th className="p-3 text-center text-yellow-600">1위</th>
                                        <th className="p-3 text-center text-slate-400">4위</th>
                                        <th className="p-3 text-center">최고점</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {grouped[day].map((p, idx) => (
                                        <tr key={p.player_name} className={`border-b border-slate-50 hover:bg-slate-50 transition ${idx === 0 ? 'bg-orange-50/30' : ''}`}>
                                            <td className={`p-3 pl-6 font-bold sticky-left z-20 ${idx === 0 ? 'bg-orange-50/30 text-orange-700' : 'bg-white text-slate-800'}`}>
                                                {idx === 0 && <span className="mr-2">👑</span>}
                                                {p.player_name}
                                            </td>
                                            <td className="p-3 text-center font-medium text-slate-600">{p.total_matches}판</td>
                                            <td className={`p-3 text-center font-black ${Number(p.total_uma) > 0 ? 'text-green-600' : Number(p.total_uma) < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                {Number(p.total_uma) > 0 ? '+' : ''}{Number(p.total_uma).toFixed(1)}
                                            </td>
                                            <td className="p-3 text-center font-bold text-slate-700">{Number(p.avg_rank).toFixed(2)}</td>
                                            <td className="p-3 text-center font-bold text-yellow-600">{p.rank1_count}회</td>
                                            <td className="p-3 text-center font-bold text-slate-400">{p.rank4_count}회</td>
                                            <td className="p-3 text-center text-slate-500 text-xs">{Number(p.max_score).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (!authToken) {
        const handleLogin = async (e) => {
            e.preventDefault();
            setLoginError('');
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: loginId, password: loginPassword })
                });
                const data = await res.json();
                if (data.success) {
                    setAuthToken(data.token);
                    setUserRole(data.role);
                    localStorage.setItem('mahjong_token', data.token);
                    localStorage.setItem('mahjong_role', data.role);
                    localStorage.setItem('mahjong_login_id', loginId);

                    if (data.role === 'user') {
                        setActiveTab('stats'); // Default to 'Overall Stats' for users
                    }
                } else {
                    setLoginError(data.message);
                }
            } catch (err) {
                setLoginError('로그인 중 서버와 통신할 수 없습니다.');
            }
        };

        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
                    <h1 className="text-3xl font-black text-center text-slate-800 mb-6 tracking-tight">
                        <span className="text-orange-500">🀄</span> 마작 기록
                    </h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">아이디</label>
                            <input type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)}
                                className="w-full border-2 border-slate-200 p-3 rounded-lg bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">비밀번호</label>
                            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full border-2 border-slate-200 p-3 rounded-lg bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition" />
                        </div>
                        {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
                        <button type="submit" className="w-full bg-slate-800 text-white font-bold text-lg p-3 rounded-xl shadow-lg hover:bg-slate-700 hover:shadow-xl transition-all hover:-translate-y-0.5 mt-2">
                            로그인
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row h-screen">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col shadow-2xl shrink-0 z-40">
                <div className="p-4 md:p-6 border-b border-slate-700 flex justify-between items-center md:block">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                            <span className="text-orange-500">🀄</span>
                            <span className="md:hidden lg:inline">Mahjong Tracker</span>
                            <span className="hidden md:inline lg:hidden">MT</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 mt-0.5 md:mt-2 font-medium tracking-wider">Aboha Statistics</p>
                    </div>

                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 text-slate-400 hover:text-white"
                    >
                        {isMenuOpen ? '✕' : '☰'}
                    </button>
                </div>

                <nav className={`${isMenuOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 p-3 md:p-4 space-y-1 md:space-y-2 overflow-y-auto no-scrollbar`}>
                    {[
                        // 기록 입력: 관리자/참여자 모두 (맨 위)
                        { id: 'mobile-record', label: '🀄 한 국씩 입력' },
                        { id: 'new-record', label: '📝 결과만 등록' },
                        { id: 'daily', label: '🏠 일일 성적' },
                        { id: 'records', label: '📊 개별 기록' },
                        { id: 'stats', label: '📈 전체 통계' },
                        { id: 'dashboard', label: '🏛️ 명예의 전당' },
                        { id: 'rival', label: '⚔️ 라이벌 분석' },
                        ...(userRole === 'admin' ? [
                            { id: 'member-admin', label: '👥 멤버 관리' }
                        ] : []),
                        { id: 'suggestions', label: '📮 문의사항' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setIsMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-xl font-bold transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <span className="text-sm md:text-base">{tab.label}</span>
                        </button>
                    ))}

                    <div className="pt-4 md:pt-8 mt-auto border-t border-slate-800 md:border-t-0">
                        {userRole === 'admin' && activeTab === 'new-record' && (
                            <div className="px-4 md:px-5 mb-2 text-[10px] text-slate-500 font-medium hidden md:flex items-center gap-1.5 opacity-80 border-l border-slate-700 ml-5 text-balance">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                <span>참고: 신규 멤버는 가장 아래 '멤버 관리'에서 등록 후 진행해주세요.</span>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setAuthToken(null);
                                setUserRole(null);
                                localStorage.removeItem('mahjong_token');
                                localStorage.removeItem('mahjong_role');
                            }}
                            className="w-full text-left px-4 py-3 md:px-5 md:py-4 rounded-xl font-bold transition-all duration-200 text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2"
                        >
                            <span className="text-sm md:text-base">👋 로그아웃</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="w-full md:w-auto">
                            {activeTab === 'records' && (
                                <button
                                    onClick={() => {
                                        window.open(`${API_BASE}/export-excel`, '_blank');
                                    }}
                                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95 text-sm w-full md:w-auto"
                                >
                                    <span>📥</span> 엑셀 백업 다운로드
                                </button>
                            )}
                        </div>
                        <div className="inline-flex bg-white rounded-lg p-1 shadow-sm border border-slate-200 w-full md:w-auto overflow-x-auto no-scrollbar">
                            {['all', '2025', '2026'].map(year => (
                                <button
                                    key={year}
                                    onClick={() => setGlobalYear(year)}
                                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all duration-200 ${globalYear === year ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                >
                                    {year === 'all' ? '전체' : `${year}년`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'daily' && renderDailyStats()}
                    {activeTab === 'stats' && renderStats()}
                    {activeTab === 'rival' && renderRival()}
                    {activeTab === 'records' && renderRecords()}
                    {activeTab === 'mobile-record' && (
                        <MobileRecorder
                            players={players}
                            authToken={authToken}
                            onClose={() => setActiveTab('stats')}
                            onSaved={() => { window.location.reload(); }}
                        />
                    )}
                    {activeTab === 'new-record'  && renderNewRecord()}
                    {activeTab === 'member-admin' && userRole === 'admin' && renderMemberAdmin()}
                    {activeTab === 'suggestions' && (
                        <SuggestionBoard
                            authToken={authToken}
                            userRole={userRole}
                            userLoginId={loginId}
                        />
                    )}
                    {detailMember && (
                        <MemberDetailModal
                            playerName={detailMember}
                            allStats={stats}
                            handStats={handStats}
                            yakuStats={yakuStats}
                            onClose={() => setDetailMember(null)}
                        />
                    )}

                    {/* Player Dropdown Data */}
                    <datalist id="player-names">
                        {(() => {
                            const sortedList = [...players].sort((a, b) => {
                                const sA = stats.find(s => s.player_name?.trim() === a.name?.trim());
                                const sB = stats.find(s => s.player_name?.trim() === b.name?.trim());
                                const countA = sA ? Number(sA.total_matches || 0) : 0;
                                const countB = sB ? Number(sB.total_matches || 0) : 0;
                                return countB - countA;
                            });
                            return sortedList.map(p => <option key={p.id} value={p.name} />);
                        })()}
                    </datalist>
                </div>
            </main>
        </div>
    );
}
