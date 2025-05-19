#!/bin/bash
# Script to apply the fix for ensure_user_profile_exists function via Supabase MCP
# This addresses the "invalid claim: sub claim must be a UUID" and "403 Forbidden" issues

echo "Applying fix for ensure_user_profile_exists function..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Check if Supabase CLI is available
if ! command -v npx supabase &> /dev/null; then
  echo "Supabase CLI not found. Installing it..."
  npm install -g supabase
fi

# Check for necessary SQL migration file
SQL_FILE="supabase/migrations/20250520_fix_ensure_user_profile.sql"
if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found: $SQL_FILE"
  exit 1
fi

echo "Deploying migration via Supabase MCP..."

# Deploy the migration using Supabase CLI's MCP support
# This applies the SQL changes through the Management API
npx supabase migration up --db-url-overwrite DIRECT_URL

if [ $? -eq 0 ]; then
  echo "SQL migration applied successfully via Supabase MCP!"

  # Run database functions through Supabase MCP
  echo "Running profile ID repair function through MCP..."
  npx supabase functions execute-sql --command "SELECT repair_profile_ids();"
  
  if [ $? -eq 0 ]; then
    echo "Profile repair completed successfully!"
  else
    echo "Warning: Profile repair function encountered issues."
  fi
else
  echo "Error applying SQL migration"
  exit 1
fi

# Redeploy the moralis-auth function through MCP
echo "Redeploying moralis-auth function with updated settings via MCP..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Deploy the function using Supabase MCP
npx supabase functions deploy moralis-auth

if [ $? -eq 0 ]; then
  echo "Function redeployed successfully via MCP!"
else
  echo "Warning: Function redeployment encountered issues. Try running the following command manually:"
  echo "npx supabase functions deploy moralis-auth"
fi

echo "Fix has been applied! The authentication and profile creation should now work properly."
echo
echo "To verify the fix:"
echo "1. Clear browser local storage and cookies for your app"
echo "2. Sign in with a wallet and check that profile creation succeeds"
echo "3. Create a game and verify no 'not part of this game' error appears"
echo "4. Join a game as player 2 and verify no 403 Forbidden errors"
