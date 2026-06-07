#!/bin/bash

# Test project update API
echo "Testing Project Update API..."
echo ""

# Get session first (this would come from NextAuth in browser)
# For testing, we'll use a direct API call

# Test 1: Update with mixed case fields
echo "Test 1: Update project with mixed fields"
curl -X PATCH http://localhost:3000/api/projects/1 \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "Updated Test Project",
    "dealStage": "FEASIBILITY",
    "project_type": "EPC",
    "sector": "energy"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "---"
echo ""

# Test 2: Update with camelCase
echo "Test 2: Update with camelCase"
curl -X PATCH http://localhost:3000/api/projects/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another Update",
    "dealStage": "STRUCTURING",
    "projectType": "PPP"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "---"
echo "Tests complete!"
