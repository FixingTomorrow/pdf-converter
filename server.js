import express from 'express';
import multer from 'multer';
import { marked } from 'marked';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const app = express();
app.disable('x-powered-by');
app.use(express.static('public'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fieldSize: 1024 * 1024 } });
let browserPromise;
async function browser() {
  if (!browserPromise) {
    const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browserPromise = chromium.launch({ executablePath }).then(b => {
      b.on('disconnected', () => { browserPromise = undefined; });
      return b;
    }).catch(e => { browserPromise = undefined; throw e; });
  }
  return browserPromise;
}
export async function closeBrowser() { if (browserPromise) await (await browserPromise).close(); }
let active = 0;
app.post('/api/convert', upload.single('file'), async (req, res, next) => {
  if (active >= 3) return res.status(429).json({ error: 'The converter is busy. Please try again shortly.' });
  active++;
  let context;
  try {
    const format = req.body.format || 'A4';
    if (!['A4', 'Letter'].includes(format)) return res.status(400).json({ error: 'Choose A4 or Letter paper.' });
    let html;
    if (req.file) {
      const name = req.file.originalname.toLowerCase();
      if (name.endsWith('.docx')) html = (await mammoth.convertToHtml({ buffer: req.file.buffer }, { externalFileAccess: false })).value;
      else if (/\.(md|markdown|txt)$/.test(name)) html = await marked.parse(req.file.buffer.toString('utf8'));
      else return res.status(400).json({ error: 'Upload a Markdown (.md) or Word (.docx) file. Legacy .doc files are not supported.' });
    } else {
      const markdown = req.body.markdown;
      if (typeof markdown !== 'string' || !markdown.trim()) return res.status(400).json({ error: 'Add some Markdown or choose a file first.' });
      html = await marked.parse(markdown);
    }
    html = sanitizeHtml(html, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'] }, allowedSchemes: ['data'], allowedSchemesByTag: { a: ['https', 'http', 'mailto'] } });
    context = await (await browser()).newContext({ javaScriptEnabled: false });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{font:12pt/1.65 Georgia,serif;color:#202925;overflow-wrap:anywhere}h1,h2,h3{line-height:1.25;break-after:avoid;font-family:Arial,sans-serif}h1{font-size:28pt}h2{font-size:20pt}pre{white-space:pre-wrap;background:#f2f4f2;padding:14px;font-size:10pt}code{font-size:10pt}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd3ce;padding:8px}blockquote{border-left:3px solid #8ca696;padding-left:16px;color:#53675b}a{color:#35644b}</style>${html}`, { timeout: 15000 });
    const pdf = await page.pdf({ format, printBackground: true, margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' }, timeout: 20000 });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="document.pdf"', 'Cache-Control': 'no-store' }).send(pdf);
  } catch (error) {
    console.error('Conversion failed:', error.message);
    res.status(422).json({ error: 'Could not convert this document. Check that it is a valid Markdown or .docx file.' });
  } finally { if (context) await context.close(); active--; }
});
app.use((error, req, res, next) => res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be smaller than 10 MB.' : 'Invalid upload. Choose one file, up to 10 MB.' }));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Paperlane listening on port ' + (process.env.PORT || 3000)));
}
