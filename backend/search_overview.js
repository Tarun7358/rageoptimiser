import fs from 'fs';
import readline from 'readline';

async function run() {
  const logPath = 'C:\\Users\\rdxyz\\.gemini\\antigravity\\brain\\a8ae855d-b5e0-4efb-babc-b9736a0bb7de\\.system_generated\\logs\\overview.txt';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (line.includes('restoreFromLiveSnapshot') || line.includes('captureLiveSnapshot')) {
      console.log(`Line ${lineNum}: length ${line.length}`);
      // Find where 'restoreFromLiveSnapshot' appears in this line
      let idx = 0;
      while (true) {
        idx = line.indexOf('restoreFromLiveSnapshot', idx);
        if (idx === -1) break;
        console.log(`  Match at index ${idx}: ...${line.substring(Math.max(0, idx - 100), Math.min(line.length, idx + 200))}...`);
        idx += 23;
      }
    }
  }
}
run().catch(console.error);
