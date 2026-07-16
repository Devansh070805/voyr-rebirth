const fs = require('fs');
const file = 'src/modules/ai-gateway/broker-action.handler.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /res\.write\(`data: \$\{JSON\.stringify\(event\)\}\\n\\n`\);/,
  `console.log("Writing to res:", JSON.stringify(event));\n  res.write(\`data: \${JSON.stringify(event)}\\n\\n\`);`
);

fs.writeFileSync(file, code);
