async function inspectYT(handle) {
  const url = `https://www.youtube.com/@${handle}/about`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();
  
  const matches = [...html.matchAll(/"viewCountText":\{[^\}]*\}/g)];
  console.log('viewCountText matches:', matches.map(m => m[0]));

  const videoMatches = [...html.matchAll(/"videosCountText":\{[^\}]*\}/g)];
  console.log('videoMatches:', videoMatches.map(m => m[0]));
}

inspectYT('clasherliveop');
