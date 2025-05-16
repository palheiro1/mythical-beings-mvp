#!/bin/bash
# Script to apply RLS updates to Supabase to fix the UUID/ETH address conversion issues
# This script will allow the RLS policies to work with both formats

echo "Applying RLS policy updates for ETH/UUID address format compatibility..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Apply migration using the Supabase CLI
echo "Applying migration via Supabase CLI..."

# Make directory for migrations if not exists
mkdir -p supabase/migrations

# Navigate to the project directory
cd supabase

# Apply migration with Supabase CLI
echo "Running migration to update RLS policies..."
supabase migration up

echo "RLS policy update completed. You should now be able to create games with either ETH or UUID format addresses."
