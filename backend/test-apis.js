const geoKey = 'bfa3d1a33faa491e81c34a84e71a60fe';
const makKey = '6a4e80cd1871adb25bd5ad59';

async function testGeoapify() {
  const url = `https://api.geoapify.com/v1/geocode/search?text=bali, indonesia&apiKey=${geoKey}&limit=1`;
  const res = await fetch(url);
  console.log("Geoapify Geocode:", await res.json());
}

async function testMakcorps() {
  const url = `https://api.makcorps.com/city?api_key=${makKey}&cityid=126995&pagination=0&cur=USD&rooms=1&adults=2&checkin=2026-08-07&checkout=2026-08-10`;
  const res = await fetch(url);
  console.log("Makcorps Response Status:", res.status);
  console.log("Makcorps Response Body:", await res.text());
}

testGeoapify();
testMakcorps();
