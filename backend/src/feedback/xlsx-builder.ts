import { deflateRawSync } from 'node:zlib';

function escapeXml(value: unknown): string {
  const str = String(value ?? '')
    // Loại bỏ ký tự điều khiển XML không hợp lệ
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Chống thực thi công thức khi mở trên Microsoft Excel / Google Sheets (Formula Injection).
 */
export function sanitizeSpreadsheetText(value: unknown): string {
  const str = String(value ?? '');
  if (/^[=+\-@]/.test(str.trimStart())) {
    return `'${str}`;
  }
  return str;
}

function colLetters(colIndexZeroBased: number): string {
  let n = colIndexZeroBased + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBuffer(files: Array<{ name: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const uncompressed = file.content;
    const compressed = deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(8, 8); // Compression method: DEFLATE
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10); // Compression: DEFLATE
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

export interface FeedbackExcelRow {
  index: number;
  code: string;
  createdAtText: string;
  fullName: string;
  phone: string;
  content: string;
}

/**
 * Tạo file Excel (.xlsx chuẩn OpenXML) tổng hợp góp ý của người dân không cần thư viện ngoài.
 */
export function buildFeedbackExcelBuffer(params: {
  exportedAtText: string;
  filterSummaryText: string;
  rows: FeedbackExcelRow[];
}): Buffer {
  const { exportedAtText, filterSummaryText, rows } = params;

  const xmlRows: string[] = [];

  // Dòng 1: Tiêu đề báo cáo
  xmlRows.push(
    `<row r="1" ht="26" customHeight="1"><c r="A1" s="1" t="inlineStr"><is><t>${escapeXml(
      'BẢNG TỔNG HỢP GÓP Ý CỦA NGƯỜI DÂN — TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG XÃ NGHĨA THÀNH',
    )}</t></is></c></row>`,
  );

  // Dòng 2: Thông tin thời điểm xuất & phạm vi lọc
  xmlRows.push(
    `<row r="2" ht="20" customHeight="1"><c r="A2" s="2" t="inlineStr"><is><t>${escapeXml(
      `Thời điểm xuất: ${exportedAtText} | Phạm vi: ${filterSummaryText} | Tổng số bản ghi: ${rows.length}`,
    )}</t></is></c></row>`,
  );

  // Dòng 3: Lưu ý SĐT chưa xác thực
  xmlRows.push(
    `<row r="3" ht="18" customHeight="1"><c r="A3" s="2" t="inlineStr"><is><t>${escapeXml(
      'Lưu ý: Họ tên và số điện thoại do người gửi tự cung cấp (chưa xác thực OTP). Tài liệu lưu hành nội bộ.',
    )}</t></is></c></row>`,
  );

  // Dòng 5: Header bảng
  const headers = [
    'STT',
    'Mã góp ý',
    'Thời gian gửi',
    'Họ và tên',
    'Số điện thoại (chưa xác thực)',
    'Nội dung góp ý',
  ];
  const headerCells = headers
    .map(
      (h, idx) =>
        `<c r="${colLetters(idx)}5" s="3" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`,
    )
    .join('');
  xmlRows.push(`<row r="5" ht="24" customHeight="1">${headerCells}</row>`);

  // Từ dòng 6: Dữ liệu
  rows.forEach((row, i) => {
    const rNum = 6 + i;
    const cells = [
      `<c r="A${rNum}" s="4"><v>${row.index}</v></c>`,
      `<c r="B${rNum}" s="4" t="inlineStr"><is><t>${escapeXml(sanitizeSpreadsheetText(row.code))}</t></is></c>`,
      `<c r="C${rNum}" s="4" t="inlineStr"><is><t>${escapeXml(sanitizeSpreadsheetText(row.createdAtText))}</t></is></c>`,
      `<c r="D${rNum}" s="4" t="inlineStr"><is><t>${escapeXml(sanitizeSpreadsheetText(row.fullName))}</t></is></c>`,
      `<c r="E${rNum}" s="4" t="inlineStr"><is><t>${escapeXml(sanitizeSpreadsheetText(row.phone))}</t></is></c>`,
      `<c r="F${rNum}" s="5" t="inlineStr"><is><t>${escapeXml(sanitizeSpreadsheetText(row.content))}</t></is></c>`,
    ].join('');
    xmlRows.push(`<row r="${rNum}">${cells}</row>`);
  });

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="8" customWidth="1"/>
    <col min="2" max="2" width="22" customWidth="1"/>
    <col min="3" max="3" width="20" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
    <col min="5" max="5" width="26" customWidth="1"/>
    <col min="6" max="6" width="68" customWidth="1"/>
  </cols>
  <sheetData>
    ${xmlRows.join('\n    ')}
  </sheetData>
  <mergeCells count="3">
    <mergeCell ref="A1:F1"/>
    <mergeCell ref="A2:F2"/>
    <mergeCell ref="A3:F3"/>
  </mergeCells>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="13"/><color rgb="FF004CB3"/><name val="Arial"/></font>
    <font><i/><sz val="10"/><color rgb="FF4B5563"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0068FF"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Tong hop gop y" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return createZipBuffer([
    { name: '[Content_Types].xml', content: Buffer.from(contentTypesXml, 'utf8') },
    { name: '_rels/.rels', content: Buffer.from(rootRelsXml, 'utf8') },
    { name: 'xl/workbook.xml', content: Buffer.from(workbookXml, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', content: Buffer.from(workbookRelsXml, 'utf8') },
    { name: 'xl/styles.xml', content: Buffer.from(stylesXml, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', content: Buffer.from(sheetXml, 'utf8') },
  ]);
}
