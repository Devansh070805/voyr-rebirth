const fs = require('fs');
const file = 'src/modules/ai-gateway/ai-gateway.routes.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const {/g,
  'console.log("Before runStreamRoundtrip");\n    const {'
).replace(
  /} = await runStreamRoundtrip/g,
  '} = await runStreamRoundtrip'
).replace(
  /if \(conversationId && events.length > 0\) {/g,
  'console.log("After runStreamRoundtrip");\n    if (conversationId && events.length > 0) {'
).replace(
  /res.end\(\);/g,
  'console.log("Calling res.end()"); res.end();'
);

fs.writeFileSync(file, code);
