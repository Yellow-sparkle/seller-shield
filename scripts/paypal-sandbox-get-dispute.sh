#!/bin/bash
# Read-only: gets a PayPal sandbox token from CLIENT_ID and SECRET and prints one dispute.
# Usage: bash scripts/paypal-sandbox-get-dispute.sh PP-R-JGU-10196814
BASE=https://api-m.sandbox.paypal.com
DISPUTE_ID="${1:?give the dispute ID}"

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

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/v1/customer/disputes/$DISPUTE_ID"
echo
