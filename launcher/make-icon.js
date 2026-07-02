// Converts cn-logo.png to icon.ico for Windows .exe
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;
const path = require('path');
const fs = require('fs');

const inputPng = path.join(__dirname, 'assets', 'icon.png');
const outputIco = path.join(__dirname, 'assets', 'icon.ico');

if (!fs.existsSync(inputPng)) {
  console.error('ERROR: assets/icon.png not found! Copy cn-logo.png there first.');
  process.exit(1);
}

console.log('Converting CN logo PNG → ICO for Windows...');

pngToIco(inputPng)
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log(`✓ icon.ico created (${Math.round(buf.length / 1024)} KB)`);
    console.log('  Ready to build .exe with: npm run build:exe');
  })
  .catch(err => {
    console.error('Failed to convert icon:', err);
    process.exit(1);
  });
