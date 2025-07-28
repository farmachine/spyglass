import { 
  projects, 
  projectSchemaFields, 
  objectCollections, 
  collectionProperties, 
  extractionSessions,
  knowledgeDocuments,
  extractionRules,
  fieldValidations,
  sessionDocuments,
  extractionJobs,
  organizations,
  users,
  projectPublishing,
  type Project, 
  type InsertProject,
  type ProjectSchemaField,
  type InsertProjectSchemaField,
  type ObjectCollection,
  type InsertObjectCollection,
  type CollectionProperty,
  type InsertCollectionProperty,
  type ExtractionSession,
  type InsertExtractionSession,
  type KnowledgeDocument,
  type InsertKnowledgeDocument,
  type ExtractionRule,
  type InsertExtractionRule,
  type FieldValidation,
  type InsertFieldValidation,
  type SessionDocument,
  type InsertSessionDocument,
  type ExtractionJob,
  type InsertExtractionJob,
  type ExtractionSessionWithValidation,
  type ProjectWithDetails,
  type Organization,
  type InsertOrganization,
  type User,
  type InsertUser,
  type OrganizationWithUsers,
  type UserWithOrganization,
  type ProjectPublishing,
  type InsertProjectPublishing
} from "@shared/schema";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, count, sql, and, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface IStorage {
  // Organizations
  getOrganizations(): Promise<(Organization & { userCount: number })[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
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

  // Projects (organization-filtered)
  getProjects(organizationId?: string, userRole?: string): Promise<Project[]>;
  getProjectsWithPublishedOrganizations(organizationId?: string, userRole?: string): Promise<(Project & { publishedOrganizations: Organization[] })[]>;
  getProject(id: string, organizationId?: string): Promise<Project | undefined>;
  getProjectWithDetails(id: string, organizationId?: string): Promise<ProjectWithDetails | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, organizationId?: string): Promise<Project | undefined>;
  deleteProject(id: string, organizationId?: string): Promise<boolean>;
  duplicateProject(id: string, newName: string, userId: string, organizationId?: string): Promise<Project | undefined>;

  // Project Schema Fields
  getProjectSchemaFields(projectId: string): Promise<ProjectSchemaField[]>;
  createProjectSchemaField(field: InsertProjectSchemaField): Promise<ProjectSchemaField>;
  updateProjectSchemaField(id: number, field: Partial<InsertProjectSchemaField>): Promise<ProjectSchemaField | undefined>;
  deleteProjectSchemaField(id: number): Promise<boolean>;

  // Object Collections
  getObjectCollections(projectId: string): Promise<(ObjectCollection & { properties: CollectionProperty[] })[]>;
  getObjectCollection(id: string): Promise<ObjectCollection | undefined>;
  createObjectCollection(collection: InsertObjectCollection): Promise<ObjectCollection>;
  updateObjectCollection(id: string, collection: Partial<InsertObjectCollection>): Promise<ObjectCollection | undefined>;
  deleteObjectCollection(id: string): Promise<boolean>;

  // Collection Properties
  getCollectionProperties(collectionId: string): Promise<CollectionProperty[]>;
  createCollectionProperty(property: InsertCollectionProperty): Promise<CollectionProperty>;
  updateCollectionProperty(id: number, property: Partial<InsertCollectionProperty>): Promise<CollectionProperty | undefined>;
  deleteCollectionProperty(id: number): Promise<boolean>;

  // Extraction Sessions
  getExtractionSessions(projectId: string): Promise<ExtractionSession[]>;
  getExtractionSession(id: string): Promise<ExtractionSession | undefined>;
  getSession(sessionId: string): Promise<ExtractionSession | undefined>;
  createExtractionSession(session: InsertExtractionSession): Promise<ExtractionSession>;
  updateExtractionSession(id: string, session: Partial<InsertExtractionSession>): Promise<ExtractionSession | undefined>;

  // Knowledge Documents
  getKnowledgeDocuments(projectId: string): Promise<KnowledgeDocument[]>;
  createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: string, document: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: string): Promise<boolean>;

  // Extraction Rules
  getExtractionRules(projectId: string): Promise<ExtractionRule[]>;
  createExtractionRule(rule: InsertExtractionRule): Promise<ExtractionRule>;
  updateExtractionRule(id: number, rule: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined>;
  deleteExtractionRule(id: number): Promise<boolean>;

  // Field Validations
  getFieldValidations(sessionId: string): Promise<FieldValidation[]>;
  createFieldValidation(validation: InsertFieldValidation): Promise<FieldValidation>;
  updateFieldValidation(id: string, validation: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined>;
  deleteFieldValidation(id: string): Promise<boolean>;
  getSessionWithValidations(sessionId: string): Promise<ExtractionSessionWithValidation | undefined>;

  // Session Documents
  createSessionDocument(document: InsertSessionDocument): Promise<SessionDocument>;
  getSessionDocumentsBySession(sessionId: string): Promise<SessionDocument[]>;
  getSessionDocument(id: string): Promise<SessionDocument | undefined>;
  updateSessionDocument(id: string, document: Partial<InsertSessionDocument>): Promise<SessionDocument | undefined>;
  deleteSessionDocument(id: string): Promise<boolean>;

  // Extraction Jobs
  createExtractionJob(job: InsertExtractionJob): Promise<ExtractionJob>;
  getExtractionJob(id: string): Promise<ExtractionJob | undefined>;
  getExtractionJobsBySession(sessionId: string): Promise<ExtractionJob[]>;
  updateExtractionJob(id: string, job: Partial<InsertExtractionJob>): Promise<ExtractionJob | undefined>;

  // Project Publishing
  getProjectPublishing(projectId: string): Promise<ProjectPublishing[]>;
  getProjectPublishedOrganizations(projectId: string): Promise<Organization[]>;
  publishProjectToOrganization(publishing: InsertProjectPublishing): Promise<ProjectPublishing>;
  unpublishProjectFromOrganization(projectId: string, organizationId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private organizations: Map<string, Organization>;
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private projectSchemaFields: Map<string, ProjectSchemaField>;
  private objectCollections: Map<string, ObjectCollection>;
  private collectionProperties: Map<string, CollectionProperty>;
  private extractionSessions: Map<string, ExtractionSession>;
  private knowledgeDocuments: Map<string, KnowledgeDocument>;
  private extractionRules: Map<string, ExtractionRule>;
  private fieldValidations: Map<string, FieldValidation>;
  private sessionDocuments: Map<string, SessionDocument>;
  private extractionJobs: Map<string, ExtractionJob>;
  private projectPublishing: Map<string, ProjectPublishing>;

  constructor() {
    this.organizations = new Map();
    this.users = new Map();
    this.projects = new Map();
    this.projectSchemaFields = new Map();
    this.objectCollections = new Map();
    this.collectionProperties = new Map();
    this.extractionSessions = new Map();
    this.knowledgeDocuments = new Map();
    this.extractionRules = new Map();
    this.fieldValidations = new Map();
    this.sessionDocuments = new Map();
    this.extractionJobs = new Map();
    this.projectPublishing = new Map();
    
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
      createdAt: new Date()
    };
    this.users.set(userId, adminUser);

    // Create a sample project with deterministic UUID
    const projectId = "550e8400-e29b-41d4-a716-446655440002"; // Fixed UUID for sample project
    const project = {
      id: projectId,
      name: "Sample Invoice Processing",
      description: "Extract data from invoices and receipts",
      organizationId: orgId, // Link to organization
      createdBy: userId,
      status: "active" as const,
      mainObjectName: "Invoice",
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
        orderIndex: 3,
        createdAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
      },
    ];
    
    properties.forEach(prop => this.collectionProperties.set(prop.id, prop));
    
    // Add sample extraction session with deterministic UUID
    const sessionId = "550e8400-e29b-41d4-a716-446655440040"; // Fixed UUID for sample session
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
        validationStatus: "invalid" as const,
        aiReasoning: "Price format appears correct but may need verification against source document",
        manuallyVerified: false,
        confidenceScore: 72
      },
      // Line Items Collection - Second Item
      {
        id: 7,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 1,
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
        id: 8,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 2,
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
        id: 9,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 3,
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
        id: 10,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 1,
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
        id: 11,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 2,
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
        id: 12,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 3,
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
    this.currentValidationId = 13;
    
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

  async getPrimaryOrganization(): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find(org => org.type === 'primary');
  }

  async getOrganizationWithUsers(id: string): Promise<OrganizationWithUsers | undefined> {
    const org = this.organizations.get(id);
    if (!org) return undefined;
    
    const users = Array.from(this.users.values()).filter(u => u.organizationId === id);
    return { ...org, users };
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const org: Organization = {
      id: this.generateUUID(),
      ...insertOrg,
      createdAt: new Date(),
    };
    this.organizations.set(org.id, org);
    return org;
  }

  async updateOrganization(id: string, updateData: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const org = this.organizations.get(id);
    if (!org) return undefined;
    
    const updated = { ...org, ...updateData };
    this.organizations.set(id, updated);
    return updated;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    return this.organizations.delete(id);
  }

  // Users  
  async getUsers(organizationId: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.organizationId === organizationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUserWithOrganization(id: string): Promise<UserWithOrganization | undefined> {
    const user = this.users.get(id);
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
      id: this.generateUUID(),
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

  async getProjectsWithPublishedOrganizations(organizationId?: number, userRole?: string): Promise<(Project & { publishedOrganizations: Organization[] })[]> {
    const projects = await this.getProjects(organizationId, userRole);
    
    // For MemStorage, just return empty published organizations since this is mainly for testing
    return projects.map(project => ({
      ...project,
      publishedOrganizations: []
    }));
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

  async deleteProject(id: number, organizationId?: number): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project) return false;
    
    // Check organization access if organizationId is provided
    if (organizationId && project.organizationId !== organizationId) {
      return false;
    }
    
    return this.projects.delete(id);
  }

  async duplicateProject(id: string, newName: string, userId: string, organizationId?: string): Promise<Project | undefined> {
    const originalProject = this.projects.get(id);
    if (!originalProject) return undefined;
    
    // Check organization access if organizationId is provided
    if (organizationId && originalProject.organizationId !== organizationId) {
      return undefined;
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
        id: this.currentFieldId++,
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
        id: this.currentCollectionId++,
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
          id: this.currentPropertyId++,
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
        id: this.currentRuleId++,
        projectId: duplicatedProject.id,
        title: rule.title,
        description: rule.description,
        targetFields: rule.targetFields,
        ruleText: rule.ruleText,
        createdAt: new Date(),
      };
      this.extractionRules.set(duplicatedRule.id, duplicatedRule);
    }
    
    // Note: We don't duplicate sessions, knowledge documents, or validations
    // as these are typically instance-specific data
    
    return duplicatedProject;
  }

  // Project Publishing methods (MemStorage stubs)
  async getProjectPublishing(projectId: string): Promise<ProjectPublishing[]> {
    return [];
  }

  async getProjectPublishedOrganizations(projectId: string): Promise<Organization[]> {
    return [];
  }

  async publishProjectToOrganization(publishing: InsertProjectPublishing): Promise<ProjectPublishing> {
    const id = this.generateUUID();
    const projectPublishing: ProjectPublishing = {
      ...publishing,
      id,
      createdAt: new Date(),
    };
    return projectPublishing;
  }

  async unpublishProjectFromOrganization(projectId: string, organizationId: string): Promise<boolean> {
    return true;
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

  // Object Collections
  async getObjectCollections(projectId: number): Promise<(ObjectCollection & { properties: CollectionProperty[] })[]> {
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

  async getObjectCollection(id: number): Promise<ObjectCollection | undefined> {
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
  async getCollectionProperties(collectionId: number): Promise<CollectionProperty[]> {
    return Array.from(this.collectionProperties.values())
      .filter(prop => prop.collectionId === collectionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

  // Extraction Sessions
  async getExtractionSessions(projectId: number): Promise<ExtractionSession[]> {
    return Array.from(this.extractionSessions.values())
      .filter(session => session.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getExtractionSession(id: number): Promise<ExtractionSession | undefined> {
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

  async updateExtractionSession(id: number, updateData: any): Promise<ExtractionSession | undefined> {
    const session = this.extractionSessions.get(id);
    if (!session) return undefined;

    const updatedSession = { ...session, ...updateData, updatedAt: new Date() };
    this.extractionSessions.set(id, updatedSession);
    return updatedSession;
  }

  // Knowledge Documents
  async getKnowledgeDocuments(projectId: number): Promise<KnowledgeDocument[]> {
    return Array.from(this.knowledgeDocuments.values())
      .filter(doc => doc.projectId === projectId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async createKnowledgeDocument(insertDocument: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const id = this.currentDocumentId++;
    const document: KnowledgeDocument = {
      ...insertDocument,
      id,
      uploadedAt: new Date(),
    };
    this.knowledgeDocuments.set(id, document);
    return document;
  }

  async updateKnowledgeDocument(id: string, updateData: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    // MemStorage still uses numbers internally, convert for compatibility
    const numId = parseInt(id);
    const existingDocument = this.knowledgeDocuments.get(numId);
    if (!existingDocument) return undefined;

    const updatedDocument = { ...existingDocument, ...updateData };
    this.knowledgeDocuments.set(numId, updatedDocument);
    return updatedDocument;
  }

  async deleteKnowledgeDocument(id: string): Promise<boolean> {
    // MemStorage still uses numbers internally, convert for compatibility
    const numId = parseInt(id);
    return this.knowledgeDocuments.delete(numId);
  }

  // Extraction Rules
  async getExtractionRules(projectId: number): Promise<ExtractionRule[]> {
    return Array.from(this.extractionRules.values())
      .filter(rule => rule.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createExtractionRule(insertRule: InsertExtractionRule): Promise<ExtractionRule> {
    const id = this.currentRuleId++;
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
    // Convert string ID to number for in-memory storage lookup
    const numericId = parseInt(id);
    if (isNaN(numericId)) return undefined;
    
    const existingRule = this.extractionRules.get(numericId);
    if (!existingRule) return undefined;

    const updatedRule = { ...existingRule, ...updateData };
    this.extractionRules.set(numericId, updatedRule);
    return updatedRule;
  }

  async deleteExtractionRule(id: string): Promise<boolean> {
    // Convert string ID to number for in-memory storage lookup
    const numericId = parseInt(id);
    if (isNaN(numericId)) return false;
    
    return this.extractionRules.delete(numericId);
  }

  // Field Validations
  async getFieldValidations(sessionId: string): Promise<FieldValidation[]> {
    // Convert string to number for filtering in memory storage
    const numericId = parseInt(sessionId);
    if (isNaN(numericId)) return [];
    
    return Array.from(this.fieldValidations.values())
      .filter(validation => validation.sessionId === numericId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    return validation;
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

  async getSessionWithValidations(sessionId: number): Promise<ExtractionSessionWithValidation | undefined> {
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
    const numericId = parseInt(sessionId);
    if (isNaN(numericId)) return undefined;
    
    return this.getSessionWithValidations(numericId);
  }

  // Session Documents
  async createSessionDocument(document: InsertSessionDocument): Promise<SessionDocument> {
    const id = this.generateUUID();
    const sessionDocument: SessionDocument = {
      ...document,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessionDocuments.set(id, sessionDocument);
    return sessionDocument;
  }

  async getSessionDocumentsBySession(sessionId: string): Promise<SessionDocument[]> {
    return Array.from(this.sessionDocuments.values())
      .filter(doc => doc.sessionId === sessionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getSessionDocument(id: string): Promise<SessionDocument | undefined> {
    return this.sessionDocuments.get(id);
  }

  async updateSessionDocument(id: string, document: Partial<InsertSessionDocument>): Promise<SessionDocument | undefined> {
    const existingDocument = this.sessionDocuments.get(id);
    if (!existingDocument) return undefined;

    const updatedDocument = { 
      ...existingDocument, 
      ...document, 
      updatedAt: new Date() 
    };
    this.sessionDocuments.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteSessionDocument(id: string): Promise<boolean> {
    return this.sessionDocuments.delete(id);
  }

  // Extraction Jobs
  async createExtractionJob(insertJob: InsertExtractionJob): Promise<ExtractionJob> {
    const id = this.generateUUID();
    const job: ExtractionJob = {
      ...insertJob,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.extractionJobs.set(id, job);
    return job;
  }

  async getExtractionJob(id: string): Promise<ExtractionJob | undefined> {
    return this.extractionJobs.get(id);
  }

  async getExtractionJobsBySession(sessionId: string): Promise<ExtractionJob[]> {
    return Array.from(this.extractionJobs.values())
      .filter(job => job.sessionId === sessionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateExtractionJob(id: string, updateData: Partial<InsertExtractionJob>): Promise<ExtractionJob | undefined> {
    const job = this.extractionJobs.get(id);
    if (!job) return undefined;

    const updatedJob = { 
      ...job, 
      ...updateData, 
      updatedAt: new Date() 
    };
    this.extractionJobs.set(id, updatedJob);
    return updatedJob;
  }
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
          createdAt: organizations.createdAt,
          userCount: count(users.id)
        })
        .from(organizations)
        .leftJoin(users, eq(organizations.id, users.organizationId))
        .groupBy(organizations.id, organizations.name, organizations.description, organizations.type, organizations.createdAt);
      
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

  // Get published organizations for projects
  async getProjectsWithPublishedOrganizations(organizationId?: string, userRole?: string): Promise<(Project & { publishedOrganizations: Organization[] })[]> {
    return this.retryOperation(async () => {
    let projectsList;
    
    if (organizationId) {
      // Get organization details to check if it's primary
      const organization = await this.getOrganization(organizationId);
      
      if (organization?.type === 'primary' && userRole === 'admin') {
        // Primary organization admins can see ALL projects in the system
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
      } else if (organization?.type === 'primary' && userRole === 'user') {
        // For regular users in primary organizations, only show published projects
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
          .innerJoin(projectPublishing, eq(projectPublishing.projectId, projects.id))
          .leftJoin(users, eq(projects.createdBy, users.id))
          .leftJoin(organizations, eq(users.organizationId, organizations.id))
          .where(eq(projectPublishing.organizationId, organizationId))
          .orderBy(sql`${projects.createdAt} DESC`);
      } else {
        // For admins or users in non-primary organizations: owned OR published projects
        const result = await this.db
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
          .leftJoin(projectPublishing, eq(projectPublishing.projectId, projects.id))
          .leftJoin(users, eq(projects.createdBy, users.id))
          .leftJoin(organizations, eq(users.organizationId, organizations.id))
          .where(
            or(
              eq(projects.organizationId, organizationId),
              eq(projectPublishing.organizationId, organizationId)
            )
          )
          .orderBy(sql`${projects.createdAt} DESC`);
        
        // Remove duplicates that might occur from the join
        projectsList = result.reduce((acc, project) => {
          if (!acc.find(p => p.id === project.id)) {
            acc.push(project);
          }
          return acc;
        }, [] as any[]);
      }
    } else {
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

    // For each project, get published organizations
    const projectsWithOrgs = await Promise.all(
      projectsList.map(async (project) => {
        const publishedOrgs = await this.db
          .select({
            id: organizations.id,
            name: organizations.name,
            description: organizations.description,
            type: organizations.type,
            createdAt: organizations.createdAt
          })
          .from(organizations)
          .innerJoin(projectPublishing, eq(projectPublishing.organizationId, organizations.id))
          .where(eq(projectPublishing.projectId, project.id));

        return {
          ...project,
          publishedOrganizations: publishedOrgs
        };
      })
    );

    return projectsWithOrgs;
    });
  }

  // For now, implement minimal project methods to prevent errors
  async getProjects(organizationId?: string, userRole?: string): Promise<Project[]> {
    const projectsWithOrgs = await this.getProjectsWithPublishedOrganizations(organizationId, userRole);
    return projectsWithOrgs.map(({ publishedOrganizations, ...project }) => project);
  }

  async getProject(id: string, organizationId?: string): Promise<Project | undefined> {
    let result;
    if (organizationId) {
      // Check if project belongs to organization OR is published to the organization
      result = await this.db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          organizationId: projects.organizationId,
          mainObjectName: projects.mainObjectName,
          isInitialSetupComplete: projects.isInitialSetupComplete,
          createdAt: projects.createdAt
        })
        .from(projects)
        .leftJoin(projectPublishing, eq(projectPublishing.projectId, projects.id))
        .where(
          or(
            eq(projects.organizationId, organizationId),
            eq(projectPublishing.organizationId, organizationId)
          )
        )
        .where(eq(projects.id, id))
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

  async getProjectWithDetails(id: string, organizationId?: string): Promise<ProjectWithDetails | undefined> {
    const project = await this.getProject(id, organizationId);
    if (!project) return undefined;

    // Fetch related data in parallel
    const [schemaFields, collections, sessions, knowledgeDocuments, extractionRules] = await Promise.all([
      this.getProjectSchemaFields(id),
      this.getObjectCollections(id),
      this.getExtractionSessions(id),
      this.getKnowledgeDocuments(id),
      this.getExtractionRules(id)
    ]);

    return {
      ...project,
      schemaFields,
      collections,
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
        description: doc.description,
      };
      await this.createKnowledgeDocument(duplicatedDoc);
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
  async createCollectionProperty(property: InsertCollectionProperty): Promise<CollectionProperty> { 
    const result = await this.db.insert(collectionProperties).values(property).returning();
    return result[0];
  }
  async updateCollectionProperty(id: number, property: Partial<InsertCollectionProperty>): Promise<CollectionProperty | undefined> {
    const result = await this.db
      .update(collectionProperties)
      .set(property)
      .where(eq(collectionProperties.id, id))
      .returning();
    return result[0];
  }

  async deleteCollectionProperty(id: number): Promise<boolean> {
    const result = await this.db
      .delete(collectionProperties)
      .where(eq(collectionProperties.id, id));
    return result.rowCount > 0;
  }

  // Extraction Sessions
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

  // Knowledge Documents
  async getKnowledgeDocuments(projectId: string): Promise<KnowledgeDocument[]> {
    const result = await this.db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.projectId, projectId))
      .orderBy(knowledgeDocuments.uploadedAt);
    return result;
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
  async updateExtractionRule(id: number, rule: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined> {
    const result = await this.db
      .update(extractionRules)
      .set(rule)
      .where(eq(extractionRules.id, id))
      .returning();
    return result[0];
  }

  async deleteExtractionRule(id: number): Promise<boolean> {
    const result = await this.db
      .delete(extractionRules)
      .where(eq(extractionRules.id, id));
    return result.rowCount > 0;
  }
  async getFieldValidations(sessionId: string): Promise<FieldValidation[]> { 
    const result = await this.db.select().from(fieldValidations).where(eq(fieldValidations.sessionId, sessionId));
    
    // Enhance results with field names
    const enhancedValidations = await Promise.all(result.map(async (validation) => {
      let fieldName = '';
      
      if (validation.fieldType === 'schema_field') {
        // Get field name from project schema fields
        const schemaField = await this.db
          .select({ fieldName: projectSchemaFields.fieldName })
          .from(projectSchemaFields)
          .where(eq(projectSchemaFields.id, validation.fieldId))
          .limit(1);
        
        fieldName = schemaField[0]?.fieldName || '';
      } else if (validation.fieldType === 'collection_property') {
        // Get property name from collection properties and build collection field name
        const property = await this.db
          .select({ propertyName: collectionProperties.propertyName })
          .from(collectionProperties)
          .where(eq(collectionProperties.id, validation.fieldId))
          .limit(1);
        
        if (property[0] && validation.collectionName && validation.recordIndex !== null) {
          fieldName = `${validation.collectionName}.${property[0].propertyName}[${validation.recordIndex}]`;
        }
      }
      
      return {
        ...validation,
        fieldName
      };
    }));
    
    return enhancedValidations;
  }
  async createFieldValidation(validation: InsertFieldValidation): Promise<FieldValidation> { 
    const result = await this.db.insert(fieldValidations).values(validation).returning();
    return result[0];
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

  // Project Publishing methods
  async getProjectPublishing(projectId: string): Promise<ProjectPublishing[]> { 
    const result = await this.db
      .select()
      .from(projectPublishing)
      .where(eq(projectPublishing.projectId, projectId));
    return result;
  }

  async getProjectPublishedOrganizations(projectId: string): Promise<Organization[]> { 
    const result = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        type: organizations.type,
        createdAt: organizations.createdAt,
      })
      .from(projectPublishing)
      .innerJoin(organizations, eq(organizations.id, projectPublishing.organizationId))
      .where(eq(projectPublishing.projectId, projectId));
    return result;
  }

  async publishProjectToOrganization(publishing: InsertProjectPublishing): Promise<ProjectPublishing> { 
    const result = await this.db.insert(projectPublishing).values(publishing).returning();
    return result[0];
  }

  async unpublishProjectFromOrganization(projectId: string, organizationId: string): Promise<boolean> { 
    const result = await this.db
      .delete(projectPublishing)
      .where(
        and(
          eq(projectPublishing.projectId, projectId),
          eq(projectPublishing.organizationId, organizationId)
        )
      );
    return result.rowCount > 0;
  }

  // Session Documents
  async createSessionDocument(document: InsertSessionDocument): Promise<SessionDocument> {
    const result = await this.db.insert(sessionDocuments).values(document).returning();
    return result[0];
  }

  async getSessionDocumentsBySession(sessionId: string): Promise<SessionDocument[]> {
    const result = await this.db
      .select()
      .from(sessionDocuments)
      .where(eq(sessionDocuments.sessionId, sessionId))
      .orderBy(sessionDocuments.createdAt);
    return result;
  }

  async getSessionDocument(id: string): Promise<SessionDocument | undefined> {
    const result = await this.db
      .select()
      .from(sessionDocuments)
      .where(eq(sessionDocuments.id, id))
      .limit(1);
    return result[0];
  }

  async updateSessionDocument(id: string, document: Partial<InsertSessionDocument>): Promise<SessionDocument | undefined> {
    const result = await this.db
      .update(sessionDocuments)
      .set(document)
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

  // Extraction Jobs
  async createExtractionJob(job: InsertExtractionJob): Promise<ExtractionJob> {
    const result = await this.db.insert(extractionJobs).values(job).returning();
    return result[0];
  }

  async getExtractionJob(id: string): Promise<ExtractionJob | undefined> {
    const result = await this.db
      .select()
      .from(extractionJobs)
      .where(eq(extractionJobs.id, id))
      .limit(1);
    return result[0];
  }

  async getExtractionJobsBySession(sessionId: string): Promise<ExtractionJob[]> {
    const result = await this.db
      .select()
      .from(extractionJobs)
      .where(eq(extractionJobs.sessionId, sessionId))
      .orderBy(extractionJobs.createdAt);
    return result;
  }

  async updateExtractionJob(id: string, job: Partial<InsertExtractionJob>): Promise<ExtractionJob | undefined> {
    const result = await this.db
      .update(extractionJobs)
      .set(job)
      .where(eq(extractionJobs.id, id))
      .returning();
    return result[0];
  }
}

// Use PostgreSQL storage when DATABASE_URL is available, MemStorage otherwise
export const storage = process.env.DATABASE_URL
  ? new PostgreSQLStorage()
  : new MemStorage();
