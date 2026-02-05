/**
 * Database Schema - Drizzle ORM Type Definitions
 * 
 * Defines the complete database structure for the extrapl platform using Drizzle ORM.
 * Provides type-safe database operations with automatic TypeScript type inference.
 * 
 * Key Entities:
 * - organizations: Multi-tenant organization structure
 * - users: User accounts with role-based access control
 * - projects: Data extraction projects and configurations
 * - workflowSteps: Unified structure for both info pages and data tables
 * - stepValues: Individual fields/columns within workflow steps
 * - extractionSessions: Document processing sessions
 * - sessionDocuments: Uploaded documents with extracted content
 * - fieldValidations: AI extraction results and manual validations
 * - excelWizardryFunctions: Reusable Python functions for Excel extraction
 * 
 * Architecture:
 * - Multi-tenant with organization-level data isolation
 * - UUID primary keys for distributed system compatibility
 * - JSONB columns for flexible metadata storage
 * - Foreign key relationships with cascade deletes
 * - Zod schemas for runtime validation
 * 
 * Usage:
 * - Import table definitions for Drizzle queries
 * - Use insert/select types for API type safety
 * - Zod schemas for form validation and API requests
 */

import { pgTable, text, serial, integer, boolean, timestamp, uuid, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations for multi-tenancy
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", { enum: ["primary", "standard"] }).notNull().default("standard"),
  subdomain: text("subdomain").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users with authentication
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Primary organization (kept for backwards compatibility)
  role: text("role").default("user").notNull(), // 'admin', 'user'
  isActive: boolean("is_active").default(true).notNull(),
  isTemporaryPassword: boolean("is_temporary_password").default(false).notNull(),
  projectOrder: jsonb("project_order"), // Array of project IDs for custom ordering
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table for multi-organization membership
export const userOrganizations = pgTable("user_organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").default("user").notNull(), // 'admin', 'user' - role within this specific organization
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserOrg: uniqueIndex("user_org_unique_idx").on(table.userId, table.organizationId),
}));

// Type for step action configuration
export type StepActionConfig = {
  actionName: string;
  actionStatus: string;
  actionLink?: string; // Optional URL with field placeholders like {{fieldName}}
};

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  mainObjectName: text("main_object_name").default("Session"),
  mainObjectDescription: text("main_object_description"),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  isInitialSetupComplete: boolean("is_initial_setup_complete").default(false).notNull(),
  inboxEmailAddress: text("inbox_email_address"), // AgentMail inbox for receiving emails
  inboxId: text("inbox_id"), // AgentMail inbox ID for API calls
  requiredDocumentTypes: jsonb("required_document_types").$type<Array<{id: string; name: string; description: string}>>(), // Document types required for session creation
  emailNotificationTemplate: text("email_notification_template"), // HTML template for email notifications with placeholders like {{subject}}, {{body}}, {{projectName}}
  defaultWorkflowStatus: text("default_workflow_status").default("New"), // Default status for new sessions
  workflowStatusOptions: jsonb("workflow_status_options").$type<string[]>().default(["New", "In Progress", "Complete"]), // Available workflow statuses
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// DEPRECATED: Project publishing to organizations - no longer used for tenant isolation
// Table kept for backwards compatibility, will be removed in future migration
export const projectPublishing = pgTable("project_publishing", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New unified structure for both schema fields and collections as "steps"
export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(),
  stepType: text("step_type", { enum: ["page", "list", "kanban"] }).notNull(), // page = single values (schema), list = multiple records (collection), kanban = task board
  description: text("description"),
  orderIndex: integer("order_index").default(0),
  valueCount: integer("value_count").default(0), // Number of values in this step
  identifierId: uuid("identifier_id"), // UUID of the identifier value (first value for list steps)
  kanbanConfig: jsonb("kanban_config"), // Configuration for kanban steps (statusColumns, aiInstructions, knowledgeDocumentIds, actions)
  actionConfig: jsonb("action_config").$type<StepActionConfig>(), // Action button config (actionName, actionStatus, actionLink)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Values within each step (replaces both schema fields and collection properties)
export const stepValues = pgTable("step_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  stepId: uuid("step_id").notNull().references(() => workflowSteps.id, { onDelete: "cascade" }),
  valueName: text("value_name").notNull(),
  dataType: text("data_type").notNull(), // TEXT, NUMBER, DATE, CHOICE
  description: text("description"),
  isIdentifier: boolean("is_identifier").default(false).notNull(), // True for the first value in list steps
  orderIndex: integer("order_index").default(0),
  // Tool/function configuration
  toolId: uuid("tool_id").references(() => excelWizardryFunctions.id, { onDelete: "cascade" }),
  inputValues: jsonb("input_values"), // Stores the input mappings including @references
  // Multi-field support for Info Page values
  fields: jsonb("fields"), // Array of field definitions for Info Pages: [{name, dataType, description}]
  // Visual styling
  color: text("color"), // Optional color for column left edge indicator in session view
  // Legacy fields for backward compatibility
  autoVerificationConfidence: integer("auto_verification_confidence").default(80),
  choiceOptions: jsonb("choice_options"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Keep old tables for backward compatibility during migration
export const projectSchemaFields = pgTable("project_schema_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").notNull(),
  description: text("description"),
  autoVerificationConfidence: integer("auto_verification_confidence").default(80),
  choiceOptions: jsonb("choice_options"),
  orderIndex: integer("order_index").default(0),
  extractionType: text("extraction_type", { enum: ["AI_ONLY", "FUNCTION"] }).default("AI_ONLY").notNull(),
  knowledgeDocumentIds: jsonb("knowledge_document_ids"),
  extractionRuleIds: jsonb("extraction_rule_ids"),
  documentsRequired: boolean("documents_required").default(true).notNull(),
  functionId: uuid("function_id").references(() => excelWizardryFunctions.id),
  functionParameters: jsonb("function_parameters"),
  requiredDocumentType: text("required_document_type", { enum: ["Excel", "Word", "PDF"] }),
  referencedMainFieldIds: jsonb("referenced_main_field_ids"),
  referencedCollectionIds: jsonb("referenced_collection_ids"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const objectCollections = pgTable("object_collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  collectionName: text("collection_name").notNull(),
  description: text("description"),
  identifierFieldId: uuid("identifier_field_id"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionProperties = pgTable("collection_properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  collectionId: uuid("collection_id").notNull().references(() => objectCollections.id, { onDelete: "cascade" }),
  propertyName: text("property_name").notNull(),
  propertyType: text("property_type").notNull(),
  description: text("description"),
  autoVerificationConfidence: integer("auto_verification_confidence").default(80),
  choiceOptions: jsonb("choice_options"),
  isIdentifier: boolean("is_identifier").default(false).notNull(),
  orderIndex: integer("order_index").default(0),
  extractionType: text("extraction_type", { enum: ["AI_ONLY", "FUNCTION"] }).default("AI_ONLY").notNull(),
  knowledgeDocumentIds: jsonb("knowledge_document_ids"),
  extractionRuleIds: jsonb("extraction_rule_ids"),
  documentsRequired: boolean("documents_required").default(true).notNull(),
  functionId: uuid("function_id").references(() => excelWizardryFunctions.id),
  requiredDocumentType: text("required_document_type", { enum: ["Excel", "Word", "PDF"] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractionSessions = pgTable("extraction_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sessionName: text("session_name").notNull(),
  description: text("description"),
  documentCount: integer("document_count").notNull().default(0),
  status: text("status").default("in_progress").notNull(), // in_progress, completed, verified, error
  workflowStatus: text("workflow_status"), // Current position in workflow status chain (e.g., "New", "In Progress", "Complete")
  extractedData: text("extracted_data"), // Store AI extraction results as JSON string
  extractionPrompt: text("extraction_prompt"), // Store the complete AI prompt used for extraction
  aiResponse: text("ai_response"), // Store the raw AI response before parsing
  inputTokenCount: integer("input_tokens"), // Number of input tokens used
  outputTokenCount: integer("output_tokens"), // Number of output tokens generated
  isViewed: boolean("is_viewed").default(false).notNull(), // Track if session has been opened
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Session documents table to store documents and their extracted content
export const sessionDocuments = pgTable("session_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  extractedContent: text("extracted_content"), // Text content extracted from the document
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
});

// New table for field-level validation tracking
export const fieldValidations = pgTable("field_validations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }),
  // New unified fields for steps/values architecture
  stepId: uuid("step_id").references(() => workflowSteps.id),
  valueId: uuid("value_id").references(() => stepValues.id),
  identifierId: text("identifier_id"), // The identifier value used to link records across steps
  // Legacy fields for backward compatibility
  validationType: text("validation_type").notNull(), // 'schema_field' or 'collection_property'
  dataType: text("data_type").notNull(), // 'TEXT', 'DATE', 'CHOICE', 'NUMBER', etc. - the actual field data type
  fieldId: uuid("field_id").notNull(), // references projectSchemaFields.id or collectionProperties.id
  collectionId: uuid("collection_id"), // references objectCollections.id for collection properties only
  collectionName: text("collection_name"), // for collection properties only (deprecated - use collectionId instead)
  recordIndex: integer("record_index").default(0), // for collection properties, which record instance
  // Common validation data
  extractedValue: text("extracted_value"),
  originalExtractedValue: text("original_extracted_value"), // stores original AI extracted value for reverting
  originalConfidenceScore: integer("original_confidence_score").default(0), // original AI confidence score
  originalAiReasoning: text("original_ai_reasoning"), // original AI reasoning for reverting
  validationStatus: text("validation_status", { enum: ["valid", "pending", "manual", "verified"] }).default("pending").notNull(),
  aiReasoning: text("ai_reasoning"), // AI explanation for validation status
  manuallyVerified: boolean("manually_verified").default(false).notNull(),
  manuallyUpdated: boolean("manually_updated").default(false).notNull(), // true when user edits a field value
  confidenceScore: integer("confidence_score").default(0), // 0-100
  documentSource: text("document_source"), // name of the document where data was found
  documentSections: text("document_sections"), // sections where data was found (JSON array)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint for step-based validations (new architecture)
  stepValidationUnique: uniqueIndex('step_validation_unique').on(
    table.sessionId, 
    table.stepId, 
    table.valueId, 
    table.identifierId
  ).where(sql`step_id IS NOT NULL AND value_id IS NOT NULL AND identifier_id IS NOT NULL`),
  
  // Unique constraint for legacy collection validations  
  legacyValidationUnique: uniqueIndex('legacy_validation_unique').on(
    table.sessionId,
    table.fieldId, 
    table.collectionId,
    table.recordIndex
  ).where(sql`validation_type = 'collection_property' AND collection_id IS NOT NULL`),
  
  // Unique constraint for schema field validations
  schemaFieldValidationUnique: uniqueIndex('schema_field_validation_unique').on(
    table.sessionId,
    table.fieldId
  ).where(sql`validation_type = 'schema_field'`),
}));

// Kanban Cards for task management within sessions
export const kanbanCards = pgTable("kanban_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }),
  stepId: uuid("step_id").notNull().references(() => workflowSteps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // Configurable statuses from step configuration
  orderIndex: integer("order_index").default(0),
  assigneeIds: jsonb("assignee_ids"), // Array of user IDs assigned to this card
  fieldValues: jsonb("field_values"), // Stores values for step-defined fields: {valueId: extractedValue}
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  aiReasoning: text("ai_reasoning"), // AI explanation for why this task was generated
  documentSource: text("document_source"), // Source document reference
  // Linked session fields
  fromLinkedSession: boolean("from_linked_session").default(false).notNull(), // True if copied from a linked session
  linkedFromSessionId: uuid("linked_from_session_id").references(() => extractionSessions.id, { onDelete: "set null" }), // Original session this card was copied from
  linkedFromCardId: uuid("linked_from_card_id"), // Original card ID this was copied from
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Kanban Checklist Items within cards
export const kanbanChecklistItems = pgTable("kanban_checklist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id").notNull().references(() => kanbanCards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  orderIndex: integer("order_index").default(0),
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Kanban Comments/Chat for card discussions
export const kanbanComments = pgTable("kanban_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id").notNull().references(() => kanbanCards.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  // Linked session fields
  fromLinkedSession: boolean("from_linked_session").default(false).notNull(), // True if copied from a linked session
  linkedFromSessionId: uuid("linked_from_session_id").references(() => extractionSessions.id, { onDelete: "set null" }), // Original session this comment was copied from
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Kanban Attachments for cards and comments
export const kanbanAttachments = pgTable("kanban_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id").notNull().references(() => kanbanCards.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").references(() => kanbanComments.id, { onDelete: "cascade" }), // Optional - if attached to a specific comment
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Session Links for reusing content from previous similar sessions
export const sessionLinks = pgTable("session_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceSessionId: uuid("source_session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }), // The new session
  linkedSessionId: uuid("linked_session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }), // The previous session being linked
  similarityScore: integer("similarity_score").default(0), // AI-calculated similarity percentage
  gapAnalysis: text("gap_analysis"), // AI-generated description of differences
  newRequirements: jsonb("new_requirements"), // Array of new requirements not in the linked session
  excludedTasks: jsonb("excluded_tasks"), // Array of task IDs excluded as non-relevant
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Processed Emails - tracks which email messages have been processed to avoid duplicates
export const processedEmails = pgTable("processed_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(), // AgentMail message ID
  inboxId: text("inbox_id").notNull(), // AgentMail inbox ID
  sessionId: uuid("session_id").references(() => extractionSessions.id, { onDelete: "set null" }), // Created session
  subject: text("subject"),
  fromEmail: text("from_email"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  displayName: text("display_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, docx, txt, etc.
  fileSize: integer("file_size").notNull(),
  content: text("content"), // extracted text content for conflict detection
  description: text("description").notNull(),
  targetField: text("target_field"), // which field/property this document applies to (same as extraction rules)
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const extractionRules = pgTable("extraction_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  ruleName: text("rule_name").notNull(),
  targetField: text("target_field"), // which field/property this rule applies to
  ruleContent: text("rule_content").notNull(), // the actual rule logic/description
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chat messages for session AI assistant
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Excel wizardry functions for AI-generated dynamic extraction
export const excelWizardryFunctions = pgTable("excel_wizardry_functions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  functionCode: text("function_code"), // Python function code for CODE tools
  aiPrompt: text("ai_prompt"), // AI prompt for AI_ONLY tools
  toolType: text("tool_type", { enum: ["AI_ONLY", "CODE", "DATABASE_LOOKUP"] }).notNull().default("CODE"), // Type of tool
  dataSourceId: uuid("data_source_id").references(() => apiDataSources.id, { onDelete: "set null" }), // Data source for DATABASE_LOOKUP tools
  outputType: text("output_type", { enum: ["single", "multiple"] }).notNull().default("single"), // Whether function creates single value or multiple records
  operationType: text("operation_type", { enum: ["createSingle", "updateSingle", "createMultiple", "updateMultiple"] }).notNull().default("updateSingle"), // Combined operation and output type
  inputParameters: jsonb("input_parameters").notNull(), // Array of input parameter definitions { name, type, description }
  aiAssistanceRequired: boolean("ai_assistance_required").default(false).notNull(), // Whether AI assistance is needed
  aiAssistancePrompt: text("ai_assistance_prompt"), // AI assistance instructions
  llmModel: text("llm_model").default("gemini-2.0-flash"), // LLM model to use for AI tools
  metadata: jsonb("metadata").notNull(), // Function metadata for field_validations schema compatibility
  inputSchema: jsonb("input_schema").notNull(), // Expected input format/parameters
  outputSchema: jsonb("output_schema").notNull(), // Expected output format
  tags: text("tags").array(), // Searchable tags for matching (e.g., "date", "financial", "text_extraction")
  usageCount: integer("usage_count").default(0).notNull(), // Track how often this function is used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Extraction identifier references storage for sequential extraction workflow
export const extractionIdentifierReferences = pgTable("extraction_identifier_references", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull(),
  extractionNumber: integer("extraction_number").notNull(),
  recordIndex: integer("record_index").notNull(),
  fieldName: text("field_name").notNull(),
  extractedValue: text("extracted_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sample documents for Excel wizardry function testing
export const sampleDocuments = pgTable("sample_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  functionId: uuid("function_id").notNull().references(() => excelWizardryFunctions.id, { onDelete: "cascade" }),
  parameterName: text("parameter_name").notNull(), // Which input parameter this sample is for
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  filePath: text("file_path"), // Object storage path
  extractedContent: text("extracted_content"), // Text content extracted from the document (same as sessionDocuments)
  sampleText: text("sample_text"), // For text parameters
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Test documents for flow page testing
export const testDocuments = pgTable("test_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  filePath: text("file_path"), // Object storage path
  extractedContent: text("extracted_content"), // Text content extracted from the document
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// API Data Sources for Connect feature
export const apiDataSources = pgTable("api_data_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  endpointUrl: text("endpoint_url").notNull(),
  authType: text("auth_type", { enum: ["none", "bearer", "basic", "api_key"] }).notNull().default("bearer"),
  authToken: text("auth_token"), // Bearer token or API key
  authHeader: text("auth_header"), // Custom header name for API key auth
  headers: jsonb("headers"), // Additional headers as JSON object
  queryParams: jsonb("query_params"), // Query parameters as JSON object
  isActive: boolean("is_active").default(true).notNull(),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastFetchStatus: text("last_fetch_status"), // "success" | "error"
  lastFetchError: text("last_fetch_error"),
  cachedData: jsonb("cached_data"), // Cached response data
  columnMappings: jsonb("column_mappings"), // User-defined column name mappings {originalName: displayName}
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true, // Don't include password hash in normal insert, handle separately
});

export const insertUserOrganizationSchema = createInsertSchema(userOrganizations).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  organizationId: true, // Backend adds this automatically
  createdBy: true, // Backend adds this automatically
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  createdAt: true,
});

export const insertStepValueSchema = createInsertSchema(stepValues).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchemaFieldSchema = createInsertSchema(projectSchemaFields).omit({
  id: true,
  createdAt: true,
});

export const insertObjectCollectionSchema = createInsertSchema(objectCollections).omit({
  id: true,
  createdAt: true,
});

export const insertCollectionPropertySchema = createInsertSchema(collectionProperties).omit({
  id: true,
  createdAt: true,
});

export const insertExtractionSessionSchema = createInsertSchema(extractionSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionDocumentSchema = createInsertSchema(sessionDocuments).omit({
  id: true,
  extractedAt: true,
});

export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({
  id: true,
  uploadedAt: true,
});

export const insertExtractionRuleSchema = createInsertSchema(extractionRules).omit({
  id: true,
  createdAt: true,
});

export const insertFieldValidationSchema = createInsertSchema(fieldValidations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectPublishingSchema = createInsertSchema(projectPublishing).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertExcelWizardryFunctionSchema = createInsertSchema(excelWizardryFunctions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExtractionIdentifierReferenceSchema = createInsertSchema(extractionIdentifierReferences).omit({
  id: true,
  createdAt: true,
});

export const insertSampleDocumentSchema = createInsertSchema(sampleDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertTestDocumentSchema = createInsertSchema(testDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanCardSchema = createInsertSchema(kanbanCards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKanbanChecklistItemSchema = createInsertSchema(kanbanChecklistItems).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanCommentSchema = createInsertSchema(kanbanComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKanbanAttachmentSchema = createInsertSchema(kanbanAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertSessionLinkSchema = createInsertSchema(sessionLinks).omit({
  id: true,
  createdAt: true,
});

export const insertApiDataSourceSchema = createInsertSchema(apiDataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserOrganization = typeof userOrganizations.$inferSelect;
export type InsertUserOrganization = z.infer<typeof insertUserOrganizationSchema>;
export type Project = typeof projects.$inferSelect;
export type ProjectWithAuthor = Project & {
  creatorName?: string;
  creatorOrganizationName?: string;
};
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type StepValue = typeof stepValues.$inferSelect;
export type InsertStepValue = z.infer<typeof insertStepValueSchema>;
export type ProjectSchemaField = typeof projectSchemaFields.$inferSelect;
export type InsertProjectSchemaField = z.infer<typeof insertProjectSchemaFieldSchema>;
export type ObjectCollection = typeof objectCollections.$inferSelect;
export type InsertObjectCollection = z.infer<typeof insertObjectCollectionSchema>;
export type CollectionProperty = typeof collectionProperties.$inferSelect;
export type InsertCollectionProperty = z.infer<typeof insertCollectionPropertySchema>;
export type ExtractionSession = typeof extractionSessions.$inferSelect;
export type InsertExtractionSession = z.infer<typeof insertExtractionSessionSchema>;
export type SessionDocument = typeof sessionDocuments.$inferSelect;
export type InsertSessionDocument = z.infer<typeof insertSessionDocumentSchema>;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;
export type ExtractionRule = typeof extractionRules.$inferSelect;
export type InsertExtractionRule = z.infer<typeof insertExtractionRuleSchema>;
export type FieldValidation = typeof fieldValidations.$inferSelect;
export type FieldValidationWithName = FieldValidation & {
  fieldName: string; // Added by backend through JOIN operations
};
export type InsertFieldValidation = z.infer<typeof insertFieldValidationSchema>;
export type ProjectPublishing = typeof projectPublishing.$inferSelect;
export type InsertProjectPublishing = z.infer<typeof insertProjectPublishingSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ExcelWizardryFunction = typeof excelWizardryFunctions.$inferSelect;
export type InsertExcelWizardryFunction = z.infer<typeof insertExcelWizardryFunctionSchema>;
export type ExtractionIdentifierReference = typeof extractionIdentifierReferences.$inferSelect;
export type InsertExtractionIdentifierReference = z.infer<typeof insertExtractionIdentifierReferenceSchema>;
export type SampleDocument = typeof sampleDocuments.$inferSelect;
export type InsertSampleDocument = z.infer<typeof insertSampleDocumentSchema>;
export type TestDocument = typeof testDocuments.$inferSelect;
export type InsertTestDocument = z.infer<typeof insertTestDocumentSchema>;
export type KanbanCard = typeof kanbanCards.$inferSelect;
export type InsertKanbanCard = z.infer<typeof insertKanbanCardSchema>;
export type KanbanChecklistItem = typeof kanbanChecklistItems.$inferSelect;
export type InsertKanbanChecklistItem = z.infer<typeof insertKanbanChecklistItemSchema>;
export type KanbanComment = typeof kanbanComments.$inferSelect;
export type InsertKanbanComment = z.infer<typeof insertKanbanCommentSchema>;
export type KanbanAttachment = typeof kanbanAttachments.$inferSelect;
export type InsertKanbanAttachment = z.infer<typeof insertKanbanAttachmentSchema>;
export type SessionLink = typeof sessionLinks.$inferSelect;
export type InsertSessionLink = z.infer<typeof insertSessionLinkSchema>;
export type ApiDataSource = typeof apiDataSources.$inferSelect;
export type InsertApiDataSource = z.infer<typeof insertApiDataSourceSchema>;

// Validation status types
export type ValidationStatus = 'valid' | 'invalid' | 'pending' | 'manual' | 'verified' | 'unverified' | 'extracted';
export type UserRole = 'admin' | 'user';

// Authentication types
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  isTemporaryPassword?: boolean;
};

// Extended types with relations
export type OrganizationWithUsers = Organization & {
  users: User[];
};

export type UserWithOrganization = User & {
  organization: Organization;
};

export type ProjectWithDetails = Project & {
  // DEPRECATED: Use workflowSteps instead
  schemaFields?: ProjectSchemaField[];
  // DEPRECATED: Use workflowSteps instead
  collections?: (ObjectCollection & {
    properties: CollectionProperty[];
  })[];
  // Primary data structure - unified steps/values architecture
  workflowSteps: (WorkflowStep & {
    values: StepValue[];
  })[];
  sessions: ExtractionSession[];
  knowledgeDocuments: KnowledgeDocument[];
  extractionRules: ExtractionRule[];
};

export type ExtractionSessionWithValidation = ExtractionSession & {
  fieldValidations: FieldValidationWithName[];
};

// Login/Register validation schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerUserSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  tempPassword: z.string().min(6, "Temporary password must be at least 6 characters"),
});

// API schema for password changes (backend only)
export const changePasswordApiSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// Frontend schema with confirmation (includes validation)
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Enhanced extraction session with validation data (removed duplicate)

// Enhanced field types with validation
export type ValidatedField = {
  fieldId: number;
  fieldName: string;
  fieldType: string;
  extractedValue: string | null;
  validationStatus: ValidationStatus;
  aiReasoning: string | null;
  manuallyVerified: boolean;
  confidenceScore: number;
};

export type ValidatedCollectionRecord = {
  recordIndex: number;
  collectionName: string;
  properties: ValidatedField[];
};

// Rich Extraction Context Types for AI Function Inputs
export interface ReferenceDocument {
  id: string;
  type: 'user' | 'knowledge';
  name: string;
  mime?: string;
  contentTruncated: string; // Truncated content for AI processing
  source: string; // Description of document source
}

export interface ReferenceDataItem {
  [key: string]: any; // Flexible structure for extracted data
  recordId?: string; // Optional record identifier
}

export interface RichExtractionContext {
  'reference data': ReferenceDataItem[]; // All arrays as JSON objects within arrays as properties
  'reference documents': ReferenceDocument[]; // All reference documents and content (type user and knowledge) as array of objects
  'text': string[]; // Array of all text inputs
}

// Zod schemas for validation
export const referenceDocumentSchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'knowledge']),
  name: z.string(),
  mime: z.string().optional(),
  contentTruncated: z.string(),
  source: z.string(),
});

export const referenceDataItemSchema = z.record(z.any()).and(z.object({
  recordId: z.string().optional(),
}));

export const richExtractionContextSchema = z.object({
  'reference data': z.array(referenceDataItemSchema),
  'reference documents': z.array(referenceDocumentSchema),
  'text': z.array(z.string()),
});

// Types inferred from schemas
export type RichExtractionContextValidated = z.infer<typeof richExtractionContextSchema>;
export type ReferenceDocumentValidated = z.infer<typeof referenceDocumentSchema>;
export type ReferenceDataItemValidated = z.infer<typeof referenceDataItemSchema>;
