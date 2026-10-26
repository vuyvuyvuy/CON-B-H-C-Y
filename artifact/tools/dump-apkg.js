const fs = require('fs');
const R = require('module').createRequire('/home/user/CON-B-H-C-Y/package.json');
const { unzipSync } = R('fflate'); const { decompress } = R('fzstd'); const initSqlJs = R('sql.js');
(async () => {
  const files = unzipSync(new Uint8Array(fs.readFileSync(process.argv[2])));
  console.log('files:', Object.keys(files).filter(k => !/^\d+$/.test(k)), 'media:', Object.keys(files).filter(k => /^\d+$/.test(k)).length);
  let db = files['collection.anki21b'] ? decompress(files['collection.anki21b']) : (files['collection.anki21'] || files['collection.anki2']);
  const SQL = await initSqlJs(); const s = new SQL.Database(db);
  const tables = s.exec("select name from sqlite_master where type='table'")[0].values.flat(); console.log('tables', tables);
  if (tables.includes('decks')) console.log('decks', s.exec('select id,name from decks')[0]?.values.map(([i, n]) => [i, String(n).replace(/\x1f/g, '::')]));
  else { const d = JSON.parse(s.exec('select decks from col')[0].values[0][0]); console.log('decks', Object.values(d).map(x => [x.id, x.name])); }
  if (tables.includes('notetypes')) console.log('notetypes', s.exec('select id,name from notetypes')[0]?.values);
  console.log('counts', s.exec('select count(*) from notes')[0].values, s.exec('select count(*) from cards')[0].values);
  console.log('by deck', s.exec('select did, count(*) from cards group by did')[0].values);
  const tags = s.exec("select tags, count(*) from notes group by tags order by 2 desc limit 30")[0]?.values; console.log('tags', tags);
  const rows = s.exec('select n.id, n.mid, n.flds, n.tags, c.did, c.ord from notes n join cards c on c.nid=n.id order by c.did, n.id')[0].values;
  fs.writeFileSync(process.argv[3], JSON.stringify(rows.map(([id, mid, f, t, did, ord]) => ({ id, mid, did, ord, tags: t, f: String(f).split('\x1f') }))));
})();
