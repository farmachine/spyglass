/**
 * Database Storage Layer and Business Logic
 * 
 * Provides abstracted database operations and business logic for the extrapl application.
 * Implements CRUD operations for all entities with proper type safety via Drizzle ORM.
 * 
 * Key Responsibilities:
 * - Project and organization management
 * - Document storage and session handling
 * - Validation and extraction result management
 * - User authentication and authorization
 * - Excel function management and execution
 * 
 * Architecture:
 * - Uses Drizzle ORM with PostgreSQL for all database operations
 * - Exports singleton `storage` instance for application-wide use
 * - Implements proper error handling and transaction management
 * - Supports multi-tenant data isolation by organization
 * 
 * Usage:
 * - Import `storage` and call methods directly
 * - All methods return properly typed results
 * - Handles both sync and async operations appropriately
 */

import { 
  projects, 
  projectSchemaFields, 
  objectCollections, 
  collectionProperties,
  workflowSteps,
  stepValues,
  extractionSessions,
  sessionDocuments,
  knowledgeDocuments,
  extractionRules,
  fieldValidations,
  organizations,
  users,
  userOrganizations,
  chatMessages,
  excelWizardryFunctions,
  extractionIdentifierReferences,
  sampleDocuments,
  type Project, 
  type InsertProject,
  type ProjectSchemaField,
  type InsertProjectSchemaField,
  type ObjectCollection,
  type InsertObjectCollection,
  type CollectionProperty,
  type InsertCollectionProperty,
  type WorkflowStep,
  type InsertWorkflowStep,
  type StepValue,
  type InsertStepValue,
  type ExtractionSession,
  type InsertExtractionSession,
  type SessionDocument,
  type InsertSessionDocument,
  type KnowledgeDocument,
  type InsertKnowledgeDocument,
  type ExtractionRule,
  type InsertExtractionRule,
  type FieldValidation,
  type InsertFieldValidation,
  type ExtractionSessionWithValidation,
  type ProjectWithDetails,
  type Organization,
  type InsertOrganization,
  type User,
  type InsertUser,
  type OrganizationWithUsers,
  type UserWithOrganization,
  type ChatMessage,
  type InsertChatMessage,
  type ExcelWizardryFunction,
  type InsertExcelWizardryFunction,
  type ExtractionIdentifierReference,
  type InsertExtractionIdentifierReference,
  type SampleDocument,
  type InsertSampleDocument,
  testDocuments,
  type TestDocument,
  type InsertTestDocument,
  kanbanCards,
  kanbanChecklistItems,
  kanbanComments,
  kanbanAttachments,
  sessionLinks,
  type KanbanCard,
  type InsertKanbanCard,
  type KanbanChecklistItem,
  type InsertKanbanChecklistItem,
  type KanbanComment,
  type InsertKanbanComment,
  type KanbanAttachment,
  type InsertKanbanAttachment,
  type SessionLink,
  type InsertSessionLink,
  apiDataSources,
  type ApiDataSource,
  type InsertApiDataSource,
  processedEmails,
  workflowStatusHistory,
  type WorkflowStatusHistory,
  type InsertWorkflowStatusHistory,
  passwordResetTokens,
} from "@shared/schema";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, count, sql, and, or, inArray, isNull, isNotNull, desc, like } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Excel grid normalization guard - ensures consistent column structure before database save
function normalizeExcelContent(content: string): string {
  if (!content || !content.includes('=== Sheet:')) {
    return content; // Not Excel content, return as-is
  }
  
  try {
    const sections = content.split('=== Sheet:');
    const normalizedSections = sections.map((section, index) => {
      if (index === 0) return section; // First section is before any sheet marker
      
      const lines = section.split('\n');
      if (lines.length < 2) return section; // No actual data lines
      
      // Find the sheet name line
      const sheetNameLine = lines[0];
      const dataLines = lines.slice(1); // Include all lines, even empty ones
      
      if (dataLines.length === 0) return section;
      
      // Split all lines into cells and find maximum column count
      const cellRows = dataLines.map(line => line.split('\t'));
      const maxColumns = Math.max(...cellRows.map(row => row.length));
      
      // Normalize each row: replace empty cells with 'blank' and pad to maxColumns
      const normalizedLines = cellRows.map(cells => {
        // Fill missing cells up to maxColumns
        const paddedCells = [...cells];
        while (paddedCells.length < maxColumns) {
          paddedCells.push('');
        }
        
        // Replace empty/whitespace-only cells with 'blank'
        const normalizedCells = paddedCells.map(cell => 
          (cell.trim() === '') ? 'blank' : cell
        );
        
        return normalizedCells.join('\t');
      });
      
      return sheetNameLine + '\n' + normalizedLines.join('\n');
    });
    
    return normalizedSections.join('=== Sheet:');
  } catch (error) {
    console.warn('Excel normalization failed, returning original content:', error);
    return content;
  }
}

export interface IStorage {
  // Organizations
  getOrganizations(): Promise<(Organization & { userCount: number })[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySubdomain(subdomain: string): Promise<Organization | undefined>;
  getPrimaryOrganization(): Promise<Organization | undefined>;
  getOrganizationWithUsers(id: string): Promise<OrganizationWithUsers | undefined>;
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;

  // Users
  getUsers(organizationId: string): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserWithOrganization(id: string): Promise<UserWithOrganization | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  resetUserPassword(userId: string, tempPassword: string): Promise<{ tempPassword: string }>;
  updateUserPassword(userId: string, newPasswordHash: string, isTemporary: boolean): Promise<User | undefined>;
  updateUserProjectOrder(userId: string, projectOrder: string[]): Promise<User | undefined>;
  
  // Multi-organization membership
  getOrganizationMembers(organizationId: string): Promise<(User & { orgRole: string })[]>;
  addUserToOrganization(userId: string, organizationId: string, role?: string): Promise<boolean>;
  removeUserFromOrganization(userId: string, organizationId: string): Promise<boolean>;
  getUserOrganizations(userId: string): Promise<{ organizationId: string; organizationName: string; role: string }[]>;

  // Projects (organization-filtered / tenant-isolated)
  getProjects(organizationId?: string, userRole?: string): Promise<Project[]>;
  getProject(id: string, organizationId?: string): Promise<Project | undefined>;
  getProjectByInboxId(inboxId: string): Promise<Project | undefined>;
  getProjectWithDetails(id: string, organizationId?: string): Promise<ProjectWithDetails | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, organizationId?: string): Promise<Project | undefined>;
  deleteProject(id: string, organizationId?: string): Promise<boolean>;
  duplicateProject(id: string, newName: string, userId: string, organizationId?: string): Promise<Project | undefined>;

  // Project Schema Fields
  getProjectSchemaFields(projectId: string): Promise<ProjectSchemaField[]>;
  getProjectSchemaFieldById(id: string): Promise<ProjectSchemaField | undefined>;
  createProjectSchemaField(field: InsertProjectSchemaField): Promise<ProjectSchemaField>;
  updateProjectSchemaField(id: string, field: Partial<InsertProjectSchemaField>): Promise<ProjectSchemaField | undefined>;
  deleteProjectSchemaField(id: string): Promise<boolean>;

  // Object Collections
  getObjectCollections(projectId: string): Promise<(ObjectCollection & { properties: CollectionProperty[] })[]>;
  getAllCollectionsForReferences(organizationId: string): Promise<(ObjectCollection & { properties: CollectionProperty[], projectName: string })[]>;
  getObjectCollection(id: string): Promise<ObjectCollection | undefined>;
  createObjectCollection(collection: InsertObjectCollection): Promise<ObjectCollection>;
  updateObjectCollection(id: string, collection: Partial<InsertObjectCollection>): Promise<ObjectCollection | undefined>;
  deleteObjectCollection(id: string): Promise<boolean>;

  // Collection Properties
  getCollectionProperties(collectionId: string): Promise<CollectionProperty[]>;
  getCollectionPropertyById(id: string): Promise<CollectionProperty | undefined>;
  createCollectionProperty(property: InsertCollectionProperty): Promise<CollectionProperty>;
  updateCollectionProperty(id: string, property: Partial<InsertCollectionProperty>): Promise<CollectionProperty | undefined>;
  deleteCollectionProperty(id: string): Promise<boolean>;
  setCollectionIdentifierField(collectionId: string, propertyId: string): Promise<boolean>;
  getCollectionIdentifierField(collectionId: string): Promise<CollectionProperty | undefined>;

  // Overview Sessions
  getExtractionSessions(projectId: string): Promise<ExtractionSession[]>;
  getExtractionSession(id: string): Promise<ExtractionSession | undefined>;
  createExtractionSession(session: InsertExtractionSession): Promise<ExtractionSession>;
  updateExtractionSession(id: string, session: Partial<InsertExtractionSession>): Promise<ExtractionSession | undefined>;

  // Workflow Status History
  createWorkflowStatusHistory(entry: InsertWorkflowStatusHistory): Promise<WorkflowStatusHistory>;
  getWorkflowStatusHistory(projectId: string): Promise<WorkflowStatusHistory[]>;

  // Session Documents
  getSessionDocuments(sessionId: string): Promise<SessionDocument[]>;
  createSessionDocument(document: InsertSessionDocument): Promise<SessionDocument>;
  updateSessionDocument(id: string, document: Partial<InsertSessionDocument>): Promise<SessionDocument | undefined>;
  deleteSessionDocument(id: string): Promise<boolean>;

  // Step value operations for reference resolution
  getStepValueById(valueId: string): Promise<{ valueName: string; stepId: string } | undefined>;

  // Knowledge Documents
  getKnowledgeDocuments(projectId: string): Promise<KnowledgeDocument[]>;
  getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined>;
  createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: string, document: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: string): Promise<boolean>;

  // Extraction Rules
  getExtractionRules(projectId: string): Promise<ExtractionRule[]>;
  createExtractionRule(rule: InsertExtractionRule): Promise<ExtractionRule>;
  updateExtractionRule(id: string, rule: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined>;
  deleteExtractionRule(id: string): Promise<boolean>;

  // Field Validations
  getFieldValidations(sessionId: string): Promise<FieldValidation[]>;
  getSessionValidations(sessionId: string): Promise<FieldValidation[]>;
  getFieldValidation(id: string): Promise<FieldValidation | undefined>;
  createFieldValidation(validation: InsertFieldValidation): Promise<FieldValidation>;
  updateFieldValidation(id: string, validation: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined>;
  deleteFieldValidation(id: string): Promise<boolean>;
  getSessionWithValidations(sessionId: string): Promise<ExtractionSessionWithValidation | undefined>;
  getValidationsByCollectionAndIndex(sessionId: string, collectionId: string, recordIndex: number): Promise<FieldValidation[]>;
  getValidationsByFieldAndCollection(sessionId: string, fieldId: string, collectionId: string, recordIndex: number): Promise<FieldValidation[]>;
  getValidationsByStep(stepId: string, sessionId?: string): Promise<FieldValidation[]>;
  populateMissingCollectionIds(): Promise<void>;
  getCollectionByName(collectionName: string): Promise<(ObjectCollection & { properties: CollectionProperty[] }) | undefined>;
  initializeAllValidationRecords(sessionId: string, stepId: string, identifierIds: string[]): Promise<void>;

  // Chat Messages
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Excel Wizardry Functions
  getExcelWizardryFunctions(): Promise<ExcelWizardryFunction[]>;
  getExcelWizardryFunctionsByProject(projectId: string): Promise<ExcelWizardryFunction[]>;
  getExcelWizardryFunction(id: string): Promise<ExcelWizardryFunction | undefined>;
  createExcelWizardryFunction(func: InsertExcelWizardryFunction): Promise<ExcelWizardryFunction>;
  updateExcelWizardryFunction(id: string, func: Partial<InsertExcelWizardryFunction>): Promise<ExcelWizardryFunction | undefined>;
  updateExcelWizardryFunctionCode(id: string, functionCode: string): Promise<ExcelWizardryFunction | undefined>;
  incrementFunctionUsage(id: string): Promise<ExcelWizardryFunction | undefined>;
  searchExcelWizardryFunctions(tags: string[]): Promise<ExcelWizardryFunction[]>;
  deleteExcelWizardryFunction(id: string): Promise<boolean>;

  // Extraction Identifier References
  getExtractionIdentifierReferences(sessionId: string, extractionNumber?: number): Promise<ExtractionIdentifierReference[]>;
  createExtractionIdentifierReferences(references: InsertExtractionIdentifierReference[]): Promise<ExtractionIdentifierReference[]>;
  deleteExtractionIdentifierReferences(sessionId: string, extractionNumber: number): Promise<boolean>;
  getMergedIdentifierReferences(sessionId: string, upToExtractionNumber: number): Promise<Record<string, any>[]>;

  // Sample Documents
  getSampleDocuments(functionId: string): Promise<SampleDocument[]>;
  createSampleDocument(document: InsertSampleDocument): Promise<SampleDocument>;
  updateSampleDocument(id: string, document: Partial<InsertSampleDocument>): Promise<SampleDocument | undefined>;
  deleteSampleDocument(id: string): Promise<boolean>;
  deleteSampleDocumentsByParameter(functionId: string, parameterName: string): Promise<boolean>;

  // Test Documents
  getTestDocuments(projectId: string): Promise<TestDocument[]>;
  createTestDocument(document: InsertTestDocument): Promise<TestDocument>;
  deleteTestDocument(id: string): Promise<boolean>;

  // Workflow Steps
  getWorkflowSteps(projectId: string): Promise<WorkflowStep[]>;
  getWorkflowStep(id: string): Promise<WorkflowStep | undefined>;
  createWorkflowStep(step: InsertWorkflowStep): Promise<WorkflowStep>;
  updateWorkflowStep(id: string, step: Partial<InsertWorkflowStep>): Promise<WorkflowStep | undefined>;
  deleteWorkflowStep(id: string): Promise<boolean>;
  saveProjectWorkflow(projectId: string, workflow: any): Promise<void>;

  // Step Values
  getStepValues(stepId: string): Promise<StepValue[]>;
  getStepValue(id: string): Promise<StepValue | undefined>;
  createStepValue(value: InsertStepValue): Promise<StepValue>;
  updateStepValue(id: string, value: Partial<InsertStepValue>): Promise<StepValue | undefined>;
  deleteStepValue(id: string): Promise<boolean>;

  // Kanban Cards
  getKanbanCards(sessionId: string, stepId: string): Promise<KanbanCard[]>;
  getKanbanCard(id: string): Promise<KanbanCard | undefined>;
  createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard>;
  updateKanbanCard(id: string, card: Partial<InsertKanbanCard>): Promise<KanbanCard | undefined>;
  deleteKanbanCard(id: string): Promise<boolean>;
  reorderKanbanCards(cards: { id: string; orderIndex: number; status?: string }[]): Promise<boolean>;

  // Kanban Checklist Items
  getKanbanChecklistItems(cardId: string): Promise<KanbanChecklistItem[]>;
  createKanbanChecklistItem(item: InsertKanbanChecklistItem): Promise<KanbanChecklistItem>;
  updateKanbanChecklistItem(id: string, item: Partial<InsertKanbanChecklistItem>): Promise<KanbanChecklistItem | undefined>;
  deleteKanbanChecklistItem(id: string): Promise<boolean>;

  // Kanban Comments
  getKanbanComments(cardId: string): Promise<KanbanComment[]>;
  createKanbanComment(comment: InsertKanbanComment): Promise<KanbanComment>;
  updateKanbanComment(id: string, comment: Partial<InsertKanbanComment>): Promise<KanbanComment | undefined>;
  deleteKanbanComment(id: string): Promise<boolean>;

  // Kanban Attachments
  getKanbanAttachments(cardId: string): Promise<KanbanAttachment[]>;
  createKanbanAttachment(attachment: InsertKanbanAttachment): Promise<KanbanAttachment>;
  deleteKanbanAttachment(id: string): Promise<boolean>;

  // Session Links
  getSessionLinks(sessionId: string): Promise<SessionLink[]>;
  createSessionLink(link: InsertSessionLink): Promise<SessionLink>;
  getSessionsByProject(projectId: string): Promise<ExtractionSession[]>;
  
  // Processed Emails
  isEmailProcessed(projectId: string, messageId: string): Promise<boolean>;
  markEmailProcessed(projectId: string, messageId: string, inboxId: string, sessionId: string, subject?: string, fromEmail?: string, emailBody?: string, receivedAt?: Date): Promise<void>;
  getSourceEmail(sessionId: string): Promise<{ subject: string | null; fromEmail: string | null; emailBody: string | null; receivedAt: Date | null } | null>;
  
  // API Data Sources
  getApiDataSources(projectId: string): Promise<ApiDataSource[]>;
  getApiDataSource(id: string): Promise<ApiDataSource | undefined>;
  createApiDataSource(source: InsertApiDataSource): Promise<ApiDataSource>;
  updateApiDataSource(id: string, source: Partial<InsertApiDataSource>): Promise<ApiDataSource | undefined>;
  deleteApiDataSource(id: string): Promise<boolean>;

  // Password Reset Tokens
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(tokenHash: string): Promise<void>;
  invalidatePasswordResetTokensForUser(userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private organizations: Map<string, Organization>;
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private projectSchemaFields: Map<string, ProjectSchemaField>;
  private objectCollections: Map<string, ObjectCollection>;
  private collectionProperties: Map<string, CollectionProperty>;
  private extractionSessions: Map<string, ExtractionSession>;
  private sessionDocuments: Map<string, SessionDocument>;
  private knowledgeDocuments: Map<string, KnowledgeDocument>;
  private extractionRules: Map<string, ExtractionRule>;
  private fieldValidations: Map<string, FieldValidation>;
  private chatMessages: Map<string, ChatMessage>;
  private excelWizardryFunctions: Map<string, ExcelWizardryFunction>;
  private extractionIdentifierReferences: Map<string, ExtractionIdentifierReference>;
  private sampleDocuments: Map<string, SampleDocument>;
  private workflowSteps: Map<string, WorkflowStep>;
  private stepValues: Map<string, StepValue>;
  private testDocuments: Map<string, TestDocument>;

  constructor() {
    this.organizations = new Map();
    this.users = new Map();
    this.projects = new Map();
    this.projectSchemaFields = new Map();
    this.objectCollections = new Map();
    this.collectionProperties = new Map();
    this.extractionSessions = new Map();
    this.sessionDocuments = new Map();
    this.knowledgeDocuments = new Map();
    this.extractionRules = new Map();
    this.fieldValidations = new Map();
    this.chatMessages = new Map();
    this.excelWizardryFunctions = new Map();
    this.extractionIdentifierReferences = new Map();
    this.sampleDocuments = new Map();
    this.workflowSteps = new Map();
    this.stepValues = new Map();
    this.testDocuments = new Map();
    
    // Initialize with sample data for development
    this.initializeSampleData();
  }

  private generateUUID(): string {
    return crypto.randomUUID();
  }
  
  private initializeSampleData() {
    // Use deterministic UUIDs for sample data so they're consistent across restarts
    // and match between MemStorage and PostgreSQL
    const orgId = "550e8400-e29b-41d4-a716-446655440000"; // Fixed UUID for sample org
    const org: Organization = {
      id: orgId,
      name: "ACME Corporation", 
      description: "Sample organization for testing",
      type: "primary",
      createdAt: new Date()
    };
    this.organizations.set(orgId, org);

    // Create sample admin user (password: "password") with deterministic UUID
    const userId = "550e8400-e29b-41d4-a716-446655440001"; // Fixed UUID for sample user
    const adminUser: User = {
      id: userId,
      email: "admin@acme.com",
      passwordHash: "$2b$10$3okWosohJ1kYB2mvuz1ieuZTTrUIbDcEv3O2D/sWc01cyvlhqN88C",
      name: "Admin User",
      organizationId: orgId,
      role: "admin",
      isActive: true,
      isTemporaryPassword: false,
      projectOrder: null,
      createdAt: new Date()
    };
    this.users.set(userId, adminUser);

    // Create a sample project with deterministic UUID
    const projectId = "550e8400-e29b-41d4-a716-446655440002"; // Fixed UUID for sample project
    const project: Project = {
      id: projectId,
      name: "Sample Invoice Processing",
      description: "Extract data from invoices and receipts",
      organizationId: orgId,
      createdBy: userId,
      mainObjectName: "Invoice",
      mainObjectDescription: null,
      status: "active",
      isInitialSetupComplete: true,
      createdAt: new Date(),
    };
    this.projects.set(projectId, project);
    
    // Add sample schema fields with deterministic UUIDs
    const schemaFields = [
      {
        id: "550e8400-e29b-41d4-a716-446655440010", // Fixed UUID for Total Amount field
        projectId: projectId,
        fieldName: "Total Amount",
        fieldType: "NUMBER" as const,
        description: "The total amount of the invoice",
        autoVerificationConfidence: 80,
        choiceOptions: null,
        orderIndex: 1,
        createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440011", // Fixed UUID for Invoice Date field
        projectId: projectId,
        fieldName: "Invoice Date",
        fieldType: "DATE" as const,
        description: "The date when the invoice was issued",
        autoVerificationConfidence: 80,
        choiceOptions: null,
        orderIndex: 2,
        createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440012", // Fixed UUID for Vendor Name field
        projectId: projectId,
        fieldName: "Vendor Name",
        fieldType: "TEXT" as const,
        description: "The name of the vendor or supplier",
        autoVerificationConfidence: 80,
        choiceOptions: null,
        orderIndex: 3,
        createdAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
      },
    ];
    
    schemaFields.forEach(field => this.projectSchemaFields.set(field.id, field));
    
    // Add sample collection with deterministic UUID
    const collectionId = "550e8400-e29b-41d4-a716-446655440020"; // Fixed UUID for Line Items collection
    const collection = {
      id: collectionId,
      projectId: projectId,
      collectionName: "Line Items",
      description: "Individual items listed on the invoice",
      orderIndex: 1,
      createdAt: new Date(),
    };
    this.objectCollections.set(collectionId, collection);
    
    // Add sample collection properties with deterministic UUIDs
    const properties = [
      {
        id: "550e8400-e29b-41d4-a716-446655440030", // Fixed UUID for Description property
        collectionId: collectionId,
        propertyName: "Description",
        propertyType: "TEXT" as const,
        description: "Description of the item",
        autoVerificationConfidence: 80,
        choiceOptions: null,
        orderIndex: 1,
        createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440031", // Fixed UUID for Quantity property
        collectionId: collectionId,
        propertyName: "Quantity",
        propertyType: "NUMBER" as const,
        description: "Number of items",
        autoVerificationConfidence: 80,
        choiceOptions: null,
        orderIndex: 2,
        createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440032", // Fixed UUID for Unit Price property
        collectionId: collectionId,
        propertyName: "Unit Price",
        propertyType: "NUMBER" as const,
        description: "Price per unit",
        autoVerificationConfidence: 80,
        choiceOptions: null,
        orderIndex: 3,
        createdAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
      },
    ];
    
    properties.forEach(prop => this.collectionProperties.set(prop.id, prop));
    
    // Add sample extraction session with deterministic UUID
    const sessionId = "63f3c027-a7a2-4ce4-833b-596325529550"; // Match the actual session UUID being used
    const session = {
      id: sessionId,
      projectId: projectId,
      sessionName: "Invoice Batch 001",
      description: "Processing monthly invoices",
      documentCount: 3,
      status: "completed" as const,
      extractedData: JSON.stringify({
        "Total Amount": 1250.75,
        "Invoice Date": "2024-01-15",
        "Vendor Name": "ABC Supplies Inc.",
        "Line Items": [
          {
            "Description": "Office Supplies",
            "Quantity": 10,
            "Unit Price": 25.50
          },
          {
            "Description": "Printer Paper",
            "Quantity": 5,
            "Unit Price": 45.15
          },
          {
            "Description": "Ink Cartridges",
            "Quantity": 3,
            "Unit Price": 85.20
          }
        ]
      }),
      createdAt: new Date(Date.now() - 86400000), // 1 day ago
      updatedAt: new Date(Date.now() - 86400000),
    };
    this.extractionSessions.set(sessionId, session);
    
    // ===== ADD SECOND PROJECT FOR SCHEMA VIEW =====
    // Create the specific project that SchemaView is looking for
    const contractProjectId = "8781f847-0c0a-4c90-a62e-f29fee82f30f"; // Fixed UUID from SchemaView
    const contractProject = {
      id: contractProjectId,
      name: "Contract Data Extraction",
      description: "AI-powered extraction of legal contract data",
      organizationId: orgId,
      mainObjectName: "Contract",
      isInitialSetupComplete: true,
      createdAt: new Date(),
    };
    this.projects.set(contractProjectId, contractProject);
    
    // Add schema fields with deterministic UUIDs that match SchemaView expectations
    const contractSchemaFields = [
      {
        id: "550e8400-e29b-41d4-a716-446655440100", // Company Name field UUID
        projectId: contractProjectId,
        fieldName: "Company Name",
        fieldType: "TEXT" as const,
        description: "Name of the primary company in the contract",
        autoVerificationConfidence: 80,
        orderIndex: 1,
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440101", // Contract Date field UUID
        projectId: contractProjectId,
        fieldName: "Contract Date",
        fieldType: "DATE" as const,
        description: "Date when the contract was signed",
        autoVerificationConfidence: 80,
        orderIndex: 2,
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440102", // Number of Parties field UUID
        projectId: contractProjectId,
        fieldName: "Number of Parties",
        fieldType: "NUMBER" as const,
        description: "Total number of parties involved in this contract",
        autoVerificationConfidence: 80,
        orderIndex: 3,
        createdAt: new Date(Date.now() - 86400000 * 1),
      },
    ];
    
    contractSchemaFields.forEach(field => this.projectSchemaFields.set(field.id, field));
    
    // Add Parties collection with deterministic UUID
    const partiesCollectionId = "550e8400-e29b-41d4-a716-446655440110"; // Parties collection UUID
    const partiesCollection = {
      id: partiesCollectionId,
      projectId: contractProjectId,
      collectionName: "Parties",
      description: "Parties involved in the contract",
      orderIndex: 1,
      createdAt: new Date(),
    };
    this.objectCollections.set(partiesCollectionId, partiesCollection);
    
    // Add Parties collection properties with deterministic UUIDs
    const partiesProperties = [
      {
        id: "550e8400-e29b-41d4-a716-446655440120", // Name property UUID
        collectionId: partiesCollectionId,
        propertyName: "Name",
        propertyType: "TEXT" as const,
        description: "Name of the party/company",
        autoVerificationConfidence: 80,
        orderIndex: 1,
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440121", // Country property UUID
        collectionId: partiesCollectionId,
        propertyName: "Country",
        propertyType: "TEXT" as const,
        description: "Country where the party is located",
        autoVerificationConfidence: 80,
        orderIndex: 2,
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440122", // Address property UUID
        collectionId: partiesCollectionId,
        propertyName: "Address",
        propertyType: "TEXT" as const,
        description: "Full address of the party",
        autoVerificationConfidence: 80,
        orderIndex: 3,
        createdAt: new Date(Date.now() - 86400000 * 1),
      },
    ];
    
    partiesProperties.forEach(prop => this.collectionProperties.set(prop.id, prop));
    
    // Add sample field validations for existing session with deterministic UUIDs
    const validations: FieldValidation[] = [
      // Project Schema Fields
      {
        id: "550e8400-e29b-41d4-a716-446655440050", // Fixed UUID for Total Amount validation
        sessionId: sessionId,
        fieldType: "schema_field" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440010", // Reference to Total Amount field
        fieldName: "Total Amount",
        collectionName: null,
        recordIndex: 0,
        extractedValue: "1250.75",
        validationStatus: "valid" as const,
        aiReasoning: "Successfully extracted numeric value from document total",
        manuallyVerified: false,
        confidenceScore: 95
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440051", // Fixed UUID for Invoice Date validation
        sessionId: sessionId,
        fieldType: "schema_field" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440011", // Reference to Invoice Date field
        fieldName: "Invoice Date",
        collectionName: null,
        recordIndex: 0,
        extractedValue: "2024-01-15",
        validationStatus: "valid" as const,
        aiReasoning: "Date format is valid and matches expected pattern",
        manuallyVerified: false,
        confidenceScore: 98
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440052", // Fixed UUID for Vendor Name validation
        sessionId: sessionId,
        fieldType: "schema_field" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440012", // Reference to Vendor Name field
        fieldName: "Vendor Name",
        collectionName: null,
        recordIndex: 0,
        extractedValue: "ABC Supplies Inc.",
        validationStatus: "valid" as const,
        aiReasoning: "Company name extracted from invoice header",
        manuallyVerified: false,
        confidenceScore: 92
      },
      // Line Items Collection - First Item
      {
        id: "550e8400-e29b-41d4-a716-446655440060", // Fixed UUID for Description validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440030", // Reference to Description property
        fieldName: "Line Items.Description[0]",
        collectionName: "Line Items",
        recordIndex: 0,
        extractedValue: "Office Supplies",
        validationStatus: "valid" as const,
        aiReasoning: "Item description clearly identified in line item",
        manuallyVerified: false,
        confidenceScore: 90
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440061", // Fixed UUID for Quantity validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440031", // Reference to Quantity property
        fieldName: "Line Items.Quantity[0]",
        collectionName: "Line Items",
        recordIndex: 0,
        extractedValue: "10",
        validationStatus: "valid" as const,
        aiReasoning: "Numeric quantity value extracted correctly",
        manuallyVerified: false,
        confidenceScore: 88
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440062", // Fixed UUID for Unit Price validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440032", // Reference to Unit Price property
        fieldName: "Line Items.Unit Price[0]",
        collectionName: "Line Items",
        recordIndex: 0,
        extractedValue: "25.5",
        validationStatus: "pending" as const,
        aiReasoning: "Price format appears correct but may need verification against source document",
        manuallyVerified: false,
        confidenceScore: 72
      },
      // Line Items Collection - Second Item
      {
        id: "550e8400-e29b-41d4-a716-446655440070", // Fixed UUID for Line Items Description validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440030", // Description property
        fieldName: "Line Items.Description[1]",
        collectionName: "Line Items",
        recordIndex: 1,
        extractedValue: "Printer Paper",
        validationStatus: "valid" as const,
        aiReasoning: "Item description clearly identified in line item",
        manuallyVerified: false,
        confidenceScore: 94
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440071", // Fixed UUID for Line Items Quantity validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440031", // Quantity property
        fieldName: "Line Items.Quantity[1]",
        collectionName: "Line Items",
        recordIndex: 1,
        extractedValue: "5",
        validationStatus: "valid" as const,
        aiReasoning: "Numeric quantity value extracted correctly",
        manuallyVerified: false,
        confidenceScore: 91
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440072", // Fixed UUID for Line Items Unit Price validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440032", // Unit Price property
        fieldName: "Line Items.Unit Price[1]",
        collectionName: "Line Items",
        recordIndex: 1,
        extractedValue: "45.15",
        validationStatus: "pending" as const,
        aiReasoning: "Price value needs verification - format looks correct but confidence is low",
        manuallyVerified: false,
        confidenceScore: 68
      },
      // Line Items Collection - Third Item
      {
        id: "550e8400-e29b-41d4-a716-446655440073", // Fixed UUID for Line Items Description validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440030", // Description property
        fieldName: "Line Items.Description[2]",
        collectionName: "Line Items",
        recordIndex: 2,
        extractedValue: "Ink Cartridges",
        validationStatus: "valid" as const,
        aiReasoning: "Item description clearly identified in line item",
        manuallyVerified: false,
        confidenceScore: 89
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440074", // Fixed UUID for Line Items Quantity validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440031", // Quantity property
        fieldName: "Line Items.Quantity[2]",
        collectionName: "Line Items",
        recordIndex: 2,
        extractedValue: "3",
        validationStatus: "valid" as const,
        aiReasoning: "Numeric quantity value extracted correctly",
        manuallyVerified: false,
        confidenceScore: 87
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440075", // Fixed UUID for Line Items Unit Price validation
        sessionId: sessionId,
        fieldType: "collection_property" as const,
        fieldId: "550e8400-e29b-41d4-a716-446655440032", // Unit Price property
        fieldName: "Line Items.Unit Price[2]",
        collectionName: "Line Items",
        recordIndex: 2,
        extractedValue: "85.2",
        validationStatus: "pending" as const,
        aiReasoning: "Price value needs verification - format looks correct but confidence is low",
        manuallyVerified: false,
        confidenceScore: 71
      }
    ];
    
    validations.forEach(validation => this.fieldValidations.set(validation.id, validation));
    // Removed currentValidationId as we now use UUIDs for all validations
    
    // Add extraction rule for contract project with deterministic UUID
    const contractExtractionRuleId = "19f92612-0c5c-4463-a746-d7ef82781b1a"; // Fixed UUID for Inc. rule
    const contractExtractionRule = {
      id: contractExtractionRuleId,
      projectId: contractProjectId,
      ruleName: "Inc. Company Detection Rule",
      targetField: null, // Global rule applies to all fields
      ruleContent: "If a company name ends with 'Inc.', reduce the confidence score to 27% as these names may require additional verification.",
      isActive: true,
      createdAt: new Date(),
    };
    this.extractionRules.set(contractExtractionRuleId, contractExtractionRule);
  }

  // Organizations
  async getOrganizations(): Promise<(Organization & { userCount: number })[]> {
    const orgs = Array.from(this.organizations.values());
    const orgsWithUserCount = orgs.map(org => {
      const userCount = Array.from(this.users.values()).filter(u => u.organizationId === org.id).length;
      return { ...org, userCount };
    });
    
    return orgsWithUserCount.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async getOrganizationBySubdomain(subdomain: string): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find(org => org.subdomain === subdomain);
  }

  async getPrimaryOrganization(): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find(org => org.type === 'primary');
  }

  async getOrganizationWithUsers(id: number): Promise<OrganizationWithUsers | undefined> {
    const org = this.organizations.get(id);
    if (!org) return undefined;
    
    const users = Array.from(this.users.values()).filter(u => u.organizationId === id);
    return { ...org, users };
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const org: Organization = {
      id: this.currentOrganizationId++,
      ...insertOrg,
      createdAt: new Date(),
    };
    this.organizations.set(org.id, org);
    return org;
  }

  async updateOrganization(id: number, updateData: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const org = this.organizations.get(id);
    if (!org) return undefined;
    
    const updated = { ...org, ...updateData };
    this.organizations.set(id, updated);
    return updated;
  }

  async deleteOrganization(id: number): Promise<boolean> {
    return this.organizations.delete(id);
  }

  // Users
  async getUsers(organizationId: number): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.organizationId === organizationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUserWithOrganization(id: string): Promise<UserWithOrganization | undefined> {
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) return undefined;
    
    const org = this.organizations.get(user.organizationId);
    if (!org) return undefined;
    
    return { ...user, organization: org };
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    const { password, ...insertUser } = userData;
    // Hash password using bcrypt
    const bcryptjs = await import('bcryptjs');
    const passwordHash = await bcryptjs.default.hash(password, 10);
    
    const user: User = {
      id: this.currentUserId++,
      ...insertUser,
      passwordHash,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated = { ...user, ...updateData };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async resetUserPassword(userId: number, tempPassword: string): Promise<{ tempPassword: string }> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    // Import bcrypt dynamically to avoid ESM issues
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Update user with temporary password
    const updated = { 
      ...user, 
      passwordHash: hashedPassword,
      isTemporaryPassword: true 
    };
    this.users.set(userId, updated);
    
    return { tempPassword };
  }

  async updateUserPassword(userId: number, newPasswordHash: string, isTemporary: boolean = false): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated = { 
      ...user, 
      passwordHash: newPasswordHash,
      isTemporaryPassword: isTemporary 
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserProjectOrder(userId: string, projectOrder: string[]): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) return undefined;
    
    const updated = { 
      ...user, 
      projectOrder 
    };
    this.users.set(user.id, updated);
    return updated;
  }

  // Multi-organization membership (stub implementations for MemStorage)
  async getOrganizationMembers(organizationId: string): Promise<(User & { orgRole: string })[]> {
    return Array.from(this.users.values())
      .filter(u => u.organizationId === organizationId)
      .map(u => ({ ...u, orgRole: u.role }));
  }

  async addUserToOrganization(userId: string, organizationId: string, role: string = 'user'): Promise<boolean> {
    return true;
  }

  async removeUserFromOrganization(userId: string, organizationId: string): Promise<boolean> {
    return true;
  }

  async getUserOrganizations(userId: string): Promise<{ organizationId: string; organizationName: string; role: string }[]> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) return [];
    const org = this.organizations.get(user.organizationId);
    if (!org) return [];
    return [{ organizationId: user.organizationId as string, organizationName: org.name, role: user.role }];
  }

  // Projects (with organization filtering)
  async getProjects(organizationId?: number, userRole?: string): Promise<Project[]> {
    let projects = Array.from(this.projects.values());
    
    if (organizationId) {
      projects = projects.filter(p => p.organizationId === organizationId);
    }
    
    return projects.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getProject(id: number, organizationId?: number): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    // Check organization access if organizationId is provided
    if (organizationId && project.organizationId !== organizationId) {
      return undefined;
    }
    
    return project;
  }

  async getProjectByInboxId(inboxId: string): Promise<Project | undefined> {
    for (const project of this.projects.values()) {
      if (project.inboxId === inboxId) {
        return project;
      }
    }
    return undefined;
  }

  async getProjectWithDetails(id: number, organizationId?: number): Promise<ProjectWithDetails | undefined> {
    const project = await this.getProject(id, organizationId);
    if (!project) return undefined;

    const schemaFields = Array.from(this.projectSchemaFields.values())
      .filter(field => field.projectId === id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const collections = Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === id)
      .map(collection => {
        const properties = Array.from(this.collectionProperties.values())
          .filter(prop => prop.collectionId === collection.id)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return { ...collection, properties };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Get workflow steps and their values
    const workflowSteps = Array.from(this.workflowSteps.values())
      .filter(step => step.projectId === id)
      .map(step => {
        const values = Array.from(this.stepValues.values())
          .filter(value => value.stepId === step.id)
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        return { ...step, values };
      })
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const sessions = Array.from(this.extractionSessions.values())
      .filter(session => session.projectId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const knowledgeDocuments = Array.from(this.knowledgeDocuments.values())
      .filter(doc => doc.projectId === id)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    const extractionRules = Array.from(this.extractionRules.values())
      .filter(rule => rule.projectId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      ...project,
      schemaFields,
      collections,
      workflowSteps,
      sessions,
      knowledgeDocuments,
      extractionRules,
    };
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.generateUUID();
    const project: Project = {
      id,
      ...insertProject,
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: number, updateData: Partial<InsertProject>, organizationId?: number): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    // Check organization access if organizationId is provided
    if (organizationId && project.organizationId !== organizationId) {
      return undefined;
    }
    
    const updated = { ...project, ...updateData };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string, organizationId?: string): Promise<boolean> {
    // Convert string ID to number for MemStorage
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) return false;
    
    const project = this.projects.get(projectId);
    if (!project) return false;
    
    // Check organization access if organizationId is provided
    if (organizationId) {
      const orgId = parseInt(organizationId, 10);
      if (isNaN(orgId) || project.organizationId !== orgId) {
        return false;
      }
    }
    
    return this.projects.delete(projectId);
  }

  async duplicateProject(id: string, newName: string, userId: string, organizationId?: string): Promise<Project | undefined> {
    // Convert string ID to number for MemStorage
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) return undefined;
    
    const originalProject = this.projects.get(projectId);
    if (!originalProject) return undefined;
    
    // Check organization access if organizationId is provided
    if (organizationId) {
      const orgId = parseInt(organizationId, 10);
      if (isNaN(orgId) || originalProject.organizationId !== orgId) {
        return undefined;
      }
    }
    
    // Create new project with the same data but different name and ID
    const duplicatedProject: Project = {
      id: this.currentProjectId++,
      name: newName,
      description: originalProject.description,
      mainObjectName: originalProject.mainObjectName,
      organizationId: originalProject.organizationId,
      isInitialSetupComplete: originalProject.isInitialSetupComplete,
      createdAt: new Date(),
    };
    
    this.projects.set(duplicatedProject.id, duplicatedProject);
    
    // Duplicate schema fields
    const originalSchemaFields = Array.from(this.projectSchemaFields.values())
      .filter(field => field.projectId === originalProject.id.toString());
    
    for (const field of originalSchemaFields) {
      const duplicatedField: ProjectSchemaField = {
        id: this.generateUUID(),
        name: field.name,
        fieldType: field.fieldType,
        description: field.description,
        isRequired: field.isRequired,
        orderIndex: field.orderIndex,
        projectId: duplicatedProject.id.toString(),
        createdAt: new Date(),
      };
      this.projectSchemaFields.set(duplicatedField.id, duplicatedField);
    }
    
    // Duplicate collections and their properties
    const originalCollections = Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === originalProject.id);
    
    for (const collection of originalCollections) {
      const duplicatedCollection: ObjectCollection = {
        id: this.generateUUID(),
        name: collection.name,
        description: collection.description,
        projectId: duplicatedProject.id,
        createdAt: new Date(),
      };
      this.objectCollections.set(duplicatedCollection.id, duplicatedCollection);
      
      // Duplicate collection properties
      const originalProperties = Array.from(this.collectionProperties.values())
        .filter(prop => prop.collectionId === collection.id);
      
      for (const property of originalProperties) {
        const duplicatedProperty: CollectionProperty = {
          id: this.generateUUID(),
          name: property.name,
          fieldType: property.fieldType,
          description: property.description,
          isRequired: property.isRequired,
          orderIndex: property.orderIndex,
          collectionId: duplicatedCollection.id,
          createdAt: new Date(),
        };
        this.collectionProperties.set(duplicatedProperty.id, duplicatedProperty);
      }
    }
    
    // Duplicate extraction rules
    const originalRules = Array.from(this.extractionRules.values())
      .filter(rule => rule.projectId === originalProject.id);
    
    for (const rule of originalRules) {
      const duplicatedRule: ExtractionRule = {
        id: this.generateUUID(),
        projectId: duplicatedProject.id,
        title: rule.title,
        description: rule.description,
        targetFields: rule.targetFields,
        ruleText: rule.ruleText,
        createdAt: new Date(),
      };
      this.extractionRules.set(duplicatedRule.id, duplicatedRule);
    }
    
    // Duplicate knowledge documents
    const originalKnowledgeDocs = Array.from(this.knowledgeDocuments.values())
      .filter(doc => doc.projectId === originalProject.id.toString());
    
    for (const doc of originalKnowledgeDocs) {
      const duplicatedDoc: KnowledgeDocument = {
        id: this.generateUUID(),
        projectId: duplicatedProject.id.toString(),
        fileName: doc.fileName,
        displayName: doc.displayName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        content: doc.content,
        description: doc.description,
        targetField: doc.targetField,
        uploadedAt: new Date(),
      };
      this.knowledgeDocuments.set(duplicatedDoc.id, duplicatedDoc);
    }
    
    // Duplicate Excel Wizardry Functions (AI Tools)
    const originalTools = Array.from(this.excelWizardryFunctions.values())
      .filter(tool => tool.projectId === originalProject.id.toString());
    const toolMapping = new Map<string, string>(); // Map old tool IDs to new tool IDs
    
    for (const tool of originalTools) {
      const newToolId = this.generateUUID();
      toolMapping.set(tool.id, newToolId);
      
      const duplicatedTool: ExcelWizardryFunction = {
        id: newToolId,
        projectId: duplicatedProject.id.toString(),
        name: tool.name,
        description: tool.description,
        functionCode: tool.functionCode,
        aiPrompt: tool.aiPrompt,
        toolType: tool.toolType,
        outputType: tool.outputType,
        operationType: tool.operationType,
        inputParameters: tool.inputParameters,
        aiAssistanceRequired: tool.aiAssistanceRequired,
        aiAssistancePrompt: tool.aiAssistancePrompt,
        llmModel: tool.llmModel,
        metadata: tool.metadata,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        tags: tool.tags,
        usageCount: 0, // Reset usage count for new project
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.excelWizardryFunctions.set(duplicatedTool.id, duplicatedTool);
    }
    
    // Duplicate Workflow Steps and Values
    const originalSteps = Array.from(this.workflowSteps.values())
      .filter(step => step.projectId === originalProject.id.toString());
    
    for (const step of originalSteps) {
      const newStepId = this.generateUUID();
      
      // Get original step values for this step
      const originalValues = Array.from(this.stepValues.values())
        .filter(value => value.stepId === step.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      
      // For list steps, handle the identifier value
      let newIdentifierId: string | undefined;
      if (step.stepType === 'list' && originalValues.length > 0) {
        const identifierValue = originalValues.find(v => v.isIdentifier);
        if (identifierValue) {
          newIdentifierId = this.generateUUID();
        }
      }
      
      // Create the duplicated step
      const duplicatedStep: WorkflowStep = {
        id: newStepId,
        projectId: duplicatedProject.id.toString(),
        stepName: step.stepName,
        stepType: step.stepType,
        description: step.description,
        orderIndex: step.orderIndex,
        valueCount: step.valueCount,
        identifierId: newIdentifierId,
        createdAt: new Date(),
      };
      this.workflowSteps.set(duplicatedStep.id, duplicatedStep);
      
      // Duplicate step values
      for (const value of originalValues) {
        const newValueId = value.isIdentifier && newIdentifierId ? newIdentifierId : this.generateUUID();
        
        const duplicatedValue: StepValue = {
          id: newValueId,
          stepId: newStepId,
          valueName: value.valueName,
          dataType: value.dataType,
          description: value.description,
          isIdentifier: value.isIdentifier,
          orderIndex: value.orderIndex,
          // Map the tool ID to the new tool if it exists
          toolId: value.toolId && toolMapping.has(value.toolId) ? toolMapping.get(value.toolId) : value.toolId,
          inputValues: value.inputValues,
          fields: value.fields,
          autoVerificationConfidence: value.autoVerificationConfidence,
          choiceOptions: value.choiceOptions,
          createdAt: new Date(),
        };
        this.stepValues.set(duplicatedValue.id, duplicatedValue);
      }
    }
    
    // Note: We don't duplicate sessions or validations as these are instance-specific data
    
    return duplicatedProject;
  }

  // Project Schema Fields
  async getProjectSchemaFields(projectId: string): Promise<ProjectSchemaField[]> {
    return Array.from(this.projectSchemaFields.values())
      .filter(field => field.projectId === projectId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  async createProjectSchemaField(insertField: InsertProjectSchemaField): Promise<ProjectSchemaField> {
    const id = this.generateUUID();
    const field: ProjectSchemaField = {
      ...insertField,
      id,
      description: insertField.description || null,
      orderIndex: insertField.orderIndex || null,
      createdAt: new Date(),
    };
    this.projectSchemaFields.set(id, field);
    return field;
  }

  async updateProjectSchemaField(id: string, updateData: Partial<InsertProjectSchemaField>): Promise<ProjectSchemaField | undefined> {
    const field = this.projectSchemaFields.get(id);
    if (!field) return undefined;

    const updatedField = { ...field, ...updateData };
    this.projectSchemaFields.set(id, updatedField);
    return updatedField;
  }

  async deleteProjectSchemaField(id: string): Promise<boolean> {
    return this.projectSchemaFields.delete(id);
  }

  async getProjectSchemaFieldById(id: string): Promise<ProjectSchemaField | undefined> {
    return this.projectSchemaFields.get(id);
  }

  // Object Collections
  async getObjectCollections(projectId: string): Promise<(ObjectCollection & { properties: CollectionProperty[] })[]> {
    const collections = Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === projectId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    return collections.map(collection => ({
      ...collection,
      properties: Array.from(this.collectionProperties.values())
        .filter(property => property.collectionId === collection.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    }));
  }

  async getAllCollectionsForReferences(organizationId: string): Promise<(ObjectCollection & { properties: CollectionProperty[], projectName: string })[]> {
    // Get all projects for the organization
    const projects = Array.from(this.projects.values())
      .filter(project => project.organizationId === organizationId);

    // Get all collections from all projects
    const allCollections: (ObjectCollection & { properties: CollectionProperty[], projectName: string })[] = [];
    
    for (const project of projects) {
      const collections = Array.from(this.objectCollections.values())
        .filter(collection => collection.projectId === project.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

      const collectionsWithProperties = collections.map(collection => ({
        ...collection,
        projectName: project.projectName,
        properties: Array.from(this.collectionProperties.values())
          .filter(property => property.collectionId === collection.id)
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      }));

      allCollections.push(...collectionsWithProperties);
    }

    // Sort by project name, then collection name
    return allCollections.sort((a, b) => {
      const projectComparison = a.projectName.localeCompare(b.projectName);
      if (projectComparison !== 0) return projectComparison;
      return a.collectionName.localeCompare(b.collectionName);
    });
  }

  async getObjectCollection(id: string): Promise<ObjectCollection | undefined> {
    return this.objectCollections.get(id);
  }

  async createObjectCollection(insertCollection: InsertObjectCollection): Promise<ObjectCollection> {
    const id = this.generateUUID();
    const collection: ObjectCollection = {
      ...insertCollection,
      id,
      description: insertCollection.description || null,
      orderIndex: insertCollection.orderIndex || null,
      createdAt: new Date(),
    };
    this.objectCollections.set(id, collection);
    return collection;
  }

  async updateObjectCollection(id: string, updateData: Partial<InsertObjectCollection>): Promise<ObjectCollection | undefined> {
    const collection = this.objectCollections.get(id);
    if (!collection) return undefined;

    const updatedCollection = { ...collection, ...updateData };
    this.objectCollections.set(id, updatedCollection);
    return updatedCollection;
  }

  async deleteObjectCollection(id: string): Promise<boolean> {
    // Delete related properties first
    const properties = Array.from(this.collectionProperties.values())
      .filter(prop => prop.collectionId === id);
    properties.forEach(prop => this.collectionProperties.delete(prop.id));

    return this.objectCollections.delete(id);
  }

  // Collection Properties
  async getCollectionProperties(collectionId: string): Promise<CollectionProperty[]> {
    return Array.from(this.collectionProperties.values())
      .filter(prop => prop.collectionId === collectionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getCollectionPropertyById(id: string): Promise<CollectionProperty | undefined> {
    return this.collectionProperties.get(id);
  }

  async createCollectionProperty(insertProperty: InsertCollectionProperty): Promise<CollectionProperty> {
    const id = this.generateUUID();
    const property: CollectionProperty = {
      ...insertProperty,
      id,
      description: insertProperty.description || null,
      orderIndex: insertProperty.orderIndex || null,
      createdAt: new Date(),
    };
    this.collectionProperties.set(id, property);
    return property;
  }

  async updateCollectionProperty(id: string, updateData: Partial<InsertCollectionProperty>): Promise<CollectionProperty | undefined> {
    const property = this.collectionProperties.get(id);
    if (!property) return undefined;

    const updatedProperty = { ...property, ...updateData };
    this.collectionProperties.set(id, updatedProperty);
    return updatedProperty;
  }

  async deleteCollectionProperty(id: string): Promise<boolean> {
    return this.collectionProperties.delete(id);
  }

  async setCollectionIdentifierField(collectionId: string, propertyId: string): Promise<boolean> {
    // First, remove identifier flag from all other properties in this collection
    for (const [id, property] of this.collectionProperties.entries()) {
      if (property.collectionId === collectionId) {
        this.collectionProperties.set(id, { ...property, isIdentifier: false });
      }
    }
    
    // Set the new identifier property
    const property = this.collectionProperties.get(propertyId);
    if (property && property.collectionId === collectionId) {
      this.collectionProperties.set(propertyId, { ...property, isIdentifier: true });
      
      // Update the collection's identifier field reference
      const collection = this.objectCollections.get(collectionId);
      if (collection) {
        this.objectCollections.set(collectionId, { ...collection, identifierFieldId: propertyId });
      }
      return true;
    }
    return false;
  }

  async getCollectionIdentifierField(collectionId: string): Promise<CollectionProperty | undefined> {
    for (const property of this.collectionProperties.values()) {
      if (property.collectionId === collectionId && property.isIdentifier) {
        return property;
      }
    }
    return undefined;
  }

  // Overview Sessions
  async getExtractionSessions(projectId: string): Promise<ExtractionSession[]> {
    return Array.from(this.extractionSessions.values())
      .filter(session => session.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getExtractionSession(id: string): Promise<ExtractionSession | undefined> {
    return this.extractionSessions.get(id);
  }

  async createExtractionSession(insertSession: InsertExtractionSession): Promise<ExtractionSession> {
    const id = this.generateUUID();
    const session: ExtractionSession = {
      ...insertSession,
      id,
      description: insertSession.description || null,
      documentCount: insertSession.documentCount || 0,
      status: insertSession.status || "in_progress",
      extractedData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.extractionSessions.set(id, session);
    return session;
  }

  async updateExtractionSession(id: string, updateData: any): Promise<ExtractionSession | undefined> {
    const session = this.extractionSessions.get(id);
    if (!session) return undefined;

    const updatedSession = { ...session, ...updateData, updatedAt: new Date() };
    this.extractionSessions.set(id, updatedSession);
    return updatedSession;
  }

  async createWorkflowStatusHistory(entry: InsertWorkflowStatusHistory): Promise<WorkflowStatusHistory> {
    return { ...entry, id: uuidv4(), changedAt: new Date() } as WorkflowStatusHistory;
  }

  async getWorkflowStatusHistory(projectId: string): Promise<WorkflowStatusHistory[]> {
    return [];
  }

  // Session Documents (MemStorage implementation)
  async getSessionDocuments(sessionId: string): Promise<SessionDocument[]> {
    return Array.from(this.sessionDocuments.values())
      .filter(doc => doc.sessionId === sessionId)
      .sort((a, b) => new Date(a.extractedAt).getTime() - new Date(b.extractedAt).getTime());
  }

  async createSessionDocument(insertDocument: InsertSessionDocument): Promise<SessionDocument> {
    const id = this.generateUUID();
    const document: SessionDocument = {
      ...insertDocument,
      id,
      extractedAt: new Date(),
      extractedContent: normalizeExcelContent(insertDocument.extractedContent || ''),
    };
    this.sessionDocuments.set(id, document);
    return document;
  }

  async updateSessionDocument(id: string, updateData: Partial<InsertSessionDocument>): Promise<SessionDocument | undefined> {
    const document = this.sessionDocuments.get(id);
    if (!document) return undefined;

    // Apply Excel normalization if extractedContent is being updated
    const normalizedUpdateData = updateData.extractedContent !== undefined 
      ? { ...updateData, extractedContent: normalizeExcelContent(updateData.extractedContent || '') }
      : updateData;

    const updatedDocument = { ...document, ...normalizedUpdateData };
    this.sessionDocuments.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteSessionDocument(id: string): Promise<boolean> {
    return this.sessionDocuments.delete(id);
  }

  async getStepValueById(valueId: string): Promise<{ valueName: string; stepId: string } | undefined> {
    const value = this.stepValues.get(valueId);
    return value ? { valueName: value.valueName, stepId: value.stepId } : undefined;
  }

  // Knowledge Documents
  async getKnowledgeDocuments(projectId: string): Promise<KnowledgeDocument[]> {
    return Array.from(this.knowledgeDocuments.values())
      .filter(doc => doc.projectId === projectId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined> {
    return this.knowledgeDocuments.get(id);
  }

  async createKnowledgeDocument(insertDocument: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const id = this.generateUUID();
    const document: KnowledgeDocument = {
      ...insertDocument,
      id,
      uploadedAt: new Date(),
    };
    this.knowledgeDocuments.set(id, document);
    return document;
  }

  async updateKnowledgeDocument(id: string, updateData: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const existingDocument = this.knowledgeDocuments.get(id);
    if (!existingDocument) return undefined;

    const updatedDocument = { ...existingDocument, ...updateData };
    this.knowledgeDocuments.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteKnowledgeDocument(id: string): Promise<boolean> {
    return this.knowledgeDocuments.delete(id);
  }

  // Extraction Rules
  async getExtractionRules(projectId: string): Promise<ExtractionRule[]> {
    return Array.from(this.extractionRules.values())
      .filter(rule => rule.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createExtractionRule(insertRule: InsertExtractionRule): Promise<ExtractionRule> {
    const id = this.generateUUID();
    const rule: ExtractionRule = {
      ...insertRule,
      id,
      targetField: insertRule.targetField || null,
      isActive: insertRule.isActive ?? true,
      createdAt: new Date(),
    };
    this.extractionRules.set(id, rule);
    return rule;
  }

  async updateExtractionRule(id: string, updateData: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined> {
    const existingRule = this.extractionRules.get(id);
    if (!existingRule) return undefined;

    const updatedRule = { ...existingRule, ...updateData };
    this.extractionRules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteExtractionRule(id: string): Promise<boolean> {
    return this.extractionRules.delete(id);
  }

  // Field Validations
  async getFieldValidations(sessionId: string): Promise<FieldValidation[]> {
    const validations = Array.from(this.fieldValidations.values())
      .filter(validation => validation.sessionId === sessionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Enhance results with field names (similar to database implementation)
    const enhancedValidations = validations.map(validation => {
      let fieldName = '';
      
      if (validation.validationType === 'schema_field') {
        // Get field name from project schema fields
        const schemaField = Array.from(this.projectSchemaFields.values())
          .find(field => field.id === validation.fieldId);
        fieldName = schemaField?.fieldName || '';
      } else if (validation.validationType === 'collection_property') {
        // Get property name from collection properties and build collection field name
        const property = Array.from(this.collectionProperties.values())
          .find(prop => prop.id === validation.fieldId);
        
        if (property && validation.collectionId && validation.recordIndex !== null) {
          // Get collection name by collectionId 
          const collection = Array.from(this.objectCollections.values())
            .find(coll => coll.id === validation.collectionId);
          if (collection) {
            fieldName = `${collection.collectionName}.${property.propertyName}[${validation.recordIndex}]`;
          }
        }
      }
      
      return {
        ...validation,
        fieldName
      };
    });
    
    return enhancedValidations;
  }

  async getSessionValidations(sessionId: string): Promise<FieldValidation[]> {
    // This is an alias for getFieldValidations for backwards compatibility
    return this.getFieldValidations(sessionId);
  }

  async getFieldValidation(id: string): Promise<FieldValidation | undefined> {
    return this.fieldValidations.get(id);
  }

  async createFieldValidation(insertValidation: InsertFieldValidation): Promise<FieldValidation> {
    const id = this.generateUUID();
    const validation: FieldValidation = {
      ...insertValidation,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.fieldValidations.set(id, validation);

    // Check if this is an identifier field - if so, auto-create row
    if (insertValidation.valueId && insertValidation.identifierId) {
      const stepValue = await this.getStepValueById(insertValidation.valueId);
      if (stepValue?.isIdentifier) {
        await this.createCompleteRowForIdentifier(insertValidation.sessionId!, insertValidation.stepId!, insertValidation.identifierId);
      }
    }

    return validation;
  }

  private async createCompleteRowForIdentifier(sessionId: string, stepId: string, identifierId: string): Promise<void> {
    try {
      console.log(`🏗️ Creating complete row for identifier ${identifierId} in step ${stepId}`);
      
      // Get all step values for this step
      const allStepValues = Array.from(this.stepValues.values())
        .filter(value => value.stepId === stepId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (allStepValues.length === 0) {
        console.log(`No step values found for step ${stepId}`);
        return;
      }

      // Create field validations for all columns in this row
      for (const stepValue of allStepValues) {
        // Check if field validation already exists
        const existingValidation = Array.from(this.fieldValidations.values())
          .find(v => 
            v.sessionId === sessionId &&
            v.stepId === stepId &&
            v.valueId === stepValue.id &&
            v.identifierId === identifierId
          );

        if (!existingValidation) {
          console.log(`Creating field validation for ${stepValue.valueName} in row ${identifierId}`);
          
          const fieldValidationData: InsertFieldValidation = {
            sessionId,
            stepId,
            valueId: stepValue.id,
            identifierId,
            validationType: 'step_value', // New type for step-based validations
            dataType: stepValue.dataType,
            fieldId: stepValue.id, // Use stepValue.id as fieldId for consistency
            extractedValue: null,
            validationStatus: 'pending' as const,
            aiReasoning: null,
            manuallyVerified: false,
            manuallyUpdated: false,
            confidenceScore: 0
          };

          const newFieldValidation: FieldValidation = {
            ...fieldValidationData,
            id: this.generateUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          this.fieldValidations.set(newFieldValidation.id, newFieldValidation);
          console.log(`✅ Created field validation for ${stepValue.valueName}`);
        } else {
          console.log(`Field validation already exists for ${stepValue.valueName} in row ${identifierId}`);
        }
      }
    } catch (error) {
      console.error(`Error creating complete row for identifier ${identifierId}:`, error);
    }
  }

  async initializeAllValidationRecords(sessionId: string, stepId: string, identifierIds: string[]): Promise<void> {
    try {
      console.log(`🚀 Initializing ALL validation records for step ${stepId}`);
      console.log(`   Session: ${sessionId}`);
      console.log(`   Total rows to initialize: ${identifierIds.length}`);
      
      // Get all step values for this step
      const allStepValues = Array.from(this.stepValues.values())
        .filter(value => value.stepId === stepId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (allStepValues.length === 0) {
        console.log(`❌ No step values found for step ${stepId}`);
        return;
      }

      console.log(`   Columns to initialize: ${allStepValues.length}`);
      console.log(`   Total records to create: ${identifierIds.length * allStepValues.length}`);
      
      let createdCount = 0;
      let skippedCount = 0;

      // Create validation records for ALL rows and ALL columns
      for (const identifierId of identifierIds) {
        for (const stepValue of allStepValues) {
          // Check if field validation already exists
          const existingValidation = Array.from(this.fieldValidations.values())
            .find(v => 
              v.sessionId === sessionId &&
              v.stepId === stepId &&
              v.valueId === stepValue.id &&
              v.identifierId === identifierId
            );

          if (!existingValidation) {
            const fieldValidationData: InsertFieldValidation = {
              sessionId,
              stepId,
              valueId: stepValue.id,
              identifierId,
              validationType: 'step_value',
              dataType: stepValue.dataType,
              fieldId: stepValue.id,
              extractedValue: null,
              validationStatus: 'pending' as const,
              aiReasoning: null,
              manuallyVerified: false,
              manuallyUpdated: false,
              confidenceScore: 0
            };

            const newFieldValidation: FieldValidation = {
              ...fieldValidationData,
              id: this.generateUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            this.fieldValidations.set(newFieldValidation.id, newFieldValidation);
            createdCount++;
          } else {
            skippedCount++;
          }
        }
      }
      
      console.log(`✅ Initialization complete:`);
      console.log(`   Created: ${createdCount} new validation records`);
      console.log(`   Skipped: ${skippedCount} existing records`);
    } catch (error) {
      console.error(`❌ Error initializing all validation records:`, error);
      throw error;
    }
  }

  async updateFieldValidation(id: string, updateData: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined> {
    const existingValidation = this.fieldValidations.get(id);
    if (!existingValidation) return undefined;

    const updatedValidation = { 
      ...existingValidation, 
      ...updateData, 
      updatedAt: new Date() 
    };
    this.fieldValidations.set(id, updatedValidation);
    return updatedValidation;
  }

  async deleteFieldValidation(id: string): Promise<boolean> {
    return this.fieldValidations.delete(id);
  }

  async getValidationsByStep(stepId: string, sessionId?: string): Promise<FieldValidation[]> {
    // For MemStorage, we need to get validations through value IDs
    // First get all values for this step
    const stepValuesList = Array.from(this.stepValues.values())
      .filter(value => value.stepId === stepId);
    
    // Get all validations that match these value IDs
    let validations = Array.from(this.fieldValidations.values())
      .filter(validation => 
        stepValuesList.some(value => value.id === validation.fieldId)
      );
    
    // Filter by sessionId if provided
    if (sessionId) {
      validations = validations.filter(v => v.sessionId === sessionId);
    }
    
    return validations;
  }
  
  async getValidationsByFieldAndCollection(sessionId: string, fieldId: string, collectionId: string, recordIndex: number): Promise<FieldValidation[]> {
    const validations = Array.from(this.fieldValidations.values())
      .filter(validation => 
        validation.sessionId === sessionId && 
        validation.fieldId === fieldId && 
        validation.collectionId === collectionId && 
        validation.recordIndex === recordIndex
      );
    
    // Enhance with field names
    const enhancedValidations = validations.map(validation => {
      let fieldName = '';
      
      if (validation.validationType === 'collection_property') {
        const property = Array.from(this.collectionProperties.values())
          .find(prop => prop.id === validation.fieldId);
        const collection = Array.from(this.objectCollections.values())
          .find(coll => coll.id === validation.collectionId);
          
        if (property && collection && validation.recordIndex !== null) {
          fieldName = `${collection.collectionName}.${property.propertyName}[${validation.recordIndex}]`;
        }
      }
      
      return {
        ...validation,
        fieldName
      };
    });
    
    return enhancedValidations;
  }

  async populateMissingCollectionIds(): Promise<void> {
    // For in-memory storage, populate missing collectionId based on collectionName
    const validationsToUpdate = Array.from(this.fieldValidations.values())
      .filter(validation => 
        validation.validationType === 'collection_property' && 
        !validation.collectionId && 
        validation.collectionName
      );

    for (const validation of validationsToUpdate) {
      if (validation.collectionName) {
        const collection = Array.from(this.objectCollections.values())
          .find(coll => coll.collectionName === validation.collectionName);
          
        if (collection) {
          const updatedValidation = { ...validation, collectionId: collection.id };
          this.fieldValidations.set(validation.id, updatedValidation);
        }
      }
    }
  }

  async getValidationsByCollectionAndIndex(sessionId: string, collectionName: string, recordIndex: number): Promise<FieldValidation[]> {
    const validations = Array.from(this.fieldValidations.values())
      .filter(validation => 
        validation.sessionId === sessionId && 
        validation.collectionName === collectionName && 
        validation.recordIndex === recordIndex
      );
    
    // Enhance with field names
    const enhancedValidations = await Promise.all(validations.map(async (validation) => {
      let fieldName = '';
      
      if (validation.validationType === 'schema_field') {
        const schemaField = this.projectSchemaFields.get(validation.fieldId);
        fieldName = schemaField?.fieldName || '';
      } else if (validation.validationType === 'collection_property') {
        const property = this.collectionProperties.get(validation.fieldId);
        if (property && validation.recordIndex !== null) {
          fieldName = `${collectionName}.${property.propertyName}[${validation.recordIndex}]`;
        }
      }
      
      return {
        ...validation,
        fieldName
      };
    }));
    
    return enhancedValidations;
  }

  async getCollectionByName(collectionName: string): Promise<(ObjectCollection & { properties: CollectionProperty[] }) | undefined> {
    const collection = Array.from(this.objectCollections.values()).find(c => c.collectionName === collectionName);
    if (!collection) return undefined;
    
    const properties = Array.from(this.collectionProperties.values()).filter(p => p.collectionId === collection.id);
    
    return {
      ...collection,
      properties
    };
  }

  async getSessionWithValidations(sessionId: string): Promise<ExtractionSessionWithValidation | undefined> {
    const session = this.extractionSessions.get(sessionId);
    if (!session) return undefined;

    const fieldValidations = await this.getFieldValidations(sessionId);
    return {
      ...session,
      fieldValidations
    };
  }

  async getSession(sessionId: string): Promise<ExtractionSession | undefined> {
    return this.extractionSessions.get(sessionId);
  }

  async getProjectCollections(projectId: string): Promise<ObjectCollection[]> {
    return Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === projectId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  async getExtractionSessionWithValidations(sessionId: string): Promise<ExtractionSessionWithValidation | undefined> {
    return this.getSessionWithValidations(sessionId);
  }

  // Chat Messages (MemStorage stubs)
  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.generateUUID();
    const chatMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date(),
    };
    this.chatMessages.set(id, chatMessage);
    return chatMessage;
  }

  // Excel Wizardry Functions
  async getExcelWizardryFunctions(): Promise<ExcelWizardryFunction[]> {
    return Array.from(this.excelWizardryFunctions.values())
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  async getExcelWizardryFunctionsByProject(projectId: string): Promise<ExcelWizardryFunction[]> {
    return Array.from(this.excelWizardryFunctions.values())
      .filter(func => func.projectId === projectId)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  async getExcelWizardryFunction(id: string): Promise<ExcelWizardryFunction | undefined> {
    return this.excelWizardryFunctions.get(id);
  }

  async createExcelWizardryFunction(func: InsertExcelWizardryFunction): Promise<ExcelWizardryFunction> {
    const id = this.generateUUID();
    const excelFunction: ExcelWizardryFunction = {
      ...func,
      id,
      usageCount: func.usageCount || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.excelWizardryFunctions.set(id, excelFunction);
    return excelFunction;
  }

  async updateExcelWizardryFunction(id: string, func: Partial<InsertExcelWizardryFunction>): Promise<ExcelWizardryFunction | undefined> {
    const existing = this.excelWizardryFunctions.get(id);
    if (!existing) return undefined;

    const updated: ExcelWizardryFunction = {
      ...existing,
      ...func,
      updatedAt: new Date(),
    };
    this.excelWizardryFunctions.set(id, updated);
    return updated;
  }

  async updateExcelWizardryFunctionCode(id: string, functionCode: string): Promise<ExcelWizardryFunction | undefined> {
    const existing = this.excelWizardryFunctions.get(id);
    if (!existing) return undefined;

    const updated: ExcelWizardryFunction = {
      ...existing,
      functionCode,
      updatedAt: new Date(),
    };
    this.excelWizardryFunctions.set(id, updated);
    return updated;
  }

  async incrementFunctionUsage(id: string): Promise<ExcelWizardryFunction | undefined> {
    const existing = this.excelWizardryFunctions.get(id);
    if (!existing) return undefined;

    const updated: ExcelWizardryFunction = {
      ...existing,
      usageCount: (existing.usageCount || 0) + 1,
      updatedAt: new Date(),
    };
    this.excelWizardryFunctions.set(id, updated);
    return updated;
  }

  async searchExcelWizardryFunctions(tags: string[]): Promise<ExcelWizardryFunction[]> {
    return Array.from(this.excelWizardryFunctions.values())
      .filter(func => {
        if (!func.tags || func.tags.length === 0) return false;
        return tags.some(tag => func.tags!.includes(tag));
      })
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  async deleteExcelWizardryFunction(id: string): Promise<boolean> {
    return this.excelWizardryFunctions.delete(id);
  }

  // Extraction Identifier References (MemStorage implementation)
  async getExtractionIdentifierReferences(sessionId: string, extractionNumber?: number): Promise<ExtractionIdentifierReference[]> {
    return Array.from(this.extractionIdentifierReferences.values())
      .filter(ref => {
        const matchesSession = ref.sessionId === sessionId;
        const matchesExtraction = extractionNumber === undefined || ref.extractionNumber === extractionNumber;
        return matchesSession && matchesExtraction;
      })
      .sort((a, b) => {
        // Sort by extraction number, then record index, then field name
        if (a.extractionNumber !== b.extractionNumber) {
          return a.extractionNumber - b.extractionNumber;
        }
        if (a.recordIndex !== b.recordIndex) {
          return a.recordIndex - b.recordIndex;
        }
        return a.fieldName.localeCompare(b.fieldName);
      });
  }

  async createExtractionIdentifierReferences(references: InsertExtractionIdentifierReference[]): Promise<ExtractionIdentifierReference[]> {
    const results: ExtractionIdentifierReference[] = [];
    
    for (const ref of references) {
      const id = this.generateUUID();
      const newRef: ExtractionIdentifierReference = {
        id,
        ...ref,
        createdAt: new Date(),
      };
      this.extractionIdentifierReferences.set(id, newRef);
      results.push(newRef);
    }
    
    return results;
  }

  async deleteExtractionIdentifierReferences(sessionId: string, extractionNumber: number): Promise<boolean> {
    let deletedCount = 0;
    
    for (const [id, ref] of this.extractionIdentifierReferences.entries()) {
      if (ref.sessionId === sessionId && ref.extractionNumber === extractionNumber) {
        this.extractionIdentifierReferences.delete(id);
        deletedCount++;
      }
    }
    
    return deletedCount > 0;
  }

  async getMergedIdentifierReferences(sessionId: string, upToExtractionNumber: number): Promise<Record<string, any>[]> {
    // Get all references up to the specified extraction number
    const references = Array.from(this.extractionIdentifierReferences.values())
      .filter(ref => 
        ref.sessionId === sessionId && 
        ref.extractionNumber <= upToExtractionNumber
      )
      .sort((a, b) => {
        if (a.recordIndex !== b.recordIndex) {
          return a.recordIndex - b.recordIndex;
        }
        if (a.extractionNumber !== b.extractionNumber) {
          return a.extractionNumber - b.extractionNumber;
        }
        return a.fieldName.localeCompare(b.fieldName);
      });

    // Group by record index and merge fields
    const merged: Record<number, Record<string, any>> = {};
    
    for (const ref of references) {
      if (!merged[ref.recordIndex]) {
        merged[ref.recordIndex] = {};
      }
      merged[ref.recordIndex][`${ref.fieldName}[${ref.recordIndex}]`] = ref.extractedValue;
    }

    // Convert to array format
    return Object.keys(merged)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => merged[parseInt(key)]);
  }

  // Sample Documents
  async getSampleDocuments(functionId: string): Promise<SampleDocument[]> {
    return Array.from(this.sampleDocuments.values()).filter(doc => doc.functionId === functionId);
  }

  async createSampleDocument(document: InsertSampleDocument): Promise<SampleDocument> {
    const sampleDocument: SampleDocument = {
      id: this.generateUUID(),
      ...document,
      createdAt: new Date()
    };
    this.sampleDocuments.set(sampleDocument.id, sampleDocument);
    return sampleDocument;
  }

  async updateSampleDocument(id: string, document: Partial<InsertSampleDocument>): Promise<SampleDocument | undefined> {
    const existing = this.sampleDocuments.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...document };
    this.sampleDocuments.set(id, updated);
    return updated;
  }

  async deleteSampleDocument(id: string): Promise<boolean> {
    return this.sampleDocuments.delete(id);
  }

  async deleteSampleDocumentsByParameter(functionId: string, parameterName: string): Promise<boolean> {
    let deletedCount = 0;
    for (const [id, doc] of this.sampleDocuments.entries()) {
      if (doc.functionId === functionId && doc.parameterName === parameterName) {
        this.sampleDocuments.delete(id);
        deletedCount++;
      }
    }
    return deletedCount > 0;
  }

  // Kanban Cards (placeholder implementations for MemStorage)
  async getKanbanCards(_sessionId: string, _stepId: string): Promise<KanbanCard[]> {
    return [];
  }
  async getKanbanCard(_id: string): Promise<KanbanCard | undefined> {
    return undefined;
  }
  async createKanbanCard(_card: InsertKanbanCard): Promise<KanbanCard> {
    throw new Error("Kanban not supported in MemStorage");
  }
  async updateKanbanCard(_id: string, _card: Partial<InsertKanbanCard>): Promise<KanbanCard | undefined> {
    return undefined;
  }
  async deleteKanbanCard(_id: string): Promise<boolean> {
    return false;
  }
  async reorderKanbanCards(_cards: { id: string; orderIndex: number; status?: string }[]): Promise<boolean> {
    return false;
  }

  // Kanban Checklist Items
  async getKanbanChecklistItems(_cardId: string): Promise<KanbanChecklistItem[]> {
    return [];
  }
  async createKanbanChecklistItem(_item: InsertKanbanChecklistItem): Promise<KanbanChecklistItem> {
    throw new Error("Kanban not supported in MemStorage");
  }
  async updateKanbanChecklistItem(_id: string, _item: Partial<InsertKanbanChecklistItem>): Promise<KanbanChecklistItem | undefined> {
    return undefined;
  }
  async deleteKanbanChecklistItem(_id: string): Promise<boolean> {
    return false;
  }

  // Kanban Comments
  async getKanbanComments(_cardId: string): Promise<KanbanComment[]> {
    return [];
  }
  async createKanbanComment(_comment: InsertKanbanComment): Promise<KanbanComment> {
    throw new Error("Kanban not supported in MemStorage");
  }
  async updateKanbanComment(_id: string, _comment: Partial<InsertKanbanComment>): Promise<KanbanComment | undefined> {
    return undefined;
  }
  async deleteKanbanComment(_id: string): Promise<boolean> {
    return false;
  }

  // Kanban Attachments
  async getKanbanAttachments(_cardId: string): Promise<KanbanAttachment[]> {
    return [];
  }
  async createKanbanAttachment(_attachment: InsertKanbanAttachment): Promise<KanbanAttachment> {
    throw new Error("Kanban not supported in MemStorage");
  }
  async deleteKanbanAttachment(_id: string): Promise<boolean> {
    return false;
  }

  // Session Links
  async getSessionLinks(_sessionId: string): Promise<SessionLink[]> {
    return [];
  }
  async createSessionLink(_link: InsertSessionLink): Promise<SessionLink> {
    throw new Error("Session links not supported in MemStorage");
  }
  async getSessionsByProject(_projectId: string): Promise<ExtractionSession[]> {
    return [];
  }
  
  // Processed Emails (MemStorage stubs)
  async isEmailProcessed(_projectId: string, _messageId: string): Promise<boolean> {
    return false;
  }
  async markEmailProcessed(_projectId: string, _messageId: string, _inboxId: string, _sessionId: string, _subject?: string, _fromEmail?: string, _emailBody?: string, _receivedAt?: Date): Promise<void> {
    // No-op in memory storage
  }
  async getSourceEmail(_sessionId: string): Promise<{ subject: string | null; fromEmail: string | null; emailBody: string | null; receivedAt: Date | null } | null> {
    return null;
  }
  
  // API Data Sources (MemStorage stubs)
  async getApiDataSources(_projectId: string): Promise<ApiDataSource[]> {
    return [];
  }
  async getApiDataSource(_id: string): Promise<ApiDataSource | undefined> {
    return undefined;
  }
  async createApiDataSource(_source: InsertApiDataSource): Promise<ApiDataSource> {
    throw new Error("API data sources not supported in MemStorage");
  }
  async updateApiDataSource(_id: string, _source: Partial<InsertApiDataSource>): Promise<ApiDataSource | undefined> {
    return undefined;
  }
  async deleteApiDataSource(_id: string): Promise<boolean> {
    return false;
  }

  // Password Reset Tokens (not supported in MemStorage)
  async createPasswordResetToken(_userId: string, _tokenHash: string, _expiresAt: Date): Promise<void> {}
  async getPasswordResetToken(_tokenHash: string): Promise<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null } | undefined> {
    return undefined;
  }
  async markPasswordResetTokenUsed(_tokenHash: string): Promise<void> {}
  async invalidatePasswordResetTokensForUser(_userId: string): Promise<void> {}
}

// PostgreSQL Storage Implementation
class PostgreSQLStorage implements IStorage {
  private db: any;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL storage');
    }
    const sql = neon(process.env.DATABASE_URL, {
      connectionTimeoutMillis: 5000,
      arrayMode: false,
      fullResults: false,
    });
    this.db = drizzle(sql);
  }

  // Helper method to retry database operations
  private async retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3, delay: number = 1000): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a connection error
        const isConnectionError = error?.message?.includes?.('Too many connections') || 
                                 error?.message?.includes?.('connection') ||
                                 error?.code === 'ECONNRESET' ||
                                 error?.code === 'ENOTFOUND';
        
        if (isConnectionError && attempt < maxRetries) {
          console.log(`Database connection attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt)); // Exponential backoff
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  // Organizations
  async getOrganizations(): Promise<(Organization & { userCount: number })[]> {
    return this.retryOperation(async () => {
      const result = await this.db
        .select({
          id: organizations.id,
          name: organizations.name,
          description: organizations.description,
          type: organizations.type,
          subdomain: organizations.subdomain,
          createdAt: organizations.createdAt,
          userCount: count(users.id)
        })
        .from(organizations)
        .leftJoin(users, eq(organizations.id, users.organizationId))
        .groupBy(organizations.id, organizations.name, organizations.description, organizations.type, organizations.subdomain, organizations.createdAt);
      
      return result;
    });
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    
    return result[0];
  }

  async getOrganizationBySubdomain(subdomain: string): Promise<Organization | undefined> {
    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.subdomain, subdomain))
      .limit(1);
    
    return result[0];
  }

  async getPrimaryOrganization(): Promise<Organization | undefined> {
    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.type, 'primary'))
      .limit(1);
    
    return result[0];
  }

  async getOrganizationWithUsers(id: string): Promise<OrganizationWithUsers | undefined> {
    const org = await this.getOrganization(id);
    if (!org) return undefined;

    const orgUsers = await this.getUsers(id);
    return {
      ...org,
      users: orgUsers
    };
  }

  async createOrganization(organization: InsertOrganization): Promise<Organization> {
    const result = await this.db
      .insert(organizations)
      .values(organization)
      .returning();
    
    return result[0];
  }

  async updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const result = await this.db
      .update(organizations)
      .set(organization)
      .where(eq(organizations.id, id))
      .returning();
    
    return result[0];
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const result = await this.db
      .delete(organizations)
      .where(eq(organizations.id, id));
    
    return result.rowCount > 0;
  }

  // Users
  async getUsers(organizationId: string): Promise<User[]> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));
    
    return result;
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return result[0];
  }

  async getUserWithOrganization(id: string): Promise<UserWithOrganization | undefined> {
    const result = await this.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        organizationId: users.organizationId,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        isTemporaryPassword: users.isTemporaryPassword,
        projectOrder: users.projectOrder,
        organization: {
          id: organizations.id,
          name: organizations.name,
          description: organizations.description,
          type: organizations.type,
          createdAt: organizations.createdAt
        }
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, id))
      .limit(1);
    
    return result[0];
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(userData.password, 10);
    
    const { password, ...userDataWithoutPassword } = userData;
    const result = await this.db
      .insert(users)
      .values({ ...userDataWithoutPassword, passwordHash })
      .returning();
    
    return result[0];
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id));
    
    return result.rowCount > 0;
  }

  async resetUserPassword(userId: string, tempPassword: string): Promise<{ tempPassword: string }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.db
      .update(users)
      .set({ 
        passwordHash, 
        isTemporaryPassword: true 
      })
      .where(eq(users.id, userId));

    return { tempPassword };
  }

  async updateUserPassword(userId: string, newPasswordHash: string, isTemporary: boolean = false): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ 
        passwordHash: newPasswordHash, 
        isTemporaryPassword: isTemporary 
      })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async updateUserProjectOrder(userId: string, projectOrder: string[]): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ projectOrder })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  // Multi-organization membership methods
  async getOrganizationMembers(organizationId: string): Promise<(User & { orgRole: string })[]> {
    const result = await this.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        organizationId: users.organizationId,
        role: users.role,
        isActive: users.isActive,
        isTemporaryPassword: users.isTemporaryPassword,
        projectOrder: users.projectOrder,
        createdAt: users.createdAt,
        orgRole: userOrganizations.role,
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId));
    
    return result;
  }

  async addUserToOrganization(userId: string, organizationId: string, role: string = 'user'): Promise<boolean> {
    try {
      await this.db
        .insert(userOrganizations)
        .values({ userId, organizationId, role })
        .onConflictDoNothing();
      return true;
    } catch (error) {
      console.error('Error adding user to organization:', error);
      return false;
    }
  }

  async removeUserFromOrganization(userId: string, organizationId: string): Promise<boolean> {
    const result = await this.db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  async getUserOrganizations(userId: string): Promise<{ organizationId: string; organizationName: string; role: string }[]> {
    const result = await this.db
      .select({
        organizationId: userOrganizations.organizationId,
        organizationName: organizations.name,
        role: userOrganizations.role,
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, userId));
    
    return result;
  }

  // Get projects with strict tenant isolation - only returns projects belonging to the organization
  async getProjects(organizationId?: string, userRole?: string): Promise<Project[]> {
    return this.retryOperation(async () => {
      let projectsList;
      
      if (organizationId) {
        // Strict tenant isolation: only show projects owned by this organization
        // Even System Admin only sees their own org's projects on the dashboard
        projectsList = await this.db
          .select({
            id: projects.id,
            name: projects.name,
            description: projects.description,
            organizationId: projects.organizationId,
            createdBy: projects.createdBy,
            mainObjectName: projects.mainObjectName,
            status: projects.status,
            isInitialSetupComplete: projects.isInitialSetupComplete,
            createdAt: projects.createdAt,
            creatorName: users.name,
            creatorOrganizationName: organizations.name
          })
          .from(projects)
          .leftJoin(users, eq(projects.createdBy, users.id))
          .leftJoin(organizations, eq(users.organizationId, organizations.id))
          .where(eq(projects.organizationId, organizationId))
          .orderBy(sql`${projects.createdAt} DESC`);
      } else {
        // No organization filter - return all (for system-level operations)
        projectsList = await this.db
          .select({
            id: projects.id,
            name: projects.name,
            description: projects.description,
            organizationId: projects.organizationId,
            createdBy: projects.createdBy,
            mainObjectName: projects.mainObjectName,
            status: projects.status,
            isInitialSetupComplete: projects.isInitialSetupComplete,
            createdAt: projects.createdAt,
            creatorName: users.name,
            creatorOrganizationName: organizations.name
          })
          .from(projects)
          .leftJoin(users, eq(projects.createdBy, users.id))
          .leftJoin(organizations, eq(users.organizationId, organizations.id))
          .orderBy(sql`${projects.createdAt} DESC`);
      }
      
      return projectsList;
    });
  }

  async getProject(id: string, organizationId?: string): Promise<Project | undefined> {
    let result;
    if (organizationId) {
      // Strict tenant isolation: only return project if it belongs to the organization
      result = await this.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, id),
            eq(projects.organizationId, organizationId)
          )
        )
        .limit(1);
    } else {
      result = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
    }
    return result[0];
  }

  async getProjectByInboxId(inboxId: string): Promise<Project | undefined> {
    const result = await this.db
      .select()
      .from(projects)
      .where(eq(projects.inboxId, inboxId))
      .limit(1);
    return result[0];
  }

  async getProjectWithDetails(id: string, organizationId?: string): Promise<ProjectWithDetails | undefined> {
    const project = await this.getProject(id, organizationId);
    if (!project) return undefined;

    // Fetch related data in parallel
    const [schemaFields, collections, workflowSteps, sessions, knowledgeDocuments, extractionRules] = await Promise.all([
      this.getProjectSchemaFields(id),
      this.getObjectCollections(id),
      this.getWorkflowSteps(id),
      this.getExtractionSessions(id),
      this.getKnowledgeDocuments(id),
      this.getExtractionRules(id)
    ]);

    // Add values to each workflow step
    const workflowStepsWithValues = await Promise.all(
      workflowSteps.map(async (step) => {
        const values = await this.getStepValues(step.id);
        return { ...step, values };
      })
    );

    return {
      ...project,
      schemaFields,
      collections,
      workflowSteps: workflowStepsWithValues,
      sessions,
      knowledgeDocuments,
      extractionRules
    };
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await this.db
      .insert(projects)
      .values(project)
      .returning();
    return result[0];
  }

  async updateProject(id: string, project: Partial<InsertProject>, organizationId?: string): Promise<Project | undefined> {
    let result;
    if (organizationId) {
      result = await this.db
        .update(projects)
        .set(project)
        .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
        .returning();
    } else {
      result = await this.db
        .update(projects)
        .set(project)
        .where(eq(projects.id, id))
        .returning();
    }
    return result[0];
  }

  async deleteProject(id: string, organizationId?: string): Promise<boolean> {
    let result;
    if (organizationId) {
      result = await this.db
        .delete(projects)
        .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));
    } else {
      result = await this.db
        .delete(projects)
        .where(eq(projects.id, id));
    }
    return result.rowCount > 0;
  }

  async duplicateProject(id: string, newName: string, userId: string, organizationId?: string): Promise<Project | undefined> {
    // First, get the original project
    const originalProject = await this.getProject(id, organizationId);
    if (!originalProject) return undefined;

    // Generate new UUID for the duplicated project
    const { v4: uuidv4 } = await import('uuid');
    const newProjectId = uuidv4();

    // Create new project with the same data but different name and ID
    const duplicatedProject: InsertProject = {
      id: newProjectId,
      name: newName,
      description: originalProject.description,
      mainObjectName: originalProject.mainObjectName,
      organizationId: originalProject.organizationId,
      createdBy: userId, // Add the missing createdBy field
      isInitialSetupComplete: originalProject.isInitialSetupComplete,
    };

    const createdProject = await this.createProject(duplicatedProject);

    // Duplicate schema fields
    const originalSchemaFields = await this.getProjectSchemaFields(id);
    for (const field of originalSchemaFields) {
      const duplicatedField: InsertProjectSchemaField = {
        id: uuidv4(),
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        description: field.description,
        autoVerificationConfidence: field.autoVerificationConfidence,
        orderIndex: field.orderIndex,
        projectId: newProjectId,
      };
      await this.createProjectSchemaField(duplicatedField);
    }

    // Duplicate collections and their properties
    const originalCollections = await this.getObjectCollections(id);
    for (const collection of originalCollections) {
      const newCollectionId = uuidv4();
      const duplicatedCollection: InsertObjectCollection = {
        id: newCollectionId,
        collectionName: collection.collectionName,
        description: collection.description,
        projectId: newProjectId,
        orderIndex: collection.orderIndex,
      };
      await this.createObjectCollection(duplicatedCollection);

      // Duplicate collection properties
      for (const property of collection.properties) {
        const duplicatedProperty: InsertCollectionProperty = {
          id: uuidv4(),
          propertyName: property.propertyName,
          propertyType: property.propertyType,
          description: property.description,
          autoVerificationConfidence: property.autoVerificationConfidence,
          orderIndex: property.orderIndex,
          collectionId: newCollectionId,
        };
        await this.createCollectionProperty(duplicatedProperty);
      }
    }

    // Duplicate extraction rules
    const originalRules = await this.getExtractionRules(id);
    for (const rule of originalRules) {
      const duplicatedRule: InsertExtractionRule = {
        id: uuidv4(),
        projectId: newProjectId,
        ruleName: rule.ruleName,
        targetField: rule.targetField,
        ruleContent: rule.ruleContent,
        isActive: rule.isActive,
      };
      await this.createExtractionRule(duplicatedRule);
    }

    // Duplicate knowledge documents (but not sessions or validations)
    const originalKnowledgeDocs = await this.getKnowledgeDocuments(id);
    for (const doc of originalKnowledgeDocs) {
      const duplicatedDoc: InsertKnowledgeDocument = {
        id: uuidv4(),
        projectId: newProjectId,
        fileName: doc.fileName,
        displayName: doc.displayName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        content: doc.content,  // Include content for conflict detection
        description: doc.description,
        targetField: doc.targetField,  // Include target field
      };
      await this.createKnowledgeDocument(duplicatedDoc);
    }

    // Duplicate Excel Wizardry Functions (AI Tools)
    const originalTools = await this.getExcelWizardryFunctionsByProject(id);
    const toolMapping = new Map<string, string>(); // Map old tool IDs to new tool IDs
    for (const tool of originalTools) {
      const newToolId = uuidv4();
      toolMapping.set(tool.id, newToolId); // Store mapping for step values
      
      const duplicatedTool: InsertExcelWizardryFunction = {
        id: newToolId,
        projectId: newProjectId,
        name: tool.name,
        description: tool.description,
        functionCode: tool.functionCode,
        aiPrompt: tool.aiPrompt,
        toolType: tool.toolType,
        outputType: tool.outputType,
        operationType: tool.operationType,
        inputParameters: tool.inputParameters,
        aiAssistanceRequired: tool.aiAssistanceRequired,
        aiAssistancePrompt: tool.aiAssistancePrompt,
        llmModel: tool.llmModel,
        metadata: tool.metadata,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        tags: tool.tags,
      };
      await this.createExcelWizardryFunction(duplicatedTool);
    }

    // Duplicate Workflow Steps and Values
    const originalSteps = await this.getWorkflowSteps(id);
    for (const step of originalSteps) {
      const newStepId = uuidv4();
      
      // Get original step values for this step
      const originalValues = await this.getStepValues(step.id);
      
      // For list steps, we need to handle the identifier value
      let newIdentifierId: string | undefined;
      if (step.stepType === 'list' && originalValues.length > 0) {
        // Find the identifier value in the original
        const identifierValue = originalValues.find(v => v.isIdentifier);
        if (identifierValue) {
          newIdentifierId = uuidv4(); // We'll assign this when creating the value
        }
      }
      
      // Create the duplicated step
      const duplicatedStep: InsertWorkflowStep = {
        id: newStepId,
        projectId: newProjectId,
        stepName: step.stepName,
        stepType: step.stepType,
        description: step.description,
        orderIndex: step.orderIndex,
        valueCount: step.valueCount,
        identifierId: newIdentifierId, // Will be set if this is a list step
      };
      await this.createWorkflowStep(duplicatedStep);
      
      // Duplicate step values
      for (const value of originalValues) {
        const newValueId = value.isIdentifier && newIdentifierId ? newIdentifierId : uuidv4();
        
        const duplicatedValue: InsertStepValue = {
          id: newValueId,
          stepId: newStepId,
          valueName: value.valueName,
          dataType: value.dataType,
          description: value.description,
          isIdentifier: value.isIdentifier,
          orderIndex: value.orderIndex,
          // Map the tool ID to the new tool if it exists
          toolId: value.toolId && toolMapping.has(value.toolId) ? toolMapping.get(value.toolId) : value.toolId,
          inputValues: value.inputValues, // Preserve input configurations
          fields: value.fields, // Preserve multi-field configuration for Info Pages
          autoVerificationConfidence: value.autoVerificationConfidence,
          choiceOptions: value.choiceOptions,
        };
        await this.createStepValue(duplicatedValue);
      }
    }

    // Note: We don't duplicate sessions or validations as these are instance-specific data

    return createdProject;
  }

  // Project Schema Fields
  async getProjectSchemaFields(projectId: string): Promise<ProjectSchemaField[]> {
    const result = await this.db
      .select()
      .from(projectSchemaFields)
      .where(eq(projectSchemaFields.projectId, projectId))
      .orderBy(projectSchemaFields.orderIndex);
    return result;
  }
  async createProjectSchemaField(field: InsertProjectSchemaField): Promise<ProjectSchemaField> { 
    const result = await this.db.insert(projectSchemaFields).values(field).returning();
    return result[0];
  }
  async updateProjectSchemaField(id: string, field: Partial<InsertProjectSchemaField>): Promise<ProjectSchemaField | undefined> {
    const result = await this.db
      .update(projectSchemaFields)
      .set(field)
      .where(eq(projectSchemaFields.id, id))
      .returning();
    return result[0];
  }

  async deleteProjectSchemaField(id: string): Promise<boolean> {
    const result = await this.db
      .delete(projectSchemaFields)
      .where(eq(projectSchemaFields.id, id));
    return result.rowCount > 0;
  }

  // Object Collections
  async getObjectCollections(projectId: string): Promise<(ObjectCollection & { properties: CollectionProperty[] })[]> {
    const collections = await this.db
      .select()
      .from(objectCollections)
      .where(eq(objectCollections.projectId, projectId))
      .orderBy(objectCollections.orderIndex);

    // Fetch properties for each collection
    const collectionsWithProperties = await Promise.all(
      collections.map(async (collection) => {
        const properties = await this.getCollectionProperties(collection.id);
        return {
          ...collection,
          properties
        };
      })
    );

    return collectionsWithProperties;
  }

  async getAllCollectionsForReferences(organizationId: string): Promise<(ObjectCollection & { properties: CollectionProperty[], projectName: string })[]> {
    return this.retryOperation(async () => {
      // Get ALL projects from ALL organizations for cross-project referencing
      const projectsResult = await this.db
        .select({
          id: projects.id,
          name: projects.name
        })
        .from(projects);

      console.log(`📝 Found ${projectsResult.length} projects in database`);

      const allCollections: (ObjectCollection & { properties: CollectionProperty[], projectName: string })[] = [];

      // Get collections for each project
      for (const project of projectsResult) {
        const collections = await this.db
          .select()
          .from(objectCollections)
          .where(eq(objectCollections.projectId, project.id))
          .orderBy(objectCollections.orderIndex);

        console.log(`📝 Project "${project.name}" has ${collections.length} collections`);

        // Fetch properties for each collection
        for (const collection of collections) {
          const properties = await this.getCollectionProperties(collection.id);
          console.log(`📝 Collection "${collection.collectionName}" has ${properties.length} properties`);
          allCollections.push({
            ...collection,
            projectName: project.name,
            properties
          });
        }
      }

      // Sort by project name, then collection name
      return allCollections.sort((a, b) => {
        const projectComparison = a.projectName.localeCompare(b.projectName);
        if (projectComparison !== 0) return projectComparison;
        return a.collectionName.localeCompare(b.collectionName);
      });
    });
  }

  async getObjectCollection(id: string): Promise<ObjectCollection | undefined> {
    const result = await this.db
      .select()
      .from(objectCollections)
      .where(eq(objectCollections.id, id))
      .limit(1);
    return result[0];
  }
  async createObjectCollection(collection: InsertObjectCollection): Promise<ObjectCollection> { 
    const result = await this.db.insert(objectCollections).values(collection).returning();
    return result[0];
  }
  async updateObjectCollection(id: string, collection: Partial<InsertObjectCollection>): Promise<ObjectCollection | undefined> {
    const result = await this.db
      .update(objectCollections)
      .set(collection)
      .where(eq(objectCollections.id, id))
      .returning();
    return result[0];
  }

  async deleteObjectCollection(id: string): Promise<boolean> {
    const result = await this.db
      .delete(objectCollections)
      .where(eq(objectCollections.id, id));
    return result.rowCount > 0;
  }

  // Collection Properties
  async getCollectionProperties(collectionId: string): Promise<CollectionProperty[]> {
    const result = await this.db
      .select()
      .from(collectionProperties)
      .where(eq(collectionProperties.collectionId, collectionId))
      .orderBy(collectionProperties.orderIndex);
    return result;
  }

  async getCollectionPropertyById(id: string): Promise<CollectionProperty | undefined> {
    const result = await this.db
      .select()
      .from(collectionProperties)
      .where(eq(collectionProperties.id, id))
      .limit(1);
    return result[0];
  }
  async createCollectionProperty(property: InsertCollectionProperty): Promise<CollectionProperty> { 
    const result = await this.db.insert(collectionProperties).values(property).returning();
    return result[0];
  }
  async updateCollectionProperty(id: string, property: Partial<InsertCollectionProperty>): Promise<CollectionProperty | undefined> {
    const result = await this.db
      .update(collectionProperties)
      .set(property)
      .where(eq(collectionProperties.id, id))
      .returning();
    return result[0];
  }

  async deleteCollectionProperty(id: string): Promise<boolean> {
    const result = await this.db
      .delete(collectionProperties)
      .where(eq(collectionProperties.id, id));
    return result.rowCount > 0;
  }

  async setCollectionIdentifierField(collectionId: string, propertyId: string): Promise<boolean> {
    // First, remove identifier flag from all other properties in this collection
    await this.db
      .update(collectionProperties)
      .set({ isIdentifier: false })
      .where(eq(collectionProperties.collectionId, collectionId));
    
    // Set the new identifier property
    await this.db
      .update(collectionProperties)
      .set({ isIdentifier: true })
      .where(eq(collectionProperties.id, propertyId));
    
    // Update the collection's identifier field reference
    await this.db
      .update(objectCollections)
      .set({ identifierFieldId: propertyId })
      .where(eq(objectCollections.id, collectionId));
    
    return true;
  }

  async getCollectionIdentifierField(collectionId: string): Promise<CollectionProperty | undefined> {
    const result = await this.db
      .select()
      .from(collectionProperties)
      .where(and(
        eq(collectionProperties.collectionId, collectionId),
        eq(collectionProperties.isIdentifier, true)
      ));
    return result[0];
  }

  // Overview Sessions
  async getExtractionSessions(projectId: number): Promise<ExtractionSession[]> {
    const result = await this.db
      .select()
      .from(extractionSessions)
      .where(eq(extractionSessions.projectId, projectId))
      .orderBy(extractionSessions.createdAt);
    return result;
  }

  async getExtractionSession(id: string): Promise<ExtractionSession | undefined> {
    const result = await this.db
      .select()
      .from(extractionSessions)
      .where(eq(extractionSessions.id, id))
      .limit(1);
    return result[0];
  }
  async createExtractionSession(session: InsertExtractionSession): Promise<ExtractionSession> { 
    const result = await this.db.insert(extractionSessions).values(session).returning();
    return result[0];
  }
  async updateExtractionSession(id: string, session: Partial<InsertExtractionSession>): Promise<ExtractionSession | undefined> {
    const result = await this.db
      .update(extractionSessions)
      .set(session)
      .where(eq(extractionSessions.id, id))
      .returning();
    return result[0];
  }

  async createWorkflowStatusHistory(entry: InsertWorkflowStatusHistory): Promise<WorkflowStatusHistory> {
    const result = await this.db
      .insert(workflowStatusHistory)
      .values(entry)
      .returning();
    return result[0];
  }

  async getWorkflowStatusHistory(projectId: string): Promise<WorkflowStatusHistory[]> {
    const result = await this.db
      .select()
      .from(workflowStatusHistory)
      .where(eq(workflowStatusHistory.projectId, projectId))
      .orderBy(workflowStatusHistory.changedAt);
    return result;
  }

  // Knowledge Documents
  async getKnowledgeDocuments(projectId: string): Promise<KnowledgeDocument[]> {
    const result = await this.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.projectId, projectId))
      .orderBy(knowledgeDocuments.uploadedAt);
    return result;
  }

  async getKnowledgeDocument(id: string): Promise<KnowledgeDocument | undefined> {
    const result = await this.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id))
      .limit(1);
    return result[0];
  }
  async createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument> { 
    const result = await this.db.insert(knowledgeDocuments).values(document).returning();
    return result[0];
  }
  async updateKnowledgeDocument(id: string, document: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const result = await this.db
      .update(knowledgeDocuments)
      .set(document)
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    return result[0];
  }

  async deleteKnowledgeDocument(id: string): Promise<boolean> {
    const result = await this.db
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id));
    return result.rowCount > 0;
  }

  // Extraction Rules
  async getExtractionRules(projectId: string): Promise<ExtractionRule[]> {
    const result = await this.db
      .select()
      .from(extractionRules)
      .where(eq(extractionRules.projectId, projectId))
      .orderBy(extractionRules.createdAt);
    return result;
  }
  async createExtractionRule(rule: InsertExtractionRule): Promise<ExtractionRule> { 
    const result = await this.db.insert(extractionRules).values(rule).returning();
    return result[0];
  }
  async updateExtractionRule(id: string, rule: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined> {
    const result = await this.db
      .update(extractionRules)
      .set(rule)
      .where(eq(extractionRules.id, id))
      .returning();
    return result[0];
  }

  async deleteExtractionRule(id: string): Promise<boolean> {
    const result = await this.db
      .delete(extractionRules)
      .where(eq(extractionRules.id, id));
    return result.rowCount > 0;
  }
  async getFieldValidations(sessionId: string): Promise<FieldValidation[]> { 
    const result = await this.db.select().from(fieldValidations).where(eq(fieldValidations.sessionId, sessionId));
    
    // Get all unique field IDs and value IDs for batch processing
    const schemaFieldIds = [...new Set(result.filter(v => v.validationType === 'schema_field').map(v => v.fieldId))];
    const collectionPropertyIds = [...new Set(result.filter(v => v.validationType === 'collection_property').map(v => v.fieldId))];
    const valueIds = [...new Set(result.filter(v => v.valueId).map(v => v.valueId).filter(Boolean))];
    
    // Batch fetch schema field names
    const schemaFieldsMap = new Map<string, string>();
    if (schemaFieldIds.length > 0) {
      const schemaFields = await this.db
        .select({ id: projectSchemaFields.id, fieldName: projectSchemaFields.fieldName })
        .from(projectSchemaFields)
        .where(inArray(projectSchemaFields.id, schemaFieldIds));
      
      schemaFields.forEach(field => {
        schemaFieldsMap.set(field.id, field.fieldName);
      });
    }
    
    // Batch fetch collection property names with collection names
    const collectionPropertiesMap = new Map<string, { propertyName: string, collectionName: string }>();
    
    // First get value names from step_values for workflow-based validations
    const stepValuesMap = new Map<string, { valueName: string, stepName: string }>();
    if (valueIds.length > 0) {
      const stepValueResults = await this.db
        .select({
          id: stepValues.id,
          valueName: stepValues.valueName,
          stepName: workflowSteps.stepName
        })
        .from(stepValues)
        .innerJoin(workflowSteps, eq(stepValues.stepId, workflowSteps.id))
        .where(inArray(stepValues.id, valueIds as string[]));
      
      stepValueResults.forEach(value => {
        stepValuesMap.set(value.id, {
          valueName: value.valueName,
          stepName: value.stepName
        });
      });
    }
    
    if (collectionPropertyIds.length > 0) {
      // First try to get from step_values (workflow values) using field IDs
      const stepValueResults = await this.db
        .select({
          id: stepValues.id,
          valueName: stepValues.valueName,
          stepName: workflowSteps.stepName
        })
        .from(stepValues)
        .innerJoin(workflowSteps, eq(stepValues.stepId, workflowSteps.id))
        .where(inArray(stepValues.id, collectionPropertyIds));
      
      stepValueResults.forEach(value => {
        collectionPropertiesMap.set(value.id, {
          propertyName: value.valueName,
          collectionName: value.stepName
        });
      });
      
      // For any IDs not found in step_values, fall back to collection properties
      const remainingIds = collectionPropertyIds.filter(id => !collectionPropertiesMap.has(id));
      if (remainingIds.length > 0) {
        const propertiesWithCollections = await this.db
          .select({ 
            id: collectionProperties.id,
            propertyName: collectionProperties.propertyName,
            collectionName: objectCollections.collectionName 
          })
          .from(collectionProperties)
          .innerJoin(objectCollections, eq(collectionProperties.collectionId, objectCollections.id))
          .where(inArray(collectionProperties.id, remainingIds));
        
        propertiesWithCollections.forEach(prop => {
          collectionPropertiesMap.set(prop.id, { 
            propertyName: prop.propertyName, 
            collectionName: prop.collectionName 
          });
        });
      }
    }
    
    // Enhance results with field names using the cached data
    const enhancedValidations = result.map(validation => {
      let fieldName = '';
      
      // First check if this validation has a value_id (workflow step value)
      if (validation.valueId) {
        const valueInfo = stepValuesMap.get(validation.valueId);
        if (valueInfo && validation.recordIndex !== null) {
          fieldName = `${valueInfo.stepName}.${valueInfo.valueName}[${validation.recordIndex}]`;
        }
      } else if (validation.validationType === 'schema_field') {
        fieldName = schemaFieldsMap.get(validation.fieldId) || '';
      } else if (validation.validationType === 'collection_property') {
        const propInfo = collectionPropertiesMap.get(validation.fieldId);
        if (propInfo && validation.recordIndex !== null) {
          fieldName = `${propInfo.collectionName}.${propInfo.propertyName}[${validation.recordIndex}]`;
        }
      }
      
      return {
        ...validation,
        fieldName
      };
    });
    
    return enhancedValidations;
  }

  async getFieldValidation(id: string): Promise<FieldValidation | undefined> { 
    const result = await this.db.select().from(fieldValidations).where(eq(fieldValidations.id, id));
    return result[0];
  }

  async createFieldValidation(validation: InsertFieldValidation): Promise<FieldValidation> { 
    const result = await this.db.insert(fieldValidations).values(validation).returning();
    const createdValidation = result[0];

    // Check if this is an identifier field - if so, auto-create row
    if (validation.valueId && validation.identifierId) {
      const stepValue = await this.getStepValueById(validation.valueId);
      if (stepValue?.isIdentifier) {
        await this.createCompleteRowForIdentifier(validation.sessionId!, validation.stepId!, validation.identifierId);
      }
    }

    return createdValidation;
  }

  private async createCompleteRowForIdentifier(sessionId: string, stepId: string, identifierId: string): Promise<void> {
    try {
      console.log(`🏗️ Creating complete row for identifier ${identifierId} in step ${stepId}`);
      
      // Get all step values for this step
      const allStepValues = await this.db
        .select()
        .from(stepValues)
        .where(eq(stepValues.stepId, stepId))
        .orderBy(stepValues.orderIndex);

      if (allStepValues.length === 0) {
        console.log(`No step values found for step ${stepId}`);
        return;
      }

      // Create field validations for all columns in this row
      for (const stepValue of allStepValues) {
        // Check if field validation already exists
        const existingValidations = await this.db
          .select()
          .from(fieldValidations)
          .where(
            and(
              eq(fieldValidations.sessionId, sessionId),
              eq(fieldValidations.stepId, stepId),
              eq(fieldValidations.valueId, stepValue.id),
              eq(fieldValidations.identifierId, identifierId)
            )
          );

        if (existingValidations.length === 0) {
          console.log(`Creating field validation for ${stepValue.valueName} in row ${identifierId}`);
          
          const fieldValidationData: InsertFieldValidation = {
            sessionId,
            stepId,
            valueId: stepValue.id,
            identifierId,
            validationType: 'step_value', // New type for step-based validations
            dataType: stepValue.dataType,
            fieldId: stepValue.id, // Use stepValue.id as fieldId for consistency
            extractedValue: null,
            validationStatus: 'pending' as const,
            aiReasoning: null,
            manuallyVerified: false,
            manuallyUpdated: false,
            confidenceScore: 0
          };

          await this.db.insert(fieldValidations).values(fieldValidationData);
          console.log(`✅ Created field validation for ${stepValue.valueName}`);
        } else {
          console.log(`Field validation already exists for ${stepValue.valueName} in row ${identifierId}`);
        }
      }
    } catch (error) {
      console.error(`Error creating complete row for identifier ${identifierId}:`, error);
    }
  }
  async updateFieldValidation(id: string, validation: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined> { 
    const result = await this.db.update(fieldValidations).set(validation).where(eq(fieldValidations.id, id)).returning();
    return result[0];
  }
  async deleteFieldValidation(id: string): Promise<boolean> { 
    const result = await this.db.delete(fieldValidations).where(eq(fieldValidations.id, id));
    return result.rowCount > 0;
  }
  async getSessionWithValidations(sessionId: string): Promise<ExtractionSessionWithValidation | undefined> { 
    const session = await this.getExtractionSession(sessionId);
    if (!session) return undefined;
    
    const validations = await this.getFieldValidations(sessionId);
    return {
      ...session,
      fieldValidations: validations
    };
  }

  async getValidationsByCollectionAndIndex(sessionId: string, collectionId: string, recordIndex: number): Promise<FieldValidation[]> {
    const result = await this.db
      .select()
      .from(fieldValidations)
      .where(
        and(
          eq(fieldValidations.sessionId, sessionId),
          eq(fieldValidations.collectionId, collectionId),
          eq(fieldValidations.recordIndex, recordIndex)
        )
      );
    
    // Get all unique field IDs for batch processing
    const schemaFieldIds = [...new Set(result.filter(v => v.validationType === 'schema_field').map(v => v.fieldId))];
    const collectionPropertyIds = [...new Set(result.filter(v => v.validationType === 'collection_property').map(v => v.fieldId))];
    
    // Batch fetch schema field names
    const schemaFieldsMap = new Map<string, string>();
    if (schemaFieldIds.length > 0) {
      const schemaFields = await this.db
        .select({ id: projectSchemaFields.id, fieldName: projectSchemaFields.fieldName })
        .from(projectSchemaFields)
        .where(inArray(projectSchemaFields.id, schemaFieldIds));
      
      schemaFields.forEach(field => {
        schemaFieldsMap.set(field.id, field.fieldName);
      });
    }
    
    // Batch fetch collection property names with collection names
    const collectionPropertiesMap = new Map<string, { propertyName: string, collectionName: string }>();
    if (collectionPropertyIds.length > 0) {
      const propertiesWithCollections = await this.db
        .select({ 
          id: collectionProperties.id,
          propertyName: collectionProperties.propertyName,
          collectionName: objectCollections.collectionName 
        })
        .from(collectionProperties)
        .innerJoin(objectCollections, eq(collectionProperties.collectionId, objectCollections.id))
        .where(inArray(collectionProperties.id, collectionPropertyIds));
      
      propertiesWithCollections.forEach(prop => {
        collectionPropertiesMap.set(prop.id, { 
          propertyName: prop.propertyName, 
          collectionName: prop.collectionName 
        });
      });
    }
    
    // Enhance results with field names using the cached data
    const enhancedValidations = result.map(validation => {
      let fieldName = '';
      
      if (validation.validationType === 'schema_field') {
        fieldName = schemaFieldsMap.get(validation.fieldId) || '';
      } else if (validation.validationType === 'collection_property') {
        const propInfo = collectionPropertiesMap.get(validation.fieldId);
        if (propInfo && validation.recordIndex !== null) {
          fieldName = `${propInfo.collectionName}.${propInfo.propertyName}[${validation.recordIndex}]`;
        }
      }
      
      return {
        ...validation,
        fieldName
      };
    });
    
    return enhancedValidations;
  }

  async getCollectionByName(collectionName: string): Promise<(ObjectCollection & { properties: CollectionProperty[] }) | undefined> {
    const collectionResult = await this.db
      .select()
      .from(objectCollections)
      .where(eq(objectCollections.collectionName, collectionName))
      .limit(1);
    
    if (collectionResult.length === 0) return undefined;
    
    const collection = collectionResult[0];
    
    const properties = await this.db
      .select()
      .from(collectionProperties)
      .where(eq(collectionProperties.collectionId, collection.id));
    
    return {
      ...collection,
      properties
    };
  }

  // New method to get validations by field_id and collection_id combination
  async getValidationsByFieldAndCollection(sessionId: string, fieldId: string, collectionId: string, recordIndex: number): Promise<FieldValidation[]> {
    const result = await this.db
      .select()
      .from(fieldValidations)
      .where(
        and(
          eq(fieldValidations.sessionId, sessionId),
          eq(fieldValidations.fieldId, fieldId),
          eq(fieldValidations.collectionId, collectionId),
          eq(fieldValidations.recordIndex, recordIndex)
        )
      );
    
    // Get field and collection info for enhancing the results
    const [propertyResult, collectionResult] = await Promise.all([
      this.db
        .select({ id: collectionProperties.id, propertyName: collectionProperties.propertyName })
        .from(collectionProperties)
        .where(eq(collectionProperties.id, fieldId)),
      this.db
        .select({ id: objectCollections.id, collectionName: objectCollections.collectionName })
        .from(objectCollections)
        .where(eq(objectCollections.id, collectionId))
    ]);
    
    const property = propertyResult[0];
    const collection = collectionResult[0];
    
    // Enhance results with field names
    const enhancedValidations = result.map(validation => {
      let fieldName = '';
      if (property && collection && validation.recordIndex !== null) {
        fieldName = `${collection.collectionName}.${property.propertyName}[${validation.recordIndex}]`;
      }
      
      return {
        ...validation,
        fieldName
      };
    });
    
    return enhancedValidations;
  }
  
  // Get all validations for a step (for incremental data building)
  async getValidationsByStep(stepId: string, sessionId?: string): Promise<FieldValidation[]> {
    // First get all values for this step
    const stepValuesList = await this.db
      .select()
      .from(stepValues)
      .where(eq(stepValues.stepId, stepId));
    
    if (stepValuesList.length === 0) {
      return [];
    }
    
    // Get all validations that match these value IDs
    const valueIds = stepValuesList.map(v => v.id);
    
    // Build where conditions - always filter by valueIds, optionally by sessionId
    const conditions = [inArray(fieldValidations.fieldId, valueIds)];
    if (sessionId) {
      conditions.push(eq(fieldValidations.sessionId, sessionId));
    }
    
    const result = await this.db
      .select()
      .from(fieldValidations)
      .where(and(...conditions));
    
    return result;
  }

  // Method to populate missing collectionId values for existing validations
  async populateMissingCollectionIds(): Promise<void> {
    const validationsNeedingUpdate = await this.db
      .select()
      .from(fieldValidations)
      .where(
        and(
          eq(fieldValidations.validationType, 'collection_property'),
          isNull(fieldValidations.collectionId),
          isNotNull(fieldValidations.collectionName)
        )
      );

    for (const validation of validationsNeedingUpdate) {
      if (validation.collectionName) {
        // Find collection by name and update the validation record
        const collection = await this.db
          .select({ id: objectCollections.id })
          .from(objectCollections)
          .where(eq(objectCollections.collectionName, validation.collectionName))
          .limit(1);
          
        if (collection.length > 0) {
          await this.db
            .update(fieldValidations)
            .set({ collectionId: collection[0].id })
            .where(eq(fieldValidations.id, validation.id));
        }
      }
    }
  }

  // Session Documents
  async getSessionDocuments(sessionId: string): Promise<SessionDocument[]> {
    const result = await this.db
      .select()
      .from(sessionDocuments)
      .where(eq(sessionDocuments.sessionId, sessionId))
      .orderBy(sessionDocuments.extractedAt);
    return result;
  }

  async createSessionDocument(document: InsertSessionDocument): Promise<SessionDocument> {
    const normalizedDocument = {
      ...document,
      extractedContent: normalizeExcelContent(document.extractedContent || ''),
    };
    const result = await this.db.insert(sessionDocuments).values(normalizedDocument).returning();
    return result[0];
  }

  async updateSessionDocument(id: string, document: Partial<InsertSessionDocument>): Promise<SessionDocument | undefined> {
    // Apply Excel normalization if extractedContent is being updated
    const normalizedDocument = document.extractedContent !== undefined 
      ? { ...document, extractedContent: normalizeExcelContent(document.extractedContent || '') }
      : document;

    const result = await this.db
      .update(sessionDocuments)
      .set(normalizedDocument)
      .where(eq(sessionDocuments.id, id))
      .returning();
    return result[0];
  }

  async deleteSessionDocument(id: string): Promise<boolean> {
    const result = await this.db
      .delete(sessionDocuments)
      .where(eq(sessionDocuments.id, id));
    return result.rowCount > 0;
  }

  async getStepValueById(valueId: string): Promise<{ valueName: string; stepId: string } | undefined> {
    const result = await this.db
      .select({ valueName: stepValues.valueName, stepId: stepValues.stepId })
      .from(stepValues)
      .where(eq(stepValues.id, valueId));
    return result.length > 0 ? { valueName: result[0].valueName, stepId: result[0].stepId } : undefined;
  }

  // Chat Messages
  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    const result = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.timestamp);
    return result;
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await this.db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  // Excel Wizardry Functions
  async getExcelWizardryFunctions(): Promise<ExcelWizardryFunction[]> {
    return this.retryOperation(async () => {
      const result = await this.db
        .select()
        .from(excelWizardryFunctions)
        .orderBy(excelWizardryFunctions.usageCount, excelWizardryFunctions.createdAt);
      return result;
    });
  }

  async getExcelWizardryFunctionsByProject(projectId: string): Promise<ExcelWizardryFunction[]> {
    return this.retryOperation(async () => {
      const result = await this.db
        .select()
        .from(excelWizardryFunctions)
        .where(eq(excelWizardryFunctions.projectId, projectId))
        .orderBy(excelWizardryFunctions.usageCount, excelWizardryFunctions.createdAt);
      return result;
    });
  }

  async getExcelWizardryFunction(id: string): Promise<ExcelWizardryFunction | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db
        .select()
        .from(excelWizardryFunctions)
        .where(eq(excelWizardryFunctions.id, id))
        .limit(1);
      return result[0];
    });
  }

  async createExcelWizardryFunction(func: InsertExcelWizardryFunction): Promise<ExcelWizardryFunction> {
    return this.retryOperation(async () => {
      const result = await this.db
        .insert(excelWizardryFunctions)
        .values({
          ...func,
          updatedAt: sql`NOW()`
        })
        .returning();
      return result[0];
    });
  }

  async updateExcelWizardryFunction(id: string, func: Partial<InsertExcelWizardryFunction>): Promise<ExcelWizardryFunction | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db
        .update(excelWizardryFunctions)
        .set({
          ...func,
          updatedAt: sql`NOW()`
        })
        .where(eq(excelWizardryFunctions.id, id))
        .returning();
      return result[0];
    });
  }

  async updateExcelWizardryFunctionCode(id: string, functionCode: string): Promise<ExcelWizardryFunction | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db
        .update(excelWizardryFunctions)
        .set({
          functionCode,
          updatedAt: sql`NOW()`
        })
        .where(eq(excelWizardryFunctions.id, id))
        .returning();
      return result[0];
    });
  }

  async incrementFunctionUsage(id: string): Promise<ExcelWizardryFunction | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db
        .update(excelWizardryFunctions)
        .set({
          usageCount: sql`${excelWizardryFunctions.usageCount} + 1`,
          updatedAt: sql`NOW()`
        })
        .where(eq(excelWizardryFunctions.id, id))
        .returning();
      return result[0];
    });
  }

  async searchExcelWizardryFunctions(tags: string[]): Promise<ExcelWizardryFunction[]> {
    return this.retryOperation(async () => {
      const result = await this.db
        .select()
        .from(excelWizardryFunctions)
        .where(sql`${excelWizardryFunctions.tags} && ${tags}`) // PostgreSQL array overlap operator
        .orderBy(excelWizardryFunctions.usageCount, excelWizardryFunctions.createdAt);
      return result;
    });
  }

  async deleteExcelWizardryFunction(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      // First, remove function references from collection_properties and project_schema_fields
      await this.db
        .update(collectionProperties)
        .set({ functionId: null })
        .where(eq(collectionProperties.functionId, id));
      
      await this.db
        .update(projectSchemaFields)
        .set({ functionId: null })
        .where(eq(projectSchemaFields.functionId, id));
      
      // Then delete the function
      const result = await this.db
        .delete(excelWizardryFunctions)
        .where(eq(excelWizardryFunctions.id, id));
      return result.rowCount > 0;
    });
  }

  // Extraction Identifier References
  async getExtractionIdentifierReferences(sessionId: string, extractionNumber?: number): Promise<ExtractionIdentifierReference[]> {
    return this.retryOperation(async () => {
      let query = this.db
        .select()
        .from(extractionIdentifierReferences)
        .where(eq(extractionIdentifierReferences.sessionId, sessionId));
      
      if (extractionNumber !== undefined) {
        query = query.where(eq(extractionIdentifierReferences.extractionNumber, extractionNumber));
      }
      
      const result = await query.orderBy(
        extractionIdentifierReferences.extractionNumber,
        extractionIdentifierReferences.recordIndex,
        extractionIdentifierReferences.fieldName
      );
      return result;
    });
  }

  async createExtractionIdentifierReferences(references: InsertExtractionIdentifierReference[]): Promise<ExtractionIdentifierReference[]> {
    return this.retryOperation(async () => {
      const result = await this.db
        .insert(extractionIdentifierReferences)
        .values(references)
        .returning();
      return result;
    });
  }

  async deleteExtractionIdentifierReferences(sessionId: string, extractionNumber: number): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db
        .delete(extractionIdentifierReferences)
        .where(
          and(
            eq(extractionIdentifierReferences.sessionId, sessionId),
            eq(extractionIdentifierReferences.extractionNumber, extractionNumber)
          )
        );
      return result.rowCount > 0;
    });
  }

  async getMergedIdentifierReferences(sessionId: string, upToExtractionNumber: number): Promise<Record<string, any>[]> {
    return this.retryOperation(async () => {
      // Get all references up to the specified extraction number
      const references = await this.db
        .select()
        .from(extractionIdentifierReferences)
        .where(
          and(
            eq(extractionIdentifierReferences.sessionId, sessionId),
            sql`${extractionIdentifierReferences.extractionNumber} <= ${upToExtractionNumber}`
          )
        )
        .orderBy(
          extractionIdentifierReferences.recordIndex,
          extractionIdentifierReferences.extractionNumber,
          extractionIdentifierReferences.fieldName
        );

      // Group by record index and merge fields
      const merged: Record<number, Record<string, any>> = {};
      
      for (const ref of references) {
        if (!merged[ref.recordIndex]) {
          merged[ref.recordIndex] = {};
        }
        merged[ref.recordIndex][`${ref.fieldName}[${ref.recordIndex}]`] = ref.extractedValue;
      }

      // Convert to array format
      return Object.keys(merged)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(key => merged[parseInt(key)]);
    });
  }

  // Sample Documents
  async getSampleDocuments(functionId: string): Promise<SampleDocument[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(sampleDocuments).where(eq(sampleDocuments.functionId, functionId));
    });
  }

  async createSampleDocument(document: InsertSampleDocument): Promise<SampleDocument> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(sampleDocuments).values(document).returning();
      return result;
    });
  }

  async updateSampleDocument(id: string, document: Partial<InsertSampleDocument>): Promise<SampleDocument | undefined> {
    return this.retryOperation(async () => {
      const [result] = await this.db.update(sampleDocuments).set(document).where(eq(sampleDocuments.id, id)).returning();
      return result;
    });
  }

  async deleteSampleDocument(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.delete(sampleDocuments).where(eq(sampleDocuments.id, id));
      return result.rowCount > 0;
    });
  }

  async deleteSampleDocumentsByParameter(functionId: string, parameterName: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.delete(sampleDocuments).where(
        and(
          eq(sampleDocuments.functionId, functionId),
          eq(sampleDocuments.parameterName, parameterName)
        )
      );
      return result.rowCount > 0;
    });
  }

  // Test Documents
  async getTestDocuments(projectId: string): Promise<TestDocument[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(testDocuments).where(eq(testDocuments.projectId, projectId));
    });
  }

  async getTestDocument(id: string): Promise<TestDocument | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db.select().from(testDocuments).where(eq(testDocuments.id, id));
      return result[0];
    });
  }

  async createTestDocument(document: InsertTestDocument): Promise<TestDocument> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(testDocuments).values(document).returning();
      return result;
    });
  }

  async deleteTestDocument(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      // First check if the document exists
      const [existing] = await this.db.select().from(testDocuments).where(eq(testDocuments.id, id));
      if (!existing) {
        return false;
      }
      
      // Delete the document
      await this.db.delete(testDocuments).where(eq(testDocuments.id, id));
      return true;
    });
  }

  // Workflow Steps
  async getWorkflowSteps(projectId: string): Promise<WorkflowStep[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(workflowSteps)
        .where(eq(workflowSteps.projectId, projectId))
        .orderBy(workflowSteps.orderIndex);
    });
  }

  async getWorkflowStep(id: string): Promise<WorkflowStep | undefined> {
    return this.retryOperation(async () => {
      const [result] = await this.db.select().from(workflowSteps).where(eq(workflowSteps.id, id));
      return result;
    });
  }

  async createWorkflowStep(step: InsertWorkflowStep): Promise<WorkflowStep> {
    return this.retryOperation(async () => {
      console.log("\n📝 DATABASE INSERT - workflow_steps table:");
      console.log(JSON.stringify(step, null, 2));
      const [result] = await this.db.insert(workflowSteps).values(step).returning();
      console.log("✅ Inserted workflow step:", result.id);
      return result;
    });
  }

  async updateWorkflowStep(id: string, step: Partial<InsertWorkflowStep>): Promise<WorkflowStep | undefined> {
    return this.retryOperation(async () => {
      console.log("\n📝 DATABASE UPDATE - workflow_steps table:");
      console.log("Step ID:", id);
      console.log("Update Data:", JSON.stringify(step, null, 2));
      const [result] = await this.db.update(workflowSteps).set(step).where(eq(workflowSteps.id, id)).returning();
      console.log("✅ Updated workflow step:", result?.id);
      return result;
    });
  }

  async deleteWorkflowStep(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      // First, get all values for this step
      const values = await this.db.select().from(stepValues).where(eq(stepValues.stepId, id));
      
      // Update field_validations to remove references to these values
      for (const value of values) {
        await this.db.update(fieldValidations)
          .set({ valueId: null })
          .where(eq(fieldValidations.valueId, value.id));
      }
      
      // Also update field_validations to remove references to the step itself
      await this.db.update(fieldValidations)
        .set({ stepId: null })
        .where(eq(fieldValidations.stepId, id));
      
      // Now delete all step values
      await this.db.delete(stepValues).where(eq(stepValues.stepId, id));
      // Then delete the step
      const result = await this.db.delete(workflowSteps).where(eq(workflowSteps.id, id));
      return result.rowCount > 0;
    });
  }

  async saveProjectWorkflow(projectId: string, workflow: any): Promise<void> {
    return this.retryOperation(async () => {
      console.log("\n🔄 DATABASE OPERATION - Full Workflow Save");
      console.log("Project ID:", projectId);
      
      // Begin transaction-like behavior
      // First, delete existing workflow steps for this project
      const existingSteps = await this.db.select().from(workflowSteps).where(eq(workflowSteps.projectId, projectId));
      
      console.log(`Deleting ${existingSteps.length} existing steps...`);
      
      // First, we need to handle field_validations that reference these values and steps
      for (const step of existingSteps) {
        // Get all values for this step
        const values = await this.db.select().from(stepValues).where(eq(stepValues.stepId, step.id));
        
        // Update field_validations to remove references to these values
        for (const value of values) {
          await this.db.update(fieldValidations)
            .set({ valueId: null })
            .where(eq(fieldValidations.valueId, value.id));
        }
        
        // Also update field_validations to remove references to the step itself
        await this.db.update(fieldValidations)
          .set({ stepId: null })
          .where(eq(fieldValidations.stepId, step.id));
        
        // Now we can safely delete the step values
        await this.db.delete(stepValues).where(eq(stepValues.stepId, step.id));
      }
      await this.db.delete(workflowSteps).where(eq(workflowSteps.projectId, projectId));

      // Now save the new workflow
      console.log(`\nInserting ${workflow.steps?.length || 0} new steps...`);
      
      for (const step of workflow.steps) {
        // Create the step
        const stepData = {
          id: step.id,
          projectId: projectId,
          stepName: step.name,
          stepType: step.type,
          description: step.description,
          orderIndex: step.orderIndex,
          valueCount: step.valueCount || step.values?.length || 0,
          identifierId: step.identifierId
        };
        
        console.log("\n📝 DATABASE INSERT - workflow_steps (from full workflow):");
        console.log(JSON.stringify(stepData, null, 2));
        
        const [newStep] = await this.db.insert(workflowSteps).values(stepData).returning();

        // Create the values for this step
        for (let i = 0; i < (step.values || []).length; i++) {
          const value = step.values[i];
          // Ensure fields have identifierIds if this is a multi-field value
          let processedFields = value.fields;
          if (processedFields && Array.isArray(processedFields)) {
            processedFields = processedFields.map((field: any, idx: number) => ({
              ...field,
              identifierId: field.identifierId || crypto.randomUUID()
            }));
            console.log("📋 Generated identifierIds for fields in workflow save:", processedFields.map((f: any) => ({ name: f.name, identifierId: f.identifierId })));
          }
          
          const valueData = {
            id: value.id,
            stepId: newStep.id,
            valueName: value.name,
            dataType: value.dataType,
            description: value.description,
            isIdentifier: step.type === 'list' && step.values[0]?.id === value.id,
            orderIndex: i, // Always use array index for consistent ordering
            toolId: (value.toolId === '' || value.toolId === 'manual') ? null : value.toolId,
            inputValues: value.inputValues,
            fields: processedFields || null, // Add fields for multi-field Info Page values with identifierIds
            autoVerificationConfidence: value.autoVerificationConfidence,
            choiceOptions: value.choiceOptions
          };
          
          console.log("\n📝 DATABASE INSERT - step_values (from full workflow):");
          console.log(JSON.stringify(valueData, null, 2));
          
          await this.db.insert(stepValues).values(valueData);
        }
      }
      
      console.log("\n✅ Full workflow saved to database successfully!");
    });
  }

  // Step Values
  async getStepValues(stepId: string): Promise<StepValue[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(stepValues)
        .where(eq(stepValues.stepId, stepId))
        .orderBy(stepValues.orderIndex);
    });
  }

  async getStepValue(id: string): Promise<StepValue | undefined> {
    return this.retryOperation(async () => {
      const [result] = await this.db.select().from(stepValues).where(eq(stepValues.id, id));
      return result;
    });
  }

  async createStepValue(value: InsertStepValue): Promise<StepValue> {
    return this.retryOperation(async () => {
      // Convert empty string or 'manual' toolId to null
      const cleanedValue = {
        ...value,
        toolId: (value.toolId === '' || value.toolId === 'manual') ? null : value.toolId
      };
      
      // If this value has fields (multi-field Info Page value), ensure each field has an identifierId
      if (cleanedValue.fields && Array.isArray(cleanedValue.fields)) {
        cleanedValue.fields = cleanedValue.fields.map((field: any, idx: number) => ({
          ...field,
          identifierId: field.identifierId || crypto.randomUUID() // Generate UUID for each field
        }));
        console.log("📋 Generated identifierIds for multi-field value:", cleanedValue.fields.map((f: any) => ({ name: f.name, identifierId: f.identifierId })));
      }
      
      console.log("\n📝 DATABASE INSERT - step_values table:");
      console.log(JSON.stringify(cleanedValue, null, 2));
      const [result] = await this.db.insert(stepValues).values(cleanedValue).returning();
      console.log("✅ Inserted step value:", result.id);
      return result;
    });
  }

  async updateStepValue(id: string, value: Partial<InsertStepValue>): Promise<StepValue | undefined> {
    return this.retryOperation(async () => {
      // Convert empty string or 'manual' toolId to null
      const cleanedValue = {
        ...value,
        toolId: (value.toolId === '' || value.toolId === 'manual') ? null : value.toolId
      };
      
      // If updating fields, ensure each field has an identifierId
      if (cleanedValue.fields && Array.isArray(cleanedValue.fields)) {
        cleanedValue.fields = cleanedValue.fields.map((field: any, idx: number) => ({
          ...field,
          identifierId: field.identifierId || crypto.randomUUID() // Generate UUID if missing
        }));
        console.log("📋 Ensured identifierIds for multi-field value update:", cleanedValue.fields.map((f: any) => ({ name: f.name, identifierId: f.identifierId })));
      }
      
      console.log("\n📝 DATABASE UPDATE - step_values table:");
      console.log("Value ID:", id);
      console.log("Update Data:", JSON.stringify(cleanedValue, null, 2));
      const [result] = await this.db.update(stepValues).set(cleanedValue).where(eq(stepValues.id, id)).returning();
      console.log("✅ Updated step value:", result?.id);
      return result;
    });
  }

  async deleteStepValue(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      await this.db.delete(fieldValidations).where(eq(fieldValidations.valueId, id));
      const result = await this.db.delete(stepValues).where(eq(stepValues.id, id));
      return result.rowCount > 0;
    });
  }

  // Kanban Cards
  async getKanbanCards(sessionId: string, stepId: string): Promise<KanbanCard[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(kanbanCards)
        .where(and(
          eq(kanbanCards.sessionId, sessionId),
          eq(kanbanCards.stepId, stepId)
        ))
        .orderBy(kanbanCards.orderIndex);
    });
  }

  async getKanbanCard(id: string): Promise<KanbanCard | undefined> {
    return this.retryOperation(async () => {
      const [result] = await this.db.select().from(kanbanCards).where(eq(kanbanCards.id, id));
      return result;
    });
  }

  async createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(kanbanCards).values(card).returning();
      return result;
    });
  }

  async updateKanbanCard(id: string, card: Partial<InsertKanbanCard>): Promise<KanbanCard | undefined> {
    return this.retryOperation(async () => {
      const [result] = await this.db.update(kanbanCards)
        .set({ ...card, updatedAt: new Date() })
        .where(eq(kanbanCards.id, id))
        .returning();
      return result;
    });
  }

  async deleteKanbanCard(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.delete(kanbanCards).where(eq(kanbanCards.id, id));
      return result.rowCount > 0;
    });
  }

  async reorderKanbanCards(cards: { id: string; orderIndex: number; status?: string }[]): Promise<boolean> {
    return this.retryOperation(async () => {
      for (const card of cards) {
        const updateData: any = { orderIndex: card.orderIndex, updatedAt: new Date() };
        if (card.status) updateData.status = card.status;
        await this.db.update(kanbanCards).set(updateData).where(eq(kanbanCards.id, card.id));
      }
      return true;
    });
  }

  // Kanban Checklist Items
  async getKanbanChecklistItems(cardId: string): Promise<KanbanChecklistItem[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(kanbanChecklistItems)
        .where(eq(kanbanChecklistItems.cardId, cardId))
        .orderBy(kanbanChecklistItems.orderIndex);
    });
  }

  async createKanbanChecklistItem(item: InsertKanbanChecklistItem): Promise<KanbanChecklistItem> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(kanbanChecklistItems).values(item).returning();
      return result;
    });
  }

  async updateKanbanChecklistItem(id: string, item: Partial<InsertKanbanChecklistItem>): Promise<KanbanChecklistItem | undefined> {
    return this.retryOperation(async () => {
      const [result] = await this.db.update(kanbanChecklistItems)
        .set(item)
        .where(eq(kanbanChecklistItems.id, id))
        .returning();
      return result;
    });
  }

  async deleteKanbanChecklistItem(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.delete(kanbanChecklistItems).where(eq(kanbanChecklistItems.id, id));
      return result.rowCount > 0;
    });
  }

  // Kanban Comments
  async getKanbanComments(cardId: string): Promise<KanbanComment[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(kanbanComments)
        .where(eq(kanbanComments.cardId, cardId))
        .orderBy(kanbanComments.createdAt);
    });
  }

  async createKanbanComment(comment: InsertKanbanComment): Promise<KanbanComment> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(kanbanComments).values(comment).returning();
      return result;
    });
  }

  async updateKanbanComment(id: string, comment: Partial<InsertKanbanComment>): Promise<KanbanComment | undefined> {
    return this.retryOperation(async () => {
      const [result] = await this.db.update(kanbanComments)
        .set({ ...comment, updatedAt: new Date() })
        .where(eq(kanbanComments.id, id))
        .returning();
      return result;
    });
  }

  async deleteKanbanComment(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.delete(kanbanComments).where(eq(kanbanComments.id, id));
      return result.rowCount > 0;
    });
  }

  // Kanban Attachments
  async getKanbanAttachments(cardId: string): Promise<KanbanAttachment[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(kanbanAttachments)
        .where(eq(kanbanAttachments.cardId, cardId))
        .orderBy(kanbanAttachments.uploadedAt);
    });
  }

  async createKanbanAttachment(attachment: InsertKanbanAttachment): Promise<KanbanAttachment> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(kanbanAttachments).values(attachment).returning();
      return result;
    });
  }

  async deleteKanbanAttachment(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.delete(kanbanAttachments).where(eq(kanbanAttachments.id, id));
      return result.rowCount > 0;
    });
  }

  // Session Links
  async getSessionLinks(sessionId: string): Promise<SessionLink[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(sessionLinks)
        .where(eq(sessionLinks.sourceSessionId, sessionId))
        .orderBy(desc(sessionLinks.createdAt));
    });
  }

  async createSessionLink(link: InsertSessionLink): Promise<SessionLink> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(sessionLinks).values(link).returning();
      return result;
    });
  }

  async getSessionsByProject(projectId: string): Promise<ExtractionSession[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(extractionSessions)
        .where(eq(extractionSessions.projectId, projectId))
        .orderBy(desc(extractionSessions.createdAt));
    });
  }

  // Processed Emails
  async isEmailProcessed(projectId: string, messageId: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.select().from(processedEmails)
        .where(and(
          eq(processedEmails.projectId, projectId),
          eq(processedEmails.messageId, messageId)
        ));
      return result.length > 0;
    });
  }

  async markEmailProcessed(projectId: string, messageId: string, inboxId: string, sessionId: string, subject?: string, fromEmail?: string, emailBody?: string, receivedAt?: Date): Promise<void> {
    return this.retryOperation(async () => {
      await this.db.insert(processedEmails).values({
        projectId,
        messageId,
        inboxId,
        sessionId,
        subject,
        fromEmail,
        emailBody,
        receivedAt
      });
    });
  }

  async getSourceEmail(sessionId: string): Promise<{ subject: string | null; fromEmail: string | null; emailBody: string | null; receivedAt: Date | null } | null> {
    return this.retryOperation(async () => {
      const result = await this.db.select({
        subject: processedEmails.subject,
        fromEmail: processedEmails.fromEmail,
        emailBody: processedEmails.emailBody,
        receivedAt: processedEmails.receivedAt,
      }).from(processedEmails).where(eq(processedEmails.sessionId, sessionId)).limit(1);
      return result.length > 0 ? result[0] : null;
    });
  }

  // API Data Sources
  async getApiDataSources(projectId: string): Promise<ApiDataSource[]> {
    return this.retryOperation(async () => {
      return await this.db.select().from(apiDataSources)
        .where(eq(apiDataSources.projectId, projectId))
        .orderBy(desc(apiDataSources.createdAt));
    });
  }

  async getApiDataSource(id: string): Promise<ApiDataSource | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db.select().from(apiDataSources)
        .where(eq(apiDataSources.id, id));
      return result[0];
    });
  }

  async createApiDataSource(source: InsertApiDataSource): Promise<ApiDataSource> {
    return this.retryOperation(async () => {
      const [result] = await this.db.insert(apiDataSources).values({
        ...source,
        updatedAt: sql`NOW()`
      }).returning();
      return result;
    });
  }

  async updateApiDataSource(id: string, source: Partial<InsertApiDataSource>): Promise<ApiDataSource | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db.update(apiDataSources)
        .set({
          ...source,
          updatedAt: sql`NOW()`
        })
        .where(eq(apiDataSources.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteApiDataSource(id: string): Promise<boolean> {
    return this.retryOperation(async () => {
      const result = await this.db.delete(apiDataSources)
        .where(eq(apiDataSources.id, id))
        .returning();
      return result.length > 0;
    });
  }

  // Password Reset Tokens
  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return this.retryOperation(async () => {
      await this.db.insert(passwordResetTokens).values({
        userId,
        tokenHash,
        expiresAt,
      });
    });
  }

  async getPasswordResetToken(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null } | undefined> {
    return this.retryOperation(async () => {
      const result = await this.db
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
          expiresAt: passwordResetTokens.expiresAt,
          usedAt: passwordResetTokens.usedAt,
        })
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);
      return result[0];
    });
  }

  async markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
    return this.retryOperation(async () => {
      await this.db
        .update(passwordResetTokens)
        .set({ usedAt: sql`NOW()` })
        .where(eq(passwordResetTokens.tokenHash, tokenHash));
    });
  }

  async invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
    return this.retryOperation(async () => {
      await this.db
        .update(passwordResetTokens)
        .set({ usedAt: sql`NOW()` })
        .where(
          and(
            eq(passwordResetTokens.userId, userId),
            isNull(passwordResetTokens.usedAt)
          )
        );
    });
  }
}

// Use PostgreSQL storage when DATABASE_URL is available, MemStorage otherwise
export const storage = process.env.DATABASE_URL
  ? new PostgreSQLStorage()
  : new MemStorage();
