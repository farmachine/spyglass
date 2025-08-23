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
      
      console.log('🔧 Creating project schema field with data:', JSON.stringify(result.data, null, 2));
      
      const field = await storage.createProjectSchemaField(result.data);
      
      console.log('✅ Successfully created project schema field:', JSON.stringify(field, null, 2));
      
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

  // Get all collections across all projects for referencing
  app.get("/api/collections/all-for-references", async (req, res) => {
    try {
      // For now, use a default organization for development
      // TODO: Restore authenticateToken middleware after fixing auth issues
      const defaultOrgId = "550e8400-e29b-41d4-a716-446655440000"; // Using sample org ID from MemStorage
      console.log("📝 Using default org ID for collections:", defaultOrgId);
      const collections = await storage.getAllCollectionsForReferences(defaultOrgId);
      console.log("📝 Collections found:", collections.length);
      res.json(collections);
    } catch (error) {
      console.error("Failed to fetch all collections for references:", error);
      res.status(500).json({ message: "Failed to fetch collections for references" });
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
        propertyName: collection.collectionName + " ID",
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
      
      console.log('🔧 Creating collection property with data:', JSON.stringify(result.data, null, 2));
      
      const property = await storage.createCollectionProperty(result.data);
      
      console.log('✅ Successfully created collection property:', JSON.stringify(property, null, 2));
      
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
  
  // Workflow Step endpoints
  app.get("/api/projects/:projectId/workflow", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const steps = await storage.getWorkflowSteps(projectId);
      
      // Get values for each step
      const stepsWithValues = await Promise.all(steps.map(async (step) => {
        const values = await storage.getStepValues(step.id);
        return { ...step, values };
      }));
      
      res.json({ steps: stepsWithValues });
    } catch (error) {
      console.error("Error getting workflow:", error);
      res.status(500).json({ message: "Failed to get workflow" });
    }
  });

  app.post("/api/projects/:projectId/workflow", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const workflow = req.body;
      
      console.log("\n========== SAVING FULL WORKFLOW ==========");
      console.log("Project ID:", projectId);
      console.log("Number of Steps:", workflow.steps?.length || 0);
      
      // Log each step summary
      if (workflow.steps && workflow.steps.length > 0) {
        console.log("\nSteps Summary:");
        workflow.steps.forEach((step: any, index: number) => {
          console.log(`  ${index + 1}. ${step.name} (${step.type}) - ${step.values?.length || 0} values`);
        });
      }
      
      console.log("\nFull Workflow Data:", JSON.stringify(workflow, null, 2));
      console.log("==========================================\n");
      
      await storage.saveProjectWorkflow(projectId, workflow);
      
      console.log("✅ Full workflow saved successfully!");
      res.json({ success: true, message: "Workflow saved successfully" });
    } catch (error) {
      console.error("\n❌ Error saving full workflow:", error);
      res.status(500).json({ message: "Failed to save workflow" });
    }
  });

  // Helper function to handle workflow step saving logic
  const saveWorkflowStep = async (stepId: string, stepData: any) => {
    console.log("\n========== SAVING WORKFLOW STEP ==========");
    console.log("Step ID:", stepId);
    console.log("Step Name:", stepData.name);
    console.log("Step Type:", stepData.type);
    console.log("Project ID:", stepData.projectId);
    console.log("Full Step Data:", JSON.stringify(stepData, null, 2));
    console.log("==========================================\n");
    
    // Check if step exists
    const existingStep = await storage.getWorkflowStep(stepId);
    
    if (existingStep) {
      // Update existing step
      await storage.updateWorkflowStep(stepId, {
        stepName: stepData.name,
        stepType: stepData.type,
        description: stepData.description,
        orderIndex: stepData.orderIndex,
        valueCount: stepData.valueCount || stepData.values?.length || 0,
        identifierId: stepData.identifierId
      });
    } else {
      // Create new step - need to get project ID from the step data
      if (!stepData.projectId) {
        throw new Error("Project ID is required to create a new step");
      }
      
      await storage.createWorkflowStep({
        id: stepId,
        projectId: stepData.projectId,
        stepName: stepData.name,
        stepType: stepData.type,
        description: stepData.description,
        orderIndex: stepData.orderIndex,
        valueCount: stepData.valueCount || stepData.values?.length || 0,
        identifierId: stepData.identifierId
      });
    }
    
    // Update values for this step
    console.log("\n🔄 Updating step values...");
    
    // Get existing values to track what needs to be deleted
    const existingValues = await storage.getStepValues(stepId);
    const existingValueIds = new Set(existingValues.map(v => v.id));
    const newValueIds = new Set((stepData.values || []).map((v: any) => v.id));
    
    // Delete values that are no longer in the new data
    for (const existingValue of existingValues) {
      if (!newValueIds.has(existingValue.id)) {
        console.log(`  🗑️ Deleting removed value: ${existingValue.id}`);
        await storage.deleteStepValue(existingValue.id);
      }
    }
    
    // Process each value - either update existing or create new
    for (const value of stepData.values || []) {
      const valueData = {
        id: value.id,
        stepId: stepId,
        valueName: value.name,
        dataType: value.dataType,
        description: value.description,
        isIdentifier: stepData.type === 'list' && stepData.values[0]?.id === value.id,
        orderIndex: value.orderIndex || 0,
        toolId: value.toolId || null,  // Convert empty string to null
        inputValues: value.inputValues,
        autoVerificationConfidence: value.autoVerificationConfidence,
        choiceOptions: value.choiceOptions
      };
      
      if (existingValueIds.has(value.id)) {
        // Update existing value
        console.log(`  📝 Updating existing value: ${value.id}`);
        await storage.updateStepValue(value.id, valueData);
      } else {
        // Create new value
        console.log(`  ➕ Creating new value: ${value.id}`);
        await storage.createStepValue(valueData);
      }
    }
    
    console.log("✅ Step saved successfully!");
  };

  // POST endpoint for workflow steps
  app.post("/api/workflow-steps/:stepId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { stepId } = req.params;
      const stepData = req.body;
      
      console.log("\n🔄 POST request to save workflow step:", stepId);
      await saveWorkflowStep(stepId, stepData);
      
      res.json({ success: true, message: "Step saved successfully" });
    } catch (error) {
      console.error("\n❌ Error saving step (POST):", error);
      res.status(500).json({ message: "Failed to save step" });
    }
  });

  // PUT endpoint for workflow steps (same logic as POST)
  app.put("/api/workflow-steps/:stepId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { stepId } = req.params;
      const stepData = req.body;
      
      console.log("\n🔄 PUT request to save workflow step:", stepId);
      await saveWorkflowStep(stepId, stepData);
      
      res.json({ success: true, message: "Step saved successfully" });
    } catch (error) {
      console.error("\n❌ Error saving step (PUT):", error);
      res.status(500).json({ message: "Failed to save step" });
    }
  });

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

  // Get Excel wizardry functions by project
  app.get("/api/projects/:projectId/excel-functions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const functions = await storage.getExcelWizardryFunctionsByProject(projectId);
      res.json(functions);
    } catch (error) {
      console.error("Error getting Excel wizardry functions by project:", error);
      res.status(500).json({ message: "Failed to get Excel wizardry functions" });
    }
  });

  // Update Excel wizardry function (project-scoped)
  app.patch("/api/projects/:projectId/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id, projectId } = req.params;
      
      // Verify the function belongs to this project
      const existingFunction = await storage.getExcelWizardryFunction(id);
      if (!existingFunction) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      if (existingFunction.projectId !== projectId) {
        return res.status(403).json({ message: "Function does not belong to this project" });
      }

      const updated = await storage.updateExcelWizardryFunction(id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to update Excel wizardry function" });
    }
  });

  // Delete Excel wizardry function (project-scoped)
  app.delete("/api/projects/:projectId/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id, projectId } = req.params;
      
      // Verify the function belongs to this project
      const existingFunction = await storage.getExcelWizardryFunction(id);
      if (!existingFunction) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      if (existingFunction.projectId !== projectId) {
        return res.status(403).json({ message: "Function does not belong to this project" });
      }

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
      console.log('🔧 Creating new Excel function with data:', JSON.stringify(req.body, null, 2));
      
      // Custom validation for AI_ONLY vs CODE tools
      const { toolType, aiPrompt, functionCode, inputParameters, ...otherData } = req.body;
      
      // Validate required fields based on tool type
      if (toolType === 'AI_ONLY') {
        if (!aiPrompt) {
          console.error('❌ AI_ONLY tools require aiPrompt field');
          return res.status(400).json({ 
            message: "AI_ONLY tools must have an aiPrompt field", 
            errors: [{ path: ['aiPrompt'], message: 'Required for AI_ONLY tools' }]
          });
        }
      } else if (toolType === 'CODE') {
        if (!functionCode) {
          console.error('❌ CODE tools require functionCode field');
          return res.status(400).json({ 
            message: "CODE tools must have a functionCode field", 
            errors: [{ path: ['functionCode'], message: 'Required for CODE tools' }]
          });
        }
      }
      
      // Process input parameters and extract document content if needed
      const processedParams = [];
      const metadata = otherData.metadata || {};
      
      // First create the function to get its ID
      const toolData = {
        ...otherData,
        inputParameters: inputParameters || [],
        toolType,
        aiPrompt: toolType === 'AI_ONLY' ? aiPrompt : null,
        functionCode: toolType === 'CODE' ? functionCode : null,
        metadata
      };

      console.log('✅ Custom validation passed, creating function...');
      const func = await storage.createExcelWizardryFunction(toolData);
      
      // Now process parameters and save sample documents/data
      for (const param of inputParameters || []) {
        const processedParam = { ...param };
        
        // If this is a document parameter with a sample file, extract its content
        if (param.type === 'document' && param.sampleFileURL) {
          try {
            console.log(`📄 Extracting content from sample file: ${param.sampleFile}`);
            
            // Extract the content using document_extractor.py
            const { ObjectStorageService, objectStorageClient } = await import("./objectStorage");
            const urlParts = new URL(param.sampleFileURL);
            const pathParts = urlParts.pathname.split('/');
            const bucketName = pathParts[1];
            const objectName = pathParts.slice(2).join('/');
            
            const bucket = objectStorageClient.bucket(bucketName);
            const objectFile = bucket.file(objectName);
            
            // Stream the file content to a buffer
            const chunks: Buffer[] = [];
            const stream = objectFile.createReadStream();
            
            await new Promise((resolve, reject) => {
              stream.on('data', (chunk) => chunks.push(chunk));
              stream.on('end', resolve);
              stream.on('error', reject);
            });
            
            const fileBuffer = Buffer.concat(chunks);
            const [fileMetadata] = await objectFile.getMetadata();
            const mimeType = fileMetadata.contentType || 'application/octet-stream';
            const base64Content = fileBuffer.toString('base64');
            const dataURL = `data:${mimeType};base64,${base64Content}`;
            
            // Extract text content using document_extractor.py
            const extractionData = {
              step: "extract_text_only",
              documents: [{
                file_name: param.sampleFile,    // Changed to match extractor format
                mime_type: mimeType,             // Changed to match extractor format
                file_content: dataURL            // Changed to match extractor format
              }]
            };
            
            const { spawn } = (await import('child_process')).default || await import('child_process');
            const python = spawn('python3', ['document_extractor.py']);
            
            python.stdin.write(JSON.stringify(extractionData));
            python.stdin.end();
            
            let output = '';
            let error = '';
            
            await new Promise((resolve, reject) => {
              python.stdout.on('data', (data: any) => {
                output += data.toString();
              });
              
              python.stderr.on('data', (data: any) => {
                error += data.toString();
              });
              
              python.on('close', (code: any) => {
                if (code !== 0) {
                  console.error('Document extraction error:', error);
                  reject(new Error(error));
                } else {
                  resolve(undefined);
                }
              });
            });
            
            const result = JSON.parse(output);
            const extractedText = result.extracted_texts?.[0];
            const extractedContent = extractedText?.text_content || '';
            
            // Save to sampleDocuments table
            await storage.createSampleDocument({
              functionId: func.id,
              parameterName: param.name,
              fileName: param.sampleFile,
              filePath: param.sampleFileURL,
              mimeType: mimeType,
              extractedContent: extractedContent
            });
            
            // Also store in metadata for backward compatibility
            if (!metadata.sampleDocumentContent) {
              metadata.sampleDocumentContent = {};
            }
            metadata.sampleDocumentContent[param.name] = extractedContent;
            
            console.log(`✅ Extracted and saved ${extractedContent.length} characters from ${param.sampleFile}`);
            
          } catch (error) {
            console.error(`Failed to extract content from sample file:`, error);
          }
        }
        
        // Process sample data to ensure proper structure
        if (param.type === 'data' && param.sampleData) {
          // Ensure sample data is in the correct format
          if (Array.isArray(param.sampleData)) {
            // Already an array, ensure each item has identifierId
            const structuredData = param.sampleData.map((item, idx) => {
              if (typeof item === 'object' && item !== null) {
                return {
                  identifierId: item.identifierId || String(idx),
                  ...item
                };
              }
              return item;
            });
            
            // Store in metadata
            if (!metadata.sampleData) {
              metadata.sampleData = {};
            }
            metadata.sampleData[param.name] = structuredData;
            processedParam.sampleData = structuredData;
            
            console.log(`✅ Structured sample data for ${param.name}: ${structuredData.length} records`);
          }
        }
        
        // For text parameters, save sample text
        if (param.type === 'text' && param.sampleText) {
          await storage.createSampleDocument({
            functionId: func.id,
            parameterName: param.name,
            fileName: `${param.name}_sample.txt`,
            sampleText: param.sampleText,
            mimeType: 'text/plain'
          });
          console.log(`✅ Saved sample text for ${param.name}`);
        }
        
        processedParams.push(processedParam);
      }
      
      // Update the function with processed parameters and metadata
      if (processedParams.length > 0 || Object.keys(metadata).length > 0) {
        await storage.updateExcelWizardryFunction(func.id, {
          inputParameters: processedParams,
          metadata
        });
      }
      console.log('🎉 Successfully created Excel function:', JSON.stringify(func, null, 2));
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
      console.log(`🔧 Full update Excel function ${id} with data:`, JSON.stringify(req.body, null, 2));
      
      const result = insertExcelWizardryFunctionSchema.partial().safeParse(req.body);
      if (!result.success) {
        console.error('❌ Schema validation failed for Excel function update:', result.error.errors);
        return res.status(400).json({ 
          message: "Invalid Excel wizardry function data", 
          errors: result.error.errors 
        });
      }

      // Process input parameters if they're being updated
      const { inputParameters } = result.data;
      const processedParams = [];
      const metadata = result.data.metadata || {};
      
      console.log(`📦 Processing ${inputParameters?.length || 0} input parameters`);
      
      if (inputParameters) {
        for (const param of inputParameters) {
          const processedParam = { ...param };
          
          // If document parameter with sample file, check if we need to extract
          if (param.type === 'document' && param.sampleFileURL && param.sampleFile) {
            console.log(`📎 Processing document parameter: ${param.name}`);
            console.log(`📎 Sample file URL: ${param.sampleFileURL}`);
            
            // Check if a sample document already exists for this function and parameter
            const existingDocs = await storage.getSampleDocuments(id);
            const existingDoc = existingDocs.find((doc: any) => doc.parameterName === param.name);
            
            if (existingDoc) {
              console.log(`📎 Sample document already exists for ${param.name}, skipping extraction`);
              // Keep the existing document, don't delete or re-extract
              processedParams.push(processedParam);
              continue;
            }
            
            console.log(`📎 No existing sample document for ${param.name}, extracting content`);
            try {
              
              // Extract and save new content
              const { ObjectStorageService, objectStorageClient } = await import("./objectStorage");
              const urlParts = new URL(param.sampleFileURL);
              const pathParts = urlParts.pathname.split('/');
              const bucketName = pathParts[1];
              const objectName = pathParts.slice(2).join('/');
              
              const bucket = objectStorageClient.bucket(bucketName);
              const objectFile = bucket.file(objectName);
              
              const chunks: Buffer[] = [];
              const stream = objectFile.createReadStream();
              
              await new Promise((resolve, reject) => {
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('end', resolve);
                stream.on('error', reject);
              });
              
              const fileBuffer = Buffer.concat(chunks);
              const [fileMetadata] = await objectFile.getMetadata();
              const mimeType = fileMetadata.contentType || 'application/octet-stream';
              const base64Content = fileBuffer.toString('base64');
              const dataURL = `data:${mimeType};base64,${base64Content}`;
              
              // Extract text content
              console.log(`📊 Starting extraction for ${param.sampleFile}`);
              console.log(`📊 File size: ${fileBuffer.length} bytes`);
              console.log(`📊 MIME type: ${mimeType}`);
              
              const extractionData = {
                step: "extract_text_only",
                documents: [{
                  file_name: param.sampleFile,  // Changed from fileName to file_name
                  mime_type: mimeType,           // Changed from mimeType to mime_type
                  file_content: dataURL          // Changed from dataURL to file_content
                }]
              };
              
              const { spawn } = require('child_process');
              const python = spawn('python3', ['document_extractor.py']);
              
              python.stdin.write(JSON.stringify(extractionData));
              python.stdin.end();
              
              let output = '';
              let error = '';
              
              await new Promise((resolve, reject) => {
                python.stdout.on('data', (data: any) => {
                  output += data.toString();
                });
                
                python.stderr.on('data', (data: any) => {
                  error += data.toString();
                  console.log('🐍 Python stderr:', data.toString());
                });
                
                python.on('close', (code: any) => {
                  console.log(`🐍 Python extraction finished with code ${code}`);
                  console.log(`🐍 Output length: ${output.length}`);
                  if (code !== 0) {
                    console.error('❌ Document extraction error:', error);
                    reject(new Error(error));
                  } else {
                    resolve(undefined);
                  }
                });
              });
              
              let extractResult: any = {};
              try {
                extractResult = JSON.parse(output);
              } catch (parseError) {
                console.error('❌ Failed to parse extraction output:', parseError);
                console.error('❌ Raw output:', output.substring(0, 500));
                throw parseError;
              }
              let extractedContent = '';
              if (extractResult.extracted_texts && extractResult.extracted_texts[0]) {
                extractedContent = extractResult.extracted_texts[0].text_content || '';
              } else if (extractResult.text_content) {
                extractedContent = extractResult.text_content;
              }
              
              console.log(`📄 Extraction result:`, JSON.stringify(extractResult, null, 2).substring(0, 500));
              console.log(`📝 Extracted content length: ${extractedContent.length}`);
              
              // Save new sample document
              const savedDoc = await storage.createSampleDocument({
                functionId: id,
                parameterName: param.name,
                fileName: param.sampleFile,
                fileURL: param.sampleFileURL,  // Changed from filePath to fileURL
                mimeType: mimeType,
                extractedContent: extractedContent
              });
              
              console.log(`💾 Saved sample document:`, savedDoc ? `ID ${savedDoc.id}` : 'Failed to save');
              
              // Update metadata
              if (!metadata.sampleDocumentContent) {
                metadata.sampleDocumentContent = {};
              }
              metadata.sampleDocumentContent[param.name] = extractedContent;
              
              console.log(`✅ Updated sample document for ${param.name}`);
            } catch (error) {
              console.error(`Failed to update sample document:`, error);
            }
          }
          
          // Process sample data updates
          if (param.type === 'data' && param.sampleData) {
            if (Array.isArray(param.sampleData)) {
              const structuredData = param.sampleData.map((item, idx) => {
                if (typeof item === 'object' && item !== null) {
                  return {
                    identifierId: item.identifierId || String(idx),
                    ...item
                  };
                }
                return item;
              });
              
              if (!metadata.sampleData) {
                metadata.sampleData = {};
              }
              metadata.sampleData[param.name] = structuredData;
              processedParam.sampleData = structuredData;
            }
          }
          
          processedParams.push(processedParam);
        }
        
        // Update with processed parameters
        result.data.inputParameters = processedParams;
        result.data.metadata = metadata;
      }

      const func = await storage.updateExcelWizardryFunction(id, result.data);
      if (!func) {
        console.log(`❌ Excel function ${id} not found for update`);
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      console.log('✅ Successfully updated Excel function:', JSON.stringify(func, null, 2));
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
      
      console.log('🔧 Updating Excel function with data:', JSON.stringify(req.body, null, 2));
      
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
      
      console.log('✅ Successfully updated Excel function:', JSON.stringify(func, null, 2));
      
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
      console.log('🤖 Generating tool content with input:', JSON.stringify(req.body, null, 2));
      
      const { projectId, name, description, toolType, inputParameters, aiAssistanceRequired, aiAssistancePrompt, tags, outputType } = req.body;
      
      if (!name || !description || !inputParameters || !Array.isArray(inputParameters)) {
        console.error('❌ Missing required fields for tool generation');
        return res.status(400).json({ 
          message: "Invalid tool generation data. Name, description, and inputParameters are required." 
        });
      }

      // Import the unified tool engine
      const { toolEngine } = await import("./toolEngine");
      
      console.log('🧠 Starting tool content generation...');
      console.log('📝 Tool Type:', toolType);
      console.log('📝 Name:', name);
      console.log('📝 Description:', description);
      console.log('='.repeat(80));
      
      // Generate tool content using unified engine
      const { content } = await toolEngine.generateToolContent({
        name,
        description,
        toolType: toolType as "AI_ONLY" | "CODE",
        inputParameters
      });
      
      console.log('🤖 TOOL GENERATION COMPLETED');
      console.log('📄 Generated Content:');
      console.log(content);
      console.log('='.repeat(80));

      // Transform input parameters for the schema, converting sample data structure
      const transformedParameters = inputParameters.map(param => {
        if (param.type === 'data' && param.sampleData?.rows && param.sampleData?.rows.length > 0) {
          // Extract the identifier column name
          const identifierColumn = param.sampleData.identifierColumn;
          if (identifierColumn) {
            // Transform rows to array of objects with identifierId and name
            const transformedSampleData = param.sampleData.rows.map((row, index) => ({
              identifierId: index + 1, // Start from 1
              name: row[identifierColumn] || ''
            }));
            
            return {
              ...param,
              sampleData: transformedSampleData
            };
          }
        }
        return param;
      });

      // Create the complete function object
      const functionData = {
        projectId,
        name,
        description,
        functionCode: toolType === "CODE" ? content : undefined,
        aiPrompt: toolType === "AI_ONLY" ? content : undefined,
        toolType: toolType || "CODE",
        outputType: outputType || "single",
        inputParameters,
        aiAssistanceRequired: aiAssistanceRequired || false,
        aiAssistancePrompt: aiAssistancePrompt || null,
        inputSchema: { parameters: transformedParameters }, // Transform sample data for schema
        outputSchema: { format: "field_validations_compatible" }, // Basic output schema
        tags: tags || []
      };

      console.log('🎉 Generated function data:', JSON.stringify(functionData, null, 2));
      res.json(functionData);
    } catch (error) {
      console.error("Error generating Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to generate Excel wizardry function" });
    }
  });

  // Update Excel function code
  app.put("/api/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { functionCode } = req.body;
      
      if (!functionCode || typeof functionCode !== 'string') {
        return res.status(400).json({ message: "Function code is required" });
      }
      
      const updated = await storage.updateExcelWizardryFunction(id, { functionCode });
      
      if (!updated) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating function code:", error);
      res.status(500).json({ message: "Failed to update function code" });
    }
  });



  // Get impact analysis for Excel function
  app.get("/api/excel-functions/:id/impact", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      
      // Get the function
      const func = await storage.getExcelWizardryFunction(id);
      if (!func) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      // Find all schema fields and collection properties that use this function
      const impactedFields: string[] = [];
      
      // Check all projects for this organization
      const projects = await storage.getProjects(req.user!.organizationId);
      
      for (const project of projects) {
        // Check schema fields
        const schemaFields = await storage.getProjectSchemaFields(project.id);
        for (const field of schemaFields) {
          if (field.functionId === id) {
            impactedFields.push(`${project.name} → ${field.name}`);
          }
        }
        
        // Check collection properties
        const collections = await storage.getObjectCollections(project.id);
        for (const collection of collections) {
          const properties = await storage.getCollectionProperties(collection.id);
          for (const property of properties) {
            if (property.functionId === id) {
              impactedFields.push(`${project.name} → ${collection.name} → ${property.name}`);
            }
          }
        }
      }
      
      res.json({ impactedFields });
    } catch (error) {
      console.error("Error getting function impact:", error);
      res.status(500).json({ message: "Failed to get function impact" });
    }
  });

  // Regenerate Excel function code
  app.put("/api/excel-functions/:id/regenerate", async (req, res) => {
    try {
      const id = req.params.id;
      const { name, description, inputParameters, toolType, outputType, aiAssistanceRequired, aiAssistancePrompt } = req.body;
      
      console.log('🔄 Regenerating function code with form values:', {
        name,
        description,
        toolType,
        outputType,
        inputParametersCount: inputParameters?.length,
        aiAssistanceRequired
      });
      
      // Get the existing function only for fallback values
      const existingFunc = await storage.getExcelWizardryFunction(id);
      if (!existingFunc) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      // Import the Gemini function
      const { generateFunctionCode } = await import("./gemini");
      
      // PRIORITIZE FORM DATA - use current form values, fallback to existing only if not provided
      const updatedName = name || existingFunc.name;
      const updatedDescription = description || existingFunc.description;
      const updatedInputParameters = inputParameters || existingFunc.inputParameters;
      const updatedOutputType = outputType || existingFunc.outputType;
      const updatedFunctionType = toolType === 'AI_ONLY' ? 'AI_ONLY' : 'SCRIPT';
      const updatedAiAssistanceRequired = aiAssistanceRequired !== undefined ? aiAssistanceRequired : existingFunc.aiAssistanceRequired;
      const updatedAiAssistancePrompt = aiAssistancePrompt !== undefined ? aiAssistancePrompt : existingFunc.aiAssistancePrompt;
      
      console.log('📋 Final regeneration parameters:', {
        name: updatedName,
        toolType: updatedFunctionType,
        outputType: updatedOutputType,
        inputParameters: updatedInputParameters?.map(p => ({ name: p.name, type: p.type })),
        aiAssistanceRequired: updatedAiAssistanceRequired
      });
      
      // Regenerate the function code using current form values
      console.log('🤖 CALLING generateFunctionCode WITH:');
      console.log('📝 Name:', updatedName);
      console.log('📝 Description:', updatedDescription);
      console.log('📝 InputParameters:', JSON.stringify(updatedInputParameters, null, 2));
      console.log('📝 FunctionType:', updatedFunctionType);
      console.log('📝 AiAssistanceRequired:', updatedAiAssistanceRequired);
      console.log('📝 AiAssistancePrompt:', updatedAiAssistancePrompt);
      console.log('📝 OutputType:', updatedOutputType);
      console.log('='.repeat(80));
      
      const { functionCode, metadata } = await generateFunctionCode(
        updatedName,
        updatedDescription,
        updatedInputParameters,
        updatedFunctionType,
        updatedAiAssistanceRequired,
        updatedAiAssistancePrompt,
        updatedOutputType
      );
      
      console.log('🎯 Generated Python function code:');
      console.log(functionCode);
      console.log('🎯 Generated Python function metadata:', JSON.stringify(metadata, null, 2));
      
      // Save the updated function to database using current form values
      const updatedFunction = await storage.updateExcelWizardryFunction(id, {
        name: updatedName,
        description: updatedDescription,
        inputParameters: updatedInputParameters,
        outputType: updatedOutputType,
        toolType: updatedFunctionType,
        aiAssistanceRequired: updatedAiAssistanceRequired,
        aiAssistancePrompt: updatedAiAssistancePrompt,
        functionCode,
        metadata,
        updatedAt: new Date()
      });
      
      console.log('✅ Function code regenerated and saved successfully');
      res.json(updatedFunction);
    } catch (error) {
      console.error("Error regenerating function code:", error);
      res.status(500).json({ message: "Failed to regenerate function code" });
    }
  });

  // Manual fix for pandas-based column-to-worksheet function
  app.post("/api/excel-functions/:id/fix-pandas-issue", async (req, res) => {
    try {
      const id = req.params.id;
      
      // Get the existing function
      const existingFunc = await storage.getExcelWizardryFunction(id);
      if (!existingFunc) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      // Create the corrected function code that properly parses Excel text format
      const fixedFunctionCode = `import re

def extract_function(Column_Name, Excel_File):
    """
    Find which worksheet each column name appears in.
    Column_Name: List of column names to search for
    Excel_File: Text string with Excel format using '=== Sheet: Name ===' delimiters
    """
    results = []
    
    try:
        # Handle single column name or list of column names
        if isinstance(Column_Name, dict) and 'rows' in Column_Name:
            # Extract column names from data structure
            identifier = Column_Name.get('identifierColumn', 'Column Name')
            column_names_to_find = [row.get(identifier, '') for row in Column_Name['rows'] if row.get(identifier)]
        elif isinstance(Column_Name, list):
            column_names_to_find = Column_Name
        else:
            column_names_to_find = [str(Column_Name)]
            
        if not column_names_to_find:
            return [{
                "extractedValue": "No column names provided",
                "validationStatus": "invalid",
                "aiReasoning": "Empty column names input",
                "confidenceScore": 0,
                "documentSource": "manual-fix"
            }]
        
        # Initialize results dictionary for each column
        worksheet_mapping = {col_name: None for col_name in column_names_to_find}
        
        # Parse Excel text using sheet delimiters
        sheets_data = re.split(r'===\\s*Sheet:\\s*(.*?)\\s*===', Excel_File)
        
        if len(sheets_data) < 2:
            return [{
                "extractedValue": "Could not find sheet delimiters in Excel data",
                "validationStatus": "invalid", 
                "aiReasoning": "No '=== Sheet: Name ===' delimiters found in Excel text",
                "confidenceScore": 0,
                "documentSource": "manual-fix"
            }]
        
        # Process each sheet (pairs of sheet_name, sheet_content)
        for i in range(1, len(sheets_data), 2):
            sheet_name = sheets_data[i].strip()
            sheet_content = sheets_data[i+1].strip() if i+1 < len(sheets_data) else ""
            
            if not sheet_content:
                continue
                
            # Get header row (first line of sheet content)
            header_line = sheet_content.split('\\n', 1)[0]
            header_columns = [h.strip() for h in header_line.split('\\t')]
            
            # Check which requested columns are in this sheet's headers (case-insensitive)
            header_columns_lower = [col.lower() for col in header_columns]
            
            for col_name in column_names_to_find:
                if col_name and worksheet_mapping[col_name] is None:  # Only if not already found
                    if col_name.lower() in header_columns_lower:
                        worksheet_mapping[col_name] = sheet_name
        
        # Convert results to field validation format
        for col_name in column_names_to_find:
            worksheet = worksheet_mapping.get(col_name)
            if worksheet:
                results.append({
                    "extractedValue": worksheet,
                    "validationStatus": "valid",
                    "aiReasoning": f"Found column '{col_name}' in worksheet '{worksheet}'",
                    "confidenceScore": 95,
                    "documentSource": "manual-fix"
                })
            else:
                results.append({
                    "extractedValue": None,
                    "validationStatus": "invalid",
                    "aiReasoning": f"Column '{col_name}' not found in any worksheet",
                    "confidenceScore": 0,
                    "documentSource": "manual-fix"
                })
        
        return results
        
    except Exception as e:
        return [{
            "extractedValue": f"Error: {str(e)}",
            "validationStatus": "invalid",
            "aiReasoning": f"Function execution failed: {str(e)}",
            "confidenceScore": 0,
            "documentSource": "manual-fix"
        }]`

      // Update the function in database
      const updatedFunction = await storage.updateExcelWizardryFunction(id, {
        functionCode: fixedFunctionCode,
        metadata: {
          outputFormat: "field_validations_array",
          parametersUsed: existingFunc.inputParameters?.map(p => p.name) || [],
          fixApplied: "Manual fix for pandas issue - replaced with proper Excel text parsing",
          fixDate: new Date().toISOString()
        },
        updatedAt: new Date()
      });
      
      console.log('✅ Manual pandas fix applied successfully');
      res.json({
        success: true,
        message: "Manual fix applied - replaced pandas usage with proper Excel text parsing",
        updatedFunction
      });
      
    } catch (error) {
      console.error("Error applying manual fix:", error);
      res.status(500).json({ message: "Failed to apply manual fix" });
    }
  });



  // Direct update Excel function code
  app.post("/api/excel-functions/:id/direct-update", async (req, res) => {
    try {
      const id = req.params.id;
      const { functionCode } = req.body;
      
      if (!functionCode) {
        return res.status(400).json({ message: "Function code is required" });
      }
      
      // Get the existing function
      const existingFunc = await storage.getExcelWizardryFunction(id);
      if (!existingFunc) {
        return res.status(404).json({ message: "Excel wizardry function not found" });
      }
      
      // Update just the function code
      const updatedFunction = await storage.updateExcelWizardryFunction(id, {
        functionCode,
        updatedAt: new Date()
      });
      
      console.log('✅ Function code updated directly');
      res.json({ success: true, functionCode: updatedFunction?.functionCode });
    } catch (error) {
      console.error("Error updating function code directly:", error);
      res.status(500).json({ message: "Failed to update function code" });
    }
  });

  // Debug Excel wizardry function
  app.post("/api/excel-functions/debug", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { functionId, inputs, testResults, debugInstructions } = req.body;

      if (!functionId || !debugInstructions) {
        return res.status(400).json({ message: "Function ID and debug instructions are required" });
      }

      console.log("🔧 Debugging tool:", functionId);
      console.log("🐛 Debug instructions:", debugInstructions);

      // Get the function
      const func = await storage.getExcelWizardryFunction(functionId);
      if (!func) {
        return res.status(404).json({ message: "Function not found" });
      }

      // Import and use the Gemini AI function for debugging
      const { debugTool } = await import("./gemini");
      
      const debugResponse = await debugTool(
        func.name,
        func.description || '',
        func.inputParameters || [],
        inputs || {},
        testResults || [],
        debugInstructions,
        func.toolType,
        func.functionCode,
        func.metadata || {}
      );

      console.log("🎯 Debug response:", debugResponse);
      return res.json({ success: true, debugResponse });

    } catch (error) {
      console.error("Debug execution error:", error);
      res.status(500).json({ message: "Failed to debug function" });
    }
  });

  // Apply debug fixes to Excel wizardry function
  app.post("/api/excel-functions/apply-debug-fixes", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { functionId, debugRecommendations, inputs, testResults } = req.body;

      if (!functionId || !debugRecommendations) {
        return res.status(400).json({ message: "Function ID and debug recommendations are required" });
      }

      console.log("🔧 Applying debug fixes to tool:", functionId);

      // Get the function
      const func = await storage.getExcelWizardryFunction(functionId);
      if (!func) {
        return res.status(404).json({ message: "Function not found" });
      }

      // Import and use the Gemini AI function for generating improved code based on debug recommendations
      const { generateFunctionCodeFromDebug } = await import("./gemini");
      
      const { functionCode, metadata } = await generateFunctionCodeFromDebug(
        func.name,
        func.description || '',
        func.inputParameters || [],
        inputs || {},
        testResults || [],
        debugRecommendations,
        func.toolType,
        func.functionCode
      );
      
      // Update the function with the improved code
      const updatedFunction = await storage.updateExcelWizardryFunction(functionId, {
        functionCode,
        metadata,
        updatedAt: new Date()
      });
      
      console.log("✅ Debug fixes applied successfully");
      return res.json({ success: true, updatedFunction });
      
    } catch (error) {
      console.error("Apply debug fixes error:", error);
      res.status(500).json({ message: "Failed to apply debug fixes" });
    }
  });



  // TEST ENDPOINT WITH BROWSER CONSOLE LOGGING - Works for both CODE and AI_ONLY tools
  app.post("/api/excel-functions/test", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { functionId, inputs } = req.body;

      // Helper function to log both server and browser console
      const logToBrowser = async (message, level = 'log') => {
        console.log(message);
        try {
          // Forward to browser console via the dev console endpoint
          await fetch('http://localhost:5000/api/dev/console', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              level,
              message: message,
              timestamp: new Date().toISOString()
            })
          });
        } catch (error) {
          // Ignore fetch errors to avoid breaking the test
        }
      };

      // Get the function to determine if it's AI or CODE
      const func = await storage.getExcelWizardryFunction(functionId);
      if (!func) {
        return res.status(404).json({ message: "Function not found" });
      }

      await logToBrowser(`\n🚀 ========== ${func.toolType} TOOL TEST STARTED ==========`);
      await logToBrowser('🎯 ========== TEST INPUT PARAMETERS ==========');
      await logToBrowser(`Tool: ${func.name} (${func.toolType})`);
      await logToBrowser(`Inputs: ${JSON.stringify(inputs, null, 2)}`);

      // Use unified tool engine for testing
      await logToBrowser(`🔧 Processing with unified tool engine...`);
      
      let testResults;
      try {
        const { toolEngine } = await import("./toolEngine");
        
        const tool = {
          id: func.id,
          name: func.name,
          description: func.description,
          toolType: func.toolType,
          inputParameters: func.inputParameters || [],
          functionCode: func.functionCode,
          aiPrompt: func.aiPrompt || func.description,
          outputType: func.outputType,
          llmModel: func.llmModel,
          metadata: func.metadata || {}
        };
        
        testResults = await toolEngine.testTool(tool, inputs);
        await logToBrowser('✅ Tool execution completed');
        
      } catch (error) {
        await logToBrowser(`❌ Tool execution failed: ${error.message}`);
        testResults = [{
          extractedValue: null,
          validationStatus: "invalid",
          aiReasoning: `Tool execution failed: ${error.message}`,
          confidenceScore: 0,
          documentSource: "ENGINE_ERROR"
        }];
      }

      await logToBrowser('🎯 ========== TEST RESULTS ==========');
      await logToBrowser(`Results: ${JSON.stringify(testResults, null, 2)}`);
      
      res.json({ 
        success: true, 
        results: testResults,
        toolType: func.toolType 
      });
    } catch (error) {
      console.error("Test execution error:", error);
      res.status(500).json({ message: "Failed to execute test" });
    }
  });

  // Object Storage Routes
  app.post("/api/objects/upload", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Sample Document Processing Route - uses the same extraction process as session documents
  // Test document upload endpoint for Flow page
  app.post("/api/projects/:projectId/test-documents", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const { fileName, fileURL } = req.body;

      if (!fileURL) {
        return res.status(400).json({ message: "File URL is required for document processing" });
      }

      console.log('📥 Processing test document for project:', projectId);
      console.log('📄 File name:', fileName);
      console.log('🔗 File URL:', fileURL);
      
      // Extract the relative path from the object storage URL
      const urlParts = new URL(fileURL);
      const pathParts = urlParts.pathname.split('/');
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join('/');
      
      console.log('📁 Bucket:', bucketName, 'Object:', objectName);
      
      // Use ObjectStorageService with the Google Cloud Storage client directly
      const { objectStorageClient } = await import("./objectStorage");
      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      
      // Stream the file content to a buffer
      const chunks: Buffer[] = [];
      const stream = objectFile.createReadStream();
      
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      const fileBuffer = Buffer.concat(chunks);
      const [metadata] = await objectFile.getMetadata();
      const mimeType = metadata.contentType || 'application/octet-stream';
      const base64Content = fileBuffer.toString('base64');
      const dataURL = `data:${mimeType};base64,${base64Content}`;

      // Use the SAME document extraction process as session documents
      const extractionData = {
        step: "extract_text_only",
        documents: [{
          file_name: fileName || 'test-document',
          file_content: dataURL,
          mime_type: mimeType
        }]
      };

      const { spawn } = await import('child_process');
      const python = spawn('python3', ['document_extractor.py']);
      
      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();

      let stdoutData = '';
      let stderrData = '';

      python.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      await new Promise((resolve) => {
        python.on('close', async (code) => {
          console.log(`Python process exited with code ${code}`);
          if (stderrData) {
            console.log('Python stderr:', stderrData);
          }
          
          if (code === 0 && stdoutData) {
            try {
              const extractedData = JSON.parse(stdoutData);
              console.log('📊 Extraction results:', JSON.stringify(extractedData).substring(0, 500));
              
              // Get the extracted content from the document_extractor.py response
              let extractedContent = '';
              if (extractedData.success && extractedData.extracted_texts && extractedData.extracted_texts.length > 0) {
                // The content is in extracted_texts[0].text_content
                extractedContent = extractedData.extracted_texts[0].text_content || '';
                console.log('📊 Extracted text result:', {
                  file_name: extractedData.extracted_texts[0].file_name,
                  file_size: extractedData.extracted_texts[0].file_size,
                  word_count: extractedData.extracted_texts[0].word_count,
                  extraction_method: extractedData.extracted_texts[0].extraction_method,
                  content_length: extractedContent.length
                });
              }
              
              console.log('📝 Extracted content length:', extractedContent.length);
              console.log('📝 Extracted content preview:', extractedContent.substring(0, 100));
              
              // Save to test_documents table
              const testDoc = await storage.createTestDocument({
                projectId,
                fileName: fileName || 'test-document',
                fileSize: fileBuffer.length,
                mimeType,
                filePath: fileURL,
                extractedContent: extractedContent
              });

              // Console log all saved data
              console.log('✅ TEST DOCUMENT SAVED TO DATABASE:');
              console.log('=====================================');
              console.log('📌 Document ID:', testDoc.id);
              console.log('📌 Project ID:', testDoc.projectId);
              console.log('📌 File Name:', testDoc.fileName);
              console.log('📌 File Size:', testDoc.fileSize, 'bytes');
              console.log('📌 MIME Type:', testDoc.mimeType);
              console.log('📌 File Path:', testDoc.filePath);
              console.log('📌 Created At:', testDoc.createdAt);
              console.log('📌 EXTRACTED CONTENT:');
              console.log('-------------------------------------');
              console.log(testDoc.extractedContent);
              console.log('=====================================');
              
              res.json({
                message: "Test document processed successfully",
                document: testDoc
              });
            } catch (parseError) {
              console.error('Failed to parse extraction result:', parseError);
              res.status(500).json({ 
                message: "Failed to parse extraction result",
                error: parseError.message 
              });
            }
          } else {
            res.status(500).json({ 
              message: "Document extraction failed",
              error: stderrData || "Unknown error"
            });
          }
          resolve(null);
        });
      });
    } catch (error) {
      console.error("Error processing test document:", error);
      res.status(500).json({ message: "Failed to process test document" });
    }
  });

  // Get test documents for a project
  app.get("/api/projects/:projectId/test-documents", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const documents = await storage.getTestDocuments(projectId);
      res.json(documents);
    } catch (error) {
      console.error("Error getting test documents:", error);
      res.status(500).json({ message: "Failed to get test documents" });
    }
  });

  // Delete a test document
  app.delete("/api/test-documents/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTestDocument(id);
      if (!deleted) {
        return res.status(404).json({ message: "Test document not found" });
      }
      res.json({ message: "Test document deleted successfully" });
    } catch (error) {
      console.error("Error deleting test document:", error);
      res.status(500).json({ message: "Failed to delete test document" });
    }
  });

  // Test workflow endpoint
  app.post("/api/projects/:projectId/test-workflow", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const { documentId, documentContent, valueConfig, previousResults } = req.body;
      
      console.log('🧪 Test Workflow Request:');
      console.log('  Project:', projectId);
      console.log('  Document:', documentId);
      console.log('  Document Content Length:', documentContent?.length || 0);
      console.log('  Value Config:', valueConfig);
      console.log('  Previous Results Available:', previousResults ? Object.keys(previousResults).length : 0);
      
      // If there's a toolId, we need to execute the tool/function
      if (valueConfig.toolId) {
        console.log('🔍 DEBUG: Getting tool with ID:', valueConfig.toolId);
        // Get the tool/function details
        const excelFunction = await storage.getExcelWizardryFunction(valueConfig.toolId);
        
        if (excelFunction) {
          console.log('  Tool Found:', excelFunction.name || excelFunction.functionName);
          console.log('  Tool Type:', excelFunction.toolType);
          console.log('  Tool Properties:', Object.keys(excelFunction));
          console.log('  Using workflow test document instead of tool sample document');
          
          // Prepare input values, replacing document parameters with test document content
          const preparedInputValues = { ...valueConfig.inputValues };
          
          // Check for @-references in input values and replace with previous results
          for (const [key, value] of Object.entries(preparedInputValues)) {
            if (typeof value === 'string' && value.startsWith('@')) {
              const referencePath = value.slice(1); // Remove @ prefix
              console.log(`  Found reference: ${value} -> Looking for ${referencePath} in previous results`);
              
              // Check if we have previous results for this reference
              if (previousResults && previousResults[referencePath]) {
                const previousData = previousResults[referencePath];
                console.log(`  ✅ Replacing ${key} with results from ${referencePath} (${previousData.length} items)`);
                
                // Log more details about what we're passing
                if (Array.isArray(previousData)) {
                  console.log(`    📊 Array contains ${previousData.length} items`);
                  if (previousData.length > 0) {
                    console.log(`    First item: ${JSON.stringify(previousData[0]).slice(0, 100)}...`);
                    if (previousData.length > 1) {
                      console.log(`    Last item: ${JSON.stringify(previousData[previousData.length - 1]).slice(0, 100)}...`);
                    }
                    
                    // Check if these are result objects with extractedValue
                    const extractedValues = previousData
                      .filter(item => item && typeof item === 'object' && 'extractedValue' in item)
                      .map(item => item.extractedValue);
                    
                    if (extractedValues.length > 0) {
                      console.log(`    📝 Extracted values count: ${extractedValues.length}`);
                      console.log(`    First 5 values: ${extractedValues.slice(0, 5).join(', ')}`);
                      if (extractedValues.length > 5) {
                        console.log(`    ... and ${extractedValues.length - 5} more values`);
                      }
                      // Replace with just the extracted values for data inputs
                      preparedInputValues[key] = extractedValues;
                    } else {
                      // Keep the full objects if no extractedValue
                      preparedInputValues[key] = previousData;
                    }
                  }
                } else {
                  // Not an array, just use the data as-is
                  preparedInputValues[key] = previousData;
                }
              } else {
                console.log(`  ⚠️ No previous results found for ${referencePath}`);
              }
            }
          }
          
          // Check if any parameters are document type and replace with test document content
          if (excelFunction.inputParameters) {
            for (const param of excelFunction.inputParameters) {
              if (param.type === 'document') {
                // Check if the current value is ["user_document"] or similar placeholder
                const currentValue = preparedInputValues[param.id];
                const shouldReplaceWithTestDoc = 
                  !currentValue || 
                  (Array.isArray(currentValue) && currentValue.length === 1 && currentValue[0] === 'user_document') ||
                  currentValue === 'user_document';
                
                if (shouldReplaceWithTestDoc) {
                  console.log(`  Replacing ${param.name} (${param.id}) with test document content (${documentContent?.length || 0} chars)`);
                  preparedInputValues[param.id] = documentContent || '';
                } else {
                  console.log(`  Keeping existing value for ${param.name}: ${JSON.stringify(currentValue).slice(0, 100)}...`);
                }
              }
            }
          }
          
          // Use the tool engine to execute the function
          try {
            const { toolEngine } = await import('./toolEngine');
            
            console.log('📝 Executing tool with prepared inputs');
            console.log('  Input values keys:', Object.keys(preparedInputValues));
            for (const [key, value] of Object.entries(preparedInputValues)) {
              if (Array.isArray(value)) {
                console.log(`  📊 Input "${key}" is array with ${value.length} items`);
                if (value.length > 0) {
                  console.log(`    Sample items:`, value.slice(0, 3));
                }
              } else if (typeof value === 'string') {
                console.log(`  📝 Input "${key}" is string (${value.length} chars)`);
              }
            }
            
            // Execute using toolEngine's testTool method
            const toolResults = await toolEngine.testTool(excelFunction, preparedInputValues);
            
            // Add step_id and value_id to each result
            const enhancedResults = toolResults?.map((item: any) => ({
              ...item,
              step_id: valueConfig.stepId,
              value_id: valueConfig.valueId
            })) || [];
            
            // Transform to expected format
            const result = {
              results: enhancedResults,
              success: true
            };
            
            console.log('✅ Test Execution Result:', JSON.stringify(result, null, 2).slice(0, 500) + '...');
            
            // Log to console for visibility
            console.log('');
            console.log('=== WORKFLOW TEST EXECUTION COMPLETE ===');
            console.log('Step:', valueConfig.stepName);
            console.log('Value:', valueConfig.valueName);
            console.log('Tool:', excelFunction.name || excelFunction.functionName);
            console.log('Test Document:', documentId);
            console.log('Results:', toolResults?.length || 0, 'items extracted');
            if (previousResults) {
              console.log('Used Previous Results:', Object.keys(previousResults).join(', '));
            }
            console.log('=========================================');
            console.log('');
            
            res.json({ 
              success: true, 
              result: result,
              valueName: valueConfig.valueName,
              stepName: valueConfig.stepName
            });
          } catch (error) {
            console.error('❌ Execution Error:', error);
            res.json({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Tool execution failed',
              valueName: valueConfig.valueName,
              stepName: valueConfig.stepName
            });
          }
        } else {
          res.json({ 
            success: false, 
            error: 'Tool not found',
            valueName: valueConfig.valueName,
            stepName: valueConfig.stepName
          });
        }
      } else {
        // No tool configured, just return empty result
        res.json({ 
          success: true, 
          result: null,
          message: 'No tool configured for this value',
          valueName: valueConfig.valueName,
          stepName: valueConfig.stepName
        });
      }
    } catch (error) {
      console.error("Error running test workflow:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to run test workflow" 
      });
    }
  });

  // Get sample documents for a function
  app.get("/api/sample-documents/function/:functionId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { functionId } = req.params;
      const sampleDocs = await storage.getSampleDocuments(functionId);
      res.json(sampleDocs);
    } catch (error) {
      console.error("Error fetching sample documents:", error);
      res.status(500).json({ message: "Failed to fetch sample documents" });
    }
  });

  app.post("/api/sample-documents/process", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('📄 Processing sample document with data:', JSON.stringify(req.body, null, 2));
      const { functionId, parameterName, fileName, fileURL, sampleText } = req.body;
      
      // For new tools, use a stable temporary ID that can be updated later
      const actualFunctionId = functionId.startsWith('temp-') ? `pending-${functionId}` : functionId;
      
      console.log('🔍 Processing document for function:', actualFunctionId);
      console.log('🔍 Parameter name:', parameterName);
      console.log('🔍 File name:', fileName);

      if (sampleText) {
        console.log('📝 Processing sample text for parameter:', parameterName);
        // For text parameters, just save the text directly
        const sampleDocument = await storage.createSampleDocument({
          functionId: actualFunctionId,
          parameterName,
          fileName: `${parameterName}_sample_text.txt`,
          sampleText,
          mimeType: "text/plain"
        });

        res.json({ 
          success: true, 
          sampleDocument: sampleDocument,
          message: "Sample text saved successfully" 
        });
        return;
      }

      if (!fileURL) {
        return res.status(400).json({ message: "File URL is required for document processing" });
      }

      console.log('📥 Downloading file from object storage:', fileURL);
      
      // Extract the relative path from the object storage URL
      const urlParts = new URL(fileURL);
      const pathParts = urlParts.pathname.split('/');
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join('/');
      
      console.log('📁 Bucket:', bucketName, 'Object:', objectName);
      
      // Use ObjectStorageService with the Google Cloud Storage client directly
      const { ObjectStorageService, objectStorageClient } = await import("./objectStorage");
      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      
      // Stream the file content to a buffer
      const chunks: Buffer[] = [];
      const stream = objectFile.createReadStream();
      
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      const fileBuffer = Buffer.concat(chunks);
      const [metadata] = await objectFile.getMetadata();
      const mimeType = metadata.contentType || 'application/octet-stream';
      const base64Content = fileBuffer.toString('base64');
      const dataURL = `data:${mimeType};base64,${base64Content}`;

      // Use the SAME document extraction process as session documents
      const extractionData = {
        step: "extract_text_only",
        documents: [{
          file_name: fileName || 'sample-file',
          file_content: dataURL,
          mime_type: mimeType
        }]
      };

      const { spawn } = await import('child_process');
      const python = spawn('python3', ['document_extractor.py']);
      
      python.stdin.write(JSON.stringify(extractionData));
      python.stdin.end();

      let stdoutData = '';
      let stderrData = '';

      python.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      await new Promise((resolve) => {
        python.on('close', async (code) => {
          console.log(`Python process exited with code ${code}`);
          if (stderrData) {
            console.log('Python stderr:', stderrData);
          }
          
          if (code === 0 && stdoutData) {
            try {
              const result = JSON.parse(stdoutData.trim());
              console.log('Document extraction result:', result);
              
              if (result.success && result.extracted_texts && result.extracted_texts[0]) {
                const extractedContent = result.extracted_texts[0].text_content;
                
                if (extractedContent) {
                  // Create a sample document record using the same pattern as the existing endpoint
                  const sampleDocument = await storage.createSampleDocument({
                    functionId: actualFunctionId,
                    parameterName,
                    fileName: fileName || 'sample-file',
                    filePath: fileURL,
                    extractedContent,
                    mimeType
                  });
                  
                  res.json({ 
                    success: true, 
                    sampleDocument: sampleDocument,
                    message: `Successfully processed ${fileName || 'sample file'} and extracted ${extractedContent.length} characters` 
                  });
                } else {
                  res.json({ success: false, message: "No content extracted from document" });
                }
              } else {
                res.json({ success: false, message: result.error || 'Document extraction failed' });
              }
            } catch (parseError) {
              console.error('Failed to parse extraction result:', parseError);
              res.json({ success: false, message: "Failed to parse extraction result" });
            }
          } else {
            res.json({ success: false, message: "Document processing failed" });
          }
          resolve(undefined);
        });
      });
      
    } catch (error) {
      console.error("Error processing sample document:", error);
      res.status(500).json({ message: "Failed to process sample document" });
    }
  });

  // Populate missing collection IDs endpoint
  app.post("/api/db/populate-collection-ids", authenticateToken, async (req: AuthRequest, res) => {
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

          // Execute the function using the extraction wizardry system
          const { spawn } = await import('child_process');
