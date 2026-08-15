async function findTotalViews(handle) {
  const url = `https://www.youtube.com/@${handle}/about`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();

  console.log('--- ALL OCCURRENCES OF views ---');
  const matches = [...html.matchAll(/.{0,50}views?.{0,50}/gi)];
  matches.forEach(m => console.log(m[0]));
}

findTotalViews('clasherliveop');
