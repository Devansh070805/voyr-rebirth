const makKey = '6a4e80cd1871adb25bd5ad59';

async function test(query) {
  const url = `https://api.makcorps.com/city?api_key=${makKey}&${query}`;
  const res = await fetch(url);
  console.log(`Query: ${query} => ${res.status} ${await res.text()}`);
}

async function run() {
  await test('cityid=126995&pagination=0&cur=USD&rooms=1&adults=2&checkin=2026-07-09&checkout=2026-07-10');
}

run();
