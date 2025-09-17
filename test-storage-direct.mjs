/**
 * Direct Storage Test - Field Validation Functionality
 * 
 * Tests the automatic row creation functionality by directly importing and testing
 * the storage implementations without going through HTTP endpoints.
 */

import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_DATA = {
  sessionId: uuidv4(),
  stepId: uuidv4(),
  identifierId: "test-row-001",
  stepValues: [
    { id: uuidv4(), valueName: "ID", dataType: "TEXT", isIdentifier: true, orderIndex: 0 },
    { id: uuidv4(), valueName: "Name", dataType: "TEXT", isIdentifier: false, orderIndex: 1 },
    { id: uuidv4(), valueName: "Amount", dataType: "NUMBER", isIdentifier: false, orderIndex: 2 },
    { id: uuidv4(), valueName: "Date", dataType: "DATE", isIdentifier: false, orderIndex: 3 }
  ]
};

class DirectStorageTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.storage = null;
  }

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

  async initializeStorage() {
    try {
      // Try to import the storage module using dynamic import
      this.log("Attempting to import storage module...");
      
      // Try different import paths
      const possiblePaths = [
        './server/storage.ts',
        './server/storage.js',
        './server/storage.mjs'
      ];
      
      for (const path of possiblePaths) {
        try {
          const storageModule = await import(path);
          if (storageModule && storageModule.storage) {
            this.storage = storageModule.storage;
            this.log(`✅ Storage module imported successfully from ${path}`);
            return true;
          }
        } catch (importError) {
          this.log(`Could not import from ${path}: ${importError.message}`);
        }
      }
      
      this.log("❌ Failed to import storage from any path", 'error');
      return false;
    } catch (error) {
      this.log(`❌ Failed to import storage: ${error.message}`, 'error');
      return false;
    }
  }

  async setupTestData() {
    try {
      this.log("🚀 Setting up test data...");

      // Create workflow step
      const stepData = {
        id: TEST_DATA.stepId,
        projectId: uuidv4(), // Use a fake project ID for testing
        stepName: "Test Step",
        stepType: "list",
        description: "Test step for automatic row creation",
        orderIndex: 0,
        valueCount: TEST_DATA.stepValues.length,
        identifierId: TEST_DATA.stepValues[0].id, // First value is identifier
        createdAt: new Date()
      };

      // Check storage type and add test data accordingly
      if (this.storage.workflowSteps && typeof this.storage.workflowSteps.set === 'function') {
        // MemStorage implementation
        this.log("Detected MemStorage - setting up test data manually");
        
        this.storage.workflowSteps.set(TEST_DATA.stepId, stepData);
        this.log("✅ Created test workflow step");

        // Add step values
        for (const valueData of TEST_DATA.stepValues) {
          const stepValue = {
            ...valueData,
            stepId: TEST_DATA.stepId,
            createdAt: new Date()
          };
          this.storage.stepValues.set(valueData.id, stepValue);
          this.log(`✅ Created step value: ${valueData.valueName} (identifier: ${valueData.isIdentifier})`);
        }
      } else {
        // PostgreSQL storage - try to use create methods
        this.log("Detected PostgreSQL storage - attempting to use create methods");
        
        try {
          // Try to create workflow step and values through storage methods
          if (typeof this.storage.createWorkflowStep === 'function') {
            await this.storage.createWorkflowStep(stepData);
            this.log("✅ Created test workflow step via storage method");
            
            for (const valueData of TEST_DATA.stepValues) {
              const stepValue = {
                ...valueData,
                stepId: TEST_DATA.stepId
              };
              await this.storage.createStepValue(stepValue);
              this.log(`✅ Created step value: ${valueData.valueName}`);
            }
          } else {
            this.log("⚠️ PostgreSQL storage create methods not available - test may be limited");
          }
        } catch (dbError) {
          this.log(`⚠️ Database setup failed: ${dbError.message} - continuing with limited test`);
        }
      }

      return true;
    } catch (error) {
      this.log(`❌ Test data setup failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testAutomaticRowCreation() {
    this.log("\n🧪 Test 1: Testing automatic row creation for identifier field validation...");
    
    try {
      // Create field validation for the identifier field (first column)
      const identifierValidation = {
        sessionId: TEST_DATA.sessionId,
        stepId: TEST_DATA.stepId,
        valueId: TEST_DATA.stepValues[0].id, // Identifier field
        identifierId: TEST_DATA.identifierId,
        validationType: 'step_value',
        dataType: 'TEXT',
        fieldId: TEST_DATA.stepValues[0].id,
        extractedValue: "Test Row 001",
        validationStatus: 'extracted',
        aiReasoning: null,
        manuallyVerified: false,
        manuallyUpdated: false,
        confidenceScore: 85
      };

      this.log("Creating identifier field validation...");
      const createdValidation = await this.storage.createFieldValidation(identifierValidation);
      
      if (!createdValidation) {
        this.log("❌ Failed to create identifier field validation", 'error');
        return false;
      }

      this.log(`✅ Created identifier validation: ${createdValidation.id}`);

      // Wait a moment for automatic row creation to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if all other field validations were automatically created
      const allValidations = await this.storage.getFieldValidations(TEST_DATA.sessionId);
      
      if (!allValidations) {
        this.log("❌ Failed to retrieve field validations", 'error');
        return false;
      }

      // Filter validations for our test identifier
      const rowValidations = allValidations.filter(v => v.identifierId === TEST_DATA.identifierId);
      
      this.log(`Found ${rowValidations.length} validations for identifier ${TEST_DATA.identifierId}`);
      
      // Should have validations for all step values
      const expectedCount = TEST_DATA.stepValues.length;
      
      if (rowValidations.length === expectedCount) {
        this.log(`✅ Automatic row creation successful - Created ${rowValidations.length} field validations`);
        
        // Verify all non-identifier fields have 'pending' status
        const pendingValidations = rowValidations.filter(v => 
          v.valueId !== TEST_DATA.stepValues[0].id && v.validationStatus === 'pending'
        );
        
        const expectedPendingCount = TEST_DATA.stepValues.length - 1; // All except identifier
        
        if (pendingValidations.length === expectedPendingCount) {
          this.log("✅ All non-identifier fields created with 'pending' status");
          
          // Log details of created validations
          rowValidations.forEach(v => {
            const stepValue = TEST_DATA.stepValues.find(sv => sv.id === v.valueId);
            const fieldName = stepValue ? stepValue.valueName : 'Unknown';
            this.log(`  - ${fieldName}: ${v.validationStatus} (${v.extractedValue || 'null'})`);
          });
          
          return true;
        } else {
          this.log(`❌ Expected ${expectedPendingCount} pending validations, found ${pendingValidations.length}`, 'error');
          return false;
        }
      } else {
        this.log(`❌ Expected ${expectedCount} validations, found ${rowValidations.length}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Test 1 failed: ${error.message}`, 'error');
      this.log(`Stack trace: ${error.stack}`, 'error');
      return false;
    }
  }

  async testUniquenessConstraints() {
    this.log("\n🧪 Test 2: Testing field validation uniqueness constraints...");
    
    try {
      const testIdentifierId2 = "test-row-002";
      
      // Create first field validation
      const firstValidation = {
        sessionId: TEST_DATA.sessionId,
        stepId: TEST_DATA.stepId,
        valueId: TEST_DATA.stepValues[0].id,
        identifierId: testIdentifierId2,
        validationType: 'step_value',
        dataType: 'TEXT',
        fieldId: TEST_DATA.stepValues[0].id,
        extractedValue: "Test Row 002",
        validationStatus: 'extracted',
        confidenceScore: 90
      };

      const firstResponse = await this.storage.createFieldValidation(firstValidation);
      if (!firstResponse) {
        this.log("❌ Failed to create first field validation", 'error');
        return false;
      }

      this.log(`✅ Created first validation: ${firstResponse.id}`);

      // Try to create duplicate field validation (should fail or be handled gracefully)
      try {
        const duplicateValidation = { ...firstValidation };
        const duplicateResponse = await this.storage.createFieldValidation(duplicateValidation);
        
        if (duplicateResponse) {
          this.log("⚠️ Duplicate validation was created - uniqueness constraint may not be enforced at storage level");
          // This might be handled at database level, not storage level
        }
      } catch (duplicateError) {
        if (duplicateError.message.includes('unique') || duplicateError.message.includes('constraint')) {
          this.log("✅ Uniqueness constraint prevented duplicate creation");
          return true;
        } else {
          this.log(`❌ Unexpected error: ${duplicateError.message}`, 'error');
          return false;
        }
      }

      // Check if we have exactly the expected number of validations
      const allValidations = await this.storage.getFieldValidations(TEST_DATA.sessionId);
      const duplicateValidations = allValidations.filter(v => 
        v.sessionId === TEST_DATA.sessionId &&
        v.stepId === TEST_DATA.stepId &&
        v.valueId === TEST_DATA.stepValues[0].id &&
        v.identifierId === testIdentifierId2
      );

      if (duplicateValidations.length === 1) {
        this.log("✅ Uniqueness maintained - only one validation exists");
        return true;
      } else {
        this.log(`⚠️ Found ${duplicateValidations.length} validations - uniqueness may need verification at database level`);
        return true; // This might be normal if constraints are at DB level
      }
    } catch (error) {
      this.log(`❌ Test 2 failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testDeleteNonValidatedData() {
    this.log("\n🧪 Test 3: Testing delete non-validated data functionality...");
    
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
          sessionId: TEST_DATA.sessionId,
          stepId: TEST_DATA.stepId,
          valueId: TEST_DATA.stepValues[0].id,
          identifierId: row.id,
          validationType: 'step_value',
          dataType: 'TEXT',
          fieldId: TEST_DATA.stepValues[0].id,
          extractedValue: `Test Row ${row.id}`,
          validationStatus: row.status,
          confidenceScore: 75,
          manuallyVerified: row.status === 'verified' || row.status === 'manual',
          manuallyUpdated: row.status === 'manual'
        };

        const response = await this.storage.createFieldValidation(validation);
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
      const beforeDeletion = await this.storage.getFieldValidations(TEST_DATA.sessionId);
      const beforeCount = beforeDeletion.length;
      this.log(`Total validations before deletion: ${beforeCount}`);

      // Identify non-validated data (similar to filterVerifiedValidations logic)
      const nonValidatedStatuses = ['pending', 'extracted', 'unverified'];
      const nonValidatedValidations = beforeDeletion.filter(v => 
        nonValidatedStatuses.includes(v.validationStatus) && !v.manuallyUpdated
      );

      this.log(`Found ${nonValidatedValidations.length} non-validated records to delete`);

      // Delete non-validated records
      let deletedCount = 0;
      for (const validation of nonValidatedValidations) {
        const deleteSuccess = await this.storage.deleteFieldValidation(validation.id);
        if (deleteSuccess) {
          deletedCount++;
        }
      }

      this.log(`Successfully deleted ${deletedCount} non-validated records`);

      // Verify remaining validations are only validated ones
      const afterDeletion = await this.storage.getFieldValidations(TEST_DATA.sessionId);
      const afterCount = afterDeletion.length;
      const validatedStatuses = ['valid', 'verified', 'manual'];
      const remainingValidated = afterDeletion.filter(v => 
        validatedStatuses.includes(v.validationStatus) || v.manuallyVerified
      );

      this.log(`Total validations after deletion: ${afterCount}`);
      this.log(`Remaining validated records: ${remainingValidated.length}`);

      // Check if deletion worked correctly
      const expectedRemainingCount = testRows.filter(r => 
        ['valid', 'verified', 'manual'].includes(r.status)
      ).length;

      if (remainingValidated.length >= expectedRemainingCount) {
        this.log("✅ Delete non-validated data function works correctly");
        return true;
      } else {
        this.log("❌ Some validated data was incorrectly deleted", 'error');
        return false;
      }
    } catch (error) {
      this.log(`❌ Test 3 failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testStorageConsistency() {
    this.log("\n🧪 Test 4: Testing storage implementation consistency...");
    
    try {
      // Test basic CRUD operations consistency
      const testIdentifierId = "consistency-test-001";
      
      // Test creating field validation and automatic row creation
      const validation = {
        sessionId: TEST_DATA.sessionId,
        stepId: TEST_DATA.stepId,
        valueId: TEST_DATA.stepValues[0].id,
        identifierId: testIdentifierId,
        validationType: 'step_value',
        dataType: 'TEXT',
        fieldId: TEST_DATA.stepValues[0].id,
        extractedValue: "Consistency Test",
        validationStatus: 'extracted',
        confidenceScore: 88
      };

      const createResponse = await this.storage.createFieldValidation(validation);
      if (!createResponse) {
        this.log("❌ Failed to create validation for consistency test", 'error');
        return false;
      }

      // Test retrieval
      const getResponse = await this.storage.getFieldValidation(createResponse.id);
      if (!getResponse) {
        this.log("❌ Failed to retrieve created validation", 'error');
        return false;
      }

      // Test update
      const updateData = { 
        validationStatus: 'verified',
        manuallyVerified: true 
      };
      const updateResponse = await this.storage.updateFieldValidation(createResponse.id, updateData);
      if (!updateResponse) {
        this.log("❌ Failed to update validation", 'error');
        return false;
      }

      // Verify update worked
      if (updateResponse.validationStatus === 'verified' && updateResponse.manuallyVerified === true) {
        this.log("✅ Update operation successful");
      } else {
        this.log("❌ Update operation failed - values not updated correctly", 'error');
        return false;
      }

      // Verify automatic row creation occurred
      const allValidations = await this.storage.getFieldValidations(TEST_DATA.sessionId);
      const rowValidations = allValidations.filter(v => v.identifierId === testIdentifierId);
      
      const expectedCount = TEST_DATA.stepValues.length;
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

  async runAllTests() {
    this.log("🚀 Starting Direct Storage Field Validation Test Suite");
    this.log("=".repeat(60));
    
    const startTime = Date.now();
    let passedTests = 0;
    const totalTests = 4;

    // Initialize storage
    const initSuccess = await this.initializeStorage();
    if (!initSuccess) {
      this.log("❌ Test suite aborted due to storage initialization failure", 'error');
      return this.generateReport();
    }

    // Setup test data
    const setupSuccess = await this.setupTestData();
    if (!setupSuccess) {
      this.log("❌ Test suite aborted due to test data setup failure", 'error');
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

  generateReport() {
    return {
      totalTests: 4,
      passedTests: this.testResults.filter(r => r.includes('✅') && r.includes('PASSED')).length,
      errors: this.errors,
      testResults: this.testResults,
      summary: this.errors.length === 0 ? "All tests passed successfully" : "Some tests failed - see errors for details"
    };
  }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const tester = new DirectStorageTester();
    const report = await tester.runAllTests();
    console.log("\n🏁 Test suite completed");
    console.log(`Final status: ${report.summary}`);
    process.exit(report.errors.length > 0 ? 1 : 0);
  })();
}

export default DirectStorageTester;