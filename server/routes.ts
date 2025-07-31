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
      const projects = await storage.getProjectsWithPublishedOrganizations(req.user!.organizationId, req.user!.role);
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Projects with published organizations
  app.get("/api/projects-with-orgs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projects = await storage.getProjectsWithPublishedOrganizations(req.user!.organizationId, req.user!.role);
      res.json(projects);
    } catch (error) {
      console.error("Get projects with orgs error:", error);
      res.status(500).json({ message: "Failed to fetch projects with organizations" });
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
      // Only admin users can create projects
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can create projects" });
      }
      
      const result = insertProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      // Add organizationId and createdBy to the project data
      const projectData = {
        ...result.data,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.id
      };
      
      const project = await storage.createProject(projectData);
      
      // Auto-publish logic: publish to primary organization and user's organization if different
      try {
        const primaryOrg = await storage.getPrimaryOrganization();
        const userOrg = await storage.getOrganization(req.user!.organizationId);
        
        // Always publish to primary organization if it exists
        if (primaryOrg) {
          await storage.publishProjectToOrganization({
            projectId: project.id,
            organizationId: primaryOrg.id
          });
        }
        
        // If user is from non-primary organization, also publish to their organization
        if (userOrg && userOrg.type !== 'primary' && userOrg.id !== primaryOrg?.id) {
          await storage.publishProjectToOrganization({
            projectId: project.id,
            organizationId: userOrg.id
          });
        }
      } catch (publishError) {
        console.warn("Failed to auto-publish project:", publishError);
        // Continue without failing the project creation
      }
      
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

  app.put("/api/projects/:id/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;
      
      if (!status || (status !== "active" && status !== "inactive")) {
        return res.status(400).json({ message: "Status must be 'active' or 'inactive'" });
      }
      
      // Get user's organization to check if they're a primary org admin
      const userOrganization = await storage.getOrganization(req.user!.organizationId);
      const isPrimaryOrgAdmin = userOrganization?.type === 'primary' && req.user!.role === 'admin';
      
      // Primary org admins can update any project, others are restricted to their org
      const organizationFilter = isPrimaryOrgAdmin ? undefined : req.user!.organizationId;
      
      const project = await storage.updateProject(id, { status }, organizationFilter);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Update project status error:", error);
      res.status(500).json({ message: "Failed to update project status" });
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
      
      const duplicatedProject = await storage.duplicateProject(id, name, req.user!.id, req.user!.organizationId);
      if (!duplicatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.status(201).json(duplicatedProject);
    } catch (error) {
      console.error("Duplicate project error:", error);
      res.status(500).json({ message: "Failed to duplicate project" });
    }
  });

  // AI Schema Generation
  app.post("/api/projects/:projectId/generate-schema", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query is required" });
      }
      
      // Verify project belongs to user's organization
      const project = await storage.getProject(projectId, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      console.log(`Generating AI schema for project ${projectId} with query: "${query}"`);
      
      // Call Python AI schema generator
      const python = spawn('python3', ['ai_schema_generator.py', query, projectId]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code !== 0) {
          console.error('AI schema generation failed:', errorOutput);
          return res.status(500).json({ 
            message: "Failed to generate schema", 
            error: errorOutput 
          });
        }
        
        try {
          console.log('Raw Python output:', output);
          console.log('Raw Python output length:', output.length);
          
          // Extract JSON from output (may contain logging information)
          let jsonContent = output.trim();
          
          // Find the JSON object by looking for complete braces
          let braceCount = 0;
          let jsonStart = -1;
          let jsonEnd = -1;
          
          // Find the first opening brace
          for (let i = 0; i < jsonContent.length; i++) {
            if (jsonContent[i] === '{') {
              if (jsonStart === -1) {
                jsonStart = i;
              }
              braceCount++;
            } else if (jsonContent[i] === '}') {
              braceCount--;
              if (braceCount === 0 && jsonStart !== -1) {
                jsonEnd = i;
                break;
              }
            }
          }
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
            jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
          }
          
          console.log('Extracted JSON content:', jsonContent.substring(0, 500) + '...');
          console.log('Raw output:', output);
          
          const result = JSON.parse(jsonContent);
          
          if (!result.success) {
            return res.status(500).json({ 
              message: "AI schema generation failed", 
              error: result.error 
            });
          }
          
          const schema = result.schema;
          console.log('AI generated schema:', JSON.stringify(schema, null, 2));
          
          // Create schema fields and collections in database
          const createdItems = {
            mainObjectName: schema.main_object_name,
            schemaFields: [],
            collections: []
          };
          
          // Update main object name
          if (schema.main_object_name) {
            await storage.updateProject(projectId, { 
              mainObjectName: schema.main_object_name 
            }, req.user!.organizationId);
          }
          
          // Create schema fields
          if (schema.schema_fields && Array.isArray(schema.schema_fields)) {
            for (let i = 0; i < schema.schema_fields.length; i++) {
              const field = schema.schema_fields[i];
              const fieldData = {
                projectId,
                fieldName: field.field_name,
                fieldType: field.field_type,
                description: field.description,
                autoVerificationConfidence: field.auto_verification_confidence || 80,
                choiceOptions: field.choice_options || null,
                orderIndex: i
              };
              
              const createdField = await storage.createProjectSchemaField(fieldData);
              createdItems.schemaFields.push(createdField);
              
              // Create extraction rule if provided
              if (field.extraction_rules) {
                await storage.createExtractionRule({
                  projectId,
                  ruleName: `${field.field_name} Rule`,
                  ruleContent: field.extraction_rules,
                  targetField: field.field_name
                });
              }
            }
          }
          
          // Create collections and their properties
          if (schema.collections && Array.isArray(schema.collections)) {
            for (let i = 0; i < schema.collections.length; i++) {
              const collection = schema.collections[i];
              const collectionData = {
                projectId,
                collectionName: collection.collection_name,
                description: collection.description,
                orderIndex: i
              };
              
              const createdCollection = await storage.createObjectCollection(collectionData);
              
              // Create properties for this collection
              if (collection.properties && Array.isArray(collection.properties)) {
                for (let j = 0; j < collection.properties.length; j++) {
                  const property = collection.properties[j];
                  const propertyData = {
                    collectionId: createdCollection.id,
                    propertyName: property.property_name,
                    propertyType: property.field_type,
                    description: property.description,
                    autoVerificationConfidence: property.auto_verification_confidence || 80,
                    choiceOptions: property.choice_options || null,
                    orderIndex: j
                  };
                  
                  await storage.createCollectionProperty(propertyData);
                  
                  // Create extraction rule if provided
                  if (property.extraction_rules) {
                    await storage.createExtractionRule({
                      projectId,
                      ruleName: `${collection.collection_name}.${property.property_name} Rule`,
                      ruleContent: property.extraction_rules,
                      targetField: `${collection.collection_name}.${property.property_name}`
                    });
                  }
                }
              }
              
              createdItems.collections.push(createdCollection);
            }
          }
          
          // Create knowledge document if suggested
          if (schema.schema_fields?.[0]?.knowledge_documents || schema.collections?.[0]?.properties?.[0]?.knowledge_documents) {
            const knowledgeDocName = schema.schema_fields?.[0]?.knowledge_documents || schema.collections?.[0]?.properties?.[0]?.knowledge_documents;
            if (knowledgeDocName && knowledgeDocName !== "Contract Review Playbook") {
              await storage.createKnowledgeDocument({
                projectId,
                displayName: knowledgeDocName,
                fileName: `${knowledgeDocName.toLowerCase().replace(/\s+/g, '_')}.txt`,
                fileType: 'text',
                content: `AI-generated guidance document for ${schema.main_object_name || 'document'} processing.`,
                description: `AI-generated knowledge document: ${knowledgeDocName}`,
                fileSize: 100
              });
            }
          }
          
          res.json({
            success: true,
            message: "Schema generated successfully",
            data: createdItems
          });
          
        } catch (parseError) {
          console.error('Failed to parse AI schema generation output:', parseError);
          console.error('Raw output:', output);
          res.status(500).json({ 
            message: "Failed to parse AI response", 
            error: parseError.message 
          });
        }
      });
      
    } catch (error) {
      console.error("Generate schema error:", error);
      res.status(500).json({ message: "Failed to generate schema" });
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

  app.put("/api/schema-fields/:id", authenticateToken, async (req: AuthRequest, res) => {
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

  app.delete("/api/schema-fields/:id", authenticateToken, async (req: AuthRequest, res) => {
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
  app.get("/api/collections/:collectionId/properties", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const collectionId = req.params.collectionId;
      const properties = await storage.getCollectionProperties(collectionId);
      res.json(properties);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collection properties" });
    }
  });

  app.post("/api/collections/:collectionId/properties", authenticateToken, async (req: AuthRequest, res) => {
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

  app.put("/api/properties/:id", authenticateToken, async (req: AuthRequest, res) => {
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

  app.delete("/api/properties/:id", authenticateToken, async (req: AuthRequest, res) => {
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
  app.get("/api/projects/:projectId/knowledge", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      const documents = await storage.getKnowledgeDocuments(projectId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge documents" });
    }
  });

  app.post("/api/projects/:projectId/knowledge", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      const result = insertKnowledgeDocumentSchema.safeParse({ ...req.body, projectId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid knowledge document data", errors: result.error.errors });
      }
      
      let processedData = { ...result.data };
      
      // Extract text content from PDFs using Gemini API
      if (result.data.fileType === 'pdf' && result.data.content) {
        try {
          console.log('DEBUG: Processing knowledge document PDF content extraction with Gemini');
          
          // Use Gemini API for PDF text extraction
          const { spawn } = await import('child_process');
          const python = spawn('python3', ['-c', `
import sys
import base64
import json
import io
import os
from google import genai
from google.genai import types

try:
    # Get API key from environment
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY_MISSING")
        sys.exit(1)
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Read the data URL from stdin
    data_url = sys.stdin.read().strip()
    
    # Extract base64 content from data URL
    if data_url.startswith('data:'):
        base64_content = data_url.split(',', 1)[1]
        pdf_bytes = base64.b64decode(base64_content)
        
        # Use Gemini to extract text from PDF
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(
                    data=pdf_bytes,
                    mime_type="application/pdf",
                ),
                "Extract all text content from this PDF document. Return only the text content without any formatting or analysis."
            ],
        )
        
        if response.text and response.text.strip():
            print(response.text.strip())
        else:
            print("GEMINI_EXTRACTION_FAILED")
    else:
        print("INVALID_DATA_URL")
        
except Exception as e:
    print(f"GEMINI_EXTRACTION_ERROR: {str(e)}")
`], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          python.stdin.write(result.data.content);
          python.stdin.end();
          
          let extractedText = '';
          let errorOutput = '';
          
          python.stdout.on('data', (data) => {
            extractedText += data.toString();
          });
          
          python.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          await new Promise((resolve, reject) => {
            python.on('close', (code) => {
              console.log(`DEBUG: Gemini extraction process completed with code: ${code}`);
              console.log(`DEBUG: Extracted text length: ${extractedText.length}`);
              console.log(`DEBUG: Extracted text preview: ${extractedText.substring(0, 500)}`);
              
              if (errorOutput) {
                console.log(`DEBUG: Error output: ${errorOutput}`);
              }
              
              if (code === 0 && extractedText.trim() && 
                  !extractedText.includes('GEMINI_EXTRACTION_FAILED') && 
                  !extractedText.includes('GEMINI_API_KEY_MISSING') &&
                  !extractedText.includes('GEMINI_EXTRACTION_ERROR')) {
                processedData.content = extractedText.trim();
                console.log('DEBUG: Knowledge document Gemini processing successful, extracted', extractedText.length, 'characters of text');
                resolve(extractedText);
              } else {
                console.log('DEBUG: Gemini text extraction failed or returned no content, code:', code);
                console.log('DEBUG: Raw extracted text:', JSON.stringify(extractedText));
                // Leave content empty so user can manually add text
                processedData.content = "";
                resolve("no_content");
              }
            });
            
            python.on('error', (error) => {
              console.error('DEBUG: Python process error:', error);
              processedData.content = "";
              resolve("error");
            });
          });
        } catch (geminiError) {
          console.error('Gemini processing error:', geminiError);
          processedData.content = "";
        }
      }
      
      const document = await storage.createKnowledgeDocument(processedData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Knowledge document creation error:", error);
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

  // Re-process knowledge document with Gemini API
  app.post("/api/knowledge/:id/reprocess", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      
      // Get the existing knowledge document
      const documents = await storage.getKnowledgeDocuments(''); // Get all first
      const document = documents.find(doc => doc.id === id);
      
      if (!document) {
        return res.status(404).json({ message: "Knowledge document not found" });
      }

      if (document.fileType !== 'pdf' || !document.content) {
        return res.status(400).json({ message: "Document must be a PDF with content to reprocess" });
      }

      console.log('DEBUG: Re-processing knowledge document with Gemini:', document.displayName);

      // Use Gemini API for PDF text extraction
      const { spawn } = await import('child_process');
      const python = spawn('python3', ['-c', `
import sys
import base64
import json
import io
import os
from google import genai
from google.genai import types

try:
    # Get API key from environment
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY_MISSING")
        sys.exit(1)
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    
    # Read the data URL from stdin
    data_url = sys.stdin.read().strip()
    
    # Extract base64 content from data URL
    if data_url.startswith('data:'):
        base64_content = data_url.split(',', 1)[1]
        pdf_bytes = base64.b64decode(base64_content)
        
        # Use Gemini to extract text from PDF
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(
                    data=pdf_bytes,
                    mime_type="application/pdf",
                ),
                "Extract all text content from this PDF document. Return only the text content without any formatting or analysis."
            ],
        )
        
        if response.text and response.text.strip():
            print(response.text.strip())
        else:
            print("GEMINI_EXTRACTION_FAILED")
    else:
        print("INVALID_DATA_URL")
        
except Exception as e:
    print(f"GEMINI_EXTRACTION_ERROR: {str(e)}")
`], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      python.stdin.write(document.content);
      python.stdin.end();
      
      let extractedText = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        extractedText += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      await new Promise((resolve, reject) => {
        python.on('close', async (code) => {
          console.log(`DEBUG: Gemini reprocessing completed with code: ${code}`);
          console.log(`DEBUG: Extracted text length: ${extractedText.length}`);
          console.log(`DEBUG: Extracted text preview: ${extractedText.substring(0, 500)}`);
          
          if (errorOutput) {
            console.log(`DEBUG: Error output: ${errorOutput}`);
          }
          
          if (code === 0 && extractedText.trim() && 
              !extractedText.includes('GEMINI_EXTRACTION_FAILED') && 
              !extractedText.includes('GEMINI_API_KEY_MISSING') &&
              !extractedText.includes('GEMINI_EXTRACTION_ERROR')) {
            
            // Update the document with extracted content
            const updatedDocument = await storage.updateKnowledgeDocument(id, {
              content: extractedText.trim()
            });
            
            console.log('DEBUG: Knowledge document Gemini reprocessing successful, extracted', extractedText.length, 'characters');
            res.json({
              success: true,
              extractedLength: extractedText.length,
              document: updatedDocument
            });
          } else {
            console.log('DEBUG: Gemini reprocessing failed');
            res.status(500).json({ 
              message: "Failed to extract content with Gemini",
              error: extractedText.trim()
            });
          }
          resolve(true);
        });
        
        python.on('error', (error) => {
          console.error('DEBUG: Python process error:', error);
          res.status(500).json({ message: "Process error during reprocessing" });
          resolve(false);
        });
      });
    } catch (error) {
      console.error("Reprocess knowledge document error:", error);
      res.status(500).json({ message: "Failed to reprocess knowledge document" });
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

  // Dashboard Statistics
  app.get("/api/dashboard/statistics", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get all projects accessible to the user
      const projects = await storage.getProjectsWithPublishedOrganizations(req.user!.organizationId, req.user!.role);
      
      // Filter only active projects
      const activeProjects = projects.filter(project => project.status !== "inactive");
      const inactiveProjects = projects.filter(project => project.status === "inactive");
      console.log(`Dashboard statistics: ${activeProjects.length} active projects out of ${projects.length} total (${inactiveProjects.length} inactive projects excluded)`);
      
      let totalSessions = 0;
      let verifiedSessions = 0;
      let unverifiedSessions = 0;
      
      // Get session statistics for each accessible project
      for (const project of activeProjects) {
        const projectSessions = await storage.getExtractionSessions(project.id);
        totalSessions += projectSessions.length;
        
        // Check session-level verification status
        for (const session of projectSessions) {
          const validations = await storage.getFieldValidations(session.id);
          
          // A session is considered verified if ALL its validations are verified
          // A session is unverified if ANY validation is unverified or missing
          const allVerified = validations.length > 0 && validations.every(v => v.validationStatus === "verified");
          
          if (allVerified) {
            verifiedSessions++;
          } else {
            unverifiedSessions++;
          }
        }
      }
      
      console.log(`Dashboard statistics: Total ${totalSessions} sessions from ${activeProjects.length} active projects (${verifiedSessions} verified, ${unverifiedSessions} unverified)`);
      
      res.json({
        totalProjects: activeProjects.length,
        totalSessions,
        verifiedSessions,
        unverifiedSessions
      });
    } catch (error) {
      console.error("Dashboard statistics error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard statistics" });
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

  // Direct Excel export endpoint - bypass frontend filtering
  app.get('/api/sessions/:sessionId/direct-excel-data', async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log(`Direct Excel export for session: ${sessionId}`);
      
      // Get session info
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get project info with collections details
      const project = await storage.getProjectWithDetails(session.projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get ALL field validations directly from database
      const allValidations = await storage.getFieldValidations(sessionId);
      console.log(`Found ${allValidations.length} total validations for session ${sessionId}`);
      
      // Log all validations for debugging
      allValidations.forEach((validation, index) => {
        console.log(`${index}: ${validation.fieldName} [${validation.recordIndex}] = "${validation.extractedValue}" (${validation.fieldType})`);
      });

      // Separate schema fields and collection properties
      const schemaValidations = allValidations.filter(v => v.fieldType === 'schema_field');
      const collectionValidations = allValidations.filter(v => v.fieldType === 'collection_property');
      
      console.log(`Schema validations: ${schemaValidations.length}`);
      console.log(`Collection validations: ${collectionValidations.length}`);

      // Deduplicate schema validations - prioritize records with actual values
      const schemaFieldMap = new Map();
      schemaValidations.forEach(validation => {
        const fieldName = validation.fieldName;
        const existing = schemaFieldMap.get(fieldName);
        
        // Prioritize validation with actual extracted value over null/empty
        if (!existing || (!existing.extractedValue && validation.extractedValue)) {
          schemaFieldMap.set(fieldName, validation);
        }
      });

      // Build Excel data structure
      const excelData: any = {
        projectName: project.name,
        mainObjectName: project.mainObjectName || 'Main Object',
        mainObject: Array.from(schemaFieldMap.values()).map(v => ({
          property: v.fieldName || 'Unknown',
          value: v.extractedValue || ''
        })),
        collections: {}
      };

      // Group collection validations by collection name
      const collectionGroups = collectionValidations.reduce((acc, validation) => {
        const collectionName = validation.collectionName || 'Unknown Collection';
        if (!acc[collectionName]) acc[collectionName] = [];
        acc[collectionName].push(validation);
        return acc;
      }, {} as Record<string, any[]>);

      // Process each collection
      Object.entries(collectionGroups).forEach(([collectionName, validations]: [string, any[]]) => {
        console.log(`Processing collection ${collectionName} with ${validations.length} validations`);
        
        // Get property names in schema order instead of alphabetical order
        const collection = project.collections.find(c => c.collectionName === collectionName);
        const propertyNames = collection ? 
          collection.properties
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .map(p => p.propertyName) :
          Array.from(new Set(validations.map(v => {
            const fieldName = v.fieldName || '';
            const match = fieldName.match(/\.([^.\[]+)/);
            return match ? match[1] : fieldName;
          }))).filter(name => name).sort();

        console.log(`Properties for ${collectionName}:`, propertyNames);

        // Group by record index
        const recordMap = new Map();
        validations.forEach(validation => {
          const recordIndex = validation.recordIndex ?? 0;
          const fieldName = validation.fieldName || '';
          const extractedValue = validation.extractedValue || '';
          
          const match = fieldName.match(/\.([^.\[]+)/);
          const propertyName = match ? match[1] : fieldName;
          
          if (!recordMap.has(recordIndex)) {
            recordMap.set(recordIndex, {});
          }
          
          recordMap.get(recordIndex)[propertyName] = extractedValue;
          console.log(`Set record[${recordIndex}][${propertyName}] = "${extractedValue}"`);
        });

        // Convert to array format - ensure ALL records including index 0
        const records = Array.from(recordMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([index, record]) => {
            console.log(`Record ${index}:`, record);
            return propertyNames.map(prop => record[prop] || '');
          });

        excelData.collections[collectionName] = {
          headers: propertyNames,
          records: records
        };
        
        console.log(`Collection ${collectionName} final data:`, {
          headers: propertyNames,
          recordCount: records.length,
          records: records
        });
      });

      console.log('Final Excel data structure ready for export');
      res.json(excelData);
      
    } catch (error) {
      console.error('Error in direct Excel export:', error);
      res.status(500).json({ error: 'Failed to export Excel data' });
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

  // SIMPLIFIED TWO-STEP EXTRACTION PROCESS
  // STEP 1: Extract data from documents (new simplified approach)
  app.post("/api/sessions/:sessionId/extract", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { files, project_data } = req.body;
      
      const projectId = project_data?.projectId || project_data?.id;
      console.log(`STEP 1 EXTRACT: Starting extraction for session ${sessionId}`);
      
      // Convert frontend file format to Python script expected format
      const convertedFiles = (files || []).map((file: any) => ({
        file_name: file.name,
        file_content: file.content, // This is the data URL from FileReader
        mime_type: file.type
      }));

      // Get extraction rules for better AI guidance
      const extractionRules = projectId ? await storage.getExtractionRules(projectId) : [];

      // Prepare data for Python extraction script
      const extractionData = {
        step: "extract",
        session_id: sessionId,
        files: convertedFiles,
        project_schema: {
          schema_fields: project_data?.schemaFields || [],
          collections: project_data?.collections || []
        },
        extraction_rules: extractionRules,
        session_name: project_data?.mainObjectName || "contract"
      };
      
      console.log(`STEP 1: Extracting from ${files?.length || 0} documents with ${extractionRules.length} extraction rules`);
      
      // Call Python extraction script
      const python = spawn('python3', ['ai_extraction_simplified.py']);
      
      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data: any) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data: any) => {
        error += data.toString();
      });
      
      python.on('close', async (code: any) => {
        if (code !== 0) {
          console.error('STEP 1 extraction error:', error);
          return res.status(500).json({ 
            message: "AI extraction failed", 
            error: error 
          });
        }
        
        try {
          const extractedData = JSON.parse(output);
          console.log('STEP 1 extracted data:', JSON.stringify(extractedData, null, 2));
          
          // Store extracted data in session
          await storage.updateExtractionSession(sessionId, {
            status: "extracted",
            extractedData: JSON.stringify(extractedData)
          });
          
          // Create field validation records from extracted data
          await createFieldValidationRecords(sessionId, extractedData, project_data);
          
          res.json({ 
            message: "STEP 1: Data extraction completed", 
            extractedData,
            sessionId 
          });
          
        } catch (error) {
          console.error('STEP 1 processing error:', error);
          res.status(500).json({ message: "Failed to process extraction results" });
        }
      });
      
    } catch (error) {
      console.error("STEP 1 extraction error:", error);
      res.status(500).json({ message: "Failed to start extraction process" });
    }
  });
  
  // STEP 2: Validate field records using AI
  app.post("/api/sessions/:sessionId/validate", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const projectId = req.body.projectId;
      
      console.log(`STEP 2 VALIDATE: Starting validation for session ${sessionId}`);
      
      // Get field validation records for this session
      const fieldValidations = await storage.getFieldValidations(sessionId);
      
      // Get extraction rules and knowledge documents
      const extractionRules = projectId ? await storage.getExtractionRules(projectId) : [];
      const knowledgeDocuments = projectId ? await storage.getKnowledgeDocuments(projectId) : [];
      
      // Prepare data for Python validation script
      const validationData = {
        step: "validate",
        field_validations: fieldValidations,
        extraction_rules: extractionRules,
        knowledge_documents: knowledgeDocuments
      };
      
      console.log(`STEP 2: Validating ${fieldValidations.length} field records`);
      
      // Call Python validation script
      const python = spawn('python3', ['ai_extraction_simplified.py']);
      
      python.stdin.write(JSON.stringify(validationData));
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data: any) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data: any) => {
        error += data.toString();
      });
      
      python.on('close', async (code: any) => {
        if (code !== 0) {
          console.error('STEP 2 validation error:', error);
          return res.status(500).json({ 
            message: "AI validation failed", 
            error: error 
          });
        }
        
        try {
          const validationResult = JSON.parse(output);
          console.log(`STEP 2: Updating ${validationResult.fieldValidations?.length || 0} validation records`);
          
          // Update field validation records with AI validation results
          for (const fv of validationResult.fieldValidations || []) {
            await storage.updateFieldValidation(fv.uuid, {
              validationStatus: fv.validationStatus,
              confidenceScore: fv.validationConfidence,
              aiReasoning: fv.AIReasoning
            });
          }
          
          // Update session status
          await storage.updateExtractionSession(sessionId, {
            status: "validated"
          });
          
          res.json({ 
            message: "STEP 2: Validation completed", 
            updatedCount: validationResult.fieldValidations?.length || 0
          });
          
        } catch (error) {
          console.error('STEP 2 processing error:', error);
          res.status(500).json({ message: "Failed to process validation results" });
        }
      });
      
    } catch (error) {
      console.error("STEP 2 validation error:", error);
      res.status(500).json({ message: "Failed to start validation process" });
    }
  });
  
  // STEP-BY-STEP DEVELOPMENT: Extract document text only
  app.post("/api/sessions/:sessionId/extract-text", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { files } = req.body;
      
      console.log(`TEXT EXTRACTION: Starting text extraction for session ${sessionId}`);
      console.log(`Processing ${files?.length || 0} documents`);
      
      // Convert frontend file format to Python script expected format
      const convertedFiles = (files || []).map((file: any) => ({
        file_name: file.name,
        file_content: file.content, // This is the data URL from FileReader
        mime_type: file.type
      }));

      // Call enhanced Python script with Excel support
      const python = spawn('python3', ['-c', `
import sys
import json
import base64
from google import genai
from google.genai import types
import os

# Read input data
input_data = json.loads(sys.stdin.read())
documents = input_data.get('documents', [])

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

extracted_texts = []

for doc in documents:
    try:
        # Handle data URL format (data:application/pdf;base64,...)
        if doc['file_content'].startswith('data:'):
            content = doc['file_content'].split(',')[1]
        else:
            content = doc['file_content']
        
        file_name = doc['file_name']
        mime_type = doc['mime_type']
        binary_content = base64.b64decode(content)
        
        # Create specialized extraction prompts based on document type
        if ('excel' in mime_type or 
            'spreadsheet' in mime_type or 
            'vnd.ms-excel' in mime_type or 
            'vnd.openxmlformats-officedocument.spreadsheetml' in mime_type or
            file_name.lower().endswith(('.xlsx', '.xls'))):
            # Excel files are not supported by Gemini API - use CSV conversion approach
            try:
                import pandas as pd
                import io
                
                # Read Excel file using pandas
                excel_data = pd.read_excel(io.BytesIO(binary_content), sheet_name=None)
                
                extracted_content = f"Excel file content from {file_name}:\\n\\n"
                
                for sheet_name, df in excel_data.items():
                    extracted_content += f"=== SHEET: {sheet_name} ===\\n"
                    extracted_content += df.to_string(index=False, na_rep='')
                    extracted_content += "\\n\\n"
                
                text_content = extracted_content
                
                extracted_texts.append({
                    "file_name": file_name,
                    "text_content": text_content,
                    "word_count": len(text_content.split()) if text_content else 0
                })
                continue
                
            except Exception as pandas_error:
                # If pandas fails, return error message
                extracted_texts.append({
                    "file_name": file_name,
                    "text_content": f"Error processing Excel file: {str(pandas_error)}. Excel files require special processing that is currently not available.",
                    "word_count": 0
                })
                continue

        elif 'pdf' in mime_type or file_name.lower().endswith('.pdf'):
            # PDF file - extract all text content
            extraction_prompt = f"""Extract ALL text content from this PDF document ({file_name}).

INSTRUCTIONS:
- Extract all readable text from every page
- Preserve document structure and formatting where possible
- Include headers, body text, tables, lists, and any other textual content
- Maintain logical flow and organization of information

RETURN: Complete text content from this PDF document."""

        elif ('word' in mime_type or 
              'vnd.openxmlformats-officedocument.wordprocessingml' in mime_type or
              'application/msword' in mime_type or
              file_name.lower().endswith(('.docx', '.doc'))):
            # Word document - extract all content
            extraction_prompt = f"""Extract ALL content from this Word document ({file_name}).

INSTRUCTIONS:
- Extract all text content including body text, headers, footers, tables
- Preserve document structure and formatting where possible
- Include any embedded text, comments, or annotations
- Maintain logical organization of the content

RETURN: Complete text content from this Word document."""

        else:
            # Generic document extraction
            extraction_prompt = f"""Extract all readable text content from this document ({file_name}).

INSTRUCTIONS:
- Extract all visible text and data
- Preserve structure and organization where possible
- Include tables, lists, and formatted content

RETURN: Complete readable content from this document."""
        
        # Handle different file types based on Gemini API support
        if 'pdf' in mime_type or file_name.lower().endswith('.pdf'):
            # PDF files are fully supported by Gemini API
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=[
                    types.Part.from_bytes(
                        data=binary_content,
                        mime_type=mime_type
                    ),
                    extraction_prompt
                ]
            )
            text_content = response.text if response.text else "No text could be extracted"
        
        elif ('word' in mime_type or 
              'vnd.openxmlformats-officedocument.wordprocessingml' in mime_type or
              'application/msword' in mime_type or
              file_name.lower().endswith(('.docx', '.doc'))):
            # Word document - use python-docx library fallback
            try:
                import io
                from docx import Document
                
                # Create document from binary content
                doc_stream = io.BytesIO(binary_content)
                doc = Document(doc_stream)
                
                # Extract all text content
                text_content_parts = []
                for paragraph in doc.paragraphs:
                    if paragraph.text.strip():
                        text_content_parts.append(paragraph.text.strip())
                
                # Extract text from tables
                for table in doc.tables:
                    for row in table.rows:
                        row_text = []
                        for cell in row.cells:
                            if cell.text.strip():
                                row_text.append(cell.text.strip())
                        if row_text:
                            text_content_parts.append(" | ".join(row_text))
                
                text_content = "\\n".join(text_content_parts)
                
            except Exception as word_error:
                text_content = f"Error extracting Word document: {str(word_error)}"
        
        elif ('excel' in mime_type or 
              'spreadsheet' in mime_type or 
              'vnd.ms-excel' in mime_type or 
              'vnd.openxmlformats-officedocument.spreadsheetml' in mime_type or
              file_name.lower().endswith(('.xlsx', '.xls'))):
            # Excel file - use pandas/openpyxl libraries
            try:
                import io
                import pandas as pd
                
                # Create Excel stream from binary content
                excel_stream = io.BytesIO(binary_content)
                
                # Read all sheets
                all_sheets = pd.read_excel(excel_stream, sheet_name=None, engine='openpyxl' if file_name.lower().endswith('.xlsx') else 'xlrd')
                
                text_content_parts = []
                for sheet_name, df in all_sheets.items():
                    text_content_parts.append(f"=== SHEET: {sheet_name} ===")
                    # Convert dataframe to string representation
                    sheet_text = df.to_string(index=False, na_rep='')
                    text_content_parts.append(sheet_text)
                
                text_content = "\\n\\n".join(text_content_parts)
                
            except Exception as excel_error:
                text_content = f"Error extracting Excel document: {str(excel_error)}"
        
        else:
            # Unsupported format
            text_content = f"Unsupported file format: {mime_type}. Only PDF, Word, and Excel files are supported."
        
        extracted_texts.append({
            "file_name": file_name,
            "text_content": text_content,
            "word_count": len(text_content.split()) if text_content else 0
        })
        
    except Exception as e:
        extracted_texts.append({
            "file_name": doc['file_name'],
            "text_content": f"Error extracting text: {str(e)}",
            "word_count": 0
        })

# Return results
result = {
    "success": True,
    "extracted_texts": extracted_texts,
    "total_documents": len(documents),
    "total_word_count": sum(doc.get('word_count', 0) for doc in extracted_texts)
}

print(json.dumps(result))
`]);
      
      python.stdin.write(JSON.stringify({ documents: convertedFiles }));
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data: any) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data: any) => {
        error += data.toString();
      });
      
      await new Promise((resolve, reject) => {
        python.on('close', async (code: any) => {
          if (code !== 0) {
            console.error('TEXT EXTRACTION error:', error);
            return reject(new Error(`Text extraction failed: ${error}`));
          }
          
          try {
            const result = JSON.parse(output);
            console.log(`TEXT EXTRACTION: Extracted text from ${result.total_documents} documents, ${result.total_word_count} words total`);
            
            // Store extracted text data in session
            await storage.updateExtractionSession(sessionId, {
              status: "text_extracted",
              extractedData: JSON.stringify(result)
            });
            
            resolve(result);
            
          } catch (parseError) {
            console.error('TEXT EXTRACTION JSON parse error:', parseError);
            console.error('Raw output:', output);
            reject(new Error(`Invalid JSON response: ${parseError}`));
          }
        });
      });
      
      res.json({
        message: "Text extraction completed successfully",
        redirect: `/sessions/${sessionId}/schema-view`
      });
      
    } catch (error) {
      console.error("TEXT EXTRACTION error:", error);
      res.status(500).json({ message: "Failed to extract text from documents", error: error.message });
    }
  });

  // Gemini AI extraction endpoint
  app.post("/api/sessions/:sessionId/gemini-extraction", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { extractedTexts, schemaFields, collections, extractionRules, knowledgeDocuments } = req.body;
      
      console.log(`GEMINI EXTRACTION: Starting for session ${sessionId}`);
      console.log(`GEMINI EXTRACTION: Received ${extractedTexts?.length || 0} documents`);
      
      // Log the received data for debugging
      console.log(`GEMINI EXTRACTION: Schema fields: ${schemaFields?.length || 0}`);
      console.log(`GEMINI EXTRACTION: Collections: ${collections?.length || 0}`);
      console.log(`GEMINI EXTRACTION: Extraction rules: ${extractionRules?.length || 0}`);
      
      // If no extracted texts provided, try to get them from the session
      let finalExtractedTexts = extractedTexts || [];
      
      if (finalExtractedTexts.length === 0) {
        console.log(`GEMINI EXTRACTION: No extracted texts provided, attempting to retrieve from database`);
        try {
          // Use the storage interface method that's properly available
          const session = await storage.getExtractionSession(sessionId);
          if (session?.extractedData) {
            const sessionData = JSON.parse(session.extractedData);
            finalExtractedTexts = sessionData.extracted_texts || [];
            console.log(`GEMINI EXTRACTION: Retrieved ${finalExtractedTexts.length} texts from session`);
          }
        } catch (error) {
          console.log(`GEMINI EXTRACTION: Could not get session data: ${(error as any).message}`);
        }
      }
      
      // Call the Python script for AI extraction
      const { spawn } = await import('child_process');
      let output = '';
      let error = '';
      
      const python = spawn('python3', ['ai_extraction_minimal.py'], {
        cwd: process.cwd()
      });

      // Convert extracted texts to document format expected by Python script
      const documents = (finalExtractedTexts || []).map((extracted: any, index: number) => ({
        file_name: extracted.file_name || `document_${index + 1}.pdf`,
        file_content: extracted.text_content || extracted.content || '',
        mime_type: extracted.mime_type || 'application/pdf'
      }));

      // Send the data to Python script in correct format
      const pythonInput = JSON.stringify({
        operation: "extract",
        documents: documents,
        project_schema: {
          schema_fields: schemaFields || [],
          collections: collections || []
        },
        extraction_rules: extractionRules || [],
        knowledge_documents: knowledgeDocuments || [],
        session_name: sessionId
      });
      
      console.log(`GEMINI EXTRACTION: Sending ${documents.length} documents to Python script`);
      console.log(`GEMINI EXTRACTION: First document preview:`, documents[0] ? documents[0].file_name : 'No documents');
      
      python.stdin.write(pythonInput);
      python.stdin.end();

      python.stdout.on('data', (data: any) => {
        output += data.toString();
      });

      python.stderr.on('data', (data: any) => {
        error += data.toString();
      });

      await new Promise((resolve, reject) => {
        python.on('close', async (code: any) => {
          console.log(`GEMINI EXTRACTION: Python exit code: ${code}`);
          console.log(`GEMINI EXTRACTION: Python stdout: ${output.substring(0, 500)}...`);
          if (error) console.log(`GEMINI EXTRACTION: Python stderr: ${error}`);
          
          if (code !== 0) {
            console.error('GEMINI EXTRACTION error:', error);
            return reject(new Error(`Gemini extraction failed: ${error}`));
          }
          
          try {
            const result = JSON.parse(output);
            console.log('GEMINI EXTRACTION result:', result.success ? 'Success' : 'Failed');
            
            // Save extraction prompt and AI response to database if available
            if (result.success && (result.extraction_prompt || result.ai_response)) {
              try {
                await storage.updateExtractionSession(sessionId, {
                  extractionPrompt: result.extraction_prompt,
                  aiResponse: result.ai_response
                });
                console.log('GEMINI EXTRACTION: Saved prompt and AI response to database');
              } catch (saveError) {
                console.error('GEMINI EXTRACTION: Failed to save prompt/response:', saveError);
              }
            }
            
            res.json({
              success: result.success,
              extractedData: result.extractedData || result.result || result.field_validations,
              field_validations: result.field_validations,
              error: result.error
            });
            
            resolve(result);
          } catch (parseError) {
            console.error('GEMINI EXTRACTION JSON parse error:', parseError);
            console.error('Raw output:', output);
            reject(new Error(`Invalid JSON response: ${parseError}`));
          }
        });
      });
      
    } catch (error) {
      console.error("GEMINI EXTRACTION error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to process Gemini extraction" 
      });
    }
  });

  // Get project schema data for AI processing view
  app.get('/api/projects/:projectId/schema-data', async (req, res) => {
    try {
      const projectId = req.params.projectId;
      console.log('Getting schema data for project:', projectId);
      
      // Get real project data from storage
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Get schema fields and collections
      const schemaFields = await storage.getProjectSchemaFields(projectId);
      const collections = await storage.getObjectCollections(projectId);
      const knowledgeDocuments = await storage.getKnowledgeDocuments(projectId);
      const extractionRules = await storage.getExtractionRules(projectId);
      
      console.log('Schema fields for project:', projectId, '- Found', schemaFields.length, 'fields');
      console.log('DEBUG - Extraction rules found:', extractionRules.length);
      extractionRules.forEach((rule, index) => {
        console.log(`DEBUG - Rule ${index}:`, { id: rule.id, ruleName: rule.ruleName, ruleContent: rule.ruleContent?.substring(0, 50) + '...' });
      });
      
      const responseData = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          mainObjectName: project.mainObjectName
        },
        schema_fields: schemaFields.map(field => ({
          id: field.id,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description,
          orderIndex: field.orderIndex
        })),
        collections: collections.map(collection => ({
          id: collection.id,
          collectionName: collection.collectionName,
          description: collection.description,
          properties: collection.properties.map(prop => ({
            id: prop.id,
            propertyName: prop.propertyName,
            propertyType: prop.propertyType,
            description: prop.description
          }))
        })),
        knowledge_documents: knowledgeDocuments.map(doc => ({
          id: doc.id,
          displayName: doc.displayName,
          content: doc.content || ""
        })),
        extraction_rules: extractionRules.map(rule => ({
          id: rule.id,
          ruleName: rule.ruleName,
          ruleContent: rule.ruleContent,
          targetFields: rule.targetField ? [rule.targetField] : []
        }))
      };


      res.json(responseData);
    } catch (error) {
      console.error('Error getting schema data:', error);
      res.status(500).json({ error: 'Failed to get schema data', details: error.message });
    }
  });

  // Get schema data for AI processing view (session-based route for compatibility)
  app.get('/api/sessions/:sessionId/schema-data', async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log('Getting schema data for session:', sessionId);
      
      // Get the session to find the project ID
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const projectId = session.projectId;
      console.log('Found project ID for schema data:', projectId);
      
      // Get project data
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Get schema fields, collections, knowledge documents, and extraction rules
      const [schemaFields, collections, knowledgeDocuments, extractionRules] = await Promise.all([
        storage.getProjectSchemaFields(projectId),
        storage.getProjectCollections(projectId),
        storage.getKnowledgeDocuments(projectId),
        storage.getExtractionRules(projectId)
      ]);
      
      // Get properties for all collections
      const collectionsWithProperties = await Promise.all(
        collections.map(async (collection) => {
          const properties = await storage.getCollectionProperties(collection.id);
          return {
            ...collection,
            properties: properties || []
          };
        })
      );

      const responseData = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          mainObjectName: project.mainObjectName
        },
        schema_fields: schemaFields.map(field => ({
          id: field.id,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description,
          orderIndex: field.orderIndex
        })),
        collections: collectionsWithProperties.map(collection => ({
          id: collection.id,
          collectionName: collection.collectionName,
          description: collection.description,
          properties: collection.properties.map((prop: any) => ({
            id: prop.id,
            propertyName: prop.propertyName,
            propertyType: prop.propertyType,
            description: prop.description,
            orderIndex: prop.orderIndex
          }))
        })),
        knowledge_documents: knowledgeDocuments.map(doc => ({
          id: doc.id,
          displayName: doc.displayName,
          content: doc.content
        })),
        extraction_rules: extractionRules.map(rule => ({
          id: rule.id,
          ruleName: rule.ruleName,
          ruleContent: rule.ruleContent,
          targetFields: rule.targetFields
        }))
      };

      console.log('Successfully retrieved real schema data:', {
        project: project.name,
        schemaFields: schemaFields.length,
        collections: collections.length,
        knowledgeDocs: knowledgeDocuments.length,
        extractionRules: extractionRules.length,
        knowledgeDocContentLength: knowledgeDocuments.map(doc => doc.content?.length || 0)
      });

      res.json(responseData);
    } catch (error) {
      console.error('Error getting schema data:', error);
      res.status(500).json({ error: 'Failed to get schema data', details: (error as any).message });
    }
  });



  // Save validation results to field_validations database
  app.post("/api/sessions/:sessionId/save-validations", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { extractedData, validations } = req.body;

      console.log(`SAVE VALIDATIONS: Request body keys:`, Object.keys(req.body));
      console.log(`SAVE VALIDATIONS: extractedData type:`, typeof extractedData);
      console.log(`SAVE VALIDATIONS: validations type:`, typeof validations);

      // Handle both formats: direct validations array or extractedData JSON string
      let parsedValidations = null;
      
      if (validations && Array.isArray(validations)) {
        parsedValidations = validations;
        console.log(`SAVE VALIDATIONS: Using direct validations array, ${validations.length} items`);
      } else if (extractedData) {
        try {
          // Parse the extracted data JSON string
          const jsonData = typeof extractedData === 'string' ? JSON.parse(extractedData) : extractedData;
          if (jsonData.field_validations && Array.isArray(jsonData.field_validations)) {
            parsedValidations = jsonData.field_validations;
            console.log(`SAVE VALIDATIONS: Parsed from extractedData, ${parsedValidations.length} field_validations`);
          } else {
            console.error('SAVE VALIDATIONS: extractedData does not contain field_validations array');
            return res.status(400).json({ error: 'Invalid data format: missing field_validations array' });
          }
        } catch (parseError) {
          console.error('SAVE VALIDATIONS: JSON parse error:', parseError);
          return res.status(400).json({ error: 'Invalid JSON in extractedData' });
        }
      } else {
        console.error('SAVE VALIDATIONS: No validations or extractedData provided');
        return res.status(400).json({ error: 'No validation data provided' });
      }

      console.log(`SAVE VALIDATIONS: Starting for session ${sessionId}, ${parsedValidations.length} validations`);

      // Get the session to verify it exists
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Update existing validation records instead of creating duplicates
      const savedValidations = [];
      for (const validation of parsedValidations) {
        try {
          // For collection properties, we need to set the correct fieldName with index
          let fieldName = validation.field_name;
          let collectionName = null;
          
          // If it's a collection property, ensure proper indexed field name
          if (validation.field_type === 'collection_property') {
            const recordIndex = validation.record_index || 0;
            
            // Check if the field name already has an index
            if (!fieldName.includes('[')) {
              // Add the index if missing (e.g., "Parties.Name" -> "Parties.Name[0]")
              fieldName = `${fieldName}[${recordIndex}]`;
            }
            
            // Extract collection name from field name
            const collectionMatch = fieldName.match(/^(.+)\./);
            if (collectionMatch) {
              collectionName = collectionMatch[1];
            }
          }
          
          // Find existing validation record for this field
          const existingValidations = await storage.getFieldValidations(sessionId);
          const existingValidation = existingValidations.find(v => 
            v.fieldName === fieldName && 
            v.fieldId === validation.field_id &&
            v.recordIndex === (validation.record_index || 0)
          );
          
          let savedValidation;
          if (existingValidation) {
            // Update existing record with extracted data
            const updateData = {
              extractedValue: validation.extracted_value,
              confidenceScore: Math.round(parseFloat(validation.confidence_score) * 100), // Convert to integer percentage
              validationStatus: validation.validation_status === 'pending' ? 'unverified' : validation.validation_status,
              aiReasoning: validation.ai_reasoning,
              documentSource: validation.document_source || 'Unknown'
            };
            console.log(`SAVE VALIDATIONS: Updating ${fieldName} with data:`, updateData);
            savedValidation = await storage.updateFieldValidation(existingValidation.id, updateData);
            console.log(`SAVE VALIDATIONS: Updated existing field ${fieldName}, result:`, savedValidation);
          } else {
            // Create new record if none exists
            const createData = {
              sessionId: sessionId,
              fieldId: validation.field_id,
              fieldType: validation.field_type,
              collectionName: collectionName,
              extractedValue: validation.extracted_value,
              confidenceScore: Math.round(parseFloat(validation.confidence_score) * 100), // Convert to integer percentage
              validationStatus: validation.validation_status === 'pending' ? 'unverified' : validation.validation_status,
              aiReasoning: validation.ai_reasoning,
              documentSource: validation.document_source || 'Unknown',
              recordIndex: validation.record_index || 0
            };
            console.log(`SAVE VALIDATIONS: Creating new field ${fieldName} with data:`, createData);
            savedValidation = await storage.createFieldValidation(createData);
            console.log(`SAVE VALIDATIONS: Created new field ${fieldName}, result:`, savedValidation);
          }
          
          savedValidations.push(savedValidation);
        } catch (error) {
          console.error(`SAVE VALIDATIONS: Failed to save field ${validation.field_name}:`, error);
        }
      }

      console.log(`SAVE VALIDATIONS: Successfully saved ${savedValidations.length} validations`);

      res.json({
        success: true,
        message: `Successfully saved ${savedValidations.length} field validations`,
        savedCount: savedValidations.length,
        validations: savedValidations
      });

    } catch (error) {
      console.error("SAVE VALIDATIONS error:", error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to save validation results', 
        details: error.message 
      });
    }
  });

  // SINGLE-STEP PROCESS: Extract and validate in one AI call (eliminates field mapping confusion)
  app.post("/api/sessions/:sessionId/process", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { files, project_data } = req.body;
      const projectId = project_data?.projectId || project_data?.id;
      
      console.log(`SINGLE-STEP PROCESS: Starting extract+validate for session ${sessionId}`);
      
      // Convert frontend file format to Python script expected format
      const convertedFiles = (files || []).map((file: any) => ({
        file_name: file.name,
        file_content: file.content, // This is the data URL from FileReader
        mime_type: file.type
      }));

      console.log(`SINGLE-STEP: Processing ${convertedFiles.length} documents with integrated extraction and validation`);
      
      // Get extraction rules and knowledge documents for comprehensive AI guidance
      const extractionRules = projectId ? await storage.getExtractionRules(projectId) : [];
      const knowledgeDocuments = projectId ? await storage.getKnowledgeDocuments(projectId) : [];
      
      // Prepare data for Python single-step extraction script
      const extractionData = {
        documents: convertedFiles,
        project_schema: {
          schema_fields: project_data?.schemaFields || [],
          collections: project_data?.collections || []
        },
        extraction_rules: extractionRules,
        knowledge_documents: knowledgeDocuments,
        session_id: sessionId
      };
      
      // Call Python single-step extraction script
      const python = spawn('python3', ['ai_extraction_single_step.py']);
      
      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data: any) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data: any) => {
        error += data.toString();
      });
      
      await new Promise((resolve, reject) => {
        python.on('close', async (code: any) => {
          if (code !== 0) {
            console.error('SINGLE-STEP PROCESS error:', error);
            return reject(new Error(`AI single-step extraction failed: ${error}`));
          }
          
          try {
            const result = JSON.parse(output);
            console.log('SINGLE-STEP PROCESS result:', JSON.stringify(result, null, 2));
            
            if (!result.success) {
              return reject(new Error(result.error || 'Single-step extraction failed'));
            }
            
            const { fieldValidations, aggregatedExtraction } = result;
            
            // Store aggregated extraction data in session
            await storage.updateExtractionSession(sessionId, {
              status: "extracted",
              extractedData: JSON.stringify(aggregatedExtraction)
            });
            
            // Create field validation records directly from AI results
            console.log(`SINGLE-STEP: Creating ${fieldValidations?.length || 0} field validation records`);
            
            // Get project schema to map field names to IDs
            const project = await storage.getProject(projectId);
            const schemaFields = await storage.getProjectSchemaFields(projectId);
            const collections = await storage.getObjectCollections(projectId);
            
            // Helper function to map field names to database IDs
            async function mapFieldNameToId(fieldName: string, schemaFields: any[], collections: any[]) {
              // Handle schema fields (e.g., "Number of Parties")
              const schemaField = schemaFields.find(f => f.name === fieldName);
              if (schemaField) {
                return {
                  fieldId: schemaField.id,
                  fieldType: 'schema_field',
                  collectionName: null,
                  recordIndex: null
                };
              }
              
              // Handle collection properties (e.g., "Parties.Name[0]")
              const collectionMatch = fieldName.match(/^(.+)\.(.+)\[(\d+)\]$/);
              if (collectionMatch) {
                const [, collectionName, propertyName, indexStr] = collectionMatch;
                const recordIndex = parseInt(indexStr);
                
                const collection = collections.find(c => c.name === collectionName);
                if (collection) {
                  const properties = await storage.getCollectionProperties(collection.id);
                  const property = properties.find(p => p.name === propertyName);
                  
                  if (property) {
                    return {
                      fieldId: property.id,
                      fieldType: 'collection_property',
                      collectionName: collectionName,
                      recordIndex: recordIndex
                    };
                  }
                }
              }
              
              return null;
            }
            
            for (const validation of fieldValidations || []) {
              try {
                // Map field name to proper field ID and type
                const fieldMapping = await mapFieldNameToId(validation.field_name, schemaFields, collections);
                
                if (!fieldMapping) {
                  console.warn(`Could not map field name: ${validation.field_name}`);
                  continue;
                }
                
                await storage.createFieldValidation({
                  sessionId: validation.session_id,
                  fieldId: fieldMapping.fieldId,
                  fieldType: fieldMapping.fieldType,
                  collectionName: fieldMapping.collectionName,
                  recordIndex: fieldMapping.recordIndex,
                  extractedValue: validation.extracted_value,
                  validationStatus: validation.validation_status,
                  confidenceScore: validation.validation_confidence,
                  aiReasoning: validation.ai_reasoning,
                  manualInput: false
                });
                
                console.log(`Created validation for ${validation.field_name} -> ${fieldMapping.fieldType}`);
              } catch (validationError) {
                console.error(`Error creating validation record for ${validation.field_name}:`, validationError);
              }
            }
            
            resolve({ fieldValidations, aggregatedExtraction });
            
          } catch (parseError) {
            console.error('SINGLE-STEP PROCESS JSON parse error:', parseError);
            console.error('Raw output:', output);
            reject(new Error(`Invalid JSON response: ${parseError}`));
          }
        });
      });
      
      console.log(`SINGLE-STEP PROCESS: Completed extract+validate for session ${sessionId}`);
      
      res.json({
        message: "SINGLE-STEP PROCESS: Extract and validate completed successfully"
      });
      
    } catch (error) {
      console.error("CHAINED PROCESS error:", error);
      res.status(500).json({ message: "Failed to complete extraction and validation", error: error.message });
    }
  });
  
  // Helper function to convert field names to camelCase for AI extraction matching
  function convertToCamelCase(fieldName: string): string {
    return fieldName
      .split(' ')
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  }

  // Helper function to create field validation records from extracted data
  async function createFieldValidationRecords(sessionId: string, extractedData: any, project_data: any) {
    const sessionObject = Object.values(extractedData)[0] as any; // Get the main object (e.g., "contract")
    
    console.log(`Creating field validation records for session ${sessionId}`);
    console.log(`Session object keys:`, Object.keys(sessionObject));
    
    // Create records for schema fields
    if (project_data?.schemaFields) {
      for (const field of project_data.schemaFields) {
        // Convert field name to match what AI extracted (camelCase)
        const camelCaseFieldName = convertToCamelCase(field.fieldName);
        let fieldValue = sessionObject[camelCaseFieldName];
        
        // Let AI handle ALL calculations - no programmatic logic
        
        console.log(`Creating validation record for schema field: ${field.fieldName} = ${fieldValue} (looking for ${camelCaseFieldName})`);
        
        await storage.createFieldValidation({
          sessionId,
          fieldType: 'schema_field',
          fieldId: field.id,
          fieldName: field.fieldName,
          collectionName: null,
          recordIndex: 0,
          extractedValue: fieldValue !== undefined ? fieldValue?.toString() : null,
          originalExtractedValue: fieldValue !== undefined ? fieldValue?.toString() : null,
          originalConfidenceScore: fieldValue ? 95 : 20,
          originalAiReasoning: fieldValue ? "Calculated from extracted data" : "Not found in document",
          validationStatus: "unverified",
          aiReasoning: "Pending validation",
          manuallyVerified: false,
          confidenceScore: fieldValue ? 95 : 20 // Set proper initial confidence
        });
        
        console.log(`Created validation record for schema field: ${field.fieldName} = ${fieldValue}`);
      }
    }
    
    // Create records for collection properties
    if (project_data?.collections) {
      for (const collection of project_data.collections) {
        const collectionName = collection.collectionName || collection.objectName;
        // Try both original name and lowercase version
        let collectionData = sessionObject[collectionName] || sessionObject[collectionName.toLowerCase()];
        
        console.log(`Looking for collection ${collectionName}, found:`, Array.isArray(collectionData) ? `${collectionData.length} items` : 'not found');
        
        if (Array.isArray(collectionData)) {
          for (let index = 0; index < collectionData.length; index++) {
            const item = collectionData[index];
            
            for (const property of collection.properties || []) {
              // Try different property name variations to match AI extraction
              let propertyValue = item[property.propertyName]; // Try exact match first
              
              if (propertyValue === undefined) {
                // Try camelCase version
                const camelCaseProperty = convertToCamelCase(property.propertyName);
                propertyValue = item[camelCaseProperty];
              }
              
              if (propertyValue === undefined) {
                // Try lowercase version
                propertyValue = item[property.propertyName.toLowerCase()];
              }
              
              if (propertyValue === undefined) {
                // Try common AI field name mappings
                const commonMappings = {
                  'Name': 'partyName',
                  'Address': 'address',
                  'Company Name': 'companyName',
                  'Party Name': 'partyName'
                };
                
                if (commonMappings[property.propertyName]) {
                  propertyValue = item[commonMappings[property.propertyName]];
                }
              }
              
              const fieldName = `${collectionName}.${property.propertyName}[${index}]`;
              
              console.log(`Mapping ${property.propertyName} for item ${index}: found value "${propertyValue}" (searched in:`, Object.keys(item), ')');
              
              await storage.createFieldValidation({
                sessionId,
                fieldType: 'collection_property',
                fieldId: property.id,
                fieldName,
                collectionName,
                recordIndex: index,
                extractedValue: propertyValue !== undefined ? propertyValue : null,
                originalExtractedValue: propertyValue !== undefined ? propertyValue : null,
                originalConfidenceScore: propertyValue ? 95 : 20,
                originalAiReasoning: propertyValue ? "Extracted during AI processing" : "Not found in document",
                validationStatus: "unverified",
                aiReasoning: "Pending validation",
                manuallyVerified: false,
                confidenceScore: propertyValue ? 95 : 20 // Set proper initial confidence
              });
              
              console.log(`Created validation record for collection property: ${fieldName} = ${propertyValue}`);
            }
          }
        }
      }
    }
    
    console.log(`Field validation record creation completed for session ${sessionId}`);
  }
  
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
      
      const updatedValidation = await storage.updateFieldValidation(id, result.data);
      if (!updatedValidation) {
        return res.status(404).json({ message: "Validation not found" });
      }
      res.json(updatedValidation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update field validation" });
    }
  });

  app.delete("/api/validations/:id", async (req, res) => {
    try {
      const id = req.params.id; // UUID string, not integer
      const deleted = await storage.deleteFieldValidation(id);
      if (!deleted) {
        return res.status(404).json({ message: "Validation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete field validation" });
    }
  });

  // Session Export Routes
  app.get("/api/sessions/:sessionId/export/xlsx", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const session = await storage.getExtractionSessionWithValidations(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Note: Excel export would be implemented here
      res.status(501).json({ message: "Excel export not yet implemented" });
    } catch (error) {
      res.status(500).json({ message: "Failed to export session data" });
    }
  });

  // Session Details
  app.get("/api/sessions/:sessionId/with-validations", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const session = await storage.getExtractionSessionWithValidations(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session with validations" });
    }
  });

  // Batch validation endpoint for post-extraction validation
  app.post("/api/sessions/:sessionId/batch-validate", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log(`BATCH_VALIDATION: Starting batch validation for session ${sessionId}`);
      
      // Get session and project data
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const projectId = session.projectId;
      
      // Get project schema, rules, and knowledge documents
      const [project, extractionRules, knowledgeDocuments, existingValidations] = await Promise.all([
        storage.getProjectWithDetails(projectId),
        storage.getExtractionRules(projectId),
        storage.getKnowledgeDocuments(projectId),
        storage.getFieldValidations(sessionId)
      ]);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Prepare session data for batch validation
      const sessionData = {
        session_id: sessionId,
        project_schema: {
          schema_fields: project.schemaFields || [],
          collections: project.collections || []
        },
        extraction_rules: extractionRules || [],
        knowledge_documents: knowledgeDocuments || [],
        existing_validations: existingValidations.map(v => ({
          field_name: v.fieldName,
          field_id: v.fieldId,
          field_type: v.fieldType,
          extracted_value: v.extractedValue,
          confidence_score: v.confidenceScore,
          validation_status: v.validationStatus,
          ai_reasoning: v.aiReasoning,
          auto_verification_threshold: 80 // Default threshold
        }))
      };

      // Call Python batch validation function
      const python = spawn('python3', ['-c', `
import sys
import json
sys.path.append('.')
from ai_extraction import run_post_extraction_batch_validation

# Read input data
input_data = json.loads(sys.stdin.read())

# Run batch validation
results = run_post_extraction_batch_validation(input_data)

print(json.dumps(results))
`]);

      let pythonOutput = '';
      let pythonError = '';
      
      python.stdout.on('data', (data) => {
        pythonOutput += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        pythonError += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code !== 0) {
          console.error(`BATCH_VALIDATION: Python process failed with code ${code}`);
          console.error(`BATCH_VALIDATION: Error output: ${pythonError}`);
          return res.status(500).json({ 
            message: "Batch validation failed", 
            error: pythonError,
            code: code
          });
        }

        try {
          const validationResults = JSON.parse(pythonOutput);
          
          if (validationResults.success) {
            // Update database with new validation data
            const updatedValidations = validationResults.updated_validations || [];
            
            console.log(`BATCH_VALIDATION: Processing ${updatedValidations.length} updated validations`);
            
            // Update database with validation results
            for (const validation of updatedValidations) {
              await storage.updateFieldValidation(validation.uuid, {
                validationStatus: validation.validationStatus,
                confidenceScore: validation.validationConfidence,
                aiReasoning: validation.AIReasoning
              });
            }
            
            console.log(`BATCH_VALIDATION: Completed successfully`);
            res.json({
              success: true,
              message: "Batch validation completed",
              validationsUpdated: updatedValidations.length
            });
          } else {
            res.status(500).json({
              message: "Batch validation failed",
              error: validationResults.error
            });
          }
        } catch (parseError) {
          console.error(`BATCH_VALIDATION: Failed to parse Python output: ${parseError}`);
          console.error(`BATCH_VALIDATION: Raw output: ${pythonOutput}`);
          res.status(500).json({
            message: "Failed to parse batch validation results",
            error: parseError.message,
            output: pythonOutput
          });
        }
      });

    } catch (error) {
      console.error("BATCH_VALIDATION error:", error);
      res.status(500).json({ message: "Failed to start batch validation process" });
    }
  });

  // AI Extraction Endpoint
  app.post("/api/sessions/:sessionId/extract", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log(`AI_EXTRACTION: Starting extraction for session ${sessionId}`);
      
      // Get session and project data
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const projectId = session.projectId;
      
      // Get project schema data for AI processing
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const schemaFields = await storage.getProjectSchemaFields(projectId);
      const collections = await storage.getObjectCollections(projectId);
      const knowledgeDocuments = await storage.getKnowledgeDocuments(projectId);
      const extractionRules = await storage.getExtractionRules(projectId);

      // Get collection properties for each collection
      const collectionsWithProperties = await Promise.all(
        collections.map(async (collection) => {
          const properties = await storage.getCollectionProperties(collection.id);
          return { ...collection, properties };
        })
      );

      // Prepare data for Python extraction script
      const extractionData = {
        session_id: sessionId,
        project_id: projectId,
        schema_fields: schemaFields,
        collections: collectionsWithProperties,
        knowledge_documents: knowledgeDocuments,
        extraction_rules: extractionRules,
        session_data: {
          files: JSON.parse(session.fileMetadata || '[]'),
          documents: session.documents || []
        }
      };

      console.log(`AI_EXTRACTION: Processing ${schemaFields.length} schema fields and ${collectionsWithProperties.length} collections`);

      // Call Python AI extraction script
      const { spawn } = await import('child_process');
      let pythonOutput = '';
      let pythonError = '';

      const python = spawn('python3', ['-c', `
import sys
import json
sys.path.append('.')
from ai_extraction import run_full_document_extraction

# Read input data
input_data = json.loads(sys.stdin.read())

# Run AI extraction
result = run_full_document_extraction(input_data)

# Output result
print(json.dumps(result))
`]);

      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();

      python.stdout.on('data', (data) => {
        pythonOutput += data.toString();
      });

      python.stderr.on('data', (data) => {
        pythonError += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code !== 0) {
          console.error(`AI_EXTRACTION: Python process failed with code ${code}`);
          console.error(`AI_EXTRACTION: Error output: ${pythonError}`);
          return res.status(500).json({ 
            message: "AI extraction failed", 
            error: pythonError,
            code: code
          });
        }

        try {
          const extractionResults = JSON.parse(pythonOutput);
          
          if (extractionResults.success) {
            console.log(`AI_EXTRACTION: Successfully processed ${extractionResults.total_fields_processed || 0} fields`);
            
            // Update session status to completed
            await storage.updateExtractionSession(sessionId, {
              status: 'completed',
              extractedData: JSON.stringify(extractionResults.extracted_data || {}),
              documentCount: extractionResults.document_count || 0
            });

            // Create field validations from results
            if (extractionResults.field_validations) {
              for (const validation of extractionResults.field_validations) {
                await storage.createFieldValidation({
                  sessionId: sessionId,
                  fieldType: validation.field_type || 'schema_field',
                  fieldId: validation.field_id,
                  fieldName: validation.field_name,
                  collectionName: validation.collection_name || null,
                  recordIndex: validation.record_index || 0,
                  extractedValue: validation.extracted_value,
                  validationStatus: validation.validation_status || 'pending',
                  aiReasoning: validation.ai_reasoning || '',
                  manuallyVerified: false,
                  confidenceScore: validation.confidence_score || 0
                });
              }
            }
            
            res.json({
              success: true,
              message: "AI extraction completed successfully",
              extraction_results: extractionResults,
              session_id: sessionId
            });
          } else {
            console.log('AI_EXTRACTION: Extraction failed:', extractionResults.error);
            res.status(500).json({ 
              message: "AI extraction failed",
              error: extractionResults.error
            });
          }
        } catch (parseError) {
          console.error(`AI_EXTRACTION: Failed to parse Python output: ${parseError}`);
          console.error(`AI_EXTRACTION: Raw output: ${pythonOutput}`);
          res.status(500).json({
            message: "Failed to parse extraction results",
            error: parseError.message,
            output: pythonOutput
          });
        }
      });

    } catch (error) {
      console.error("AI_EXTRACTION error:", error);
      res.status(500).json({ message: "Failed to start AI extraction process" });
    }
  });

  // Project Publishing Routes
  
  // Get project published organizations
  app.get("/api/projects/:projectId/publishing", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const publishedOrganizations = await storage.getProjectPublishedOrganizations(projectId);
      res.json(publishedOrganizations);
    } catch (error) {
      console.error("Error getting project published organizations:", error);
      res.status(500).json({ message: "Failed to get published organizations" });
    }
  });

  // Publish project to organization
  app.post("/api/projects/:projectId/publishing", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const { organizationId } = req.body;
      
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }

      const publishing = await storage.publishProjectToOrganization({
        projectId,
        organizationId
      });
      
      res.json(publishing);
    } catch (error) {
      console.error("Error publishing project to organization:", error);
      res.status(500).json({ message: "Failed to publish project" });
    }
  });

  // Unpublish project from organization
  app.delete("/api/projects/:projectId/publishing/:organizationId", async (req, res) => {
    try {
      const { projectId, organizationId } = req.params;
      
      const success = await storage.unpublishProjectFromOrganization(projectId, organizationId);
      
      if (success) {
        res.json({ message: "Project unpublished successfully" });
      } else {
        res.status(404).json({ message: "Publishing relationship not found" });
      }
    } catch (error) {
      console.error("Error unpublishing project:", error);
      res.status(500).json({ message: "Failed to unpublish project" });
    }
  });

  // Create HTTP server and return it
  const httpServer = createServer(app);
  return httpServer;
};
