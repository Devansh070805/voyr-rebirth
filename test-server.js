const express = require('express');
const app = express();

app.get('/test-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  let count = 0;
  const interval = setInterval(() => {
    count++;
    res.write(`data: ${JSON.stringify({ msg: 'hello ' + count })}\n\n`);
    if (count >= 3) {
      clearInterval(interval);
      res.end();
    }
  }, 500);
});

app.listen(3002, () => console.log('Test server on 3002'));
