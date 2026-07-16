const geoKey = 'bfa3d1a33faa491e81c34a84e71a60fe';

async function testGeo() {
  const url = `https://api.geoapify.com/v1/geocode/search?text=bali, indonesia&apiKey=${geoKey}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  const placeId = data.features[0].properties.place_id;
  console.log("Place ID:", placeId);

  const placesUrl = `https://api.geoapify.com/v2/places?categories=tourism.attraction&filter=place:${placeId}&limit=5&apiKey=${geoKey}`;
  const placesRes = await fetch(placesUrl);
  console.log("Places API Status:", placesRes.status);
  console.log("Places API Response:", await placesRes.text());
}

testGeo();
