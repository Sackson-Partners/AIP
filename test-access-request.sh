#!/bin/bash

# Test the access request API
echo "Testing Access Request API..."
echo ""

# Test 1: Submit valid request
echo "Test 1: Valid request"
curl -X POST http://localhost:3000/api/auth/request-access \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fullName": "Test User",
    "roleRequested": "PARTNER",
    "organization": "Test Company",
    "country": "Kenya",
    "message": "Testing the platform"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "---"
echo ""

# Test 2: Missing required field
echo "Test 2: Missing email (should fail)"
curl -X POST http://localhost:3000/api/auth/request-access \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "roleRequested": "PARTNER"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "---"
echo ""

# Test 3: Invalid role
echo "Test 3: Invalid role (should fail)"
curl -X POST http://localhost:3000/api/auth/request-access \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "fullName": "Test User 2",
    "roleRequested": "INVALID_ROLE"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "---"
echo "Tests complete!"
