const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '아보하 마작 기록 (NEW).xlsx');
const workbook = xlsx.readFile(filePath);
console.log(workbook.SheetNames);
