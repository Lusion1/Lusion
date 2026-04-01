const { Client } = require('pg');

const SUPABASE_URL = 'postgresql://postgres.vcilntnhahfrbxpocuyn:8896qwe9zx!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function init() {
    const client = new Client({
        connectionString: SUPABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to Supabase.");

        console.log("Creating tables...");
        await client.query(`
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
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Tables created successfully.");
    } catch (err) {
        console.error("Error creating tables:", err);
    } finally {
        await client.end();
    }
}

init();
