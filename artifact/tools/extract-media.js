const fs = require('fs'); const path = require('path');
const R = require('module').createRequire('/home/user/CON-B-H-C-Y/package.json');
const { unzipSync } = R('fflate'); const { decompress } = R('fzstd');
const files = unzipSync(new Uint8Array(fs.readFileSync(process.argv[2])));
const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
let m = files['media']; const isZ = (b) => b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;
if (isZ(m)) m = decompress(m);
// protobuf MediaEntries { repeated MediaEntry entries = 1; } MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; }
function varint(b, i) { let r = 0, s = 0, x; do { x = b[i++]; r += (x & 0x7f) * 2 ** s; s += 7; } while (x & 0x80); return [r, i]; }
const names = []; let i = 0;
if (m[0] === 0x7b) Object.entries(JSON.parse(Buffer.from(m).toString())).forEach(([k, v]) => (names[+k] = v));
else while (i < m.length) {
  let key; [key, i] = varint(m, i); let len; [len, i] = varint(m, i);
  const entry = m.subarray(i, i + len); i += len;
  let j = 0; while (j < entry.length) { let k; [k, j] = varint(entry, j); if ((k & 7) === 2) { let l; [l, j] = varint(entry, j); if (k >> 3 === 1) names.push(Buffer.from(entry.subarray(j, j + l)).toString()); j += l; } else { [, j] = varint(entry, j); } }
}
const map = {};
names.forEach((n, idx) => { let d = files[String(idx)]; if (!d) return; if (isZ(d)) d = decompress(d); fs.writeFileSync(path.join(out, n), d); map[n] = d.length; });
console.log(JSON.stringify(map, null, 0));
