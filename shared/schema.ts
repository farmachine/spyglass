import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  mainObjectName: text("main_object_name").default("Session"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectSchemaFields = pgTable("project_schema_fields", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").notNull(), // TEXT, NUMBER, DATE, BOOLEAN
  description: text("description"),
  orderIndex: integer("order_index").default(0),
});

export const objectCollections = pgTable("object_collections", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  collectionName: text("collection_name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionProperties = pgTable("collection_properties", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => objectCollections.id, { onDelete: "cascade" }),
  propertyName: text("property_name").notNull(),
  propertyType: text("property_type").notNull(), // TEXT, NUMBER, DATE, BOOLEAN
  description: text("description"),
  orderIndex: integer("order_index").default(0),
});

export const extractionSessions = pgTable("extraction_sessions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sessionName: text("session_name").notNull(),
  description: text("description"),
  documentCount: integer("document_count").notNull().default(0),
  status: text("status").default("in_progress").notNull(), // in_progress, completed, verified, error
  extractedData: text("extracted_data"), // Store AI extraction results as JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// New table for field-level validation tracking
export const fieldValidations = pgTable("field_validations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => extractionSessions.id, { onDelete: "cascade" }),
  fieldType: text("field_type").notNull(), // 'schema_field' or 'collection_property'
  fieldId: integer("field_id").notNull(), // references projectSchemaFields.id or collectionProperties.id
  collectionName: text("collection_name"), // for collection properties only
  recordIndex: integer("record_index").default(0), // for collection properties, which record instance
  extractedValue: text("extracted_value"),
  validationStatus: text("validation_status").default("pending").notNull(), // 'valid', 'invalid', 'pending', 'manual'
  aiReasoning: text("ai_reasoning"), // AI explanation for validation status
  manuallyVerified: boolean("manually_verified").default(false).notNull(),
  confidenceScore: integer("confidence_score").default(0), // 0-100
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  displayName: text("display_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, docx, txt, etc.
  fileSize: integer("file_size").notNull(),
  description: text("description").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const extractionRules = pgTable("extraction_rules", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  ruleName: text("rule_name").notNull(),
  targetField: text("target_field"), // which field/property this rule applies to
  ruleContent: text("rule_content").notNull(), // the actual rule logic/description
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchemaFieldSchema = createInsertSchema(projectSchemaFields).omit({
  id: true,
});

export const insertObjectCollectionSchema = createInsertSchema(objectCollections).omit({
  id: true,
  createdAt: true,
});

export const insertCollectionPropertySchema = createInsertSchema(collectionProperties).omit({
  id: true,
});

export const insertExtractionSessionSchema = createInsertSchema(extractionSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  extractedData: true,
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

// Types
export type Project = typeof projects.$inferSelect;
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
export type InsertFieldValidation = z.infer<typeof insertFieldValidationSchema>;

// Validation status types
export type ValidationStatus = 'valid' | 'invalid' | 'pending' | 'manual';

// Extended types with relations
export type ProjectWithDetails = Project & {
  schemaFields: ProjectSchemaField[];
  collections: (ObjectCollection & {
    properties: CollectionProperty[];
  })[];
  sessions: ExtractionSession[];
  knowledgeDocuments: KnowledgeDocument[];
  extractionRules: ExtractionRule[];
};

// Enhanced extraction session with validation data
export type ExtractionSessionWithValidation = ExtractionSession & {
  fieldValidations: FieldValidation[];
};

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
