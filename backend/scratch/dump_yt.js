async function dumpYT(handle) {
  const url = `https://www.youtube.com/@${handle}/about`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();

  console.log('--- SEARCH FOR VIEWS ---');
  const viewRegex = /"text":"([^"]*views?)"/gi;
  let match;
  while ((match = viewRegex.exec(html)) !== null) {
    console.log('Found:', match[1]);
  }

  console.log('--- SEARCH FOR SUBSCRIBERS ---');
  const subRegex = /"text":"([^"]*subscribers?)"/gi;
  while ((match = subRegex.exec(html)) !== null) {
    console.log('Found:', match[1]);
  }

  console.log('--- SEARCH FOR VIDEOS ---');
  const videoRegex = /"text":"([^"]*videos?)"/gi;
  while ((match = videoRegex.exec(html)) !== null) {
    console.log('Found:', match[1]);
  }
}

dumpYT('clasherliveop');
