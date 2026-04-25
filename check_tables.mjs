import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ebdqqippzkwksrdngasv.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViZHFxaXBwemt3a3NyZG5nYXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODcyNTMsImV4cCI6MjA5MDg2MzI1M30.olf1MZ_muc5q9mwHBV-4RjBdPB1UACiIiOVWYTxKj1Q";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log("Checking if tables exist...\n");

  const tables = [
    "companies",
    "jobs",
    "applications",
    "users",
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select("id").limit(1);

      if (error) {
        console.error(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Table exists!`);
      }
    } catch (err) {
      console.error(`❌ ${table}: ${err.message}`);
    }
  }

  console.log("\n--- Checking companies count ---");
  const { data, error } = await supabase
    .from("companies")
    .select("count", { count: "exact" });
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Companies in database:", data);
  }
}

checkTables();
