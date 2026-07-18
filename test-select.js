const fetch = require('node-fetch');
async function run() {
  // We need a conversation ID. Let's get one from the DB or just hit a fake one to see the error.
  const res = await fetch('http://localhost:3001/conversations/00000000-0000-0000-0000-000000000000/plan/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '00000000-0000-0000-0000-000000000000', 'x-account-id': '00000000-0000-0000-0000-000000000000', 'x-account-type': 'consumer' },
    body: JSON.stringify({ type: 'hotel', item: { name: 'Test Hotel', location: 'Bali' } })
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
run();
