#!/bin/bash
# Gets a PayPal sandbox token from CLIENT_ID and SECRET (already set in the shell)
# and sends a dispute-create request. Usage: bash scripts/paypal-sandbox-dispute.sh [body.json]
# Nothing secret is stored in this file, and nothing secret is printed.
BASE=https://api-m.sandbox.paypal.com
BODY="${1:-body.json}"

echo "CLIENT_ID length: ${#CLIENT_ID}  SECRET length: ${#SECRET}"

RESPONSE=$(curl -s -u "$CLIENT_ID:$SECRET" -d grant_type=client_credentials "$BASE/v1/oauth2/token")
TOKEN=$(printf '%s' "$RESPONSE" | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("access_token", ""))
except Exception:
    print("")')

if [ -z "$TOKEN" ]; then
  echo "No access token. PayPal said:"
  echo "$RESPONSE"
  exit 1
fi
echo "token length: ${#TOKEN}"

curl -s -X POST "$BASE/v1/customer/disputes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$BODY"
echo
