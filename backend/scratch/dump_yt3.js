async function dumpYT3(handle) {
  const url = `https://www.youtube.com/@${handle}/about`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();

  console.log('--- SEARCH ABOUT CHANNEL VIEW MODEL ---');
  const aboutMatch = html.match(/"aboutChannelViewModel":\{[^\}]+\}/g);
  console.log('aboutChannelViewModel:', aboutMatch ? aboutMatch[0].substring(0, 500) : 'null');

  const contentMatches = [...html.matchAll(/"content":"([^"]*)"/g)];
  console.log('--- ALL CONTENTS ---');
  contentMatches.forEach(m => {
    if (m[1].includes('subscriber') || m[1].includes('video') || m[1].includes('view')) {
      console.log('Content:', m[1]);
    }
  });

  const labelMatches = [...html.matchAll(/"label":"([^"]*)"/g)];
  console.log('--- ALL LABELS ---');
  labelMatches.forEach(m => {
    if (m[1].includes('subscriber') || m[1].includes('video') || m[1].includes('view')) {
      console.log('Label:', m[1]);
    }
  });
}

dumpYT3('clasherliveop');
