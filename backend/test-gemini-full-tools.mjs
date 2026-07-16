import fetch from 'node-fetch';
import fs from 'fs';
import { TOOL_DEFINITIONS } from './src/modules/ai-gateway/tool-definitions.js';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || 'your-api-key-here';
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  
  const tools = TOOL_DEFINITIONS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'hello' }], tools, stream: true })
  });
  
  const reader = res.body;
  reader.on('data', chunk => console.log('CHUNK:', chunk.toString()));
  reader.on('end', () => console.log('END'));
}
main().catch(console.error);
