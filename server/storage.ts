import { 
  projects, 
  projectSchemaFields, 
  objectCollections, 
  collectionProperties, 
  extractionSessions,
  knowledgeDocuments,
  extractionRules,
  fieldValidations,
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
  type ProjectWithDetails
} from "@shared/schema";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectWithDetails(id: number): Promise<ProjectWithDetails | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Project Schema Fields
  getProjectSchemaFields(projectId: number): Promise<ProjectSchemaField[]>;
  createProjectSchemaField(field: InsertProjectSchemaField): Promise<ProjectSchemaField>;
  updateProjectSchemaField(id: number, field: Partial<InsertProjectSchemaField>): Promise<ProjectSchemaField | undefined>;
  deleteProjectSchemaField(id: number): Promise<boolean>;

  // Object Collections
  getObjectCollections(projectId: number): Promise<ObjectCollection[]>;
  createObjectCollection(collection: InsertObjectCollection): Promise<ObjectCollection>;
  updateObjectCollection(id: number, collection: Partial<InsertObjectCollection>): Promise<ObjectCollection | undefined>;
  deleteObjectCollection(id: number): Promise<boolean>;

  // Collection Properties
  getCollectionProperties(collectionId: number): Promise<CollectionProperty[]>;
  createCollectionProperty(property: InsertCollectionProperty): Promise<CollectionProperty>;
  updateCollectionProperty(id: number, property: Partial<InsertCollectionProperty>): Promise<CollectionProperty | undefined>;
  deleteCollectionProperty(id: number): Promise<boolean>;

  // Extraction Sessions
  getExtractionSessions(projectId: number): Promise<ExtractionSession[]>;
  createExtractionSession(session: InsertExtractionSession): Promise<ExtractionSession>;
  updateExtractionSession(id: number, session: Partial<InsertExtractionSession>): Promise<ExtractionSession | undefined>;

  // Knowledge Documents
  getKnowledgeDocuments(projectId: number): Promise<KnowledgeDocument[]>;
  createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: number, document: Partial<InsertKnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: number): Promise<boolean>;

  // Extraction Rules
  getExtractionRules(projectId: number): Promise<ExtractionRule[]>;
  createExtractionRule(rule: InsertExtractionRule): Promise<ExtractionRule>;
  updateExtractionRule(id: number, rule: Partial<InsertExtractionRule>): Promise<ExtractionRule | undefined>;
  deleteExtractionRule(id: number): Promise<boolean>;

  // Field Validations
  getFieldValidations(sessionId: number): Promise<FieldValidation[]>;
  createFieldValidation(validation: InsertFieldValidation): Promise<FieldValidation>;
  updateFieldValidation(id: number, validation: Partial<InsertFieldValidation>): Promise<FieldValidation | undefined>;
  deleteFieldValidation(id: number): Promise<boolean>;
  getSessionWithValidations(sessionId: number): Promise<ExtractionSessionWithValidation | undefined>;
}

export class MemStorage implements IStorage {
  private projects: Map<number, Project>;
  private projectSchemaFields: Map<number, ProjectSchemaField>;
  private objectCollections: Map<number, ObjectCollection>;
  private collectionProperties: Map<number, CollectionProperty>;
  private extractionSessions: Map<number, ExtractionSession>;
  private knowledgeDocuments: Map<number, KnowledgeDocument>;
  private extractionRules: Map<number, ExtractionRule>;
  private fieldValidations: Map<number, FieldValidation>;
  
  private currentProjectId: number;
  private currentFieldId: number;
  private currentCollectionId: number;
  private currentPropertyId: number;
  private currentSessionId: number;
  private currentDocumentId: number;
  private currentRuleId: number;
  private currentValidationId: number;

  constructor() {
    this.projects = new Map();
    this.projectSchemaFields = new Map();
    this.objectCollections = new Map();
    this.collectionProperties = new Map();
    this.extractionSessions = new Map();
    this.knowledgeDocuments = new Map();
    this.extractionRules = new Map();
    this.fieldValidations = new Map();
    
    this.currentProjectId = 1;
    this.currentFieldId = 1;
    this.currentCollectionId = 1;
    this.currentPropertyId = 1;
    this.currentSessionId = 1;
    this.currentDocumentId = 1;
    this.currentRuleId = 1;
    this.currentValidationId = 1;
    
    // Initialize with sample data for development
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Create a sample project
    const project = {
      id: 1,
      name: "Sample Invoice Processing",
      description: "Extract data from invoices and receipts",
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
        orderIndex: 1,
      },
      {
        id: 2,
        projectId: 1,
        fieldName: "Invoice Date",
        fieldType: "DATE" as const,
        description: "The date when the invoice was issued",
        orderIndex: 2,
      },
      {
        id: 3,
        projectId: 1,
        fieldName: "Vendor Name",
        fieldType: "TEXT" as const,
        description: "The name of the vendor or supplier",
        orderIndex: 3,
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
        orderIndex: 1,
      },
      {
        id: 2,
        collectionId: 1,
        propertyName: "Quantity",
        propertyType: "NUMBER" as const,
        description: "Number of items",
        orderIndex: 2,
      },
      {
        id: 3,
        collectionId: 1,
        propertyName: "Unit Price",
        propertyType: "NUMBER" as const,
        description: "Price per unit",
        orderIndex: 3,
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
    
    // Add sample field validations
    const validations = [
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
        fieldName: "Line Items.Description",
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
        fieldName: "Line Items.Quantity",
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
        fieldName: "Line Items.Unit Price",
        collectionName: "Line Items",
        recordIndex: 0,
        extractedValue: "25.50",
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
        fieldName: "Line Items.Description",
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
        fieldName: "Line Items.Quantity",
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
        fieldName: "Line Items.Unit Price",
        collectionName: "Line Items",
        recordIndex: 1,
        extractedValue: "45.15",
        validationStatus: "pending" as const,
        aiReasoning: "Price value needs verification - format looks correct but confidence is low",
        manuallyVerified: false,
        confidenceScore: 68
      }
    ];
    
    validations.forEach(validation => this.fieldValidations.set(validation.id, validation));
    this.currentValidationId = 10;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectWithDetails(id: number): Promise<ProjectWithDetails | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const schemaFields = Array.from(this.projectSchemaFields.values())
      .filter(field => field.projectId === id)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const collections = Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === id)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      .map(collection => ({
        ...collection,
        properties: Array.from(this.collectionProperties.values())
          .filter(prop => prop.collectionId === collection.id)
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      }));

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
      extractionRules
    };
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const project: Project = {
      ...insertProject,
      id,
      description: insertProject.description || null,
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: number, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject = { ...project, ...updateData };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    // Delete related data first
    const schemaFields = Array.from(this.projectSchemaFields.values())
      .filter(field => field.projectId === id);
    schemaFields.forEach(field => this.projectSchemaFields.delete(field.id));

    const collections = Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === id);
    collections.forEach(collection => {
      // Delete collection properties
      const properties = Array.from(this.collectionProperties.values())
        .filter(prop => prop.collectionId === collection.id);
      properties.forEach(prop => this.collectionProperties.delete(prop.id));
      
      // Delete collection
      this.objectCollections.delete(collection.id);
    });

    const sessions = Array.from(this.extractionSessions.values())
      .filter(session => session.projectId === id);
    sessions.forEach(session => this.extractionSessions.delete(session.id));

    return this.projects.delete(id);
  }

  // Project Schema Fields
  async getProjectSchemaFields(projectId: number): Promise<ProjectSchemaField[]> {
    return Array.from(this.projectSchemaFields.values())
      .filter(field => field.projectId === projectId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  async createProjectSchemaField(insertField: InsertProjectSchemaField): Promise<ProjectSchemaField> {
    const id = this.currentFieldId++;
    const field: ProjectSchemaField = {
      ...insertField,
      id,
      description: insertField.description || null,
      orderIndex: insertField.orderIndex || null,
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
  async getObjectCollections(projectId: number): Promise<ObjectCollection[]> {
    return Array.from(this.objectCollections.values())
      .filter(collection => collection.projectId === projectId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
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
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  async createCollectionProperty(insertProperty: InsertCollectionProperty): Promise<CollectionProperty> {
    const id = this.currentPropertyId++;
    const property: CollectionProperty = {
      ...insertProperty,
      id,
      description: insertProperty.description || null,
      orderIndex: insertProperty.orderIndex || null,
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

export const storage = new MemStorage();
