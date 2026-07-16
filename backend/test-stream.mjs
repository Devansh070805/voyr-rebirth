import { config } from 'dotenv';
config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No GEMINI_API_KEY');
    return;
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Hello! Are you working?' }],
      stream: true
    })
  });

  if (!res.ok) {
    console.error('Error:', await res.text());
    return;
  }

  const text = await res.text();
  console.log('Stream chunks:');
  console.log(text.substring(0, 1000));
}

run();
