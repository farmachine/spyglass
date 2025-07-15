import { 
  projects, 
  projectSchemaFields, 
  objectCollections, 
  collectionProperties, 
  extractionSessions,
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
}

export class MemStorage implements IStorage {
  private projects: Map<number, Project>;
  private projectSchemaFields: Map<number, ProjectSchemaField>;
  private objectCollections: Map<number, ObjectCollection>;
  private collectionProperties: Map<number, CollectionProperty>;
  private extractionSessions: Map<number, ExtractionSession>;
  
  private currentProjectId: number;
  private currentFieldId: number;
  private currentCollectionId: number;
  private currentPropertyId: number;
  private currentSessionId: number;

  constructor() {
    this.projects = new Map();
    this.projectSchemaFields = new Map();
    this.objectCollections = new Map();
    this.collectionProperties = new Map();
    this.extractionSessions = new Map();
    
    this.currentProjectId = 1;
    this.currentFieldId = 1;
    this.currentCollectionId = 1;
    this.currentPropertyId = 1;
    this.currentSessionId = 1;
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

    return {
      ...project,
      schemaFields,
      collections,
      sessions
    };
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const project: Project = {
      ...insertProject,
      id,
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
      createdAt: new Date(),
    };
    this.extractionSessions.set(id, session);
    return session;
  }

  async updateExtractionSession(id: number, updateData: Partial<InsertExtractionSession>): Promise<ExtractionSession | undefined> {
    const session = this.extractionSessions.get(id);
    if (!session) return undefined;

    const updatedSession = { ...session, ...updateData };
    this.extractionSessions.set(id, updatedSession);
    return updatedSession;
  }
}

export const storage = new MemStorage();
