async function dumpYT2(handle) {
  const url = `https://www.youtube.com/@${handle}/about`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const html = await res.text();

  console.log('--- ALL OCCURRENCES OF subscriber ---');
  const subs = [...html.matchAll(/.{0,50}subscriber.{0,50}/gi)];
  subs.slice(0, 10).forEach(m => console.log(m[0]));

  console.log('--- ALL OCCURRENCES OF view ---');
  const views = [...html.matchAll(/.{0,50}views?.{0,50}/gi)];
  views.slice(0, 10).forEach(m => console.log(m[0]));

  console.log('--- ALL OCCURRENCES OF video ---');
  const vids = [...html.matchAll(/.{0,50}videos?.{0,50}/gi)];
  vids.slice(0, 10).forEach(m => console.log(m[0]));
}

dumpYT2('clasherliveop');
