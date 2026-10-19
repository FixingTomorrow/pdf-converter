# Paperlane

A small web app that converts Markdown and Word (`.docx`) documents to PDF. Upload a file or write Markdown, choose A4 or Letter, and download the PDF.

## Run locally

Requires Node.js 22+ and Chromium. On Debian/Ubuntu, install Chromium with `sudo apt-get update && sudo apt-get install -y chromium fonts-liberation`.

```sh
npm ci
npm start
```

Open port 3000 in your local browser. `PORT` changes the listening port. `CHROMIUM_PATH` selects a custom Chromium executable; `/usr/bin/chromium` is detected automatically. Alternatively, install Playwright's managed browser with `npx playwright install --with-deps chromium`.

```sh
npm run dev  # restart on server changes
npm test     # real Chromium-backed conversions and invalid-input checks
```

## Docker

```sh
docker build -t paperlane .
docker run --rm -p 3000:3000 --init paperlane
```

## Supported documents

- Markdown (`.md`, `.markdown`, `.txt`), including headings, lists, code, and tables.
- Word `.docx`, including text, headings, tables, and embedded images.
- Maximum uploaded file size: 10 MB. Maximum editor input: 1 MB.
- Word conversion uses semantic document structure. Complex layouts, headers, footers, exact fonts, and page breaks may differ from Microsoft Word. Legacy `.doc` is unsupported.
- External images are blocked to prevent private-network requests. Embedded Word images are supported.

Uploads are held in memory; the app does not persist input documents or PDFs. Chromium uses temporary browser profiles, which are closed after each request. The interface optionally loads fonts from Google Fonts and falls back to system fonts.

## Deployment notes

This is a working starting app, not a hardened multi-tenant conversion service. Run behind HTTPS with request rate limits, memory/CPU limits, and an isolated container before exposing to untrusted public uploads. Conversion concurrency is limited to three requests per process. Large or unusually compressed DOCX content can consume significant memory despite the upload-size limit.

`npm audit` currently reports three moderate findings through Mammoth's CLI-only `argparse` / `sprintf-js` dependencies, with no available upstream fix. The server imports Mammoth's library; it never invokes its CLI or passes document content to that formatter. Review upstream updates before public deployment.

## Implementation

Express handles uploads, Marked renders Markdown, Mammoth reads Word documents, sanitize-html removes unsafe markup, and Playwright prints PDFs in Chromium with JavaScript and network requests disabled for document rendering.
