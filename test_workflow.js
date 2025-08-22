const fetch = require('node-fetch');

// Get auth token from environment or use a test token
const authToken = process.env.AUTH_TOKEN || 'your-auth-token-here';

async function testWorkflowStep() {
  try {
    const response = await fetch('http://localhost:5000/api/workflow/test-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        stepId: "e3c7f77d-910c-4e41-8668-e0fccf16fd45",
        valueId: "3a91ea85-ed02-41cf-a607-a8d9a21d6fdf"
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testWorkflowStep();
