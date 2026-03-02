import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function App() {
    const [authToken, setAuthToken] = useState(localStorage.getItem('mahjong_token') || null);
    const [userRole, setUserRole] = useState(localStorage.getItem('mahjong_role') || null);
    const [loginId, setLoginId] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [activeTab, setActiveTab] = useState('new-record');
    const [stats, setStats] = useState([]);

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
    const [newPlayers, setNewPlayers] = useState([
        { ...emptyPlayerRow, wind: '동' },
        { ...emptyPlayerRow, wind: '남' },
        { ...emptyPlayerRow, wind: '서' },
        { ...emptyPlayerRow, wind: '북' }
    ]);

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
    }, [globalYear]);

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

        const totalScore = parsed.reduce((sum, p) => sum + p.parsedScore, 0);
        if (totalScore !== 100000) {
            alert(`점수 합계가 100,000점이 아닙니다. 현재: ${totalScore}`);
            return;
        }

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
                    }))
                })
            });

            if (res.ok) {
                alert(editingRound ? '기록이 성공적으로 수정되었습니다!' : '기록이 성공적으로 저장되었습니다!');
                window.location.reload();
            } else {
                alert('저장 중 오류가 발생했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('저장 중 서버와 통신할 수 없습니다.');
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
        }
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

        const getSortedForCategory = (key, direction) => {
            // 10 match minimum for all except 개근상
            const list = key === 'total_matches' ? stats : stats.filter(s => s.total_matches >= 10);
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
                        10국 이상 기준 (동점시 판수 우선)
                    </span>
                </div>

                <table className="w-full text-center border-collapse text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-900 text-white border-b-2 border-slate-700">
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
                                        {top3[0] ? cat.format(top3[0][cat.key]) : '-'}
                                    </td>

                                    <td className="p-3 font-bold text-slate-700 border-r border-slate-100">{top3[1]?.player_name || '-'}</td>
                                    <td className={`p-3 font-medium border-r border-slate-100 ${top3[1] ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {top3[1] ? cat.format(top3[1][cat.key]) : '-'}
                                    </td>

                                    <td className="p-3 font-bold text-slate-700 border-r border-slate-100">{top3[2]?.player_name || '-'}</td>
                                    <td className={`p-3 font-medium ${top3[2] ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {top3[2] ? cat.format(top3[2][cat.key]) : '-'}
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
        <div className="bg-white shadow-lg rounded-xl p-6 overflow-x-auto">
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
                <thead>
                    <tr className="bg-slate-900 text-white text-center cursor-pointer select-none">
                        <th className="p-3 rounded-tl-lg border-r border-slate-700 font-bold hover:bg-slate-800 transition text-slate-400">#</th>
                        <th className="p-3 border-r border-slate-700 font-bold hover:bg-slate-800 transition" onClick={() => requestSort('player_name')}>이름 {getSortIndicator('player_name')}</th>
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
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('max_score')}>최고 점수 {getSortIndicator('max_score')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('min_score')}>최저 점수 {getSortIndicator('min_score')}</th>
                        <th className="p-3 border-r border-slate-700 hover:bg-slate-800 transition" onClick={() => requestSort('avg_score')}>평균 득점 {getSortIndicator('avg_score')}</th>
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
                                <td className={`p-3 font-medium border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>{idx + 1}</td>
                                <td className={`p-3 font-bold border-r ${isHighlighted ? 'border-orange-200 text-orange-900 bg-orange-100' : 'border-slate-100 text-slate-800 bg-slate-50'}`}>{s.player_name}</td>
                                <td className={`p-3 font-medium border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100 text-slate-600'}`}>{s.total_matches}</td>
                                <td className={`p-3 font-black border-r ${isHighlighted ? 'border-orange-200 text-orange-900' : 'border-slate-100'} ${getRankColor(idx)}`}>{Number(s.avg_rank).toFixed(2)}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.avg_uma > 0 ? 'text-green-600' : 'text-red-500'}`}>{Number(s.avg_uma).toFixed(2)}</td>
                                <td className={`p-3 font-black border-r ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${s.total_uma > 0 ? 'text-green-600' : 'text-red-500'}`}>{Number(s.total_uma).toFixed(1)}</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{(s.rank1_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{(s.rank2_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 border-r ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{(s.rank3_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 border-r text-red-500 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{(s.rank4_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 font-bold border-r text-purple-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{(s.tobi_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 font-bold border-r ${isHighlighted ? 'border-orange-200' : 'border-slate-100'} ${(s.rank12_rate * 100) >= 50 ? 'text-green-600' : ''}`}>{(s.rank12_rate * 100).toFixed(1)}%</td>
                                <td className={`p-3 border-r text-blue-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{Number(s.max_score).toLocaleString()}</td>
                                <td className={`p-3 border-r text-red-600 ${isHighlighted ? 'border-orange-200' : 'border-slate-100'}`}>{Number(s.min_score).toLocaleString()}</td>
                                <td className={`p-3 border-r w-full whitespace-nowrap ${isHighlighted ? 'border-orange-200 text-orange-800' : 'border-slate-100'}`}>{Number(s.avg_score).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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
                                    <tr className="bg-slate-900 text-white">
                                        <th className="p-3 rounded-tl-lg">날짜</th>
                                        <th className="p-3">라운드</th>
                                        <th className="p-3 text-center">순위/점수 ({p1})</th>
                                        <th className="p-3 text-center rounded-tr-lg">순위/점수 ({p2})</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rivalData.matches.map((m, idx) => (
                                        <tr key={idx} className="border-b hover:bg-slate-50 transition border-slate-100">
                                            <td className="p-3">{new Date(m.match_date).toLocaleDateString()}</td>
                                            <td className="p-3">{m.round}</td>
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

    const handleEditRound = (group) => {
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

        setEditingRound(round);
        setNewRecordDate(dateString);
        setNewPlayers(mappedPlayers);
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

                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="p-3 rounded-tl-lg text-center border-r border-slate-700">날짜</th>
                            <th className="p-3 text-center border-r border-slate-700">라운드</th>
                            <th className="p-3 text-center">바람</th>
                            <th className="p-3">이름</th>
                            <th className="p-3">순위</th>
                            <th className="p-3">점수</th>
                            <th className="p-3">우마</th>
                            <th className="p-3 rounded-tr-lg">특이사항 (만관이상)</th>
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
                                                    <td rowSpan={group.length} className="p-3 align-middle text-center border-r border-slate-200">
                                                        <div className="font-bold text-slate-600 whitespace-nowrap">{new Date(r.match_date).toLocaleDateString()}</div>
                                                    </td>
                                                )}
                                                {itemIdx === 0 && (
                                                    <td rowSpan={group.length} className="p-3 align-middle text-center border-r border-slate-200 bg-slate-100">
                                                        <div className="font-black text-slate-800 text-xl whitespace-nowrap mb-2">R{r.round}</div>
                                                        {userRole === 'admin' && (
                                                            <div className="flex flex-col gap-1 items-center px-2">
                                                                <button
                                                                    onClick={() => handleEditRound(group)}
                                                                    className="w-full px-3 py-1 bg-white border border-slate-300 text-slate-600 rounded text-xs font-bold hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition-colors shadow-sm"
                                                                >
                                                                    ✍️ 수정
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteRound(r.round)}
                                                                    className="w-full px-3 py-1 bg-white border border-red-200 text-red-500 rounded text-xs font-bold hover:bg-red-50 hover:text-red-700 hover:border-red-400 transition-colors shadow-sm"
                                                                >
                                                                    🗑️ 삭제
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="p-3 text-center font-black text-slate-500">{r.wind}</td>
                                                <td className="p-3 font-bold text-slate-800">{r.player_name}</td>
                                                <td className={`p-3 font-black ${rankColor}`}>{r.rank}</td>
                                                <td className="p-3">{r.final_score.toLocaleString()}</td>
                                                <td className={`p-3 ${r.uma > 0 ? 'text-green-600 font-bold' : 'text-red-500 font-medium'}`}>{Number(r.uma).toFixed(1)}</td>
                                                <td className="p-3">
                                                    {isManganPlus ? (
                                                        <span className="inline-flex items-center gap-1 bg-orange-500 text-white px-2 py-1 text-xs rounded-md font-bold shadow-sm">
                                                            <span>🔥</span>만관 이상
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
                {totalPages > 1 && (
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
                )}
            </div>
        );
    };

    const renderNewRecord = () => {
        const totalScore = newPlayers.reduce((sum, p) => sum + (parseInt(p.score) || 0), 0);
        const uniqueNames = [...new Set(stats.map(s => s.player_name))];

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

                <div className="overflow-x-auto mb-6">
                    <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-900 text-white text-center text-xs">
                                <th className="p-2 rounded-tl-lg font-bold border-r border-slate-700 w-10">바람</th>
                                <th className="p-2 font-bold border-r border-slate-700 min-w-[100px]">이름</th>
                                <th className="p-2 font-bold border-r border-slate-700 min-w-[100px]">최종 점수</th>
                                <th className="p-2 font-bold border-r border-slate-700 text-orange-400 w-12">순위</th>
                                <th className="p-2 font-bold border-r border-slate-700 text-orange-400 w-12">우마</th>
                                <th className="p-1 font-bold border-r border-slate-700 w-10 text-[11px]">만관</th>
                                <th className="p-1 font-bold border-r border-slate-700 w-10 text-[11px]">하네만</th>
                                <th className="p-1 font-bold border-r border-slate-700 w-10 text-[11px]">배만</th>
                                <th className="p-1 font-bold border-r border-slate-700 text-orange-400 w-10 text-[11px]">삼배만</th>
                                <th className="p-1 font-bold border-r border-slate-700 text-pink-500 w-10 text-[11px]">역만</th>
                                <th className="p-1 font-bold border-r border-slate-700 text-pink-600 w-12 text-[11px]">헤아림</th>
                                <th className="p-1 rounded-tr-lg font-bold text-pink-700 w-14 text-[11px]">더블역만+</th>
                            </tr>
                        </thead>
                        <tbody>
                            {newPlayers.map((p, idx) => (
                                <tr key={idx} className="border-b transition text-center hover:bg-slate-50 border-slate-100">
                                    <td className="p-2 font-black text-slate-800 bg-slate-100 border-r border-white">{p.wind}</td>
                                    <td className="p-1 border-r border-slate-200">
                                        <input
                                            list="player-names"
                                            value={p.name}
                                            onChange={(e) => {
                                                const updated = [...newPlayers];
                                                updated[idx].name = e.target.value;
                                                setNewPlayers(updated);
                                            }}
                                            placeholder="이름"
                                            className="w-full p-2 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none text-center font-bold"
                                        />
                                    </td>
                                    <td className="p-1 border-r border-slate-200">
                                        <input
                                            type="number"
                                            value={p.score}
                                            onChange={(e) => {
                                                const updated = [...newPlayers];
                                                updated[idx].score = e.target.value;
                                                setNewPlayers(calcRankAndUma(updated));
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
                        {uniqueNames.map(name => <option key={name} value={name} />)}
                    </datalist>
                </div>

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
                            className="px-6 py-3 rounded-lg font-bold shadow-md transition-colors bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                        >
                            전체 지우기
                        </button>
                        <button
                            onClick={handleSubmitRecord}
                            disabled={totalScore !== 100000}
                            className={`px-8 py-3 rounded-lg font-bold shadow-md transition-colors ${totalScore === 100000 ? 'bg-orange-500 hover:bg-orange-600 text-white border border-transparent' : 'bg-slate-300 text-slate-500 cursor-not-allowed border border-transparent'}`}
                        >
                            {editingRound ? '수정 완료' : '기록 DB에 저장'}
                        </button>
                    </div>
                </div>
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
        <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-2xl font-black tracking-tight"><span className="text-orange-500">Mahjong</span> Tracker</h1>
                    <p className="text-xs text-slate-400 mt-2 font-medium tracking-wider">Aboha Statistics Platform</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {[
                        { id: 'new-record', label: '기록 입력하기' },
                        { id: 'records', label: '개별 기록' },
                        { id: 'stats', label: '전체 통계' },
                        { id: 'dashboard', label: '명예의 전당' },
                        { id: 'rival', label: '라이벌 분석' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full text-left px-5 py-4 rounded-xl font-bold transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}

                    <div className="pt-8">
                        <button
                            onClick={() => {
                                setAuthToken(null);
                                setUserRole(null);
                                localStorage.removeItem('mahjong_token');
                                localStorage.removeItem('mahjong_role');
                            }}
                            className="w-full text-left px-5 py-4 rounded-xl font-bold transition-all duration-200 text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
                        >
                            <span>👋</span> 로그아웃
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {/* Header Controls */}
                    <div className="flex justify-end mb-6">
                        <div className="inline-flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
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
                    {activeTab === 'stats' && renderStats()}
                    {activeTab === 'rival' && renderRival()}
                    {activeTab === 'records' && renderRecords()}
                    {activeTab === 'new-record' && renderNewRecord()}
                </div>
            </main>
        </div>
    );
}
