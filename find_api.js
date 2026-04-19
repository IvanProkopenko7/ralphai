const fs = require('fs');
const txt = fs.readFileSync('api.html', 'utf8');
const matches = txt.match(/fetch\((['"])(.*?)\1/g);
console.log(txt.match(/\/api\/[^\s'"]+/g));
console.log(txt.match(/\/run\/[^\s'"]+/g));