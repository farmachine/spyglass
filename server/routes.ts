import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { storage } from "./storage";
import { 
  insertProjectSchema,
  insertProjectSchemaFieldSchema,
  insertObjectCollectionSchema,
  insertCollectionPropertySchema,
  insertKnowledgeDocumentSchema,
  insertExtractionRuleSchema,
  insertExtractionSessionSchema,
  insertFieldValidationSchema,
  insertOrganizationSchema,
  insertUserSchema,
  loginSchema,
  registerUserSchema,
  resetPasswordSchema,
  changePasswordApiSchema,
  insertProjectPublishingSchema
} from "@shared/schema";
import { authenticateToken, requireAdmin, generateToken, comparePassword, hashPassword, type AuthRequest } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication Routes

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid login data", errors: result.error.errors });
      }

      // Find user by email
      const user = await storage.getUserByEmail(result.data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await comparePassword(result.data.password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Get user with organization data
      const userWithOrg = await storage.getUserWithOrganization(user.id);
      if (!userWithOrg) {
        return res.status(500).json({ message: "Failed to get user organization data" });
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
        isTemporaryPassword: user.isTemporaryPassword
      });

      // Remove password hash from response
      const { passwordHash, ...userResponse } = userWithOrg;

      res.json({ 
        user: userResponse, 
        token,
        message: "Login successful",
        requiresPasswordChange: user.isTemporaryPassword
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserWithOrganization(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user data" });
    }
  });

  // Password reset endpoint (Admin only)
  app.post("/api/auth/reset-password", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = resetPasswordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid reset data", errors: result.error.errors });
      }

      const { tempPassword } = await storage.resetUserPassword(result.data.userId, result.data.tempPassword);
      res.json({ 
        tempPassword,
        message: "Password reset successfully. User must change password on next login." 
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Change password endpoint (for users with temporary passwords)
  app.post("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const result = changePasswordApiSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid password data", errors: result.error.errors });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await comparePassword(result.data.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password and update
      const newPasswordHash = await hashPassword(result.data.newPassword);
      await storage.updateUserPassword(req.user!.id, newPasswordHash, false);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Organization Routes (Admin only)
  app.get("/api/organizations", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Get organizations error:", error);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.post("/api/organizations", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = insertOrganizationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid organization data", errors: result.error.errors });
      }

      const organization = await storage.createOrganization(result.data);
      res.status(201).json(organization);
    } catch (error) {
      console.error("Create organization error:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  // User Management Routes (Admin only)
  app.get("/api/users/:organizationId", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const organizationId = req.params.organizationId;
      const users = await storage.getUsers(organizationId);
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = registerUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists" });
      }

      const user = await storage.createUser(result.data);
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/organizations", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = insertOrganizationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid organization data", errors: result.error.errors });
      }

      const organization = await storage.createOrganization(result.data);
      res.status(201).json(organization);
    } catch (error) {
      console.error("Create organization error:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  // Update user (Admin only)
  app.put("/api/users/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = req.params.id;
      const updateData = req.body;
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Update organization (Admin only)
  app.put("/api/organizations/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const orgId = req.params.id;
      const updateData = req.body;
      const updatedOrg = await storage.updateOrganization(orgId, updateData);
      
      if (!updatedOrg) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      res.json(updatedOrg);
    } catch (error) {
      console.error("Update organization error:", error);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // Delete organization (Admin only)
  app.delete("/api/organizations/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const orgId = req.params.id;
      
      // Check if organization is primary type
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      if (org.type === "primary") {
        return res.status(403).json({ message: "Primary organizations cannot be deleted" });
      }
      
      const deleted = await storage.deleteOrganization(orgId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      res.json({ message: "Organization deleted successfully" });
    } catch (error) {
      console.error("Delete organization error:", error);
      res.status(500).json({ message: "Failed to delete organization" });
    }
  });

  // Projects (with authentication and organization filtering)
  app.get("/api/projects", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projects = await storage.getProjects(req.user!.organizationId, req.user!.role);
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const project = await storage.getProjectWithDetails(id, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Get project error:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const result = insertProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      // Add organizationId to the project data
      const projectData = {
        ...result.data,
        organizationId: req.user!.organizationId
      };
      
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Create project error:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const result = insertProjectSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      const project = await storage.updateProject(id, result.data, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Update project error:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteProject(id, req.user!.organizationId);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.post("/api/projects/:id/duplicate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { name } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Project name is required" });
      }
      
      const duplicatedProject = await storage.duplicateProject(id, name, req.user!.organizationId);
      if (!duplicatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.status(201).json(duplicatedProject);
    } catch (error) {
      console.error("Duplicate project error:", error);
      res.status(500).json({ message: "Failed to duplicate project" });
    }
  });

  // Project Schema Fields
  app.get("/api/projects/:projectId/schema", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      // Verify project belongs to user's organization
      const project = await storage.getProject(projectId, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const fields = await storage.getProjectSchemaFields(projectId);
      res.json(fields);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schema fields" });
    }
  });

  app.post("/api/projects/:projectId/schema", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      const result = insertProjectSchemaFieldSchema.safeParse({
        ...req.body,
        projectId
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid schema field data", errors: result.error.errors });
      }
      
      const field = await storage.createProjectSchemaField(result.data);
      
      // Mark project as setup complete if this is the first field
      const project = await storage.getProject(projectId);
      if (project && !project.isInitialSetupComplete) {
        await storage.updateProject(projectId, { isInitialSetupComplete: true });
      }
      
      res.status(201).json(field);
    } catch (error) {
      res.status(500).json({ message: "Failed to create schema field" });
    }
  });

  app.put("/api/schema-fields/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use string ID for UUID compatibility
      const result = insertProjectSchemaFieldSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid schema field data", errors: result.error.errors });
      }
      
      const field = await storage.updateProjectSchemaField(id, result.data);
      if (!field) {
        return res.status(404).json({ message: "Schema field not found" });
      }
      res.json(field);
    } catch (error) {
      res.status(500).json({ message: "Failed to update schema field" });
    }
  });

  app.delete("/api/schema-fields/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use string ID for UUID compatibility
      const deleted = await storage.deleteProjectSchemaField(id);
      if (!deleted) {
        return res.status(404).json({ message: "Schema field not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete schema field" });
    }
  });

  // Object Collections
  app.get("/api/projects/:projectId/collections", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      // Verify project belongs to user's organization
      const project = await storage.getProject(projectId, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const collections = await storage.getObjectCollections(projectId);
      res.json(collections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.post("/api/projects/:projectId/collections", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      const result = insertObjectCollectionSchema.safeParse({
        ...req.body,
        projectId
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid collection data", errors: result.error.errors });
      }
      
      const collection = await storage.createObjectCollection(result.data);
      
      // Mark project as setup complete if this is the first collection
      const project = await storage.getProject(projectId);
      if (project && !project.isInitialSetupComplete) {
        await storage.updateProject(projectId, { isInitialSetupComplete: true });
      }
      
      res.status(201).json(collection);
    } catch (error) {
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  app.put("/api/collections/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const result = insertObjectCollectionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid collection data", errors: result.error.errors });
      }
      
      const collection = await storage.updateObjectCollection(id, result.data);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      res.json(collection);
    } catch (error) {
      res.status(500).json({ message: "Failed to update collection" });
    }
  });

  app.delete("/api/collections/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      
      // First, get the collection to verify organization access
      const collection = await storage.getObjectCollection(id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      
      // Verify the collection's project belongs to user's organization
      const project = await storage.getProject(collection.projectId, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Collection not found" });
      }
      
      const deleted = await storage.deleteObjectCollection(id);
      if (!deleted) {
        return res.status(404).json({ message: "Collection not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete collection error:", error);
      res.status(500).json({ message: "Failed to delete collection" });
    }
  });

  // Collection Properties
  app.get("/api/collections/:collectionId/properties", async (req, res) => {
    try {
      const collectionId = req.params.collectionId;
      const properties = await storage.getCollectionProperties(collectionId);
      res.json(properties);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collection properties" });
    }
  });

  app.post("/api/collections/:collectionId/properties", async (req, res) => {
    try {
      const collectionId = req.params.collectionId;
      const result = insertCollectionPropertySchema.safeParse({
        ...req.body,
        collectionId
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid property data", errors: result.error.errors });
      }
      
      const property = await storage.createCollectionProperty(result.data);
      res.status(201).json(property);
    } catch (error) {
      res.status(500).json({ message: "Failed to create collection property" });
    }
  });

  app.put("/api/properties/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use string ID for UUID compatibility
      const result = insertCollectionPropertySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid property data", errors: result.error.errors });
      }
      
      const property = await storage.updateCollectionProperty(id, result.data);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ message: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use string ID for UUID compatibility
      const deleted = await storage.deleteCollectionProperty(id);
      if (!deleted) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Knowledge Documents
  app.get("/api/projects/:projectId/knowledge", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const documents = await storage.getKnowledgeDocuments(projectId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge documents" });
    }
  });

  app.post("/api/projects/:projectId/knowledge", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const result = insertKnowledgeDocumentSchema.safeParse({ ...req.body, projectId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid knowledge document data", errors: result.error.errors });
      }
      
      const document = await storage.createKnowledgeDocument(result.data);
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ message: "Failed to create knowledge document" });
    }
  });

  app.patch("/api/knowledge/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertKnowledgeDocumentSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid knowledge document data", errors: result.error.errors });
      }
      
      const document = await storage.updateKnowledgeDocument(id, result.data);
      if (!document) {
        return res.status(404).json({ message: "Knowledge document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Update knowledge document error:", error);
      res.status(500).json({ message: "Failed to update knowledge document" });
    }
  });

  app.delete("/api/knowledge/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const success = await storage.deleteKnowledgeDocument(id);
      if (!success) {
        return res.status(404).json({ message: "Knowledge document not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete knowledge document error:", error);
      res.status(500).json({ message: "Failed to delete knowledge document" });
    }
  });

  // Extraction Rules
  app.get("/api/projects/:projectId/rules", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const rules = await storage.getExtractionRules(projectId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch extraction rules" });
    }
  });

  app.post("/api/projects/:projectId/rules", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const result = insertExtractionRuleSchema.safeParse({ ...req.body, projectId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid extraction rule data", errors: result.error.errors });
      }
      
      const rule = await storage.createExtractionRule(result.data);
      res.status(201).json(rule);
    } catch (error) {
      res.status(500).json({ message: "Failed to create extraction rule" });
    }
  });

  app.patch("/api/rules/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use string ID for UUID compatibility
      const result = insertExtractionRuleSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid extraction rule data", errors: result.error.errors });
      }
      
      const rule = await storage.updateExtractionRule(id, result.data);
      if (!rule) {
        return res.status(404).json({ message: "Extraction rule not found" });
      }
      res.json(rule);
    } catch (error) {
      res.status(500).json({ message: "Failed to update extraction rule" });
    }
  });

  app.delete("/api/rules/:id", async (req, res) => {
    try {
      const id = req.params.id; // Use string ID for UUID compatibility
      const success = await storage.deleteExtractionRule(id);
      if (!success) {
        return res.status(404).json({ message: "Extraction rule not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete extraction rule" });
    }
  });

  // Extraction Sessions
  app.get("/api/projects/:projectId/sessions", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const sessions = await storage.getExtractionSessions(projectId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch extraction sessions" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const session = await storage.getExtractionSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.put("/api/sessions/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertExtractionSessionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid session data", errors: result.error.errors });
      }
      
      const session = await storage.updateExtractionSession(id, result.data);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // Helper function to generate initial field validations for a new session
  const generateInitialFieldValidations = async (sessionId: string, projectId: string) => {
    try {
      const project = await storage.getProjectWithDetails(projectId);
      if (!project) {
        console.error(`Project ${projectId} not found for session ${sessionId}`);
        return;
      }

      console.log(`Generating validations for session ${sessionId}, project ${projectId}`);
      console.log(`Schema fields: ${project.schemaFields.length}, Collections: ${project.collections.length}`);

      // Create validations for schema fields
      for (const field of project.schemaFields) {
        await storage.createFieldValidation({
          sessionId,
          fieldType: 'schema_field',
          fieldId: field.id,
          fieldName: field.fieldName,
          collectionName: null,
          recordIndex: 0,
          extractedValue: null,
          validationStatus: 'pending',
          aiReasoning: null,
          manuallyVerified: false,
          confidenceScore: 0
        });
      }

      // Create validations for collection properties
      for (const collection of project.collections) {
        const properties = await storage.getCollectionProperties(collection.id);
        console.log(`Collection ${collection.collectionName} has ${properties.length} properties`);
        
        for (const property of properties) {
          // Create at least one instance for each collection property
          await storage.createFieldValidation({
            sessionId,
            fieldType: 'collection_property',
            fieldId: property.id,
            fieldName: `${collection.collectionName}.${property.propertyName}[0]`,
            collectionName: collection.collectionName,
            recordIndex: 0,
            extractedValue: null,
            validationStatus: 'pending',
            aiReasoning: null,
            manuallyVerified: false,
            confidenceScore: 0
          });
        }
      }
    } catch (error) {
      console.error(`Error generating initial field validations for session ${sessionId}:`, error);
      throw error;
    }
  };

  app.post("/api/projects/:projectId/sessions", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const result = insertExtractionSessionSchema.safeParse({ ...req.body, projectId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid extraction session data", errors: result.error.errors });
      }
      
      const session = await storage.createExtractionSession(result.data);
      
      // Generate initial field validations for the new session
      await generateInitialFieldValidations(session.id, projectId);
      
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to create extraction session" });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertExtractionSessionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid extraction session data", errors: result.error.errors });
      }
      
      const session = await storage.updateExtractionSession(id, result.data);
      if (!session) {
        return res.status(404).json({ message: "Extraction session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update extraction session" });
    }
  });

  // Update extracted data for a session
  app.patch("/api/sessions/:sessionId/data", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { extractedData } = req.body;
      
      const session = await storage.updateExtractionSession(sessionId, {
        extractedData: JSON.stringify(extractedData),
        status: 'verified'
      });
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating extracted data:", error);
      res.status(500).json({ message: "Failed to update extracted data" });
    }
  });

  // Process extraction session with AI
  app.post("/api/sessions/:sessionId/process", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { files, project_data } = req.body;
      
      // Use the imported spawn function
      
      // Get knowledge documents for the project
      const projectId = project_data?.projectId || project_data?.id;
      console.log('DEBUG: Getting knowledge documents for project:', projectId);
      console.log('DEBUG: project_data keys:', Object.keys(project_data || {}));
      const knowledgeDocuments = projectId ? await storage.getKnowledgeDocuments(projectId) : [];
      console.log('DEBUG: Retrieved knowledge documents:', knowledgeDocuments.length);
      if (knowledgeDocuments.length > 0) {
        console.log('DEBUG: First doc details:', {
          displayName: knowledgeDocuments[0].displayName,
          hasContent: !!knowledgeDocuments[0].content,
          contentLength: knowledgeDocuments[0].content ? knowledgeDocuments[0].content.length : 0
        });
      }
      
      // Prepare data for Python script
      const extractionData = {
        session_id: sessionId,
        files: files || [],
        project_schema: {
          schema_fields: project_data?.schemaFields || [],
          collections: project_data?.collections || []
        },
        extraction_rules: project_data?.extractionRules || [],
        knowledge_documents: knowledgeDocuments || []
      };
      
      console.log('DEBUG: Knowledge documents before sending to Python:', extractionData.knowledge_documents.length);
      console.log('Extraction data being sent to Python:', JSON.stringify(extractionData, null, 2).substring(0, 1000) + '...');
      console.log('Extraction rules specifically:', JSON.stringify(extractionData.extraction_rules, null, 2));
      console.log('Knowledge documents specifically:', JSON.stringify(extractionData.knowledge_documents, null, 2));
      
      // Call Python extraction script
      const python = spawn('python3', ['-c', `
import sys
import json
sys.path.append('.')
try:
    from ai_extraction import process_extraction_session
    data = json.loads(sys.stdin.read())
    result = process_extraction_session(data)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`]);
      
      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data: any) => {
        const outputText = data.toString();
        console.log('Python stdout chunk:', outputText.substring(0, 200) + '...');
        output += outputText;
      });
      
      python.stderr.on('data', (data: any) => {
        const errorText = data.toString();
        console.log('Python stderr (debugging):', errorText);
        error += errorText;
      });
      
      python.on('close', async (code: any) => {
        if (code !== 0) {
          console.error('Python script error:', error);
          return res.status(500).json({ 
            message: "AI extraction failed", 
            error: error 
          });
        }
        
        try {
          console.log('Raw Python output:', output.substring(0, 500) + '...');
          const result = JSON.parse(output);
          console.log('Parsed Python result:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
          
          // Update session status
          await storage.updateExtractionSession(sessionId, {
            status: "completed",
            extractedData: JSON.stringify(result)
          });
          
          // Get existing field validations for this session
          const existingValidations = await storage.getFieldValidations(sessionId);
          
          // Update field validations from the extraction results
          if (result.processed_documents && result.processed_documents.length > 0) {
            for (const doc of result.processed_documents) {
              const fieldValidations = doc.extraction_result?.field_validations || [];
              console.log(`Processing ${fieldValidations.length} field validations for document: ${doc.file_name}`);
              for (const validation of fieldValidations) {
                // Extract record index from field name if present
                const fieldName = validation.field_name;
                const recordIndexMatch = fieldName.match(/\[(\d+)\]$/);
                const recordIndex = recordIndexMatch ? parseInt(recordIndexMatch[1]) : 0;
                
                // Extract collection name from field name
                const isCollectionProperty = fieldName.includes('.');
                const collectionName = isCollectionProperty ? fieldName.split('.')[0] : null;
                
                // Try to find existing validation for this field
                const existingValidation = existingValidations.find(v => v.fieldName === fieldName);
                
                // Normalize extracted value based on field type
                let normalizedValue = validation.extracted_value;
                
                // Get field type for proper value normalization
                if (validation.field_type === 'DATE') {
                  // For date fields, convert various invalid values to null
                  if (!normalizedValue || 
                      normalizedValue === "null" || 
                      normalizedValue === "undefined" || 
                      normalizedValue === "Not found" ||
                      normalizedValue === "" ||
                      normalizedValue.toString().toLowerCase().includes("not found") ||
                      normalizedValue.toString().toLowerCase().includes("not available")) {
                    normalizedValue = null;
                  } else {
                    // Try to parse and validate date format
                    try {
                      const date = new Date(normalizedValue);
                      if (!isNaN(date.getTime())) {
                        // Format as ISO date string (YYYY-MM-DD)
                        normalizedValue = date.toISOString().split('T')[0];
                      } else {
                        normalizedValue = null;
                      }
                    } catch (error) {
                      normalizedValue = null;
                    }
                  }
                }
                
                if (existingValidation) {
                  // Update existing validation
                  await storage.updateFieldValidation(existingValidation.id, {
                    extractedValue: normalizedValue,
                    validationStatus: validation.validation_status,
                    aiReasoning: validation.ai_reasoning,
                    confidenceScore: validation.confidence_score
                  });
                } else {
                  // Create new validation if it doesn't exist
                  await storage.createFieldValidation({
                    sessionId,
                    fieldType: isCollectionProperty ? 'collection_property' : 'schema_field',
                    fieldId: validation.field_id,
                    fieldName: fieldName,
                    collectionName,
                    recordIndex,
                    extractedValue: normalizedValue,
                    validationStatus: validation.validation_status,
                    aiReasoning: validation.ai_reasoning,
                    manuallyVerified: false,
                    confidenceScore: validation.confidence_score
                  });
                }
              }
            }
          }
          
          res.json(result);
        } catch (parseError: any) {
          console.error('Error parsing Python output:', parseError);
          res.status(500).json({ 
            message: "Failed to parse extraction results",
            error: parseError?.message || "Unknown parse error"
          });
        }
      });
      
    } catch (error) {
      console.error("Error processing extraction session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Field Validations
  app.get("/api/sessions/:sessionId/validations", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const validations = await storage.getFieldValidations(sessionId);
      res.json(validations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch field validations" });
    }
  });

  app.post("/api/sessions/:sessionId/validations", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const result = insertFieldValidationSchema.safeParse({
        ...req.body,
        sessionId
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid field validation data", errors: result.error.errors });
      }
      
      const validation = await storage.createFieldValidation(result.data);
      res.status(201).json(validation);
    } catch (error) {
      res.status(500).json({ message: "Failed to create field validation" });
    }
  });

  app.put("/api/validations/:id", async (req, res) => {
    try {
      const id = req.params.id; // UUID string, not integer
      const result = insertFieldValidationSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid validation data", errors: result.error.errors });
      }
      
      const validation = await storage.updateFieldValidation(id, result.data);
      if (!validation) {
        return res.status(404).json({ message: "Field validation not found" });
      }
      res.json(validation);
    } catch (error) {
      console.error("Error updating field validation:", error);
      res.status(500).json({ message: "Failed to update field validation" });
    }
  });

  app.delete("/api/validations/:id", async (req, res) => {
    try {
      const id = req.params.id; // UUID string, not integer
      const deleted = await storage.deleteFieldValidation(id);
      if (!deleted) {
        return res.status(404).json({ message: "Field validation not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting field validation:", error);
      res.status(500).json({ message: "Failed to delete field validation" });
    }
  });

  app.get("/api/sessions/:sessionId/with-validations", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const session = await storage.getSessionWithValidations(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session with validations" });
    }
  });

  // Project Publishing Routes
  app.get("/api/projects/:projectId/publishing", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      
      // Verify project belongs to user's organization
      const project = await storage.getProject(projectId, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const publishedOrganizations = await storage.getProjectPublishedOrganizations(projectId);
      res.json(publishedOrganizations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project publishing" });
    }
  });

  app.post("/api/projects/:projectId/publishing", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      
      // Verify project belongs to user's organization
      const project = await storage.getProject(projectId, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const result = insertProjectPublishingSchema.safeParse({
        ...req.body,
        projectId
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid publishing data", errors: result.error.errors });
      }
      
      const publishing = await storage.publishProjectToOrganization(result.data);
      res.status(201).json(publishing);
    } catch (error) {
      res.status(500).json({ message: "Failed to publish project to organization" });
    }
  });

  app.delete("/api/projects/:projectId/publishing/:organizationId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      const organizationId = req.params.organizationId;
      
      // Verify project belongs to user's organization
      const project = await storage.getProject(projectId, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const deleted = await storage.unpublishProjectFromOrganization(projectId, organizationId);
      if (!deleted) {
        return res.status(404).json({ message: "Publishing relationship not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to unpublish project from organization" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
