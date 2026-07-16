async function main() {
  const apiKey = process.env.GEMINI_API_KEY || 'your-api-key-here';
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'hello' }], stream: true })
  });
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const str = decoder.decode(value, { stream: true });
    console.log('RAW CHUNK:', JSON.stringify(str));
  }
}
main().catch(console.error);
