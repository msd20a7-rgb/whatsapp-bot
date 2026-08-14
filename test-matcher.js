const { createClient } = require('@supabase/supabase-js');
const { parseDispatchMessage } = require('./parser');

const supabaseUrl = 'https://ibflwpfzhqudjautjpaq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZmx3cGZ6aHF1ZGphdXRqcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODE4MzMsImV4cCI6MjEwMDk1NzgzM30.NNC4fklFrVO-j682C5IBtWsab5F-6jjRNfogxOmKG4U';
const supabase = createClient(supabaseUrl, supabaseKey);

function findBestMatchingStockItem(stockItems, dispatch) {
    if (!stockItems || stockItems.length === 0) return null;
    if (stockItems.length === 1) return stockItems[0];

    const grnDigits = dispatch.grnNumber.replace(/\D/g, '');
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

        const sizeDigits = dispatchSize.replace(/\D/g, '');
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

const sampleText = ` Gr1345 nz gala CAJ
Vp135-30box

Sheker trasport 
Akr tc
Gr1340 nz gala CAJ
Vp120-10box

Sheker trasport 
Udaya
 Gr1341 nz gala bigcrunch
135-22box
Shekar transport 
Udaya     Gr1341 nz gala bigcrunch
135-20box

Shekar transport 
Ak shiva
Gr1345 nz gala caj
Vp135-10box

Vinyak trasport
Ak gobal`;

async function testMatch() {
    const dispatches = parseDispatchMessage(sampleText);
    console.log(`Parsed ${dispatches.length} dispatches:\n`);

    const { data: stockItems } = await supabase.from('stock_items').select('*');

    for (const dispatch of dispatches) {
        const grnDigits = dispatch.grnNumber.replace(/\D/g, '');
        const matchingRows = stockItems.filter(item => item.grn_number.includes(grnDigits));
        const matched = findBestMatchingStockItem(matchingRows, dispatch);

        if (matched) {
            console.log(`Dispatch: ${dispatch.grnNumber} (${dispatch.variety}, ${dispatch.size}, ${dispatch.qtyBoxes} boxes)`);
            console.log(`  -> Matched Row: ${matched.grn_number} | Brand: ${matched.brand} | Size: ${matched.sub_uom} | Current Stock: ${matched.closing_qty} boxes`);
            console.log(`  -> New Stock Balance will be: ${Math.max(0, matched.closing_qty - dispatch.qtyBoxes)} boxes\n`);
        } else {
            console.log(`❌ No match for ${dispatch.grnNumber}\n`);
        }
    }
}

testMatch();
