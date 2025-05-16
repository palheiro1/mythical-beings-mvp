#!/bin/bash
# Script to apply RLS updates to Supabase to fix the UUID/ETH address conversion issues
# This script will allow the RLS policies to work with both formats

echo "Applying RLS policy updates for ETH/UUID address format compatibility..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Supabase API details
PROJECT_ID="layijhifboyouicxsunq"
DB_HOST="db.${PROJECT_ID}.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"

# Ask for the database password (service role key)
echo "Please enter your Supabase database password (service role key):"
read -s DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
  echo "Error: Password cannot be empty"
  exit 1
fi

# Apply the migration directly using psql
SQL_FILE="supabase/migrations/20250516_update_rls_for_eth_uuid.sql"

if [ -f "$SQL_FILE" ]; then
  echo "Applying SQL migration directly to database..."
  
  # Use the PGPASSWORD environment variable to pass the password to psql
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"
  
  if [ $? -eq 0 ]; then
    echo "SQL migration applied successfully!"
  else
    echo "Error applying SQL migration"
    exit 1
  fi
else
  echo "Error: SQL file not found: $SQL_FILE"
  exit 1
fi

echo "RLS policy update completed. You should now be able to create games with either ETH or UUID format addresses."
