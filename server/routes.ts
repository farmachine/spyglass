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
  insertProjectPublishingSchema,
  insertChatMessageSchema,
  insertExcelWizardryFunctionSchema
} from "@shared/schema";
import { generateChatResponse } from "./chatService";
import { authenticateToken, requireAdmin, generateToken, comparePassword, hashPassword, type AuthRequest } from "./auth";
import { UserRole } from "@shared/schema";
import { log } from "./vite";

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
        role: user.role as UserRole,
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

  // Update user project order (User can update their own)
  app.put("/api/users/:userId/project-order", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.params.userId;
      const { projectOrder } = req.body;
      
      // Users can only update their own project order, unless they're an admin
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized to update this user's project order" });
      }

      if (!Array.isArray(projectOrder)) {
        return res.status(400).json({ message: "Project order must be an array" });
      }
      
      const updatedUser = await storage.updateUserProjectOrder(userId, projectOrder);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ success: true, projectOrder: updatedUser.projectOrder });
    } catch (error) {
      console.error("Update user project order error:", error);
      res.status(500).json({ message: "Failed to update project order" });
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
      
      // Get existing schema fields to determine the next orderIndex
      const existingFields = await storage.getProjectSchemaFields(projectId);
      const maxOrderIndex = existingFields.reduce((max, field) => {
        return Math.max(max, field.orderIndex || 0);
      }, 0);
      
      const result = insertProjectSchemaFieldSchema.safeParse({
        ...req.body,
        projectId,
        orderIndex: req.body.orderIndex ?? (maxOrderIndex + 1) // Add to bottom if no orderIndex provided
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
      
      // Get existing collections to determine the next orderIndex
      const existingCollections = await storage.getObjectCollections(projectId);
      const maxOrderIndex = existingCollections.reduce((max, collection) => {
        return Math.max(max, collection.orderIndex || 0);
      }, 0);
      
      const result = insertObjectCollectionSchema.safeParse({
        ...req.body,
        projectId,
        orderIndex: req.body.orderIndex ?? (maxOrderIndex + 1) // Add to bottom if no orderIndex provided
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid collection data", errors: result.error.errors });
      }
      
      const collection = await storage.createObjectCollection(result.data);
      
      // Automatically create an identifier field for new collections
      const identifierProperty = await storage.createCollectionProperty({
        collectionId: collection.id,
        propertyName: "ID",
        propertyType: "TEXT",
        description: "Unique identifier for items in this collection",
        isIdentifier: true,
        orderIndex: 0
      });
      
      // Set this property as the collection's identifier field
      await storage.setCollectionIdentifierField(collection.id, identifierProperty.id);
      
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
      
      // Get existing properties to determine the next orderIndex
      const existingProperties = await storage.getCollectionProperties(collectionId);
      const maxOrderIndex = existingProperties.reduce((max, prop) => {
        return Math.max(max, prop.orderIndex || 0);
      }, 0);
      
      const result = insertCollectionPropertySchema.safeParse({
        ...req.body,
        collectionId,
        orderIndex: req.body.orderIndex ?? (maxOrderIndex + 1) // Add to bottom if no orderIndex provided
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
      
      // Check if this is an identifier field before deletion
      const property = await storage.getCollectionPropertyById(id);
      if (property?.isIdentifier) {
        return res.status(400).json({ message: "Cannot delete identifier field. Set another field as identifier first." });
      }
      
      const deleted = await storage.deleteCollectionProperty(id);
      if (!deleted) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Collection identifier field management
  app.post("/api/collections/:collectionId/set-identifier/:propertyId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { collectionId, propertyId } = req.params;
      console.log(`Setting identifier field: collectionId=${collectionId}, propertyId=${propertyId}`);
      
      // Verify the property exists and belongs to the collection
      const property = await storage.getCollectionPropertyById(propertyId);
      console.log(`Property found:`, property);
      if (!property || property.collectionId !== collectionId) {
        console.log(`Property validation failed: property=${!!property}, collectionMatch=${property?.collectionId === collectionId}`);
        return res.status(404).json({ message: "Property not found in this collection" });
      }
      
      // Ensure property is TEXT type for identifier
      if (property.propertyType !== 'TEXT') {
        console.log(`Property type validation failed: ${property.propertyType} !== TEXT`);
        return res.status(400).json({ message: "Identifier field must be a TEXT field" });
      }
      
      const success = await storage.setCollectionIdentifierField(collectionId, propertyId);
      console.log(`Set identifier field result:`, success);
      if (!success) {
        return res.status(500).json({ message: "Failed to set identifier field" });
      }
      
      res.json({ message: "Identifier field set successfully" });
    } catch (error) {
      console.error("Error setting identifier field:", error);
      res.status(500).json({ message: "Failed to set identifier field" });
    }
  });

  app.get("/api/collections/:collectionId/identifier", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const collectionId = req.params.collectionId;
      const identifierField = await storage.getCollectionIdentifierField(collectionId);
      res.json(identifierField || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to get identifier field" });
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

  // Overview Sessions
  app.get("/api/projects/:projectId/sessions", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const sessions = await storage.getExtractionSessions(projectId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
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
        console.log(`${index}: ${validation.fieldName} [${validation.recordIndex}] = "${validation.extractedValue}" (${validation.validationType})`);
      });

      // Separate schema fields and collection properties
      const schemaValidations = allValidations.filter(v => v.validationType === 'schema_field');
      const collectionValidations = allValidations.filter(v => v.validationType === 'collection_property');
      
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

      // Group collection validations by collection name with improved logic
      const collectionGroups = collectionValidations.reduce((acc, validation) => {
        let collectionName = validation.collectionName;
        
        // If collectionName is null/empty, extract from fieldName
        if (collectionName === null || collectionName === undefined || collectionName === 'null' || !collectionName) {
          const fieldName = validation.fieldName || '';
          const match = fieldName.match(/^([^.]+)\./);
          collectionName = match ? match[1] : 'Unknown Collection';
        }
        
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

  // Get session documents endpoint
  app.get("/api/sessions/:sessionId/documents", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const documents = await storage.getSessionDocuments(sessionId);
      res.json(documents);
    } catch (error) {
      console.error("Get session documents error:", error);
      res.status(500).json({ message: "Failed to fetch session documents" });
    }
  });

  // Delete a session document
  app.delete("/api/sessions/documents/:documentId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = req.params.documentId;
      const success = await storage.deleteSessionDocument(documentId);
      
      if (success) {
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(404).json({ message: "Document not found" });
      }
    } catch (error) {
      console.error("Delete session document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Download a session document (return the extracted content as a text file)
  app.get("/api/sessions/documents/:documentId/download", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = req.params.documentId;
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      
      // Get session documents for the specific session
      const sessionDocs = await storage.getSessionDocuments(sessionId);
      const document = sessionDocs.find(doc => doc.id === documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Create a meaningful filename for the extracted content
      const baseFileName = document.fileName?.replace(/\.[^/.]+$/, "") || `document_${documentId}`;
      const fileName = `${baseFileName}_extracted_content.txt`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      
      // Return the extracted content as a downloadable text file
      res.send(document.extractedContent || 'No content available');
      
    } catch (error) {
      console.error("Download session document error:", error);
      res.status(500).json({ message: "Failed to download document" });
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
          validationType: 'schema_field',
          dataType: field.fieldType,
          fieldId: field.id,
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
            validationType: 'collection_property',
            dataType: property.propertyType,
            fieldId: property.id,

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

  // Helper function to generate validation records for schema fields only (for empty sessions)
  const generateSchemaFieldValidations = async (sessionId: string, projectId: string) => {
    try {
      const project = await storage.getProjectWithDetails(projectId);
      if (!project) {
        console.error(`Project ${projectId} not found for session ${sessionId}`);
        return;
      }

      console.log(`🆕 Generating schema field validations for empty session ${sessionId}, project ${projectId}`);
      console.log(`📊 Schema fields: ${project.schemaFields.length} (collections will be empty initially)`);

      // Create validations for schema fields only
      for (const field of project.schemaFields) {
        await storage.createFieldValidation({
          sessionId,
          validationType: 'schema_field',
          dataType: field.fieldType,
          fieldId: field.id,
          collectionName: null,
          recordIndex: 0,
          extractedValue: null,
          validationStatus: 'pending',
          aiReasoning: null,
          manuallyVerified: false,
          confidenceScore: 0
        });
        console.log(`✅ Created validation for schema field: ${field.fieldName}`);
      }

      console.log(`🎯 Created ${project.schemaFields.length} schema field validations for empty session`);
      
      // Note: Collection properties will get validation records when AI extracts collection items
      // or when user manually adds collection items via the + button
    } catch (error) {
      console.error(`Error generating schema field validations for session ${sessionId}:`, error);
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

  // Create empty session with validation records for schema fields only
  app.post("/api/projects/:projectId/sessions/create-empty", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const { sessionName: providedName } = req.body;
      
      // Get project details
      const project = await storage.getProjectWithDetails(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Use provided name or generate default name
      let sessionName = providedName;
      if (!sessionName || !sessionName.trim()) {
        const timestamp = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        sessionName = `New ${project.mainObjectName || 'Session'} - ${timestamp}`;
      }
      
      // Create session
      const sessionData = {
        projectId,
        sessionName: sessionName.trim(),
        description: '',
        status: 'pending' as const,
        documentCount: 0,
        extractedData: '{}',
      };
      
      const session = await storage.createExtractionSession(sessionData);
      
      // Create validation records for schema fields only (no collection items)
      await generateSchemaFieldValidations(session.id, projectId);
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Failed to create empty session:", error);
      res.status(500).json({ message: "Failed to create empty session" });
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
      
      // Validate that we have a valid project ID
      if (!projectId) {
        return res.status(400).json({ 
          success: false, 
          message: "Project ID is required for extraction" 
        });
      }
      
      // Convert frontend file format to Python script expected format
      const convertedFiles = (files || []).map((file: any) => ({
        file_name: file.name,
        file_content: file.content, // This is the data URL from FileReader
        mime_type: file.type
      }));

      // Get extraction rules for better AI guidance (with error handling)
      let extractionRules = [];
      let knowledgeDocuments = [];
      
      try {
        extractionRules = await storage.getExtractionRules(projectId);
      } catch (error) {
        console.warn(`Failed to get extraction rules for project ${projectId}:`, error);
        extractionRules = [];
      }
      
      try {
        knowledgeDocuments = await storage.getKnowledgeDocuments(projectId);
      } catch (error) {
        console.warn(`Failed to get knowledge documents for project ${projectId}:`, error);
        knowledgeDocuments = [];
      }

      // Get existing verified field validations for context (with error handling)
      let existingValidations = [];
      try {
        existingValidations = await storage.getFieldValidations(sessionId);
      } catch (error) {
        console.warn(`Failed to get field validations for session ${sessionId}:`, error);
        existingValidations = [];
      }
      
      const verifiedDataContext: Record<string, any> = {};
      
      // Build verified field context from existing validations
      for (const validation of existingValidations) {
        if (validation.validationStatus === 'verified') {
          verifiedDataContext[validation.fieldId] = {
            field_name: validation.fieldName,
            extracted_value: validation.extractedValue,
            validation_status: validation.validationStatus,
            validation_type: validation.validationType,
            collection_name: validation.collectionName,
            record_index: validation.recordIndex
          };
        }
      }

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
        knowledge_documents: knowledgeDocuments,
        session_name: project_data?.mainObjectName || "contract",
        validated_data_context: verifiedDataContext,
        is_subsequent_upload: Object.keys(verifiedDataContext).length > 0
      };
      
      console.log(`STEP 1: Extracting from ${files?.length || 0} documents with ${extractionRules.length} extraction rules`);
      
      // Classify extraction task: Excel Column Extraction vs Current AI Extraction
      const collections = project_data?.collections || [];
      const schemaFields = project_data?.schemaFields || [];
      const targetCollections = collections.map((c: any) => c.name);
      const targetSchemaFields = schemaFields.map((f: any) => f.fieldName);
      const allTargetFields = [...targetCollections, ...targetSchemaFields];
      
      // Binary decision: Excel column extraction OR current AI extraction
      const excelColumnTasks = new Set(["Column Name Mapping", "Missing Column Names", "Additional Column Names"]);
      const isExcelColumnExtraction = allTargetFields.length > 0 && 
                                     allTargetFields.every(field => excelColumnTasks.has(field));
      
      console.log('TASK CLASSIFICATION:');
      console.log('  Target fields:', allTargetFields);
      console.log('  Excel column tasks:', allTargetFields.filter(f => excelColumnTasks.has(f)));
      console.log('  Complex tasks:', allTargetFields.filter(f => !excelColumnTasks.has(f)));
      console.log('  Decision: Use', isExcelColumnExtraction ? 'EXCEL COLUMN EXTRACTION' : 'CURRENT AI EXTRACTION');
      
      // Get collection count for starting index
      let collectionRecordCounts: Record<string, number> = {};
      try {
        const validationCount = await storage.getFieldValidationCount(sessionId);
        for (const validation of existingValidations) {
          if (validation.collectionName && validation.recordIndex !== null) {
            const currentCount = collectionRecordCounts[validation.collectionName] || 0;
            if (validation.recordIndex >= currentCount) {
              collectionRecordCounts[validation.collectionName] = validation.recordIndex + 1;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to calculate collection record counts:', error);
      }
      
      console.log('TASK CLASSIFICATION: Collection record counts:', collectionRecordCounts);
      console.log('TASK CLASSIFICATION: Target collections:', targetCollections);
      console.log('TASK CLASSIFICATION: Is simple column task:', isSimpleColumnTask);
      
      if (isExcelColumnExtraction) {
        console.log('USING EXCEL COLUMN EXTRACTION: Direct Excel parsing - no AI needed');
        
        // Use simple direct extraction for column mapping
        const python = spawn('python3', ['simple_column_extractor.py', (collectionRecordCounts["Column Name Mapping"] || 0).toString()]);
        
        // Pass session data to simple extractor
        const sessionDataForExtraction = {
          extractedTexts: (await storage.getExtractionSession(sessionId))?.extractedTexts || []
        };
        
        python.stdin.write(JSON.stringify(sessionDataForExtraction));
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
            console.error('Simple extraction error:', error);
            return res.status(500).json({ 
              message: "Simple extraction failed", 
              error: error 
            });
          }
          
          try {
            const extractedData = JSON.parse(output);
            console.log('SIMPLE EXTRACTION SUCCESS:', extractedData.message);
            
            // Store extracted data in session
            await storage.updateExtractionSession(sessionId, {
              status: "extracted",
              extractedData: JSON.stringify(extractedData),
              extractionPrompt: "Simple direct extraction - no AI prompt used",
              aiResponse: `Simple extraction: Found ${extractedData.columns_found} columns`,
              inputTokenCount: 0,
              outputTokenCount: 0
            });
            
            // Create field validation records from extracted data
            await createFieldValidationRecords(sessionId, extractedData, project_data);
            
            // Ensure ALL expected fields have validation records
            await ensureAllValidationRecordsExist(sessionId, projectId);
            
            res.json({ 
              message: "SIMPLE EXTRACTION: Column mapping completed", 
              extractedData,
              sessionId,
              extraction_method: "simple_direct",
              processing_time_ms: extractedData.processing_time_ms
            });
            
          } catch (error) {
            console.error('Simple extraction parse error:', error);
            res.status(500).json({ 
              message: "Failed to parse simple extraction results", 
              error: error.message 
            });
          }
        });
        
        return;
      }
      
      // Use extraction wizardry for complex AI extraction tasks
      console.log('USING EXTRACTION WIZARDRY: Complex reasoning and analysis required');
      
      const python = spawn('python3', ['extraction_wizardry.py']);
      
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
          
          // Store extracted data in session along with token usage and AI response
          await storage.updateExtractionSession(sessionId, {
            status: "extracted",
            extractedData: JSON.stringify(extractedData.extracted_data || extractedData),
            extractionPrompt: extractedData.extraction_prompt,
            aiResponse: extractedData.ai_response,
            inputTokenCount: extractedData.input_token_count,
            outputTokenCount: extractedData.output_token_count
          });
          
          // Create field validation records from extracted data
          await createFieldValidationRecords(sessionId, extractedData, project_data);
          
          // Ensure ALL expected fields have validation records (including ignored/empty fields)
          await ensureAllValidationRecordsExist(sessionId, projectId);
          
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
      
      // Call Python validation script (using extraction wizardry)
      const python = spawn('python3', ['extraction_wizardry.py']);
      
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
      
      // Get session to verify it exists
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      // Convert frontend file format to Python script expected format
      const convertedFiles = (files || []).map((file: any) => ({
        file_name: file.name,
        file_content: file.content, // This is the data URL from FileReader
        mime_type: file.type
      }));

      // Call Python script for actual text extraction
      const extractionData = {
        step: "extract_text_only",
        documents: convertedFiles
      };
      
      const python = spawn('python3', ['extraction_wizardry.py']);
      
      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code !== 0) {
          console.error('TEXT EXTRACTION error:', error);
          return res.status(500).json({ 
            success: false,
            error: "Text extraction failed",
            message: error || "Unknown error"
          });
        }
        
        try {
          const result = JSON.parse(output);
          console.log(`TEXT EXTRACTION: Extracted text from ${result.extracted_texts?.length || 0} documents`);
          
          // Save each document with its extracted content to session documents table
          if (result.extracted_texts && Array.isArray(result.extracted_texts)) {
            for (const extractedText of result.extracted_texts) {
              try {
                // Find the original file to get size and MIME type
                const originalFile = convertedFiles.find(f => f.file_name === extractedText.file_name);
                
                // Calculate file size from data URL if available
                let fileSize = null;
                if (originalFile?.file_content && originalFile.file_content.startsWith('data:')) {
                  try {
                    const base64Data = originalFile.file_content.split(',')[1];
                    fileSize = Math.floor(base64Data.length * 0.75); // Approximate file size from base64
                  } catch (e) {
                    console.warn(`Could not calculate file size for ${extractedText.file_name}`);
                  }
                }
                
                await storage.createSessionDocument({
                  sessionId: sessionId,
                  fileName: extractedText.file_name,
                  fileSize: fileSize,
                  mimeType: originalFile?.mime_type || null,
                  extractedContent: extractedText.text_content
                });
                
                console.log(`Saved document: ${extractedText.file_name} with extracted content to session documents`);
              } catch (docError) {
                console.error(`Failed to save document ${extractedText.file_name}:`, docError);
                // Continue with other documents even if one fails
              }
            }
          }
          
          // Save extracted data to session
          await storage.updateExtractionSession(sessionId, {
            extractedData: JSON.stringify(result),
            status: "extracted"
          });
          
          res.json({
            success: true,
            message: `Text extraction completed for ${files?.length || 0} documents`,
            extractedTexts: result.extracted_texts || []
          });
          
        } catch (parseError) {
          console.error('TEXT EXTRACTION JSON parse error:', parseError);
          res.status(500).json({ 
            success: false,
            error: "Failed to parse text extraction results",
            message: parseError instanceof Error ? parseError.message : "Unknown error"
          });
        }
      });
      
    } catch (error) {
      console.error("TEXT EXTRACTION ERROR:", error);
      res.status(500).json({ 
        success: false,
        error: "Text extraction failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  



  // Fix missing validation records for collection items
  app.post("/api/sessions/:sessionId/fix-missing-validations", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      console.log(`🔧 FIXING MISSING VALIDATIONS for session ${sessionId}`);
      
      // Get the session
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Get project data
      const project = await storage.getProject(session.projectId);
      const collections = await storage.getObjectCollections(session.projectId);
      const existingValidations = await storage.getFieldValidations(sessionId);
      
      console.log(`🔧 Found ${collections.length} collections and ${existingValidations.length} existing validations`);
      
      let fixedCount = 0;
      
      // For each collection, find the missing validation records
      for (const collection of collections) {
        console.log(`🔧 Processing collection: ${collection.collectionName}`);
        
        const properties = await storage.getCollectionProperties(collection.id);
        console.log(`🔧 Collection has ${properties.length} properties`);
        
        // Get property IDs for this collection to identify orphaned validations
        const propertyIds = properties.map(p => p.id);
        console.log(`🔧 Collection property IDs: [${propertyIds.join(', ')}]`);
        
        // Check for orphaned validations (null collectionName but collection_property type)
        const orphanedValidations = existingValidations.filter(v => 
          v.validationType === 'collection_property' && 
          v.collectionName === null &&
          propertyIds.includes(v.fieldId)
        );
        console.log(`🔧 Found ${orphanedValidations.length} orphaned validations with null collectionName`);
        
        // Find all record indices that have ANY validation for this collection
        // Include validations with matching field IDs (even if collectionName is null)
        const collectionValidations = existingValidations.filter(v => 
          v.validationType === 'collection_property' && 
          (v.collectionName === collection.collectionName || 
           (v.collectionName === null && propertyIds.includes(v.fieldId)))
        );
        
        const recordIndices = new Set<number>();
        collectionValidations.forEach(v => recordIndices.add(v.recordIndex || 0));
        
        console.log(`🔧 Found record indices: [${Array.from(recordIndices).sort().join(', ')}]`);
        
        // For each record index, ensure ALL properties have validation records
        for (const recordIndex of Array.from(recordIndices)) {
          console.log(`🔧 Checking record ${collection.collectionName}[${recordIndex}]`);
          
          for (const prop of properties) {
            const existingValidation = existingValidations.find(v => 
              v.fieldId === prop.id && 
              v.recordIndex === recordIndex && 
              v.validationType === 'collection_property'
            );
            
            if (!existingValidation) {
              console.log(`🎯 CREATING MISSING VALIDATION: ${collection.collectionName}.${prop.propertyName}[${recordIndex}]`);
              
              await storage.createFieldValidation({
                sessionId,
                fieldId: prop.id,
                validationType: 'collection_property',
                dataType: prop.propertyType || 'TEXT',
                collectionName: collection.collectionName,
                recordIndex: recordIndex,
                extractedValue: null, // Empty/ignored field
                confidenceScore: 0,
                validationStatus: 'pending', // Pending for empty fields
                aiReasoning: 'Field ignored by AI - ready for manual entry',
                manuallyVerified: false,
                manuallyUpdated: false
              });
              
              fixedCount++;
            }
          }
        }
      }
      
      console.log(`🎯 FIXED ${fixedCount} missing validation records for session ${sessionId}`);
      
      res.json({
        message: `Successfully created ${fixedCount} missing validation records`,
        fixedCount
      });
      
    } catch (error) {
      console.error("Fix missing validations error:", error);
      res.status(500).json({ message: "Failed to fix missing validations", error: error.message });
    }
  });

  // AI extraction for existing sessions (used by Add Documents)
  app.post("/api/sessions/:sessionId/ai-extraction", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { targetFields } = req.body;
      console.log(`AI EXTRACTION: Starting AI analysis for session ${sessionId}`);
      console.log(`AI EXTRACTION: Target fields:`, targetFields);
      
      // Get session data
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      // Check if session has extracted data to work with
      if (!session.extractedData || session.extractedData.trim() === '' || session.extractedData === '{}') {
        return res.status(400).json({ success: false, error: 'Session must have documents uploaded and processed before AI analysis' });
      }
      
      // Get extracted text data from session
      let extractedData;
      try {
        extractedData = JSON.parse(session.extractedData || '{}');
        
        // Convert text extraction format to AI extraction format
        if (extractedData.extracted_texts && !extractedData.documents) {
          console.log(`CONVERSION: Converting ${extractedData.extracted_texts.length} extracted_texts to documents format`);
          extractedData.documents = extractedData.extracted_texts.map(textDoc => ({
            file_name: textDoc.file_name,
            file_content: textDoc.text_content,
            word_count: textDoc.word_count,
            mime_type: textDoc.file_name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 
                      textDoc.file_name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                      textDoc.file_name.toLowerCase().endsWith('.doc') ? 'application/msword' :
                      textDoc.file_name.toLowerCase().endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                      textDoc.file_name.toLowerCase().endsWith('.xls') ? 'application/vnd.ms-excel' :
                      'application/octet-stream'
          }));
          console.log(`CONVERSION: Successfully created ${extractedData.documents.length} documents`);
          
          // Log document details for debugging
          extractedData.documents.forEach((doc, index) => {
            console.log(`DOCUMENT ${index}: ${doc.file_name} (${doc.file_content?.length || 0} chars)`);
            if (doc.file_content && doc.file_content.length > 0) {
              console.log(`PREVIEW: ${doc.file_content.substring(0, 200)}...`);
            }
          });
        }
      } catch (error) {
        return res.status(400).json({ success: false, error: 'Invalid extracted data in session' });
      }
      
      // Get project schema and other data
      const projectId = session.projectId;
      const [project, schemaFields, collections, knowledgeDocuments, extractionRules] = await Promise.all([
        storage.getProject(projectId),
        storage.getProjectSchemaFields(projectId),
        storage.getObjectCollections(projectId), 
        storage.getKnowledgeDocuments(projectId),
        storage.getExtractionRules(projectId)
      ]);
      
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      // Get existing validations to build context and filtered schema
      const existingValidations = await storage.getFieldValidations(sessionId);
      
      // Separate validated data from unvalidated fields
      const validatedDataContext: any = {};
      const unvalidatedFields = new Set<string>();
      const collectionRecordCounts: any = {};
      
      existingValidations.forEach(validation => {
        const fieldName = validation.fieldName;
        const isVerified = validation.validationStatus === 'verified' || validation.manuallyVerified === true;
        const hasData = validation.extractedValue && validation.extractedValue.trim() !== '';
        
        if (isVerified && hasData) {
          // Include full validation context for verified fields
          validatedDataContext[fieldName] = {
            value: validation.extractedValue,
            confidence: validation.confidenceScore,
            reasoning: validation.aiReasoning,
            status: 'verified',
            collection: validation.collectionName,
            recordIndex: validation.recordIndex || 0
          };
          
          // Track record counts for collections
          if (validation.collectionName) {
            const key = validation.collectionName;
            const index = validation.recordIndex || 0;
            collectionRecordCounts[key] = Math.max(collectionRecordCounts[key] || 0, index + 1);
          }
        } else if (!hasData || (!isVerified && hasData)) {
          // Field needs to be updated - either empty or unverified
          unvalidatedFields.add(fieldName.replace(/\[\d+\]$/, '')); // Remove index for base field tracking
        }
      });

      console.log(`AI EXTRACTION: Found ${existingValidations.length} existing validations`);
      console.log(`AI EXTRACTION: ${Object.keys(validatedDataContext).length} verified fields, ${unvalidatedFields.size} unvalidated field types`);
      console.log(`AI EXTRACTION: Collection record counts:`, collectionRecordCounts);
      console.log(`AI EXTRACTION: Processing ${extractedData.documents?.length || 0} documents`);
      
      // Filter schema fields - prioritize target field selection first
      let filteredSchemaFields = schemaFields;
      
      // If targetFields is provided, only include selected schema fields (takes priority)
      if (targetFields && targetFields.schemaFields && targetFields.schemaFields.length > 0) {
        const selectedSchemaFieldIds = new Set(targetFields.schemaFields.map(f => f.id));
        filteredSchemaFields = filteredSchemaFields.filter(field => 
          selectedSchemaFieldIds.has(field.id)
        );
        console.log(`AI EXTRACTION: Filtered schema fields by selection from ${schemaFields.length} to ${filteredSchemaFields.length}`);
      } else {
        // Only if no target fields specified, filter by validation status
        filteredSchemaFields = filteredSchemaFields.filter(field => 
          unvalidatedFields.has(field.fieldName)
        );
        console.log(`AI EXTRACTION: Filtered schema fields by validation status to ${filteredSchemaFields.length}`);
      }
      
      let filteredCollections = collections.map(collection => {
        const collectionBaseKey = collection.collectionName;
        let selectedProps = collection.properties;
        
        // If targetFields is provided, only include selected collection properties (takes priority)
        if (targetFields && targetFields.collectionProperties && targetFields.collectionProperties.length > 0) {
          const selectedPropertyIds = new Set(targetFields.collectionProperties.map(p => p.id));
          selectedProps = selectedProps.filter(prop => 
            selectedPropertyIds.has(prop.id)
          );
        } else {
          // Only if no target fields specified, filter by validation status
          selectedProps = selectedProps.filter(prop => 
            unvalidatedFields.has(`${collectionBaseKey}.${prop.propertyName}`)
          );
        }
        
        if (selectedProps.length > 0) {
          return {
            id: collection.id,
            collectionName: collection.collectionName,
            description: collection.description,
            existingRecordCount: collectionRecordCounts[collection.collectionName] || 0,
            properties: selectedProps.map(prop => ({
              id: prop.id,
              propertyName: prop.propertyName,
              propertyType: prop.propertyType,
              description: prop.description
            }))
          };
        }
        return null;
      }).filter(Boolean);
      
      // If only schema fields are selected, exclude all collections
      if (targetFields && targetFields.schemaFields && targetFields.schemaFields.length > 0 && 
          (!targetFields.collectionProperties || targetFields.collectionProperties.length === 0)) {
        filteredCollections = [];
        console.log(`AI EXTRACTION: Excluded all collections because only schema fields were selected`);
      } else if (targetFields && targetFields.collectionProperties && targetFields.collectionProperties.length > 0) {
        console.log(`AI EXTRACTION: Filtered collections by selection from ${collections.length} to ${filteredCollections.length}`);
      }

      console.log(`AI EXTRACTION: Filtered schema - ${filteredSchemaFields.length} fields, ${filteredCollections.length} collections with missing data`);
      
      // Prepare focused schema data for Python script
      const schemaData = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          mainObjectName: project.mainObjectName
        },
        schema_fields: filteredSchemaFields.map(field => ({
          id: field.id,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description,
          orderIndex: field.orderIndex,
          choiceOptions: field.choiceOptions,
          autoVerificationConfidence: field.autoVerificationConfidence
        })),
        collections: filteredCollections,
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

      // Call Python AI extraction script with existing validation context
      const python = spawn('python3', ['extraction_wizardry.py'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Analyze existing data to identify incomplete collections that need full extraction
      const incompleteCollections = [];
      const collectionStats = {};
      
      // Count existing records per collection and identify empty fields
      Object.keys(validatedDataContext).forEach(fieldName => {
        const parts = fieldName.split('.');
        if (parts.length >= 2) {
          const collectionName = parts[0];
          
          if (!collectionStats[collectionName]) {
            collectionStats[collectionName] = { total: 0, emptyFields: [] };
          }
          
          // Count records by looking for indexed fields
          const propertyPart = parts.slice(1).join('.');
          const indexMatch = propertyPart.match(/\[(\d+)\]$/);
          if (indexMatch) {
            const recordIndex = parseInt(indexMatch[1]);
            collectionStats[collectionName].total = Math.max(collectionStats[collectionName].total, recordIndex + 1);
            
            // Check if this field is empty - note: validatedDataContext only contains verified data
            // Unverified/empty fields are tracked separately in unvalidatedFields
          }
        }
      });
      
      // Build extraction instructions for collections with incomplete data
      let extractionNotes = "";
      Object.entries(collectionStats).forEach(([collectionName, stats]) => {
        if (stats.emptyFields.length > 0) {
          const emptyFieldsByProperty = {};
          stats.emptyFields.forEach(fieldName => {
            const propertyName = fieldName.split('.').pop().replace(/\[\d+\]$/, '');
            if (!emptyFieldsByProperty[propertyName]) {
              emptyFieldsByProperty[propertyName] = 0;
            }
            emptyFieldsByProperty[propertyName]++;
          });
          
          const emptyProperties = Object.entries(emptyFieldsByProperty)
            .map(([prop, count]) => `${prop} (${count} empty)`)
            .join(', ');
          
          extractionNotes += `CRITICAL: Complete ALL missing data for ${collectionName} collection (${stats.total} records). `;
          extractionNotes += `Empty fields: ${emptyProperties}. Extract or infer values for ALL empty fields. `;
        }
      });
      
      if (extractionNotes) {
        extractionNotes = "INCOMPLETE DATA COMPLETION: " + extractionNotes + 
          "Do not leave any fields empty - extract from document text or infer from context when explicit values aren't available.";
      }
      
      // Add specific instruction for Code Meanings extraction from this document
      if (extractedData.documents?.length > 0) {
        const docContent = extractedData.documents[0].file_content || '';
        if (docContent.includes('Code') || docContent.includes('meaning') || docContent.includes('definition')) {
          extractionNotes += " DOCUMENT ANALYSIS: The uploaded document contains detailed code definitions and meanings - extract ALL code meanings from this document content.";
        }
      }
      
      // Critical indexing instruction
      if (Object.keys(collectionRecordCounts).length > 0) {
        extractionNotes += " INDEXING CRITICAL: ";
        Object.entries(collectionRecordCounts).forEach(([collectionName, count]) => {
          extractionNotes += `For ${collectionName} collection, START NEW RECORDS AT INDEX ${count} (existing indexes 0-${count-1} are verified and protected). `;
        });
        extractionNotes += "Do NOT use indexes 0-110 for any new extractions - these are already verified and must not be modified.";
      }

      const inputData = JSON.stringify({
        documents: extractedData.documents || [],
        project_schema: schemaData,
        extraction_rules: extractionRules,
        knowledge_documents: knowledgeDocuments,
        session_name: project.mainObjectName || "Session",
        validated_data_context: validatedDataContext,
        collection_record_counts: collectionRecordCounts,
        extraction_notes: extractionNotes,
        is_subsequent_upload: true
      });
      
      // Debug the exact data being sent to AI
      console.log(`AI INPUT DATA: ${inputData.length} characters`);
      if (extractedData.documents?.length > 0) {
        const firstDoc = extractedData.documents[0];
        const content = firstDoc.file_content || '';
        console.log(`AI INPUT DOCUMENT: ${firstDoc.file_name} (${content.length} chars)`);
        if (content.includes('Active Deferred') || content.includes('Pension Scheme')) {
          console.log('✓ Document contains pension code content');
          console.log(`Sample content: ${content.substring(0, 500)}...`);
        } else {
          console.log('⚠ Document may not contain expected code meanings');
          console.log(`Actual content preview: ${content.substring(0, 300)}...`);
        }
      }

      python.stdin.write(inputData);
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
            console.error('AI EXTRACTION error - Exit code:', code);
            console.error('AI EXTRACTION stderr:', error);
            console.error('AI EXTRACTION stdout:', output);
            return reject(new Error(`AI extraction failed with exit code ${code}: ${error}`));
          }
          
          try {
            const result = JSON.parse(output);
            console.log(`AI EXTRACTION: Processing completed with ${result.field_validations?.length || 0} field validations`);
            
            // Store extracted validations
            if (result.field_validations) {
              // Get schema fields and collection properties to map field names to UUIDs
              const schemaFields = await storage.getProjectSchemaFields(project.id);
              const collections = await storage.getObjectCollections(project.id);
              
              // Build mapping from field names to UUIDs
              const fieldNameToId: Record<string, string> = {};
              
              // Map schema fields
              for (const field of schemaFields) {
                fieldNameToId[field.fieldName] = field.id;
              }
              
              // Map collection properties  
              for (const collection of collections) {
                const properties = await storage.getCollectionProperties(collection.id);
                for (const prop of properties) {
                  // Handle indexed collection fields like "Codes.Code Name[0]"
                  const baseFieldName = `${collection.collectionName}.${prop.propertyName}`;
                  fieldNameToId[baseFieldName] = prop.id;
                }
              }
              
              console.log('Field name to ID mapping:', Object.keys(fieldNameToId));
              console.log(`Processing ${result.field_validations.length} validations from AI`);
              
              // Debug: Log all field names the AI is trying to map
              for (const validation of result.field_validations) {
                console.log(`AI validation field: ${validation.field_name} -> extracted_value: ${validation.extracted_value}`);
              }
              
              // Create a map of AI-provided validations by field key for quick lookup
              const aiValidationsMap = new Map();
              for (const validation of result.field_validations) {
                // Use field_id directly if provided by AI, otherwise try to map field_name
                let fieldId = validation.field_id;
                if (!fieldId) {
                  // Fallback to mapping field name to ID
                  const baseFieldName = validation.field_name?.replace(/\[\d+\]$/, ''); // Remove array index
                  fieldId = fieldNameToId[baseFieldName];
                }
                
                if (fieldId) {
                  const recordIndex = validation.record_index || 0;
                  const key = `${fieldId}_${recordIndex}`;
                  aiValidationsMap.set(key, { ...validation, field_id: fieldId });
                  console.error(`🎯 MAPPED AI VALIDATION: ${validation.field_name} -> ${fieldId} [${recordIndex}] = "${validation.extracted_value}"`);
                } else {
                  console.error(`❌ COULD NOT MAP: ${validation.field_name}`);
              }
              
              // Process ALL expected fields - both those with AI data and those without
              const allExpectedValidations = [];
              
              // Add schema fields
              for (const field of schemaFields) {
                const fieldKey = `${field.id}_0`; // Schema fields have record index 0
                const aiValidation = aiValidationsMap.get(fieldKey);
                
                allExpectedValidations.push({
                  fieldName: field.fieldName,
                  baseFieldName: field.fieldName,
                  fieldId: field.id,
                  validationType: 'schema_field',
                  dataType: field.fieldType || 'TEXT',
                  collectionName: null,
                  recordIndex: 0,
                  aiData: aiValidation // null if AI didn't provide data
                });
              }
              
              // Add collection properties - determine which record indices exist for each collection
              const collectionRecordIndices = new Map(); // collectionName -> Set of record indices
              
              // First, find all record indices that have any AI data for each collection
              for (const [key, aiValidation] of aiValidationsMap) {
                if (aiValidation.validation_type === 'collection_property') {
                  const collectionName = aiValidation.collection_name;
                  const recordIndex = aiValidation.record_index || 0;
                  
                  if (!collectionRecordIndices.has(collectionName)) {
                    collectionRecordIndices.set(collectionName, new Set());
                  }
                  collectionRecordIndices.get(collectionName).add(recordIndex);
                }
              }
              
              // Now create validations for ALL properties of each collection item that has any data
              for (const collection of collections) {
                const properties = await storage.getCollectionProperties(collection.id);
                const recordIndices = collectionRecordIndices.get(collection.collectionName) || new Set();
                
                // If no AI data found for this collection, skip it (no records to create)
                if (recordIndices.size === 0) {
                  console.log(`No AI data found for collection ${collection.collectionName}, skipping`);
                  continue;
                }
                
                // For each record index that has any AI data, create validation records for ALL properties
                for (const recordIndex of recordIndices) {
                  console.log(`Creating validation records for ${collection.collectionName} record ${recordIndex} (all ${properties.length} properties)`);
                  
                  for (const prop of properties) {
                    const fieldName = `${collection.collectionName}.${prop.propertyName}[${recordIndex}]`;
                    const fieldKey = `${prop.id}_${recordIndex}`; // Use property ID instead of field name
                    const aiValidation = aiValidationsMap.get(fieldKey);
                    
                    allExpectedValidations.push({
                      fieldName: fieldName,
                      baseFieldName: `${collection.collectionName}.${prop.propertyName}`,
                      fieldId: prop.id,
                      validationType: 'collection_property',
                      dataType: prop.propertyType || 'TEXT',
                      collectionName: collection.collectionName,
                      recordIndex: recordIndex,
                      aiData: aiValidation // null if AI didn't provide data for this specific property
                    });
                  }
                }
              }
              
              console.log(`Processing ${allExpectedValidations.length} total expected validations (${result.field_validations.length} from AI, ${allExpectedValidations.length - result.field_validations.length} empty)`);
              
              // Now process all expected validations
              for (const expectedValidation of allExpectedValidations) {
                const fieldName = expectedValidation.fieldName;
                const fieldId = expectedValidation.fieldId;
                const aiData = expectedValidation.aiData;
                
                // Check if validation already exists for this field
                const existingValidations = await storage.getFieldValidations(sessionId);
                const existingValidation = existingValidations.find(v => 
                  v.fieldId === fieldId && 
                  (v.recordIndex || 0) === expectedValidation.recordIndex
                );
                
                // Create validation data - use AI data if available, otherwise create empty record
                const validationData = {
                  sessionId: sessionId,
                  fieldId: fieldId,
                  validationType: expectedValidation.validationType,
                  dataType: expectedValidation.dataType,
                  collectionName: expectedValidation.collectionName,
                  recordIndex: expectedValidation.recordIndex,
                  extractedValue: aiData?.extracted_value || null, // null for empty fields
                  confidenceScore: aiData ? Math.round((aiData.confidence_score || 0) * 100) : 0,
                  validationStatus: aiData?.validation_status || 'pending', // pending for empty fields
                  aiReasoning: aiData?.ai_reasoning || aiData?.reasoning || '',
                  manuallyVerified: false,
                  manuallyUpdated: false
                };
                
                if (existingValidation) {
                  // Check if existing validation is verified/locked - if so, preserve its data
                  const isVerified = existingValidation.validationStatus === 'verified' || existingValidation.manuallyVerified === true;
                  
                  if (isVerified) {
                    console.error(`🔒 PROTECTING VERIFIED: ${fieldName} - keeping: "${existingValidation.extractedValue}"`);
                    continue;
                  } else {
                    const logValue = aiData ? `"${aiData.extracted_value}"` : 'null (empty field)';
                    console.error(`📝 UPDATING FIELD: ${fieldName} - from "${existingValidation.extractedValue}" to ${logValue}`);
                    // Update existing unverified validation
                    await storage.updateFieldValidation(existingValidation.id, validationData);
                  }
                } else {
                  // Create new validation record
                  const logValue = aiData ? `"${aiData.extracted_value}"` : 'null (empty field)';
                  console.log(`CREATING FIELD: ${fieldName} - value: ${logValue}`);
                  await storage.createFieldValidation(validationData);
                }
              }
            }

            // Get current session data to preserve any existing debug fields
            const currentSession = await storage.getExtractionSession(sessionId);
            
            // Update session status while preserving existing debug data
            await storage.updateExtractionSession(sessionId, {
              status: "ai_processed",
              extractionPrompt: result.extraction_prompt || currentSession?.extractionPrompt || null,
              aiResponse: result.ai_response || currentSession?.aiResponse || null,
              inputTokenCount: result.input_token_count || currentSession?.inputTokenCount || null,
              outputTokenCount: result.output_token_count || currentSession?.outputTokenCount || null
            });
            
            // Ensure ALL expected fields have validation records (including ignored/empty fields)
            await ensureAllValidationRecordsExist(sessionId, session.projectId);
            
            resolve(result);
            
          }
        } catch (parseError) {
            console.error('AI EXTRACTION JSON parse error:', parseError);
            console.error('Raw output:', output);
            reject(new Error(`Invalid JSON response: ${parseError}`));
          }
        });
      });
      
      res.json({
        success: true,
        message: "AI extraction completed successfully"
      });
      
    } catch (error) {
      console.error("AI EXTRACTION error:", error);
      res.status(500).json({ success: false, message: "Failed to run AI extraction", error: error.message });
    }
  });

  // Gemini AI extraction endpoint
  app.post("/api/sessions/:sessionId/gemini-extraction", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { extractedTexts, schemaFields, collections, extractionRules, knowledgeDocuments, targetFieldIds, targetPropertyIds } = req.body;
      
      console.log(`GEMINI EXTRACTION: Starting for session ${sessionId}`);
      console.log(`GEMINI EXTRACTION: Received ${extractedTexts?.length || 0} documents`);
      
      // Log the received data for debugging
      console.log(`GEMINI EXTRACTION: Schema fields: ${schemaFields?.length || 0}`);
      console.log(`GEMINI EXTRACTION: Collections: ${collections?.length || 0}`);
      console.log(`GEMINI EXTRACTION: Extraction rules: ${extractionRules?.length || 0}`);
      console.log(`GEMINI EXTRACTION: Target field IDs:`, targetFieldIds || []);
      console.log(`GEMINI EXTRACTION: Target property IDs:`, targetPropertyIds || []);
      
      // Filter schema fields and collections based on target selections
      let filteredSchemaFields = schemaFields || [];
      let filteredCollections = collections || [];
      
      if (targetFieldIds && targetFieldIds.length > 0) {
        filteredSchemaFields = schemaFields.filter((field: any) => targetFieldIds.includes(field.id));
        console.log(`GEMINI EXTRACTION: Filtered schema fields from ${schemaFields.length} to ${filteredSchemaFields.length}`);
      }
      
      if (targetPropertyIds && targetPropertyIds.length > 0) {
        filteredCollections = collections.map((collection: any) => ({
          ...collection,
          properties: collection.properties?.filter((prop: any) => targetPropertyIds.includes(prop.id)) || []
        })).filter((collection: any) => collection.properties.length > 0);
        console.log(`GEMINI EXTRACTION: Filtered collections from ${collections.length} to ${filteredCollections.length}`);
      } else if (targetFieldIds && targetFieldIds.length > 0) {
        // If only schema fields are selected, exclude all collections
        filteredCollections = [];
        console.log(`GEMINI EXTRACTION: Excluded all collections because only schema fields were selected`);
      }
      
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
      
      const python = spawn('python3', ['extraction_wizardry.py'], {
        cwd: process.cwd()
      });

      // Convert extracted texts to document format expected by Python script
      const documents = (finalExtractedTexts || []).map((extracted: any, index: number) => ({
        file_name: extracted.file_name || `document_${index + 1}.pdf`,
        file_content: extracted.text_content || extracted.content || '',
        mime_type: extracted.mime_type || 'application/pdf'
      }));

      // For field targeting, get existing validation data to provide context
      let validatedDataContext = {};
      if (targetFieldIds?.length > 0 || targetPropertyIds?.length > 0) {
        console.log(`GEMINI EXTRACTION: Field targeting detected, retrieving existing validation data for context`);
        try {
          const existingValidations = await storage.getFieldValidations(sessionId);
          if (existingValidations && existingValidations.length > 0) {
            console.log(`GEMINI EXTRACTION: Found ${existingValidations.length} existing validation records for context`);
            // Convert to the format expected by Python script (keyed by field_id)
            const validationMap: any = {};
            for (const validation of existingValidations) {
              const key = `${validation.fieldId}_${validation.recordIndex || 0}`;
              validationMap[key] = {
                field_id: validation.fieldId,
                field_name: validation.fieldName,
                extracted_value: validation.extractedValue || '',
                ai_reasoning: validation.aiReasoning || '',
                confidence: validation.confidence,
                validation_type: validation.validationType,
                collection_name: validation.collectionName,
                record_index: validation.recordIndex || 0,
                validation_status: validation.validationStatus
              };
            }
            validatedDataContext = validationMap;
          }
        } catch (error) {
          console.log(`GEMINI EXTRACTION: Could not get existing validations: ${(error as any).message}`);
        }
      }

      // Send the data to Python script in correct format (using filtered fields)
      const pythonInput = JSON.stringify({
        operation: "extract",
        documents: documents,
        project_schema: {
          schema_fields: filteredSchemaFields,
          collections: filteredCollections
        },
        extraction_rules: extractionRules || [],
        knowledge_documents: knowledgeDocuments || [],
        session_name: sessionId,
        validated_data_context: validatedDataContext
      });
      
      console.log(`GEMINI EXTRACTION: Sending ${filteredSchemaFields.length} schema fields and ${filteredCollections.length} collections to Python`);
      
      console.log(`GEMINI EXTRACTION: Sending ${documents.length} documents to Python script`);
      console.log(`GEMINI EXTRACTION: First document preview:`, documents[0] ? documents[0].file_name : 'No documents');
      
      if (filteredSchemaFields.length === 0 && filteredCollections.length === 0) {
        console.log(`GEMINI EXTRACTION: WARNING - No fields selected for extraction!`);
        return res.json({ success: false, error: 'No fields selected for extraction' });
      }
      
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
            
            // Save extraction prompt, AI response, and token counts to database if available
            if (result.success && (result.extraction_prompt || result.ai_response)) {
              try {
                // Use the repaired extracted_data as a properly formatted JSON string for debugging
                const repairedResponse = result.extracted_data ? JSON.stringify(result.extracted_data, null, 2) : result.ai_response;
                
                await storage.updateExtractionSession(sessionId, {
                  status: "extracted",
                  extractionPrompt: result.extraction_prompt,
                  aiResponse: repairedResponse, // Save the repaired JSON instead of truncated raw response
                  inputTokenCount: result.input_token_count,
                  outputTokenCount: result.output_token_count
                });
                console.log(`GEMINI EXTRACTION: Saved prompt, repaired AI response, and token counts to database (Input: ${result.input_token_count}, Output: ${result.output_token_count})`);
              } catch (saveError) {
                console.error('GEMINI EXTRACTION: Failed to save extraction data:', saveError);
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
          let collectionId = null;
          
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
              
              // Find collection by name to get collectionId
              try {
                const collection = await storage.getCollectionByName(collectionName);
                if (collection) {
                  collectionId = collection.id;
                }
              } catch (error) {
                console.warn(`Could not find collection ID for collection name: ${collectionName}`);
              }
            }
          }
          
          // Find existing validation record for this field
          const existingValidations = await storage.getFieldValidations(sessionId);
          const existingValidation = existingValidations.find(v => 
            v.fieldId === validation.field_id &&
            v.recordIndex === (validation.record_index || 0) &&
            v.validationType === validation.validation_type
          );
          
          let savedValidation;
          // Get auto-verification threshold for this field
          let autoVerifyThreshold = 80; // Default threshold
          
          try {
            if (validation.validation_type === 'schema_field') {
              const schemaField = await storage.getProjectSchemaFieldById(validation.field_id);
              if (schemaField?.autoVerificationConfidence) {
                autoVerifyThreshold = schemaField.autoVerificationConfidence;
              }
            } else if (validation.validation_type === 'collection_property') {
              const collectionProperty = await storage.getCollectionPropertyById(validation.field_id);
              if (collectionProperty?.autoVerificationConfidence) {
                autoVerifyThreshold = collectionProperty.autoVerificationConfidence;
              }
            }
          } catch (error) {
            console.warn(`Could not get auto-verification threshold for field ${validation.field_id}, using default 80`);
          }
          
          // Calculate confidence score and determine auto-verification
          // For empty fields, set confidence to 0%
          let confidenceScore;
          if (!validation.extracted_value || validation.extracted_value === "" || validation.extracted_value === "null") {
            confidenceScore = 0;
          } else {
            confidenceScore = Math.round(parseFloat(validation.confidence_score) * 100); // Convert to integer percentage
          }
          
          const shouldAutoVerify = confidenceScore >= autoVerifyThreshold;
          const validationStatus = shouldAutoVerify ? 'verified' : 'unverified';
          
          console.log(`Field ${fieldName}: confidence ${confidenceScore}% vs threshold ${autoVerifyThreshold}% = ${validationStatus}`);

          if (existingValidation) {
            // Update existing record with extracted data
            const updateData = {
              extractedValue: validation.extracted_value,
              confidenceScore: confidenceScore,
              validationStatus: validationStatus,
              aiReasoning: validation.ai_reasoning,
              documentSource: validation.document_source || 'Unknown',
              updatedAt: new Date()
            };
            console.log(`SAVE VALIDATIONS: Updating ${fieldName} with data:`, updateData);
            savedValidation = await storage.updateFieldValidation(existingValidation.id, updateData);
            console.log(`SAVE VALIDATIONS: Updated existing field ${fieldName}, result:`, savedValidation);
          } else {
            // Create new record if none exists
            const createData = {
              sessionId: sessionId,
              fieldId: validation.field_id,
              validationType: validation.validation_type,
              dataType: validation.data_type,
              collectionName: collectionName,
              collectionId: collectionId,
              extractedValue: validation.extracted_value,
              confidenceScore: confidenceScore,
              validationStatus: validationStatus,
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

      // CRITICAL: Create missing validation records for empty fields
      // If any property of a collection item has a validation, ALL properties need validation records
      console.log('SAVE VALIDATIONS: Creating missing validation records for empty fields...');
      
      // Get all schema fields and collection properties to determine what should exist
      const schemaFields = await storage.getProjectSchemaFields(session.projectId);
      const collections = await storage.getObjectCollections(session.projectId);
      
      // Track which collection record indices have any validation data
      const collectionRecordIndices = new Map(); // collectionName -> Set of record indices
      
      for (const validation of parsedValidations) {
        if (validation.field_type === 'collection_property') {
          const fieldName = validation.field_name;
          // Extract collection name from field name like "Codes.Code Name[0]"
          const collectionMatch = fieldName.match(/^(.+)\./); 
          const collectionName = collectionMatch ? collectionMatch[1] : null;
          const recordIndex = validation.record_index || 0;
          
          if (collectionName) {
            if (!collectionRecordIndices.has(collectionName)) {
              collectionRecordIndices.set(collectionName, new Set());
            }
            collectionRecordIndices.get(collectionName).add(recordIndex);
          }
        }
      }
      
      console.log('SAVE VALIDATIONS: Collection record indices found:', Object.fromEntries(collectionRecordIndices));
      
      // Create missing validation records for collection properties
      let additionalValidations = 0;
      for (const collection of collections) {
        const properties = await storage.getCollectionProperties(collection.id);
        const recordIndices = collectionRecordIndices.get(collection.collectionName) || new Set();
        
        // For each record index that has any validation data
        for (const recordIndex of recordIndices) {
          console.log(`SAVE VALIDATIONS: Ensuring all properties exist for ${collection.collectionName}[${recordIndex}]`);
          
          // Check each property of this collection
          for (const prop of properties) {
            // Check if validation already exists for this property and record
            const existingValidations = await storage.getFieldValidations(sessionId);
            const existingValidation = existingValidations.find(v => 
              v.fieldId === prop.id &&
              v.recordIndex === recordIndex &&
              v.validationType === 'collection_property'
            );
            
            if (!existingValidation) {
              // Create missing validation record with null value
              console.log(`SAVE VALIDATIONS: Creating missing validation for ${collection.collectionName}.${prop.propertyName}[${recordIndex}]`);
              
              const createData = {
                sessionId: sessionId,
                fieldId: prop.id,
                validationType: 'collection_property',
                dataType: prop.propertyType || 'TEXT',
                collectionName: collection.collectionName,
                extractedValue: null, // Empty field
                confidenceScore: 0,
                validationStatus: 'pending' as const, // Pending for empty fields
                aiReasoning: 'Field created automatically for collection completeness - no AI data found',
                documentSource: 'Unknown',
                recordIndex: recordIndex
              };
              
              try {
                const newValidation = await storage.createFieldValidation(createData);
                console.log(`SAVE VALIDATIONS: Created missing field ${collection.collectionName}.${prop.propertyName}[${recordIndex}]`);
                additionalValidations++;
              } catch (error) {
                console.error(`SAVE VALIDATIONS: Failed to create missing validation:`, error);
              }
            }
          }
        }
      }
      
      console.log(`SAVE VALIDATIONS: Successfully saved ${savedValidations.length} AI validations + ${additionalValidations} missing field validations = ${savedValidations.length + additionalValidations} total`);
      
      // Also run the comprehensive check to ensure ALL expected fields exist
      await ensureAllValidationRecordsExist(sessionId, session.projectId);

      res.json({
        success: true,
        message: `Successfully saved ${savedValidations.length + additionalValidations} field validations (${savedValidations.length} from AI, ${additionalValidations} missing fields)`,
        savedCount: savedValidations.length + additionalValidations,
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
                  validationType: 'schema_field',
                  dataType: schemaField.fieldType || 'TEXT',
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
                      validationType: 'collection_property',
                      dataType: property.propertyType || 'TEXT',
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
                // Use field ID and validation type directly from AI response
                const fieldId = validation.field_id;
                const validationType = validation.validation_type || 'schema_field';
                const dataType = validation.data_type || 'TEXT';
                let collectionName = null;
                let recordIndex = 0;
                
                // Handle collection properties
                if (validationType === 'collection_property') {
                  collectionName = validation.collection_name;
                  recordIndex = validation.record_index || 0;
                }
                
                // Convert confidence score to percentage
                const confidenceScore = Math.round(parseFloat(validation.confidence_score) * 100);
                
                // Determine validation status based on extracted value and confidence
                let validationStatus = validation.validation_status || 'unverified';
                if (!validation.extracted_value || validation.extracted_value === "" || validation.extracted_value === "null") {
                  validationStatus = 'pending';
                }
                
                await storage.createFieldValidation({
                  sessionId: sessionId, // Use sessionId from the route parameter
                  fieldId: fieldId,
                  validationType: validationType,
                  dataType: dataType,
                  collectionName: collectionName,
                  recordIndex: recordIndex,
                  extractedValue: validation.extracted_value,
                  validationStatus: validationStatus,
                  confidenceScore: confidenceScore,
                  aiReasoning: validation.ai_reasoning,
                  documentSource: validation.document_source || 'Unknown',
                  manuallyUpdated: false,
                  manuallyVerified: false
                });
                
                console.log(`Created validation for ${validation.field_name} (ID: ${fieldId}) with value: ${validation.extracted_value}`);
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

  // Helper function to ensure ALL schema fields and collection properties have validation records
  async function ensureAllValidationRecordsExist(sessionId: string, projectId: string) {
    console.log(`Ensuring all validation records exist for session ${sessionId}`);
    
    // Get all schema fields and collections
    const schemaFields = await storage.getProjectSchemaFields(projectId);
    const collections = await storage.getObjectCollections(projectId);
    
    // Get existing validations to avoid duplicates
    const existingValidations = await storage.getFieldValidations(sessionId);
    
    // Create validation records for all schema fields
    for (const field of schemaFields) {
      const existingValidation = existingValidations.find(v => 
        v.fieldId === field.id && v.validationType === 'schema_field'
      );
      
      if (!existingValidation) {
        console.log(`Creating missing validation record for schema field: ${field.fieldName}`);
        await storage.createFieldValidation({
          sessionId,
          fieldId: field.id,
          validationType: 'schema_field',
          dataType: field.fieldType,
          collectionName: null,
          recordIndex: 0,
          extractedValue: null, // Empty/ignored field
          confidenceScore: 0,
          validationStatus: 'pending', // Pending for empty fields
          aiReasoning: 'Field created automatically - awaiting data extraction or manual input',
          manuallyVerified: false,
          manuallyUpdated: false
        });
      }
    }
    
    // *** ENHANCED LOGIC: Find ALL collection items from extracted data, not just ones with validations ***
    const session = await storage.getExtractionSession(sessionId);
    let extractedData = {};
    try {
      extractedData = session.extractedData ? JSON.parse(session.extractedData) : {};
      console.log(`🔍 DEBUG: Extracted data keys:`, Object.keys(extractedData));
      console.log(`🔍 DEBUG: Full extracted data:`, JSON.stringify(extractedData, null, 2));
    } catch (e) {
      console.log('❌ ERROR: Failed to parse extracted data:', e);
    }
    
    const collectionRecordIndices = new Map(); // collectionName -> Set of record indices
    
    // First, find record indices from existing validations (legacy approach)
    for (const validation of existingValidations) {
      if (validation.validationType === 'collection_property' && validation.collectionName) {
        if (!collectionRecordIndices.has(validation.collectionName)) {
          collectionRecordIndices.set(validation.collectionName, new Set());
        }
        collectionRecordIndices.get(validation.collectionName)!.add(validation.recordIndex || 0);
      }
    }
    
    // *** CRITICAL FIX: Also find ALL items from extracted data ***
    for (const collection of collections) {
      console.log(`🔍 DEBUG: Looking for collection '${collection.collectionName}' in extracted data`);
      const collectionData = extractedData[collection.collectionName];
      console.log(`🔍 DEBUG: Collection data:`, collectionData);
      console.log(`🔍 DEBUG: Is array?`, Array.isArray(collectionData));
      console.log(`🔍 DEBUG: Length:`, collectionData?.length);
      
      if (Array.isArray(collectionData) && collectionData.length > 0) {
        console.log(`🎯 COLLECTION DETECTION: Found ${collectionData.length} items in extracted data for '${collection.collectionName}'`);
        
        if (!collectionRecordIndices.has(collection.collectionName)) {
          collectionRecordIndices.set(collection.collectionName, new Set());
        }
        
        // Add ALL record indices from extracted data
        for (let i = 0; i < collectionData.length; i++) {
          collectionRecordIndices.get(collection.collectionName)!.add(i);
          console.log(`🎯 ENSURING RECORD: ${collection.collectionName}[${i}] will get ALL property validations`);
        }
      } else {
        console.log(`❌ DEBUG: No array data found for collection '${collection.collectionName}'`);
      }
    }
    
    // Create validation records for ALL properties of ALL collection items found
    for (const collection of collections) {
      const properties = await storage.getCollectionProperties(collection.id);
      const recordIndices = collectionRecordIndices.get(collection.collectionName) || new Set();
      
      console.log(`🔧 PROCESSING COLLECTION: ${collection.collectionName} with ${recordIndices.size} items and ${properties.length} properties`);
      
      for (const recordIndex of recordIndices) {
        console.log(`Ensuring all properties exist for ${collection.collectionName}[${recordIndex}]`);
        
        for (const prop of properties) {
          const existingValidation = existingValidations.find(v => 
            v.fieldId === prop.id && 
            v.recordIndex === recordIndex && 
            v.validationType === 'collection_property'
          );
          
          if (!existingValidation) {
            console.log(`🎯 CREATING NULL VALIDATION: ${collection.collectionName}.${prop.propertyName}[${recordIndex}] (ignored field now editable)`);
            await storage.createFieldValidation({
              sessionId,
              fieldId: prop.id,
              validationType: 'collection_property',
              dataType: prop.propertyType || 'TEXT',
              collectionName: collection.collectionName,
              recordIndex: recordIndex,
              extractedValue: null, // Empty/ignored field
              confidenceScore: 0,
              validationStatus: 'pending', // Pending for empty fields
              aiReasoning: 'Field ignored by AI - ready for manual entry',
              manuallyVerified: false,
              manuallyUpdated: false
            });
          }
        }
      }
    }
    
    console.log(`Completed ensuring all validation records exist for session ${sessionId}`);
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
        
        // Determine validation status based on confidence score vs threshold
        const confidenceScore = fieldValue ? 95 : 20;
        const autoVerifyThreshold = field.autoVerificationConfidence || 80;
        const shouldAutoVerify = confidenceScore >= autoVerifyThreshold;
        const validationStatus = shouldAutoVerify ? 'verified' : 'unverified';
        
        console.log(`Schema field ${field.fieldName}: confidence ${confidenceScore}% vs threshold ${autoVerifyThreshold}% = ${validationStatus}`);
        
        await storage.createFieldValidation({
          sessionId,
          validationType: 'schema_field',
          dataType: field.fieldType,
          fieldId: field.id,
          collectionName: null,
          recordIndex: 0,
          extractedValue: fieldValue !== undefined ? fieldValue?.toString() : null,
          originalExtractedValue: fieldValue !== undefined ? fieldValue?.toString() : null,
          originalConfidenceScore: fieldValue ? 95 : 20,
          originalAiReasoning: fieldValue ? "Calculated from extracted data" : "Not found in document",
          validationStatus: validationStatus,
          aiReasoning: "Pending validation",
          manuallyVerified: false,
          confidenceScore: confidenceScore
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
                validationType: 'collection_property',
                dataType: property.propertyType,
                fieldId: property.id,
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
      console.error("Field validations error:", error);
      res.status(500).json({ message: "Failed to fetch field validations", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/sessions/:sessionId/validations", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log('CREATE VALIDATION - Raw request body:', JSON.stringify(req.body, null, 2));
      
      const result = insertFieldValidationSchema.safeParse({
        ...req.body,
        sessionId
      });
      
      console.log('CREATE VALIDATION - Schema validation result:', {
        success: result.success,
        data: result.success ? result.data : null,
        errors: result.success ? null : result.error.errors
      });
      
      if (!result.success) {
        console.error('CREATE VALIDATION - Schema validation failed:', result.error.errors);
        return res.status(400).json({ message: "Invalid field validation data", errors: result.error.errors });
      }
      
      console.log('CREATE VALIDATION - About to create validation with data:', JSON.stringify(result.data, null, 2));
      const validation = await storage.createFieldValidation(result.data);
      console.log('CREATE VALIDATION - Created validation:', JSON.stringify(validation, null, 2));
      
      res.status(201).json(validation);
    } catch (error) {
      console.error('CREATE VALIDATION - Error:', error);
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
      
      // Get the current validation to preserve original values if this is the first manual edit
      const currentValidation = await storage.getFieldValidation(id);
      if (!currentValidation) {
        return res.status(404).json({ message: "Validation not found" });
      }
      
      let updateData = { ...result.data };
      
      // Check if this is a revert to the original AI answer
      if (result.data.extractedValue && 
          currentValidation.originalExtractedValue && 
          result.data.extractedValue === currentValidation.originalExtractedValue) {
        // This is a revert - restore original AI state completely
        updateData.extractedValue = currentValidation.originalExtractedValue;
        updateData.aiReasoning = currentValidation.originalAiReasoning;
        updateData.confidenceScore = currentValidation.originalConfidenceScore;
        updateData.manuallyUpdated = false; // Clear manual update flag
        // Keep original values for future potential reverts
      } 
      // If this is a manual edit and we don't have original values stored yet, preserve them
      else if (result.data.extractedValue && result.data.extractedValue !== currentValidation.extractedValue) {
        // Only preserve original values if they haven't been set yet (first manual edit)
        if (!currentValidation.originalExtractedValue && currentValidation.extractedValue) {
          updateData.originalExtractedValue = currentValidation.extractedValue;
          updateData.originalConfidenceScore = currentValidation.confidenceScore;
          updateData.originalAiReasoning = currentValidation.aiReasoning;
        }
        // Mark as manually updated
        updateData.manuallyUpdated = true;
      }
      
      const updatedValidation = await storage.updateFieldValidation(id, updateData);
      if (!updatedValidation) {
        return res.status(404).json({ message: "Validation not found" });
      }

      // If this is a collection field validation and we're creating/updating a value
      // check if we need to create null validations for other properties in the same collection
      if (updatedValidation.collectionName && updatedValidation.recordIndex !== null && updatedValidation.recordIndex !== undefined) {
        try {
          // Get all existing validations for this collection and record index
          const existingValidations = await storage.getValidationsByCollectionAndIndex(
            updatedValidation.sessionId, 
            updatedValidation.collectionName, 
            updatedValidation.recordIndex
          );

          // Get the collection properties to determine what fields should exist
          const collection = await storage.getCollectionByName(updatedValidation.collectionName);
          if (collection && collection.properties) {
            const existingFieldNames = existingValidations.map(v => {
              // Extract property name from field name (e.g., "Collection.Property[0]" -> "Property")
              const match = v.fieldName.match(/\.([^[\]]+)(?:\[\d+\])?$/);
              return match ? match[1] : v.fieldName;
            });

            // Create validations for missing properties
            for (const property of collection.properties) {
              if (!existingFieldNames.includes(property.propertyName)) {
                const newFieldName = `${updatedValidation.collectionName}.${property.propertyName}[${updatedValidation.recordIndex}]`;
                
                const newValidation = {
                  sessionId: updatedValidation.sessionId,
                  validationType: "collection_property" as const,
                  dataType: property.propertyType || "TEXT", // Use propertyType from collection property
                  fieldId: property.id,
                  collectionName: updatedValidation.collectionName,
                  recordIndex: updatedValidation.recordIndex,
                  extractedValue: null,
                  validationStatus: "pending" as const,
                  confidenceScore: 0,
                  aiReasoning: null,
                  manuallyVerified: false,
                  manuallyUpdated: false,
                  originalExtractedValue: null,
                  originalConfidenceScore: null,
                  originalAiReasoning: null
                };
                
                await storage.createFieldValidation(newValidation);
              }
            }
          }
        } catch (error) {
          console.error("Error creating null validations for new collection item:", error);
          // Don't fail the main update if this fails - just log the error
        }
      }

      res.json(updatedValidation);
    } catch (error) {
      console.error("Update validation error:", error);
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


  // Document-only upload endpoint - extract and save documents without AI processing
  app.post("/api/sessions/:sessionId/upload-documents", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { files } = req.body;
      
      console.log(`DOCUMENT UPLOAD: Starting document upload for session ${sessionId}`);
      console.log(`Processing ${files?.length || 0} documents`);
      
      // Get session to verify it exists
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      // Convert frontend file format to Python script expected format
      const convertedFiles = (files || []).map((file: any) => ({
        file_name: file.name,
        file_content: file.content, // This is the data URL from FileReader
        mime_type: file.type
      }));

      // Call Python script for text extraction only (reusing existing logic)
      const extractionData = {
        step: "extract_text_only",
        documents: convertedFiles
      };
      
      const python = spawn('python3', ['document_extractor.py']);
      
      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code !== 0) {
          console.error('DOCUMENT UPLOAD error:', error);
          return res.status(500).json({ 
            success: false,
            error: "Document upload failed",
            message: error || "Unknown error"
          });
        }
        
        try {
          // Log the raw output and error for debugging
          if (error) {
            console.log('DOCUMENT UPLOAD DEBUG - Python stderr:', error);
          }
          console.log('DOCUMENT UPLOAD DEBUG - Python stdout length:', output.length);
          
          const result = JSON.parse(output);
          console.log(`DOCUMENT UPLOAD: Extracted text from ${result.extracted_texts?.length || 0} documents`);
          
          // Debug each extracted text
          if (result.extracted_texts && Array.isArray(result.extracted_texts)) {
            result.extracted_texts.forEach((extractedText: any, index: number) => {
              console.log(`DOCUMENT UPLOAD DEBUG ${index + 1}: ${extractedText.file_name} - content length: ${extractedText.text_content?.length || 0}, word count: ${extractedText.word_count || 0}`);
              if (extractedText.text_content && extractedText.text_content.length > 0) {
                console.log(`DOCUMENT UPLOAD DEBUG ${index + 1} preview: ${extractedText.text_content.substring(0, 100)}...`);
              } else {
                console.log(`DOCUMENT UPLOAD DEBUG ${index + 1}: NO CONTENT EXTRACTED`);
              }
            });
          }
          
          let documentsAdded = 0;
          
          // Save each document with its extracted content to session documents table
          if (result.extracted_texts && Array.isArray(result.extracted_texts)) {
            for (const extractedText of result.extracted_texts) {
              try {
                // Find the original file to get size and MIME type
                const originalFile = convertedFiles.find(f => f.file_name === extractedText.file_name);
                
                // Calculate file size from data URL if available
                let fileSize = null;
                if (originalFile?.file_content && originalFile.file_content.startsWith('data:')) {
                  const base64Data = originalFile.file_content.split(',')[1];
                  if (base64Data) {
                    fileSize = Math.round((base64Data.length * 3) / 4); // Estimate original file size
                  }
                }
                
                // Create session document record
                const documentData = {
                  sessionId: sessionId,
                  fileName: extractedText.file_name,
                  fileSize: fileSize,
                  mimeType: originalFile?.mime_type || 'application/octet-stream',
                  extractedContent: extractedText.text_content || '',
                  pageCount: extractedText.page_count || null,
                  extractionMethod: extractedText.extraction_method || 'gemini'
                };
                
                console.log(`DOCUMENT UPLOAD SAVE DEBUG: Content length being saved: ${documentData.extractedContent.length}`);
                console.log(`DOCUMENT UPLOAD SAVE DEBUG: Content preview: ${documentData.extractedContent.substring(0, 100)}...`);
                
                await storage.createSessionDocument(documentData);
                
                documentsAdded++;
                console.log(`DOCUMENT UPLOAD: Saved document ${extractedText.file_name} to session ${sessionId}`);
                
              } catch (docError) {
                console.error(`Error saving document ${extractedText.file_name}:`, docError);
              }
            }
          }
          
          // Update session document count
          await storage.updateExtractionSession(sessionId, {
            documentCount: (session.documentCount || 0) + documentsAdded,
            status: documentsAdded > 0 ? "documents_uploaded" : session.status
          });
          
          res.json({ 
            success: true,
            message: `Successfully uploaded ${documentsAdded} documents`,
            documentsAdded,
            sessionId 
          });
          
        } catch (parseError) {
          console.error('DOCUMENT UPLOAD JSON parse error:', parseError);
          res.status(500).json({ 
            success: false,
            error: "Failed to parse document upload results",
            message: parseError instanceof Error ? parseError.message : "Unknown error"
          });
        }
      });
      
    } catch (error) {
      console.error("DOCUMENT UPLOAD ERROR:", error);
      res.status(500).json({ 
        success: false,
        error: "Document upload failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
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

  // Excel Wizardry Functions Routes
  
  // Get all Excel wizardry functions
  app.get("/api/excel-functions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const functions = await storage.getExcelWizardryFunctions();
      res.json(functions);
    } catch (error) {
      console.error("Error getting Excel wizardry functions:", error);
      res.status(500).json({ message: "Failed to get Excel wizardry functions" });
    }
  });

  // Get specific Excel wizardry function
  app.get("/api/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const func = await storage.getExcelWizardryFunction(id);
      
      if (!func) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      res.json(func);
    } catch (error) {
      console.error("Error getting Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to get Excel wizardry function" });
    }
  });

  // Create Excel wizardry function
  app.post("/api/excel-functions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const result = insertExcelWizardryFunctionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid Excel wizardry function data", 
          errors: result.error.errors 
        });
      }

      const func = await storage.createExcelWizardryFunction(result.data);
      res.status(201).json(func);
    } catch (error) {
      console.error("Error creating Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to create Excel wizardry function" });
    }
  });

  // Update Excel wizardry function
  app.put("/api/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const result = insertExcelWizardryFunctionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid Excel wizardry function data", 
          errors: result.error.errors 
        });
      }

      const func = await storage.updateExcelWizardryFunction(id, result.data);
      if (!func) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      res.json(func);
    } catch (error) {
      console.error("Error updating Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to update Excel wizardry function" });
    }
  });

  // PATCH route for partial updates
  app.patch("/api/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const result = insertExcelWizardryFunctionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid Excel wizardry function data", 
          errors: result.error.errors 
        });
      }

      const func = await storage.updateExcelWizardryFunction(id, result.data);
      if (!func) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      res.json(func);
    } catch (error) {
      console.error("Error updating Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to update Excel wizardry function" });
    }
  });

  // Increment function usage
  app.post("/api/excel-functions/:id/increment-usage", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const func = await storage.incrementFunctionUsage(id);
      
      if (!func) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      res.json(func);
    } catch (error) {
      console.error("Error incrementing function usage:", error);
      res.status(500).json({ message: "Failed to increment function usage" });
    }
  });

  // Search Excel wizardry functions by tags
  app.post("/api/excel-functions/search", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { tags } = req.body;
      
      if (!Array.isArray(tags)) {
        return res.status(400).json({ message: "Tags must be an array" });
      }
      
      const functions = await storage.searchExcelWizardryFunctions(tags);
      res.json(functions);
    } catch (error) {
      console.error("Error searching Excel wizardry functions:", error);
      res.status(500).json({ message: "Failed to search Excel wizardry functions" });
    }
  });

  // Delete Excel wizardry function
  app.delete("/api/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteExcelWizardryFunction(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to delete Excel wizardry function" });
    }
  });

  // Generate Excel wizardry function code
  app.post("/api/excel-functions/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { name, description, functionType, inputParameters, aiAssistanceRequired, aiAssistancePrompt, tags } = req.body;
      
      if (!name || !description || !inputParameters || !Array.isArray(inputParameters)) {
        return res.status(400).json({ 
          message: "Invalid function generation data. Name, description, and inputParameters are required." 
        });
      }

      // Import the Gemini function
      const { generateFunctionCode } = await import("./gemini");
      
      // Generate the function code using AI
      const { functionCode, metadata } = await generateFunctionCode(
        name,
        description, 
        inputParameters,
        functionType,
        aiAssistanceRequired,
        aiAssistancePrompt
      );

      // Create the complete function object
      const functionData = {
        name,
        description,
        functionCode,
        functionType: functionType || "SCRIPT",
        inputParameters,
        aiAssistanceRequired: aiAssistanceRequired || false,
        aiAssistancePrompt: aiAssistancePrompt || null,
        metadata,
        inputSchema: { parameters: inputParameters }, // Basic input schema
        outputSchema: { format: "field_validations_compatible" }, // Basic output schema
        tags: tags || []
      };

      res.json(functionData);
    } catch (error) {
      console.error("Error generating Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to generate Excel wizardry function" });
    }
  });

  // Chat Routes
  
  // Get chat messages for a session
  app.get("/api/sessions/:sessionId/chat", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const sessionId = req.params.sessionId;
      const messages = await storage.getChatMessages(sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting chat messages:", error);
      res.status(500).json({ message: "Failed to get chat messages" });
    }
  });

  // Send a chat message
  app.post("/api/sessions/:sessionId/chat", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Get current user from JWT token (set by authenticateToken middleware)
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Create user message
      const userMessage = await storage.createChatMessage({
        sessionId,
        userId,
        role: "user",
        content: message.trim(),
      });

      // Generate AI response context
      const session = await storage.getSessionWithValidations(sessionId);
      const validations = await storage.getFieldValidations(sessionId);
      const project = session ? await storage.getProject(session.projectId) : null;

      if (!session || !project) {
        return res.status(404).json({ message: "Session or project not found" });
      }

      // Get additional project data
      const [schemaFields, collections] = await Promise.all([
        storage.getProjectSchemaFields(session.projectId),
        storage.getObjectCollections(session.projectId)
      ]);

      const context = {
        session,
        validations,
        projectFields: schemaFields || [],
        collections: collections || [],
        collectionProperties: []
      };

      // Generate AI response
      const aiResponseText = await generateChatResponse(message.trim(), context);

      // Create AI message
      const aiMessage = await storage.createChatMessage({
        sessionId,
        userId,
        role: "assistant", 
        content: aiResponseText,
      });

      res.json({ userMessage, aiMessage });
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: "Failed to send chat message" });
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

  // Run extraction wizardry Python script
  app.post("/api/run-wizardry", async (req, res) => {
    try {
      const requestData = req.body; // Get request data with document_ids and session_id
      
      console.log("Starting wizardry extraction with data:", {
        session_id: requestData?.session_id,
        document_count: requestData?.document_ids?.length || 0,
        extraction_number: requestData?.extraction_number || 0
      });
      
      // Set a longer timeout for this endpoint
      req.setTimeout(300000); // 5 minutes
      res.setTimeout(300000); // 5 minutes
      
      // For run-wizardry endpoint, use the original extraction_wizardry.py for compatibility
      const python = spawn('python3', ['extraction_wizardry.py']);
      
      // Handle process errors
      python.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to start extraction process" });
        }
      });
      
      // Pass request data to Python script via stdin
      if (requestData && requestData.document_ids && requestData.session_id) {
        python.stdin.write(JSON.stringify(requestData));
      }
      python.stdin.end();
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data: any) => {
        output += data.toString();
        console.log('Python output chunk received:', data.toString().slice(0, 200) + '...');
      });
      
      python.stderr.on('data', (data: any) => {
        error += data.toString();
        console.error('Python stderr:', data.toString());
      });
      
      python.on('close', (code: any) => {
        console.log(`Python process exited with code: ${code}`);
        
        if (!res.headersSent) {
          if (code !== 0) {
            console.error('Wizardry script error:', error);
            return res.status(500).json({ 
              message: "Wizardry script failed", 
              error: error 
            });
          }
          
          // Return the complete output from Python script (includes both document properties and Gemini analysis)
          res.json({ 
            message: "Wizardry analysis completed",
            output: output.trim(),
            success: true
          });
        }
      });
      
    } catch (error) {
      console.error("Wizardry execution error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to run wizardry script" });
      }
    }
  });

  // Utility endpoint to populate missing collectionId values
  app.post("/api/migrations/populate-collection-ids", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.populateMissingCollectionIds();
      res.json({ success: true, message: "Collection IDs populated successfully" });
    } catch (error) {
      console.error("Error populating collection IDs:", error);
      res.status(500).json({ message: "Failed to populate collection IDs" });
    }
  });

  // Development console forwarding endpoint
  app.post("/api/dev/console", (req, res) => {
    try {
      const { level, message, timestamp } = req.body;
      
      // Filter out noisy console messages to improve readability
      if (message.includes("CollectionCard - Props received") ||
          message.includes("hot updated") ||
          message.includes("connected") ||
          message.includes("connecting")) {
        res.status(200).json({ success: true });
        return;
      }
      
      // Format and clean up browser console messages
      let cleanMessage = message;
      if (cleanMessage.length > 150) {
        cleanMessage = cleanMessage.slice(0, 147) + "...";
      }
      
      // Use emoji prefixes for better visual distinction
      const prefixes = {
        'log': '📝',
        'error': '❌',
        'warn': '⚠️',
        'info': 'ℹ️',
        'debug': '🔍'
      };
      
      const prefix = prefixes[level] || '📝';
      log(`${prefix} ${cleanMessage}`, 'browser');
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // Create HTTP server and return it
  const httpServer = createServer(app);
  return httpServer;
};
