async function test() {
  const res = await fetch('http://localhost:3000/api/ai-briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binsContext: { needingCollection: 5, highUrgency: 1, hasReports: false },
      weatherContext: { tempC: 25, liveWeather: true }
    })
  });
  console.log(await res.text());
}
test();
