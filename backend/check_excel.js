const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '아보하 마작 기록 (NEW).xlsx');
const workbook = xlsx.readFile(filePath);

const sheetName = '통계';
if (!workbook.Sheets[sheetName]) {
    console.log('Sheet not found: ' + sheetName);
    process.exit(1);
}

const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

if (data.length > 0) {
    console.log("Headers of '통계' sheet:");
    console.log(data[0]);
    console.log("First row of data:");
    console.log(data[1]);
} else {
    console.log("Sheet is empty.");
}
