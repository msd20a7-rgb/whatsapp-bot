const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parseDispatchMessage } = require('./parser');

const supabaseUrl = 'https://ibflwpfzhqudjautjpaq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZmx3cGZ6aHF1ZGphdXRqcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODE4MzMsImV4cCI6MjEwMDk1NzgzM30.NNC4fklFrVO-j682C5IBtWsab5F-6jjRNfogxOmKG4U';
const supabase = createClient(supabaseUrl, supabaseKey);

function findBestMatchingStockItem(stockItems, dispatch) {
    if (!stockItems || stockItems.length === 0) return null;
    if (stockItems.length === 1) return stockItems[0];

    const grnDigits = dispatch.grnNumber.replace(/[^0-9]/g, '');
    const dispatchVariety = (dispatch.variety || '').toUpperCase();
    const dispatchSize = (dispatch.size || '').toUpperCase();

    let bestItem = null;
    let bestScore = -1;

    for (const item of stockItems) {
        let score = 0;
        const brand = (item.brand || '').toUpperCase();
        const productName = (item.product_name || '').toUpperCase();
        const variety = (item.variety || '').toUpperCase();
        const subUom = (item.sub_uom || '').toUpperCase();

        if (grnDigits && item.grn_number.includes(grnDigits)) score += 10;
        if (brand && dispatchVariety.includes(brand)) score += 25;
        else if (variety && dispatchVariety.includes(variety)) score += 15;
        else if (productName && dispatchVariety.includes(productName)) score += 10;

        const sizeDigits = dispatchSize.replace(/[^0-9]/g, '');
        const sizeLetters = dispatchSize.replace(/[^A-Z]/g, '');

        if (subUom) {
            if (sizeDigits && subUom.includes(sizeDigits)) score += 20;
            if (sizeLetters && subUom.includes(sizeLetters)) score += 15;
        }

        if (score > bestScore) {
            bestScore = score;
            bestItem = item;
        }
    }

    return bestItem || stockItems[0];
}

let executablePath = '';
if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
    executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
} else if (fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')) {
    executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: executablePath || undefined,
    }
});

client.on('qr', (qr) => {
    console.log('Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Lords and Kings Stock Bot is connected and listening!');
});

async function fetchStockDataFromSupabase(partyName = 'LORDS & KINGS ENTERPRISES') {
    const { data: items, error } = await supabase
        .from('stock_items')
        .select('*')
        .eq('party_name', partyName)
        .order('grn_date', { ascending: true });
        
    if (error) {
        console.error('Error fetching from Supabase:', error);
        throw error;
    }

    const asOfDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
    
    const grnGroupsMap = {};
    items.forEach(item => {
        if (!grnGroupsMap[item.grn_number]) {
            const dateStr = new Date(item.grn_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
            grnGroupsMap[item.grn_number] = {
                grnNumber: item.grn_number,
                date: dateStr,
                items: []
            };
        }
        grnGroupsMap[item.grn_number].items.push({
            id: item.id,
            productName: item.product_name,
            brand: item.brand,
            varity: item.variety,
            lotNo: item.lot_no,
            rateType: item.rate_type,
            uom: item.uom,
            subUom: item.sub_uom,
            closingQty: Number(item.closing_qty)
        });
    });

    return {
        partyName,
        asOfDate,
        grnGroups: Object.values(grnGroupsMap)
    };
}

/**
 * Generates a Stock Summary PDF matching the Lords and Kings layout
 */
function generateStockSummaryPDF(data, outputPath) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 30 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const leftX = 30;
        const rightX = 565;
        const width = rightX - leftX;

        // --- 1. OUTER BORDER ---
        doc.rect(leftX, 30, width, 780).stroke('#333333');

        // --- 2. HEADER SECTION ---
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#000000').text('LORDS & KINGS', leftX + 15, 45);
        doc.fontSize(8).font('Helvetica').fillColor('#666666').text('Logistics & Beyond', leftX + 15, 68);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
           .text('LORDS & KINGS ENTERPRISES', 230, 42, { align: 'right', width: 320 });
        
        doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
           .text('No.314/1A2, Chettipedu Village,Sriperumbudur Taluk,\nKancheepuram District,Tamil Nadu - 602105.\nContact : 9994215809\nE-Mail: contact@lordsandkings.com\nWebsite: www.lordsandkings.com', 230, 52, { align: 'right', width: 320 });

        doc.moveTo(leftX, 110).lineTo(rightX, 110).lineWidth(1).stroke('#333333');

        // --- 3. TITLE BAR ---
        doc.rect(leftX, 110, width, 22).fill('#CCCCCC');
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
           .text('STOCK SUMMARY', leftX, 116, { align: 'center', width: width });

        doc.moveTo(leftX, 132).lineTo(rightX, 132).stroke('#333333');

        // --- 4. METADATA ROW ---
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
           .text('Party :', leftX + 10, 138);
        doc.font('Helvetica-Bold')
           .text(data.partyName || 'LORDS & KINGS ENTERPRISES', leftX + 60, 138);

        doc.font('Helvetica-Bold')
           .text(`As On Date :   ${data.asOfDate}`, 380, 138, { align: 'right', width: 170 });

        doc.moveTo(leftX, 155).lineTo(rightX, 155).stroke('#333333');

        // --- 5. TABLE HEADERS ---
        let y = 162;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('ProductName', leftX + 10, y, { width: 130 });
        doc.text('Brand', 170, y, { width: 80 });
        doc.text('Varity', 255, y, { width: 70 });
        doc.text('LotNo', 330, y, { width: 50 });
        doc.text('RateType', 380, y, { width: 45 });
        doc.text('UOM', 430, y, { width: 35 });
        doc.text('SubUom', 470, y, { width: 45 });
        doc.text('ClosingQty', 510, y, { width: 45, align: 'right' });

        y += 15;
        doc.moveTo(leftX, y).lineTo(rightX, y).stroke('#333333');

        let overallTotalQty = 0;

        // --- 6. GRN GROUPS & ITEMS ---
        data.grnGroups.forEach((group) => {
            doc.rect(leftX, y, width, 18).fill('#E6E6E6');
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000')
               .text(group.grnNumber, leftX + 10, y + 4);
            doc.text(group.date, 450, y + 4, { align: 'right', width: 105 });

            y += 18;
            doc.moveTo(leftX, y).lineTo(rightX, y).stroke('#333333');

            let groupSubtotal = 0;

            group.items.forEach((item, index) => {
                y += 6;
                doc.fontSize(8).font('Helvetica').fillColor('#000000');
                doc.text(item.productName, leftX + 10, y, { width: 130 });
                doc.text(item.brand, 170, y, { width: 80 });
                doc.text(item.varity, 255, y, { width: 70 });
                doc.text(item.lotNo, 330, y, { width: 50 });
                doc.text(item.rateType, 380, y, { width: 45 });
                doc.text(item.uom, 430, y, { width: 35 });
                doc.text(item.subUom, 470, y, { width: 45 });
                doc.text(item.closingQty.toFixed(2), 510, y, { width: 45, align: 'right' });

                groupSubtotal += item.closingQty;
                y += 12;

                if (index < group.items.length - 1) {
                    doc.save()
                       .dash(1, { space: 2 })
                       .moveTo(leftX + 10, y)
                       .lineTo(rightX - 10, y)
                       .stroke('#888888')
                       .restore();
                }
            });

            y += 2;
            doc.moveTo(leftX, y).lineTo(rightX, y).stroke('#333333');

            y += 4;
            doc.fontSize(8.5).font('Helvetica-Bold')
               .text(groupSubtotal.toFixed(2), 510, y, { width: 45, align: 'right' });
            
            overallTotalQty += groupSubtotal;

            y += 14;
            doc.moveTo(leftX, y).lineTo(rightX, y).stroke('#333333');
        });

        // --- 7. GRAND TOTAL BOX ---
        y += 15;
        doc.moveTo(leftX, y).lineTo(rightX, y).lineWidth(1.5).stroke('#333333');
        
        y += 5;
        doc.fontSize(9).font('Helvetica-Bold')
           .text('Total Qty', 380, y, { align: 'right', width: 100 });
        doc.fontSize(10).font('Helvetica-Bold')
           .text(overallTotalQty.toFixed(0), 510, y, { align: 'right', width: 45 });

        y += 15;
        doc.moveTo(leftX, y).lineTo(rightX, y).lineWidth(1).stroke('#333333');

        doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', (err) => reject(err));
    });
}

/**
 * Generates a Delivery Challan PDF matching the Lords and Kings layout
 */
function generateDeliveryChallanPDF(data, outputPath) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 30 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const leftX = 30;
        const rightX = 565;
        const width = rightX - leftX;

        // --- 1. OUTER BORDER ---
        doc.rect(leftX, 30, width, 780).stroke('#333333');

        // --- 2. HEADER SECTION ---
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#000000').text('LORDS & KINGS', leftX + 15, 45);
        doc.fontSize(8).font('Helvetica').fillColor('#666666').text('Logistics & Beyond', leftX + 15, 68);
        doc.fontSize(8).fillColor('#333333');
        doc.text('GSTIN', leftX + 15, 85); doc.text(':  33AAACP4290L1ZB', leftX + 50, 85);
        doc.text('CIN', leftX + 15, 95);   doc.text(':  U74900TN1993PTC024718', leftX + 50, 95);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
           .text('LORDS & KINGS ENTERPRISES', 230, 42, { align: 'right', width: 320 });
        
        doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
           .text('No.314/1A2, Chettipedu Village,Sriperumbudur Taluk,\nKancheepuram District,Tamil Nadu - 602105.\nContact : 9994215809\nE-Mail: contact@lordsandkings.com\nWebsite: www.lordsandkings.com', 230, 52, { align: 'right', width: 320 });

        doc.moveTo(leftX, 115).lineTo(rightX, 115).lineWidth(1).stroke('#333333');

        // --- 3. TITLE BAR ---
        doc.rect(leftX, 115, width, 18).fill('#E6E6E6');
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
           .text('DELIVERY CHALLAN', leftX, 120, { align: 'center', width: width });

        doc.moveTo(leftX, 133).lineTo(rightX, 133).stroke('#333333');
        // --- 4. METADATA SECTION ---
        doc.fontSize(8).font('Helvetica');
        let metaY = 140;
        
        // Left Column
        doc.text('Customer Name', leftX + 5, metaY); doc.text(':', leftX + 80, metaY); doc.text(data.customerName, leftX + 90, metaY, { width: 170 });
        doc.text('Address', leftX + 5, metaY + 15); doc.text(':', leftX + 80, metaY + 15); 
        doc.text(data.address, leftX + 90, metaY + 15, { width: 170 });
        
        // Dynamically calculate the space needed for the address
        let addressHeight = doc.heightOfString(data.address, { width: 170 });
        let leftNextY = metaY + 15 + addressHeight + 10; // push down Contact Person
        
        doc.text('Contact Person', leftX + 5, leftNextY); doc.text(':', leftX + 80, leftNextY); doc.text(data.contactPerson, leftX + 90, leftNextY);
        doc.text('Contact No', leftX + 5, leftNextY + 10); doc.text(':', leftX + 80, leftNextY + 10); doc.text(data.contactNo, leftX + 90, leftNextY + 10);
        
        // Right Column
        doc.text('DC No', 340, metaY); doc.text(':', 400, metaY); doc.text(data.dcNo, 410, metaY);
        doc.text('DC Date', 340, metaY + 10); doc.text(':', 400, metaY + 10); doc.text(data.dcDate, 410, metaY + 10);
        doc.text('Destination', 340, metaY + 20); doc.text(':', 400, metaY + 20); doc.text(data.destination, 410, metaY + 20);
        doc.text('Prepared By', 340, metaY + 30); doc.text(':', 400, metaY + 30); doc.text(data.preparedBy, 410, metaY + 30);
        doc.text('Vehicle No', 340, metaY + 40); doc.text(':', 400, metaY + 40); doc.text(data.vehicleNo, 410, metaY + 40);
        doc.text('Gate In NO', 340, metaY + 50); doc.text(':', 400, metaY + 50); doc.text(data.gateInNo, 410, metaY + 50);

        // Find the lowest point of both columns to draw the separator line
        let sectionBottomY = Math.max(leftNextY + 25, metaY + 65);

        doc.moveTo(leftX, sectionBottomY).lineTo(rightX, sectionBottomY).stroke('#333333');

        // --- 5. TABLE HEADERS ---
        let y = sectionBottomY + 5;
        doc.font('Helvetica-Bold');
        doc.text('S.NO.', leftX + 5, y);
        doc.text('GRN No', leftX + 40, y);
        doc.text('Brand', leftX + 135, y);
        doc.text('Variety', leftX + 225, y);
        doc.text('LOT NO', leftX + 295, y);
        doc.text('COUNT', leftX + 355, y);
        doc.text('Qty', leftX + 415, y, { align: 'right', width: 30 });
        doc.text('RateType', leftX + 465, y);

        y += 15;
        doc.moveTo(leftX, y).lineTo(rightX, y).stroke('#333333');

        let tableTop = sectionBottomY; // Table lines should start from the section bottom
        
        let totalQty = 0;
        doc.font('Helvetica');
        data.items.forEach((item, index) => {
            y += 5;
            doc.text((index + 1).toString(), leftX + 5, y);
            doc.text(item.grnNo, leftX + 40, y);
            doc.text(item.brand, leftX + 135, y);
            doc.text(item.variety, leftX + 225, y);
            doc.text(item.lotNo, leftX + 295, y);
            doc.text(item.count, leftX + 355, y);
            doc.text(item.qty.toFixed(2), leftX + 415, y, { align: 'right', width: 30 });
            doc.text(item.rateType, leftX + 465, y);
            
            totalQty += item.qty;
            y += 15;
        });

        // Fill empty space to make it look like a full table (up to bottom footer)
        let tableBottom = 680;
        
        // Draw vertical lines for the table
        const vLines = [leftX + 35, leftX + 130, leftX + 220, leftX + 290, leftX + 350, leftX + 410, leftX + 460];
        vLines.forEach(xPos => {
            doc.moveTo(xPos, tableTop).lineTo(xPos, tableBottom).stroke('#333333');
        });

        doc.moveTo(leftX, tableBottom).lineTo(rightX, tableBottom).stroke('#333333');

        // --- 6. TOTALS ---
        doc.font('Helvetica-Bold');
        doc.text('Total Qty', leftX + 350, tableBottom + 10);
        doc.text(totalQty.toFixed(0), leftX + 415, tableBottom + 10, { align: 'right', width: 30 });
        
        doc.moveTo(leftX, tableBottom + 30).lineTo(rightX, tableBottom + 30).stroke('#333333');

        // --- 7. FOOTER ---
        doc.font('Helvetica');
        doc.text('REMARKS:', leftX + 5, tableBottom + 35);
        doc.text('E. & O.E', rightX - 60, tableBottom + 35);
        
        doc.text('GR', leftX + 5, tableBottom + 55);
        doc.text('For Lords and Kings Enterprises', rightX - 180, tableBottom + 55);
        
        // Signature Placeholder
        doc.moveTo(rightX - 120, tableBottom + 105).lineTo(rightX - 20, tableBottom + 105).stroke('#888888');
        doc.fontSize(8).text('Authorised Signatory', rightX - 120, tableBottom + 110, { width: 100, align: 'center' });

        doc.end();
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', (err) => reject(err));
    });
}

// Global Dummy Delivery Challan State
let currentChallanData = {
    customerName: 'LORDS & KINGS ENTERPRISES',
    address: 'NO.2/162, 1ST FLOOR, MARY DAVID ILLAMS, KAMARAJAR NAGAR, 9TH CROSS STREET, PERUNGUDI, Chennai -600096, Tamil Nadu',
    contactPerson: 'KARPOV MICHAEL RAJ',
    contactNo: '9003631790',
    dcNo: 'DC/0009833/26-27',
    dcDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
    destination: '',
    preparedBy: 'ELAMURUGAN',
    vehicleNo: 'TN22 C 7236',
    gateInNo: 'GPV/0005534/26-27',
    items: []
};

const userSessions = {};

client.on('message_create', async (msg) => {
    console.log(`📩 Incoming message from ${msg.from} to ${msg.to}: "${msg.body}"`);

    // Only respond to our specific chat (check both from and to)
    if (!msg.from.includes('181148835647707') && !msg.to.includes('181148835647707')) {
        return;
    }

    // Ignore messages from the bot itself to prevent loops
    if (msg.fromMe && (msg.body === 'pong 🏓' || msg.body.includes('Generating') || msg.body.includes('Updated GRN') || msg.hasMedia || msg.body.includes('Welcome to Lords and Kings') || msg.body.includes('Available Products') || msg.body.includes('Enter the quantity') || msg.body.includes('Reply with the product number'))) {
        return;
    }

    const text = msg.body.trim().toUpperCase();
    const chatId = msg.from;

    if (!userSessions[chatId]) {
        userSessions[chatId] = { state: 'IDLE' };
    }
    const session = userSessions[chatId];

    // Ignore messages sent by the bot itself or confirmation replies to prevent loops
    if (!msg.fromMe && !msg.body.includes('Logged dispatch') && !msg.body.includes('Decremented stock')) {
        const dispatches = parseDispatchMessage(msg.body);
        if (dispatches.length > 0) {
            try {
                const { data: stockItems } = await supabase.from('stock_items').select('*');
                let loggedCount = 0;

                for (const dispatch of dispatches) {
                    const grnDigits = dispatch.grnNumber.replace(/[^0-9]/g, '');
                    const matchingRows = stockItems ? stockItems.filter(item => item.grn_number.includes(grnDigits)) : [];
                    const matched = findBestMatchingStockItem(matchingRows, dispatch);

                    if (matched) {
                        const oldQty = Number(matched.closing_qty);
                        const newQty = Math.max(0, oldQty - dispatch.qtyBoxes);

                        const { error } = await supabase
                            .from('stock_items')
                            .update({ closing_qty: newQty })
                            .eq('id', matched.id);

                        if (!error) {
                            matched.closing_qty = newQty;
                            loggedCount++;
                            console.log(`[SILENT DISPATCH LISTENER] Deducted ${dispatch.qtyBoxes} boxes from GRN ${matched.grn_number} (${matched.brand} / ${matched.sub_uom}). New stock: ${newQty}`);
                            await msg.reply(`✅ Logged dispatch: ${dispatch.grnNumber}, ${dispatch.qtyBoxes} boxes to ${dispatch.partyName}
📉 Decremented stock for GRN ${matched.grn_number} (${matched.brand} / ${matched.sub_uom}): ${oldQty} -> ${newQty} (deducted ${dispatch.qtyBoxes} boxes)`);
                        } else {
                            console.error('Error updating stock in Supabase:', error);
                        }
                    }
                }
                if (loggedCount > 0) return;
            } catch (err) {
                console.error('Error handling dispatch message:', err);
            }
        }
    }

    if (text === 'PING') {
        msg.reply('pong 🏓');
        return;
    }

    if (text === 'CANCEL') {
        session.state = 'IDLE';
        session.selectedProduct = null;
        await msg.reply('❌ Action cancelled. Returning to main menu.');
        return;
    }

    switch (session.state) {
        case 'IDLE':
            if (text === 'LAK/-0026') {
                session.state = 'AWAITING_ACTION';
                await msg.reply('*Welcome to Lords and Kings!*\nPlease choose an option for LORDS & KINGS:\n1️⃣ Deliver Products\n2️⃣ Get Stock Summary\n\n_(Reply with 1 or 2)_');
            }
            break;

        case 'AWAITING_ACTION':
            if (text === '1') {
                session.state = 'AWAITING_PRODUCT_SELECTION';
                session.cart = []; // Initialize cart
                
                try {
                    const stockData = await fetchStockDataFromSupabase();
                    
                    let productList = '*Available Products:*\n\n';
                    let productIndex = 1;
                    session.availableProducts = [];

                    stockData.grnGroups.forEach(group => {
                        group.items.forEach(item => {
                            if (item.closingQty > 0) {
                                productList += `${productIndex}. ${item.productName} (${item.brand}) - LOT: ${item.lotNo}\n   Avail: ${item.closingQty} ${item.uom}\n`;
                                session.availableProducts.push({
                                    index: productIndex,
                                    grnNumber: group.grnNumber,
                                    ...item
                                });
                                productIndex++;
                            }
                        });
                    });
                    
                    if (session.availableProducts.length === 0) {
                        session.state = 'IDLE';
                        await msg.reply('⚠️ No stock available currently.');
                        return;
                    }

                    productList += '\n_(Reply with the product number AND quantity separated by a space. E.g., *1 5* for Product 1, Qty 5. Type CANCEL to abort)_';
                    await msg.reply(productList);
                } catch (error) {
                    session.state = 'IDLE';
                    await msg.reply('❌ Failed to fetch stock from Supabase.');
                }
                
            } else if (text === '2') {
                session.state = 'IDLE';
                await msg.reply('⏳ Generating Stock Summary PDF report from live data...');
                try {
                    const stockData = await fetchStockDataFromSupabase();
                    const pdfFilename = `Stock_Summary_${Date.now()}.pdf`;
                    const pdfPath = path.join(__dirname, pdfFilename);
                    
                    await generateStockSummaryPDF(stockData, pdfPath);
                    const media = MessageMedia.fromFilePath(pdfPath);
                    await client.sendMessage(msg.to, media, { caption: `📄 *Lords and Kings Live Stock Summary*\n*Party:* ${stockData.partyName}\n*As On Date:* ${stockData.asOfDate}` });
                    fs.unlinkSync(pdfPath);
                } catch (error) {
                    console.error('Error generating Stock Summary PDF:', error);
                    await msg.reply('❌ Failed to generate Stock Summary PDF.');
                }
            } else {
                await msg.reply('⚠️ Invalid option. Please reply with 1 or 2, or type CANCEL.');
            }
            break;

        case 'AWAITING_PRODUCT_SELECTION':
            const parts = text.split(/\s+/);
            if (parts.length !== 2) {
                await msg.reply('⚠️ Invalid format. Please reply with the product number AND quantity separated by a space (e.g., *1 5*).');
                return;
            }

            const selectedNum = parseInt(parts[0]);
            const qty = parseFloat(parts[1]);

            if (isNaN(selectedNum) || isNaN(qty) || qty <= 0) {
                await msg.reply('⚠️ Invalid numbers provided. Please ensure both product number and quantity are valid numbers.');
                return;
            }
            
            const selectedProduct = session.availableProducts.find(p => p.index === selectedNum);
            if (!selectedProduct) {
                await msg.reply('⚠️ Invalid product number. Please select a valid number from the list.');
                return;
            }
            
            // Check if already in cart to calculate remaining availability
            let cartQty = 0;
            session.cart.forEach(cartItem => {
                if (cartItem.product.id === selectedProduct.id) {
                    cartQty += cartItem.qty;
                }
            });

            if ((qty + cartQty) > selectedProduct.closingQty) {
                await msg.reply(`⚠️ Insufficient stock! Max available for this item is ${selectedProduct.closingQty - cartQty}. Please enter a valid quantity.`);
                return;
            }
            
            // Add to cart
            session.cart.push({
                product: selectedProduct,
                qty: qty
            });

            session.state = 'AWAITING_ADD_MORE';
            await msg.reply(`✅ Added *${qty}* of *${selectedProduct.productName} (LOT: ${selectedProduct.lotNo})* to delivery.\n\nDo you want to add more products? (Reply *YES* or *NO*)`);
            break;

        case 'AWAITING_ADD_MORE':
            if (text === 'YES' || text === 'Y') {
                session.state = 'AWAITING_PRODUCT_SELECTION';
                let productList = '*Available Products:*\n\n';
                session.availableProducts.forEach(p => {
                    // Calculate remaining qty
                    let cartQty = 0;
                    session.cart.forEach(cartItem => {
                        if (cartItem.product.id === p.id) {
                            cartQty += cartItem.qty;
                        }
                    });
                    const remaining = p.closingQty - cartQty;
                    if (remaining > 0) {
                        productList += `${p.index}. ${p.productName} (${p.brand}) - LOT: ${p.lotNo}\n   Avail: ${remaining} ${p.uom}\n`;
                    }
                });
                productList += '\n_(Reply with the product number AND quantity separated by a space. E.g., *1 5*)_';
                await msg.reply(productList);
            } else if (text === 'NO' || text === 'N') {
                if (session.cart.length === 0) {
                    session.state = 'IDLE';
                    await msg.reply('❌ No items added to delivery. Cancelling.');
                    return;
                }

                await msg.reply(`⏳ Processing order and updating database...`);

                // Finalize delivery
                let itemsForChallan = [];
                
                // Track cumulative deductions by ID
                const deductions = {};
                session.cart.forEach(cartItem => {
                    if (!deductions[cartItem.product.id]) {
                        deductions[cartItem.product.id] = { product: cartItem.product, totalDeduct: 0 };
                    }
                    deductions[cartItem.product.id].totalDeduct += cartItem.qty;
                    
                    // Add to challan array
                    itemsForChallan.push({
                        grnNo: cartItem.product.grnNumber,
                        brand: cartItem.product.brand,
                        variety: cartItem.product.varity, // intentional spelling to match PDF
                        lotNo: cartItem.product.lotNo,
                        count: cartItem.product.subUom || '-',
                        qty: cartItem.qty,
                        rateType: cartItem.product.rateType
                    });
                });

                // Update Supabase
                for (const deductInfo of Object.values(deductions)) {
                     const newQty = deductInfo.product.closingQty - deductInfo.totalDeduct;
                     const { error } = await supabase
                         .from('stock_items')
                         .update({ closing_qty: newQty })
                         .eq('id', deductInfo.product.id);
                     
                     if (error) {
                         console.error('Error updating stock in Supabase:', error);
                     }
                }

                currentChallanData.items = itemsForChallan;
                currentChallanData.dcDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
                
                session.state = 'IDLE';
                session.cart = [];
                await msg.reply(`✅ Generating Delivery Challan PDF with ${itemsForChallan.length} item(s)...`);
                
                const pdfFilename = `Delivery_Challan_${Date.now()}.pdf`;
                const pdfPath = path.join(__dirname, pdfFilename);
                try {
                    await generateDeliveryChallanPDF(currentChallanData, pdfPath);
                    const media = MessageMedia.fromFilePath(pdfPath);
                    await client.sendMessage(msg.to, media, { caption: `📄 *Lords and Kings Delivery Challan*\n*Customer:* ${currentChallanData.customerName}\n*DC No:* ${currentChallanData.dcNo}` });
                    fs.unlinkSync(pdfPath);
                } catch (error) {
                    console.error('Error generating Delivery Challan PDF:', error);
                    await msg.reply('❌ Failed to generate Delivery Challan PDF.');
                }
            } else {
                await msg.reply('⚠️ Please reply with *YES* to add another product, or *NO* to generate the Challan.');
            }
            break;
    }
});

client.initialize();
