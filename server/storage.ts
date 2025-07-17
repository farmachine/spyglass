import { 
  projects, 
  projectSchemaFields, 
  objectCollections, 
  collectionProperties, 
  extractionSessions,
  knowledgeDocuments,
  extractionRules,
  fieldValidations,
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
  getProjects(organizationId?: string): Promise<Project[]>;
  getProject(id: string, organizationId?: string): Promise<Project | undefined>;
  getProjectWithDetails(id: string, organizationId?: string): Promise<ProjectWithDetails | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, organizationId?: string): Promise<Project | undefined>;
  deleteProject(id: string, organizationId?: string): Promise<boolean>;

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
  createExtractionSession(session: InsertExtractionSession): Promise<ExtractionSession>;
  updateExtractionSession(id: string, session: Partial<InsertExtractionSession>): Promise<ExtractionSession | undefined>;

  // Knowledge Documents
  getKnowledgeDocuments(projectId: string): Promise<KnowledgeDocument[]>;
  createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: number, document: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: number): Promise<boolean>;

  // Extraction Rules
  getExtractionRules(projectId: string): Promise<ExtractionRule[]>;
  createExtractionRule(rule: InsertExtractionRule): Promise<ExtractionRule>;
  updateExtractionRule(id: number, rule: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined>;
  deleteExtractionRule(id: number): Promise<boolean>;

  // Field Validations
  getFieldValidations(sessionId: string): Promise<FieldValidation[]>;
  createFieldValidation(validation: InsertFieldValidation): Promise<FieldValidation>;
  updateFieldValidation(id: number, validation: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined>;
  deleteFieldValidation(id: number): Promise<boolean>;
  getSessionWithValidations(sessionId: string): Promise<ExtractionSessionWithValidation | undefined>;

  // Project Publishing
  getProjectPublishing(projectId: string): Promise<ProjectPublishing[]>;
  getProjectPublishedOrganizations(projectId: string): Promise<Organization[]>;
  publishProjectToOrganization(publishing: InsertProjectPublishing): Promise<ProjectPublishing>;
  unpublishProjectFromOrganization(projectId: string, organizationId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private organizations: Map<number, Organization>;
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private projectSchemaFields: Map<number, ProjectSchemaField>;
  private objectCollections: Map<number, ObjectCollection>;
  private collectionProperties: Map<number, CollectionProperty>;
  private extractionSessions: Map<number, ExtractionSession>;
  private knowledgeDocuments: Map<number, KnowledgeDocument>;
  private extractionRules: Map<number, ExtractionRule>;
  private fieldValidations: Map<number, FieldValidation>;
  private projectPublishing: Map<number, ProjectPublishing>;
  
  private currentOrganizationId: number;
  private currentUserId: number;
  private currentProjectId: number;
  private currentFieldId: number;
  private currentCollectionId: number;
  private currentPropertyId: number;
  private currentSessionId: number;
  private currentDocumentId: number;
  private currentRuleId: number;
  private currentValidationId: number;
  private currentPublishingId: number;

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
    this.projectPublishing = new Map();
    
    this.currentOrganizationId = 1;
    this.currentUserId = 1;
    this.currentProjectId = 1;
    this.currentFieldId = 1;
    this.currentCollectionId = 1;
    this.currentPropertyId = 1;
    this.currentSessionId = 1;
    this.currentDocumentId = 1;
    this.currentRuleId = 1;
    this.currentValidationId = 1;
    this.currentPublishingId = 1;
    
    // Initialize with sample data for development
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Create sample organization
    const org: Organization = {
      id: 1,
      name: "ACME Corporation", 
      description: "Sample organization for testing",
      createdAt: new Date()
    };
    this.organizations.set(1, org);

    // Create sample admin user (password: "password")
    const adminUser: User = {
      id: 1,
      email: "admin@acme.com",
      passwordHash: "$2b$10$3okWosohJ1kYB2mvuz1ieuZTTrUIbDcEv3O2D/sWc01cyvlhqN88C",
      name: "Admin User",
      organizationId: 1,
      role: "admin",
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(1, adminUser);

    this.currentOrganizationId = 2;
    this.currentUserId = 2;

    // Create a sample project
    const project = {
      id: 1,
      name: "Sample Invoice Processing",
      description: "Extract data from invoices and receipts",
      organizationId: 1, // Link to organization
      mainObjectName: "Invoice",
      isInitialSetupComplete: true,
      createdAt: new Date(),
    };
    this.projects.set(1, project);
    this.currentProjectId = 2;
    
    // Add sample schema fields
    const schemaFields = [
      {
        id: 1,
        projectId: 1,
        fieldName: "Total Amount",
        fieldType: "NUMBER" as const,
        description: "The total amount of the invoice",
        autoVerificationConfidence: 80,
        orderIndex: 1,
        createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
      },
      {
        id: 2,
        projectId: 1,
        fieldName: "Invoice Date",
        fieldType: "DATE" as const,
        description: "The date when the invoice was issued",
        autoVerificationConfidence: 80,
        orderIndex: 2,
        createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      },
      {
        id: 3,
        projectId: 1,
        fieldName: "Vendor Name",
        fieldType: "TEXT" as const,
        description: "The name of the vendor or supplier",
        autoVerificationConfidence: 80,
        orderIndex: 3,
        createdAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
      },
    ];
    
    schemaFields.forEach(field => this.projectSchemaFields.set(field.id, field));
    this.currentFieldId = 4;
    
    // Add sample collection
    const collection = {
      id: 1,
      projectId: 1,
      collectionName: "Line Items",
      description: "Individual items listed on the invoice",
      orderIndex: 1,
      createdAt: new Date(),
    };
    this.objectCollections.set(1, collection);
    this.currentCollectionId = 2;
    
    // Add sample collection properties
    const properties = [
      {
        id: 1,
        collectionId: 1,
        propertyName: "Description",
        propertyType: "TEXT" as const,
        description: "Description of the item",
        autoVerificationConfidence: 80,
        orderIndex: 1,
        createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
      },
      {
        id: 2,
        collectionId: 1,
        propertyName: "Quantity",
        propertyType: "NUMBER" as const,
        description: "Number of items",
        autoVerificationConfidence: 80,
        orderIndex: 2,
        createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      },
      {
        id: 3,
        collectionId: 1,
        propertyName: "Unit Price",
        propertyType: "NUMBER" as const,
        description: "Price per unit",
        autoVerificationConfidence: 80,
        orderIndex: 3,
        createdAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
      },
    ];
    
    properties.forEach(prop => this.collectionProperties.set(prop.id, prop));
    this.currentPropertyId = 4;
    
    // Add sample extraction session
    const session = {
      id: 1,
      projectId: 1,
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
    this.extractionSessions.set(1, session);
    this.currentSessionId = 2;
    
    // Add sample field validations for existing session
    const validations: FieldValidation[] = [
      // Project Schema Fields
      {
        id: 1,
        sessionId: 1,
        fieldType: "schema_field" as const,
        fieldId: 1,
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
        id: 2,
        sessionId: 1,
        fieldType: "schema_field" as const,
        fieldId: 2,
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
        id: 3,
        sessionId: 1,
        fieldType: "schema_field" as const,
        fieldId: 3,
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
        id: 4,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 1,
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
        id: 5,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 2,
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
        id: 6,
        sessionId: 1,
        fieldType: "collection_property" as const,
        fieldId: 3,
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

  async getOrganization(id: number): Promise<Organization | undefined> {
    return this.organizations.get(id);
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

  async getUserWithOrganization(id: number): Promise<UserWithOrganization | undefined> {
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

  // Projects (with organization filtering)
  async getProjects(organizationId?: number): Promise<Project[]> {
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
    const project: Project = {
      id: this.currentProjectId++,
      ...insertProject,
      createdAt: new Date(),
    };
    this.projects.set(project.id, project);
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

  async duplicateProject(id: number, newName: string, organizationId?: number): Promise<Project | undefined> {
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

  // Project Schema Fields
  async getProjectSchemaFields(projectId: string): Promise<ProjectSchemaField[]> {
    return Array.from(this.projectSchemaFields.values())
      .filter(field => field.projectId === projectId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createProjectSchemaField(insertField: InsertProjectSchemaField): Promise<ProjectSchemaField> {
    const id = this.currentFieldId++;
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

  async updateProjectSchemaField(id: number, updateData: Partial<InsertProjectSchemaField>): Promise<ProjectSchemaField | undefined> {
    const field = this.projectSchemaFields.get(id);
    if (!field) return undefined;

    const updatedField = { ...field, ...updateData };
    this.projectSchemaFields.set(id, updatedField);
    return updatedField;
  }

  async deleteProjectSchemaField(id: number): Promise<boolean> {
    return this.projectSchemaFields.delete(id);
  }

  // Object Collections
  async getObjectCollections(projectId: number): Promise<(ObjectCollection & { properties: CollectionProperty[] })[]> {
    const collections = Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === projectId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return collections.map(collection => ({
      ...collection,
      properties: Array.from(this.collectionProperties.values())
        .filter(property => property.collectionId === collection.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }));
  }

  async getObjectCollection(id: number): Promise<ObjectCollection | undefined> {
    return this.objectCollections.get(id);
  }

  async createObjectCollection(insertCollection: InsertObjectCollection): Promise<ObjectCollection> {
    const id = this.currentCollectionId++;
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

  async updateObjectCollection(id: number, updateData: Partial<InsertObjectCollection>): Promise<ObjectCollection | undefined> {
    const collection = this.objectCollections.get(id);
    if (!collection) return undefined;

    const updatedCollection = { ...collection, ...updateData };
    this.objectCollections.set(id, updatedCollection);
    return updatedCollection;
  }

  async deleteObjectCollection(id: number): Promise<boolean> {
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
    const id = this.currentPropertyId++;
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

  async updateCollectionProperty(id: number, updateData: Partial<InsertCollectionProperty>): Promise<CollectionProperty | undefined> {
    const property = this.collectionProperties.get(id);
    if (!property) return undefined;

    const updatedProperty = { ...property, ...updateData };
    this.collectionProperties.set(id, updatedProperty);
    return updatedProperty;
  }

  async deleteCollectionProperty(id: number): Promise<boolean> {
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
    const id = this.currentSessionId++;
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

  async updateKnowledgeDocument(id: number, updateData: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const existingDocument = this.knowledgeDocuments.get(id);
    if (!existingDocument) return undefined;

    const updatedDocument = { ...existingDocument, ...updateData };
    this.knowledgeDocuments.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteKnowledgeDocument(id: number): Promise<boolean> {
    return this.knowledgeDocuments.delete(id);
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

  async updateExtractionRule(id: number, updateData: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined> {
    const existingRule = this.extractionRules.get(id);
    if (!existingRule) return undefined;

    const updatedRule = { ...existingRule, ...updateData };
    this.extractionRules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteExtractionRule(id: number): Promise<boolean> {
    return this.extractionRules.delete(id);
  }

  // Field Validations
  async getFieldValidations(sessionId: number): Promise<FieldValidation[]> {
    return Array.from(this.fieldValidations.values())
      .filter(validation => validation.sessionId === sessionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createFieldValidation(insertValidation: InsertFieldValidation): Promise<FieldValidation> {
    const id = this.currentValidationId++;
    const validation: FieldValidation = {
      ...insertValidation,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.fieldValidations.set(id, validation);
    return validation;
  }

  async updateFieldValidation(id: number, updateData: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined> {
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

  async deleteFieldValidation(id: number): Promise<boolean> {
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
}

// PostgreSQL Storage Implementation
class PostgreSQLStorage implements IStorage {
  private db: any;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL storage');
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }

  // Organizations
  async getOrganizations(): Promise<(Organization & { userCount: number })[]> {
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
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
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

  // For now, implement minimal project methods to prevent errors
  async getProjects(organizationId?: string): Promise<Project[]> {
    if (organizationId) {
      // Include projects owned by organization OR published to the organization
      const result = await this.db
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
        );
      
      // Remove duplicates that might occur from the join
      const uniqueProjects = result.reduce((acc, project) => {
        if (!acc.find(p => p.id === project.id)) {
          acc.push(project);
        }
        return acc;
      }, [] as Project[]);
      
      return uniqueProjects;
    } else {
      return await this.db.select().from(projects);
    }
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
  async getObjectCollections(projectId: number): Promise<(ObjectCollection & { properties: CollectionProperty[] })[]> {
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
  async getKnowledgeDocuments(projectId: number): Promise<KnowledgeDocument[]> {
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
  async updateKnowledgeDocument(id: number, document: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const result = await this.db
      .update(knowledgeDocuments)
      .set(document)
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    return result[0];
  }

  async deleteKnowledgeDocument(id: number): Promise<boolean> {
    const result = await this.db
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id));
    return result.rowCount > 0;
  }

  // Extraction Rules
  async getExtractionRules(projectId: number): Promise<ExtractionRule[]> {
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
  async updateFieldValidation(id: number, validation: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined> { 
    const result = await this.db.update(fieldValidations).set(validation).where(eq(fieldValidations.id, id)).returning();
    return result[0];
  }
  async deleteFieldValidation(id: number): Promise<boolean> { 
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
}

// Use PostgreSQL storage when DATABASE_URL is available, MemStorage otherwise
export const storage = process.env.DATABASE_URL
  ? new PostgreSQLStorage()
  : new MemStorage();
