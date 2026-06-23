import React, { useState, useEffect, useMemo } from 'react';

// 상태 코드 → 한글/색상 매핑
const STATUS_INFO = {
    pending:  { label: '대기',     badge: 'bg-slate-200 text-slate-700 border-slate-300' },
    received: { label: '접수',     badge: 'bg-blue-100 text-blue-700 border-blue-300' },
    done:     { label: '처리완료', badge: 'bg-green-100 text-green-700 border-green-300' },
    rejected: { label: '거절',     badge: 'bg-rose-100 text-rose-700 border-rose-300' },
};
const STATUS_KEYS = ['pending', 'received', 'done', 'rejected'];

const fmtDateTime = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
};

export default function SuggestionBoard({ authToken, userRole, userLoginId }) {
    const isAdmin = userRole === 'admin';
    const [items, setItems] = useState([]);
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [writeModal, setWriteModal] = useState(false);
    const [writeForm, setWriteForm] = useState({ nickname: '', title: '', content: '', category: 'inquiry' });
    const [submitting, setSubmitting] = useState(false);

    const [detailItem, setDetailItem] = useState(null);
    const [replyDraft, setReplyDraft] = useState('');
    const [replyStatus, setReplyStatus] = useState('received');

    const fetchList = async () => {
        setLoading(true);
        setError('');
        try {
            const qs = ['limit=200'];
            if (filterStatus !== 'all') qs.push('status=' + filterStatus);
            if (filterCategory !== 'all') qs.push('category=' + filterCategory);
            const url = '/api/suggestions?' + qs.join('&');
            const res = await fetch(url);
            if (!res.ok) throw new Error('목록 조회 실패: ' + res.status);
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [filterStatus, filterCategory]);

    // 작성 모달 열 때 닉네임 기본값 = 로그인 ID
    const openWrite = () => {
        setWriteForm({ nickname: userLoginId || '', title: '', content: '', category: 'inquiry' });
        setWriteModal(true);
    };

    const submitWrite = async () => {
        const { nickname, title, content } = writeForm;
        if (!nickname.trim()) { alert('닉네임을 입력해주세요.'); return; }
        if (!title.trim())    { alert('제목을 입력해주세요.'); return; }
        if (!content.trim())  { alert('내용을 입력해주세요.'); return; }
        setSubmitting(true);
        try {
            const res = await fetch('/api/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ nickname: nickname.trim(), title: title.trim(), content: content.trim(), category: writeForm.category }),
            });
            if (!res.ok) {
                const msg = await res.text();
                alert('작성 실패: ' + msg);
                return;
            }
            setWriteModal(false);
            await fetchList();
        } catch (e) {
            alert('서버 통신 실패: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const openDetail = async (item) => {
        // 최신 데이터로 다시 조회 (다른 사람이 답글 단 경우 반영)
        try {
            const res = await fetch(`/api/suggestions/${item.id}`);
            if (res.ok) {
                const fresh = await res.json();
                setDetailItem(fresh);
                setReplyDraft(fresh.admin_reply || '');
                setReplyStatus(fresh.status === 'pending' ? 'received' : fresh.status);
                return;
            }
        } catch {}
        setDetailItem(item);
        setReplyDraft(item.admin_reply || '');
        setReplyStatus(item.status === 'pending' ? 'received' : item.status);
    };

    const submitReply = async () => {
        if (!detailItem) return;
        if (!replyDraft.trim()) { alert('답글 내용을 입력해주세요.'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/suggestions/${detailItem.id}/reply`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ admin_reply: replyDraft.trim(), status: replyStatus }),
            });
            if (!res.ok) {
                const msg = await res.text();
                alert('답글 저장 실패: ' + msg);
                return;
            }
            const updated = await res.json();
            setDetailItem(updated);
            await fetchList();
        } catch (e) {
            alert('서버 통신 실패: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const submitStatusOnly = async (newStatus) => {
        if (!detailItem) return;
        if (newStatus === detailItem.status) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/suggestions/${detailItem.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                const msg = await res.text();
                alert('상태 변경 실패: ' + msg);
                return;
            }
            const data = await res.json();
            setDetailItem(prev => prev ? { ...prev, status: data.status, updated_at: data.updated_at } : prev);
            await fetchList();
        } catch (e) {
            alert('서버 통신 실패: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const submitDeleteReply = async () => {
        if (!detailItem) return;
        if (!detailItem.admin_reply) return;
        if (!window.confirm('관리자 답글을 삭제하시겠습니까?\n(글 자체는 삭제되지 않습니다)')) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/suggestions/${detailItem.id}/reply`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!res.ok) {
                const msg = await res.text();
                alert('답글 삭제 실패: ' + msg);
                return;
            }
            const updated = await res.json();
            setDetailItem(updated);
            setReplyDraft('');
            await fetchList();
        } catch (e) {
            alert('서버 통신 실패: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const submitDelete = async () => {
        if (!detailItem) return;
        if (!window.confirm(`정말 삭제하시겠습니까?\n"${detailItem.title}"`)) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/suggestions/${detailItem.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!res.ok) {
                const msg = await res.text();
                alert('삭제 실패: ' + msg);
                return;
            }
            setDetailItem(null);
            await fetchList();
        } catch (e) {
            alert('서버 통신 실패: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // 필터별 카운트 (탭 옆 숫자)
    const counts = useMemo(() => {
        const c = { all: items.length, pending: 0, received: 0, done: 0, rejected: 0 };
        for (const it of items) if (c[it.status] != null) c[it.status]++;
        return c;
    }, [items]);

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-800">📢 업데이트 & 문의</h2>
                <button
                    onClick={openWrite}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600"
                >
                    + 새 글 작성
                </button>
            </div>

            {/* 카테고리 필터 */}
            <div className="flex gap-2 mb-3">
                {[
                    { key: 'all', label: '전체', emoji: '' },
                    { key: 'update', label: '업데이트', emoji: '📢' },
                    { key: 'inquiry', label: '문의', emoji: '📮' },
                ].map(c => (
                    <button
                        key={c.key}
                        onClick={() => setFilterCategory(c.key)}
                        className={'px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition ' + (filterCategory === c.key
                            ? (c.key === 'update' ? 'bg-blue-500 text-white border-blue-600' : (c.key === 'inquiry' ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-900 text-white border-slate-900'))
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}
                    >
                        {c.emoji} {c.label}
                    </button>
                ))}
            </div>

            {/* 필터 탭 */}
            <div className="flex flex-wrap gap-1 mb-3 border-b border-slate-200">
                {[
                    { key: 'all',      label: '전체' },
                    { key: 'pending',  label: STATUS_INFO.pending.label },
                    { key: 'received', label: STATUS_INFO.received.label },
                    { key: 'done',     label: STATUS_INFO.done.label },
                    { key: 'rejected', label: STATUS_INFO.rejected.label },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setFilterStatus(t.key)}
                        className={'px-3 py-2 text-sm font-bold border-b-2 -mb-px transition ' + (filterStatus === t.key
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700')}
                    >
                        {t.label}
                        <span className={'ml-1 text-[10px] ' + (filterStatus === t.key ? 'text-orange-500' : 'text-slate-400')}>
                            {counts[t.key] || 0}
                        </span>
                    </button>
                ))}
            </div>

            {/* 안내 / 에러 */}
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">⚠ {error}</div>}
            {loading && <div className="text-sm text-slate-500 py-4 text-center">불러오는 중...</div>}

            {/* 목록 */}
            {!loading && items.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                    <div className="text-4xl mb-2">📭</div>
                    <div className="text-sm">등록된 글이 없습니다.</div>
                </div>
            )}

            <div className="space-y-2">
                {items.map(it => {
                    const sInfo = STATUS_INFO[it.status] || STATUS_INFO.pending;
                    const hasReply = !!it.admin_reply;
                    return (
                        <button
                            key={it.id}
                            onClick={() => openDetail(it)}
                            className="w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-orange-300 hover:bg-orange-50/30 transition"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className={'text-[10px] font-bold border rounded px-1.5 py-0.5 ' + sInfo.badge}>{sInfo.label}</span>
                                        {it.category === 'update' && <span className="text-[10px] font-bold border border-blue-300 bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">📢 업데이트</span>}
                                        {it.category === 'inquiry' && <span className="text-[10px] font-bold border border-orange-300 bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">📮 문의</span>}
                                        {hasReply && <span className="text-[10px] font-bold text-green-700">✓ 답글</span>}
                                        <span className="font-bold text-slate-800 truncate">{it.title}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {it.nickname} · {fmtDateTime(it.created_at)}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 작성 모달 */}
            {writeModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
                    <div className="bg-white w-full max-w-lg max-h-full overflow-y-auto md:rounded-2xl">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">✏ 새 글 작성</h3>
                            <button onClick={() => setWriteModal(false)} className="text-slate-400 text-2xl">×</button>
                        </div>
                        <div className="p-4 space-y-3">
                            {isAdmin && (
                                <div>
                                    <label className="text-xs font-bold text-slate-600">카테고리</label>
                                    <div className="flex gap-2 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setWriteForm(f => ({ ...f, category: 'inquiry' }))}
                                            className={'flex-1 py-2 rounded-lg text-sm font-bold border-2 ' + (writeForm.category === 'inquiry' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200')}
                                        >📮 문의</button>
                                        <button
                                            type="button"
                                            onClick={() => setWriteForm(f => ({ ...f, category: 'update' }))}
                                            className={'flex-1 py-2 rounded-lg text-sm font-bold border-2 ' + (writeForm.category === 'update' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200')}
                                        >📢 업데이트</button>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">업데이트는 관리자만 작성 가능 (사이트 변경/패치 공지용)</div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-slate-600">닉네임 (필수)</label>
                                <input
                                    type="text"
                                    maxLength={50}
                                    value={writeForm.nickname}
                                    onChange={e => setWriteForm(f => ({ ...f, nickname: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                                    placeholder="이름 또는 별명"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600">제목 (필수)</label>
                                <input
                                    type="text"
                                    maxLength={200}
                                    value={writeForm.title}
                                    onChange={e => setWriteForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                                    placeholder="한 줄 요약"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600">내용 (필수)</label>
                                <textarea
                                    maxLength={5000}
                                    value={writeForm.content}
                                    onChange={e => setWriteForm(f => ({ ...f, content: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg min-h-[160px] resize-y"
                                    placeholder="자세한 내용을 적어주세요."
                                />
                                <div className="text-[10px] text-slate-400 text-right mt-0.5">{writeForm.content.length}/5000</div>
                            </div>
                        </div>
                        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex gap-2">
                            <button onClick={() => setWriteModal(false)} disabled={submitting} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg font-bold">취소</button>
                            <button onClick={submitWrite} disabled={submitting} className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-bold disabled:opacity-60">{submitting ? '작성 중...' : '작성'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 상세 모달 */}
            {detailItem && (() => {
                const sInfo = STATUS_INFO[detailItem.status] || STATUS_INFO.pending;
                return (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
                        <div className="bg-white w-full max-w-2xl max-h-full overflow-y-auto md:rounded-2xl">
                            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={'text-[10px] font-bold border rounded px-1.5 py-0.5 shrink-0 ' + sInfo.badge}>{sInfo.label}</span>
                                    {detailItem.category === 'update' && <span className="text-[10px] font-bold border border-blue-300 bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 shrink-0">📢 업데이트</span>}
                                    {detailItem.category === 'inquiry' && <span className="text-[10px] font-bold border border-orange-300 bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 shrink-0">📮 문의</span>}
                                    <h3 className="text-base md:text-lg font-bold text-slate-800 truncate">{detailItem.title}</h3>
                                </div>
                                <button onClick={() => setDetailItem(null)} className="text-slate-400 text-2xl shrink-0">×</button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* 메타 */}
                                <div className="text-xs text-slate-500">
                                    {detailItem.nickname} · {fmtDateTime(detailItem.created_at)}
                                </div>

                                {/* 본문 */}
                                <div className="text-sm text-slate-800 whitespace-pre-wrap break-words bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    {detailItem.content}
                                </div>

                                {/* 관리자 응답 (있을 때만 표시) */}
                                {detailItem.admin_reply && (
                                    <div className="border-l-4 border-orange-400 bg-orange-50/50 p-3 rounded-r-lg">
                                        <div className="text-xs font-bold text-orange-700 mb-1 flex items-center justify-between">
                                            <span>
                                                🛠 관리자 응답
                                                <span className="ml-2 font-normal text-orange-500">
                                                    {detailItem.admin_reply_by || 'admin'} · {fmtDateTime(detailItem.admin_reply_at)}
                                                </span>
                                            </span>
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={submitDeleteReply}
                                                    disabled={submitting}
                                                    className="text-[11px] text-rose-600 hover:bg-rose-100 active:bg-rose-200 rounded px-1.5 py-0.5 disabled:opacity-60"
                                                    title="답글 삭제 (글은 유지)"
                                                >🗑 답글 삭제</button>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">{detailItem.admin_reply}</div>
                                    </div>
                                )}

                                {/* 관리자 화면: 답글 작성 + 상태 변경 + 삭제 */}
                                {isAdmin && (
                                    <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50">
                                        <div className="text-xs font-bold text-slate-600">🛠 관리자 도구</div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-600">상태</label>
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                {STATUS_KEYS.map(k => {
                                                    const ki = STATUS_INFO[k];
                                                    return (
                                                        <button
                                                            key={k}
                                                            type="button"
                                                            onClick={() => setReplyStatus(k)}
                                                            className={'px-2 py-1 rounded text-[11px] font-bold border transition ' + (replyStatus === k
                                                                ? ki.badge + ' ring-2 ring-orange-400'
                                                                : 'bg-white text-slate-600 border-slate-200')}
                                                        >
                                                            {ki.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-600">답글</label>
                                            <textarea
                                                maxLength={5000}
                                                value={replyDraft}
                                                onChange={e => setReplyDraft(e.target.value)}
                                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg min-h-[100px] resize-y bg-white"
                                                placeholder="답글 내용을 입력하세요."
                                            />
                                            <div className="text-[10px] text-slate-400 text-right mt-0.5">{replyDraft.length}/5000</div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={submitDelete}
                                                disabled={submitting}
                                                className="px-3 py-2 bg-rose-100 text-rose-700 rounded-lg font-bold text-sm hover:bg-rose-200 disabled:opacity-60"
                                            >
                                                🗑 삭제
                                            </button>
                                            <button
                                                onClick={() => submitStatusOnly(replyStatus)}
                                                disabled={submitting || replyStatus === detailItem.status}
                                                className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-300 disabled:opacity-60"
                                            >
                                                상태만 저장
                                            </button>
                                            <button
                                                onClick={submitReply}
                                                disabled={submitting}
                                                className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm hover:bg-orange-600 disabled:opacity-60"
                                            >
                                                {submitting ? '저장 중...' : '답글 저장'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-3">
                                <button onClick={() => setDetailItem(null)} className="w-full py-2.5 bg-slate-200 text-slate-700 rounded-lg font-bold">닫기</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
