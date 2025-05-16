#!/bin/bash
# Script to redeploy the create-game function with proper environment variables

echo "Deploying create-game Edge Function to Supabase..."

# Navigate to the project directory
cd "$(dirname "$0")"

# Deploy the function
cd supabase
supabase functions deploy create-game --no-verify-jwt

# Check the deployment status
if [ $? -eq 0 ]; then
  echo "Function deployed successfully!"
  echo "You can test it by creating a game from the Lobby."
else
  echo "Function deployment failed. Check the error messages above."
fi
