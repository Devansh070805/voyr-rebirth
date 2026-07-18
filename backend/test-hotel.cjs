const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.qfjnkhlxgaophhwvqdnu:Pfsupa07082005@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' });
async function run() {
  const res = await pool.query('SELECT id, user_id FROM conversations ORDER BY created_at DESC LIMIT 1');
  const { id: cid, user_id: uid } = res.rows[0];
  const fetch = require('node-fetch');
  const payload = {
    type: 'hotel',
    item: {
      name: 'Alaya Resort Ubud',
      category: 'Premium',
      price_per_night: 280,
      currency: 'USD',
      rating: 5,
      location: 'Ubud, Bali',
      vendor: 'Expedia',
      source: 'api',
      featured: false
    }
  };
  const r = await fetch(`http://localhost:3001/conversations/${cid}/plan/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': uid, 'x-account-id': uid, 'x-account-type': 'consumer' },
    body: JSON.stringify(payload)
  });
  console.log('status:', r.status);
  const text = await r.text();
  console.log('response:', text.slice(0, 600));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
