/**
 * Date utilities for handling European date formats (dd/mm/yyyy)
 * Fixes issue where AI-extracted European dates are misinterpreted as US format
 */

export interface ParsedDate {
  day: number;
  month: number;
  year: number;
  isValid: boolean;
  originalFormat: 'european' | 'us' | 'iso' | 'unknown';
}

/**
 * Parses a date string and determines if it's in European format (dd/mm/yyyy)
 */
export function parseEuropeanDate(dateString: string): ParsedDate {
  if (!dateString || typeof dateString !== 'string') {
    return { day: 0, month: 0, year: 0, isValid: false, originalFormat: 'unknown' };
  }

  const trimmed = dateString.trim();
  
  // Handle ISO format (yyyy-mm-dd)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return {
      day: parseInt(day, 10),
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      isValid: true,
      originalFormat: 'iso'
    };
  }

  // Handle dd/mm/yyyy or mm/dd/yyyy format
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    const yearNum = parseInt(year, 10);

    // Determine if it's European format by checking if first number > 12
    // If first number > 12, it must be day (European format)
    // If both numbers <= 12, we assume European format based on context
    if (firstNum > 12) {
      // Definitely European format (dd/mm/yyyy)
      return {
        day: firstNum,
        month: secondNum,
        year: yearNum,
        isValid: firstNum <= 31 && secondNum <= 12 && yearNum > 1900,
        originalFormat: 'european'
      };
    } else if (secondNum > 12) {
      // Definitely US format (mm/dd/yyyy) 
      return {
        day: secondNum,
        month: firstNum,
        year: yearNum,
        isValid: firstNum <= 12 && secondNum <= 31 && yearNum > 1900,
        originalFormat: 'us'
      };
    } else {
      // Ambiguous case - both numbers <= 12
      // Default to European format since that's what the AI is extracting
      return {
        day: firstNum,
        month: secondNum,
        year: yearNum,
        isValid: firstNum <= 31 && secondNum <= 12 && yearNum > 1900,
        originalFormat: 'european'
      };
    }
  }

  return { day: 0, month: 0, year: 0, isValid: false, originalFormat: 'unknown' };
}

/**
 * Formats a parsed date for display in European format (dd/mm/yyyy)
 */
export function formatEuropeanDate(parsed: ParsedDate): string {
  if (!parsed.isValid) return '';
  
  const day = parsed.day.toString().padStart(2, '0');
  const month = parsed.month.toString().padStart(2, '0');
  
  return `${day}/${month}/${parsed.year}`;
}

/**
 * Converts a date to ISO format (yyyy-mm-dd) for HTML date inputs
 */
export function toISODateString(parsed: ParsedDate): string {
  if (!parsed.isValid) return '';
  
  const day = parsed.day.toString().padStart(2, '0');
  const month = parsed.month.toString().padStart(2, '0');
  
  return `${parsed.year}-${month}-${day}`;
}

/**
 * Converts from ISO format back to European format
 */
export function fromISODateString(isoString: string): string {
  const parsed = parseEuropeanDate(isoString);
  return formatEuropeanDate(parsed);
}

/**
 * Main function to format date values for display
 * Handles European dates correctly and shows them in readable format
 */
export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  const parsed = parseEuropeanDate(dateString);
  
  if (!parsed.isValid) return dateString; // Return original if unparseable
  
  // Format as readable date: "6 April 1988"
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthName = monthNames[parsed.month - 1];
  return `${parsed.day} ${monthName} ${parsed.year}`;
}

/**
 * Prepares date value for HTML date input
 * Converts European format to ISO format that browsers understand
 */
export function prepareDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  const parsed = parseEuropeanDate(dateString);
  return toISODateString(parsed);
}

/**
 * Converts date from HTML date input back to European format for storage
 */
export function convertDateFromInput(isoString: string): string {
  if (!isoString) return '';
  
  return fromISODateString(isoString);
}