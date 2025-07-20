import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { storage } from "./storage";
import crypto from "crypto";
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
      
      // Extract text content from PDFs and store as readable text
      if (result.data.fileType === 'pdf' && result.data.content) {
        try {
          console.log('DEBUG: Processing knowledge document PDF content extraction');
          
          // Use Python to extract text from PDF data URL
          const { spawn } = await import('child_process');
          const python = spawn('python3', ['-c', `
import sys
import base64
import json
import io

try:
    # Read the data URL from stdin
    data_url = sys.stdin.read().strip()
    
    # Extract base64 content from data URL
    if data_url.startswith('data:'):
        base64_content = data_url.split(',', 1)[1]
        pdf_bytes = base64.b64decode(base64_content)
        
        # Try PyPDF2 for text extraction
        try:
            import PyPDF2
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            text_content = ""
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\\n"
            
            if text_content.strip():
                print(text_content.strip())
            else:
                print("PDF_EXTRACTION_FAILED")
        except Exception as pypdf_error:
            print("PDF_EXTRACTION_FAILED")
    else:
        print("INVALID_DATA_URL")
        
except Exception as e:
    print("PDF_EXTRACTION_FAILED")
`], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          python.stdin.write(result.data.content);
          python.stdin.end();
          
          let extractedText = '';
          python.stdout.on('data', (data) => {
            extractedText += data.toString();
          });
          
          await new Promise((resolve, reject) => {
            python.on('close', (code) => {
              console.log(`DEBUG: Python extraction process completed with code: ${code}`);
              console.log(`DEBUG: Extracted text length: ${extractedText.length}`);
              console.log(`DEBUG: Extracted text preview: ${extractedText.substring(0, 500)}`);
              
              if (code === 0 && extractedText.trim() && !extractedText.includes('PDF_EXTRACTION_FAILED')) {
                processedData.content = extractedText.trim();
                console.log('DEBUG: Knowledge document PDF processing successful, extracted', extractedText.length, 'characters of text');
                resolve(extractedText);
              } else {
                console.log('DEBUG: PDF text extraction failed or returned no content, code:', code);
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
        } catch (pdfError) {
          console.error('PDF processing error:', pdfError);
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
      console.log(`Dashboard statistics: ${activeProjects.length} active projects out of ${projects.length} total`);
      
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
      
      console.log(`Dashboard statistics: Total ${totalSessions} sessions (${verifiedSessions} verified, ${unverifiedSessions} unverified)`);
      
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
      
      // Debug project_data structure
      console.log('DEBUG: Full project_data structure:', JSON.stringify(project_data, null, 2));
      console.log('DEBUG: project_data keys:', Object.keys(project_data || {}));
      console.log('DEBUG: schemaFields type:', typeof project_data?.schemaFields, 'length:', project_data?.schemaFields?.length);
      console.log('DEBUG: collections type:', typeof project_data?.collections, 'length:', project_data?.collections?.length);
      
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
      const python = spawn('python3', ['extraction_runner.py']);
      
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
          
          // DEBUG: Check if aggregated_extraction has field_validations
          if (result.aggregated_extraction) {
            console.log('DEBUG: aggregated_extraction exists');
            console.log('DEBUG: aggregated_extraction keys:', Object.keys(result.aggregated_extraction));
            if (result.aggregated_extraction.field_validations) {
              console.log('DEBUG: field_validations count in aggregated_extraction:', result.aggregated_extraction.field_validations.length);
            } else {
              console.log('DEBUG: NO field_validations in aggregated_extraction');
            }
          } else {
            console.log('DEBUG: NO aggregated_extraction found');
          }
          
          // Update session status
          await storage.updateExtractionSession(sessionId, {
            status: "completed",
            extractedData: JSON.stringify(result)
          });
          
          // Get existing field validations for this session
          const existingValidations = await storage.getFieldValidations(sessionId);
          
          // Update field validations from the extraction results
          let validationsToProcess = [];
          
          // Process aggregated validations if available (multi-document sessions)
          if (result.aggregated_extraction && result.aggregated_extraction.field_validations) {
            validationsToProcess = result.aggregated_extraction.field_validations;
            console.log(`Processing ${validationsToProcess.length} aggregated field validations`);
            console.log(`DEBUG: First 5 validation field names:`, validationsToProcess.slice(0, 5).map(v => v.field_name));
            console.log(`DEBUG: Last 5 validation field names:`, validationsToProcess.slice(-5).map(v => v.field_name));
          }
          // Fall back to individual document validations for single-document sessions
          else if (result.processed_documents && result.processed_documents.length > 0) {
            for (const doc of result.processed_documents) {
              const fieldValidations = doc.extraction_result?.field_validations || [];
              console.log(`Processing ${fieldValidations.length} field validations for document: ${doc.file_name}`);
              validationsToProcess.push(...fieldValidations);
            }
          }
          
          // Process explicit validations first
          console.log(`DEBUG: About to process ${validationsToProcess.length} validations for session ${sessionId}`);
          console.log(`DEBUG: Existing validations count: ${existingValidations.length}`);
          
          for (const validation of validationsToProcess) {
                // Extract record index from field name if present
                const fieldName = validation.field_name;
                console.log(`DEBUG: Processing validation for field: ${fieldName}`);
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
                  // Update existing validation - preserve original values if they don't exist yet
                  const updateData: any = {
                    extractedValue: normalizedValue,
                    validationStatus: validation.validation_status,
                    aiReasoning: validation.ai_reasoning,
                    confidenceScore: validation.confidence_score
                  };
                  
                  // If original values don't exist yet, store them (this handles retroactive population)
                  if (!existingValidation.originalExtractedValue) {
                    updateData.originalExtractedValue = validation.original_extracted_value || normalizedValue;
                    updateData.originalConfidenceScore = validation.original_confidence_score || validation.confidence_score;
                    updateData.originalAiReasoning = validation.original_ai_reasoning || validation.ai_reasoning;
                  }
                  
                  console.log(`DEBUG: Updating existing validation ${existingValidation.id} for field ${fieldName}`);
                  await storage.updateFieldValidation(existingValidation.id, updateData);
                } else {
                  // Create new validation if it doesn't exist
                  console.log(`DEBUG: Creating NEW validation for field ${fieldName} with value: ${normalizedValue}`);
                  const newValidation = await storage.createFieldValidation({
                    sessionId,
                    fieldType: isCollectionProperty ? 'collection_property' : 'schema_field',
                    fieldId: validation.field_id,
                    fieldName: fieldName,
                    collectionName,
                    recordIndex,
                    extractedValue: normalizedValue,
                    originalExtractedValue: validation.original_extracted_value || normalizedValue,
                    originalConfidenceScore: validation.original_confidence_score || validation.confidence_score,
                    originalAiReasoning: validation.original_ai_reasoning || validation.ai_reasoning,
                    validationStatus: validation.validation_status,
                    aiReasoning: validation.ai_reasoning,
                    manuallyVerified: false,
                    confidenceScore: validation.confidence_score
                  });
                  console.log(`DEBUG: Created validation with ID: ${newValidation?.id} for field ${fieldName}`);
                }
            }
          
          console.log(`Processing complete with ${validationsToProcess.length} total validations`);
          console.log(`Aggregated extraction contains ${result.aggregated_extraction ? Object.keys(result.aggregated_extraction.extracted_data || {}).length : 0} fields`);
          console.log(`Result status: ${result.status}, has aggregated data: ${!!result.aggregated_extraction}`);
          
          // Debug: Check final validation count after processing
          const finalValidations = await storage.getFieldValidations(sessionId);
          console.log(`DEBUG: Final validation count in database: ${finalValidations.length}`);
          
          // COMPREHENSIVE VALIDATION CREATION: For pure extraction, create validation records for ALL extracted fields
          // This ensures batch validation has records to process even when Python returns empty field_validations
          if (result.aggregated_extraction && result.aggregated_extraction.extracted_data) {
            try {
              const extractedData = result.aggregated_extraction.extracted_data;
              console.log('Creating comprehensive validation records for all extracted fields...');
              console.log(`DEBUG AGGREGATED DATA:`, JSON.stringify(extractedData, null, 2));
              
              // Create validation records for schema fields
              if (project_data?.schemaFields) {
              for (const field of project_data.schemaFields) {
                const fieldName = field.fieldName;
                const extractedValue = extractedData[fieldName];
                
                // Check if validation already exists
                const existingValidation = existingValidations.find(v => v.fieldName === fieldName);
                if (!existingValidation) {
                  console.log(`Creating validation record for schema field: ${fieldName} = ${extractedValue}`);
                  await storage.createFieldValidation({
                    sessionId,
                    fieldType: 'schema_field',
                    fieldId: field.id,
                    fieldName: fieldName,
                    collectionName: null,
                    recordIndex: 0,
                    extractedValue: extractedValue,
                    originalExtractedValue: extractedValue,
                    originalConfidenceScore: 95, // Default confidence for extracted data
                    originalAiReasoning: 'Extracted during AI processing',
                    validationStatus: 'unverified',
                    aiReasoning: 'Extracted during AI processing',
                    manuallyVerified: false,
                    confidenceScore: 95 // Set proper confidence score so it doesn't show as "Not Extracted"
                  });
                }
              }
              }
              
              // Create validation records for collection properties
              if (project_data?.collections) {
                for (const collection of project_data.collections) {
                  const collectionName = collection.collectionName;
                  const collectionData = extractedData[collectionName];
                  
                  if (Array.isArray(collectionData) && collection.properties) {
                    for (let recordIndex = 0; recordIndex < collectionData.length; recordIndex++) {
                      const record = collectionData[recordIndex];
                      
                      for (const property of collection.properties) {
                        const fieldName = `${collectionName}.${property.propertyName}[${recordIndex}]`;
                        const extractedValue = record[property.propertyName];
                        
                        console.log(`DEBUG EXTRACTION: For ${fieldName}`);
                        console.log(`  - Record:`, record);
                        console.log(`  - Property name: ${property.propertyName}`);
                        console.log(`  - Extracted value: ${extractedValue}`);
                        console.log(`  - Value type: ${typeof extractedValue}`);
                        
                        // Check if validation already exists
                        const existingValidation = existingValidations.find(v => v.fieldName === fieldName);
                        if (!existingValidation) {
                          console.log(`Creating validation record for collection property: ${fieldName} = ${extractedValue}`);
                          
                          const validationData = {
                            sessionId,
                            fieldType: 'collection_property',
                            fieldId: property.id,
                            fieldName: fieldName,
                            collectionName: collectionName,
                            recordIndex: recordIndex,
                            extractedValue: extractedValue,
                            originalExtractedValue: extractedValue,
                            originalConfidenceScore: 95,
                            originalAiReasoning: 'Extracted during AI processing',
                            validationStatus: 'unverified',
                            aiReasoning: 'Extracted during AI processing',
                            manuallyVerified: false,
                            confidenceScore: extractedValue !== null && extractedValue !== undefined ? 95 : 20
                          };
                          
                          console.log(`DEBUG VALIDATION DATA BEFORE INSERT:`, JSON.stringify(validationData, null, 2));
                          
                          await storage.createFieldValidation({
                            sessionId,
                            fieldType: 'collection_property',
                            fieldId: property.id,
                            fieldName: fieldName,
                            collectionName: collectionName,
                            recordIndex: recordIndex,
                            extractedValue: extractedValue,
                            originalExtractedValue: extractedValue,
                            originalConfidenceScore: 95, // Default confidence for extracted data
                            originalAiReasoning: 'Extracted during AI processing',
                            validationStatus: 'unverified',
                            aiReasoning: 'Extracted during AI processing',
                            manuallyVerified: false,
                            confidenceScore: extractedValue !== null && extractedValue !== undefined ? 95 : 20 // Higher confidence for actual values, lower for null
                          });
                        }
                      }
                    }
                  }
                }
              }
            
              console.log('Comprehensive validation record creation complete');
            } catch (validationError: any) {
              console.error('Error during comprehensive validation creation:', validationError);
              console.error('Validation error stack:', validationError.stack);
              // Don't fail the entire request, just log the error
            }
          }
          
          // CRITICAL: Wait for all validation operations to complete before sending response
          console.log('Waiting for all database operations to complete...');
          
          // Robust validation check - wait until all expected validations are confirmed in database
          let attempts = 0;
          let validationCount = 0;
          const maxAttempts = 10;
          const expectedValidations = (project_data?.schemaFields?.length || 0) + 
            (project_data?.collections?.reduce((total, col) => {
              const collectionData = result.aggregated_extraction?.extracted_data?.[col.collectionName];
              const itemCount = Array.isArray(collectionData) ? collectionData.length : 0;
              return total + (itemCount * (col.properties?.length || 0));
            }, 0) || 0);
          
          console.log(`Expected validation count: ${expectedValidations}`);
          
          while (attempts < maxAttempts && validationCount < expectedValidations) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const currentValidations = await storage.getFieldValidations(sessionId);
            validationCount = currentValidations.length;
            attempts++;
            console.log(`Attempt ${attempts}: Found ${validationCount}/${expectedValidations} validations in database`);
          }
          
          console.log(`FINAL CHECK: Database contains ${validationCount} validation records for session ${sessionId}`);
          
          // Additional safety delay to ensure all database transactions are committed
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('Database synchronization complete - sending response to frontend');
          
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
      console.log(`GET /api/sessions/${sessionId}/validations - Fetching validations for session`);
      const validations = await storage.getFieldValidations(sessionId);
      console.log(`GET /api/sessions/${sessionId}/validations - Found ${validations.length} validations`);
      if (validations.length > 0) {
        console.log(`First validation: ${validations[0].fieldName} = ${validations[0].extractedValue}`);
        console.log(`Collection validations: ${validations.filter(v => v.fieldName.includes('[')).length}`);
        console.log(`Sample validation data:`, JSON.stringify(validations[0], null, 2));
        console.log(`All field names:`, validations.map(v => v.fieldName).slice(0, 10));
      }
      console.log(`SENDING TO FRONTEND: ${validations.length} validations`);
      res.json(validations);
    } catch (error) {
      console.error(`GET /api/sessions/${sessionId}/validations - Error:`, error);
      res.status(500).json({ message: "Failed to fetch field validations" });
    }
  });

  // CONSOLIDATED Field Validations - fetches from field records directly
  app.get("/api/sessions/:sessionId/validations-consolidated", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log(`🚀 CONSOLIDATED_VALIDATIONS: Fetching consolidated validations for session ${sessionId}`);
      
      // Get session to find project
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const projectId = session.projectId;
      
      // Get schema fields and collections with validation data for this session
      const [schemaFields, collections] = await Promise.all([
        storage.getProjectSchemaFields(projectId),
        storage.getObjectCollections(projectId)
      ]);
      
      const consolidatedValidations = [];
      
      // Add schema field validations
      for (const field of schemaFields) {
        if (field.sessionId === sessionId && field.extractedValue !== undefined) {
          consolidatedValidations.push({
            id: field.id,
            sessionId: sessionId,
            fieldType: 'schema_field',
            fieldId: field.id,
            fieldName: field.fieldName,
            extractedValue: field.extractedValue,
            originalExtractedValue: field.originalExtractedValue,
            confidenceScore: field.confidenceScore,
            originalConfidenceScore: field.originalConfidenceScore,
            validationStatus: field.validationStatus,
            aiReasoning: field.aiReasoning,
            originalAiReasoning: field.originalAiReasoning,
            manuallyVerified: field.manuallyVerified,
            createdAt: field.createdAt,
            updatedAt: field.createdAt
          });
        }
      }
      
      // Add collection property validations
      for (const collection of collections) {
        const collectionProperties = await storage.getCollectionProperties(collection.id);
        for (const property of collectionProperties) {
          if (property.sessionId === sessionId && property.extractedValue !== undefined) {
            consolidatedValidations.push({
              id: property.id,
              sessionId: sessionId,
              fieldType: 'collection_property',
              fieldId: property.id,
              fieldName: `${property.collectionName}.${property.propertyName}[${property.recordIndex}]`,
              collectionName: property.collectionName,
              recordIndex: property.recordIndex,
              extractedValue: property.extractedValue,
              originalExtractedValue: property.originalExtractedValue,
              confidenceScore: property.confidenceScore,
              originalConfidenceScore: property.originalConfidenceScore,
              validationStatus: property.validationStatus,
              aiReasoning: property.aiReasoning,
              originalAiReasoning: property.originalAiReasoning,
              manuallyVerified: property.manuallyVerified,
              createdAt: property.createdAt,
              updatedAt: property.createdAt
            });
          }
        }
      }
      
      console.log(`🚀 CONSOLIDATED_VALIDATIONS: Found ${consolidatedValidations.length} validations (${consolidatedValidations.filter(v => v.fieldType === 'schema_field').length} schema fields, ${consolidatedValidations.filter(v => v.fieldType === 'collection_property').length} collection properties)`);
      
      res.json(consolidatedValidations);
    } catch (error) {
      console.error("🚀 CONSOLIDATED_VALIDATIONS: Error fetching consolidated validations:", error);
      res.status(500).json({ message: "Internal server error" });
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
            
            for (const validation of updatedValidations) {
              // WORKAROUND: For schema fields, the validation record is stored with [1] suffix
              // Try both original field name and shifted field name for schema fields
              let existingValidation = existingValidations.find(v => v.fieldName === validation.field_name);
              
              // If not found and it's a schema field (no dots or brackets), try the shifted version
              if (!existingValidation && !validation.field_name.includes('.') && !validation.field_name.includes('[')) {
                const shiftedFieldName = `${validation.field_name}[1]`;
                existingValidation = existingValidations.find(v => v.fieldName === shiftedFieldName);
                console.log(`BATCH_VALIDATION_DEBUG - Schema field lookup: "${validation.field_name}" not found, trying shifted "${shiftedFieldName}" - ${existingValidation ? 'FOUND' : 'NOT FOUND'}`);
              }
              
              if (existingValidation) {
                // DEBUG: Log what batch validation is trying to update for first items
                if (existingValidation.fieldName.includes('[0]') || existingValidation.fieldType === 'schema_field') {
                  console.log(`BATCH_VALIDATION_DEBUG - Updating FIRST item: ${existingValidation.fieldName}`);
                  console.log(`  - Existing extracted value: ${existingValidation.extractedValue}`);
                  console.log(`  - Batch validation extracted_value: ${validation.extracted_value}`);
                  console.log(`  - Will preserve: ${validation.extracted_value !== undefined ? validation.extracted_value : existingValidation.extractedValue}`);
                }
                
                // Update existing validation record - PRESERVE extracted values!
                await storage.updateFieldValidation(existingValidation.id, {
                  confidenceScore: validation.confidence_score,
                  validationStatus: validation.validation_status,
                  aiReasoning: validation.ai_reasoning,
                  originalConfidenceScore: validation.original_confidence_score,
                  originalAiReasoning: validation.original_ai_reasoning,
                  // CRITICAL: Preserve the extracted values from batch validation
                  extractedValue: validation.extracted_value !== undefined ? validation.extracted_value : existingValidation.extractedValue,
                  originalExtractedValue: validation.original_extracted_value !== undefined ? validation.original_extracted_value : existingValidation.originalExtractedValue
                });
              }
            }
            
            console.log(`BATCH_VALIDATION: Successfully updated ${validationResults.fields_processed} field validations`);
            
            res.json({
              success: true,
              session_id: sessionId,
              fields_processed: validationResults.fields_processed,
              total_validations: validationResults.total_validations,
              message: `Batch validation complete. Updated ${validationResults.fields_processed} fields.`
            });
          } else {
            console.error(`BATCH_VALIDATION: Validation failed: ${validationResults.error}`);
            res.status(500).json({
              message: "Batch validation failed",
              error: validationResults.error
            });
          }
        } catch (parseError: any) {
          console.error(`BATCH_VALIDATION: Failed to parse Python output: ${parseError}`);
          console.error(`BATCH_VALIDATION: Raw output: ${pythonOutput}`);
          res.status(500).json({
            message: "Failed to parse batch validation results",
            error: parseError.message,
            output: pythonOutput
          });
        }
      });

      // Send session data to Python process
      python.stdin.write(JSON.stringify(sessionData));
      python.stdin.end();

    } catch (error: any) {
      console.error("BATCH_VALIDATION: API error:", error);
      res.status(500).json({ 
        message: "Failed to run batch validation", 
        error: error.message 
      });
    }
  });

  // TEST: Consolidated extraction approach
  app.post("/api/sessions/:sessionId/test-consolidated", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log(`🧪 TEST_CONSOLIDATED: Starting test for session ${sessionId}`);
      
      // Get session and project data
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const projectId = session.projectId;
      const [projectSchema, collections] = await Promise.all([
        storage.getProjectSchemaFields(projectId),
        storage.getObjectCollections(projectId)
      ]);
      
      // Build project schema structure for Python
      const collectionsWithProperties = await Promise.all(
        collections.map(async (collection) => {
          const properties = await storage.getCollectionProperties(collection.id);
          return { ...collection, properties };
        })
      );
      
      const sessionData = {
        session_id: sessionId,
        project_schema: {
          fields: projectSchema,
          collections: collectionsWithProperties
        }
      };
      
      // Call consolidated Python extraction
      const { spawn } = require('child_process');
      const python = spawn('python3', ['ai_extraction_consolidated.py']);
      
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
          console.error(`TEST_CONSOLIDATED: Python process failed with code ${code}`);
          console.error(`TEST_CONSOLIDATED: Error output: ${pythonError}`);
          return res.status(500).json({ 
            message: "Consolidated extraction test failed", 
            error: pythonError,
            code: code
          });
        }

        try {
          const results = JSON.parse(pythonOutput);
          console.log(`🧪 TEST_CONSOLIDATED: Created ${results.total_records} validation records`);
          
          res.json({
            success: true,
            session_id: sessionId,
            total_records: results.total_records,
            validation_records: results.validation_records,
            message: "✅ CONSOLIDATED APPROACH WORKING - Ready to implement real extraction flow"
          });
        } catch (parseError: any) {
          console.error(`TEST_CONSOLIDATED: Failed to parse Python output: ${parseError}`);
          console.error(`TEST_CONSOLIDATED: Raw output: ${pythonOutput}`);
          res.status(500).json({
            message: "Failed to parse consolidated extraction results",
            error: parseError.message,
            output: pythonOutput
          });
        }
      });

      // Send session data to Python process
      python.stdin.write(JSON.stringify(sessionData));
      python.stdin.end();

    } catch (error: any) {
      console.error("TEST_CONSOLIDATED: API error:", error);
      res.status(500).json({ 
        message: "Failed to run consolidated extraction test", 
        error: error.message 
      });
    }
  });

  // Consolidated AI Extraction endpoint - NEW ARCHITECTURE
  app.post("/api/sessions/:sessionId/extract-consolidated", authenticateToken, async (req: AuthRequest, res) => {
    const sessionId = req.params.sessionId;
    console.log(`🚀 CONSOLIDATED_EXTRACTION: Starting extraction for session ${sessionId}`);

    try {
      // Get session and project data
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const projectId = session.projectId;
      const [project, schemaFields, collections, extractionRules, knowledgeDocuments] = await Promise.all([
        storage.getProject(projectId),
        storage.getProjectSchemaFields(projectId),
        storage.getObjectCollections(projectId),
        storage.getExtractionRules(projectId),
        storage.getKnowledgeDocuments(projectId)
      ]);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get request body with files data from frontend
      const requestBody = req.body;
      console.log(`🚀 CONSOLIDATED_EXTRACTION: Request body keys:`, Object.keys(requestBody || {}));
      
      // Extract files data from request
      const filesData = requestBody?.files || [];
      console.log(`🚀 CONSOLIDATED_EXTRACTION: Processing ${filesData.length} files`);

      // Build session data for Python extraction
      const sessionData = {
        session_id: sessionId,
        files: filesData.map((file: any) => ({
          name: file.name,
          content: file.content,
          type: file.type,
          size: file.size
        })),
        project_schema: {
          schema_fields: schemaFields.map(field => ({
            id: field.id,
            fieldName: field.fieldName,
            fieldType: field.fieldType,
            projectId: field.projectId,
            description: field.description,
            autoVerificationConfidence: field.autoVerificationConfidence,
            orderIndex: field.orderIndex
          })),
          collections: collections.map(collection => ({
            id: collection.id,
            collectionName: collection.collectionName,
            properties: collection.properties.map(prop => ({
              id: prop.id,
              collectionId: collection.id,
              propertyName: prop.propertyName,
              propertyType: prop.propertyType,
              description: prop.description,
              autoVerificationConfidence: prop.autoVerificationConfidence,
              orderIndex: prop.orderIndex
            }))
          }))
        },
        extraction_rules: extractionRules,
        knowledge_documents: knowledgeDocuments
      };

      console.log(`🚀 WORKING_EXTRACTION: Processing ${schemaFields.length} schema fields and ${collections.length} collections`);
      console.log(`🚀 WORKING_EXTRACTION: Session data files: ${sessionData.files.length}`);
      console.log(`🚀 WORKING_EXTRACTION: Session data schema fields: ${JSON.stringify(sessionData.project_schema.schema_fields.map(f => f.fieldName))}`);
      console.log(`🚀 WORKING_EXTRACTION: Session data collections: ${JSON.stringify(sessionData.project_schema.collections.map(c => c.collectionName))}`);

      // Run working multimodal AI extraction
      const python = spawn('python3', ['ai_extraction_working.py'], {
        stdio: 'pipe'
      });

      let pythonOutput = '';
      let pythonError = '';
      
      // Send session data to Python script
      python.stdin.write(JSON.stringify(sessionData));
      python.stdin.end();

      python.stdout.on('data', (data: any) => {
        pythonOutput += data.toString();
      });

      python.stderr.on('data', (data: any) => {
        const errorData = data.toString();
        pythonError += errorData;
        console.log(`🚀 WORKING_EXTRACTION: Python stderr: ${errorData}`);
      });

      python.on('close', async (code) => {
        console.log(`🚀 WORKING_EXTRACTION: Python process completed with code ${code}`);
        console.log(`🚀 WORKING_EXTRACTION: Python stdout length: ${pythonOutput.length}`);
        console.log(`🚀 WORKING_EXTRACTION: Python stderr length: ${pythonError.length}`);
        
        if (code !== 0) {
          console.error(`🚀 WORKING_EXTRACTION: Python extraction failed with code ${code}`);
          console.error(`🚀 WORKING_EXTRACTION: Error: ${pythonError}`);
          return res.status(500).json({ 
            message: "Working AI extraction failed", 
            error: pythonError,
            code: code
          });
        }

        try {
          console.log(`🚀 WORKING_EXTRACTION: Raw Python output: ${pythonOutput.substring(0, 1000)}...`);
          const results = JSON.parse(pythonOutput);
          console.log(`🚀 WORKING_EXTRACTION: AI extracted ${results.total_records} validation records`);
          console.log(`🚀 WORKING_EXTRACTION: Schema fields: ${results.schema_fields_updated}, Collection properties: ${results.collection_properties_updated}`);
          
          // Store validation data directly in field/collection records - CONSOLIDATED APPROACH
          const validationRecords = results.validation_records;
          let schemaFieldsUpdated = 0;
          let collectionPropertiesUpdated = 0;
          
          // Update schema fields with validation data directly
          const schemaFieldRecords = validationRecords.filter((record: any) => record.record_type === 'schema_field');
          for (const field of schemaFieldRecords) {
            await storage.updateProjectSchemaField(field.id, {
              sessionId: sessionId,
              extractedValue: field.extractedValue,
              originalExtractedValue: field.originalExtractedValue,
              confidenceScore: field.confidenceScore,
              originalConfidenceScore: field.originalConfidenceScore,
              validationStatus: field.validationStatus,
              aiReasoning: field.aiReasoning,
              originalAiReasoning: field.originalAiReasoning,
              manuallyVerified: field.manuallyVerified
            });
            schemaFieldsUpdated++;
          }
          
          // Update collection properties with validation data directly
          const collectionPropertyRecords = validationRecords.filter((record: any) => record.record_type === 'collection_property');
          for (const property of collectionPropertyRecords) {
            await storage.updateCollectionProperty(property.id, {
              sessionId: sessionId,
              recordIndex: property.recordIndex,
              extractedValue: property.extractedValue,
              originalExtractedValue: property.originalExtractedValue,
              confidenceScore: property.confidenceScore,
              originalConfidenceScore: property.originalConfidenceScore,
              validationStatus: property.validationStatus,
              aiReasoning: property.aiReasoning,
              originalAiReasoning: property.originalAiReasoning,
              manuallyVerified: property.manuallyVerified
            });
            collectionPropertiesUpdated++;
          }
          
          // Update session status
          await storage.updateExtractionSession(sessionId, {
            status: 'completed'
          });
          
          console.log(`🚀 CONSOLIDATED_EXTRACTION: Updated ${schemaFieldsUpdated} schema fields and ${collectionPropertiesUpdated} collection properties`);
          
          res.json({
            success: true,
            session_id: sessionId,
            total_records: results.total_records,
            schema_fields_updated: schemaFieldsUpdated,
            collection_properties_updated: collectionPropertiesUpdated,
            message: "✅ CONSOLIDATED EXTRACTION COMPLETE - Validation data stored directly in field records"
          });
          
        } catch (parseError: any) {
          console.error(`🚀 CONSOLIDATED_EXTRACTION: Failed to parse results: ${parseError}`);
          console.error(`🚀 CONSOLIDATED_EXTRACTION: Raw output: ${pythonOutput}`);
          res.status(500).json({
            message: "Failed to parse consolidated extraction results",
            error: parseError.message,
            output: pythonOutput
          });
        }
      });

    } catch (error: any) {
      console.error("🚀 CONSOLIDATED_EXTRACTION: API error:", error);
      res.status(500).json({ 
        message: "Failed to run consolidated extraction", 
        error: error.message 
      });
    }
  });

  app.post("/api/sessions/:sessionId/recalculate-validations", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log(`DEBUG: Recalculating validations for session ${sessionId}`);
      
      // Get session project ID
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Get project schema, rules, and knowledge documents
      const projectId = session.projectId;
      const [extractionRules, knowledgeDocuments] = await Promise.all([
        storage.getExtractionRules(projectId),
        storage.getKnowledgeDocuments(projectId)
      ]);
      
      // Get all validations for this session
      const validations = await storage.getFieldValidations(sessionId);
      console.log(`DEBUG: Found ${validations.length} validations to recalculate`);
      
      // Import Python calculation function
      const { spawn } = require('child_process');
      const python = spawn('python3', ['-c', `
import sys
import json
sys.path.append('.')
from ai_extraction import calculate_knowledge_based_confidence

# Read input data
input_data = json.loads(sys.stdin.read())
validations = input_data['validations']
extraction_rules = input_data['extraction_rules']
knowledge_documents = input_data['knowledge_documents']

results = []
for validation in validations:
    field_name = validation['fieldName']
    extracted_value = validation['extractedValue']
    
    if extracted_value is not None and extracted_value != "":
        confidence, applied_rules = calculate_knowledge_based_confidence(
            field_name, extracted_value, 95, extraction_rules, knowledge_documents
        )
        
        # Only include if confidence changed
        if confidence != validation['confidenceScore']:
            results.append({
                'id': validation['id'],
                'fieldName': field_name,
                'extractedValue': extracted_value,
                'oldConfidence': validation['confidenceScore'],
                'newConfidence': confidence,
                'appliedRules': applied_rules
            })

print(json.dumps(results))
`], { stdio: ['pipe', 'pipe', 'pipe'] });
      
      const inputData = {
        validations: validations,
        extraction_rules: extractionRules,
        knowledge_documents: knowledgeDocuments
      };
      
      python.stdin.write(JSON.stringify(inputData));
      python.stdin.end();
      
      let pythonOutput = '';
      python.stdout.on('data', (data) => {
        pythonOutput += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        console.log('Python stderr:', data.toString());
      });
      
      await new Promise((resolve, reject) => {
        python.on('close', async (code) => {
          if (code === 0) {
            try {
              const results = JSON.parse(pythonOutput);
              console.log(`DEBUG: Found ${results.length} validations needing updates`);
              
              let updatedCount = 0;
              // Update each validation with new confidence scores
              for (const result of results) {
                await storage.updateFieldValidation(result.id, {
                  confidenceScore: result.newConfidence
                });
                updatedCount++;
                console.log(`Updated ${result.fieldName}: ${result.oldConfidence}% → ${result.newConfidence}%`);
              }
              
              res.json({
                message: `Recalculated validation scores for ${updatedCount} fields`,
                updatedValidations: results,
                totalValidations: validations.length
              });
              resolve(results);
            } catch (error) {
              console.error('Error parsing Python output:', error);
              res.status(500).json({ message: "Failed to parse recalculation results" });
              reject(error);
            }
          } else {
            console.error('Python script failed with code:', code);
            res.status(500).json({ message: "Failed to recalculate validation scores" });
            reject(new Error('Python script failed'));
          }
        });
      });
      
    } catch (error) {
      console.error("Recalculate validations error:", error);
      res.status(500).json({ message: "Failed to recalculate validation scores" });
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
