#!/bin/bash
# Script to apply RLS updates to Supabase to add profile creation and update policies
# This script will allow authenticated users to create and update their own profiles

echo "Applying RLS policies for user profile synchronization..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Supabase API details
PROJECT_ID="layijhifboyouicxsunq"
DB_HOST="db.${PROJECT_ID}.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"

# Get the database password from .env.local file
if [ -f ".env.local" ]; then
  DB_PASSWORD=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2)
else
  echo "Error: .env.local file not found!"
  exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "Error: Failed to extract service role key from .env.local"
  exit 1
fi

# Apply the migration directly using psql
SQL_FILE="supabase/migrations/20250519_auth_profile_sync.sql"

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

echo "RLS policy update completed. Users can now create and update their own profiles."
