const { parseDispatchMessage } = require('./parser');

const userSample = ` Gr1345 nz gala CAJ
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

console.log("Parsing user sample dispatches...\n");
const results = parseDispatchMessage(userSample);
console.log(JSON.stringify(results, null, 2));
console.log(`\nTotal dispatches parsed: ${results.length}`);
