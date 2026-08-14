/**
 * Parser for WhatsApp group dispatch messages
 */

function parseDispatchMessage(text) {
    if (!text || typeof text !== 'string') return [];

    // Clean up WhatsApp copy-paste timestamp headers if present e.g. "[5:04 pm, 11/8/2026] User Name: "
    let cleanText = text.replace(/\[\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?,?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*[^:]+:\s*/g, '');
    // Insert newline before any GR header that appears inline after spaces
    cleanText = cleanText.replace(/([^\n])\s+(?=(?:GR|Gr|gr)\s*\d+)/g, '$1\n');

    const blocks = [];
    // Split message into blocks by lines starting with Gr or GR
    const grHeaderRegex = /(?=(?:^|\n)\s*(?:GR|Gr|gr)\s*\d+)/g;
    const rawChunks = cleanText.split(grHeaderRegex).map(c => c.trim()).filter(Boolean);

    for (const chunk of rawChunks) {
        const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) continue;

        // Line 1: GR Number + Variety
        // e.g. "Gr1345 nz gala CAJ" or "Gr1341 nz gala bigcrunch"
        const line1Match = lines[0].match(/(Gr\d+|GR\d+|gr\d+)\s*(.*)/i);
        if (!line1Match) continue;

        const grnNumber = line1Match[1].toUpperCase();
        const variety = line1Match[2].trim();

        // Line 2: Size and Box count
        // e.g. "Vp135-30box", "135-22box", "Vp120-10box"
        let size = '';
        let qtyBoxes = 0;

        const line2Match = lines[1].match(/^([A-Za-z0-9]+)-(\d+)\s*box(?:es)?/i);
        if (line2Match) {
            size = line2Match[1].trim();
            qtyBoxes = parseInt(line2Match[2], 10);
        } else {
            // Alternative regex fallback: e.g. "30box" or "30 boxes"
            const boxOnlyMatch = lines[1].match(/(\d+)\s*box(?:es)?/i);
            if (boxOnlyMatch) {
                qtyBoxes = parseInt(boxOnlyMatch[1], 10);
                size = lines[1].replace(/(\d+)\s*box(?:es)?/i, '').replace(/-/g, '').trim();
            }
        }

        if (qtyBoxes <= 0) continue;

        // Remaining lines: Transport and Party
        let transportName = '';
        let partyName = '';

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            if (/transport|trasport|trnsport|logistics|express/i.test(line)) {
                transportName = line;
            } else if (!partyName) {
                partyName = line;
            } else {
                if (!transportName) transportName = line;
                else partyName += ' ' + line;
            }
        }

        blocks.push({
            grnNumber,
            variety,
            size,
            qtyBoxes,
            transportName: transportName || 'Direct',
            partyName: partyName || 'Unknown Party',
            rawText: chunk
        });
    }

    return blocks;
}

module.exports = {
    parseDispatchMessage
};
