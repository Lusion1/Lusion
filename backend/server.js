const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/mahjong',
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
});

// DB가 없을 때를 대비해 서버가 켜질 때 기본 테이블을 자동 생성합니다.
pool.query(`
  CREATE TABLE IF NOT EXISTS match_results (
      id SERIAL PRIMARY KEY,
      match_date TIMESTAMP,
      round INT,
      wind VARCHAR(10),
      player_name VARCHAR(50),
      final_score INT,
      rank INT,
      uma FLOAT,
      mangan INT,
      haneman INT,
      baiman INT,
      sanbaiman INT,
      yakuman INT,
      kazoeyakuman INT,
      doubleyakuman INT
  );
`).catch(err => console.error("Table creation error:", err));

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'mahjong_secret_key_123';

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

app.get('/api/stats', async (req, res) => {
  try {
    const year = req.query.year;
    let whereClause = '';
    const params = [];

    if (year && year !== 'all') {
      whereClause = 'WHERE EXTRACT(YEAR FROM match_date) = $1';
      params.push(parseInt(year));
    }

    const result = await pool.query(`
      SELECT 
        player_name,
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
        MAX(CASE WHEN rank = 2 THEN final_score ELSE NULL END) as max_score_rank2
      FROM match_results
      ${whereClause}
      GROUP BY player_name
      ORDER BY total_matches DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

app.get('/api/rival-comparison', async (req, res) => {
  try {
    const { p1, p2, year } = req.query;
    if (!p1 || !p2) {
      return res.status(400).send("Provide p1 and p2");
    }

    let yearFilter = '';
    const params = [p1, p2];

    if (year && year !== 'all') {
      yearFilter = 'AND EXTRACT(YEAR FROM match_date) = $3';
      params.push(parseInt(year));
    }

    // Get individual stats for p1 and p2
    const statsResult = await pool.query(`
      SELECT 
        player_name,
        COUNT(*) as total_matches,
        AVG(final_score) as avg_score,
        AVG(rank) as avg_rank,
        SUM(uma) as total_uma
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
    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    let combinedRankSum = 0;

    matches.forEach(m => {
      if (m.rank1 < m.rank2) p1Wins++;
      else if (m.rank2 < m.rank1) p2Wins++;
      else draws++;

      combinedRankSum += (m.rank1 + m.rank2);
    });

    const combinedAvgRank = matches.length > 0 ? (combinedRankSum / matches.length) / 2 : 0;

    let title = "";
    let desc = "";

    if (matches.length === 0) {
      title = "기록 없음";
      desc = "함께 플레이한 기록이 없습니다.";
    } else if (combinedAvgRank <= 2.2) {
      title = "🔥 환상의 짝꿍";
      desc = "둘이 같이 치면 서로 승점을 쓸어담는 영혼의 파트너입니다.";
    } else if (combinedAvgRank >= 2.8) {
      title = "💣 억제기 듀오";
      desc = "서로가 서로의 발목을 잡는, 함께 치면 필패하는 끔찍한 조합입니다.";
    } else if (Math.abs(p1Wins - p2Wins) < matches.length * 0.1) {
      title = "⚔️ 진정한 호적수";
      desc = "매판 승패를 주고받는 치열한 라이벌 관계입니다.";
    } else {
      title = "🤝 무난한 동료";
      desc = "평범하게 게임을 이끌어가는 사이입니다.";
    }

    res.json({
      p1Stats,
      p2Stats,
      headToHead: {
        matchesCount: matches.length,
        p1Wins,
        p2Wins,
        draws,
        combinedAvgRank,
        title,
        desc
      },
      matches
    });
  } catch (err) { res.status(500).send(err.toString()); }
});

app.get('/api/records', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000;
    const offset = parseInt(req.query.offset) || 0;
    const year = req.query.year;

    let whereClause = '';
    const params = [limit, offset];

    if (year && year !== 'all') {
      whereClause = 'WHERE EXTRACT(YEAR FROM match_date) = $3';
      params.push(parseInt(year));
    }

    const result = await pool.query(`
      SELECT 
        id, match_date, round, wind, player_name, final_score, rank, uma,
        mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman
      FROM match_results
      ${whereClause}
      ORDER BY match_date DESC, round DESC, rank ASC
      LIMIT $1 OFFSET $2
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).send(err.toString()); }
});

app.post('/api/records', checkAuth, checkAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { date, players } = req.body;
    if (!date || !players || players.length !== 4) {
      return res.status(400).send("Invalid input data");
    }

    await client.query('BEGIN');

    const roundRes = await client.query('SELECT MAX(round) as max_round FROM match_results');
    const nextRound = (roundRes.rows[0].max_round || 0) + 1;

    const insertQuery = `
      INSERT INTO match_results (
        match_date, round, wind, player_name, final_score, rank, uma,
        mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;

    for (const p of players) {
      await client.query(insertQuery, [
        date, nextRound, p.wind || '', p.name, p.score, p.rank, p.uma,
        p.mangan || 0, p.haneman || 0, p.baiman || 0, p.sanbaiman || 0,
        p.yakuman || 0, p.kazoeyakuman || 0, p.doubleyakuman || 0
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true, round: nextRound });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).send(err.toString());
  } finally {
    client.release();
  }
});

app.put('/api/records/:round', checkAuth, checkAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const roundToEdit = parseInt(req.params.round);
    const { date, players } = req.body;
    if (!roundToEdit || !date || !players || players.length !== 4) {
      return res.status(400).send("Invalid input data");
    }

    await client.query('BEGIN');

    // Delete existing records for this round
    await client.query('DELETE FROM match_results WHERE round = $1', [roundToEdit]);

    const insertQuery = `
      INSERT INTO match_results (
        match_date, round, wind, player_name, final_score, rank, uma,
        mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;

    for (const p of players) {
      await client.query(insertQuery, [
        date, roundToEdit, p.wind || '', p.name, p.score, p.rank, p.uma,
        p.mangan || 0, p.haneman || 0, p.baiman || 0, p.sanbaiman || 0,
        p.yakuman || 0, p.kazoeyakuman || 0, p.doubleyakuman || 0
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true, round: roundToEdit });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).send(err.toString());
  } finally {
    client.release();
  }
});

app.delete('/api/records/:round', checkAuth, checkAdmin, async (req, res) => {
  try {
    const roundToDelete = parseInt(req.params.round);
    if (!roundToDelete) {
      return res.status(400).send("Invalid round data");
    }
    await pool.query('DELETE FROM match_results WHERE round = $1', [roundToDelete]);
    res.json({ success: true, round: roundToDelete });
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.get('/api/init-db', (req, res) => {
  const { exec } = require('child_process');
  exec('node import_data.js', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).send(`Error: ${error.message}\nStderr: ${stderr}`);
    }
    res.send(`Import Output: ${stdout}`);
  });
});

app.listen(5000, () => console.log('Backend listening on port 5000'));
