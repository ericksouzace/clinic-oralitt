const fs = require('fs');

// Manual env parsing
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

const url = envVars.VITE_SUPABASE_URL;
const key = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const fetchUrl = `${url}/rest/v1/`;

async function main() {
  console.log("Fetching schema from:", url);
  try {
    const response = await fetch(fetchUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const schema = await response.json();
    fs.writeFileSync('schema_openapi.json', JSON.stringify(schema, null, 2));
    console.log("Schema saved to schema_openapi.json!");

    // Print columns for each of our target tables
    const targets = [
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

    const definitions = schema.definitions || {};
    for (const table of targets) {
      const def = definitions[table];
      if (def) {
        console.log(`\nTable "${table}":`);
        const props = def.properties || {};
        const required = def.required || [];
        for (const [colName, colDef] of Object.entries(props)) {
          const req = required.includes(colName) ? "REQUIRED" : "OPTIONAL";
          console.log(`  - ${colName} (${colDef.type}${colDef.format ? ', ' + colDef.format : ''}) [${req}] - ${colDef.description || ''}`);
        }
      } else {
        console.log(`\nTable "${table}" not found in schema definitions.`);
      }
    }

  } catch (err) {
    console.error("Error fetching schema:", err.message);
  }
}

main();
