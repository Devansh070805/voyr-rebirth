import fetch from 'node-fetch';

async function main() {
  const apiKey = 'invalid_key';
  const url = `https://api.aviationstack.com/v1/routes?access_key=${apiKey}&arr_iata=DPS`;
  console.log('Fetching', url);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    console.log(`Status: ${res.status}`);
    console.log(await res.text());
  } catch (err) {
    console.error('Error:', err.message);
  }
  console.log(`Took ${Date.now() - start}ms`);
}
main().catch(console.error);
