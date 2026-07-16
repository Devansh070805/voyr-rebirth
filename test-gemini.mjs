import fetch from 'node-fetch';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || 'your-api-key-here'; // from user prompt
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true
    })
  });
  
  const reader = res.body;
  reader.on('data', chunk => console.log('CHUNK:', chunk.toString()));
  reader.on('end', () => console.log('END'));
}
main().catch(console.error);
