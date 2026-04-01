const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/mahjong',
});

async function check() {
    try {
        const res = await pool.query('SELECT * FROM players');
        console.log('Players:', res.rows);
        const res2 = await pool.query('SELECT DISTINCT player_name FROM match_results');
        console.log('Distinct names in records:', res2.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();
