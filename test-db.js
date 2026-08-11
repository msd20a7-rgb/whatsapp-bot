const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ibflwpfzhqudjautjpaq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZmx3cGZ6aHF1ZGphdXRqcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODE4MzMsImV4cCI6MjEwMDk1NzgzM30.NNC4fklFrVO-j682C5IBtWsab5F-6jjRNfogxOmKG4U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase.from('stock_items').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Data:', data.length, 'items');
        console.log(data);
    }
}
test();
