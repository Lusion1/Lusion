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
