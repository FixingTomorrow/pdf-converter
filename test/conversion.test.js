import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { app, closeBrowser } from '../server.js';
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await closeBrowser(); await new Promise(r => server.close(r)); });
async function convert(data) { return fetch(base + '/api/convert', { method: 'POST', body: data }); }
for (const format of ['A4', 'Letter']) test(`Markdown converts to a ${format} PDF`, async () => {
 const data = new FormData(); data.set('markdown', '# Hello world\n\n**Bold text**\n\n| A | B |\n|---|---|\n| 1 | 2 |'); data.set('format', format);
 const response = await convert(data); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf');
 const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0,5).toString(), '%PDF-'); assert.ok(bytes.length > 1000);
});
test('Word document converts to PDF', async () => {
 const data = new FormData(); data.set('file', new Blob([await readFile(new URL('./sample.docx', import.meta.url))]), 'sample.docx');
 const response = await convert(data); assert.equal(response.status, 200); assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(), '%PDF-');
});
test('invalid and missing inputs return useful errors', async () => {
 assert.equal((await convert(new FormData())).status, 400);
 const data = new FormData(); data.set('file', new Blob(['bad']), 'sample.doc'); assert.equal((await convert(data)).status, 400);
 data.set('file', new Blob(['bad']), 'sample.docx'); assert.equal((await convert(data)).status, 422);
});
test('HTML scripts and external resources cannot execute during conversion', async () => {
 const data = new FormData(); data.set('markdown', '<script>throw Error("bad")</script><img src="http://127.0.0.1:1/private">\n# Safe');
 assert.equal((await convert(data)).status, 200);
});
