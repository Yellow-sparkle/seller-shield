#!/bin/bash
# Gets a PayPal sandbox token from CLIENT_ID and SECRET (already set in the shell)
# and sends a dispute-create request. Usage: bash scripts/paypal-sandbox-dispute.sh [body.json]
# Nothing secret is stored in this file.
set -e
BASE=https://api-m.sandbox.paypal.com
BODY="${1:-body.json}"

TOKEN=$(curl -s -u "$CLIENT_ID:$SECRET" -d grant_type=client_credentials "$BASE/v1/oauth2/token" \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["access_token"])')
echo "token length: ${#TOKEN}"

curl -s -X POST "$BASE/v1/customer/disputes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$BODY"
echo
