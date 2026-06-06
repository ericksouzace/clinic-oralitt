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

async function main() {
  console.log("Testing extra columns in stock_movements...");
  
  const tempId = '99999999-9999-9999-9999-999999999999';
  const dummyUserId = '00000000-0000-0000-0000-000000000000';
  
  // Test patient_id first
  const payload1 = {
    id: tempId,
    user_id: dummyUserId,
    patient_id: tempId
  };
  
  const res1 = await supabase.from('stock_movements').insert(payload1);
  if (res1.error) {
    console.log("patient_id test error:", res1.error.message);
  } else {
    console.log("patient_id is valid!");
  }
  
  // Test clinical_record_id
  const payload2 = {
    id: tempId,
    user_id: dummyUserId,
    clinical_record_id: tempId
  };
  
  const res2 = await supabase.from('stock_movements').insert(payload2);
  if (res2.error) {
    console.log("clinical_record_id test error:", res2.error.message);
  } else {
    console.log("clinical_record_id is valid!");
  }
}

main();
