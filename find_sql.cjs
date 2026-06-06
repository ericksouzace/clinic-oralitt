const fs = require('fs');
const path = require('path');

function findSqlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.lovable') {
        results = results.concat(findSqlFiles(filePath));
      }
    } else if (file.endsWith('.sql')) {
      results.push(filePath);
    }
  });
  return results;
}

const sqlFiles = findSqlFiles('.');
console.log("SQL files found:", sqlFiles);
