#!/bin/bash
# Script to redeploy the Supabase Edge Function with updated JWT handling

echo "Redeploying Moralis Auth Edge Function..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Make sure Supabase CLI is installed 
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Deploy the updated function
cd supabase
echo "Deploying Edge Function with UUID support for JWT..."
supabase functions deploy moralis-auth

echo "Deployment complete. The Edge Function now properly formats JWT subject as UUID."
