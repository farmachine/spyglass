#!/bin/bash

# Test the workflow endpoint with proper document content
curl -X POST http://localhost:5000/api/projects/915d87a3-dd55-401e-8f8b-df38132c2215/test-workflow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "documentId": "886a3797-03d6-4cf6-a6da-8a71459bdf39",
    "documentContent": "=== Sheet: New_Pensioners ===\nOld Members Reference No\tMembers Reference No\tEmployer Code",
    "valueConfig": {
      "stepId": "e3c7f77d-910c-4e41-8668-e0fccf16fd45",
      "stepName": "Column Name Mapping",
      "stepType": "list",
      "valueId": "3a91ea85-ed02-41cf-a607-a8d9a21d6fdf",
      "valueName": "Column Names",
      "toolId": "72204391-0d72-4493-889e-67807d6c96a8",
      "inputValues": {
        "0.my684050njo": ["user_document"]
      }
    },
    "previousResults": {}
  }'
