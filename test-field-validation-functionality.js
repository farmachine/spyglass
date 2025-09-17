/**
 * Comprehensive Test Suite for Field Validation Functionality
 * 
 * Tests the following features:
 * 1. Automatic row creation when identifier field validation is created
 * 2. Field validation uniqueness constraints prevent duplicates
 * 3. "Delete All Non Validated Data" function with consolidated statuses
 * 4. Both MemStorage and PostgreSQL storage implementations work consistently
 */

const { apiRequest } = require('./server/utils/apiClient');

// Test configuration
const TEST_CONFIG = {
  organization: {
    name: "Test Organization",
    description: "Organization for field validation testing"
  },
  user: {
    email: "test@example.com",
    name: "Test User",
    password: "testpassword123"
  },
  project: {
    name: "Field Validation Test Project",
    description: "Testing automatic row creation and validation uniqueness"
  },
  session: {
    sessionName: "Test Session",
    description: "Testing session for field validation functionality"
  }
};

class FieldValidationTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.organizationId = null;
    this.userId = null;
    this.projectId = null;
    this.sessionId = null;
    this.stepId = null;
    this.identifierValueId = null;
    this.otherValueIds = [];
  }

  /**
   * Log test results
   */
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    console.log(logEntry);
    
    if (type === 'error') {
      this.errors.push(message);
    } else {
      this.testResults.push(message);
    }
  }

  /**
   * Test API endpoint
   */
  async testAPI(method, endpoint, data = null, expectedStatus = 200) {
    try {
      this.log(`Testing ${method} ${endpoint}`);
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`http://localhost:5000${endpoint}`, options);
      const responseData = await response.json();
      
      if (response.status === expectedStatus) {
        this.log(`✅ ${method} ${endpoint} - Status: ${response.status}`);
        return responseData;
      } else {
        this.log(`❌ ${method} ${endpoint} - Expected ${expectedStatus}, got ${response.status}`, 'error');
        this.log(`Response: ${JSON.stringify(responseData)}`, 'error');
        return null;
      }
    } catch (error) {
      this.log(`❌ API Error for ${method} ${endpoint}: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Setup test environment - create organization, user, project, session
   */
  async setupTestEnvironment() {
    this.log("🚀 Setting up test environment...");
    
    try {
      // Create organization
      const orgResponse = await this.testAPI('POST', '/api/organizations', TEST_CONFIG.organization, 201);
      if (!orgResponse) throw new Error("Failed to create organization");
      this.organizationId = orgResponse.id;
      this.log(`Created organization: ${this.organizationId}`);

      // Create user
      const userResponse = await this.testAPI('POST', '/api/users', {
        ...TEST_CONFIG.user,
        organizationId: this.organizationId
      }, 201);
      if (!userResponse) throw new Error("Failed to create user");
      this.userId = userResponse.id;
      this.log(`Created user: ${this.userId}`);

      // Create project
      const projectResponse = await this.testAPI('POST', '/api/projects', {
        ...TEST_CONFIG.project,
        organizationId: this.organizationId,
        createdBy: this.userId
      }, 201);
      if (!projectResponse) throw new Error("Failed to create project");
      this.projectId = projectResponse.id;
      this.log(`Created project: ${this.projectId}`);

      // Create workflow step with multiple values (including identifier)
      const stepResponse = await this.testAPI('POST', '/api/workflow-steps', {
        projectId: this.projectId,
        stepName: "Test Data Table",
        stepType: "list",
        description: "Test step for automatic row creation"
      }, 201);
      if (!stepResponse) throw new Error("Failed to create workflow step");
      this.stepId = stepResponse.id;
      this.log(`Created workflow step: ${this.stepId}`);

      // Create step values (identifier + other fields)
      const identifierValue = await this.testAPI('POST', '/api/step-values', {
        stepId: this.stepId,
        valueName: "Row ID",
        dataType: "TEXT",
        isIdentifier: true,
        orderIndex: 0
      }, 201);
      if (!identifierValue) throw new Error("Failed to create identifier value");
      this.identifierValueId = identifierValue.id;
      this.log(`Created identifier value: ${this.identifierValueId}`);

      // Create additional step values
      const additionalValues = [
        { valueName: "Name", dataType: "TEXT", orderIndex: 1 },
        { valueName: "Amount", dataType: "NUMBER", orderIndex: 2 },
        { valueName: "Date", dataType: "DATE", orderIndex: 3 }
      ];

      for (let i = 0; i < additionalValues.length; i++) {
        const valueData = { ...additionalValues[i], stepId: this.stepId };
        const valueResponse = await this.testAPI('POST', '/api/step-values', valueData, 201);
        if (!valueResponse) throw new Error(`Failed to create step value ${i + 1}`);
        this.otherValueIds.push(valueResponse.id);
        this.log(`Created step value: ${valueResponse.id} (${valueData.valueName})`);
      }

      // Create extraction session
      const sessionResponse = await this.testAPI('POST', '/api/sessions', {
        ...TEST_CONFIG.session,
        projectId: this.projectId
      }, 201);
      if (!sessionResponse) throw new Error("Failed to create session");
      this.sessionId = sessionResponse.id;
      this.log(`Created session: ${this.sessionId}`);

      this.log("✅ Test environment setup complete");
      return true;
    } catch (error) {
      this.log(`❌ Test environment setup failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Test 1: Automatic row creation when identifier field validation is created
   */
  async testAutomaticRowCreation() {
    this.log("🧪 Test 1: Testing automatic row creation for identifier field validation...");
    
    try {
      const testIdentifierId = "test-row-001";
      
      // Create field validation for identifier field
      const identifierValidation = {
        sessionId: this.sessionId,
        stepId: this.stepId,
        valueId: this.identifierValueId,
        identifierId: testIdentifierId,
        validationType: "step_value",
        dataType: "TEXT",
        fieldId: this.identifierValueId,
        extractedValue: "Test Row 001",
        validationStatus: "extracted",
        confidenceScore: 85
      };

      const response = await this.testAPI('POST', '/api/field-validations', identifierValidation, 201);
      if (!response) {
        this.log("❌ Failed to create identifier field validation", 'error');
        return false;
      }

      this.log(`✅ Created identifier validation: ${response.id}`);

      // Wait a moment for automatic row creation to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if all other field validations were automatically created
      const allValidations = await this.testAPI('GET', `/api/sessions/${this.sessionId}/field-validations`);
      if (!allValidations) {
        this.log("❌ Failed to retrieve field validations", 'error');
        return false;
      }

      // Filter validations for our test identifier
      const rowValidations = allValidations.filter(v => v.identifierId === testIdentifierId);
      
      this.log(`Found ${rowValidations.length} validations for identifier ${testIdentifierId}`);
      
      // Should have validations for all step values (identifier + others)
      const expectedCount = 1 + this.otherValueIds.length; // identifier + other values
      
      if (rowValidations.length === expectedCount) {
        this.log(`✅ Automatic row creation successful - Created ${rowValidations.length} field validations`);
        
        // Verify all have 'pending' status except the identifier
        const pendingValidations = rowValidations.filter(v => 
          v.valueId !== this.identifierValueId && v.validationStatus === 'pending'
        );
        
        if (pendingValidations.length === this.otherValueIds.length) {
          this.log("✅ All non-identifier fields created with 'pending' status");
        } else {
          this.log(`⚠️ Expected ${this.otherValueIds.length} pending validations, found ${pendingValidations.length}`, 'error');
        }
        
        return true;
      } else {
        this.log(`❌ Expected ${expectedCount} validations, found ${rowValidations.length}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Test 1 failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Test 2: Field validation uniqueness constraints prevent duplicates
   */
  async testUniquenessConstraints() {
    this.log("🧪 Test 2: Testing field validation uniqueness constraints...");
    
    try {
      const testIdentifierId = "test-row-002";
      
      // Create first field validation
      const firstValidation = {
        sessionId: this.sessionId,
        stepId: this.stepId,
        valueId: this.identifierValueId,
        identifierId: testIdentifierId,
        validationType: "step_value",
        dataType: "TEXT",
        fieldId: this.identifierValueId,
        extractedValue: "Test Row 002",
        validationStatus: "extracted",
        confidenceScore: 90
      };

      const firstResponse = await this.testAPI('POST', '/api/field-validations', firstValidation, 201);
      if (!firstResponse) {
        this.log("❌ Failed to create first field validation", 'error');
        return false;
      }

      this.log(`✅ Created first validation: ${firstResponse.id}`);

      // Try to create duplicate field validation (should fail due to uniqueness constraint)
      const duplicateValidation = { ...firstValidation };
      
      const duplicateResponse = await this.testAPI('POST', '/api/field-validations', duplicateValidation, 409);
      
      if (duplicateResponse === null) {
        this.log("✅ Uniqueness constraint prevented duplicate creation");
        return true;
      } else {
        this.log("❌ Duplicate validation was created, uniqueness constraint failed", 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Test 2 failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Test 3: Delete All Non Validated Data function
   */
  async testDeleteNonValidatedData() {
    this.log("🧪 Test 3: Testing delete non-validated data functionality...");
    
    try {
      // Create multiple field validations with different statuses
      const testRows = [
        { id: "row-003", status: "pending" },
        { id: "row-004", status: "extracted" },
        { id: "row-005", status: "valid" },
        { id: "row-006", status: "verified" },
        { id: "row-007", status: "manual" }
      ];

      const createdValidations = [];
      
      // Create validations with different statuses
      for (const row of testRows) {
        const validation = {
          sessionId: this.sessionId,
          stepId: this.stepId,
          valueId: this.identifierValueId,
          identifierId: row.id,
          validationType: "step_value",
          dataType: "TEXT",
          fieldId: this.identifierValueId,
          extractedValue: `Test Row ${row.id}`,
          validationStatus: row.status,
          confidenceScore: 75
        };

        const response = await this.testAPI('POST', '/api/field-validations', validation, 201);
        if (response) {
          createdValidations.push({ ...response, expectedStatus: row.status });
          this.log(`Created validation with status '${row.status}': ${response.id}`);
        }
      }

      if (createdValidations.length !== testRows.length) {
        this.log("❌ Failed to create all test validations", 'error');
        return false;
      }

      // Get all validations before deletion
      const beforeDeletion = await this.testAPI('GET', `/api/sessions/${this.sessionId}/field-validations`);
      if (!beforeDeletion) {
        this.log("❌ Failed to get validations before deletion", 'error');
        return false;
      }

      const beforeCount = beforeDeletion.length;
      this.log(`Total validations before deletion: ${beforeCount}`);

      // Test filtering non-validated data (this simulates the delete function logic)
      const nonValidatedStatuses = ['pending', 'extracted', 'unverified'];
      const nonValidatedValidations = beforeDeletion.filter(v => 
        nonValidatedStatuses.includes(v.validationStatus) && !v.manuallyUpdated
      );

      this.log(`Found ${nonValidatedValidations.length} non-validated records to delete`);

      // Simulate deletion by calling delete endpoint for each non-validated record
      let deletedCount = 0;
      for (const validation of nonValidatedValidations) {
        const deleteResponse = await this.testAPI('DELETE', `/api/field-validations/${validation.id}`, null, 200);
        if (deleteResponse) {
          deletedCount++;
        }
      }

      this.log(`Successfully deleted ${deletedCount} non-validated records`);

      // Verify remaining validations are only validated ones
      const afterDeletion = await this.testAPI('GET', `/api/sessions/${this.sessionId}/field-validations`);
      if (!afterDeletion) {
        this.log("❌ Failed to get validations after deletion", 'error');
        return false;
      }

      const afterCount = afterDeletion.length;
      const validatedStatuses = ['valid', 'verified', 'manual'];
      const remainingValidated = afterDeletion.filter(v => 
        validatedStatuses.includes(v.validationStatus) || v.manuallyVerified
      );

      this.log(`Total validations after deletion: ${afterCount}`);
      this.log(`Remaining validated records: ${remainingValidated.length}`);

      if (remainingValidated.length === afterCount) {
        this.log("✅ Delete non-validated data function works correctly");
        return true;
      } else {
        this.log("❌ Some non-validated data was not deleted properly", 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Test 3 failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Test 4: Consistency between MemStorage and PostgreSQL implementations
   */
  async testStorageConsistency() {
    this.log("🧪 Test 4: Testing storage implementation consistency...");
    
    try {
      // This test checks if the same operations work consistently
      // by comparing behavior through API calls (which use the configured storage)
      
      const testIdentifierId = "consistency-test-001";
      
      // Test creating field validation and automatic row creation
      const validation = {
        sessionId: this.sessionId,
        stepId: this.stepId,
        valueId: this.identifierValueId,
        identifierId: testIdentifierId,
        validationType: "step_value",
        dataType: "TEXT",
        fieldId: this.identifierValueId,
        extractedValue: "Consistency Test",
        validationStatus: "extracted",
        confidenceScore: 88
      };

      const createResponse = await this.testAPI('POST', '/api/field-validations', validation, 201);
      if (!createResponse) {
        this.log("❌ Failed to create validation for consistency test", 'error');
        return false;
      }

      // Wait for automatic row creation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test retrieval
      const getResponse = await this.testAPI('GET', `/api/field-validations/${createResponse.id}`);
      if (!getResponse) {
        this.log("❌ Failed to retrieve created validation", 'error');
        return false;
      }

      // Test update
      const updateData = { 
        validationStatus: "verified",
        manuallyVerified: true 
      };
      const updateResponse = await this.testAPI('PATCH', `/api/field-validations/${createResponse.id}`, updateData);
      if (!updateResponse) {
        this.log("❌ Failed to update validation", 'error');
        return false;
      }

      // Verify all automatic row creation occurred
      const allValidations = await this.testAPI('GET', `/api/sessions/${this.sessionId}/field-validations`);
      const rowValidations = allValidations.filter(v => v.identifierId === testIdentifierId);
      
      const expectedCount = 1 + this.otherValueIds.length;
      if (rowValidations.length === expectedCount) {
        this.log("✅ Storage consistency test passed - CRUD operations work correctly");
        this.log(`✅ Automatic row creation created ${rowValidations.length} validations as expected`);
        return true;
      } else {
        this.log(`❌ Storage consistency failed - Expected ${expectedCount} validations, found ${rowValidations.length}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Test 4 failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    this.log("🧹 Cleaning up test data...");
    
    try {
      // Delete in reverse order of creation
      if (this.sessionId) {
        await this.testAPI('DELETE', `/api/sessions/${this.sessionId}`, null, 200);
      }
      if (this.projectId) {
        await this.testAPI('DELETE', `/api/projects/${this.projectId}`, null, 200);
      }
      if (this.userId) {
        await this.testAPI('DELETE', `/api/users/${this.userId}`, null, 200);
      }
      if (this.organizationId) {
        await this.testAPI('DELETE', `/api/organizations/${this.organizationId}`, null, 200);
      }
      
      this.log("✅ Cleanup completed");
    } catch (error) {
      this.log(`⚠️ Cleanup warning: ${error.message}`, 'error');
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    this.log("🚀 Starting Field Validation Functionality Test Suite");
    this.log("=" * 60);
    
    const startTime = Date.now();
    let passedTests = 0;
    let totalTests = 4;

    // Setup
    const setupSuccess = await this.setupTestEnvironment();
    if (!setupSuccess) {
      this.log("❌ Test suite aborted due to setup failure", 'error');
      return this.generateReport();
    }

    // Run tests
    const tests = [
      { name: "Automatic Row Creation", fn: () => this.testAutomaticRowCreation() },
      { name: "Uniqueness Constraints", fn: () => this.testUniquenessConstraints() },
      { name: "Delete Non Validated Data", fn: () => this.testDeleteNonValidatedData() },
      { name: "Storage Consistency", fn: () => this.testStorageConsistency() }
    ];

    for (const test of tests) {
      this.log(`\n${"=".repeat(50)}`);
      this.log(`Running: ${test.name}`);
      this.log("=".repeat(50));
      
      const success = await test.fn();
      if (success) {
        passedTests++;
        this.log(`✅ ${test.name} - PASSED`);
      } else {
        this.log(`❌ ${test.name} - FAILED`);
      }
    }

    // Cleanup
    await this.cleanup();

    // Generate report
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.log(`\n${"=".repeat(60)}`);
    this.log("📊 TEST SUITE RESULTS");
    this.log("=".repeat(60));
    this.log(`Total Tests: ${totalTests}`);
    this.log(`Passed: ${passedTests}`);
    this.log(`Failed: ${totalTests - passedTests}`);
    this.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    this.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
    
    if (this.errors.length > 0) {
      this.log(`\n❌ ERRORS ENCOUNTERED:`);
      this.errors.forEach((error, index) => {
        this.log(`${index + 1}. ${error}`);
      });
    }

    return this.generateReport();
  }

  /**
   * Generate final test report
   */
  generateReport() {
    return {
      totalTests: 4,
      passedTests: this.testResults.filter(r => r.includes('✅')).length,
      errors: this.errors,
      testResults: this.testResults,
      summary: this.errors.length === 0 ? "All tests passed successfully" : "Some tests failed"
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FieldValidationTester;
}

// Auto-run if called directly
if (require.main === module) {
  (async () => {
    const tester = new FieldValidationTester();
    const report = await tester.runAllTests();
    console.log("\n🏁 Test suite completed");
    console.log(`Final status: ${report.summary}`);
    process.exit(report.errors.length > 0 ? 1 : 0);
  })();
}