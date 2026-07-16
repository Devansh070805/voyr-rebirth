import fetch from 'node-fetch';

async function main() {
  const url = 'http://localhost:3001/health';
  const response = await fetch(url);
  console.log(`Health Status: ${response.status}`);
}

main().catch(console.error);
