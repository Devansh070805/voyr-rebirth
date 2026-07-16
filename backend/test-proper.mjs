import fetch from 'node-fetch';

async function main() {
  const url = 'http://localhost:3001/ai/stream';
  const body = {
    message: "hello",
    conversation_history: [],
  };

  console.log(`Sending POST to ${url}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'x-user-id': '7b4e6277-38c1-45e6-89dd-29903b8f96c8'
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`Status: ${response.status}`);
    console.error(await response.text());
    return;
  }

  console.log('Stream opened, reading chunks...');
  const reader = response.body;
  reader.on('data', (chunk) => {
    process.stdout.write(`CHUNK: ${chunk.toString()}`);
  });
  reader.on('end', () => {
    console.log('\nStream closed normally.');
  });
  reader.on('error', (err) => {
    console.error('\nStream error:', err);
  });
}

main().catch(console.error);
