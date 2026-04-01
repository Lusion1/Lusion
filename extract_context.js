const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const outputFile = path.join(projectDir, 'project_snapshot.txt');

const includeDirs = [
    'backend',
    'frontend',
    'db'
];

const includeFiles = [
    'docker-compose.yml',
];

const excludeDirs = ['node_modules', 'dist', '.git', '.idea', '.vscode'];
const excludeFiles = ['package-lock.json', '아보하 마작 기록 (NEW).xlsx', 'extract_context.js', 'project_snapshot.txt'];
const allowedExtensions = ['.js', '.jsx', '.html', '.css', '.json', '.yml', '.yaml', '.sql', '.md', 'Dockerfile', ''];

let output = '';

function isAllowedFile(fileName) {
    if (excludeFiles.includes(fileName)) return false;
    const ext = path.extname(fileName);
    if (fileName === 'Dockerfile' || fileName === '.env') return true;
    return allowedExtensions.includes(ext);
}

function processDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (!excludeDirs.includes(item)) {
                processDirectory(fullPath);
            }
        } else {
            if (isAllowedFile(item)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    // Skip large minified files or binaries likely mistakenly included
                    if (content.length > 500000) continue;

                    output += `\n\n========================================\n`;
                    output += `File: ${path.relative(projectDir, fullPath)}\n`;
                    output += `========================================\n\n`;
                    output += content;
                } catch (e) {
                    console.error(`Error reading ${fullPath}:`, e);
                }
            }
        }
    }
}

// Process root files
for (const file of includeFiles) {
    const fullPath = path.join(projectDir, file);
    if (fs.existsSync(fullPath)) {
        output += `\n\n========================================\n`;
        output += `File: ${file}\n`;
        output += `========================================\n\n`;
        output += fs.readFileSync(fullPath, 'utf8');
    }
}

// Process directories
for (const dir of includeDirs) {
    const fullPath = path.join(projectDir, dir);
    if (fs.existsSync(fullPath)) {
        processDirectory(fullPath);
    }
}

fs.writeFileSync(outputFile, output);
console.log(`Snapshot created at: ${outputFile}`);
