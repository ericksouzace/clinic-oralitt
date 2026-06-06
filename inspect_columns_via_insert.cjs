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
  console.log("Could not read .env file");
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

const dummyId = '00000000-0000-0000-0000-000000000000';

async function main() {
  console.log("Inspecting columns via insert/select...");
  for (const table of tables) {
    try {
      // We do a select with single, or insert a dummy.
      // Wait, we can do a select that triggers a schema load by selecting a non-existent column,
      // but Postgres might list the actual columns! Let's try that first because it's non-destructive.
      const { data, error } = await supabase.from(table).select('non_existent_column_to_get_schema');
      if (error) {
        // PostgREST/PostgreSQL error messages often look like:
        // "Could not find column non_existent_column_to_get_schema in schema..."
        // Or in the details it might list available columns.
        console.log(`Table "${table}" error:`, error.message);
        if (error.details) console.log(`  Details:`, error.details);
        if (error.hint) console.log(`  Hint:`, error.hint);
      }
    } catch (err) {
      console.log(`Table "${table}" exception:`, err.message);
    }
  }
}

main();
