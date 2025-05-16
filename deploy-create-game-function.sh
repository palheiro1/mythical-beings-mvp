#!/bin/bash
# Script to deploy the create-game Edge Function 

echo "Deploying create-game Edge Function..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Make sure Supabase CLI is installed 
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Deploy the function
cd supabase
echo "Deploying create-game Edge Function..."
supabase functions deploy create-game

echo "Deployment complete. The create-game Edge Function is now available."
