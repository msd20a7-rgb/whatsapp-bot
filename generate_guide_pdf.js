const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function generateBackupGuidePDF(markdownPath, outputPath) {
    return new Promise((resolve, reject) => {
        const mdContent = fs.readFileSync(markdownPath, 'utf-8');
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            bufferPages: true
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const leftX = 40;
        const width = 515;

        // Title Header Banner
        doc.rect(leftX, 40, width, 55).fill('#0F172A');
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF')
           .text('LORDS & KINGS ENTERPRISES', leftX + 15, 52);
        doc.fontSize(10).font('Helvetica').fillColor('#38BDF8')
           .text('WhatsApp Bot System Backup & Architecture Reference Guide', leftX + 15, 72);

        doc.moveDown(3);
        doc.y = 110;

        const lines = mdContent.split('\n');
        let inCodeBlock = false;
        let codeBuffer = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Remove non-standard emoji unicode characters for standard font compatibility
            line = line.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

            // Page break check
            if (doc.y > 720) {
                doc.addPage();
                doc.y = 50;
            }

            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    inCodeBlock = false;
                    const codeText = codeBuffer.join('\n');
                    const blockHeight = Math.min(300, Math.max(30, codeBuffer.length * 11 + 14));

                    if (doc.y + blockHeight > 720) doc.addPage();

                    const startY = doc.y;
                    doc.rect(leftX, startY, width, blockHeight).fill('#0F172A');
                    doc.fontSize(8).font('Courier').fillColor('#38BDF8')
                       .text(codeText, leftX + 10, startY + 8, { width: width - 20 });

                    doc.y = startY + blockHeight + 10;
                    codeBuffer = [];
                } else {
                    inCodeBlock = true;
                    codeBuffer = [];
                }
                continue;
            }

            if (inCodeBlock) {
                codeBuffer.push(lines[i]);
                continue;
            }

            if (line.startsWith('# ')) {
                doc.moveDown(0.5);
                const titleText = line.replace('# ', '').trim();
                if (titleText) {
                    doc.fontSize(15).font('Helvetica-Bold').fillColor('#0F172A').text(titleText, leftX, doc.y);
                    doc.moveTo(leftX, doc.y + 2).lineTo(leftX + width, doc.y + 2).lineWidth(1).stroke('#CBD5E1');
                    doc.moveDown(0.4);
                }
            } else if (line.startsWith('## ')) {
                doc.moveDown(0.4);
                const subText = line.replace('## ', '').trim();
                if (subText) {
                    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E293B').text(subText, leftX, doc.y);
                    doc.moveDown(0.3);
                }
            } else if (line.startsWith('### ')) {
                doc.moveDown(0.3);
                const h3Text = line.replace('### ', '').trim();
                if (h3Text) {
                    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#334155').text(h3Text, leftX, doc.y);
                    doc.moveDown(0.2);
                }
            } else if (line.startsWith('> ')) {
                const quoteText = line.replace('> ', '').replace(/\*\*/g, '').trim();
                if (quoteText) {
                    const startY = doc.y;
                    doc.rect(leftX, startY, width, 20).fill('#F1F5F9');
                    doc.rect(leftX, startY, 4, 20).fill('#3B82F6');
                    doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#334155')
                       .text(quoteText, leftX + 12, startY + 5, { width: width - 20 });
                    doc.y = startY + 24;
                }
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                const bulletText = line.substring(2).replace(/\*\*/g, '').trim();
                if (bulletText) {
                    doc.fontSize(9).font('Helvetica').fillColor('#1E293B')
                       .text(`•  ${bulletText}`, leftX + 10, doc.y, { width: width - 10 });
                }
            } else if (line.startsWith('|')) {
                // Format Markdown Table Lines
                if (line.includes('---')) continue;
                const cols = line.split('|').filter(c => c.trim().length > 0).map(c => c.trim().replace(/`/g, '').replace(/\*\*/g, ''));
                if (cols.length >= 2) {
                    const isHeader = i > 0 && lines[i+1] && lines[i+1].includes('---');
                    const startY = doc.y;
                    
                    if (isHeader) {
                        doc.rect(leftX, startY, width, 18).fill('#E2E8F0');
                        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A');
                    } else {
                        doc.fontSize(8).font('Helvetica').fillColor('#334155');
                    }

                    doc.text(cols[0], leftX + 5, startY + 4, { width: 130 });
                    doc.text(cols[1], leftX + 140, startY + 4, { width: 160 });
                    if (cols[2]) doc.text(cols[2], leftX + 305, startY + 4, { width: 200 });

                    doc.y = startY + 20;
                    doc.moveTo(leftX, doc.y).lineTo(leftX + width, doc.y).lineWidth(0.5).stroke('#CBD5E1');
                }
            } else if (line.trim().length > 0 && !line.startsWith('---')) {
                const cleanText = line.replace(/\*\*/g, '').replace(/`/g, '').trim();
                if (cleanText) {
                    doc.fontSize(9).font('Helvetica').fillColor('#334155')
                       .text(cleanText, leftX, doc.y, { width: width });
                }
            } else {
                doc.moveDown(0.2);
            }
        }

        // Add page numbers footer
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).font('Helvetica').fillColor('#94A3B8')
               .text(`Page ${i + 1} of ${range.count}  |  Lords & Kings Enterprises System Reference Guide`, leftX, 790, { align: 'center', width: width });
        }

        doc.end();
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', (err) => reject(err));
    });
}

const mdPath = path.join(__dirname, 'PROJECT_BACKUP_GUIDE.md');
const pdfPath = path.join(__dirname, 'Lords_and_Kings_Project_Backup_Guide.pdf');

generateBackupGuidePDF(mdPath, pdfPath)
    .then(() => console.log('✅ Refined PDF generated successfully:', pdfPath))
    .catch((err) => console.error('Error generating PDF:', err));
