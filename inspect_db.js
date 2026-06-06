const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

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

async function inspect() {
  console.log("Inspecting tables...");
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table "${table}": Error ->`, error.message, `(Code: ${error.code})`);
      } else {
        const columns = data.length > 0 ? Object.keys(data[0]) : "Empty table (columns unknown)";
        console.log(`Table "${table}": Exists! Row count limit 1 sample:`, columns);
      }
    } catch (err) {
      console.log(`Table "${table}": Exception ->`, err.message);
    }
  }
}

inspect();
