#!/bin/bash
echo "=== Checking server logs for reference document loading ==="
echo ""
echo "Looking for reference document fetching..."
grep -n "FETCHING REFERENCE" server/routes.ts
echo ""
echo "Looking for document logging..."
grep -n "Found.*knowledge documents" server/routes.ts
echo ""
echo "Checking if condition is correct..."
grep -B2 -A2 "key === 'Reference Document'" server/routes.ts | head -10
