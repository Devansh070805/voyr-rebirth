const fetch = require('node-fetch');
async function run() {
  const res = await fetch('http://localhost:3002/test-stream');
  console.log('Got response headers');
  res.body.on('data', chunk => console.log(chunk.toString()));
}
run();
