const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

let envVars = {};
try {
  const env = fs.readFileSync('.env', 'utf8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      envVars[key] = val;
    }
  });
} catch (e) {
  console.log("Could not read .env");
}

const url = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(url, key);

const tables = [
  'supplies',
  'stock_movements',
  'procedures',
  'procedure_supplies',
  'clinical_records',
  'clinical_record_supplies',
  'odontogram_entries',
  'treatment_plans',
  'treatment_plan_items',
  'budgets',
  'budget_items',
  'payment_installments',
  'payments',
  'payment_splits'
];

async function main() {
  console.log("Inspecting columns by finding actual column structures...");
  
  // We need to sign in as a user, or we can use a dummy insert. But wait, if we are anon,
  // we might not have insert permissions due to RLS!
  // Let's see if we can do an insert.
  for (const table of tables) {
    // Let's try to insert with a random UUID. If RLS fails, we'll see "violates row-level security policy".
    // Wait, let's see if there is any existing row in the table, maybe there's already some rows from other users or seeded data?
    // Let's try to run a select count or check if there is data.
    const { data: selectData, error: selectError } = await supabase.from(table).select('*').limit(1);
    if (selectError) {
      console.log(`Table "${table}" select error:`, selectError.message);
      continue;
    }
    
    // If it's empty, we try a mock insert.
    // Let's generate a temporary UUID.
    const tempId = '99999999-9999-9999-9999-999999999999';
    // Let's use a dummy user_id
    const dummyUserId = '00000000-0000-0000-0000-000000000000';
    
    // We try to insert a row. Since we don't know the columns, we can try to guess basic columns like user_id.
    const { data: insertData, error: insertError } = await supabase.from(table).insert({
      id: tempId,
      user_id: dummyUserId,
      name: 'Test Temp Insumo',
      full_name: 'Test Patient Temp'
    }).select();
    
    if (insertError) {
      console.log(`Table "${table}" insert error:`, insertError.message);
      if (insertError.details) console.log(`  Details:`, insertError.details);
    } else if (insertData && insertData.length > 0) {
      console.log(`Table "${table}" columns:`, Object.keys(insertData[0]));
      // Delete it right away
      await supabase.from(table).delete().eq('id', tempId);
    } else {
      console.log(`Table "${table}" insert returned empty.`);
    }
  }
}

main();
