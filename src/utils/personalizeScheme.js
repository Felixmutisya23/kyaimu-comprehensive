/* ═══════════════════════════════════════════════════════════════════
   SCHEME OF WORK PERSONALIZATION
   ─────────────────────────────────────────────────────────────────
   Runs entirely in the browser, right before a purchased scheme is
   downloaded. Two jobs:
     1. Fill in the buyer's Name / TSC Number / School wherever the
        template already has a blank for it.
     2. Remove "ELIMU PRO" branding so the buyer's copy reads as their
        own document, not a visibly-downloaded vendor file.

   Two formats are handled differently because the catalog has both:
     • .docx — the placeholder text ("NAME: ____", "ELIMU PRO SCHEMES
       OF WORK", etc.) is plain, single-run text inside word/document.xml,
       so a direct string/regex replace is safe and simple.
     • .pdf  — schemes were found to use MORE THAN ONE cover-page layout
       (e.g. lower-primary "boxed" layout vs upper-grade "underline"
       layout, at different coordinates). Rather than hardcode one set
       of pixel positions (which would only work for one layout and
       silently misplace text on the other), this searches each PDF's
       own page-1 text at runtime with pdfjs-dist to find the actual
       "NAME" / "TSC" / "SCHOOL" labels and the branding line, then uses
       pdf-lib to white-out and draw over exactly where they were found.
       This adapts automatically to whichever layout a given file uses.
═══════════════════════════════════════════════════════════════════ */
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/* ── DOCX personalization ─────────────────────────────────────────── */
export async function personalizeDocx(arrayBuffer, { name, tscNumber, school }) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docPath = 'word/document.xml';
  const docFile = zip.file(docPath);
  if (!docFile) return arrayBuffer; // not a docx we recognize — return untouched rather than fail the download

  let xml = await docFile.async('string');

  const safeName = xmlEscape(name || '');
  const safeTsc = xmlEscape(tscNumber || '');
  const safeSchool = xmlEscape(school || '');

  // Title branding -> the buyer's own school name, so it reads as their
  // document. Falls back to a neutral title if no school was given.
  xml = xml.replace(
    /ELIMU PRO SCHEMES OF WORK/g,
    safeSchool ? `${safeSchool.toUpperCase()} SCHEMES OF WORK` : 'SCHEMES OF WORK'
  );
  // Footer/attribution line ("ELIMU PRO — Oxford/KLB ... Learner's Book")
  // — drop just the vendor name, keep the legitimate source-material credit.
  xml = xml.replace(/ELIMU PRO\s*(—|--|-)\s*/g, '');
  // Catch-all: any other stray mention of the brand name, alone.
  xml = xml.replace(/ELIMU PRO/g, safeSchool ? safeSchool.toUpperCase() : '');

  // Fill in the blank fields — underscore run length can vary between
  // templates, so match any run of 1+ underscores after the label.
  xml = xml.replace(/NAME:\s*_+/, `NAME: ${safeName}`);
  xml = xml.replace(/TSC NO\.:\s*_+/, `TSC NO.: ${safeTsc}`);
  xml = xml.replace(/SCHOOL:\s*_+/, `SCHOOL: ${safeSchool}`);

  zip.file(docPath, xml);
  return await zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/* ── PDF personalization ──────────────────────────────────────────── */

// Groups page-1 text items into visual "lines" by rounding their
// baseline y, since a line can be drawn as multiple text-showing
// operations (multiple items sharing the same y) rather than one.
function groupIntoLines(items) {
  const lines = new Map();
  for (const it of items) {
    const key = Math.round(it.y);
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(it);
  }
  return [...lines.values()].map(lineItems => {
    lineItems.sort((a, b) => a.x - b.x);
    return {
      items: lineItems,
      text: lineItems.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim(),
      minX: Math.min(...lineItems.map(i => i.x)),
      maxX: Math.max(...lineItems.map(i => i.x + i.width)),
      y: lineItems[0].y,
      fontSize: Math.max(...lineItems.map(i => i.fontSize || 12)),
    };
  });
}

// Finds a single-word label (e.g. "NAME", "SCHOOL") — returns its item
// {x, y, width, fontSize} or null if this particular PDF's layout
// doesn't have that label on page 1.
function findLabelItem(items, label) {
  const target = label.toUpperCase();
  return items.find(it => it.str.trim().toUpperCase().replace(/:$/, '') === target) || null;
}

export async function personalizePdf(arrayBuffer, { name, tscNumber, school }) {
  // 1. Read page-1 text positions with pdfjs-dist (these are already in
  //    standard bottom-up PDF point coordinates via item.transform).
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
  const srcPdf = await loadingTask.promise;
  const page1 = await srcPdf.getPage(1);
  const textContent = await page1.getTextContent();

  const items = textContent.items
    .filter(it => it.str && it.str.trim())
    .map(it => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width,
      fontSize: Math.abs(it.transform[3]) || 12,
    }));

  const lines = groupIntoLines(items);
  const brandingLine = lines.find(l => /ELIMU/i.test(l.text));
  const nameLabel = findLabelItem(items, 'NAME');
  const tscLabel = findLabelItem(items, 'TSC');
  const schoolLabel = findLabelItem(items, 'SCHOOL');

  // 2. Load the same bytes into pdf-lib for editing.
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const white = rgb(1, 1, 1);
  const black = rgb(0.1, 0.1, 0.1);

  // Replace the branding line, whatever its exact position on this
  // particular template — white it out, then draw the replacement
  // centered in the same box.
  if (brandingLine) {
    const pad = 4;
    page.drawRectangle({
      x: brandingLine.minX - pad,
      y: brandingLine.y - pad,
      width: (brandingLine.maxX - brandingLine.minX) + pad * 2,
      height: brandingLine.fontSize + pad * 2,
      color: white,
    });
    const newTitle = school ? `${school.toUpperCase()} SCHEMES OF WORK` : 'SCHEMES OF WORK';
    const size = brandingLine.fontSize;
    const textWidth = font.widthOfTextAtSize(newTitle, size);
    const centerX = (brandingLine.minX + brandingLine.maxX) / 2;
    page.drawText(newTitle, {
      x: centerX - textWidth / 2,
      y: brandingLine.y,
      size,
      font,
      color: black,
    });
  }

  // Write the buyer's details right after each label, on the same line
  // — works whether the template underlines the blank or boxes it,
  // since we're anchoring off the label text itself, not a guessed
  // line/box position.
  function writeAfterLabel(labelItem, value) {
    if (!labelItem || !value) return;
    page.drawText(String(value), {
      x: labelItem.x + labelItem.width + 12,
      y: labelItem.y,
      size: Math.max(labelItem.fontSize - 1, 9),
      font: regularFont,
      color: black,
    });
  }
  writeAfterLabel(nameLabel, name);
  writeAfterLabel(tscLabel, tscNumber);
  writeAfterLabel(schoolLabel, school);

  return await pdfDoc.save();
}

/* ── Entry point used by the marketplace download flow ───────────── */
// fileName is used only to decide which branch to run; storagePath from
// the scheme record is fine to pass in directly.
export async function personalizeScheme(arrayBuffer, storagePath, buyerDetails) {
  const isDocx = /\.docx$/i.test(storagePath);
  if (isDocx) return personalizeDocx(arrayBuffer, buyerDetails);
  return personalizePdf(arrayBuffer, buyerDetails);
}
