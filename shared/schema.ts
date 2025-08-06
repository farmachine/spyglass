import { pgTable, text, serial, integer, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations for multi-tenancy
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", { enum: ["primary", "standard"] }).notNull().default("standard"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users with authentication
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").default("user").notNull(), // 'admin', 'user'
  isActive: boolean("is_active").default(true).notNull(),
  isTemporaryPassword: boolean("is_temporary_password").default(false).notNull(),
  projectOrder: jsonb("project_order"), // Array of project IDs for custom ordering
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project publishing to organizations
export const projectPublishing = pgTable("project_publishing", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectSchemaFields = pgTable("project_schema_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").notNull(), // TEXT, NUMBER, DATE, CHOICE
  description: text("description"),
  autoVerificationConfidence: integer("auto_verification_confidence").default(80), // 0-100 threshold for auto verification
  choiceOptions: jsonb("choice_options"), // Array of choice options for CHOICE type fields
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const objectCollections = pgTable("object_collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  collectionName: text("collection_name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionProperties = pgTable("collection_properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  collectionId: uuid("collection_id").notNull().references(() => objectCollections.id, { onDelete: "cascade" }),
  propertyName: text("property_name").notNull(),
  propertyType: text("property_type").notNull(), // TEXT, NUMBER, DATE, CHOICE
  description: text("description"),
  autoVerificationConfidence: integer("auto_verification_confidence").default(80), // 0-100 threshold for auto verification
  choiceOptions: jsonb("choice_options"), // Array of choice options for CHOICE type fields
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractionSessions = pgTable("extraction_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sessionName: text("session_name").notNull(),
  description: text("description"),
  documentCount: integer("document_count").notNull().default(0),
  status: text("status").default("in_progress").notNull(), // in_progress, completed, verified, error
  extractedData: text("extracted_data"), // Store AI extraction results as JSON string
  extractionPrompt: text("extraction_prompt"), // Store the complete AI prompt used for extraction
  aiResponse: text("ai_response"), // Store the raw AI response before parsing
  inputTokenCount: integer("input_tokens"), // Number of input tokens used
  outputTokenCount: integer("output_tokens"), // Number of output tokens generated
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// New table for field-level validation tracking
export const fieldValidations = pgTable("field_validations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }),
  validationType: text("validation_type").notNull(), // 'schema_field' or 'collection_property'
  dataType: text("data_type").notNull(), // 'TEXT', 'DATE', 'CHOICE', 'NUMBER', etc. - the actual field data type
  fieldId: uuid("field_id").notNull(), // references projectSchemaFields.id or collectionProperties.id
  collectionName: text("collection_name"), // for collection properties only
  recordIndex: integer("record_index").default(0), // for collection properties, which record instance
  extractedValue: text("extracted_value"),
  originalExtractedValue: text("original_extracted_value"), // stores original AI extracted value for reverting
  originalConfidenceScore: integer("original_confidence_score").default(0), // original AI confidence score
  originalAiReasoning: text("original_ai_reasoning"), // original AI reasoning for reverting
  validationStatus: text("validation_status").default("pending").notNull(), // 'valid', 'invalid', 'pending', 'manual'
  aiReasoning: text("ai_reasoning"), // AI explanation for validation status
  manuallyVerified: boolean("manually_verified").default(false).notNull(),
  manuallyUpdated: boolean("manually_updated").default(false).notNull(), // true when user edits a field value
  confidenceScore: integer("confidence_score").default(0), // 0-100
  documentSource: text("document_source"), // name of the document where data was found
  documentSections: text("document_sections"), // sections where data was found (JSON array)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  organizationId: true, // Backend adds this automatically
  createdBy: true, // Backend adds this automatically
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

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type ProjectWithAuthor = Project & {
  creatorName?: string;
  creatorOrganizationName?: string;
};
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectSchemaField = typeof projectSchemaFields.$inferSelect;
export type InsertProjectSchemaField = z.infer<typeof insertProjectSchemaFieldSchema>;
export type ObjectCollection = typeof objectCollections.$inferSelect;
export type InsertObjectCollection = z.infer<typeof insertObjectCollectionSchema>;
export type CollectionProperty = typeof collectionProperties.$inferSelect;
export type InsertCollectionProperty = z.infer<typeof insertCollectionPropertySchema>;
export type ExtractionSession = typeof extractionSessions.$inferSelect;
export type InsertExtractionSession = z.infer<typeof insertExtractionSessionSchema>;
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

// Validation status types
export type ValidationStatus = 'valid' | 'invalid' | 'pending' | 'manual';
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
  schemaFields: ProjectSchemaField[];
  collections: (ObjectCollection & {
    properties: CollectionProperty[];
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
