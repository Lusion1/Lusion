const xlsx = require('xlsx');
const { Client } = require('pg');

const path = require('path');

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/mahjong',
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('onrender.com')
        ? { rejectUnauthorized: false }
        : false
});

async function run() {
    await client.connect();

    console.log("Clearing existing data...");
    await client.query('TRUNCATE TABLE match_results RESTART IDENTITY');

    // 엑셀 파일의 위치를 로컬/클라우드 환경에 맞게 유동적으로 찾습니다.
    let excelPath = '/app/data/아보하 마작 기록 (NEW).xlsx'; // 로컬 도커 환경
    const cloudPath = path.join(__dirname, '..', '아보하 마작 기록 (NEW).xlsx'); // 클라우드(Render/GitHub) 환경

    if (require('fs').existsSync(cloudPath)) {
        excelPath = cloudPath;
    }

    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets['기록'];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    let importedCount = 0;

    for (const row of rawData) {
        if (!row['이름']) continue;

        const parseNum = (val) => (val === '#N/A' || val === undefined || val === null || isNaN(Number(val))) ? 0 : Number(val);

        let dateVal = row['날짜'];
        if (typeof dateVal === 'number') {
            dateVal = new Date((dateVal - (25567 + 1)) * 86400 * 1000);
        } else {
            dateVal = new Date(dateVal);
        }

        const query = `
      INSERT INTO match_results (
        match_date, round, wind, player_name, final_score, rank, uma,
        mangan, haneman, baiman, sanbaiman, yakuman, kazoeyakuman, doubleyakuman
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;
        const values = [
            dateVal,
            parseNum(row['라운드']),
            row['바람'] || '',
            row['이름'],
            parseNum(row['최종점수']),
            parseNum(row['순위']),
            parseNum(row['우마']),
            parseNum(row['만관']),
            parseNum(row['하네만']),
            parseNum(row['배만']),
            parseNum(row['삼배만']),
            parseNum(row['역만']),
            parseNum(row['헤아림 역만']),
            parseNum(row['더블 역만'])
        ];
        await client.query(query, values);
        importedCount++;
    }

    console.log(`Successfully imported ${importedCount} rows.`);
    await client.end();
}

run().catch(err => {
    console.error("Error during import:", err);
    process.exit(1);
});
