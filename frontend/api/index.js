import express from 'express';
import pg from 'pg';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import * as xlsx from 'xlsx';


const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json());

// 로컬 DB(localhost/127.0.0.1) 면 SSL 끄고, 그 외(Supabase 등 원격) 는 SSL 사용
const _dbUrl = process.env.DATABASE_URL || '';
const _isLocalDb = /(@|\/\/)(localhost|127\.0\.0\.1)(:|\/)/.test(_dbUrl);
const pool = new Pool({
  connectionString: _dbUrl,
  ssl: _isLocalDb ? false : { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'mahjong_secret_key_123';

const checkAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('Unauthorized');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send('Invalid Token');
  }
};

const checkAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).send('Forbidden: 관리자만 접근 가능합니다.');
  }
  next();
};

app.get('/api/players', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM players ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

app.post('/api/players', checkAuth, checkAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).send("Name is required");
    await pool.query('INSERT INTO players (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name.trim()]);
    res.json({ success: true });
  } catch (err) { res.status(500).send(err.toString()); }
});

app.post('/api/sync-players', checkAuth, checkAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      INSERT INTO players (name)
      SELECT DISTINCT player_name FROM match_results
      WHERE player_name IS NOT NULL AND player_name != ''
      ON CONFLICT (name) DO NOTHING
    `);
    res.json({ success: true, count: result.rowCount || 0 });
  } catch (err) { res.status(500).send(err.toString()); }
});

app.post('/api/login', (req, res) => {
  const { id, password } = req.body;
  if (id === 'q' && password === '1') {
    const token = jwt.sign({ id, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, token, role: 'admin' });
  }
  if (id === 'user' && password === '11') {
    const token = jwt.sign({ id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, token, role: 'user' });
  }
  res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 잘못되었습니다.' });
});

app.get('/api/stats', async (req, res) => {
  try {
    const year = req.query.year;
    let whereClauseMR = '';
    let whereClauseHandMR = '';
    const params = [];
    if (year && year !== 'all') {
      whereClauseMR = 'WHERE EXTRACT(YEAR FROM mr.match_date) = $1';
      whereClauseHandMR = 'WHERE EXTRACT(YEAR FROM mr.match_date) = $1';
      params.push(parseInt(year));
    }
    // hand_results 가 아직 없을 수도 있으니 LEFT JOIN 으로 안전하게 집계
    const result = await pool.query(`
      WITH hand_agg AS (
        SELECT
          mr.player_name,
          COUNT(hr.id) AS hands_participated,
          COUNT(CASE WHEN hr.winner_name  = mr.player_name THEN 1 END) AS win_count,
          COUNT(CASE WHEN hr.winner_name  = mr.player_name AND hr.win_type = 'tsumo' THEN 1 END) AS tsumo_count,
          COUNT(CASE WHEN hr.winner_name  = mr.player_name AND hr.win_type = 'ron'   THEN 1 END) AS ron_count,
          COUNT(CASE WHEN hr.deal_in_name = mr.player_name THEN 1 END) AS deal_in_count
        FROM match_results mr
        LEFT JOIN hand_results hr ON hr.match_round = mr.round
        ${whereClauseHandMR}
        GROUP BY mr.player_name
      )
      SELECT
        mr.player_name,
        COUNT(*) as total_matches,
        AVG(rank)::numeric as avg_rank,
        AVG(uma)::numeric as avg_uma,
        SUM(uma) as total_uma,
        SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END)::decimal / COUNT(*) as rank1_rate,
        SUM(CASE WHEN rank = 2 THEN 1 ELSE 0 END)::decimal / COUNT(*) as rank2_rate,
        SUM(CASE WHEN rank = 3 THEN 1 ELSE 0 END)::decimal / COUNT(*) as rank3_rate,
        SUM(CASE WHEN rank = 4 THEN 1 ELSE 0 END)::decimal / COUNT(*) as rank4_rate,
        SUM(CASE WHEN rank IN (1, 2) THEN 1 ELSE 0 END)::decimal / COUNT(*) as rank12_rate,
        SUM(CASE WHEN final_score < 0 THEN 1 ELSE 0 END)::decimal / COUNT(*) as tobi_rate,
        MAX(final_score) as max_score,
        MIN(final_score) as min_score,
        AVG(final_score)::numeric as avg_score,
        SUM(mangan) as total_mangan,
        SUM(haneman) as total_haneman,
        SUM(baiman) as total_baiman,
        SUM(sanbaiman) as total_sanbaiman,
        SUM(yakuman) as total_yakuman,
        SUM(kazoeyakuman) as total_kazoeyakuman,
        SUM(doubleyakuman) as total_doubleyakuman,
        MAX(CASE WHEN rank = 2 THEN final_score ELSE NULL END) as max_score_rank2,
        SUM(CASE WHEN wind = '동' THEN 1 ELSE 0 END) as count_east,
        SUM(CASE WHEN wind = '남' THEN 1 ELSE 0 END) as count_south,
        SUM(CASE WHEN wind = '서' THEN 1 ELSE 0 END) as count_west,
        SUM(CASE WHEN wind = '북' THEN 1 ELSE 0 END) as count_north,
        AVG(CASE WHEN wind = '동' THEN rank ELSE NULL END)::numeric as avg_rank_east,
        AVG(CASE WHEN wind = '남' THEN rank ELSE NULL END)::numeric as avg_rank_south,
        AVG(CASE WHEN wind = '서' THEN rank ELSE NULL END)::numeric as avg_rank_west,
        AVG(CASE WHEN wind = '북' THEN rank ELSE NULL END)::numeric as avg_rank_north,
        COALESCE(ha.hands_participated, 0) as hands_participated,
        COALESCE(ha.win_count,     0) as win_count,
        COALESCE(ha.tsumo_count,   0) as tsumo_count,
        COALESCE(ha.ron_count,     0) as ron_count,
        COALESCE(ha.deal_in_count, 0) as deal_in_count,
        CASE WHEN COALESCE(ha.hands_participated,0) > 0 THEN ha.win_count::decimal     / ha.hands_participated ELSE NULL END as win_rate,
        CASE WHEN COALESCE(ha.hands_participated,0) > 0 THEN ha.tsumo_count::decimal   / ha.hands_participated ELSE NULL END as tsumo_rate,
        CASE WHEN COALESCE(ha.hands_participated,0) > 0 THEN ha.ron_count::decimal     / ha.hands_participated ELSE NULL END as ron_rate,
        CASE WHEN COALESCE(ha.hands_participated,0) > 0 THEN ha.deal_in_count::decimal / ha.hands_participated ELSE NULL END as deal_in_rate
      FROM match_results mr
      LEFT JOIN hand_agg ha ON ha.player_name = mr.player_name
      ${whereClauseMR}
      GROUP BY mr.player_name, ha.hands_participated, ha.win_count, ha.tsumo_count, ha.ron_count, ha.deal_in_count
      ORDER BY total_matches DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

app.get('/api/rival-comparison', async (req, res) => {
  try {
    const { p1, p2, year } = req.query;
    if (!p1 || !p2) return res.status(400).send("Provide p1 and p2");
    let yearFilter = '';
    const params = [p1, p2];
    if (year && year !== 'all') {
      yearFilter = 'AND EXTRACT(YEAR FROM match_date) = $3';
      params.push(parseInt(year));
    }
    const statsResult = await pool.query(`
      SELECT
        player_name, COUNT(*) as total_matches, AVG(final_score) as avg_score, AVG(rank) as avg_rank, SUM(uma) as total_uma
      FROM match_results
      WHERE player_name IN ($1, $2) ${yearFilter}
      GROUP BY player_name
    `, params);
    const p1Stats = statsResult.rows.find(r => r.player_name === p1);
    const p2Stats = statsResult.rows.find(r => r.player_name === p2);
    const matchResult = await pool.query(`
      WITH matches_p1 AS (SELECT * FROM match_results WHERE player_name = $1 ${yearFilter}),
           matches_p2 AS (SELECT * FROM match_results WHERE player_name = $2 ${yearFilter})
      SELECT
        m1.match_date, m1.round, m1.rank as rank1, m2.rank as rank2, m1.final_score as score1, m2.final_score as score2
      FROM matches_p1 m1
      JOIN matches_p2 m2 ON m1.round = m2.round
      ORDER BY m1.match_date DESC, m1.round DESC
    `, params);
    const matches = matchResult.rows;
    let p1Wins = 0, p2Wins = 0, draws = 0, combinedRankSum = 0;
    matches.forEach(m => {
      if (m.rank1 < m.rank2) p1Wins++;
      else if (m.rank2 < m.rank1) p2Wins++;
      else draws++;
      combinedRankSum += (m.rank1 + m.rank2);
    });
    const combinedAvgRank = matches.length > 0 ? (combinedRankSum / matches.length) / 2 : 0;
    let title = "", desc = "";
    if (matches.length === 0) { title = "기록 없음"; desc = "함께 플레이한 기록이 없습니다."; }
    else if (combinedAvgRank <= 2.2) { title = "🔥 환상의 짝꿍"; desc = "둘이 같이 치면 서로 승점을 쓸어담는 영혼의 파트너입니다."; }
    else if (combinedAvgRank >= 2.8) { title = "💣 억제기 듀오"; desc = "서로가 서로의 발목을 잡는, 함께 치면 필패하는 끔찍한 조합입니다."; }
    else if (Math.abs(p1Wins - p2Wins) < matches.length * 0.1) { title = "⚔️ 진정한 호적수"; desc = "매판 승패를 주고받는 치열한 라이벌 관계입니다."; }
    else { title = "🤝 무난한 동료"; desc = "평범하게 게임을 이끌어가는 사이입니다."; }
    res.json({ p1Stats, p2Stats, headToHead: { matchesCount: matches.length, p1Wins, p2Wins, draws, combinedAvgRank, title, desc }, matches });
  } catch (err) { res.status(500).send(err.toString()); }
});

app.get('/api/records', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000;
    const offset = parseInt(req.query.offset) || 0;
    const year = req.query.year;
    let whereClause = '';
    const params = [limit, offset];
    if (year && year !== 'all') { whereClause = 'WHERE EXTRACT(YEAR FROM match_date) = $3'; params.push(parseInt(year)); }
    const result = await pool.query(`
      SELECT id, match_date, round, wind, player_name, final_score, rank, uma, mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman
      FROM match_results ${whereClause} ORDER BY match_date DESC, round DESC, rank ASC LIMIT $1 OFFSET $2
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

// ---------- hands 배열 정합성 검증 헬퍼 ----------
function validateHands(hands, players) {
  if (!Array.isArray(hands)) return 'hands 배열이 잘못되었습니다.';
  const validNames = new Set(players.map(p => p.name));
  const seen = new Set();
  for (const h of hands) {
    if (h.hand_number == null) return 'hand_number 누락';
    if (seen.has(h.hand_number)) return 'hand_number 중복: ' + h.hand_number;
    seen.add(h.hand_number);
    if (!['동','남','서','북'].includes(h.hand_wind)) return 'hand_wind 오류';
    if (![1,2,3,4].includes(Number(h.hand_round_num))) return 'hand_round_num 오류';
    if (!['tsumo','ron','draw','abortion','chombo'].includes(h.win_type)) return 'win_type 오류';
    if (h.win_type === 'tsumo' || h.win_type === 'ron') {
      if (!h.winner_name || !validNames.has(h.winner_name))
        return '화료자 미등록: ' + h.winner_name;
    } else {
      // draw / abortion / chombo
      if (h.winner_name || h.deal_in_name) return h.win_type + ' 시 winner/deal_in 는 NULL 이어야 함';
    }
    if (h.win_type === 'ron') {
      if (!h.deal_in_name || !validNames.has(h.deal_in_name))
        return '방총자 미등록: ' + h.deal_in_name;
      if (h.winner_name === h.deal_in_name) return '화료자와 방총자가 같습니다';
    }
    if (h.win_type === 'tsumo' && h.deal_in_name) return 'tsumo 시 deal_in_name 은 NULL 이어야 함';
  }
  return null;
}

async function insertHands(client, hands, matchRound, matchDate) {
  if (!hands || hands.length === 0) return;
  const q = `
    INSERT INTO hand_results
      (match_round, match_date, hand_number, hand_wind, hand_round_num,
       win_type, winner_name, deal_in_name, win_score,
       honba, han, fu, score_class, is_dealer_winner,
       is_riichi, is_ippatsu, dora_count, aka_dora_count, ura_dora_count,
       yaku_list, yaku_text,
       point_total, point_from_dealer, point_from_non_dealer,
       tenpai_e, tenpai_s, tenpai_w, tenpai_n,
       riichi_e, riichi_s, riichi_w, riichi_n,
       abortion_type, chombo_player,
       nagashi_e, nagashi_s, nagashi_w, nagashi_n)
    VALUES ($1,  $2,  $3,  $4,  $5,
            $6,  $7,  $8,  $9,
            $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19,
            $20, $21,
            $22, $23, $24,
            $25, $26, $27, $28,
            $29, $30, $31, $32,
            $33, $34,
            $35, $36, $37, $38)
  `;
  const toIntOrNull = (v) => (v == null || v === '' ? null : parseInt(v));
  const toBool = (v) => v === true || v === 'true';
  const toBoolOrNull = (v) => (v == null ? null : toBool(v));
  for (const h of hands) {
    await client.query(q, [
      matchRound,
      matchDate,
      h.hand_number,
      h.hand_wind,
      h.hand_round_num,
      h.win_type,
      h.win_type === 'draw' ? null : h.winner_name,
      h.win_type === 'ron'  ? h.deal_in_name : null,
      toIntOrNull(h.win_score),
      parseInt(h.honba) || 0,
      toIntOrNull(h.han),
      toIntOrNull(h.fu),
      h.score_class || null,
      toBool(h.is_dealer_winner),
      toBool(h.is_riichi),
      toBool(h.is_ippatsu),
      parseInt(h.dora_count) || 0,
      parseInt(h.aka_dora_count) || 0,
      parseInt(h.ura_dora_count) || 0,
      Array.isArray(h.yaku_list) ? h.yaku_list : [],
      h.yaku_text || null,
      toIntOrNull(h.point_total),
      toIntOrNull(h.point_from_dealer),
      toIntOrNull(h.point_from_non_dealer),
      h.win_type === 'draw' ? toBoolOrNull(h.tenpai_e) : null,
      h.win_type === 'draw' ? toBoolOrNull(h.tenpai_s) : null,
      h.win_type === 'draw' ? toBoolOrNull(h.tenpai_w) : null,
      h.win_type === 'draw' ? toBoolOrNull(h.tenpai_n) : null,
      toBool(h.riichi_e),
      toBool(h.riichi_s),
      toBool(h.riichi_w),
      toBool(h.riichi_n),
      h.win_type === 'abortion' ? (h.abortion_type || null) : null,
      h.win_type === 'chombo'   ? (h.chombo_player || null) : null,
      toBool(h.nagashi_e),
      toBool(h.nagashi_s),
      toBool(h.nagashi_w),
      toBool(h.nagashi_n),
    ]);
  }
}

app.post('/api/records', checkAuth, async (req, res) => {  // user 도 입력 가능
  const client = await pool.connect();
  try {
    const { date, players, hands } = req.body;
    if (!date || !players || players.length !== 4) return res.status(400).send("Invalid input data");
    if (hands && hands.length > 0) {
      const err = validateHands(hands, players);
      if (err) return res.status(400).send('hands 검증 실패: ' + err);
    }
    await client.query('BEGIN');
    const roundRes = await client.query('SELECT MAX(round) as max_round FROM match_results');
    const nextRound = (roundRes.rows[0].max_round || 0) + 1;
    const insertQuery = `INSERT INTO match_results (match_date, round, wind, player_name, final_score, rank, uma, mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;
    for (const p of players) {
      await client.query(insertQuery, [date, nextRound, p.wind || '', p.name, p.score, p.rank, p.uma, p.mangan || 0, p.haneman || 0, p.baiman || 0, p.sanbaiman || 0, p.yakuman || 0, p.kazoeyakuman || 0, p.doubleyakuman || 0]);
    }
    await insertHands(client, hands, nextRound, date);
    await client.query('COMMIT');
    res.json({ success: true, round: nextRound });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).send(err.toString()); } finally { client.release(); }
});

app.put('/api/records/:round', checkAuth, checkAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const roundToEdit = parseInt(req.params.round);
    const { date, players, hands } = req.body;
    if (!roundToEdit || !date || !players || players.length !== 4) return res.status(400).send("Invalid input data");
    if (hands && hands.length > 0) {
      const err = validateHands(hands, players);
      if (err) return res.status(400).send('hands 검증 실패: ' + err);
    }
    await client.query('BEGIN');
    await client.query('DELETE FROM hand_results  WHERE match_round = $1', [roundToEdit]);
    await client.query('DELETE FROM match_results WHERE round       = $1', [roundToEdit]);
    const insertQuery = `INSERT INTO match_results (match_date, round, wind, player_name, final_score, rank, uma, mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;
    for (const p of players) {
      await client.query(insertQuery, [date, roundToEdit, p.wind || '', p.name, p.score, p.rank, p.uma, p.mangan || 0, p.haneman || 0, p.baiman || 0, p.sanbaiman || 0, p.yakuman || 0, p.kazoeyakuman || 0, p.doubleyakuman || 0]);
    }
    await insertHands(client, hands, roundToEdit, date);
    await client.query('COMMIT');
    res.json({ success: true, round: roundToEdit });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).send(err.toString()); } finally { client.release(); }
});

app.delete('/api/records/:round', checkAuth, checkAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const roundToDelete = parseInt(req.params.round);
    if (!roundToDelete) return res.status(400).send("Invalid round data");
    await client.query('BEGIN');
    await client.query('DELETE FROM hand_results  WHERE match_round = $1', [roundToDelete]);
    await client.query('DELETE FROM match_results WHERE round       = $1', [roundToDelete]);
    await client.query('COMMIT');
    res.json({ success: true, round: roundToDelete });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).send(err.toString()); } finally { client.release(); }
});

// 특정 라운드의 hand 목록 조회 (수정 모드에서 불러올 때 사용)
app.get('/api/records/:round/hands', async (req, res) => {
  try {
    const round = parseInt(req.params.round);
    if (!round) return res.status(400).send("Invalid round");
    const result = await pool.query(
      `SELECT id, match_round, match_date, hand_number, hand_wind, hand_round_num,
              win_type, winner_name, deal_in_name, win_score,
              honba, han, fu, score_class, is_dealer_winner,
              is_riichi, is_ippatsu, dora_count, aka_dora_count, ura_dora_count,
              yaku_list, yaku_text,
              point_total, point_from_dealer, point_from_non_dealer,
              tenpai_e, tenpai_s, tenpai_w, tenpai_n,
              riichi_e, riichi_s, riichi_w, riichi_n,
              abortion_type, chombo_player,
              nagashi_e, nagashi_s, nagashi_w, nagashi_n
         FROM hand_results
        WHERE match_round = $1
        ORDER BY hand_number ASC`,
      [round]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

// ===== Hand 기반 상세 통계 =====
app.get('/api/hand-stats', async (req, res) => {
  try {
    const year = req.query.year;
    let where = '';
    const params = [];
    if (year && year !== 'all') {
      where = 'WHERE EXTRACT(YEAR FROM mr.match_date) = $1';
      params.push(parseInt(year));
    }
    const result = await pool.query(`
      WITH hand_player AS (
        SELECT
          mr.player_name,
          mr.wind AS player_wind,
          hr.id          AS hand_id,
          hr.win_type,
          hr.winner_name,
          hr.deal_in_name,
          hr.point_total,
          hr.score_class,
          hr.is_ippatsu,
          CASE mr.wind WHEN '동' THEN hr.tenpai_e WHEN '남' THEN hr.tenpai_s
                       WHEN '서' THEN hr.tenpai_w WHEN '북' THEN hr.tenpai_n END AS my_tenpai,
          CASE mr.wind WHEN '동' THEN hr.riichi_e WHEN '남' THEN hr.riichi_s
                       WHEN '서' THEN hr.riichi_w WHEN '북' THEN hr.riichi_n END AS my_riichi
        FROM match_results mr
        LEFT JOIN hand_results hr ON hr.match_round = mr.round
        ${where}
      )
      SELECT
        player_name,
        COUNT(hand_id)                                                          AS total_hands,
        COUNT(*) FILTER (WHERE winner_name = player_name)                       AS win_count,
        AVG(point_total) FILTER (WHERE winner_name = player_name)::numeric      AS avg_win_score,
        COUNT(*) FILTER (WHERE deal_in_name = player_name)                      AS deal_in_count,
        AVG(point_total) FILTER (WHERE deal_in_name = player_name)::numeric     AS avg_deal_in_score,
        COUNT(*) FILTER (WHERE win_type = 'tsumo' AND winner_name <> player_name AND winner_name IS NOT NULL) AS opp_tsumo_count,
        COUNT(*) FILTER (WHERE win_type = 'draw')                               AS draw_count,
        COUNT(*) FILTER (WHERE win_type = 'draw' AND my_tenpai)                 AS draw_tenpai_count,
        COUNT(*) FILTER (WHERE winner_name = player_name AND score_class = 'mangan')       AS mangan_h_count,
        COUNT(*) FILTER (WHERE winner_name = player_name AND score_class = 'haneman')      AS haneman_h_count,
        COUNT(*) FILTER (WHERE winner_name = player_name AND score_class = 'baiman')       AS baiman_h_count,
        COUNT(*) FILTER (WHERE winner_name = player_name AND score_class = 'sanbaiman')    AS sanbaiman_h_count,
        COUNT(*) FILTER (WHERE winner_name = player_name AND score_class IN ('yakuman','kazoe_yakuman','double_yakuman','triple_yakuman')) AS yakuman_h_count,
        COUNT(*) FILTER (WHERE my_riichi)                                       AS riichi_count,
        COUNT(*) FILTER (WHERE my_riichi AND winner_name = player_name)         AS riichi_win_count,
        COUNT(*) FILTER (WHERE my_riichi AND winner_name = player_name AND is_ippatsu)        AS riichi_ippatsu_count,
        COUNT(*) FILTER (WHERE my_riichi AND winner_name = player_name AND win_type = 'tsumo') AS riichi_tsumo_count
      FROM hand_player
      GROUP BY player_name
      ORDER BY total_hands DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

// ===== 役별 카운트 =====
app.get('/api/yaku-stats', async (req, res) => {
  try {
    const year = req.query.year;
    let where = '';
    const params = [];
    if (year && year !== 'all') {
      where = 'AND EXTRACT(YEAR FROM hr.match_date) = $1';
      params.push(parseInt(year));
    }
    const result = await pool.query(`
      SELECT
        hr.winner_name AS player_name,
        yaku,
        COUNT(*) AS cnt
      FROM hand_results hr
      CROSS JOIN LATERAL unnest(hr.yaku_list) AS yaku
      WHERE hr.winner_name IS NOT NULL ${where}
      GROUP BY hr.winner_name, yaku
      ORDER BY hr.winner_name, cnt DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

app.get('/api/export-excel', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM match_results ORDER BY match_date DESC, round DESC, rank ASC');

    const excelData = result.rows.map(r => ({
      '날짜': r.match_date ? new Date(r.match_date).toISOString().split('T')[0] : '',
      '라운드': r.round,
      '바람': r.wind,
      '이름': r.player_name,
      '최종점수': r.final_score,
      '순위': r.rank,
      '우마': r.uma,
      '만관': r.mangan,
      '하네만': r.haneman,
      '배만': r.baiman,
      '삼배만': r.sanbaiman,
      '역만': r.yakuman,
      '헤아림 역만': r.kazoeyakuman,
      '더블 역만': r.doubleyakuman
    }));

    const ws = xlsx.utils.json_to_sheet(excelData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '기록');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="mahjong_backup.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.get('/api/daily-stats', async (req, res) => {

  try {
    const result = await pool.query(`SELECT TO_CHAR(match_date, 'YYYY-MM-DD') as match_day, player_name, COUNT(*) as total_matches, SUM(uma) as total_uma, AVG(rank)::numeric as avg_rank, SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) as rank1_count, SUM(CASE WHEN rank = 4 THEN 1 ELSE 0 END) as rank4_count, MAX(final_score) as max_score FROM match_results GROUP BY match_day, player_name ORDER BY match_day DESC, total_uma DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

export default app;

