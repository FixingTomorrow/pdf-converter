const $ = id => document.getElementById(id);
let mode = 'upload';
function setMode(next) {
  mode = next;
  $('uploadPane').hidden = next !== 'upload';
  $('writePane').hidden = next !== 'write';
  $('uploadTab').setAttribute('aria-selected', next === 'upload');
  $('writeTab').setAttribute('aria-selected', next === 'write');
  $('status').textContent = 'Ready when you are.';
  $('status').className = '';
}
$('uploadTab').onclick = () => setMode('upload');
$('writeTab').onclick = () => setMode('write');
function updateFile() {
  const file = $('file').files[0];
  $('fileLabel').textContent = file ? file.name : 'Drop your document here';
  $('fileHelp').textContent = file ? `${(file.size / 1024).toFixed(1)} KB · Click to choose another file` : 'or browse files from your computer';
}
$('file').onchange = updateFile;
for (const event of ['dragenter', 'dragover']) $('dropzone').addEventListener(event, () => $('dropzone').classList.add('drag'));
for (const event of ['dragleave', 'drop']) $('dropzone').addEventListener(event, () => $('dropzone').classList.remove('drag'));
$('convertForm').onsubmit = async event => {
  event.preventDefault();
  const data = new FormData();
  data.set('format', $('format').value);
  const status = $('status');
  status.className = '';
  try {
    if (mode === 'upload') {
      const file = $('file').files[0];
      if (!file) throw new Error('Choose a document first.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Files must be smaller than 10 MB.');
      data.set('file', file);
    } else {
      if (!$('markdown').value.trim()) throw new Error('Write some Markdown first.');
      data.set('markdown', $('markdown').value);
    }
    $('convert').disabled = true;
    status.textContent = 'Giving your words a fresh format…';
    const response = await fetch('/api/convert', { method: 'POST', body: data });
    if (!response.ok) throw new Error((await response.json()).error || 'Conversion failed. Please try again.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = mode === 'upload' ? $('file').files[0].name.replace(/\.[^.]+$/, '') + '.pdf' : 'document.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = 'All done. Your PDF is ready in your downloads.';
  } catch (error) { status.textContent = error.message; status.className = 'error'; }
  finally { $('convert').disabled = false; }
};
