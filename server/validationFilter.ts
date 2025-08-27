import { FieldValidation } from '@shared/schema';

/**
 * Filter field validations to only include verified or valid records
 * This ensures only quality data is passed between workflow steps
 */
export function filterVerifiedValidations(
  validations: FieldValidation[],
  options: {
    includeManual?: boolean; // Include manually edited values
    includeValid?: boolean; // Include AI-validated values
    includeVerified?: boolean; // Include user-verified values
    includeExtracted?: boolean; // Include freshly extracted values (for first run)
  } = {}
): FieldValidation[] {
  const {
    includeManual = true,
    includeValid = true,
    includeVerified = true,
    includeExtracted = false // By default, don't include unverified extracted values
  } = options;
  
  console.log('🔍 Filtering validations with options:', {
    includeManual,
    includeValid,
    includeVerified,
    includeExtracted,
    totalValidations: validations.length
  });
  
  const filtered = validations.filter(validation => {
    // Always exclude pending, invalid, and unverified statuses unless specifically included
    if (validation.validationStatus === 'pending' || 
        validation.validationStatus === 'invalid') {
      return false;
    }
    
    // Include verified values
    if (includeVerified && validation.validationStatus === 'verified') {
      return true;
    }
    
    // Include valid values (AI determined valid)
    if (includeValid && validation.validationStatus === 'valid') {
      return true;
    }
    
    // Include manually edited/verified values
    if (includeManual && (validation.validationStatus === 'manual' || validation.manuallyVerified)) {
      return true;
    }
    
    // Include extracted values only if explicitly requested (for initial runs)
    if (includeExtracted && validation.validationStatus === 'extracted') {
      // Only include extracted values with reasonable confidence
      return validation.confidenceScore >= 70;
    }
    
    // Include unverified only if it has been manually updated by user
    if (validation.validationStatus === 'unverified' && validation.manuallyUpdated) {
      return true;
    }
    
    return false;
  });
  
  console.log(`✅ Filtered ${validations.length} validations to ${filtered.length} verified/valid records`);
  
  // Log sample of what was filtered out for debugging
  const filteredOut = validations.filter(v => !filtered.includes(v));
  if (filteredOut.length > 0) {
    console.log(`  Filtered out ${filteredOut.length} records with statuses:`, 
      [...new Set(filteredOut.map(v => v.validationStatus))].join(', '));
  }
  
  return filtered;
}

/**
 * Group filtered validations by identifier ID for easier processing
 */
export function groupValidationsByIdentifier(
  validations: FieldValidation[]
): Map<string, FieldValidation[]> {
  const grouped = new Map<string, FieldValidation[]>();
  
  for (const validation of validations) {
    if (validation.identifierId) {
      const existing = grouped.get(validation.identifierId) || [];
      existing.push(validation);
      grouped.set(validation.identifierId, existing);
    }
  }
  
  console.log(`📊 Grouped ${validations.length} validations into ${grouped.size} identifier groups`);
  
  return grouped;
}

/**
 * Transform filtered validations into a format suitable for tool input
 */
export function transformValidationsForToolInput(
  validations: FieldValidation[],
  columnName: string
): Array<{ identifierId: string; [key: string]: any }> {
  const results: Array<{ identifierId: string; [key: string]: any }> = [];
  
  // Group by identifier first
  const grouped = groupValidationsByIdentifier(validations);
  
  for (const [identifierId, records] of grouped) {
    // Find the record for the specific column
    const columnRecord = records.find(r => {
      // Extract column name from fieldName (e.g., "StepName.ColumnName[0]" -> "ColumnName")
      const fieldParts = r.fieldName?.split('.') || [];
      if (fieldParts.length > 1) {
        const columnPart = fieldParts[fieldParts.length - 1].replace(/\[\d+\]$/, '');
        return columnPart === columnName;
      }
      return false;
    });
    
    if (columnRecord) {
      results.push({
        identifierId,
        [columnName]: columnRecord.extractedValue
      });
    }
  }
  
  console.log(`🔄 Transformed ${validations.length} validations to ${results.length} tool input records for column "${columnName}"`);
  
  return results;
}

/**
 * Check if we should include unverified data (for initial extraction runs)
 */
export function shouldIncludeUnverifiedData(
  sessionValidations: FieldValidation[],
  stepId: string
): boolean {
  // Check if this step has any verified data yet
  const stepValidations = sessionValidations.filter(v => v.stepId === stepId);
  const verifiedCount = stepValidations.filter(v => 
    v.validationStatus === 'verified' || 
    v.validationStatus === 'valid' ||
    v.validationStatus === 'manual'
  ).length;
  
  // If less than 10% of records are verified, include extracted values too
  const includeExtracted = verifiedCount < (stepValidations.length * 0.1);
  
  console.log(`📊 Step ${stepId}: ${verifiedCount}/${stepValidations.length} verified (${Math.round(verifiedCount * 100 / stepValidations.length)}%)`);
  console.log(`  ${includeExtracted ? '✅' : '❌'} Including extracted values for this step`);
  
  return includeExtracted;
}