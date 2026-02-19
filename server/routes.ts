/**
 * Main API Routes for extrapl Document Data Extraction Platform
 * 
 * This file contains all REST API endpoints for the application including:
 * - Authentication and user management
 * - Project and organization CRUD operations
 * - Document upload and processing
 * - AI extraction workflows and validation
 * - Session management and real-time updates
 * 
 * Key Dependencies:
 * - Express.js for HTTP routing
 * - Drizzle ORM for database operations
 * - Child processes for Python AI services
 * - JWT authentication via auth.ts
 * - File storage via storage.ts
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { eq, asc } from "drizzle-orm";
import { workflowSteps, stepValues, sessionDocuments, type StepValue, type ProjectSchemaField, type ObjectCollection, type CollectionProperty, type FieldValidation, type ExtractionSession } from "@shared/schema";
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
  forgotPasswordSchema,
  resetPasswordWithTokenSchema,
  insertChatMessageSchema,
  insertExcelWizardryFunctionSchema
} from "@shared/schema";
import { generateChatResponse } from "./chatService";
import { authenticateToken, requireAdmin, generateToken, comparePassword, hashPassword, hashRefreshToken, type AuthRequest } from "./auth";
import crypto from "crypto";
import { subdomainMiddleware, validateTenantAccess, isValidSubdomain, type SubdomainRequest } from "./subdomain";
import { UserRole } from "@shared/schema";
import { log } from "./vite";
import { encryptCredential, decryptCredential, createLogger } from "./logger";
import multer from "multer";

function isEmailSignatureAttachment(filename: string, contentType: string, fileSize?: number): boolean {
  const name = (filename || '').toLowerCase();
  const type = (contentType || '').toLowerCase();
  const size = fileSize || 0;

  if (type.startsWith('image/') && size > 0 && size < 30000) {
    if (/^(outlook|image\d{3}|logo|signature|banner|icon|spacer|pixel|tracking)/i.test(name)) return true;
    if (/^(linkedin|facebook|twitter|instagram|x-logo|social|youtube|github|tiktok)/i.test(name)) return true;
    if (name.includes('signature') || name.includes('logo') || name.includes('banner')) return true;
    if (/\.(gif|bmp)$/.test(name) && size < 10000) return true;
    if (size < 5000 && type.includes('image/png')) return true;
    if (/^[a-f0-9]{8,}[-_]?[a-f0-9]*\.(png|jpg|gif)$/.test(name)) return true;
    if (/^(cid|inline|unnamed)/i.test(name)) return true;
  }

  return false;
}

// Async workflow test processing function
async function processWorkflowTestAsync(
  jobId: string,
  projectId: string,
  documentId: string,
  documentContentFromFrontend: string,
  valueConfig: any,
  previousResults: any
) {
  try {
    const { jobManager } = await import('./jobManager');
    const { toolEngine } = await import('./toolEngine');
    
    jobManager.updateJob(jobId, { status: 'running' });
    
    // Get the tool/function details
    const storage = (await import('./storage')).storage;
    
    // Load the test document content from database if we have a documentId
    let documentContent = documentContentFromFrontend;
    if (documentId) {
      console.log('[ASYNC] 📄 Loading test document from database:', documentId);
      const testDoc = await storage.getTestDocument(documentId);
      if (testDoc) {
        const content = testDoc.extractedContent || testDoc.extracted_content;
        if (content) {
          documentContent = content;
          console.log('[ASYNC]   ✅ Loaded document content from DB:', documentContent.length, 'chars');
          console.log('[ASYNC]   📋 Content has sheet markers:', documentContent.includes('=== Sheet:'));
        }
      }
    }
    
    const excelFunction = await storage.getExcelWizardryFunction(valueConfig.toolId);
    
    if (!excelFunction) {
      jobManager.failJob(jobId, 'Tool not found');
      return;
    }
    
    // Log incoming data for async function
    console.log('\n📥 [ASYNC] INPUT DATA FOR FUNCTION:', excelFunction.name || excelFunction.functionName);
    console.log('=' .repeat(60));
    console.log('Job ID:', jobId);
    console.log('Project ID:', projectId);
    console.log('Document ID:', documentId);
    console.log('Document Content Length:', documentContent?.length || 0);
    console.log('Raw Input Values:', Object.keys(valueConfig.inputValues));
    console.log('Previous Results Available:', previousResults ? Object.keys(previousResults) : 'None');
    if (previousResults) {
      for (const [key, value] of Object.entries(previousResults)) {
        if (Array.isArray(value)) {
          console.log(`  - ${key}: Array[${value.length}]`);
          if (value.length > 0 && (value as any)[0].extractedValue !== undefined) {
            console.log(`    First item: ${JSON.stringify((value as any)[0], null, 2)}`);
          }
        }
      }
    }
    console.log('=' .repeat(60));
    
    // Prepare input values
    const preparedInputValues = { ...valueConfig.inputValues };
    
    // Process @-references
    for (const [key, value] of Object.entries(preparedInputValues)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        const referencePath = value.slice(1);
        // Special handling for @user_document - replace with test document content
        if (referencePath === 'user_document') {
          console.log(`  ✅ Replacing ${key} with test document content (${documentContent?.length || 0} chars)`);
          console.log(`  📄 Document content preview: ${documentContent?.substring(0, 200)}...`);
          // Check if document has sheet markers
          const hasSheets = documentContent?.includes('=== Sheet:');
          console.log(`  📋 Document has sheet markers: ${hasSheets}`);
          preparedInputValues[key] = documentContent || '';
          console.log(`  ✅ Successfully set ${key} to document content`);
        }
        else if (previousResults && previousResults[referencePath]) {
          const previousData = previousResults[referencePath];
          
          // Extract just the values if these are result objects
          if (Array.isArray(previousData) && previousData.length > 0 && previousData[0].extractedValue !== undefined) {
            const extractedValues = previousData.map((item: any) => item.extractedValue);
            console.log(`  ✅ Replacing ${key} with ${extractedValues.length} extracted values from ${referencePath}`);
            preparedInputValues[key] = extractedValues;
          } else {
            console.log(`  ✅ Replacing ${key} with data from ${referencePath}`);
            preparedInputValues[key] = previousData;
          }
        } else {
          console.log(`  ⚠️ Reference ${referencePath} not found in previous results`);
        }
      }
    }
    
    // Update progress periodically
    const progressInterval = setInterval(() => {
      const job = jobManager.getJob(jobId);
      if (job && job.status === 'running' && job.progress) {
        console.log(`Job ${jobId}: ${job.progress.current}/${job.progress.total} items processed`);
      }
    }, 5000);
    
    // Execute the tool with progress tracking
    const progressCallback = (current: number, total: number, message?: string) => {
      jobManager.updateProgress(jobId, current, total, message);
    };
    
    // Add valueConfiguration to inputs for automatic incremental data
    const enrichedInputs = {
      ...preparedInputValues,
      valueConfiguration: {
        stepId: valueConfig.stepId,
        valueId: valueConfig.valueId || valueConfig.id,
        valueName: valueConfig.valueName,
        description: valueConfig.description || '',
        stepName: valueConfig.stepName,
        orderIndex: valueConfig.orderIndex,
        inputValues: valueConfig.inputValues
      },
      stepId: valueConfig.stepId,
      valueId: valueConfig.valueId || valueConfig.id
    };
    
    const result = await toolEngine.testTool(
      excelFunction,
      enrichedInputs,
      documentContent,
      null,
      progressCallback
    );
    
    clearInterval(progressInterval);
    
    // Log complete output data from async function
    console.log('\n📤 [ASYNC] OUTPUT DATA FROM FUNCTION:', excelFunction.name || excelFunction.functionName);
    console.log('=' .repeat(60));
    console.log('Job ID:', jobId);
    console.log('Number of outputs:', Array.isArray(result) ? result.length : 1);
    if (Array.isArray(result) && result.length > 0) {
      console.log('\nFirst 3 output items:');
      result.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`  [${index}]:`, JSON.stringify(item, null, 2));
      });
      if (result.length > 3) {
        console.log(`  ... and ${result.length - 3} more items`);
      }
    }
    console.log('=' .repeat(60));
    
    // Complete the job with results (no need to save test results in DB for async jobs)
    console.log(`📊 Async job ${jobId} results:`, {
      resultCount: Array.isArray(result?.results) ? result.results.length : 'not an array',
      success: result?.success,
      firstItem: result?.results?.[0]
    });
    
    const { jobManager: jm } = await import('./jobManager');
    jm.completeJob(jobId, {
      results: result,
      stepName: valueConfig.stepName,
      valueName: valueConfig.valueName
    });
    
    console.log(`✅ Async job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`❌ Async job ${jobId} failed:`, error);
    const { jobManager: jm } = await import('./jobManager');
    jm.failJob(jobId, error.message || 'Unknown error');
  }
}

async function checkAndRevertWorkflowStatus(sessionId: string): Promise<void> {
  try {
    const session = await storage.getExtractionSession(sessionId);
    if (!session || !(session as any).workflowStatus) return;

    const project = await storage.getProject(session.projectId);
    if (!project) return;

    const statusOptions: string[] = (project as any).workflowStatusOptions || [];
    const currentStatus = (session as any).workflowStatus;
    let currentIndex = statusOptions.indexOf(currentStatus);
    if (currentIndex <= 0) return;

    const steps = await storage.getWorkflowSteps(session.projectId);
    const sessionValidations = await storage.getFieldValidations(sessionId);

    const isValidOrComplete = (v: any) =>
      v.validationStatus === 'valid' || v.validationStatus === 'manual' || v.manuallyUpdated;

    const isStepComplete = async (step: any): Promise<boolean> => {
      if (step.stepType === 'kanban') {
        const kanbanConfig = step.kanbanConfig || { statusColumns: ['To Do', 'In Progress', 'Done'] };
        const statusColumns = kanbanConfig.statusColumns || ['To Do', 'In Progress', 'Done'];
        const lastColumn = statusColumns[statusColumns.length - 1];
        const cards = await storage.getKanbanCards(sessionId, step.id);
        if (cards.length === 0) return false;
        return cards.every((card: any) => card.status === lastColumn);
      } else {
        const stepVals = await storage.getStepValues(step.id);
        if (stepVals.length === 0) return true;
        return stepVals.every((sv: any) => {
          const valueValidations = sessionValidations.filter((v: any) =>
            v.valueId === sv.id || v.fieldId === sv.id || v.identifierId === sv.id
          );
          return valueValidations.length > 0 && valueValidations.every(isValidOrComplete);
        });
      }
    };

    const stepsWithActions = steps
      .filter((step: any) => step.actionConfig?.actionStatus)
      .map((step: any) => ({
        step,
        statusIndex: statusOptions.indexOf(step.actionConfig.actionStatus),
      }))
      .filter((s: any) => s.statusIndex > 0 && s.statusIndex <= currentIndex)
      .sort((a: any, b: any) => a.statusIndex - b.statusIndex);

    let revertTo: string | null = null;
    for (const { step, statusIndex } of stepsWithActions) {
      const complete = await isStepComplete(step);
      if (!complete) {
        revertTo = statusOptions[statusIndex - 1];
        break;
      }
    }

    if (revertTo && revertTo !== currentStatus) {
      await storage.updateExtractionSession(sessionId, { workflowStatus: revertTo } as any);
      try {
        await storage.createWorkflowStatusHistory({
          sessionId,
          projectId: session.projectId,
          fromStatus: currentStatus,
          toStatus: revertTo,
        });
      } catch (e) {
        console.error("Error recording workflow status history on revert:", e);
      }
      console.log(`📝 Workflow status reverted: "${currentStatus}" -> "${revertTo}" for session ${sessionId}`);
    }
  } catch (error) {
    console.error('Error checking workflow status reversion:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply subdomain middleware to all requests
  const baseDomain = process.env.BASE_DOMAIN;
  app.use(subdomainMiddleware(baseDomain));

  app.head("/api", (req, res) => {
    res.status(200).end();
  });

  app.get("/api/health", async (req, res) => {
    const start = Date.now();
    let dbStatus = 'ok';
    try {
      const { pool } = await import('./db');
      const result = await pool.query('SELECT 1');
      if (!result) dbStatus = 'error';
    } catch {
      dbStatus = 'error';
    }
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    res.json({
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      database: dbStatus,
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      responseTimeMs: Date.now() - start,
    });
  });

  // Authentication Routes

  app.post("/api/auth/login", async (req: SubdomainRequest, res) => {
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

      // Get user's organization memberships
      const userOrgs = await storage.getUserOrganizations(user.id);
      
      // Check if user is accessing from a subdomain they belong to
      if (req.tenantOrg) {
        const belongsToTenant = userOrgs.some(uo => uo.organizationId === req.tenantOrg!.id);
        if (!belongsToTenant) {
          // User doesn't belong to this tenant, redirect to their primary org
          const primaryOrg = await storage.getOrganization(user.organizationId);
          return res.status(403).json({ 
            message: "This account does not have access to this organization",
            redirectSubdomain: primaryOrg?.subdomain
          });
        }
      }

      // Get the subdomain for the current tenant (if on a tenant) or primary org
      const currentOrg = req.tenantOrg 
        ? await storage.getOrganization(req.tenantOrg.id)
        : await storage.getOrganization(user.organizationId);

      res.json({ 
        user: userResponse, 
        token,
        message: "Login successful",
        requiresPasswordChange: user.isTemporaryPassword,
        subdomain: currentOrg?.subdomain
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      const user = await storage.getUserWithOrganization(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user belongs to the current tenant via junction table
      let tenantRole = user.role; // Default to user's primary role
      
      if (req.tenantOrg) {
        const userOrgs = await storage.getUserOrganizations(user.id);
        const tenantMembership = userOrgs.find(uo => uo.organizationId === req.tenantOrg!.id);
        
        if (!tenantMembership) {
          return res.status(403).json({ 
            message: "Access denied: You do not have access to this organization",
            error: "TENANT_MISMATCH"
          });
        }
        
        // Use the role from the junction table for this tenant
        tenantRole = tenantMembership.role as "admin" | "user";
      }

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json({
        ...userResponse,
        // Override with tenant-specific context when accessing via subdomain
        role: tenantRole,
        organization: req.tenantOrg ? {
          id: req.tenantOrg.id,
          name: req.tenantOrg.name,
          subdomain: req.tenantOrg.subdomain,
          type: req.tenantOrg.type
        } : user.organization,
        subdomain: req.tenantOrg?.subdomain || user.organization?.subdomain
      });
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

  // Forgot password endpoint (self-service, no auth required)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const result = forgotPasswordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid email", errors: result.error.errors });
      }

      const user = await storage.getUserByEmail(result.data.email);

      // Always return success to prevent email enumeration
      if (!user || !user.isActive) {
        return res.json({ message: "If an account exists with that email, a password reset link has been sent." });
      }

      // Invalidate any existing reset tokens for this user
      await storage.invalidatePasswordResetTokensForUser(user.id);

      // Generate a reset token (48 random bytes → 96 hex chars)
      const rawToken = crypto.randomBytes(48).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken(user.id, tokenHash, expiresAt);

      // Build the reset URL
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      // Log the reset URL (always, for admin access)
      console.log(`[PASSWORD RESET] Token generated for ${user.email}: ${resetUrl}`);

      // Send the password reset email via AWS SES
      try {
        const { sendPasswordResetEmail } = await import('./email');
        await sendPasswordResetEmail({ to: user.email, resetUrl });
        console.log(`[PASSWORD RESET] Email sent to ${user.email}`);
      } catch (emailError) {
        console.error("[PASSWORD RESET] Failed to send email:", emailError);
      }

      res.json({ message: "If an account exists with that email, a password reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process forgot password request" });
    }
  });

  // Reset password with token (self-service, no auth required)
  app.post("/api/auth/reset-password-with-token", async (req, res) => {
    try {
      const result = resetPasswordWithTokenSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid reset data", errors: result.error.errors });
      }

      // Hash the provided token to look it up
      const tokenHash = crypto.createHash('sha256').update(result.data.token).digest('hex');
      const resetToken = await storage.getPasswordResetToken(tokenHash);

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token has already been used
      if (resetToken.usedAt) {
        return res.status(400).json({ message: "This reset token has already been used" });
      }

      // Check if token has expired
      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ message: "This reset token has expired" });
      }

      // Hash the new password and update the user
      const newPasswordHash = await hashPassword(result.data.newPassword);
      await storage.updateUserPassword(resetToken.userId, newPasswordHash, false);

      // Mark the token as used
      await storage.markPasswordResetTokenUsed(tokenHash);

      // Invalidate all other tokens for this user
      await storage.invalidatePasswordResetTokensForUser(resetToken.userId);

      console.log(`[PASSWORD RESET] Password successfully reset for user ${resetToken.userId}`);

      res.json({ message: "Password has been reset successfully. You can now sign in with your new password." });
    } catch (error) {
      console.error("Reset password with token error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Contact form endpoint (public, no auth required)
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ message: "Name, email, and message are required" });
      }

      // Always log the contact submission
      console.log(`[CONTACT FORM] Name: ${name}, Email: ${email}, Message: ${message}`);

      // Send notification email to info@extrapl.io via AWS SES
      try {
        const { sendContactFormEmail } = await import('./email');
        await sendContactFormEmail({ name, email, message });
        console.log(`[CONTACT FORM] Email notification sent to info@extrapl.io via SES`);
      } catch (emailError) {
        // Don't fail the request if email sending fails — the submission is still logged
        console.error("[CONTACT FORM] Failed to send email notification:", emailError);
      }

      res.json({ message: "Message received. We'll get back to you soon." });
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ message: "Failed to send message" });
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
      
      // Also add to user_organizations junction table
      await storage.addUserToOrganization(user.id, result.data.organizationId, result.data.role || 'user');
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Get organization members (via junction table for multi-org support)
  // Only primary org admins can view members of any organization
  app.get("/api/organizations/:id/members", authenticateToken, requireAdmin, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      const organizationId = req.params.id;
      
      // Check if user is admin of a primary org (either via tenant context or primary org) or belongs to this org
      const currentOrgId = req.tenantOrg?.id || req.user!.organizationId;
      const currentOrg = await storage.getOrganization(currentOrgId);
      
      // Also verify user is admin in current tenant context
      let isAdminInCurrentOrg = req.user!.role === 'admin';
      if (req.tenantOrg && req.user!.organizationId !== req.tenantOrg.id) {
        const userOrgs = await storage.getUserOrganizations(req.user!.id);
        const membership = userOrgs.find(uo => uo.organizationId === req.tenantOrg!.id);
        isAdminInCurrentOrg = membership?.role === 'admin';
      }
      
      // Allow if: (1) user is admin of primary org, or (2) user is admin of requested org
      if (currentOrg?.type !== 'primary' && currentOrgId !== organizationId) {
        return res.status(403).json({ message: "Not authorized to view this organization's members" });
      }
      
      if (!isAdminInCurrentOrg) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const members = await storage.getOrganizationMembers(organizationId);
      
      // Remove password hashes from response
      const safeMembers = members.map(({ passwordHash, ...member }) => member);
      res.json(safeMembers);
    } catch (error) {
      console.error("Get organization members error:", error);
      res.status(500).json({ message: "Failed to fetch organization members" });
    }
  });

  // Add existing user to organization
  // Only primary org admins can add users to any organization
  app.post("/api/organizations/:id/members", authenticateToken, requireAdmin, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      const organizationId = req.params.id;
      const { userId, email, role } = req.body;
      
      // Check if user is admin of a primary org (either via tenant context or primary org)
      // If accessing via subdomain, use tenant context; otherwise use user's primary org
      const currentOrgId = req.tenantOrg?.id || req.user!.organizationId;
      const currentOrg = await storage.getOrganization(currentOrgId);
      
      // Also verify user is admin in current tenant context
      let isAdminInCurrentOrg = req.user!.role === 'admin';
      if (req.tenantOrg && req.user!.organizationId !== req.tenantOrg.id) {
        const userOrgs = await storage.getUserOrganizations(req.user!.id);
        const membership = userOrgs.find(uo => uo.organizationId === req.tenantOrg!.id);
        isAdminInCurrentOrg = membership?.role === 'admin';
      }
      
      if (currentOrg?.type !== 'primary' || !isAdminInCurrentOrg) {
        return res.status(403).json({ message: "Only system administrators can add users to organizations" });
      }
      
      let targetUser;
      if (userId) {
        targetUser = await storage.getUser(userId);
      } else if (email) {
        targetUser = await storage.getUserByEmail(email);
      }
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const success = await storage.addUserToOrganization(targetUser.id, organizationId, role || 'user');
      
      if (success) {
        res.json({ message: "User added to organization successfully", userId: targetUser.id });
      } else {
        res.status(400).json({ message: "Failed to add user to organization" });
      }
    } catch (error) {
      console.error("Add user to organization error:", error);
      res.status(500).json({ message: "Failed to add user to organization" });
    }
  });

  // Remove user from organization
  // Only primary org admins can remove users from any organization
  app.delete("/api/organizations/:id/members/:userId", authenticateToken, requireAdmin, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      const { id: organizationId, userId } = req.params;
      
      // Check if user is admin of a primary org (either via tenant context or primary org)
      const currentOrgId = req.tenantOrg?.id || req.user!.organizationId;
      const currentOrg = await storage.getOrganization(currentOrgId);
      
      // Also verify user is admin in current tenant context
      let isAdminInCurrentOrg = req.user!.role === 'admin';
      if (req.tenantOrg && req.user!.organizationId !== req.tenantOrg.id) {
        const userOrgs = await storage.getUserOrganizations(req.user!.id);
        const membership = userOrgs.find(uo => uo.organizationId === req.tenantOrg!.id);
        isAdminInCurrentOrg = membership?.role === 'admin';
      }
      
      if (currentOrg?.type !== 'primary' || !isAdminInCurrentOrg) {
        return res.status(403).json({ message: "Only system administrators can remove users from organizations" });
      }
      
      const success = await storage.removeUserFromOrganization(userId, organizationId);
      
      if (success) {
        res.json({ message: "User removed from organization successfully" });
      } else {
        res.status(404).json({ message: "User not found in organization" });
      }
    } catch (error) {
      console.error("Remove user from organization error:", error);
      res.status(500).json({ message: "Failed to remove user from organization" });
    }
  });

  // Get all users (for adding existing users to organizations)
  app.get("/api/all-users", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      // Get all users for search/selection purposes
      const allOrgs = await storage.getOrganizations();
      const allUsers: any[] = [];
      
      for (const org of allOrgs) {
        const orgUsers = await storage.getUsers(org.id);
        for (const user of orgUsers) {
          const { passwordHash, ...safeUser } = user;
          allUsers.push({ ...safeUser, organizationName: org.name });
        }
      }
      
      res.json(allUsers);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ message: "Failed to fetch all users" });
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

  // Validate tenant subdomain (public endpoint - no auth required)
  app.get("/api/tenant/validate", async (req, res) => {
    try {
      const subdomain = req.query.subdomain as string;
      
      if (!subdomain) {
        return res.status(400).json({ valid: false, message: "Subdomain is required" });
      }
      
      const organization = await storage.getOrganizationBySubdomain(subdomain);
      
      if (!organization) {
        return res.status(404).json({ valid: false, message: "Organization not found" });
      }
      
      res.json({ 
        valid: true, 
        organizationName: organization.name 
      });
    } catch (error) {
      console.error("Tenant validation error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate tenant" });
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
      
      // Validate subdomain if provided
      if (updateData.subdomain !== undefined) {
        // Get existing organization to check if subdomain is already set
        const existingOrg = await storage.getOrganization(orgId);
        
        // Prevent changing subdomain once it has been set (one-time configuration)
        if (existingOrg?.subdomain && updateData.subdomain !== existingOrg.subdomain) {
          return res.status(403).json({ 
            message: "Subdomain cannot be changed once set. This is a one-time configuration for security reasons.",
            error: "SUBDOMAIN_IMMUTABLE"
          });
        }
        
        if (updateData.subdomain !== null && updateData.subdomain !== '') {
          if (!isValidSubdomain(updateData.subdomain)) {
            return res.status(400).json({ 
              message: "Invalid subdomain format. Use 2-63 lowercase letters, numbers, and hyphens only.",
              error: "INVALID_SUBDOMAIN"
            });
          }
          
          // Check if subdomain is already taken by another org
          const orgWithSubdomain = await storage.getOrganizationBySubdomain(updateData.subdomain);
          if (orgWithSubdomain && orgWithSubdomain.id !== orgId) {
            return res.status(409).json({ 
              message: "This subdomain is already in use by another organization",
              error: "SUBDOMAIN_TAKEN"
            });
          }
        } else {
          // Only allow clearing subdomain if it wasn't already set
          if (existingOrg?.subdomain) {
            return res.status(403).json({ 
              message: "Subdomain cannot be removed once set. This is a one-time configuration for security reasons.",
              error: "SUBDOMAIN_IMMUTABLE"
            });
          }
          updateData.subdomain = null;
        }
      }
      
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
  // Tenant isolation: projects are strictly filtered by current tenant context
  app.get("/api/projects", authenticateToken, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      // Use tenant context if available, otherwise fall back to user's primary org
      const orgId = req.tenantOrg?.id || req.user!.organizationId;
      const projects = await storage.getProjects(orgId, req.user!.role);
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", authenticateToken, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      const id = req.params.id;
      const orgId = req.tenantOrg?.id || req.user!.organizationId;
      const project = await storage.getProjectWithDetails(id, orgId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Get project error:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", authenticateToken, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      // Only admin users can create projects
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Only administrators can create projects" });
      }
      
      const result = insertProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      // Use tenant context if available, otherwise fall back to user's primary org
      const orgId = req.tenantOrg?.id || req.user!.organizationId;
      
      // Add organizationId and createdBy to the project data
      const projectData = {
        ...result.data,
        organizationId: orgId,
        createdBy: req.user!.id
      };
      
      const project = await storage.createProject(projectData);
      
      // Auto-import default tools from the standard project template
      // Only import the generic "AI Data Extraction" and "Match Database Record" tools
      const DEFAULT_TOOLS_PROJECT_ID = 'adcdee71-ec36-4df9-bfdb-ff84bf923a62';
      const DEFAULT_TOOL_NAMES = ['AI Data Extraction', 'Match Database Record for a list of items'];
      try {
        const allDefaultTools = await storage.getExcelWizardryFunctionsByProject(DEFAULT_TOOLS_PROJECT_ID);
        const defaultTools = allDefaultTools.filter(t => DEFAULT_TOOL_NAMES.includes(t.name));
        if (defaultTools.length > 0) {
          for (const tool of defaultTools) {
            await storage.createExcelWizardryFunction({
              projectId: project.id,
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
              tags: tool.tags
            });
          }
          console.log(`Auto-imported ${defaultTools.length} default tools to new project ${project.id}`);
        }
      } catch (toolsError) {
        console.warn("Failed to auto-import default tools:", toolsError);
        // Continue without failing the project creation
      }
      
      res.status(201).json(project);
    } catch (error) {
      console.error("Create project error:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", authenticateToken, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      const id = req.params.id;
      const result = insertProjectSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      const orgId = req.tenantOrg?.id || req.user!.organizationId;
      const project = await storage.updateProject(id, result.data, orgId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Update project error:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.patch("/api/projects/:id", authenticateToken, async (req: AuthRequest & SubdomainRequest, res) => {
    try {
      const id = req.params.id;
      const result = insertProjectSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      const orgId = req.tenantOrg?.id || req.user!.organizationId;
      const project = await storage.updateProject(id, result.data, orgId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Update project error:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Create or get email inbox for a project
  app.post("/api/projects/:id/inbox", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      
      const project = await storage.getProject(id, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.inboxEmailAddress && (project.inboxId || (project as any).inboxType === 'imap')) {
        return res.json({ 
          email: project.inboxEmailAddress, 
          inboxId: project.inboxId,
          inboxType: (project as any).inboxType || 'agentmail',
          message: "Inbox already exists" 
        });
      }

      const { inboxType } = req.body || {};

      if (inboxType === 'imap') {
        const { imapHost, imapPort, imapUsername, imapPassword, imapEncryption, smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption } = req.body;
        if (!imapHost || !imapPort || !imapUsername || !imapPassword) {
          return res.status(400).json({ message: "IMAP host, port, username and password are required" });
        }

        const updatedProject = await storage.updateProject(id, {
          inboxEmailAddress: imapUsername,
          inboxType: 'imap',
          imapHost,
          imapPort: Number(imapPort),
          imapUsername,
          imapPassword: encryptCredential(imapPassword),
          imapEncryption: imapEncryption || 'tls',
          smtpHost: smtpHost || null,
          smtpPort: smtpPort ? Number(smtpPort) : null,
          smtpUsername: smtpUsername || null,
          smtpPassword: smtpPassword ? encryptCredential(smtpPassword) : null,
          smtpEncryption: smtpEncryption || 'tls',
        } as any, req.user!.organizationId);

        return res.json({
          email: imapUsername,
          inboxType: 'imap',
          message: "IMAP inbox configured successfully"
        });
      }
      
      // Default: AgentMail flow
      const { createProjectInbox, createWebhook } = await import('./integrations/agentmail');
      const { username, displayName } = req.body || {};
      const { email, inboxId } = await createProjectInbox(id, {
        username: username || undefined,
        domain: 'intake.extrapl.io',
        displayName: displayName || undefined,
      });
      
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'localhost:5000');
      const webhookUrl = `https://${domain}/api/webhooks/email`;
      console.log(`📧 Registering webhook for inbox ${inboxId} at: ${webhookUrl}`);
      
      try {
        await createWebhook(inboxId, webhookUrl);
        console.log(`📧 Webhook registered successfully`);
      } catch (webhookErr) {
        console.warn('📧 Webhook registration failed (may already exist):', webhookErr);
      }
      
      const updatedProject = await storage.updateProject(id, {
        inboxEmailAddress: email,
        inboxId: inboxId,
        inboxType: 'agentmail',
      } as any, req.user!.organizationId);
      
      res.json({ 
        email, 
        inboxId,
        inboxType: 'agentmail',
        message: "Inbox created successfully" 
      });
    } catch (error: any) {
      console.error("Create project inbox error:", error);
      res.status(500).json({ message: error.message || "Failed to create project inbox" });
    }
  });

  // Delete inbox for a project
  app.delete("/api/projects/:id/inbox", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const project = await storage.getProject(id, req.user!.organizationId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (!project.inboxEmailAddress) {
        return res.status(400).json({ message: "No inbox configured for this project" });
      }

      const projectInboxType = (project as any).inboxType;
      
      if (projectInboxType !== 'imap' && project.inboxId) {
        console.log(`📧 Disconnecting inbox ${project.inboxId} from project (inbox preserved in AgentMail for reuse)`);
      }
      
      const updatedProject = await storage.updateProject(id, {
        inboxEmailAddress: null,
        inboxId: null,
        inboxType: null,
        imapHost: null,
        imapPort: null,
        imapUsername: null,
        imapPassword: null,
        imapEncryption: null,
        smtpHost: null,
        smtpPort: null,
        smtpUsername: null,
        smtpPassword: null,
        smtpEncryption: null,
      } as any, req.user!.organizationId);
      
      res.json({ message: "Inbox deleted successfully" });
    } catch (error: any) {
      console.error("Delete project inbox error:", error);
      res.status(500).json({ message: error.message || "Failed to delete inbox" });
    }
  });

  // Test IMAP connection
  app.post("/api/projects/:id/inbox/test-imap", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const project = await storage.getProject(id, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { host, port, username, password, encryption } = req.body;
      if (!host || !port || !username || !password) {
        return res.status(400).json({ message: "host, port, username and password are required" });
      }

      const { testImapConnection } = await import('./integrations/imapSmtp');
      const result = await testImapConnection({ host, port: Number(port), username, password, encryption: encryption || 'tls' });
      res.json(result);
    } catch (error: any) {
      console.error("Test IMAP error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to test IMAP connection" });
    }
  });

  // Test SMTP connection
  app.post("/api/projects/:id/inbox/test-smtp", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const project = await storage.getProject(id, req.user!.organizationId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { host, port, username, password, encryption } = req.body;
      if (!host || !port || !username || !password) {
        return res.status(400).json({ message: "host, port, username and password are required" });
      }

      const { testSmtpConnection } = await import('./integrations/imapSmtp');
      const result = await testSmtpConnection({ host, port: Number(port), username, password, encryption: encryption || 'tls' });
      res.json(result);
    } catch (error: any) {
      console.error("Test SMTP error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to test SMTP connection" });
    }
  });

  // Refresh/update webhook URL for inbox
  app.post("/api/projects/:id/inbox/refresh-webhook", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const project = await storage.getProject(id, req.user!.organizationId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (!project.inboxId) {
        return res.status(400).json({ message: "No inbox configured for this project" });
      }
      
      const { createWebhook } = await import('./integrations/agentmail');
      
      // Register webhook with correct domain
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'localhost:5000');
      const webhookUrl = `https://${domain}/api/webhooks/email`;
      console.log(`📧 Refreshing webhook for inbox ${project.inboxId} at: ${webhookUrl}`);
      
      await createWebhook(project.inboxId, webhookUrl);
      console.log(`📧 Webhook refreshed successfully`);
      
      res.json({ 
        success: true, 
        message: "Webhook updated successfully",
        webhookUrl 
      });
    } catch (error: any) {
      console.error("Refresh webhook error:", error);
      res.status(500).json({ message: error.message || "Failed to refresh webhook" });
    }
  });

  // Manually process emails from inbox (polling approach)
  app.post("/api/projects/:id/inbox/process", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const project = await storage.getProject(id, req.user!.organizationId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const projectInboxType = (project as any).inboxType;

      // IMAP flow
      if (projectInboxType === 'imap') {
        const imapHost = (project as any).imapHost;
        const imapPort = (project as any).imapPort;
        const imapUsername = (project as any).imapUsername;
        const imapPasswordEnc = (project as any).imapPassword;
        const imapEncryption = (project as any).imapEncryption || 'tls';

        if (!imapHost || !imapUsername || !imapPasswordEnc) {
          return res.status(400).json({ message: "IMAP credentials not configured" });
        }

        const imapPasswordDecrypted = decryptCredential(imapPasswordEnc);

        console.log(`📧 Processing IMAP emails for project: ${project.name} (${imapUsername})`);

        const { fetchImapEmails, sendSmtpEmail } = await import('./integrations/imapSmtp');
        const { renderEmailTemplate, DEFAULT_EMAIL_TEMPLATE } = await import('./integrations/agentmail');

        const imapConfig = { host: imapHost, port: imapPort, username: imapUsername, password: imapPasswordDecrypted, encryption: imapEncryption };
        const imapEmails = await fetchImapEmails(imapConfig);

        console.log(`📧 IMAP: Found ${imapEmails.length} unseen messages`);

        let sessionsCreated = 0;
        const requiredDocTypes = (project as any).requiredDocumentTypes as Array<{id: string; name: string; description: string}> || [];
        const emailTemplate = (project as any).emailNotificationTemplate || DEFAULT_EMAIL_TEMPLATE;

        const smtpHost = (project as any).smtpHost;
        const smtpPort = (project as any).smtpPort;
        const smtpUsername = (project as any).smtpUsername;
        const smtpPasswordEnc = (project as any).smtpPassword;
        const smtpEncryption = (project as any).smtpEncryption || 'tls';
        const hasSmtp = smtpHost && smtpUsername && smtpPasswordEnc;
        const smtpPasswordDecrypted = smtpPasswordEnc ? decryptCredential(smtpPasswordEnc) : null;
        const smtpConfig = hasSmtp ? { host: smtpHost, port: smtpPort, username: smtpUsername, password: smtpPasswordDecrypted!, encryption: smtpEncryption } : null;

        for (const email of imapEmails) {
          const alreadyProcessed = await storage.isEmailProcessed(project.id, email.messageId);
          if (alreadyProcessed) {
            console.log(`📧 IMAP: Skipping already processed: ${email.messageId}`);
            continue;
          }

          console.log(`📧 IMAP: Processing: ${email.messageId} - ${email.subject}`);

          // Document validation
          if (requiredDocTypes.length > 0 && email.attachments.length === 0) {
            console.log(`📧 IMAP: No attachments, sending rejection`);
            if (smtpConfig) {
              const missingDocsList = requiredDocTypes.map((dt: any) => `- ${dt.name}: ${dt.description || 'Required'}`).join('\n');
              const textBody = `Thank you for your submission.\n\nUnfortunately, we could not process your request because the following required documents are missing:\n\n${missingDocsList}\n\nPlease reply to this email with the required documents attached.\n\nThank you.`;
              try {
                await sendSmtpEmail(smtpConfig, {
                  to: email.from,
                  subject: `Re: ${email.subject} - Documents Required`,
                  textContent: textBody,
                  htmlContent: renderEmailTemplate(emailTemplate, {
                    subject: `Re: ${email.subject} - Documents Required`,
                    body: textBody.replace(/\n/g, '<br>'),
                    projectName: project.name,
                    senderEmail: email.from,
                  }),
                  replyToMessageId: email.messageId,
                });
              } catch (emailErr) {
                console.error(`📧 IMAP: Failed to send rejection:`, emailErr);
              }
            }
            await storage.markEmailProcessed(project.id, email.messageId, imapUsername, null, email.subject, email.from, email.textContent || email.htmlContent || '', new Date());
            continue;
          }

          // If required doc types, validate attachments
          if (requiredDocTypes.length > 0 && email.attachments.length > 0) {
            const attachmentContents = new Map<string, { filename: string; content: string; contentType: string }>();

            for (const att of email.attachments) {
              let extractedContent = '';
              if (att.contentType.includes('pdf') || att.contentType.includes('excel') ||
                  att.contentType.includes('spreadsheet') || att.contentType.includes('word') ||
                  att.contentType.includes('document') || att.contentType.includes('text')) {
                try {
                  const base64Content = att.data.toString('base64');
                  const dataUrl = `data:${att.contentType};base64,${base64Content}`;
                  const extractionData = {
                    step: "extract_text_only",
                    documents: [{ file_name: att.filename, file_content: dataUrl, mime_type: att.contentType }]
                  };
                  const { spawn } = await import('child_process');
                  extractedContent = await new Promise<string>((resolve) => {
                    const python = spawn('python3', ['services/document_extractor.py']);
                    const timeout = setTimeout(() => { python.kill(); resolve(''); }, 20000);
                    python.stdin.write(JSON.stringify(extractionData));
                    python.stdin.end();
                    let output = '';
                    python.stdout.on('data', (chunk: any) => { output += chunk.toString(); });
                    python.on('close', (code: any) => {
                      clearTimeout(timeout);
                      if (code === 0) {
                        try { resolve(JSON.parse(output).extracted_texts?.[0]?.text_content || ''); }
                        catch { resolve(''); }
                      } else { resolve(''); }
                    });
                    python.on('error', () => { clearTimeout(timeout); resolve(''); });
                  });
                } catch { /* ignore */ }
              }
              attachmentContents.set(att.filename, { filename: att.filename, content: extractedContent, contentType: att.contentType });
            }

            const validationResults: Array<{ docType: any; matched: boolean; matchedFile?: string }> = [];
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY });

            for (const docType of requiredDocTypes) {
              let matched = false;
              let matchedFile: string | undefined;
              for (const [, attachData] of attachmentContents) {
                try {
                  if (attachData.contentType?.startsWith('image/') && attachData.filename?.toLowerCase().includes('outlook')) continue;
                  const validationPrompt = `You are validating if a document matches an expected document type.\nBe lenient - if the document seems related to the topic, consider it a match.\n\nDocument Type Required: "${docType.name}"\nDescription: "${docType.description}"\n\nDocument being validated:\nFilename: ${attachData.filename}\nFile type: ${attachData.contentType}\nContent (first 3000 chars):\n${attachData.content ? attachData.content.slice(0, 3000) : 'Content could not be extracted, use filename to judge.'}\n\nDoes this document match or relate to the required document type? Be generous.\nRespond with JSON only:\n{"matches": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;
                  const response = await Promise.race([
                    ai.models.generateContent({ model: 'gemini-2.0-flash', contents: validationPrompt }),
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
                  ]);
                  if (response) {
                    const text = (response as any).text || '';
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      const parsed = JSON.parse(jsonMatch[0]);
                      if (parsed.matches && parsed.confidence >= 0.5) {
                        matched = true;
                        matchedFile = attachData.filename;
                        break;
                      }
                    }
                  }
                } catch (err) {
                  console.error(`📧 IMAP: AI validation error:`, err);
                }
              }
              validationResults.push({ docType, matched, matchedFile });
            }

            const missingDocTypes = validationResults.filter(r => !r.matched);
            if (missingDocTypes.length > 0 && smtpConfig) {
              const missingList = missingDocTypes.map(r => `- ${r.docType.name}: ${r.docType.description || 'Required'}`).join('\n');
              const matchedList = validationResults.filter(r => r.matched).map(r => `- ${r.docType.name} (matched: ${r.matchedFile})`).join('\n');
              const rejectionTextBody = `Thank you for your submission to ${project.name}.\n\nWe reviewed your attachments but the following required documents are still missing or could not be identified:\n\n${missingList}\n\n${matchedList ? `Documents we received:\n${matchedList}\n\n` : ''}Please reply to this email with the missing documents attached.\n\nThank you.`;
              try {
                await sendSmtpEmail(smtpConfig, {
                  to: email.from,
                  subject: `Re: ${email.subject} - Additional Documents Required`,
                  textContent: rejectionTextBody,
                  htmlContent: renderEmailTemplate(emailTemplate, {
                    subject: `Re: ${email.subject} - Additional Documents Required`,
                    body: rejectionTextBody.replace(/\n/g, '<br>'),
                    projectName: project.name,
                    senderEmail: email.from,
                  }),
                  replyToMessageId: email.messageId,
                });
              } catch (emailErr) {
                console.error(`📧 IMAP: Failed to send rejection:`, emailErr);
              }
              await storage.markEmailProcessed(project.id, email.messageId, imapUsername, null, email.subject, email.from, email.textContent || email.htmlContent || '', new Date());
              continue;
            }

            if (missingDocTypes.length === 0 && smtpConfig) {
              const confirmTextBody = `Thank you for your submission to ${project.name}.\n\nWe have received all required documents and your submission is now being processed.\n\nThank you.`;
              try {
                await sendSmtpEmail(smtpConfig, {
                  to: email.from,
                  subject: `Re: ${email.subject} - Submission Received`,
                  textContent: confirmTextBody,
                  htmlContent: renderEmailTemplate(emailTemplate, {
                    subject: `Re: ${email.subject} - Submission Received`,
                    body: confirmTextBody.replace(/\n/g, '<br>'),
                    projectName: project.name,
                    senderEmail: email.from,
                  }),
                  replyToMessageId: email.messageId,
                });
              } catch (emailErr) {
                console.error(`📧 IMAP: Failed to send confirmation:`, emailErr);
              }
            }
          }

          // Create session
          const sessionName = email.subject.slice(0, 100);
          const emailBodyContent = email.textContent || email.htmlContent || '';
          const sessionData = {
            projectId: project.id,
            sessionName,
            description: `Created from email by ${email.from}`,
            status: 'pending' as const,
            documentCount: email.attachments.length,
            extractedData: '{}',
          };
          const session = await storage.createExtractionSession(sessionData);
          await storage.markEmailProcessed(project.id, email.messageId, imapUsername, session.id, email.subject, email.from, emailBodyContent, new Date());
          console.log(`📧 IMAP: Created session: ${session.id} - ${sessionName}`);
          sessionsCreated++;

          await generateSchemaFieldValidations(session.id, project.id);

          // Process attachments (filter out signature images)
          const realAttachments = email.attachments.filter((att: any) => {
            if (isEmailSignatureAttachment(att.filename, att.contentType, att.data?.length)) {
              console.log(`📧 IMAP: Skipping signature attachment: ${att.filename} (${att.data?.length} bytes)`);
              return false;
            }
            return true;
          });
          for (const att of realAttachments) {
            try {
              const fs = await import('fs/promises');
              const path = await import('path');
              const uploadDir = path.join(process.cwd(), 'uploads', session.id);
              await fs.mkdir(uploadDir, { recursive: true });

              let extractedContent = '';
              const supportedForExtraction = att.contentType.includes('pdf') || att.contentType.includes('excel') ||
                  att.contentType.includes('spreadsheet') || att.contentType.includes('word') ||
                  att.contentType.includes('document') || att.contentType.includes('text') ||
                  att.contentType.includes('image/');
              if (supportedForExtraction) {
                try {
                  const base64Content = att.data.toString('base64');
                  const extractionData = {
                    step: "extract_text_only",
                    documents: [{ file_name: att.filename, file_content: base64Content, mime_type: att.contentType }]
                  };
                  const { spawn } = await import('child_process');
                  const os = await import('os');
                  const tmpFile = path.join(os.tmpdir(), `extract_${crypto.randomUUID()}.json`);
                  await fs.writeFile(tmpFile, JSON.stringify(extractionData));
                  const fsNode = await import('fs');
                  extractedContent = await new Promise<string>((resolve) => {
                    const python = spawn('python3', ['services/document_extractor.py'], { env: { ...process.env } });
                    const timeout = setTimeout(() => { python.kill(); resolve(''); }, 120000);
                    const inputStream = fsNode.createReadStream(tmpFile);
                    inputStream.pipe(python.stdin);
                    let output = '';
                    python.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                    python.on('close', async (code: number | null) => {
                      clearTimeout(timeout);
                      try { await fs.unlink(tmpFile); } catch {}
                      if (code === 0) {
                        try { resolve(JSON.parse(output).extracted_texts?.[0]?.text_content || ''); }
                        catch { resolve(''); }
                      } else { resolve(''); }
                    });
                    python.on('error', () => { clearTimeout(timeout); fs.unlink(tmpFile).catch(() => {}); resolve(''); });
                  });
                } catch { /* ignore */ }
              }

              const uniqueId = crypto.randomUUID();
              const safeFilename = att.filename.replace(/[^\w\s.-]/g, '_');
              const finalPath = path.join(uploadDir, `${uniqueId}_${safeFilename}`);
              await fs.writeFile(finalPath, att.data);

              await storage.createSessionDocument({
                sessionId: session.id,
                fileName: att.filename,
                mimeType: att.contentType,
                fileSize: att.data.length,
                extractedContent: extractedContent,
              });
              console.log(`📧 IMAP: Saved attachment: ${att.filename} (${extractedContent.length} chars extracted)`);
            } catch (attachErr) {
              console.error(`📧 IMAP: Failed to process attachment:`, attachErr);
            }
          }
        }

        return res.json({
          messagesFound: imapEmails.length,
          sessionsCreated,
          message: sessionsCreated > 0 ? `Created ${sessionsCreated} session(s) from IMAP emails` : "No new emails to process"
        });
      }

      // AgentMail flow (default)
      if (!project.inboxId) {
        return res.status(400).json({ message: "No inbox configured for this project" });
      }
      
      console.log(`📧 Processing emails for project: ${project.name} (inbox: ${project.inboxId})`);
      
      const { getInboxMessages, getMessage, downloadAttachment } = await import('./integrations/agentmail');
      const messages = await getInboxMessages(project.inboxId);
      
      console.log(`📧 Found ${messages.length} messages in inbox`);
      
      let sessionsCreated = 0;
      
      // Get required document types from project
      const requiredDocTypes = (project as any).requiredDocumentTypes as Array<{id: string; name: string; description: string}> || [];
      console.log(`📧 Project requires ${requiredDocTypes.length} document types`);
      
      const { sendEmail, renderEmailTemplate, DEFAULT_EMAIL_TEMPLATE } = await import('./integrations/agentmail');
      const emailTemplate = (project as any).emailNotificationTemplate || DEFAULT_EMAIL_TEMPLATE;
      
      for (const msg of messages) {
        const messageId = msg.messageId || msg.id;
        
        // Skip sent emails (from our own inbox)
        const labels = msg.labels || [];
        if (labels.includes('sent') && !labels.includes('received')) {
          console.log(`📧 Skipping sent message: ${messageId}`);
          continue;
        }
        
        // Skip emails from our own inbox address
        const fromAddr = (msg.from || '').toLowerCase();
        if (fromAddr.includes(project.inboxId!.toLowerCase()) || fromAddr.includes('agentmail.to')) {
          console.log(`📧 Skipping self-addressed message: ${messageId}`);
          continue;
        }
        
        // Skip already processed messages (check database)
        const alreadyProcessed = await storage.isEmailProcessed(project.id, messageId);
        if (alreadyProcessed) {
          console.log(`📧 Skipping already processed message: ${messageId}`);
          continue;
        }
        
        console.log(`📧 Processing message: ${messageId} - ${msg.subject}`);
        
        // Get full message details
        const fullMessage = await getMessage(project.inboxId!, messageId);
        const subject = (fullMessage as any).subject || 'Email Session';
        const fromEmail = (fullMessage as any).from_?.[0] || (fullMessage as any).from || 'unknown@example.com';
        const textContent = (fullMessage as any).text || (fullMessage as any).textPlain || (fullMessage as any).text_plain || (fullMessage as any).html || (fullMessage as any).textHtml || (fullMessage as any).text_html || '';
        const attachments = (fullMessage as any).attachments || [];
        
        // === DOCUMENT VALIDATION WITH AUTO-REPLY ===
        if (requiredDocTypes.length > 0) {
          console.log(`📧 Validating ${attachments.length} attachments against ${requiredDocTypes.length} required document types`);
          
          // If no attachments but documents required, send rejection
          if (attachments.length === 0) {
            console.log(`📧 No attachments provided, sending rejection email`);
            const missingDocsList = requiredDocTypes.map((dt: any) => `- ${dt.name}: ${dt.description || 'Required'}`).join('\n');
            const textBody = `Thank you for your submission.\n\nUnfortunately, we could not process your request because the following required documents are missing:\n\n${missingDocsList}\n\nPlease reply to this email with the required documents attached.\n\nThank you.`;
            try {
              await sendEmail({
                fromInboxId: project.inboxId!,
                to: fromEmail,
                subject: `Re: ${subject} - Documents Required`,
                textContent: textBody,
                htmlContent: renderEmailTemplate(emailTemplate, {
                  subject: `Re: ${subject} - Documents Required`,
                  body: textBody.replace(/\n/g, '<br>'),
                  projectName: project.name,
                  senderEmail: fromEmail
                }),
                replyToMessageId: messageId
              });
              console.log(`📧 Rejection email sent to ${fromEmail}`);
            } catch (emailErr) {
              console.error(`📧 Failed to send rejection email:`, emailErr);
            }
            
            // Mark as processed but don't create session
            await storage.markEmailProcessed(project.id, messageId, project.inboxId!, null, subject, fromEmail, textContent, new Date());
            continue;
          }
          
          // Download and validate attachments
          const attachmentContents = new Map<string, { filename: string; content: string; contentType: string }>();
          
          for (const attachment of attachments) {
            try {
              const attachmentId = attachment.attachmentId || attachment.attachment_id || attachment.id;
              const filename = attachment.filename || attachment.fileName || 'attachment';
              const { data, contentType } = await downloadAttachment(project.inboxId!, messageId, attachmentId);
              
              // Extract text content for validation
              let extractedContent = '';
              if (contentType.includes('pdf') || contentType.includes('excel') || 
                  contentType.includes('spreadsheet') || contentType.includes('word') ||
                  contentType.includes('document') || contentType.includes('text')) {
                try {
                  const base64Content = data.toString('base64');
                  const dataUrl = `data:${contentType};base64,${base64Content}`;
                  const extractionData = {
                    step: "extract_text_only",
                    documents: [{ file_name: filename, file_content: dataUrl, mime_type: contentType }]
                  };
                  
                  const { spawn } = await import('child_process');
                  extractedContent = await new Promise<string>((resolve) => {
                    const python = spawn('python3', ['services/document_extractor.py']);
                    const timeout = setTimeout(() => { python.kill(); resolve(''); }, 20000);
                    python.stdin.write(JSON.stringify(extractionData));
                    python.stdin.end();
                    let output = '';
                    python.stdout.on('data', (chunk) => { output += chunk.toString(); });
                    python.on('close', (code) => {
                      clearTimeout(timeout);
                      if (code === 0) {
                        try { resolve(JSON.parse(output).extracted_texts?.[0]?.text_content || ''); } 
                        catch { resolve(''); }
                      } else { resolve(''); }
                    });
                    python.on('error', () => { clearTimeout(timeout); resolve(''); });
                  });
                } catch { /* ignore extraction errors */ }
              }
              
              attachmentContents.set(attachmentId, { filename, content: extractedContent, contentType });
            } catch (err) {
              console.error(`📧 Failed to download attachment:`, err);
            }
          }
          
          // Validate against required document types
          const validationResults: Array<{ docType: any; matched: boolean; matchedFile?: string }> = [];
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY });
          
          for (const docType of requiredDocTypes) {
            let matched = false;
            let matchedFile: string | undefined;
            
            for (const [, attachData] of attachmentContents) {
              try {
                // Skip inline images (signature logos etc)
                if (attachData.contentType?.startsWith('image/') && attachData.filename?.toLowerCase().includes('outlook')) {
                  console.log(`📧 Skipping email signature image: ${attachData.filename}`);
                  continue;
                }
                
                console.log(`📧 Validating file: ${attachData.filename} (${attachData.contentType})`);
                console.log(`📧 Content preview: ${attachData.content?.slice(0, 200) || 'No content extracted'}`);
                
                if (!attachData.content && (attachData.contentType?.includes('pdf') || attachData.contentType?.includes('document') || attachData.contentType?.includes('spreadsheet') || attachData.contentType?.includes('excel') || attachData.contentType?.includes('word'))) {
                  console.log(`📧 Content extraction failed for ${attachData.filename} (likely scanned document) - accepting by default`);
                  matched = true;
                  matchedFile = attachData.filename;
                  break;
                }

                const validationPrompt = `You are validating if a document matches an expected document type.
Be lenient - if the document seems related to the topic, consider it a match.

Document Type Required: "${docType.name}"
Description: "${docType.description}"

Document being validated:
Filename: ${attachData.filename}
File type: ${attachData.contentType}
Content (first 3000 chars):
${attachData.content ? attachData.content.slice(0, 3000) : 'Content could not be extracted, use filename to judge.'}

Does this document match or relate to the required document type? Be generous - if it's in the same domain (e.g. a repair document for a damage claim), count it as a match.
Respond with JSON only:
{"matches": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

                const response = await Promise.race([
                  ai.models.generateContent({ model: 'gemini-2.0-flash', contents: validationPrompt }),
                  new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
                ]);
                
                if (response) {
                  const text = (response as any).text || '';
                  console.log(`📧 AI validation response: ${text.slice(0, 300)}`);
                  const jsonMatch = text.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log(`📧 Parsed: matches=${parsed.matches}, confidence=${parsed.confidence}, reason=${parsed.reasoning}`);
                    if (parsed.matches && parsed.confidence >= 0.5) {
                      matched = true;
                      matchedFile = attachData.filename;
                      break;
                    }
                  }
                }
              } catch (err) {
                console.error(`📧 AI validation error:`, err);
              }
            }
            
            validationResults.push({ docType, matched, matchedFile });
          }
          
          // Check if all requirements met
          const missingDocTypes = validationResults.filter(r => !r.matched);
          
          if (missingDocTypes.length > 0) {
            console.log(`📧 Missing ${missingDocTypes.length} document types, sending rejection`);
            const missingList = missingDocTypes.map(r => `- ${r.docType.name}: ${r.docType.description || 'Required'}`).join('\n');
            const matchedList = validationResults.filter(r => r.matched).map(r => `- ${r.docType.name} (matched: ${r.matchedFile})`).join('\n');
            const rejectionTextBody = `Thank you for your submission to ${project.name}.\n\nWe reviewed your attachments but the following required documents are still missing or could not be identified:\n\n${missingList}\n\n${matchedList ? `Documents we received:\n${matchedList}\n\n` : ''}Please reply to this email with the missing documents attached.\n\nThank you.`;
            
            try {
              await sendEmail({
                fromInboxId: project.inboxId!,
                to: fromEmail,
                subject: `Re: ${subject} - Additional Documents Required`,
                textContent: rejectionTextBody,
                htmlContent: renderEmailTemplate(emailTemplate, {
                  subject: `Re: ${subject} - Additional Documents Required`,
                  body: rejectionTextBody.replace(/\n/g, '<br>'),
                  projectName: project.name,
                  senderEmail: fromEmail
                }),
                replyToMessageId: messageId
              });
              console.log(`📧 Rejection email sent to ${fromEmail}`);
            } catch (emailErr) {
              console.error(`📧 Failed to send rejection email:`, emailErr);
            }
            
            await storage.markEmailProcessed(project.id, messageId, project.inboxId!, null, subject, fromEmail, textContent, new Date());
            continue;
          }
          
          // All documents validated - send confirmation
          console.log(`📧 All document requirements met, creating session`);
          const confirmTextBody = `Thank you for your submission to ${project.name}.\n\nWe have received all required documents and your submission is now being processed. You will receive updates on the status of your submission.\n\nThank you.`;
          try {
            await sendEmail({
              fromInboxId: project.inboxId!,
              to: fromEmail,
              subject: `Re: ${subject} - Submission Received`,
              textContent: confirmTextBody,
              htmlContent: renderEmailTemplate(emailTemplate, {
                subject: `Re: ${subject} - Submission Received`,
                body: confirmTextBody.replace(/\n/g, '<br>'),
                projectName: project.name,
                senderEmail: fromEmail
              }),
              replyToMessageId: messageId
            });
            console.log(`📧 Confirmation email sent to ${fromEmail}`);
          } catch (emailErr) {
            console.error(`📧 Failed to send confirmation email:`, emailErr);
          }
        }
        
        // Create session from email
        const sessionName = subject.slice(0, 100);
        const sessionData = {
          projectId: project.id,
          sessionName,
          description: `Created from email by ${fromEmail}`,
          status: 'pending' as const,
          documentCount: attachments.length,
          extractedData: '{}',
        };
        
        const session = await storage.createExtractionSession(sessionData);
        await storage.markEmailProcessed(project.id, messageId, project.inboxId!, session.id, subject, fromEmail, textContent, new Date());
        console.log(`📧 Created session: ${session.id} - ${sessionName}`);
        sessionsCreated++;
        
        // Generate initial field validations
        await generateSchemaFieldValidations(session.id, project.id);
        
        // Process attachments if any (filter out signature images)
        const realPollAttachments = attachments.filter((att: any) => {
          const fname = att.filename || att.fileName || '';
          const ftype = att.content_type || att.contentType || '';
          const fsize = att.size || att.fileSize || 0;
          if (isEmailSignatureAttachment(fname, ftype, fsize)) {
            console.log(`📧 Skipping signature attachment: ${fname} (${fsize} bytes)`);
            return false;
          }
          return true;
        });
        if (realPollAttachments.length > 0) {
          for (const attachment of realPollAttachments) {
            try {
              const attachmentId = attachment.attachmentId || attachment.attachment_id || attachment.id;
              console.log(`📧 Downloading attachment: ${attachment.filename || attachment.fileName}`);
              
              const { data, filename, contentType } = await downloadAttachment(
                project.inboxId!,
                messageId,
                attachmentId
              );
              
              // Setup upload directory
              const fs = await import('fs/promises');
              const path = await import('path');
              const uploadDir = path.join(process.cwd(), 'uploads', session.id);
              await fs.mkdir(uploadDir, { recursive: true });
              
              // Extract content from PDF/documents/images using Python subprocess
              let extractedContent = '';
              const supportedForExtraction = contentType.includes('pdf') || contentType.includes('excel') || 
                  contentType.includes('spreadsheet') || contentType.includes('word') ||
                  contentType.includes('document') || contentType.includes('text') ||
                  contentType.includes('image/');
              if (supportedForExtraction) {
                try {
                  const base64Content = data.toString('base64');
                  const extractionData = {
                    step: "extract_text_only",
                    documents: [{ file_name: filename, file_content: base64Content, mime_type: contentType }]
                  };
                  
                  const { spawn } = await import('child_process');
                  const os = await import('os');
                  const tmpFile = path.join(os.tmpdir(), `extract_${crypto.randomUUID()}.json`);
                  await fs.writeFile(tmpFile, JSON.stringify(extractionData));
                  
                  const fsNode = await import('fs');
                  extractedContent = await new Promise<string>((resolve) => {
                    const python = spawn('python3', ['services/document_extractor.py'], {
                      env: { ...process.env }
                    });
                    const timeout = setTimeout(() => { python.kill(); console.log(`📧 Python extraction timeout for ${filename}`); resolve(''); }, 120000);
                    
                    const inputStream = fsNode.createReadStream(tmpFile);
                    inputStream.pipe(python.stdin);
                    
                    let output = '';
                    let stderr = '';
                    python.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                    python.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
                    python.on('close', async (code: number | null) => {
                      clearTimeout(timeout);
                      try { await fs.unlink(tmpFile); } catch {}
                      if (stderr) console.log(`📧 Python stderr for ${filename}: ${stderr}`);
                      if (code === 0) {
                        try { 
                          const result = JSON.parse(output);
                          const text = result.extracted_texts?.[0]?.text_content || '';
                          const error = result.extracted_texts?.[0]?.error;
                          if (error) console.log(`📧 Extraction error for ${filename}: ${error}`);
                          resolve(text); 
                        } catch (e) { console.log(`📧 Failed to parse output: ${output.slice(0,200)}`); resolve(''); }
                      } else { console.log(`📧 Python exited with code ${code}`); resolve(''); }
                    });
                    python.on('error', (err: Error) => { clearTimeout(timeout); console.log(`📧 Python spawn error: ${err}`); fs.unlink(tmpFile).catch(() => {}); resolve(''); });
                  });
                  console.log(`📧 Extracted ${extractedContent.length} chars from ${filename}`);
                } catch (extractErr) {
                  console.error(`📧 Failed to extract content from ${filename}:`, extractErr);
                }
              }
              
              // Generate unique filename upfront to avoid the rename/update step
              const uniqueId = crypto.randomUUID();
              const safeFilename = filename.replace(/[^\w\s.-]/g, '_'); // Remove special chars like emojis
              const finalPath = path.join(uploadDir, `${uniqueId}_${safeFilename}`);
              await fs.writeFile(finalPath, data);
              
              const document = await storage.createSessionDocument({
                sessionId: session.id,
                fileName: filename,
                mimeType: contentType,
                fileSize: data.length,
                extractedContent: extractedContent,
              });
              
              console.log(`📧 Saved attachment: ${filename} (${extractedContent.length} chars extracted)`);
            } catch (attachErr) {
              console.error(`📧 Failed to process attachment:`, attachErr);
            }
          }
        }
      }
      
      res.json({ 
        messagesFound: messages.length,
        sessionsCreated,
        message: sessionsCreated > 0 
          ? `Created ${sessionsCreated} session(s) from emails` 
          : "No new emails to process"
      });
    } catch (error: any) {
      console.error("Process inbox emails error:", error);
      res.status(500).json({ message: error.message || "Failed to process inbox emails" });
    }
  });

  // Debug endpoint to check inbox messages
  app.get("/api/projects/:id/inbox/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const project = await storage.getProject(id, req.user!.organizationId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (!project.inboxId) {
        return res.status(400).json({ message: "No inbox configured for this project" });
      }
      
      console.log(`📧 Checking messages for inbox: ${project.inboxId}`);
      
      const { getInboxMessages } = await import('./integrations/agentmail');
      const messages = await getInboxMessages(project.inboxId);
      
      console.log(`📧 Found ${messages.length} messages in inbox`);
      
      res.json({ 
        inboxId: project.inboxId,
        email: project.inboxEmailAddress,
        messageCount: messages.length,
        messages: messages.map((m: any) => ({
          id: m.messageId || m.id,
          subject: m.subject,
          from: m.from_ || m.from,
          date: m.createdAt || m.date,
          hasAttachments: (m.attachments?.length || 0) > 0
        }))
      });
    } catch (error: any) {
      console.error("Get inbox messages error:", error);
      res.status(500).json({ message: error.message || "Failed to get inbox messages" });
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
      console.log(`Attempting to delete project ${id} for organization ${req.user!.organizationId}`);
      const deleted = await storage.deleteProject(id, req.user!.organizationId);
      if (!deleted) {
        console.log(`Project ${id} not found or access denied`);
        return res.status(404).json({ message: "Project not found" });
      }
      console.log(`Successfully deleted project ${id}`);
      res.status(204).send();
    } catch (error) {
      console.error("Delete project error:", error);
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

  // Import tools from another project
  app.post("/api/projects/:projectId/import-tools", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const targetProjectId = req.params.projectId;
      const { sourceProjectId } = req.body;
      
      if (!sourceProjectId || typeof sourceProjectId !== 'string') {
        return res.status(400).json({ message: "Source project ID is required" });
      }
      
      // Verify both projects exist
      const targetProject = await storage.getProject(targetProjectId);
      const sourceProject = await storage.getProject(sourceProjectId);
      
      if (!targetProject) {
        return res.status(404).json({ message: "Target project not found" });
      }
      if (!sourceProject) {
        return res.status(404).json({ message: "Source project not found" });
      }
      
      // Get all tools from source project
      const sourceTools = await storage.getExcelWizardryFunctionsByProject(sourceProjectId);
      
      if (sourceTools.length === 0) {
        return res.status(200).json({ 
          message: "No tools found in source project", 
          imported: 0,
          skipped: 0
        });
      }
      
      // Get existing tools in target project to avoid duplicates
      const existingTools = await storage.getExcelWizardryFunctionsByProject(targetProjectId);
      const existingToolNames = new Set(existingTools.map(t => t.name.toLowerCase()));
      
      let imported = 0;
      let skipped = 0;
      const importedTools = [];
      
      for (const tool of sourceTools) {
        // Skip if tool with same name already exists
        if (existingToolNames.has(tool.name.toLowerCase())) {
          skipped++;
          continue;
        }
        
        // Create new tool in target project
        const newTool = await storage.createExcelWizardryFunction({
          projectId: targetProjectId,
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
          tags: tool.tags
        });
        
        importedTools.push(newTool);
        imported++;
      }
      
      console.log(`Imported ${imported} tools from project ${sourceProjectId} to ${targetProjectId} (skipped ${skipped} duplicates)`);
      
      res.status(200).json({
        message: `Successfully imported ${imported} tools`,
        imported,
        skipped,
        tools: importedTools
      });
    } catch (error) {
      console.error("Import tools error:", error);
      res.status(500).json({ message: "Failed to import tools" });
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
      const python = spawn('python3', ['services/ai_schema_generator.py', query, projectId]);
      
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

  // API Data Sources - Helper to validate URL is safe (SSRF protection)
  const isUrlSafe = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      // Only allow https in production, http allowed in development
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction && parsed.protocol !== 'https:') {
        return false;
      }
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return false;
      }
      // Block localhost and loopback addresses (IPv4 and IPv6)
      const hostname = parsed.hostname.toLowerCase();
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', '[::]'];
      if (blockedHosts.includes(hostname)) {
        return false;
      }
      // Block IPv6 link-local and unique-local addresses
      if (hostname.startsWith('fe80:') || hostname.startsWith('[fe80:') ||
          hostname.startsWith('fc') || hostname.startsWith('[fc') ||
          hostname.startsWith('fd') || hostname.startsWith('[fd')) {
        return false;
      }
      // Block private IPv4 ranges
      const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ipv4Match) {
        const [, a, b, c, d] = ipv4Match.map(Number);
        // 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x (link-local)
        if (a === 10 || (a === 172 && b >= 16 && b <= 31) || 
            (a === 192 && b === 168) || (a === 169 && b === 254)) {
          return false;
        }
        // Block loopback range 127.x.x.x
        if (a === 127) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  // Helper to verify project access
  const verifyProjectAccess = async (projectId: string, user: any): Promise<boolean> => {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    // Admin can access all projects in their org, or published projects
    if (user.role === 'admin') return true;
    return project.organizationId === user.organizationId;
  };

  // Data source validation schema - strict to reject unknown keys
  const dataSourceSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(500).nullable().optional(),
    endpointUrl: z.string().url("Invalid URL format"),
    authType: z.enum(["none", "bearer", "basic", "api_key"]).default("bearer"),
    authToken: z.string().max(2000).nullable().optional(),
    authHeader: z.string().max(100).nullable().optional(),
    headers: z.record(z.string()).nullable().optional(),
    queryParams: z.record(z.string()).nullable().optional()
  }).strict();
  
  // Update schema - explicitly whitelist allowed fields to prevent projectId injection
  const dataSourceUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).nullable().optional(),
    endpointUrl: z.string().url().optional(),
    authType: z.enum(["none", "bearer", "basic", "api_key"]).optional(),
    authToken: z.string().max(2000).nullable().optional(),
    authHeader: z.string().max(100).nullable().optional(),
    headers: z.record(z.string()).nullable().optional(),
    queryParams: z.record(z.string()).nullable().optional(),
    isActive: z.boolean().optional()
  }).strict();

  app.get("/api/projects/:projectId/data-sources", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      
      // Verify user has access to project
      if (!await verifyProjectAccess(projectId, req.user)) {
        return res.status(403).json({ message: "Access denied to this project" });
      }
      
      const dataSources = await storage.getApiDataSources(projectId);
      res.json(dataSources);
    } catch (error) {
      console.error("Error getting data sources:", error);
      res.status(500).json({ message: "Failed to get data sources" });
    }
  });

  app.post("/api/projects/:projectId/data-sources", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      
      // Verify user has access to project
      if (!await verifyProjectAccess(projectId, req.user)) {
        return res.status(403).json({ message: "Access denied to this project" });
      }
      
      // Validate input
      const result = dataSourceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid data", errors: result.error.errors });
      }
      
      const { name, description, endpointUrl, authType, authToken, authHeader, headers, queryParams } = result.data;
      
      // SSRF protection
      if (!isUrlSafe(endpointUrl)) {
        return res.status(400).json({ message: "Invalid endpoint URL. Must be a valid HTTPS URL to an external host." });
      }
      
      const dataSource = await storage.createApiDataSource({
        projectId,
        name,
        description: description || null,
        endpointUrl,
        authType,
        authToken: authToken || null,
        authHeader: authHeader || null,
        headers: headers || null,
        queryParams: queryParams || null,
        isActive: true
      });
      
      res.status(201).json(dataSource);
    } catch (error) {
      console.error("Error creating data source:", error);
      res.status(500).json({ message: "Failed to create data source" });
    }
  });

  app.patch("/api/data-sources/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Get existing data source and verify access
      const existing = await storage.getApiDataSource(id);
      if (!existing) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      if (!await verifyProjectAccess(existing.projectId, req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Validate allowed update fields only (projectId cannot be changed)
      const result = dataSourceUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid data", errors: result.error.errors });
      }
      
      // SSRF protection for URL updates
      if (result.data.endpointUrl && !isUrlSafe(result.data.endpointUrl)) {
        return res.status(400).json({ message: "Invalid endpoint URL" });
      }
      
      const dataSource = await storage.updateApiDataSource(id, result.data);
      res.json(dataSource);
    } catch (error) {
      console.error("Error updating data source:", error);
      res.status(500).json({ message: "Failed to update data source" });
    }
  });

  app.delete("/api/data-sources/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      // Get existing data source and verify access
      const existing = await storage.getApiDataSource(id);
      if (!existing) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      if (!await verifyProjectAccess(existing.projectId, req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteApiDataSource(id);
      if (!success) {
        return res.status(404).json({ message: "Data source not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting data source:", error);
      res.status(500).json({ message: "Failed to delete data source" });
    }
  });

  // Get a single data source by ID (metadata only)
  app.get("/api/data-sources/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      const dataSource = await storage.getApiDataSource(id);
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      if (!await verifyProjectAccess(dataSource.projectId, req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Return data source metadata (without cached data for performance)
      const { cachedData, ...metadata } = dataSource;
      res.json(metadata);
    } catch (error) {
      console.error("Error getting data source:", error);
      res.status(500).json({ message: "Failed to get data source" });
    }
  });

  // Get cached data from a data source
  app.get("/api/data-sources/:id/data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      const dataSource = await storage.getApiDataSource(id);
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      if (!await verifyProjectAccess(dataSource.projectId, req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Return cached data if available
      const cachedData = dataSource.cachedData || [];
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json(cachedData);
    } catch (error) {
      console.error("Error getting data source data:", error);
      res.status(500).json({ message: "Failed to get data source data" });
    }
  });

  // Update column mappings for a data source
  app.patch("/api/data-sources/:id/column-mappings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      const existing = await storage.getApiDataSource(id);
      if (!existing) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      if (!await verifyProjectAccess(existing.projectId, req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Validate column mappings - should be Record<string, string>
      const columnMappingsSchema = z.record(z.string(), z.string().max(200));
      const result = columnMappingsSchema.safeParse(req.body.columnMappings);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid column mappings", errors: result.error.errors });
      }
      
      const updated = await storage.updateApiDataSource(id, { 
        columnMappings: result.data 
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating column mappings:", error);
      res.status(500).json({ message: "Failed to update column mappings" });
    }
  });

  // Fetch data from API data source
  app.post("/api/data-sources/:id/fetch", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      
      const dataSource = await storage.getApiDataSource(id);
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      // Verify user has access to the project that owns this data source
      if (!await verifyProjectAccess(dataSource.projectId, req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // SSRF protection - verify URL is still safe
      if (!isUrlSafe(dataSource.endpointUrl)) {
        return res.status(400).json({ message: "Invalid endpoint URL configured" });
      }
      
      // Build headers
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(dataSource.headers as Record<string, string> || {})
      };
      
      // Add authentication
      if (dataSource.authType === 'bearer' && dataSource.authToken) {
        fetchHeaders['Authorization'] = `Bearer ${dataSource.authToken}`;
      } else if (dataSource.authType === 'api_key' && dataSource.authToken) {
        const headerName = dataSource.authHeader || 'X-API-Key';
        fetchHeaders[headerName] = dataSource.authToken;
      } else if (dataSource.authType === 'basic' && dataSource.authToken) {
        fetchHeaders['Authorization'] = `Basic ${Buffer.from(dataSource.authToken).toString('base64')}`;
      }
      
      // Build URL with query parameters
      let url = dataSource.endpointUrl;
      if (dataSource.queryParams && typeof dataSource.queryParams === 'object') {
        const params = new URLSearchParams(dataSource.queryParams as Record<string, string>);
        url += (url.includes('?') ? '&' : '?') + params.toString();
      }
      
      console.log(`Fetching data from: ${url}`);
      
      // Helper to extract data array from response (handles nested structures like data.entries)
      const extractDataArray = (data: any): any[] => {
        if (Array.isArray(data)) return data;
        if (typeof data === 'object' && data !== null) {
          const commonKeys = ['data', 'entries', 'items', 'results', 'records', 'rows'];
          // First level check
          for (const key of commonKeys) {
            if (data[key] && Array.isArray(data[key])) return data[key];
          }
          // Check nested: data.entries, data.items, etc (BRYTER uses data.entries)
          if (data.data && typeof data.data === 'object') {
            for (const key of commonKeys) {
              if (data.data[key] && Array.isArray(data.data[key])) {
                console.log(`   ✅ Extracting from nested path: data.${key}`);
                return data.data[key];
              }
            }
          }
        }
        return [];
      };
      
      // Fetch with pagination support - BRYTER API style
      let allData: any[] = [];
      let pageCount = 0;
      const MAX_PAGES = 3; // Fetch up to 3 pages
      const ENTRIES_PER_PAGE = 10000; // Max entries per page for BRYTER
      
      console.log(`🔄 Starting paginated fetch from data source (max ${MAX_PAGES} pages, ${ENTRIES_PER_PAGE} entries/page)...`);
      
      while (pageCount < MAX_PAGES) {
        pageCount++;
        
        // Build URL with BRYTER pagination params - use base endpoint directly
        const baseUrl = dataSource.endpointUrl;
        const separator = baseUrl.includes('?') ? '&' : '?';
        const fetchUrl = `${baseUrl}${separator}page=${pageCount}&entriesPerPage=${ENTRIES_PER_PAGE}`;
        
        console.log(`   📄 Fetching page ${pageCount}: ${fetchUrl}`);
        
        const response = await fetch(fetchUrl, {
          method: 'GET',
          headers: fetchHeaders
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          await storage.updateApiDataSource(id, {
            lastFetchedAt: new Date(),
            lastFetchStatus: 'error',
            lastFetchError: `HTTP ${response.status}: ${errorText.substring(0, 500)}`
          });
          return res.status(response.status).json({ 
            message: "Failed to fetch from API", 
            error: errorText 
          });
        }
        
        const pageData = await response.json();
        
        // Debug: Log raw response structure
        console.log(`   🔍 Raw response type: ${typeof pageData}, isArray: ${Array.isArray(pageData)}`);
        if (typeof pageData === 'object' && !Array.isArray(pageData)) {
          console.log(`   🔍 Response keys: ${Object.keys(pageData).join(', ')}`);
          // Log the data key specifically
          if (pageData.data) {
            console.log(`   🔍 data key: isArray=${Array.isArray(pageData.data)}, type=${typeof pageData.data}`);
            if (!Array.isArray(pageData.data) && typeof pageData.data === 'object') {
              console.log(`   🔍 data object keys: ${Object.keys(pageData.data).join(', ')}`);
              // Check common nested array keys
              const nestedKeys = ['entries', 'items', 'records', 'rows', 'results'];
              for (const key of nestedKeys) {
                if (pageData.data[key] && Array.isArray(pageData.data[key])) {
                  console.log(`   🔍 Found nested array: data.${key} with ${pageData.data[key].length} items`);
                }
              }
            } else if (Array.isArray(pageData.data) && pageData.data.length > 0) {
              console.log(`   🔍 data array length: ${pageData.data.length}`);
            }
          }
          // Log pageInfo for pagination debugging
          if (pageData.pageInfo) {
            console.log(`   🔍 pageInfo: ${JSON.stringify(pageData.pageInfo)}`);
          }
        }
        
        const pageRecords = extractDataArray(pageData);
        
        console.log(`   📊 Page ${pageCount} returned ${pageRecords.length} records`);
        
        if (pageRecords.length === 0) {
          console.log(`   ✅ No more records, stopping pagination`);
          break;
        }
        
        allData = allData.concat(pageRecords);
        
        // If we got fewer records than requested, we've reached the end
        if (pageRecords.length < ENTRIES_PER_PAGE) {
          console.log(`   ✅ Last page reached (${pageRecords.length} < ${ENTRIES_PER_PAGE})`);
          break;
        }
      }
      
      console.log(`✅ Pagination complete: ${pageCount} pages, ${allData.length} total records`);
      
      // Cache the combined data
      await storage.updateApiDataSource(id, {
        lastFetchedAt: new Date(),
        lastFetchStatus: 'success',
        lastFetchError: null,
        cachedData: allData
      });
      
      res.json({ success: true, data: allData, totalRecords: allData.length, pagesFetched: pageCount });
    } catch (error: any) {
      console.error("Error fetching from data source:", error);
      
      const { id } = req.params;
      await storage.updateApiDataSource(id, {
        lastFetchedAt: new Date(),
        lastFetchStatus: 'error',
        lastFetchError: error.message || 'Unknown error'
      });
      
      res.status(500).json({ message: "Failed to fetch data", error: error.message });
    }
  });

  // Dashboard Statistics
  app.get("/api/dashboard/statistics", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get all projects accessible to the user (tenant-isolated)
      const projects = await storage.getProjects(req.user!.organizationId, req.user!.role);
      
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

  app.get("/api/sessions/:sessionId/source-email", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const sourceEmail = await storage.getSourceEmail(sessionId);
      if (!sourceEmail) {
        return res.status(404).json({ message: "No source email found for this session" });
      }
      res.json(sourceEmail);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch source email" });
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

      // Build Excel data structure with workflow steps
      const excelData: any = {
        projectName: project.name,
        sessionName: session.sessionName,
        workflowSteps: [],
        collections: {} // Keep this for backward compatibility
      };

      // Process workflow steps for proper Excel export
      const workflowSteps = project.workflowSteps || [];
      console.log(`Processing ${workflowSteps.length} workflow steps`);

      // Process each workflow step
      for (const step of workflowSteps) {
        console.log(`Processing step: ${step.stepName} (${step.stepType})`);
        console.log(`Step has ${step.values?.length || 0} values`);
        const stepData: any = {
          stepName: step.stepName,
          stepType: step.stepType,
          data: null
        };

        if (step.stepType === 'info' || step.stepType === 'page') {
          // Info page format: field names as rows, values in adjacent column
          const infoData: any[] = [];
          
          if (step.values) {
            for (const value of step.values) {
              // Find validation for this value - use valueId for new architecture
              const validation = allValidations.find(v => v.valueId === value.id || v.fieldId === value.id);
              infoData.push({
                fieldName: value.valueName || 'Unknown Field',
                value: validation?.extractedValue || ''
              });
            }
          }
          
          stepData.data = infoData;
        } else if (step.stepType === 'data' || step.stepType === 'list') {
          // Data table format: normal table with headers
          const stepValues = step.values || [];
          
          // Get all column names (value names)
          const headers = stepValues.map(v => v.valueName || 'Unknown');
          
          // Group validations by identifierId for proper row grouping
          const identifierMap = new Map<string, any>();
          
          for (const value of stepValues) {
            // Find all validations for this value (across all records) - use valueId for new architecture
            const valueValidations = allValidations.filter(v => v.valueId === value.id || v.fieldId === value.id);
            
            for (const validation of valueValidations) {
              const identifierId = validation.identifierId || `record_${validation.recordIndex ?? 0}`;
              
              if (!identifierMap.has(identifierId)) {
                identifierMap.set(identifierId, { 'Identifier': identifierId });
              }
              
              // Preserve "Not Found" values and other extracted values
              const extractedValue = validation.extractedValue;
              identifierMap.get(identifierId)[value.valueName || 'Unknown'] = 
                extractedValue === null || extractedValue === undefined || extractedValue === '' 
                  ? 'Not Found' 
                  : extractedValue;
            }
          }
          
          // Add Identifier as first column
          const fullHeaders = ['Identifier', ...headers];
          
          // Convert to array format
          const records = Array.from(identifierMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([identifierId, record]) => {
              return fullHeaders.map(header => record[header] || 'Not Found');
            });
          
          stepData.data = {
            headers: fullHeaders,
            records: records
          };
        }
        
        // Only add steps that have data
        if (stepData.data && (step.stepType === 'info' || step.stepType === 'data' || step.stepType === 'page' || step.stepType === 'list')) {
          excelData.workflowSteps.push(stepData);
        }
      }

      // Remove old collection-based logic (replaced with workflow steps)
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

  // Extract document content for validation (doesn't persist the document)
  const validationUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  app.post("/api/extract-document-content", authenticateToken, validationUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }
      
      const fileBuffer = file.buffer;
      const fileName = file.originalname;
      const mimeType = file.mimetype;
      
      // Use Python document extractor to get content
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['services/document_extractor.py'], {
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Send file data to Python process in the expected format
      const inputData = {
        step: 'extract_text_only',
        documents: [{
          file_name: fileName,
          file_content: fileBuffer.toString('base64'),
          mime_type: mimeType
        }]
      };
      
      pythonProcess.stdin.write(JSON.stringify(inputData));
      pythonProcess.stdin.end();
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        pythonProcess.kill();
      }, 30000); // 30 second timeout
      
      await new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Extraction failed with code ${code}: ${stderr}`));
          }
        });
        pythonProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success && result.extracted_texts && result.extracted_texts.length > 0) {
          const textContent = result.extracted_texts[0].text_content || '';
          res.json({ content: textContent });
        } else {
          res.json({ content: '' });
        }
      } catch (e) {
        console.error('Failed to parse extraction result:', e, 'stdout:', stdout);
        res.status(500).json({ message: "Failed to parse extraction result" });
      }
      
    } catch (error) {
      console.error("Document content extraction error:", error);
      res.status(500).json({ message: "Failed to extract document content" });
    }
  });

  // Validate document against document type description using AI
  app.post("/api/validate-document", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { documentContent, documentTypeName, documentTypeDescription, fileName } = req.body;
      
      if (!documentContent || !documentTypeName || !documentTypeDescription) {
        return res.status(400).json({ 
          message: "Missing required fields: documentContent, documentTypeName, documentTypeDescription" 
        });
      }
      
      // Use Python with Gemini to validate document
      const pythonScript = `
import sys
import os
import json

try:
    from google import genai
    from google.genai import types
except ImportError:
    print(json.dumps({"error": "google-genai package not installed"}))
    sys.exit(1)

api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print(json.dumps({"error": "API key not found"}))
    sys.exit(1)

client = genai.Client(api_key=api_key)

document_content = '''${documentContent.replace(/'/g, "\\'")}'''
document_type_name = '''${documentTypeName.replace(/'/g, "\\'")}'''
document_type_description = '''${documentTypeDescription.replace(/'/g, "\\'")}'''
file_name = '''${(fileName || 'document').replace(/'/g, "\\'")}'''

prompt = f"""You are a document validation assistant. Analyze the uploaded document and determine if it matches the expected document type.

EXPECTED DOCUMENT TYPE: {document_type_name}
EXPECTED DESCRIPTION: {document_type_description}

UPLOADED DOCUMENT CONTENT (first 5000 chars):
{document_content[:5000]}

TASK:
1. Analyze if the uploaded document matches the expected document type based on the description
2. Consider: content structure, key information present, document purpose

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this document matches or doesn't match",
  "missingElements": ["list of required elements that are missing, if any"],
  "guidance": "If not valid: specific guidance on what document is needed. If valid: leave empty"
}}
"""

try:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2
        )
    )
    
    result_text = response.text.strip()
    result = json.loads(result_text)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "isValid": False,
        "confidence": 0,
        "reasoning": f"Validation error: {str(e)}",
        "missingElements": [],
        "guidance": "Could not validate document. Please try again."
    }))
`;

      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const pythonProcess = spawn('python3', ['-c', pythonScript]);
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          try {
            const result = JSON.parse(stdout.trim());
            res.json(result);
          } catch (e) {
            console.error('Document validation parse error:', e, 'stdout:', stdout, 'stderr:', stderr);
            res.json({
              isValid: false,
              confidence: 0,
              reasoning: "Unable to validate document",
              missingElements: [],
              guidance: "Please ensure the document matches the required format."
            });
          }
          resolve(undefined);
        });
        
        pythonProcess.on('error', (error) => {
          console.error('Document validation process error:', error);
          res.json({
            isValid: false,
            confidence: 0,
            reasoning: "Validation service unavailable",
            missingElements: [],
            guidance: "Please try again later."
          });
          resolve(undefined);
        });
      });
      
    } catch (error) {
      console.error("Document validation error:", error);
      res.status(500).json({ 
        isValid: false,
        confidence: 0,
        reasoning: "Server error during validation",
        missingElements: [],
        guidance: "Please try again."
      });
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

  // Upload a document to a session (FormData upload)
  const sessionDocUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  app.post("/api/sessions/:sessionId/documents", authenticateToken, sessionDocUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      const sessionId = req.params.sessionId;
      const documentTypeId = req.body.documentTypeId;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }
      
      // Extract text from the document using Python extractor
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['services/document_extractor.py'], {
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const inputData = {
        step: 'extract_text_only',
        documents: [{
          file_name: file.originalname,
          file_content: file.buffer.toString('base64'),
          mime_type: file.mimetype
        }]
      };
      
      pythonProcess.stdin.write(JSON.stringify(inputData));
      pythonProcess.stdin.end();
      
      const timeout = setTimeout(() => {
        pythonProcess.kill();
      }, 30000);
      
      await new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Extraction failed: ${stderr}`));
          }
        });
        pythonProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      let extractedText = '';
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success && result.extracted_texts && result.extracted_texts.length > 0) {
          extractedText = result.extracted_texts[0].text_content || '';
        }
      } catch (e) {
        console.error('Failed to parse extraction result:', e);
      }
      
      // Save the document to the database
      const document = await storage.createSessionDocument({
        sessionId,
        fileName: file.originalname,
        extractedContent: extractedText,
        documentTypeId: documentTypeId || null
      });
      
      res.json(document);
    } catch (error) {
      console.error("Upload session document error:", error);
      res.status(500).json({ message: "Failed to upload document" });
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

  app.post("/api/sessions/documents/:documentId/process", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = req.params.documentId;
      const [doc] = await db.select().from(sessionDocuments).where(eq(sessionDocuments.id, documentId)).limit(1);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadDir = path.join(process.cwd(), 'uploads', doc.sessionId);
      const files = await fs.readdir(uploadDir).catch(() => [] as string[]);
      const matchingFile = files.find(f => f.includes(doc.fileName.replace(/[^\w\s.-]/g, '_')) || f.endsWith('_' + doc.fileName));
      
      if (!matchingFile) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      const filePath = path.join(uploadDir, matchingFile);
      const fileData = await fs.readFile(filePath);
      const base64Content = fileData.toString('base64');
      const mimeType = doc.mimeType || 'application/octet-stream';

      const extractionData = {
        step: "extract_text_only",
        documents: [{ file_name: doc.fileName, file_content: base64Content, mime_type: mimeType }]
      };

      const osMod = await import('os');
      const tmpFile = path.join(osMod.tmpdir(), `extract_${crypto.randomUUID()}.json`);
      await fs.writeFile(tmpFile, JSON.stringify(extractionData));

      const fsSync = await import('fs');
      const extractedContent = await new Promise<string>((resolve) => {
        const python = spawn('python3', ['services/document_extractor.py'], { env: { ...process.env } });
        const timeout = setTimeout(() => { python.kill(); console.log(`Process timeout for ${doc.fileName}`); resolve(''); }, 120000);
        
        const inputStream = fsSync.createReadStream(tmpFile);
        inputStream.pipe(python.stdin);
        
        let output = '';
        let stderr = '';
        python.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
        python.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
        python.on('close', async (code: number | null) => {
          clearTimeout(timeout);
          try { await fs.unlink(tmpFile); } catch {}
          if (stderr) console.log(`Process stderr for ${doc.fileName}: ${stderr}`);
          if (code === 0) {
            try {
              const result = JSON.parse(output);
              const text = result.extracted_texts?.[0]?.text_content || '';
              resolve(text);
            } catch { resolve(''); }
          } else { resolve(''); }
        });
        python.on('error', (err: Error) => { clearTimeout(timeout); fs.unlink(tmpFile).catch(() => {}); resolve(''); });
      });

      if (extractedContent.length > 0) {
        await storage.updateSessionDocument(documentId, { extractedContent });
        res.json({ message: "Document processed successfully", contentLength: extractedContent.length });
      } else {
        res.status(422).json({ message: "Could not extract content from this document" });
      }
    } catch (error) {
      console.error("Process document error:", error);
      res.status(500).json({ message: "Failed to process document" });
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
      
      if ((session as any).workflowStatus) {
        try {
          await storage.createWorkflowStatusHistory({
            sessionId: session.id,
            projectId: session.projectId,
            fromStatus: null,
            toStatus: (session as any).workflowStatus,
          });
        } catch (e) { console.error("Error recording initial workflow status:", e); }
      }
      
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
      
      if ((session as any).workflowStatus) {
        try {
          await storage.createWorkflowStatusHistory({
            sessionId: session.id,
            projectId: session.projectId,
            fromStatus: null,
            toStatus: (session as any).workflowStatus,
          });
        } catch (e) { console.error("Error recording initial workflow status:", e); }
      }
      
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

  // Mark session as viewed
  app.post("/api/sessions/:id/mark-viewed", async (req, res) => {
    try {
      const id = req.params.id;
      const session = await storage.updateExtractionSession(id, { isViewed: true });
      if (!session) {
        return res.status(404).json({ message: "Extraction session not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark session as viewed" });
    }
  });

  // Update session workflow status
  app.patch("/api/sessions/:id/workflow-status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { workflowStatus } = req.body;
      
      if (!workflowStatus) {
        return res.status(400).json({ message: "workflowStatus is required" });
      }
      
      const existingSession = await storage.getExtractionSession(id);
      const fromStatus = existingSession ? (existingSession as any).workflowStatus : null;
      
      const session = await storage.updateExtractionSession(id, { workflowStatus });
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (fromStatus !== workflowStatus) {
        try {
          await storage.createWorkflowStatusHistory({
            sessionId: id,
            projectId: session.projectId,
            fromStatus,
            toStatus: workflowStatus,
          });
        } catch (e) {
          console.error("Error recording workflow status history:", e);
        }
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating session workflow status:", error);
      res.status(500).json({ message: "Failed to update workflow status" });
    }
  });

  // Get workflow status history for a project
  app.get("/api/projects/:projectId/workflow-status-history", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const history = await storage.getWorkflowStatusHistory(projectId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching workflow status history:", error);
      res.status(500).json({ message: "Failed to fetch workflow status history" });
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
      const { files, project_data, is_workflow_step, step_id, value_id, target_fields, documentId } = req.body;
      
      const projectId = project_data?.projectId || project_data?.id;
      console.log(`STEP 1 EXTRACT: Starting extraction for session ${sessionId}`);
      console.log(`   Document ID provided: ${documentId || 'none'}`);
      
      // Validate that we have a valid project ID
      if (!projectId) {
        return res.status(400).json({ 
          success: false, 
          message: "Project ID is required for extraction" 
        });
      }
      
      let convertedFiles = [];
      
      // HANDLE DOCUMENT ID - SAME AS DATA TABLE EXTRACTION
      if (documentId) {
        console.log(`📄 Looking up document ${documentId} from session documents`);
        const sessionDocuments = await storage.getSessionDocuments(sessionId);
        const documentToUse = sessionDocuments.find(d => d.id === documentId);
        
        if (documentToUse) {
          const documentContent = documentToUse.extractedContent || documentToUse.documentContent || '';
          console.log(`✅ Found document: ${documentToUse.fileName || documentToUse.documentName}, content length: ${documentContent.length}`);
          
          convertedFiles = [{
            file_name: documentToUse.fileName || documentToUse.documentName || 'document',
            file_content: documentContent,
            mime_type: documentToUse.fileType || documentToUse.documentType || 'text/plain'
          }];
        } else {
          console.log(`⚠️ Document ${documentId} not found in session documents`);
        }
      } else if (files && files.length > 0) {
        // Convert frontend file format to Python script expected format
        convertedFiles = (files || []).map((file: any) => ({
          file_name: file.name,
          file_content: file.content, // This is the data URL from FileReader
          mime_type: file.type
        }));
      }

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

      // Check if this is a workflow step with a tool assigned
      let shouldUseToolEngine = false;
      let workflowValue: any = null;
      
      console.log(`🔍 /extract endpoint - Checking tool assignment conditions:`);
      console.log(`   is_workflow_step: ${is_workflow_step}`);
      console.log(`   step_id: ${step_id}`);
      console.log(`   value_id: ${value_id}`);
      
      if (is_workflow_step && step_id && value_id) {
        // Get the workflow step and value details to check for tool assignment
        const workflowStep = project_data?.workflowSteps?.find((s: any) => s.id === step_id);
        console.log(`   workflowStep found: ${!!workflowStep}`);
        
        workflowValue = workflowStep?.values?.find((v: any) => v.id === value_id);
        console.log(`   workflowValue found: ${!!workflowValue}`);
        console.log(`   workflowValue.toolId: ${workflowValue?.toolId || 'NOT SET'}`);
        
        // If workflowValue not found in project_data, fetch from database directly
        if (!workflowValue || !workflowValue.toolId) {
          console.log(`   ⚠️ WorkflowValue not found in project_data, fetching from database...`);
          const dbWorkflowValue = await storage.getStepValue(value_id);
          if (dbWorkflowValue) {
            workflowValue = dbWorkflowValue;
            console.log(`   ✅ Found workflowValue in database: ${workflowValue.valueName}`);
            console.log(`   ✅ Database toolId: ${workflowValue.toolId}`);
            console.log(`   ✅ Database inputValues:`, JSON.stringify(workflowValue.inputValues || {}).substring(0, 200));
          }
        }
        
        if (workflowValue?.toolId) {
          console.log(`🎯 TOOL DETECTED for workflow value: ${workflowValue.valueName}`);
          console.log(`   Tool ID: ${workflowValue.toolId}`);
          console.log(`   Step Type: ${workflowStep?.stepType || 'unknown'}`);
          console.log(`   Is Info Page: ${workflowStep?.stepType === 'info_page'}`);
          shouldUseToolEngine = true;
        }
      }

      // Handle workflow step extraction differently
      let projectSchema;
      if (is_workflow_step && target_fields && target_fields.length > 0) {
        console.log(`WORKFLOW STEP EXTRACTION: Processing step ${step_id}, value ${value_id}`);
        console.log(`WORKFLOW STEP: Target fields:`, target_fields.map((f: any) => f.propertyName || f.fieldName || f.valueName));
        
        // For workflow steps, use only the specific target fields passed
        const workflowSchemaFields = target_fields.filter((f: any) => f.fieldName);
        const workflowCollections = target_fields.filter((f: any) => f.collectionId).map((f: any) => ({
          id: f.collectionId,
          collectionName: f.collectionName || 'Column Name Mapping',
          properties: [f]
        }));
        
        projectSchema = {
          schema_fields: workflowSchemaFields,
          collections: workflowCollections
        };
      } else {
        projectSchema = {
          schema_fields: project_data?.schemaFields || [],
          collections: project_data?.collections || []
        };
      }

      // Prepare data for Python extraction script
      const extractionData = {
        step: "extract",
        session_id: sessionId,
        files: convertedFiles,
        project_schema: projectSchema,
        extraction_rules: extractionRules,
        knowledge_documents: knowledgeDocuments,
        session_name: project_data?.mainObjectName || "contract",
        validated_data_context: verifiedDataContext,
        is_subsequent_upload: Object.keys(verifiedDataContext).length > 0,
        is_workflow_step: is_workflow_step || false,
        step_id: step_id,
        value_id: value_id
      };
      
      console.log(`STEP 1: Extracting from ${files?.length || 0} documents with ${extractionRules.length} extraction rules`);
      
      // Classify extraction task: Excel Column Extraction vs Current AI Extraction
      const collections = is_workflow_step ? projectSchema.collections : (project_data?.collections || []);
      const schemaFields = is_workflow_step ? projectSchema.schema_fields : (project_data?.schemaFields || []);
      const targetCollections = collections.map((c: any) => c.collectionName || c.name);
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
        // Calculate from existing validations instead of using non-existent method
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
      
      // Use tool engine if a tool is assigned to the workflow value
      if (shouldUseToolEngine && workflowValue) {
        console.log('🚀 USING TOOL ENGINE FOR WORKFLOW VALUE WITH ASSIGNED TOOL');
        console.log(`🚀 Value: ${workflowValue.valueName}, Tool ID: ${workflowValue.toolId}`);
        
        // Get the tool details
        const tool = await storage.getExcelWizardryFunction(workflowValue.toolId);
        if (!tool) {
          console.error(`Tool ${workflowValue.toolId} not found`);
          return res.status(404).json({ 
            success: false, 
            error: `Tool ${workflowValue.toolId} not found` 
          });
        }
        
        console.log(`🎯 Using tool: ${tool.name} (type: ${tool.toolType})`);
        
        // For AI_ONLY tools, automatically infer operationType from step context
        if (tool.toolType === 'AI_ONLY') {
          // Get authoritative step data from DB if not in project_data
          let workflowStep = project_data?.workflowSteps?.find((s: any) => s.id === step_id);
          let stepType = workflowStep?.stepType;
          
          if (!stepType && step_id) {
            const dbStep = await storage.getWorkflowStep(step_id);
            if (dbStep) {
              stepType = dbStep.stepType;
              console.log(`🔄 Loaded step type from DB: ${stepType}`);
            }
          }
          
          // Check if this is the identifier (first) value
          let isIdentifierValue = workflowValue?.isIdentifier === true;
          if (!isIdentifierValue && value_id) {
            const dbValue = await storage.getStepValue(value_id);
            if (dbValue) {
              isIdentifierValue = dbValue.isIdentifier === true || 
                (dbValue.orderIndex === 0 && stepType === 'data_table');
            }
          }
          
          let inferredOperationType: string;
          if (stepType === 'info_page' || stepType === 'kanban') {
            inferredOperationType = 'updateSingle';
            console.log(`🔄 AI tool operationType inferred as updateSingle (${stepType} step)`);
          } else if (isIdentifierValue) {
            inferredOperationType = 'createMultiple';
            console.log(`🔄 AI tool operationType inferred as createMultiple (identifier column in data table)`);
          } else {
            inferredOperationType = 'updateMultiple';
            console.log(`🔄 AI tool operationType inferred as updateMultiple (subsequent column in data table)`);
          }
          
          console.log(`🔄 Overriding tool operationType from "${tool.operationType}" to "${inferredOperationType}"`);
          (tool as any).operationType = inferredOperationType;
        }
        
        // Import tool engine to execute the tool
        const { toolEngine } = await import('./toolEngine');
        
        // Prepare inputs for the tool
        const toolInputs: Record<string, any> = {};
        
        // Get documents - either from request or from session storage
        let documentsForExtraction = convertedFiles;
        if ((!documentsForExtraction || documentsForExtraction.length === 0) && sessionId) {
          // Try to get documents from session storage
          console.log('📄 No documents in request, fetching from session storage');
          const sessionDocs = await storage.getSessionDocuments(sessionId);
          if (sessionDocs && sessionDocs.length > 0) {
            documentsForExtraction = sessionDocs.map(doc => ({
              file_name: doc.documentName,
              file_content: doc.extractedContent || '',
              mime_type: doc.documentType
            }));
            console.log(`📄 Retrieved ${documentsForExtraction.length} documents from session`);
          }
        }
        
        // For Info Page multi-field extraction, add the field definitions
        // See replit.md Section 3: Multi-Field vs Single-Field Extraction
        // CRITICAL: __infoPageFields metadata must be preserved through entire extraction pipeline
        if (target_fields && target_fields.length > 0) {
          console.log('📋 Adding multi-field definitions for Info Page extraction');
          toolInputs.__infoPageFields = target_fields.map((f: any) => ({
            name: f.fieldName || f.valueName,
            dataType: f.dataType || 'TEXT',
            description: f.description || ''
          }));
          console.log('📋 Multi-field definitions:', toolInputs.__infoPageFields);
        }
        
        // Build combined document content from ALL selected documents
        let combinedDocumentContent = '';
        if (documentsForExtraction && documentsForExtraction.length > 0) {
          console.log(`📄 Combining content from ${documentsForExtraction.length} selected document(s)`);
          combinedDocumentContent = documentsForExtraction
            .map((doc, index) => {
              const docContent = doc.file_content || '';
              if (documentsForExtraction.length > 1) {
                return `=== Document ${index + 1}: ${doc.file_name} ===\n${docContent}`;
              }
              return docContent;
            })
            .join('\n\n');
          console.log(`📄 Combined document content: ${combinedDocumentContent.length} chars from ${documentsForExtraction.length} document(s)`);
        }
        
        // Add document content if needed
        if (tool.inputParameters?.some((p: any) => p.type === 'document')) {
          console.log('📄 Tool requires document content');
          if (combinedDocumentContent) {
            toolInputs['document'] = combinedDocumentContent;
            toolInputs['Document'] = combinedDocumentContent;
            toolInputs.sessionDocumentContent = combinedDocumentContent;
            console.log(`📄 Added document content (${combinedDocumentContent.length} chars) to document, Document, and sessionDocumentContent`);
          }
        }
        
        // CRITICAL: Always set sessionDocumentContent for user_document placeholder resolution
        if (combinedDocumentContent) {
          toolInputs.sessionDocumentContent = combinedDocumentContent;
          console.log(`📄 Set sessionDocumentContent for user_document placeholder resolution (${combinedDocumentContent.length} chars)`);
        }
        
        // Process configured input values
        console.log(`🔍 DEBUG /extract - workflowValue.inputValues exists: ${!!workflowValue.inputValues}`);
        console.log(`🔍 DEBUG /extract - workflowValue.inputValues:`, JSON.stringify(workflowValue.inputValues, null, 2));
        
        if (workflowValue.inputValues) {
          // First, get existing validations for reference resolution
          const existingValidations = sessionId ? await storage.getFieldValidations(sessionId) : [];
          console.log(`📊 Retrieved ${existingValidations.length} existing validations for reference resolution`);
          
          for (const [key, value] of Object.entries(workflowValue.inputValues)) {
            console.log(`🔍 DEBUG - Processing inputValue key: ${key}, type: ${typeof value}, isArray: ${Array.isArray(value)}, value: ${JSON.stringify(value).substring(0, 200)}`);

            if (typeof value === 'string' && value === '@user_document') {
              // Replace @user_document with combined document content from ALL selected documents
              if (combinedDocumentContent) {
                toolInputs[key] = combinedDocumentContent;
                console.log(`📄 Replaced @user_document for ${key} with combined content (${combinedDocumentContent.length} chars)`);
              }
            } else if (typeof value === 'string' && !value.startsWith('@')) {
              // Add literal string values
              toolInputs[key] = value;
            } else if (Array.isArray(value)) {
              // Handle array of references (UUIDs pointing to step values)
              console.log(`📊 Processing array input for ${key} with ${value.length} items`);
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              
              // Check if array contains UUIDs (references to step values)
              const uuidReferences = value.filter((item: any) => 
                typeof item === 'string' && uuidRegex.test(item)
              );
              const hasUuidReferences = uuidReferences.length > 0;
              
              console.log(`📊 Found ${uuidReferences.length} UUID references in ${key}`);
              console.log(`📊 existingValidations.length: ${existingValidations.length}`);
              
              if (hasUuidReferences) {
                console.log(`📊 Resolving UUID references in ${key}`);
                
                // Get step values for these UUIDs - store the UUID with the result
                const resolvedValuesWithUuids = await Promise.all(
                  uuidReferences.map(async (uuid: string) => {
                    const stepValue = await storage.getStepValueById(uuid);
                    return stepValue ? { ...stepValue, id: uuid } : null;
                  })
                );
                
                console.log(`📊 Resolved ${resolvedValuesWithUuids.filter(v => v !== null).length} step values`);
                
                // Group validations by identifierId to build row-based data
                const validationsByIdentifier = new Map<string, any>();
                
                for (const stepValue of resolvedValuesWithUuids) {
                  if (!stepValue) continue;
                  
                  console.log(`📊 Found step value: ${stepValue.valueName} (ID: ${stepValue.id})`);
                  
                  // Get validations for this step value - match by valueId
                  const valueValidations = existingValidations.filter((v: any) => 
                    v.valueId === stepValue.id
                  );
                  
                  console.log(`📊 Found ${valueValidations.length} validations for ${stepValue.valueName}`);
                  
                  // Add each validation to the appropriate identifier record
                  for (const validation of valueValidations) {
                    const identifierId = validation.identifierId || `record-${validation.recordIndex}`;
                    
                    if (!validationsByIdentifier.has(identifierId)) {
                      validationsByIdentifier.set(identifierId, { identifierId });
                    }
                    
                    // Add this column's value to the record
                    validationsByIdentifier.get(identifierId)[stepValue.valueName] = validation.extractedValue || '';
                  }
                }
                
                // Convert map to array
                const resolvedData = Array.from(validationsByIdentifier.values());
                toolInputs[key] = resolvedData;
                
                console.log(`📊 Resolved ${key} to ${resolvedData.length} records with columns: ${resolvedData.length > 0 ? Object.keys(resolvedData[0]).join(', ') : 'none'}`);
                if (resolvedData.length > 0) {
                  console.log(`📊 Sample record:`, JSON.stringify(resolvedData[0]).substring(0, 200));
                }
                
                // If no data was resolved but we had UUID references, log warning
                if (resolvedData.length === 0) {
                  console.log(`⚠️ WARNING: UUID references found but no validations matched. This may indicate data is in a different session.`);
                  // Initialize empty array to avoid undefined
                  toolInputs[key] = [];
                }
              } else {
                // Pass array as-is if not UUID references
                toolInputs[key] = value;
              }
            }
          }
        }
        
        // Log what we're passing to the tool
        console.log(`📊 Target fields being passed to tool:`, JSON.stringify(target_fields, null, 2));
        
        // Resolve info page field references for database lookups
        // This handles references like "Claim Info.City" in _searchByColumns config
        const searchByColumns = (workflowValue.inputValues as any)?._searchByColumns;
        if (searchByColumns && Array.isArray(searchByColumns)) {
          const infoPageFieldValues: Record<string, string> = {};
          
          for (const config of searchByColumns) {
            const inputField = config.inputField;
            if (!inputField) continue;
            
            // Check for dot notation (ValueName.FieldName) or :: notation
            if (inputField.includes('.') || inputField.includes('::')) {
              let valueName: string, fieldName: string;
              
              if (inputField.includes('::')) {
                [valueName, fieldName] = inputField.split('::');
              } else {
                [valueName, fieldName] = inputField.split('.');
              }
              
              // Look up the value from existing validations
              const existingValidations = await storage.getFieldValidations(sessionId);
              
              // Find validation that matches this field
              for (const validation of existingValidations) {
                // Match by field name containing the field name (e.g., "Claim Info" step, "City" field)
                if (validation.fieldName?.includes(fieldName) || 
                    validation.identifierId?.includes(fieldName)) {
                  if (validation.extractedValue) {
                    infoPageFieldValues[inputField] = validation.extractedValue;
                    console.log(`🔗 Resolved info page field "${inputField}" → "${validation.extractedValue}"`);
                    break;
                  }
                }
              }
              
              // Also try to match by stepId and identifierId pattern
              if (!infoPageFieldValues[inputField]) {
                // Look for validations from info page steps
                const infoPageValidation = existingValidations.find(v => 
                  v.identifierId && v.identifierId.includes(fieldName) && v.extractedValue
                );
                if (infoPageValidation?.extractedValue) {
                  infoPageFieldValues[inputField] = infoPageValidation.extractedValue;
                  console.log(`🔗 Resolved info page field by pattern "${inputField}" → "${infoPageValidation.extractedValue}"`);
                }
              }
            }
          }
          
          // Pass resolved values to tool engine
          if (Object.keys(infoPageFieldValues).length > 0) {
            toolInputs.__infoPageFieldValues = infoPageFieldValues;
            console.log(`📋 Passing ${Object.keys(infoPageFieldValues).length} resolved info page field values`);
          }
        }
        
        // CRITICAL DEBUG: Log the actual toolInputs being passed to toolEngine
        console.log(`🚨 CRITICAL DEBUG - toolInputs before toolEngine call:`);
        for (const [key, value] of Object.entries(toolInputs)) {
          if (key.startsWith('__')) {
            console.log(`   ${key}: [${Array.isArray(value) ? value.length + ' items' : typeof value}]`);
          } else if (Array.isArray(value)) {
            console.log(`   ${key}: Array with ${value.length} items`);
            if (value.length > 0) {
              console.log(`     First item: ${JSON.stringify(value[0]).substring(0, 100)}`);
            }
          } else if (typeof value === 'string') {
            console.log(`   ${key}: String (${value.length} chars)`);
          } else {
            console.log(`   ${key}: ${typeof value}`);
          }
        }
        
        // Run the tool  
        const toolResults = await toolEngine.runToolForExtraction(
          workflowValue.toolId,
          toolInputs,
          sessionId,
          projectId,
          target_fields ? target_fields.map((f: any) => ({
            name: f.fieldName || f.valueName || f.name,
            dataType: f.dataType || 'TEXT',
            description: f.description || '',
            identifierId: f.identifierId  // Include identifierId for proper mapping
          })) : undefined
        );
        
        console.log(`🎯 Tool execution complete. Results:`, toolResults?.length || 0, 'items');
        console.log(`📊 Tool results:`, JSON.stringify(toolResults, null, 2));
        
        // Store the extraction results
        if (toolResults && Array.isArray(toolResults)) {
          // For Info Page multi-field extraction, each result corresponds to a field
          if (target_fields && target_fields.length > 0) {
            console.log(`📝 Saving ${toolResults.length} field results for Info Page`);
            console.log(`📊 Matching results to ${target_fields.length} target fields`);
            
            // Map results by identifierId for accurate field matching
            for (let i = 0; i < toolResults.length; i++) {
              const result = toolResults[i];
              console.log(`📊 Processing result ${i}:`, {
                extractedValue: result.extractedValue,
                identifierId: (result as any).identifierId
              });
              
              // Find the matching field by identifierId
              const field = target_fields.find((f: any) => 
                f.identifierId === result.identifierId || 
                f.identifierId === (result as any).identifierId
              );
              
              if (!field) {
                console.warn(`⚠️ Could not find field for identifierId: ${(result as any).identifierId}`);
                console.log(`📊 Available target field identifierIds:`, target_fields.map((f: any) => f.identifierId));
                continue;
              }
              
              console.log(`✅ Matched result to field:`, {
                fieldName: field.fieldName,
                fieldId: field.id || field.fieldId,
                identifierId: field.identifierId
              });
              
              // Create validation record for this field
              const validationRecord = {
                sessionId,
                projectId,
                fieldId: value_id || field.id || field.fieldId, // Use value_id for multi-field values
                fieldName: field.fieldName || field.valueName,
                extractedValue: result.extractedValue || '',
                validationStatus: result.validationStatus || 'pending',
                validationType: 'ai',
                dataType: field.dataType || 'TEXT',
                description: field.description || '',
                identifierId: field.identifierId,
                stepId: step_id,
                valueId: value_id,
                recordIndex: 0, // Info Page fields don't have record indices
                collectionName: null,
                documentSource: result.documentSource || '',
                aiReasoning: result.aiReasoning || '',
                confidenceScore: result.confidenceScore || 0,
                createdAt: new Date(),
                updatedAt: new Date()
              };
              
              console.log(`📝 Saving validation for field: ${field.fieldName || field.valueName} (ID: ${field.identifierId})`);
              
              // Use upsert pattern: try create, if duplicate exists then update
              try {
                await storage.createFieldValidation(validationRecord);
              } catch (err: any) {
                if (err.code === '23505') {
                  // Duplicate key - find existing record and update it
                  console.log(`⚠️ Validation already exists for field ${field.identifierId}, updating instead`);
                  const existingValidations = await storage.getFieldValidations(sessionId);
                  const existing = existingValidations.find(v => 
                    v.stepId === step_id && 
                    v.valueId === value_id && 
                    v.identifierId === field.identifierId
                  );
                  if (existing) {
                    await storage.updateFieldValidation(existing.id, {
                      extractedValue: validationRecord.extractedValue,
                      validationStatus: validationRecord.validationStatus as any,
                      aiReasoning: validationRecord.aiReasoning,
                      confidenceScore: validationRecord.confidenceScore,
                      documentSource: validationRecord.documentSource,
                      updatedAt: new Date()
                    });
                  }
                } else {
                  throw err; // Re-throw other errors
                }
              }
            }
          }
        }
        
        // Return success response
        return res.json({ 
          success: true,
          message: 'Extraction completed using tool engine',
          extractedCount: toolResults?.length || 0
        });
      }
      
      if (isExcelColumnExtraction && is_workflow_step && value_id) {
        console.log('🚀 USING TOOL ENGINE FOR WORKFLOW VALUE EXTRACTION');
        console.log('🚀 Step ID:', step_id);
        console.log('🚀 Value ID:', value_id);
        
        // Get the workflow step and value details
        const workflowStep = project_data?.workflowSteps?.find((s: any) => s.id === step_id);
        const workflowValue = workflowStep?.values?.find((v: any) => v.id === value_id);
        
        console.log('🚀 Workflow Value Name:', workflowValue?.valueName);
        console.log('🚀 Tool ID:', workflowValue?.toolId);
        
        if (workflowValue?.toolId) {
          console.log(`🎯 Using tool ${workflowValue.toolId} for value ${workflowValue.valueName}`);
          
          // Import tool engine to execute the tool
          const { runToolForExtraction } = await import('./toolEngine');
          
          // Prepare input for the tool based on inputValues configuration
          const toolInputs: Record<string, any> = {};
          
          // Process input values - replace @references and user_document placeholders
          if (workflowValue.inputValues) {
            console.log('📝 Processing input values for tool:', JSON.stringify(workflowValue.inputValues, null, 2));
            console.log('📝 Input value keys:', Object.keys(workflowValue.inputValues));
            
            // Check if tool needs document content (Excel file)
            const documentParam = tool.inputParameters?.find(p => 
              p.name === 'Excel File' || p.id === '0.my684050njo' || 
              p.name === 'document' || p.type === 'document'
            );
            
            if (documentParam) {
              console.log('📊 Tool requires document content');
              
              // Find Excel file in session documents
              const excelFile = convertedFiles.find((f: any) => 
                f.file_type?.includes('excel') || 
                f.file_type?.includes('spreadsheet') ||
                f.original_name?.endsWith('.xlsx') ||
                f.original_name?.endsWith('.xls')
              );
              
              if (excelFile) {
                console.log(`📊 Found Excel file: ${excelFile.original_name}`);
                // Set document content for various parameter names
                toolInputs['0.my684050njo'] = excelFile.file_content || '';
                toolInputs['Excel File'] = excelFile.file_content || '';
                toolInputs['document'] = excelFile.file_content || '';
                console.log(`📊 Set Excel file content (${excelFile.file_content?.length || 0} chars)`);
              } else {
                console.log('⚠️ No Excel file found in session documents');
                // Try to use any available document content
                if (convertedFiles.length > 0) {
                  toolInputs['0.my684050njo'] = convertedFiles[0].file_content || '';
                  toolInputs['Excel File'] = convertedFiles[0].file_content || '';
                  toolInputs['document'] = convertedFiles[0].file_content || '';
                  console.log('⚠️ Using first available document as fallback');
                }
              }
            }
            // For AI tools that need merged data from previous step values
            else if (tool.toolType === 'AI' || tool.toolType === 'AI_ONLY') {
              console.log('🔄 Building dynamic merged data for AI tool based on step values');
              
              // Get the current step to find all its values
              const stepId = workflowValue.stepId;
              if (stepId) {
                console.log(`📊 Getting step values for stepId: ${stepId}`);
                const stepValues = await storage.getStepValues(stepId);
                console.log(`📊 Found ${stepValues.length} values in this step:`, stepValues.map(v => v.valueName));
                
                // Import validation filter to check for validated previous step values
                const { filterRecordsWithAllPreviousValuesValidated } = await import('./validationFilter');
                
                // Get previous step IDs that this step depends on
                const allWorkflowSteps = project_data?.workflowSteps || [];
                const currentStepIndex = allWorkflowSteps.findIndex((s: any) => s.id === stepId);
                const previousStepIds = currentStepIndex > 0 
                  ? allWorkflowSteps.slice(0, currentStepIndex).map((s: any) => s.id)
                  : [];
                
                console.log(`📊 Current step index: ${currentStepIndex}, Previous step IDs: ${previousStepIds.join(', ')}`);
                
                // Get only records where ALL previous step values are validated
                const validatedRecordIds = filterRecordsWithAllPreviousValuesValidated(
                  existingValidations,
                  previousStepIds,
                  project_id
                );
                
                // Build merged data by getting validations for each value in the step
                const valueValidationMap: Record<string, any[]> = {};
                
                for (const stepValue of stepValues) {
                  const validationsForValue = existingValidations.filter((v: any) => 
                    v.valueId === stepValue.id
                  );
                  
                  console.log(`📊 Found ${validationsForValue.length} validations for value "${stepValue.valueName}"`);
                  valueValidationMap[stepValue.valueName] = validationsForValue;
                }
                
                // Create merged data based on the identifier value (first value in step)
                const identifierValue = stepValues.find(v => v.isIdentifier) || stepValues[0];
                if (identifierValue && valueValidationMap[identifierValue.valueName]) {
                  const identifierValidations = valueValidationMap[identifierValue.valueName];
                  
                  // Filter to only include records with validated previous step values
                  const filteredIdentifierValidations = validatedRecordIds.length > 0
                    ? identifierValidations.filter((v: any) => validatedRecordIds.includes(v.identifierId))
                    : identifierValidations; // If no previous steps, include all
                  
                  console.log(`📊 Filtered to ${filteredIdentifierValidations.length} records with validated previous values (from ${identifierValidations.length} total)`);
                  
                  // Determine which columns to include based on tool configuration
                  const columnsToInclude = new Set<string>();
                  
                  // ALWAYS include the first column (identifier)
                  if (identifierValue) {
                    columnsToInclude.add(identifierValue.valueName);
                    console.log(`📊 Always including first column: ${identifierValue.valueName}`);
                  }
                  
                  // Parse inputValues to find referenced columns
                  if (workflowValue.inputValues) {
                    for (const [key, value] of Object.entries(workflowValue.inputValues)) {
                      if (typeof value === 'string') {
                        // Check for @-references like "@Column Name"
                        if (value.startsWith('@')) {
                          const columnName = value.substring(1);
                          const referencedValue = stepValues.find(v => v.valueName === columnName);
                          if (referencedValue) {
                            columnsToInclude.add(referencedValue.valueName);
                            console.log(`📊 Including referenced column: ${referencedValue.valueName}`);
                          }
                        }
                      } else if (Array.isArray(value)) {
                        // Check array values for references
                        value.forEach(v => {
                          if (typeof v === 'string' && v.startsWith('@')) {
                            const columnName = v.substring(1);
                            const referencedValue = stepValues.find(val => val.valueName === columnName);
                            if (referencedValue) {
                              columnsToInclude.add(referencedValue.valueName);
                              console.log(`📊 Including referenced column: ${referencedValue.valueName}`);
                            }
                          }
                        });
                      }
                    }
                  }
                  
                  console.log(`📊 Will include columns: ${Array.from(columnsToInclude).join(', ')}`);
                  
                  const mergedData = filteredIdentifierValidations.map((identifierVal: any) => {
                    const record: any = {
                      identifierId: identifierVal.identifierId || `record-${identifierVal.recordIndex}`
                    };
                    
                    // Add only the columns that should be included
                    for (const stepValue of stepValues) {
                      const valueName = stepValue.valueName;
                      
                      // Include this column if it's in our include set
                      if (columnsToInclude.has(valueName)) {
                        const validationsForValue = valueValidationMap[valueName];
                        
                        // Find matching validation by record index
                        const matchingValidation = validationsForValue.find((v: any) => 
                          v.recordIndex === identifierVal.recordIndex
                        );
                        
                        if (matchingValidation) {
                          record[valueName] = matchingValidation.extractedValue || '';
                        } else {
                          record[valueName] = '';
                        }
                      }
                    }
                    
                    return record;
                  });
                  
                  console.log(`📊 Created ${mergedData.length} merged records with ${stepValues.length} fields each`);
                  if (mergedData.length > 0) {
                    console.log('📊 Sample merged record:', mergedData[0]);
                    console.log('📊 Record fields:', Object.keys(mergedData[0]));
                  }
                  
                  // Set the merged data as List Item input
                  toolInputs['List Item'] = mergedData;
                } else {
                  console.log('⚠️ No identifier value found or no validations for identifier');
                }
              } else {
                console.log('⚠️ No stepId found for this value');
              }
            }
            
            // Process other input values
            for (const [key, value] of Object.entries(workflowValue.inputValues)) {
              // Skip List Item if we already set it above
              if (key === 'List Item' && toolInputs['List Item']) {
                continue;
              }
              
              // Handle @-references to previous step values
              if (typeof value === 'string' && value.startsWith('@')) {
                console.log(`📌 Processing cross-step reference: ${value}`);
                
                // Parse the reference (e.g., "@Service Dates × Start Date")
                // Format is: @StepName × ValueName
                const refString = value.substring(1); // Remove @
                const parts = refString.split(' × ');
                
                if (parts.length === 2) {
                  const [referencedStepName, referencedValueName] = parts;
                  console.log(`📌 Looking for step "${referencedStepName}" and value "${referencedValueName}"`);
                  
                  // Find the referenced step
                  const allSteps = await storage.getWorkflowSteps(projectId);
                  const referencedStep = allSteps.find(s => s.stepName === referencedStepName);
                  
                  if (referencedStep) {
                    console.log(`📌 Found referenced step: ${referencedStep.stepName} (ID: ${referencedStep.id})`);
                    
                    // Get values for the referenced step
                    const stepValues = await storage.getStepValues(referencedStep.id);
                    console.log(`📌 Found ${stepValues.length} values in referenced step`);
                    
                    // Find the specific value being referenced
                    const referencedValue = stepValues.find(v => v.valueName === referencedValueName);
                    if (referencedValue) {
                      console.log(`📌 Found referenced value: ${referencedValue.valueName} (ID: ${referencedValue.id})`);
                      
                      // Get validations for this value
                      const referencedValidations = existingValidations.filter((v: any) => 
                        v.valueId === referencedValue.id
                      );
                      
                      if (referencedValidations.length > 0) {
                        const referencedData = referencedValidations.map((v: any) => ({
                          identifierId: v.identifierId || `record-${v.recordIndex}`,
                          extractedValue: v.extractedValue || '',
                          recordIndex: v.recordIndex
                        }));
                        toolInputs[key] = referencedData;
                        console.log(`📌 ✅ Resolved cross-step reference to ${referencedData.length} items from ${referencedStepName}.${referencedValueName}`);
                      } else {
                        console.log(`⚠️ No validations found for referenced value: ${referencedStepName}.${referencedValueName}`);
                        toolInputs[key] = [];
                      }
                    } else {
                      console.log(`⚠️ Referenced value "${referencedValueName}" not found in step "${referencedStepName}"`);
                      toolInputs[key] = [];
                    }
                  } else {
                    console.log(`⚠️ Referenced step "${referencedStepName}" not found`);
                    // Fall back to looking in current step (backward compatibility)
                    const currentStepId = workflowValue.stepId;
                    if (currentStepId) {
                      const stepValues = await storage.getStepValues(currentStepId);
                      const referencedValue = stepValues.find(v => v.valueName === refString);
                      if (referencedValue) {
                        const referencedValidations = existingValidations.filter((v: any) => 
                          v.valueId === referencedValue.id
                        );
                        if (referencedValidations.length > 0) {
                          const referencedData = referencedValidations.map((v: any) => ({
                            identifierId: v.identifierId || `record-${v.recordIndex}`,
                            extractedValue: v.extractedValue || '',
                            recordIndex: v.recordIndex
                          }));
                          toolInputs[key] = referencedData;
                          console.log(`📌 Resolved reference using fallback to current step`);
                        } else {
                          toolInputs[key] = [];
                        }
                      } else {
                        toolInputs[key] = [];
                      }
                    } else {
                      toolInputs[key] = [];
                    }
                  }
                } else {
                  // Handle simple references without step name (backward compatibility)
                  console.log(`📌 Simple reference format detected: ${refString}`);
                  const currentStepId = workflowValue.stepId;
                  if (currentStepId) {
                    const stepValues = await storage.getStepValues(currentStepId);
                    const referencedValue = stepValues.find(v => v.valueName === refString);
                    if (referencedValue) {
                      const referencedValidations = existingValidations.filter((v: any) => 
                        v.valueId === referencedValue.id
                      );
                      if (referencedValidations.length > 0) {
                        const referencedData = referencedValidations.map((v: any) => ({
                          identifierId: v.identifierId || `record-${v.recordIndex}`,
                          extractedValue: v.extractedValue || '',
                          recordIndex: v.recordIndex
                        }));
                        toolInputs[key] = referencedData;
                        console.log(`📌 Resolved simple reference to ${referencedData.length} items`);
                      } else {
                        toolInputs[key] = [];
                      }
                    } else {
                      toolInputs[key] = [];
                    }
                  } else {
                    toolInputs[key] = [];
                  }
                }
              }
              // Handle Reference Document - fetch when value is @reference_document or value is an array (document IDs)
              else if (value === '@reference_document' || (Array.isArray(value) && value.every(item => typeof item === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)))) {
                console.log('🔍 FETCHING REFERENCE DOCUMENTS...');
                console.log(`  Key: ${key}, Value type: ${typeof value}, Is Array: ${Array.isArray(value)}`);
                
                // If value is an array of document IDs, fetch specific documents
                let knowledgeDocs: any[] = [];
                if (Array.isArray(value) && value.length > 0) {
                  console.log(`  Fetching specific knowledge documents: ${value}`);
                  // Fetch specific knowledge documents by IDs
                  for (const docId of value) {
                    const doc = await storage.getKnowledgeDocument(docId);
                    if (doc) {
                      knowledgeDocs.push(doc);
                      console.log(`    Found document: ${doc.fileName}`);
                      console.log(`    Document content preview: ${doc.extractedContent?.slice(0, 200)}...`);
                    }
                  }
                } else {
                  // Get all knowledge documents for the project
                  knowledgeDocs = await storage.getKnowledgeDocuments(projectId);
                  console.log(`  Fetched all ${knowledgeDocs.length} knowledge documents for project`);
                }
                
                // Get reference documents from session
                const sessionDocs = await storage.getSessionDocuments(sessionId);
                
                console.log(`📚 Found ${sessionDocs.length} session documents`);
                console.log(`📚 Found ${knowledgeDocs.length} knowledge documents`);
                
                // Log details about each document
                if (knowledgeDocs.length > 0) {
                  knowledgeDocs.forEach((doc: any, idx: number) => {
                    console.log(`  Knowledge Doc ${idx + 1}: ${doc.fileName} (${doc.content?.length || 0} chars)`);
                    if (doc.content) {
                      console.log(`    Preview: ${doc.content.substring(0, 100)}...`);
                    }
                  });
                }
                
                // Combine document contents
                const allDocContents = [
                  ...sessionDocs.map((d: any) => d.extractedContent || ''),
                  ...knowledgeDocs.map((d: any) => d.content || '')
                ].filter(c => c.length > 0);
                
                if (allDocContents.length > 0) {
                  const combinedContent = allDocContents.join('\n\n---\n\n');
                  // Set reference document content for this parameter
                  toolInputs[key] = combinedContent;
                  console.log(`📚 ✅ Set reference document content for ${key} (${combinedContent.length} chars)`);
                  console.log(`📚 Preview of combined content: ${combinedContent.substring(0, 200)}...`);
                } else {
                  console.log('⚠️ No reference documents found');
                  toolInputs[key] = '';
                }
              } else if (typeof value === 'object' && value !== null) {
                // Handle nested input structure
                for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
                  if (Array.isArray(subValue) && subValue.includes('user_document')) {
                    // Replace user_document with actual document content
                    toolInputs[subKey] = convertedFiles.map((f: any) => f.file_content).join('\n\n');
                  } else {
                    toolInputs[subKey] = subValue;
                  }
                }
              } else {
                // Set value as-is if not already set
                if (!toolInputs[key]) {
                  toolInputs[key] = value;
                }
              }
            }
            
            console.log('✅ Final tool inputs prepared:', Object.keys(toolInputs));
            for (const [k, v] of Object.entries(toolInputs)) {
              if (Array.isArray(v)) {
                console.log(`  - ${k}: Array with ${v.length} items`);
              } else if (typeof v === 'string') {
                console.log(`  - ${k}: String (${v.length} chars)`);
              } else {
                console.log(`  - ${k}: ${typeof v}`);
              }
            }
          }
          
          // Log what we're sending to the tool
          console.log('🎯 CALLING TOOL WITH INPUTS:');
          for (const [key, val] of Object.entries(toolInputs)) {
            if (typeof val === 'string') {
              console.log(`  - ${key}: String with ${val.length} chars`);
              if (key === 'Reference Document' && val.length > 0) {
                console.log(`    📚 Reference doc preview: ${val.substring(0, 100)}...`);
              }
            } else if (Array.isArray(val)) {
              console.log(`  - ${key}: Array with ${val.length} items`);
            } else {
              console.log(`  - ${key}: ${typeof val}`);
            }
          }
          
          try {
            // Check if this is an Info Page value with multiple fields
            const isInfoPageWithFields = workflowStep?.stepType === 'info_page' && 
                                         workflowValue?.fields && 
                                         Array.isArray(workflowValue.fields) && 
                                         workflowValue.fields.length > 0;
            
            // Run the tool
            const toolResults = await runToolForExtraction(
              workflowValue.toolId,
              toolInputs,
              sessionId,
              projectId,
              isInfoPageWithFields ? workflowValue.fields : undefined // Pass fields for Info Page values
            );
            
            console.log(`✅ Tool execution completed. Results count: ${toolResults.length}`);
            
            // Handle Info Page multi-field extraction differently
            if (isInfoPageWithFields && workflowValue.fields) {
              console.log('🎯 INFO PAGE MULTI-FIELD EXTRACTION - Saving field validations');
              
              // For Info Page values with fields, each result corresponds to a field
              for (let i = 0; i < toolResults.length && i < workflowValue.fields.length; i++) {
                const result = toolResults[i];
                const field = workflowValue.fields[i];
                const fieldName = `${workflowStep.stepName}.${workflowValue.valueName}.${field.name}`;
                
                const validation = {
                  sessionId,
                  validationType: 'schema_field',
                  fieldId: field.id, // Use field's own ID for proper mapping
                  extractedValue: result.extractedValue,
                  originalExtractedValue: result.extractedValue,
                  originalConfidenceScore: result.confidenceScore || 85,
                  originalAiReasoning: result.aiReasoning || 'Extracted via AI tool',
                  validationStatus: result.validationStatus || 'valid',
                  aiReasoning: result.aiReasoning || 'Extracted via AI tool',
                  confidenceScore: result.confidenceScore || 85,
                  dataType: field.dataType.toLowerCase(),
                  collectionName: workflowStep.stepName,
                  collectionId: step_id,
                  recordIndex: 0, // Info Pages typically have single records
                  stepId: step_id,
                  valueId: value_id,
                  identifierId: field.id // Use field ID as identifier for consistency
                };
                
                console.log(`  Saving field validation for: ${fieldName}`);
                await storage.createFieldValidation(validation);
              }
              
              console.log(`✅ Saved ${toolResults.length} field validations for Info Page value`);
              
              // Update session status
              await storage.updateExtractionSession(sessionId, {
                status: "extracted"
              });
              
              return res.json({ 
                message: "Multi-field extraction completed", 
                extractedCount: toolResults.length
              });
            }
            
            // CRITICAL FIX: Map results back to inputs using identifierId
            console.log('🔍 MAPPING RESULTS BACK TO INPUTS:');
            
            // Create a map of identifierId to input index
            const inputMap = new Map();
            mergedData?.forEach((item: any, index: number) => {
              inputMap.set(item.identifierId, index);
            });
            
            // Create properly ordered results array
            const orderedResults = new Array(mergedData?.length || 0);
            let mappingErrors = 0;
            
            for (const result of toolResults) {
              const inputIndex = inputMap.get(result.identifierId);
              if (inputIndex !== undefined) {
                orderedResults[inputIndex] = result;
              } else {
                console.error(`⚠️ No input found for result identifierId: ${result.identifierId}`);
                mappingErrors++;
              }
            }
            
            // Log sample mappings to verify
            const sampleIndices = [0, 1, 99, 100];
            for (const idx of sampleIndices) {
              if (orderedResults[idx] && mergedData?.[idx]) {
                const input = mergedData[idx];
                const output = orderedResults[idx];
                console.log(`  [${idx}] "${input['Column Names']?.substring(0, 40)}..." -> "${output.extractedValue}"`);
              }
            }
            
            if (mappingErrors > 0) {
              console.error(`❌ ${mappingErrors} results could not be mapped back to inputs!`);
            }
            
            // Use orderedResults instead of toolResults for saving
            const resultsToSave = orderedResults;
            
            // Save results as field validations
            const currentRecordIndex = collectionRecordCounts[workflowStep.stepName] || 0;
            let savedCount = 0;
            let updatedCount = 0;
            
            for (let i = 0; i < resultsToSave.length; i++) {
              try {
                const result = resultsToSave[i];
                if (!result) continue; // Skip if no result for this index
                // Use the actual value name from the workflow step
                const fieldName = `${workflowStep.stepName}.${workflowValue.valueName}[${currentRecordIndex + i}]`;
                
                // Use identifierId from the result to map to existing records
                const identifierId = result.identifierId || null;
                
                // For Standard Mapping, we need to create new records with the same identifierId
                // but different value_id (since it's a different column)
                // Check if a validation already exists for this specific value and identifierId
                let existingValidation = null;
                if (identifierId) {
                  // Only look for existing validation with same identifierId AND same value_id
                  // This ensures we don't accidentally update records from other columns
                  existingValidation = existingValidations.find((v: any) => 
                    v.identifierId === identifierId && 
                    v.valueId === value_id
                  );
                  
                  // If not found, we need to find the correct record index from the Column Names records
                  if (!existingValidation) {
                    // Find the record with this identifierId from any column to get its record index
                    const referenceRecord = existingValidations.find((v: any) => 
                      v.identifierId === identifierId && 
                      v.collectionName === workflowStep.stepName
                    );
                    
                    if (referenceRecord && referenceRecord.recordIndex !== null && referenceRecord.recordIndex !== undefined) {
                      // Use the same record index as the reference record
                      // This ensures Standard Mapping aligns with Column Names and Worksheet Name
                      const recordIndexToUse = referenceRecord.recordIndex;
                      
                      // Update our tracking - we'll use this specific index
                      // Don't increment currentRecordIndex + i, use the exact index
                      const validation = {
                        sessionId,
                        fieldId: value_id,
                        fieldName: `${workflowStep.stepName}.${workflowValue.valueName}[${recordIndexToUse}]`,
                        extractedValue: result.extractedValue || '',
                        validationStatus: result.validationStatus || 'extracted',
                        validationType: 'collection_property',
                        collectionName: workflowStep.stepName,
                        collectionId: step_id,  // CRITICAL: Use stepId as collectionId in unified architecture
                        recordIndex: recordIndexToUse,
                        confidenceScore: result.confidenceScore || 0.9,
                        aiReasoning: result.aiReasoning || 'Extracted via tool engine',
                        dataType: 'text',
                        stepId: step_id,
                        valueId: value_id,
                        identifierId: identifierId
                      };
                      
                      // Create new validation for Standard Mapping
                      try {
                        await storage.createFieldValidation(validation);
                        savedCount++;
                        if (i % 10 === 0) {
                          console.log(`Saved ${i + 1}/${toolResults.length} validations...`);
                        }
                      } catch (saveError) {
                        console.error(`Error saving Standard Mapping validation ${i + 1}:`, saveError);
                      }
                      
                      // Skip the normal validation creation below
                      continue;
                    }
                  }
                }
                
                const validation = {
                  sessionId,
                  fieldId: value_id,
                  fieldName: fieldName,  // This will be used for display purposes even though not stored
                  extractedValue: result.extractedValue || '',
                  validationStatus: result.validationStatus || 'extracted',
                  validationType: 'collection_property',
                  collectionName: workflowStep.stepName,
                  collectionId: step_id,  // CRITICAL: Use stepId as collectionId in unified architecture
                  recordIndex: existingValidation ? existingValidation.recordIndex : (currentRecordIndex + i),
                  confidenceScore: result.confidenceScore || 0.9,
                  aiReasoning: result.aiReasoning || 'Extracted via tool engine',
                  dataType: 'text',  // Add required data_type field
                  stepId: step_id,   // Add step_id for workflow tracking
                  valueId: value_id,  // Add value_id for workflow tracking
                  identifierId: identifierId  // Use the identifierId from the result for proper mapping
                };
                
                if (existingValidation) {
                  // Update existing validation
                  await storage.updateFieldValidation(existingValidation.id, validation);
                  updatedCount++;
                  if (i % 10 === 0) {
                    console.log(`Updated ${i + 1}/${toolResults.length} validations...`);
                  }
                } else {
                  // Create new validation
                  await storage.createFieldValidation(validation);
                  savedCount++;
                  if (i % 10 === 0) {
                    console.log(`Saved ${i + 1}/${toolResults.length} validations...`);
                  }
                }
              } catch (error) {
                console.error(`Error saving validation ${i + 1}:`, error);
                // Continue with next validation
              }
            }
            
            console.log(`Saved ${savedCount} new validations, updated ${updatedCount} existing validations`);
            
            // Update session status
            await storage.updateExtractionSession(sessionId, {
              status: "extracted"
            });
            
            return res.json({ 
              message: "Tool extraction completed", 
              extractedCount: toolResults.length
            });
          } catch (error) {
            console.error('Tool execution error:', error);
            return res.status(500).json({ 
              message: "Tool extraction failed", 
              error: error.message 
            });
          }
        }
      } else if (isExcelColumnExtraction) {
        // Excel column extraction should use a tool
        console.log('⚠️ EXCEL COLUMN EXTRACTION WITHOUT TOOL: Cannot extract without a tool');
        
        return res.status(400).json({ 
          success: false,
          error: 'No extraction tool configured for Excel columns',
          message: 'Excel column extraction requires a configured tool. Please assign an appropriate tool to this value in the project settings.'
        });
      }
      
      // No tool assigned - extraction requires a tool
      console.log('⚠️ NO TOOL ASSIGNED: Cannot extract without a tool');
      console.log('  Workflow step:', is_workflow_step);
      console.log('  Step ID:', step_id);
      console.log('  Value ID:', value_id);
      
      return res.status(400).json({ 
        success: false,
        error: 'No extraction tool configured',
        message: 'This value does not have an extraction tool assigned. Please configure a tool in the project settings to enable extraction.'
      });
      
    } catch (error) {
      console.error("STEP 1 extraction error:", error);
      res.status(500).json({ message: "Failed to start extraction process" });
    }
  });
  
  // STEP 2: Validate field records using tools
  app.post("/api/sessions/:sessionId/validate", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const projectId = req.body.projectId;
      
      console.log(`STEP 2 VALIDATE: Validation requested for session ${sessionId}`);
      
      // Validation should be done through tools, not Python scripts
      return res.status(400).json({ 
        success: false,
        error: 'Validation requires tool configuration',
        message: 'Field validation should be performed through configured tools. Please use the appropriate validation tools in the project settings.'
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
      
      const python = spawn('python3', ['services/document_extractor.py']);
      
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
          if (error) {
            console.log(`TEXT EXTRACTION stderr: ${error}`);
          }
          
          // Save each document with its extracted content to session documents table
          if (result.extracted_texts && Array.isArray(result.extracted_texts)) {
            for (const extractedText of result.extracted_texts) {
              try {
                // Find the original file to get size and MIME type
                const originalFile = convertedFiles.find(f => f.file_name === extractedText.file_name);
                
                const contentLength = extractedText.text_content?.length || 0;
                console.log(`TEXT EXTRACTION: ${extractedText.file_name} - content length: ${contentLength}, error: ${extractedText.error || 'none'}, method: ${extractedText.extraction_method || 'unknown'}`);
                
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
                
                console.log(`Saved document: ${extractedText.file_name} with ${contentLength} chars to session documents`);
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

  // AI extraction for existing sessions - requires tools
  app.post("/api/sessions/:sessionId/ai-extraction", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      console.log(`AI EXTRACTION: Requested for session ${sessionId}`);
      
      // AI extraction should be done through tools, not Python scripts
      return res.status(400).json({ 
        success: false,
        error: 'AI extraction requires tool configuration',
        message: 'AI extraction should be performed through configured tools. Please use the appropriate extraction tools in the project settings.'
      });
      
    } catch (error) {
      console.error("AI EXTRACTION error:", error);
      res.status(500).json({ success: false, message: "Failed to run AI extraction", error: error.message });
    }
  });

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
      
      const python = spawn('python3', ['services/extraction_wizardry.py'], {
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
            // Implement defensive JSON extraction to handle any debug statements
            let jsonData = output;
            
            // Try parsing directly first
            let result;
            try {
              result = JSON.parse(jsonData);
            } catch (directParseError) {
              console.log('Direct JSON parse failed, attempting defensive extraction...');
              
              // Find the largest valid JSON block (array or object)
              const lines = jsonData.split('\n');
              let bestJsonCandidate = '';
              let maxLength = 0;
              
              // Try to find JSON starting with [ or {
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('[') || line.startsWith('{')) {
                  // Found potential JSON start, collect until we have valid JSON
                  let candidate = '';
                  let bracketCount = 0;
                  let inQuotes = false;
                  let escapeNext = false;
                  
                  for (let j = i; j < lines.length; j++) {
                    candidate += (j > i ? '\n' : '') + lines[j];
                    
                    // Count brackets to find complete JSON
                    for (let k = 0; k < lines[j].length; k++) {
                      const char = lines[j][k];
                      if (escapeNext) {
                        escapeNext = false;
                        continue;
                      }
                      if (char === '\\') {
                        escapeNext = true;
                        continue;
                      }
                      if (char === '"') {
                        inQuotes = !inQuotes;
                        continue;
                      }
                      if (!inQuotes) {
                        if (char === '[' || char === '{') bracketCount++;
                        if (char === ']' || char === '}') bracketCount--;
                      }
                    }
                    
                    // If we have balanced brackets, try parsing
                    if (bracketCount === 0 && candidate.length > maxLength) {
                      try {
                        const testResult = JSON.parse(candidate);
                        if (testResult && (Array.isArray(testResult) || typeof testResult === 'object')) {
                          bestJsonCandidate = candidate;
                          maxLength = candidate.length;
                        }
                      } catch (testError) {
                        // Continue searching
                      }
                    }
                  }
                }
              }
              
              if (bestJsonCandidate) {
                console.log(`Defensive JSON extraction successful. Extracted ${bestJsonCandidate.length} characters of JSON`);
                result = JSON.parse(bestJsonCandidate);
              } else {
                throw new Error(`Failed to parse Python output: ${directParseError.message}`);
              }
            }
            
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
      const python = spawn('python3', ['services/ai_extraction_single_step.py']);
      
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
                validationStatus: "pending",
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

      // Simplified validation system - only update the existing validation, don't create new ones

      if (currentValidation.sessionId) {
        checkAndRevertWorkflowStatus(currentValidation.sessionId).catch(() => {});
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
      const currentValidation = await storage.getFieldValidation(id);
      const deleted = await storage.deleteFieldValidation(id);
      if (!deleted) {
        return res.status(404).json({ message: "Validation not found" });
      }
      if (currentValidation?.sessionId) {
        checkAndRevertWorkflowStatus(currentValidation.sessionId).catch(() => {});
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
      
      console.log('📋 EXCEL DEBUG: About to call document_extractor.py with data:', JSON.stringify({
        step: extractionData.step,
        documentCount: extractionData.documents.length,
        firstDocType: extractionData.documents[0]?.mime_type,
        firstDocName: extractionData.documents[0]?.file_name
      }));
      
      const python = spawn('python3', ['services/document_extractor.py']);
      
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
                console.log(`DOCUMENT UPLOAD DEBUG ${index + 1} preview: ${extractedText.text_content.substring(0, 200)}...`);
                // Excel-specific debugging
                if (extractedText.file_name?.endsWith('.xlsx') || extractedText.file_name?.endsWith('.xls')) {
                  const content = extractedText.text_content;
                  console.log('📊 EXCEL CONTENT DEBUG:');
                  console.log('  Content includes Sheet markers:', content.includes('=== Sheet:'));
                  console.log('  First 300 chars:', content.substring(0, 300));
                  
                  // Check for grid structure issues
                  const lines = content.split('\n').slice(0, 10); // First 10 lines
                  lines.forEach((line, i) => {
                    const tabCount = (line.match(/\t/g) || []).length;
                    console.log(`  Line ${i + 1}: ${tabCount} tabs - "${line.substring(0, 50)}..."`);
                  });
                }
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
        identifierId: stepData.identifierId,
        kanbanConfig: stepData.kanbanConfig || null,
        actionConfig: stepData.actionConfig || null
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
        identifierId: stepData.identifierId,
        kanbanConfig: stepData.kanbanConfig || null,
        actionConfig: stepData.actionConfig || null
      });
    }
    
    // Update values for this step
    console.log("\n🔄 Updating step values...");
    
    // Get existing values to track what needs to be deleted
    const existingValues = await storage.getStepValues(stepId);
    const existingValueIds = new Set(existingValues.map(v => v.id));
    const newValueIds = new Set((stepData.values || []).map((v: any) => v.id));
    
    // Delete values that are no longer in the new data
    const deletedValueIds: string[] = [];
    for (const existingValue of existingValues) {
      if (!newValueIds.has(existingValue.id)) {
        console.log(`  🗑️ Deleting removed value: ${existingValue.id}`);
        await storage.deleteStepValue(existingValue.id);
        deletedValueIds.push(existingValue.id);
      }
    }
    
    // Clean up stale references to deleted values in remaining values
    if (deletedValueIds.length > 0) {
      for (const value of (stepData.values || [])) {
        if (value.inputValues?._categoryFilterByValue && deletedValueIds.includes(value.inputValues._categoryFilterByValue)) {
          console.log(`  🧹 Cleaning stale _categoryFilterByValue reference in value: ${value.name}`);
          delete value.inputValues._categoryFilterByValue;
        }
      }
    }
    
    // Process each value - either update existing or create new
    for (let i = 0; i < (stepData.values || []).length; i++) {
      const value = stepData.values[i];
      
      // ALWAYS use the position in the array as the orderIndex for consistency
      // This ensures values maintain their order based on their position in the UI
      const consistentOrderIndex = i;
      
      // Build value data for creation
      const createValueData = {
        id: value.id,
        stepId: stepId,
        valueName: value.name,
        dataType: value.dataType,
        description: value.description,
        isIdentifier: stepData.type === 'list' && stepData.values[0]?.id === value.id,
        orderIndex: consistentOrderIndex, // Always use array position for consistent ordering
        toolId: value.toolId || null,  // Convert empty string to null
        inputValues: value.inputValues,
        fields: value.fields || null, // Add fields for multi-field Info Page values
        color: value.color || null, // Column color for visual styling
        autoVerificationConfidence: value.autoVerificationConfidence,
        choiceOptions: value.choiceOptions
      };
      
      if (existingValueIds.has(value.id)) {
        // For updates, ALWAYS update the orderIndex to match the current position
        const updateValueData: any = {
          valueName: value.name,
          dataType: value.dataType,
          description: value.description,
          isIdentifier: stepData.type === 'list' && stepData.values[0]?.id === value.id,
          toolId: value.toolId || null,
          inputValues: value.inputValues,
          fields: value.fields || null, // Add fields for multi-field Info Page values
          color: value.color || null, // Column color for visual styling
          autoVerificationConfidence: value.autoVerificationConfidence,
          choiceOptions: value.choiceOptions,
          orderIndex: consistentOrderIndex // ALWAYS update orderIndex to maintain correct order
        };
        
        console.log(`  📝 Updating existing value: ${value.id} with orderIndex: ${consistentOrderIndex}`);
        await storage.updateStepValue(value.id, updateValueData);
      } else {
        // Create new value with proper orderIndex
        console.log(`  ➕ Creating new value: ${value.id} with orderIndex: ${consistentOrderIndex}`);
        await storage.createStepValue(createValueData);
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

  // Delete a workflow step
  app.delete("/api/workflow-steps/:stepId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { stepId } = req.params;
      
      console.log("\n🗑️ DELETE request to remove workflow step:", stepId);
      
      // First delete all step values for this step
      const stepValues = await storage.getStepValues(stepId);
      for (const value of stepValues) {
        await storage.deleteStepValue(value.id);
      }
      
      // Delete the step itself
      await storage.deleteWorkflowStep(stepId);
      
      console.log("✅ Successfully deleted step:", stepId);
      res.json({ success: true, message: "Step deleted successfully" });
    } catch (error) {
      console.error("\n❌ Error deleting step:", error);
      res.status(500).json({ message: "Failed to delete step" });
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

  // Update Excel wizardry function (project-scoped) - PUT route
  app.put("/api/projects/:projectId/excel-functions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id, projectId } = req.params;
      
      console.log(`🔧 PUT update Excel function ${id} for project ${projectId} with data:`, JSON.stringify(req.body, null, 2));
      
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
      
      // Fetch the complete updated function to ensure all fields are returned
      const completeFunction = await storage.getExcelWizardryFunction(id);
      
      console.log(`✅ Successfully updated Excel function ${id}:`, JSON.stringify(completeFunction, null, 2));
      res.json(completeFunction);
    } catch (error) {
      console.error("Error updating Excel wizardry function:", error);
      res.status(500).json({ message: "Failed to update Excel wizardry function" });
    }
  });

  // Update Excel wizardry function (project-scoped) - PATCH route
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
      
      // Custom validation for AI_ONLY vs CODE vs DATABASE_LOOKUP tools
      const { toolType, aiPrompt, functionCode, inputParameters, dataSourceId, ...otherData } = req.body;
      
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
      } else if (toolType === 'DATABASE_LOOKUP') {
        // DATABASE_LOOKUP tools require aiPrompt for lookup instructions
        // dataSourceId is now configured at step value level, not at tool level
        if (!aiPrompt) {
          console.error('❌ DATABASE_LOOKUP tools require aiPrompt field');
          return res.status(400).json({ 
            message: "DATABASE_LOOKUP tools must have lookup instructions (aiPrompt)", 
            errors: [{ path: ['aiPrompt'], message: 'Required for DATABASE_LOOKUP tools' }]
          });
        }
      } else if (toolType === 'DATASOURCE_DROPDOWN') {
        // DATASOURCE_DROPDOWN tools require dataSourceId and dropdownColumn in metadata
        if (!dataSourceId) {
          console.error('❌ DATASOURCE_DROPDOWN tools require dataSourceId');
          return res.status(400).json({ 
            message: "Data Source Dropdown tools must have a data source selected", 
            errors: [{ path: ['dataSourceId'], message: 'Required for DATASOURCE_DROPDOWN tools' }]
          });
        }
      }
      
      // Process input parameters and extract document content if needed
      const processedParams = [];
      const metadata = otherData.metadata || {};
      
      // First create the function to get its ID
      // Note: dataSourceId is now configured at step value level for DATABASE_LOOKUP tools
      const toolData = {
        ...otherData,
        inputParameters: inputParameters || [],
        toolType,
        aiPrompt: (toolType === 'AI_ONLY' || toolType === 'DATABASE_LOOKUP') ? aiPrompt : null,
        functionCode: toolType === 'CODE' ? functionCode : null,
        dataSourceId: (toolType === 'DATABASE_LOOKUP' || toolType === 'DATASOURCE_DROPDOWN') ? dataSourceId : null,
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
            const python = spawn('python3', ['services/document_extractor.py']);
            
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
              const python = spawn('python3', ['services/document_extractor.py']);
              
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

  // Create predefined Map Search Database Lookup tool for a project
  // Accepts optional body params to customize: name, description, aiPrompt, mapConfig (latField, lngField, labelField, popupFields, defaultZoom)
  app.post("/api/projects/:projectId/tools/map-lookup", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const body = req.body || {};

      const mapConfig = {
        latField: body.mapConfig?.latField || "latitude",
        lngField: body.mapConfig?.lngField || "longitude",
        labelField: body.mapConfig?.labelField || "name",
        popupFields: body.mapConfig?.popupFields || [],
        defaultZoom: body.mapConfig?.defaultZoom || 6,
        ...(body.mapConfig?.defaultCenter ? { defaultCenter: body.mapConfig.defaultCenter } : {})
      };

      const toolData = {
        projectId,
        name: body.name || "Map Search Database Lookup",
        description: body.description || "Searches a data source by city and street, then displays matching results on an interactive map. Click a pin to select the matched record.",
        toolType: "DATABASE_LOOKUP" as const,
        operationType: "updateSingle" as const,
        outputType: "single" as const,
        aiPrompt: body.aiPrompt || "Match the provided city and street to the closest record in the data source. Consider partial matches, abbreviations, and alternative spellings. Return the best matching record.",
        llmModel: body.llmModel || "gemini-2.0-flash",
        inputParameters: [
          {
            name: "City",
            type: "text",
            description: "The city name to search for in the data source"
          },
          {
            name: "Street",
            type: "text",
            description: "The street name or address to search for in the data source"
          },
          {
            name: "Input Data",
            type: "data",
            description: "Reference data from the data source"
          }
        ],
        inputSchema: {
          type: "object",
          properties: {
            City: { type: "string", description: "City name" },
            Street: { type: "string", description: "Street name or address" }
          },
          required: ["City", "Street"]
        },
        outputSchema: {
          type: "object",
          properties: {
            result: { type: "string", description: "Selected value from the matched record" }
          }
        },
        metadata: {},
        tags: ["map", "location", "address", "lookup", "geocoding"],
        displayConfig: {
          modalType: "map",
          modalSize: "xl",
          mapConfig
        }
      };

      const func = await storage.createExcelWizardryFunction(toolData);
      console.log(`✅ Created Map Search Database Lookup tool ${func.id} for project ${projectId}`);
      res.json(func);
    } catch (error) {
      console.error("Error creating map lookup tool:", error);
      res.status(500).json({ message: "Failed to create map lookup tool" });
    }
  });

  // Generate Excel wizardry function code
  app.post("/api/excel-functions/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('🤖 Generating tool content with input:', JSON.stringify(req.body, null, 2));
      
      let { projectId, name, description, toolType, inputParameters, aiAssistanceRequired, aiAssistancePrompt, tags, outputType, operationType } = req.body;
      
      // 🎯 CRITICAL: For UPDATE operations, automatically add Input Data parameter (ONLY)
      // This is architecturally required for identifier array handling
      if (operationType && operationType.includes('update')) {
        console.log('🔄 Detected UPDATE operation - checking for Input Data parameter...');
        
        // Auto-add ONLY Input Data parameter for UPDATE operations
        // This parameter will receive the identifier array with previous column data
        const hasInputData = inputParameters.some(p => 
          p.type === 'data' || (p.name && p.name.toLowerCase().includes('input data'))
        );
        
        if (!hasInputData) {
          console.log('➕ Adding Input Data parameter for UPDATE operation (identifier array - architecturally required)');
          inputParameters.push({
            id: `auto-inputdata-${Date.now()}`,
            name: 'Input Data',
            type: 'data',
            multiline: false,
            description: 'Array of existing records with identifierId and previous column values. Use previous columns for CONTEXT/LOOKUP, extract NEW values and return with identifierId preserved.',
            sampleData: []
          });
        }
        
        console.log('✅ Final input parameters for UPDATE operation:', inputParameters.map(p => p.name));
      }
      
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
      
      // Generate tool content using unified engine with optimized parameters
      // DATABASE_LOOKUP tools are treated as AI_ONLY for prompt generation
      const effectiveToolType = toolType === "DATABASE_LOOKUP" ? "AI_ONLY" : toolType;
      const { content } = await toolEngine.generateToolContent({
        name,
        description: operationType && operationType.includes('update') 
          ? `${description}\n\nOPERATION TYPE: UPDATE - This tool automatically receives current step data and maintains identifierId relationships for proper data mapping.`
          : toolType === "DATABASE_LOOKUP"
          ? `${description}\n\nTOOL TYPE: DATABASE_LOOKUP - Generate lookup instructions for querying external data sources. The AI will use these instructions to filter and match records from the data source.`
          : description,
        toolType: effectiveToolType as "AI_ONLY" | "CODE",
        operationType: operationType as "createSingle" | "updateSingle" | "createMultiple" | "updateMultiple",
        outputType: outputType as "single" | "multiple",
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
      // DATABASE_LOOKUP tools use aiPrompt like AI_ONLY tools
      const functionData = {
        projectId,
        name,
        description,
        functionCode: toolType === "CODE" ? content : undefined,
        aiPrompt: (toolType === "AI_ONLY" || toolType === "DATABASE_LOOKUP") ? content : undefined,
        toolType: toolType || "CODE",
        outputType: outputType || "single",
        operationType: operationType || "updateSingle",
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
      const { name, description, inputParameters, toolType, outputType, operationType, aiAssistanceRequired, aiAssistancePrompt } = req.body;
      
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
      
      // Import the unified tool engine
      const { toolEngine } = await import("./toolEngine");
      
      // PRIORITIZE FORM DATA - use current form values, fallback to existing only if not provided
      const updatedName = name || existingFunc.name;
      const updatedDescription = description || existingFunc.description;
      const updatedInputParameters = inputParameters || existingFunc.inputParameters;
      const updatedOutputType = outputType || existingFunc.outputType;
      const updatedOperationType = operationType || existingFunc.operationType;
      const updatedToolType = toolType || existingFunc.toolType;
      const updatedAiAssistanceRequired = aiAssistanceRequired !== undefined ? aiAssistanceRequired : existingFunc.aiAssistanceRequired;
      const updatedAiAssistancePrompt = aiAssistancePrompt !== undefined ? aiAssistancePrompt : existingFunc.aiAssistancePrompt;
      
      console.log('📋 Final regeneration parameters:', {
        name: updatedName,
        toolType: updatedToolType,
        outputType: updatedOutputType,
        operationType: updatedOperationType,
        inputParameters: updatedInputParameters?.map(p => ({ name: p.name, type: p.type })),
        aiAssistanceRequired: updatedAiAssistanceRequired
      });
      
      // Regenerate the tool content using unified engine
      console.log('🤖 CALLING toolEngine.generateToolContent WITH:');
      console.log('📝 Name:', updatedName);
      console.log('📝 Description:', updatedDescription);
      console.log('📝 InputParameters:', JSON.stringify(updatedInputParameters, null, 2));
      console.log('📝 ToolType:', updatedToolType);
      console.log('📝 OutputType:', updatedOutputType);
      console.log('📝 OperationType:', updatedOperationType);
      console.log('='.repeat(80));
      
      const { content } = await toolEngine.generateToolContent({
        name: updatedName,
        description: updatedDescription,
        toolType: updatedToolType as "AI_ONLY" | "CODE",
        operationType: updatedOperationType as "createSingle" | "updateSingle" | "createMultiple" | "updateMultiple",
        outputType: updatedOutputType as "single" | "multiple",
        inputParameters: updatedInputParameters
      });
      
      console.log('🎯 Generated content:');
      console.log(content);
      
      // Prepare the content for storage based on tool type
      const functionCode = updatedToolType === 'CODE' ? content : null;
      const aiPrompt = updatedToolType === 'AI_ONLY' ? content : null;
      const metadata = { generatedAt: new Date().toISOString() };
      
      // Save the updated function to database using current form values
      const updatedFunction = await storage.updateExcelWizardryFunction(id, {
        name: updatedName,
        description: updatedDescription,
        inputParameters: updatedInputParameters,
        outputType: updatedOutputType,
        operationType: updatedOperationType,
        toolType: updatedToolType,
        aiAssistanceRequired: updatedAiAssistanceRequired,
        aiAssistancePrompt: updatedAiAssistancePrompt,
        functionCode,
        aiPrompt,
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
          operationType: func.operationType,
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

  // Individual column extraction endpoint
  app.post("/api/sessions/:sessionId/extract-column", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { stepId, valueId, documentId, documentIds, customInputs } = req.body;
      let { previousData } = req.body;
      
      // Support both single documentId (legacy) and documentIds array (new)
      const selectedDocumentIds: string[] = documentIds || (documentId ? [documentId] : []);
      
      console.log(`📊 Running SINGLE column extraction for session ${sessionId}`);
      console.log(`   Step ID: ${stepId}, Value ID: ${valueId}`);
      console.log(`   ⚠️ IMPORTANT: This endpoint extracts ONLY the single value/column specified by valueId`);
      console.log(`   ⚠️ It does NOT extract all values in the step - just this one value`);
      console.log(`   Previous data records: ${previousData?.length || 0}`);
      console.log(`   Document ID: ${documentId || 'Using default'}`);
      console.log(`   Custom inputs:`, customInputs ? JSON.stringify(customInputs, null, 2) : 'None');
      
      // Get the step and value details
      console.log(`   📝 Looking for step with ID: ${stepId}`);
      const step = await storage.getWorkflowStep(stepId);
      if (!step) {
        console.log(`   ❌ Step not found with ID: ${stepId}`);
        return res.status(404).json({ message: "Workflow step not found" });
      }
      console.log(`   ✅ Found step: "${step.stepName}"`);
      
      // Get all values for this step to debug
      const allStepValues = await storage.getStepValues(stepId);
      console.log(`   📋 All values in this step (${allStepValues.length} total):`);
      allStepValues.forEach(v => {
        console.log(`      - ${v.id}: "${v.valueName}" (isIdentifier: ${v.isIdentifier})`);
      });
      
      console.log(`   📝 Looking for value with ID: ${valueId}`);
      const value = await storage.getStepValue(valueId);
      if (!value) {
        console.log(`   ❌ Value not found with ID: ${valueId}`);
        console.log(`   💡 Available values in this step:`);
        allStepValues.forEach(v => {
          console.log(`      - ${v.id}: "${v.valueName}"`);
        });
        return res.status(404).json({ message: "Step value not found" });
      }
      console.log(`   ✅ Found value: "${value.valueName}"`)
      
      // 🎯 AUTOMATIC DATA FLOW: All subsequent columns get identifiers + previous column values
      // For subsequent columns, automatically build comprehensive previousData
      const firstColumn = allStepValues.find(v => v.isIdentifier) || allStepValues[0];
      const isFirstColumn = value.id === firstColumn?.id;
      const currentColumnOrder = allStepValues.findIndex(v => v.id === value.id);
      
      console.log(`🔄 AUTOMATIC DATA FLOW CHECK:`);
      console.log(`   Current column: ${value.valueName} (order: ${currentColumnOrder})`);
      console.log(`   Is first column: ${isFirstColumn}`);
      console.log(`   Step has ${allStepValues.length} total columns`);
      
      // ALWAYS build comprehensive previousData for ANY subsequent column (not just when empty)
      if (!isFirstColumn) {
        console.log(`📊 🎯 BUILDING AUTOMATIC DATA FLOW: Subsequent column detected - building comprehensive previousData`);
        console.log(`   First column: ${firstColumn?.valueName} (${firstColumn?.id})`);
        console.log(`   Current column: ${value.valueName} (${value.id})`);
        console.log(`   Will include: identifierId + ALL previous ${currentColumnOrder} columns`);
        
        // Get all validations for this step to build comprehensive previousData
        const existingValidations = await storage.getFieldValidations(sessionId);
        const stepValidations = existingValidations.filter(v => v.stepId === stepId);
        
        console.log(`📊 Found ${stepValidations.length} total validations for this step`);
        
        // Build rows by grouping validations by identifierId
        const rowsByIdentifier = new Map<string, any>();
        
        // Get all previous columns (up to but not including current column)
        const previousColumns = allStepValues.slice(0, currentColumnOrder);
        console.log(`📋 Previous columns to include:`, previousColumns.map(c => c.valueName));
        
        for (const validation of stepValidations) {
          if (!validation.identifierId) continue;
          
          // Initialize row if not exists
          if (!rowsByIdentifier.has(validation.identifierId)) {
            rowsByIdentifier.set(validation.identifierId, {
              identifierId: validation.identifierId
            });
          }
          
          // Find the column this validation belongs to
          const stepValue = allStepValues.find(v => v.id === validation.valueId || v.id === validation.fieldId);
          if (stepValue) {
            // Only include columns that come BEFORE the current column in the step
            const validationColumnOrder = allStepValues.findIndex(v => v.id === stepValue.id);
            if (validationColumnOrder < currentColumnOrder && validationColumnOrder >= 0) {
              rowsByIdentifier.get(validation.identifierId)[stepValue.valueName] = validation.extractedValue || null;
              console.log(`  ✅ Added ${stepValue.valueName} = "${validation.extractedValue}" for identifier ${validation.identifierId?.substring(0, 8)}...`);
            }
          }
        }
        
        // Convert to array and ensure proper column order
        const rawPreviousData = Array.from(rowsByIdentifier.values());
        
        // Filter to only include rows that have at least the first column value
        const filteredPreviousData = rawPreviousData.filter(row => {
          const hasFirstColumn = firstColumn && row[firstColumn.valueName] !== null && row[firstColumn.valueName] !== undefined && row[firstColumn.valueName] !== '';
          if (!hasFirstColumn) {
            console.log(`  ⚠️ Excluding row ${row.identifierId?.substring(0, 8)}... - missing first column value`);
          }
          return hasFirstColumn;
        });
        
        // Reorder columns in each row to match step order (identifierId first, then columns in step order)
        previousData = filteredPreviousData.map(row => {
          const orderedRow: any = { identifierId: row.identifierId };
          
          // Add columns in step order
          previousColumns.forEach(column => {
            orderedRow[column.valueName] = row[column.valueName] || null;
          });
          
          return orderedRow;
        });
        
        console.log(`✅ 🎯 AUTOMATIC DATA FLOW COMPLETE: Built comprehensive previousData`);
        console.log(`   📊 Total rows: ${previousData.length}`);
        console.log(`   📋 Columns included: identifierId + ${previousColumns.map(c => c.valueName).join(', ')}`);
        if (previousData.length > 0) {
          console.log(`   📝 Sample row:`, previousData[0]);
          console.log(`   📝 Column count per row: ${Object.keys(previousData[0]).length}`);
        }
        
        // Log summary of automatic data flow
        console.log(`🚀 AUTOMATIC DATA FLOW SUMMARY:`);
        console.log(`   Current extraction: ${value.valueName} (column ${currentColumnOrder + 1} of ${allStepValues.length})`);
        console.log(`   Automatic input: ${previousData.length} records with ${previousColumns.length} previous columns`);
        console.log(`   This creates incremental data flow where each column builds on previous ones`);
      } else {
        console.log(`🏁 FIRST COLUMN: ${value.valueName} - no automatic data flow needed`);
      }
      
      console.log(`   🎯 Extracting ONLY: "${value.valueName}" (${valueId})`);
      console.log(`   🚫 NOT extracting other values in step "${step.stepName}"`)
      console.log(`   📦 RAW VALUE from DB:`, JSON.stringify(value, null, 2));
      console.log(`   📦 Value object structure:`, JSON.stringify({
        id: value.id,
        valueName: value.valueName,
        description: value.description,
        toolId: value.toolId,
        hasInputValues: !!value.inputValues,
        inputValuesType: typeof value.inputValues,
        inputValuesKeys: value.inputValues ? Object.keys(value.inputValues) : 'none',
        inputValuesContent: value.inputValues || 'NULL'
      }, null, 2))
      
      // Get the tool for this value
      const tool = await storage.getExcelWizardryFunction(value.toolId);
      if (!tool) {
        return res.status(404).json({ message: "Tool not found for this value" });
      }
      
      console.log(`🔧 Using tool: ${tool.name} (${tool.toolType})`);
      console.log(`   Operation Type: ${tool.operationType || 'not set'}`);
      
      // For AI_ONLY tools, automatically infer operationType from step context
      if (tool.toolType === 'AI_ONLY') {
        const isIdentifierValue = value.isIdentifier === true || 
          (value.orderIndex === 0 && step.stepType === 'data_table');
        
        let inferredOperationType: string;
        if (step.stepType === 'info_page' || step.stepType === 'kanban') {
          inferredOperationType = 'updateSingle';
          console.log(`🔄 AI tool operationType inferred as updateSingle (${step.stepType} step)`);
        } else if (isIdentifierValue) {
          inferredOperationType = 'createMultiple';
          console.log(`🔄 AI tool operationType inferred as createMultiple (identifier column in data table)`);
        } else {
          inferredOperationType = 'updateMultiple';
          console.log(`🔄 AI tool operationType inferred as updateMultiple (subsequent column in data table)`);
        }
        
        console.log(`🔄 Overriding tool operationType from "${tool.operationType}" to "${inferredOperationType}"`);
        (tool as any).operationType = inferredOperationType;
      }
      
      // Get session documents
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      const sessionDocuments = await storage.getSessionDocuments(sessionId);
      
      // Build combined document content from all selected documents (multi-document support)
      let documentContent = '';
      let documentsUsed: any[] = [];
      
      if (selectedDocumentIds.length > 0) {
        console.log(`📄 Multi-document selection: ${selectedDocumentIds.length} documents selected`);
        
        for (const docId of selectedDocumentIds) {
          const doc = sessionDocuments.find(d => d.id === docId);
          if (doc) {
            const content = doc.extractedContent || doc.documentContent || '';
            if (content) {
              documentsUsed.push(doc);
              if (selectedDocumentIds.length > 1) {
                documentContent += `\n\n=== Document ${documentsUsed.length}: ${doc.documentName} ===\n${content}`;
              } else {
                documentContent = content;
              }
            } else {
              console.warn(`Document ${docId} (${doc.documentName}) has no content`);
            }
          } else {
            console.warn(`Document with ID ${docId} not found in session`);
          }
        }
        
        console.log(`📄 Combined content from ${documentsUsed.length} document(s): ${documentContent.length} chars`);
      }
      
      // CRITICAL: Fall back to primary/first document if no content gathered
      // This handles both: (1) no documents selected, and (2) selected documents yielded no content
      if (!documentContent || documentsUsed.length === 0) {
        console.log(`📄 Fallback: No usable content from selected documents, trying primary/first document`);
        const primaryDoc = sessionDocuments.find(d => d.isPrimary);
        const documentToUse = primaryDoc || sessionDocuments[0];
        
        if (documentToUse) {
          const fallbackContent = documentToUse.extractedContent || documentToUse.documentContent || '';
          if (fallbackContent) {
            documentContent = fallbackContent;
            documentsUsed = [documentToUse];
            console.log(`📄 Using fallback document: ${documentToUse.documentName} (${documentContent.length} chars)`);
          }
        }
      }
      
      if (!documentContent) {
        console.log('No document content available:', {
          selectedIds: selectedDocumentIds,
          docsUsed: documentsUsed.length,
          sessionDocsCount: sessionDocuments.length
        });
        // Fall back to empty document for tools that don't need document content
        documentContent = ""; 
      }
      
      // Prepare inputs for the tool
      let toolInputs: any = {};
      
      // Import validation filter
      const { filterVerifiedValidations, shouldIncludeUnverifiedData } = await import('./validationFilter');
      
      // Get all validations for the session to determine filtering strategy
      const allSessionValidations = await storage.getFieldValidations(sessionId);
      const includeExtracted = shouldIncludeUnverifiedData(allSessionValidations, stepId);
      
      // If this tool expects previous column data, format it appropriately
      if (value.inputValues && Object.keys(value.inputValues).length > 0) {
        console.log(`🎯 Processing inputValues for ${value.valueName}:`, value.inputValues);
        console.log(`🎯 Previous data received: ${previousData ? previousData.length : 0} records`);
        
        // Check if we have cross-step references (UUIDs) and no previousData
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const referencedValueIds = new Set<string>();
        
        // Collect all referenced value IDs
        for (const [paramName, paramValue] of Object.entries(value.inputValues)) {
          if (Array.isArray(paramValue)) {
            paramValue.forEach(item => {
              if (typeof item === 'string' && uuidRegex.test(item)) {
                referencedValueIds.add(item);
              }
            });
          }
        }
        
        // If we have cross-step references and no previousData, fetch the data
        if (referencedValueIds.size > 0 && (!previousData || previousData.length === 0)) {
          console.log(`📊 Fetching data from ${referencedValueIds.size} cross-step referenced values`);
          
          // Get all validations for the session
          const allValidations = await storage.getFieldValidations(sessionId);
          
          // We need to fetch complete row data, not just single columns
          // First, group referenced valueIds by their step
          const valueIdToStep = new Map<string, string>();
          const stepIds = new Set<string>();
          
          for (const refValueId of referencedValueIds) {
            const valueInfo = await storage.getStepValueById(refValueId);
            if (valueInfo && valueInfo.stepId) {
              valueIdToStep.set(refValueId, valueInfo.stepId);
              stepIds.add(valueInfo.stepId);
            }
          }
          
          // For each step, fetch ALL values and build complete row objects
          const dataByValueId = new Map<string, any[]>();
          
          for (const stepId of stepIds) {
            // Get all values for this step
            const stepValues = await storage.getStepValues(stepId);
            console.log(`  📋 Processing step ${stepId} with ${stepValues.length} columns`);
            console.log(`    Column names:`, stepValues.map(v => v.valueName));
            
            // Get all validations for this step
            const stepValidations = allValidations.filter(v => v.stepId === stepId);
            console.log(`    Found ${stepValidations.length} validations for this step`);
            
            // Group validations by identifierId to build complete row objects
            const rowsByIdentifier = new Map<string, any>();
            
            for (const validation of stepValidations) {
              if (!validation.identifierId) continue;
              
              // Initialize row object if not exists
              if (!rowsByIdentifier.has(validation.identifierId)) {
                rowsByIdentifier.set(validation.identifierId, {});
              }
              
              // Find the column name for this validation
              const stepValue = stepValues.find(v => v.id === validation.valueId || v.id === validation.fieldId);
              if (stepValue) {
                // Add this column's value to the row object
                rowsByIdentifier.get(validation.identifierId)[stepValue.valueName] = validation.extractedValue;
              }
            }
            
            // Convert to array of row objects
            const rowData = Array.from(rowsByIdentifier.values());
            console.log(`    Built ${rowData.length} complete row objects from ${rowsByIdentifier.size} unique identifiers`);
            if (rowData.length > 0) {
              console.log(`    Sample row:`, JSON.stringify(rowData[0], null, 2));
            } else {
              console.log(`    ⚠️ No row data built for this step!`);
            }
            
            // Now store this data for each referenced valueId from this step
            for (const refValueId of referencedValueIds) {
              if (valueIdToStep.get(refValueId) === stepId) {
                // Store the complete row data for this valueId
                dataByValueId.set(refValueId, rowData);
                const valueInfo = await storage.getStepValueById(refValueId);
                console.log(`    ✅ Stored ${rowData.length} complete rows for value: ${valueInfo?.valueName || 'Unknown'} (${refValueId})`);
              }
            }
          }
          
          console.log(`✅ Fetched cross-step reference data with complete row objects`);
          
          // Store the fetched data in a format that can be used below
          toolInputs.__crossStepData = dataByValueId;
        }
        
        if (previousData && previousData.length > 0) {
          console.log(`🎯 First previousData record structure:`, Object.keys(previousData[0]));
          console.log(`🎯 First previousData record sample:`, previousData[0]);
        }
        
        // Filter previous data to only include verified/valid records if we have them
        if (previousData && previousData.length > 0) {
          console.log(`🔍 Filtering previous data: ${previousData.length} records before filtering`);
          
          // Apply validation filtering if previousData is in validation format
          if (previousData[0].validationStatus) {
            console.log(`🔍 Data has validationStatus - applying filter`);
            previousData = filterVerifiedValidations(previousData, {
              includeManual: true,
              includeValid: true,
              includeVerified: true,
              includeExtracted: includeExtracted // Only include extracted if no verified data exists
            });
            console.log(`✅ After filtering: ${previousData.length} verified/valid records`);
          } else {
            console.log(`🔍 Data does NOT have validationStatus - skipping filter`);
          }
          
          // CRITICAL: Always ensure the first column from the step is included
          // Get all values from the current step
          const stepValues = await storage.getStepValues(stepId);
          const firstColumn = stepValues.find(v => v.isIdentifier) || stepValues[0];
          
          if (firstColumn && previousData.length > 0 && !(firstColumn.valueName in previousData[0])) {
            console.log(`📊 ADDING MISSING FIRST COLUMN: ${firstColumn.valueName}`);
            
            // Get validations for the first column to add its data
            const allValidations = await storage.getFieldValidations(sessionId);
            const firstColumnValidations = allValidations.filter(v => v.valueId === firstColumn.id || v.fieldId === firstColumn.id);
            console.log(`📊 Found ${firstColumnValidations.length} validations for first column`);
            
            // Create a map of identifierId to first column value
            const firstColumnMap = new Map();
            firstColumnValidations.forEach(v => {
              if (v.identifierId) {
                firstColumnMap.set(v.identifierId, v.extractedValue || '');
              }
            });
            
            // Add the first column data to each record
            previousData = previousData.map(record => {
              if (record.identifierId && firstColumnMap.has(record.identifierId)) {
                return {
                  ...record,
                  [firstColumn.valueName]: firstColumnMap.get(record.identifierId)
                };
              }
              return record;
            });
            
            console.log(`✅ Added first column "${firstColumn.valueName}" to all records`);
            if (previousData.length > 0) {
              console.log(`📊 Updated record structure:`, Object.keys(previousData[0]));
            }
          }
        }
        console.log(`🎯 Previous data available after filtering:`, previousData ? `${previousData.length} records` : 'None');
        
        // First, collect all UUID references and resolve them
        // uuidRegex already declared above
        const uuidToValueName = new Map();
        
        // Collect all unique UUIDs from input values
        const allUuids = new Set();
        for (const [paramName, paramValue] of Object.entries(value.inputValues)) {
          if (Array.isArray(paramValue)) {
            paramValue.forEach(item => {
              if (typeof item === 'string' && uuidRegex.test(item)) {
                allUuids.add(item);
              }
            });
          }
        }
        
        // Resolve all UUIDs to value names in parallel
        if (allUuids.size > 0) {
          console.log(`🆔 Resolving ${allUuids.size} UUID references to value names`);
          const uuidArray = Array.from(allUuids);
          const valueInfos = await Promise.all(
            uuidArray.map(uuid => storage.getStepValueById(uuid))
          );
          
          uuidArray.forEach((uuid, index) => {
            const valueInfo = valueInfos[index];
            if (valueInfo && valueInfo.valueName) {
              uuidToValueName.set(uuid, valueInfo.valueName);
              console.log(`🆔 Resolved UUID ${uuid} to: ${valueInfo.valueName}`);
            }
          });
        }
        
        // Look for references to previous columns (e.g., @Column Names)
        for (const [paramName, paramValue] of Object.entries(value.inputValues)) {
          // Check if paramValue is an array of references (like ["@Column Name Mapping.Column Names", "@Column Name Mapping.Worksheet Name"])
          if (Array.isArray(paramValue)) {
            console.log(`🔄 Processing array parameter ${paramName} with ${paramValue.length} items`);
            
            // Check if array contains references (@ references or UUID references)
            const hasReferences = paramValue.some(item => 
              typeof item === 'string' && (item.startsWith('@') || uuidRegex.test(item))
            );
            
            // Check if we should use cross-step data instead of previousData
            const hasCrossStepData = toolInputs.__crossStepData && toolInputs.__crossStepData.size > 0;
            
            if (hasReferences && (previousData && previousData.length > 0 || hasCrossStepData)) {
              // This is an array of column references - combine data from multiple columns
              const combinedData: any[] = [];
              
              // Handle cross-step references (data from other steps)
              if (hasCrossStepData && (!previousData || previousData.length === 0)) {
                console.log(`📊 Building data from cross-step references`);
                
                // Since all valueIds from the same step have the same row data,
                // we just need to get the data once (they all point to the same rows)
                let crossStepData = null;
                for (const ref of paramValue) {
                  if (typeof ref === 'string' && uuidRegex.test(ref)) {
                    const refData = toolInputs.__crossStepData.get(ref);
                    if (refData) {
                      crossStepData = refData;
                      console.log(`  Using ${refData.length} complete row objects from cross-step reference`);
                      break; // All valueIds from same step have same row data
                    }
                  }
                }
                
                if (crossStepData) {
                  // Pass the complete row objects as the parameter value
                  toolInputs[paramName] = crossStepData;
                  console.log(`✅ Set ${paramName} to ${crossStepData.length} complete row objects`);
                  if (crossStepData.length > 0) {
                    console.log(`  Sample row structure:`, Object.keys(crossStepData[0]));
                    console.log(`  First row:`, crossStepData[0]);
                  }
                }
                continue; // Skip to next parameter
              }
              
              console.log(`📊 Building combined data from ${previousData ? previousData.length : 0} records`);
              
              // Check if previousData is already in the proper format (with columns as properties)
              if (previousData[0].identifierId && !previousData[0].fieldName) {
                // Data is already properly formatted with column values as direct properties
                console.log(`✅ Previous data already has column properties directly`);
                console.log(`  Available columns:`, Object.keys(previousData[0]).filter(k => k !== 'identifierId'));
                
                // Get the first column (identifier) from the step - do this once outside the loop
                const stepValues = await storage.getStepValues(stepId);
                const firstColumn = stepValues.find(v => v.isIdentifier) || stepValues[0];
                
                // Build combined data by extracting only the requested columns
                for (const record of previousData) {
                  const combinedRecord: any = {
                    identifierId: record.identifierId
                  };
                  
                  // ALWAYS include the first column (identifier) from the step
                  if (firstColumn && record[firstColumn.valueName]) {
                    combinedRecord[firstColumn.valueName] = record[firstColumn.valueName];
                  }
                  
                  // Process each reference in the array
                  for (const ref of paramValue) {
                    if (typeof ref === 'string') {
                      let refColumnName = '';
                      
                      if (ref.startsWith('@')) {
                        // Handle @ reference
                        const refColumn = ref.substring(1);
                        refColumnName = refColumn;
                        
                        if (refColumn.includes('.')) {
                          const parts = refColumn.split('.');
                          refColumnName = parts[parts.length - 1];
                        }
                      } else if (uuidRegex.test(ref)) {
                        // Handle UUID reference - use pre-resolved value name
                        refColumnName = uuidToValueName.get(ref);
                        if (!refColumnName) {
                          console.warn(`⚠️ Could not resolve UUID reference: ${ref}`);
                          continue;
                        }
                      }
                      
                      if (refColumnName) {
                        // Add this column's value to the combined record
                        combinedRecord[refColumnName] = record[refColumnName] || null;
                      }
                    }
                  }
                  
                  combinedData.push(combinedRecord);
                }
              } else if (previousData[0].fieldName) {
                // Data is in validation record format - need to group by identifier
                console.log(`📊 Previous data is in validation format, grouping by identifier`);
                
                // Group previousData by identifierId to get all columns for each row
                const dataByIdentifier = new Map();
                previousData.forEach(record => {
                  if (!dataByIdentifier.has(record.identifierId)) {
                    dataByIdentifier.set(record.identifierId, {});
                  }
                  // Extract the column name from the field name (e.g., "Column Name Mapping.ID[0]" -> "ID")
                  const fieldParts = record.fieldName?.split('.') || [];
                  if (fieldParts.length > 1) {
                    const columnPart = fieldParts[fieldParts.length - 1];
                    const columnName = columnPart.replace(/\[\d+\]$/, ''); // Remove [index] suffix
                    dataByIdentifier.get(record.identifierId)[columnName] = record.extractedValue;
                  }
                });
                
                console.log(`📊 Grouped data by identifier: ${dataByIdentifier.size} unique rows`);
                
                // Now build combined records from grouped data
                dataByIdentifier.forEach((rowData, identifierId) => {
                  const combinedRecord: any = {
                    identifierId: identifierId
                  };
                  
                  // Process each reference in the array
                  for (const ref of paramValue) {
                    if (typeof ref === 'string') {
                      let refColumnName = '';
                      
                      if (ref.startsWith('@')) {
                        // Handle @ reference
                        const refColumn = ref.substring(1);
                        refColumnName = refColumn;
                        
                        if (refColumn.includes('.')) {
                          const parts = refColumn.split('.');
                          refColumnName = parts[parts.length - 1];
                        }
                      } else if (uuidRegex.test(ref)) {
                        // Handle UUID reference - use pre-resolved value name
                        refColumnName = uuidToValueName.get(ref);
                        if (!refColumnName) {
                          console.warn(`⚠️ Could not resolve UUID reference: ${ref}`);
                          continue;
                        }
                      }
                      
                      if (refColumnName) {
                        // Add this column's value to the combined record
                        combinedRecord[refColumnName] = rowData[refColumnName] || null;
                      }
                    }
                  }
                  
                  combinedData.push(combinedRecord);
                });
              }
              
              console.log(`📊 Combined ${combinedData.length} records from multiple references`);
              console.log(`  First 3 combined records:`, combinedData.slice(0, 3));
              console.log(`  Last combined record:`, combinedData[combinedData.length - 1]);
              console.log(`  Sample identifierIds:`, combinedData.slice(0, 5).map(r => r.identifierId));
              
              // Verify all records have unique identifierIds
              const uniqueIds = new Set(combinedData.map(r => r.identifierId));
              console.log(`  Unique identifierIds: ${uniqueIds.size} out of ${combinedData.length} records`);
              
              toolInputs[paramName] = combinedData;
            } else {
              // Direct array value (like document IDs)
              console.log(`➡️ Direct array value for ${paramName}:`, paramValue);
              toolInputs[paramName] = paramValue;
            }
          } else if (typeof paramValue === 'string' && paramValue.startsWith('@')) {
            // This is a single reference to a previous column
            const referencedColumn = paramValue.substring(1); // Remove @ symbol
            console.log(`🔗 Processing reference: ${paramValue} -> ${referencedColumn}`);
            
            // Handle different reference formats
            let actualColumnName = referencedColumn;
            
            // Check if this is a valueId reference (UUID format)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(referencedColumn)) {
              console.log(`🆔 ValueId reference detected: ${referencedColumn}`);
              
              // Look up the value name for this valueId in current session/project
              const valueInfo = await storage.getStepValueById(referencedColumn);
              if (valueInfo && valueInfo.valueName) {
                actualColumnName = valueInfo.valueName;
                console.log(`✅ Resolved valueId ${referencedColumn} to column name: ${actualColumnName}`);
              } else {
                console.log(`❌ Could not resolve valueId ${referencedColumn}`);
                actualColumnName = referencedColumn; // Fallback to the ID itself
              }
            } else {
              // If the reference is in format "StepName.ColumnName", extract just the column name
              if (referencedColumn.includes('.')) {
                const parts = referencedColumn.split('.');
                actualColumnName = parts[parts.length - 1]; // Get the last part after the dot
                console.log(`📊 Extracted column name from reference: ${actualColumnName}`);
              }
            }
            
            // Extract the values from previousData for this column
            if (previousData && previousData.length > 0) {
              console.log(`📊 Sample previous data record:`, previousData[0]);
              console.log(`📊 Looking for column name: "${actualColumnName}"`);
              console.log(`📊 Available properties in first record:`, Object.keys(previousData[0]));
              console.log(`📊 Does record have "${actualColumnName}" property?:`, previousData[0][actualColumnName] !== undefined);
              console.log(`📊 Value of "${actualColumnName}" property:`, previousData[0][actualColumnName]);
              
              // Check if previousData is already in the correct format (has identifierId and column values directly)
              if (previousData[0].identifierId && previousData[0][actualColumnName] !== undefined) {
                // Data is already properly formatted with identifierId and column values
                console.log(`✅ Previous data already has ${actualColumnName} property directly`);
                
                const columnValues = previousData
                  .filter(record => record[actualColumnName] !== undefined && record[actualColumnName] !== null)
                  .map(record => ({
                    identifierId: record.identifierId,
                    ID: record[actualColumnName], // Use the actual value from the column
                    extractedValue: record[actualColumnName], // Also include as extractedValue for compatibility
                    name: record[actualColumnName] // Also include as name for compatibility
                  }));
                
                console.log(`📊 Formatted ${columnValues.length} values for ${paramName}:`, 
                  columnValues.slice(0, 3).map(v => `${v.identifierId}: ${v.ID}`));
                  
                toolInputs[paramName] = columnValues;
              } else if (previousData[0].fieldName) {
                // Data is in validation record format with fieldName property
                console.log(`📊 Sample fieldNames in data:`, previousData.slice(0, 3).map(r => r.fieldName));
                
                // DYNAMIC APPROACH: Find the actual step value name that matches actualColumnName
                console.log(`🔍 DYNAMIC: Looking for step value with name "${actualColumnName}"`);
                
                // Get all step values for the current step to find the actual value name
                const currentStepId = value.stepId;
                if (currentStepId) {
                  const stepValues = await storage.getStepValues(currentStepId);
                  console.log(`📌 Found ${stepValues.length} values in current step`);
                  
                  // Find the referenced value by name 
                  const referencedValue = stepValues.find(v => v.valueName === actualColumnName);
                  if (referencedValue) {
                    console.log(`📌 Found referenced value: ${referencedValue.valueName} (ID: ${referencedValue.id})`);
                    
                    // Get validations for this specific value using its actual ID
                    const referencedValidations = previousData.filter((v: any) => 
                      v.valueId === referencedValue.id
                    );
                    
                    if (referencedValidations.length > 0) {
                      const columnValues = referencedValidations.map((record: any) => ({
                        identifierId: record.identifierId || `record-${record.recordIndex}`,
                        ID: record.extractedValue, // Use the actual extracted value
                        extractedValue: record.extractedValue, // Also include as extractedValue for compatibility
                        name: record.extractedValue // Also include as name for compatibility
                      }));
                      
                      console.log(`📌 DYNAMIC: Resolved @${actualColumnName} reference to ${columnValues.length} items using value ID ${referencedValue.id}`);
                      console.log(`📊 First 3 resolved values:`, columnValues.slice(0, 3).map(v => `${v.identifierId}: ${v.extractedValue}`));
                      toolInputs[paramName] = columnValues;
                    } else {
                      console.log(`⚠️ No validations found for referenced value: ${actualColumnName} (ID: ${referencedValue.id})`);
                      toolInputs[paramName] = [];
                    }
                  } else {
                    console.log(`⚠️ Referenced value "${actualColumnName}" not found in current step - falling back to field name matching`);
                    
                    // Fallback to original field name matching logic
                    const columnValues = previousData
                      .filter(record => {
                        // Filter for records that match this column name
                        const fieldParts = record.fieldName?.split('.') || [];
                        const matches = fieldParts.length > 1 ? 
                          fieldParts[fieldParts.length - 1].replace(/\[\d+\]$/, '') === actualColumnName :
                          false;
                        
                        if (matches) {
                          console.log(`✅ Matched: ${record.fieldName} -> ${actualColumnName}`);
                        }
                        return matches;
                      })
                      .map(record => ({
                        identifierId: record.identifierId,
                        ID: record.extractedValue, // Use the actual column name as field name
                        extractedValue: record.extractedValue, // Also include as extractedValue for compatibility
                        name: record.extractedValue // Also include as name for compatibility
                      }));
                    
                    console.log(`📊 Fallback formatted ${columnValues.length} values for ${paramName}:`, 
                      columnValues.slice(0, 3).map(v => `${v.identifierId}: ${v.name}`));
                    
                    if (columnValues.length === 0) {
                      console.log(`⚠️ No matching records found for column "${actualColumnName}"`);
                      console.log(`   Available fieldNames: ${[...new Set(previousData.map(r => r.fieldName))].slice(0, 10)}`);
                    }
                    
                    toolInputs[paramName] = columnValues;
                  }
                } else {
                  console.log(`⚠️ No stepId found for current value - using fallback approach`);
                  toolInputs[paramName] = [];
                }
              } else {
                console.log(`⚠️ Unexpected previousData format - no identifierId, no fieldName, and no ${actualColumnName} property`);
                console.log(`   Available properties: ${Object.keys(previousData[0])}`);
                toolInputs[paramName] = [];
              }
            } else {
              console.log(`⚠️ No previous data available for reference ${paramValue}`);
            }
          } else {
            // Direct value
            console.log(`➡️ Direct value for ${paramName}:`, paramValue);
            toolInputs[paramName] = paramValue;
          }
        }
      } else {
        console.log(`⚠️ No inputValues defined for this value`);
      }
      
      // Special handling for AI tools that expect List Item or Input Data but have null input
      // This is for cases like Standard Equivalent where previousData contains the merged column data
      // DATABASE_LOOKUP tools are AI-based and need the same filtering treatment
      if (tool.toolType === 'AI' || tool.toolType === 'AI_ONLY' || tool.toolType === 'DATABASE_LOOKUP') {
        const listItemParam = tool.inputParameters?.find(p => p.name === 'List Item');
        const inputDataParam = tool.inputParameters?.find(p => p.name === 'Input Data' && p.type === 'data');
        // Also check for generic 'data' type parameters that could receive the input data
        const anyDataParam = tool.inputParameters?.find(p => p.type === 'data');
        console.log(`🤖 AI tool detected. Has List Item param? ${!!listItemParam}, Has Input Data param? ${!!inputDataParam}, Has any data param? ${!!anyDataParam}, previousData records: ${previousData?.length || 0}`);
        
        // 🎯 CRITICAL FIX: For UPDATE operations, ALWAYS include previousData if available
        const isUpdateOperation = tool.operationType && tool.operationType.includes('update');
        const hasAutomaticDataFlow = !isFirstColumn && previousData && previousData.length > 0;
        console.log(`🔄 Is UPDATE operation? ${isUpdateOperation}`);
        console.log(`🎯 Has automatic data flow? ${hasAutomaticDataFlow}`);
        
        // Include data if:
        // 1. Tool has data parameters, OR
        // 2. It's an UPDATE operation, OR  
        // 3. It's a subsequent column with automatic data flow
        if ((listItemParam || inputDataParam || anyDataParam || isUpdateOperation || hasAutomaticDataFlow) && previousData && previousData.length > 0) {
          
          // CRITICAL: Ensure all referenced columns are available in previousData
          // Check if the value has array references that should be included
          if (value.inputValues) {
            console.log(`🔍 Checking if we need to rebuild previousData to include all referenced columns...`);
            
            // Find all array parameters that contain column references
            const allReferencedColumns = new Set<string>();
            
            for (const [paramName, paramValue] of Object.entries(value.inputValues)) {
              if (Array.isArray(paramValue)) {
                // Check if array contains references (either @-prefixed or UUID format)
                const hasReferences = paramValue.some(item => {
                  if (typeof item === 'string') {
                    return item.startsWith('@') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item);
                  }
                  return false;
                });
                
                if (hasReferences) {
                  console.log(`📋 Found array references in ${paramName}: ${paramValue.length} items`);
                  
                  // Extract all column names from the references
                  for (const ref of paramValue) {
                    if (typeof ref === 'string') {
                      let refColumnName = '';
                      
                      if (ref.startsWith('@')) {
                        // Handle @-prefixed references
                        const refColumn = ref.substring(1);
                        refColumnName = refColumn;
                        
                        if (refColumn.includes('.')) {
                          const parts = refColumn.split('.');
                          refColumnName = parts[parts.length - 1];
                        }
                      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
                        // Handle UUID references - look up the value name
                        console.log(`  🆔 Looking up value name for UUID: ${ref}`);
                        try {
                          const valueInfo = await storage.getStepValueById(ref);
                          if (valueInfo && valueInfo.valueName) {
                            refColumnName = valueInfo.valueName;
                            console.log(`  ✅ Resolved UUID ${ref.substring(0, 8)}... to column: ${refColumnName}`);
                          }
                        } catch (error) {
                          console.log(`  ❌ Failed to resolve UUID ${ref}: ${error}`);
                        }
                      }
                      
                      if (refColumnName) {
                        allReferencedColumns.add(refColumnName);
                        console.log(`  📌 Added referenced column: ${refColumnName}`);
                      }
                    }
                  }
                }
              }
            }
            
            // If we found referenced columns but previousData is missing some, rebuild it
            if (allReferencedColumns.size > 0) {
              console.log(`🔧 Found ${allReferencedColumns.size} referenced columns:`, Array.from(allReferencedColumns));
              
              // Check what columns are currently available in previousData
              const availableColumns = previousData.length > 0 ? Object.keys(previousData[0]).filter(k => k !== 'identifierId') : [];
              console.log(`📊 Available columns in previousData:`, availableColumns);
              
              const missingColumns = Array.from(allReferencedColumns).filter(col => !availableColumns.includes(col));
              if (missingColumns.length > 0) {
                console.log(`❌ Missing columns in previousData:`, missingColumns);
                console.log(`🔧 Need to rebuild previousData with all referenced columns...`);
                
                // Get fresh validations data to rebuild complete previousData
                const allValidations = await storage.getFieldValidations(sessionId);
                const stepValidations = allValidations.filter(v => v.stepId === step.id);
                
                console.log(`📋 Found ${stepValidations.length} validations for step ${step.stepName}`);
                
                // Group by identifierId to rebuild complete records
                const dataByIdentifier = new Map();
                
                for (const validation of stepValidations) {
                  if (!validation.identifierId) continue;
                  
                  if (!dataByIdentifier.has(validation.identifierId)) {
                    dataByIdentifier.set(validation.identifierId, { identifierId: validation.identifierId });
                  }
                  
                  // Extract column name from valueId or fieldName
                  let columnName = '';
                  if (validation.valueId) {
                    // Look up value name by valueId
                    const valueInfo = await storage.getStepValueById(validation.valueId);
                    if (valueInfo) {
                      columnName = valueInfo.valueName;
                    }
                  }
                  
                  // Include ALL columns from the step, not just referenced ones
                  // This ensures complete data is available for AI reasoning
                  if (columnName) {
                    dataByIdentifier.get(validation.identifierId)[columnName] = validation.extractedValue;
                    console.log(`  ✅ Added ${columnName} for identifier ${validation.identifierId?.substring(0, 8)}...`);
                  }
                }
                
                // Convert back to array format
                const rebuiltData = Array.from(dataByIdentifier.values());
                console.log(`🔧 Rebuilt previousData with ${rebuiltData.length} records containing all referenced columns`);
                console.log(`   Sample rebuilt record:`, rebuiltData[0]);
                
                // Use the rebuilt data instead of the original previousData
                previousData = rebuiltData;
                
                // CRITICAL: Also replace any existing toolInputs['List Item'] with the complete data
                if (toolInputs['List Item']) {
                  console.log(`🔄 Replacing existing incomplete List Item data with rebuilt complete data`);
                }
                // The rebuilt previousData will be used to create the List Item below
              }
            }
          }
          // CRITICAL: Prioritize records for extraction based on their validation status
          // Get existing validations for this value to check which records are already validated
          const existingValidations = await storage.getFieldValidations(sessionId);
          const valueValidations = existingValidations.filter(v => v.valueId === valueId);
          
          // Create a map of identifierId to validation status for quick lookup
          const validationStatusMap = new Map<string, string>();
          for (const validation of valueValidations) {
            if (validation.identifierId) {
              validationStatusMap.set(validation.identifierId, validation.validationStatus || 'pending');
            }
          }
          
          // Separate records into categories based on their extraction/validation status
          const notExtractedRecords: any[] = [];
          const pendingRecords: any[] = [];
          const validatedRecords: any[] = [];
          
          for (const record of previousData) {
            const identifierId = record.identifierId;
            const validation = identifierId ? valueValidations.find(v => v.identifierId === identifierId) : null;
            
            if (!validation || validation.extractedValue === null || validation.extractedValue === undefined) {
              // Not yet extracted - highest priority
              notExtractedRecords.push(record);
            } else if (validation.validationStatus === 'pending') {
              // Already extracted but pending validation - second priority
              pendingRecords.push(record);
            } else if (validation.validationStatus === 'valid' || validation.validationStatus === 'verified') {
              // Already validated or verified - do not include in extraction
              validatedRecords.push(record);
            } else {
              // Unknown status - treat as pending
              pendingRecords.push(record);
            }
          }
          
          console.log(`📊 Record prioritization for extraction:`);
          console.log(`  🔴 Not extracted: ${notExtractedRecords.length} records`);
          console.log(`  🟡 Pending: ${pendingRecords.length} records`);
          console.log(`  🟢 Validated/Verified: ${validatedRecords.length} records (will NOT be extracted)`);
          if (validatedRecords.length > 0) {
            const sampleIds = validatedRecords.slice(0, 3).map(r => r.identifierId);
            console.log(`  📋 Sample validated identifierIds: ${sampleIds.join(', ')}`);
          }
          
          // Build the batch maintaining original order but excluding validated records
          // CRITICAL: Maintain the original order from previousData to ensure correct mapping
          const eligibleData = previousData.filter(record => {
            const identifierId = record.identifierId;
            const validation = identifierId ? valueValidations.find(v => v.identifierId === identifierId) : null;
            
            // Include if not validated/verified (pending or not extracted)
            return !validation || (validation.validationStatus !== 'valid' && validation.validationStatus !== 'verified');
          });
          
          // Apply 50-record limit for AI tools to prevent excessive processing
          const limitedPreviousData = eligibleData.slice(0, 50);
          console.log(`🎯 AI tool expects List Item - using ${limitedPreviousData.length} records (from ${eligibleData.length} eligible, ${previousData.length} total)`);
          
          if (limitedPreviousData.length > 0) {
            console.log(`  First record:`, limitedPreviousData[0]);
            console.log(`  Last record:`, limitedPreviousData[limitedPreviousData.length - 1]);
          }
          
          // CRITICAL: Ensure the first column is always included for context
          // Get the first column from the step to ensure it's included
          const stepValues = await storage.getStepValues(stepId);
          const firstColumn = stepValues.find(v => v.isIdentifier) || stepValues[0];
          
          console.log(`📊 DEBUG: Step values count: ${stepValues.length}`);
          console.log(`📊 DEBUG: First column: ${firstColumn?.valueName || 'NOT FOUND'}`);
          console.log(`📊 DEBUG: Limited previous data count: ${limitedPreviousData.length}`);
          if (limitedPreviousData.length > 0) {
            console.log(`📊 DEBUG: Keys in first record:`, Object.keys(limitedPreviousData[0]));
            console.log(`📊 DEBUG: Full first record:`, limitedPreviousData[0]);
          }
          
          if (firstColumn && limitedPreviousData.length > 0) {
            const hasFirstColumn = firstColumn.valueName in limitedPreviousData[0];
            console.log(`📊 DEBUG: Has first column "${firstColumn.valueName}"? ${hasFirstColumn}`);
            
            if (!hasFirstColumn) {
              console.log(`📊 CRITICAL: First column "${firstColumn.valueName}" missing from data - fetching from database`);
            
            // Get all validations to find first column values
            const firstColumnValidations = existingValidations.filter(v => 
              (v.valueId === firstColumn.id || v.fieldId === firstColumn.id)
            );
            
            // Build map of identifierId to first column value
            const firstColumnMap = new Map();
            firstColumnValidations.forEach(v => {
              if (v.identifierId) {
                firstColumnMap.set(v.identifierId, v.extractedValue || '');
              }
            });
            
            console.log(`📊 Built map with ${firstColumnMap.size} first column values`);
            
            // Add first column to each record
            limitedPreviousData.forEach(record => {
              if (record.identifierId && firstColumnMap.has(record.identifierId)) {
                record[firstColumn.valueName] = firstColumnMap.get(record.identifierId);
              }
            });
            
            console.log(`✅ Added first column "${firstColumn.valueName}" to all records`);
            }
          }
          
          // Format previousData for the AI tool - it should contain merged column information
          // Use the correct parameter name based on what the tool expects
          const dataParamName = inputDataParam ? 'Input Data' : 
                               anyDataParam ? anyDataParam.name :
                               'List Item';
          toolInputs[dataParamName] = limitedPreviousData.map(record => {
            // Include identifierId and all column values from the record
            const formattedRecord: any = {};
            
            // Always include identifierId if present
            if (record.identifierId) {
              formattedRecord.identifierId = record.identifierId;
            }
            
            // CRITICAL: Always put the first column second (after identifierId) for consistency
            if (firstColumn && record[firstColumn.valueName] !== undefined) {
              formattedRecord[firstColumn.valueName] = record[firstColumn.valueName];
            }
            
            // Include all other fields from the record (except identifierId and first column which are already added)
            for (const [key, value] of Object.entries(record)) {
              if (key !== 'identifierId' && key !== firstColumn?.valueName) {
                formattedRecord[key] = value;
              }
            }
            
            return formattedRecord;
          });
          
          console.log(`✅ 🎯 AUTOMATIC DATA FLOW APPLIED: Populated ${dataParamName} with ${toolInputs[dataParamName].length} records`);
          console.log(`  📊 Incremental data: Each record contains identifierId + ${Object.keys(toolInputs[dataParamName][0] || {}).filter(k => k !== 'identifierId').length} previous columns`);
          console.log(`  📝 Sample records:`, toolInputs[dataParamName].slice(0, 2));
          
          if (!isFirstColumn) {
            console.log(`🚀 AUTOMATIC DATA FLOW SUCCESS: Column "${value.valueName}" has full context from previous columns`);
          }
        }
      }
      
      // Add document content if the tool expects it
      if (tool.inputParameters?.some(p => p.name === 'document' || p.name === 'document_content')) {
        toolInputs.document = documentContent;
        console.log(`📚 Added document content to tool inputs (${documentContent?.length || 0} chars)`);
      }
      
      // Map inputValues (with parameter IDs) to tool parameters using IDs only
      if (value.inputValues && Object.keys(value.inputValues).length > 0) {
        console.log(`📐 Mapping inputValues to tool parameters using IDs...`);
        
        // For each tool parameter, check if there's a corresponding inputValue by parameter ID
        for (const param of tool.inputParameters || []) {
          // Use param.id to find the configured value
          if (param.id && value.inputValues[param.id] !== undefined) {
            const configuredValue = value.inputValues[param.id];
            console.log(`🔗 Found inputValue config for parameter ${param.name} (ID: ${param.id}):`, configuredValue);
            
            // Check if this is an array of value IDs (cross-step reference)
            if (Array.isArray(configuredValue)) {
              const hasUUIDs = configuredValue.some(item => 
                typeof item === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)
              );
              
              if (hasUUIDs) {
                // These are value IDs - fetch the data for these values
                console.log(`📊 Fetching data for parameter ${param.name} using value IDs:`, configuredValue);
                
                // Get all validations for the session
                const allValidations = await storage.getFieldValidations(sessionId);
                console.log(`  📊 Total validations in session: ${allValidations.length}`);
                
                // Collect data for each referenced value ID
                const parameterData: any[] = [];
                const processedSteps = new Set<string>();
                
                for (const valueId of configuredValue) {
                  if (typeof valueId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valueId)) {
                    // Get value info to find its step
                    const valueInfo = await storage.getStepValueById(valueId);
                    if (!valueInfo) {
                      console.log(`  ⚠️ Value not found: ${valueId}`);
                      continue;
                    }
                    
                    // Get the actual step value with stepId
                    const fullValueInfo = await storage.getStepValue(valueId);
                    const actualStepId = fullValueInfo?.stepId || valueInfo.stepId;
                    
                    if (!actualStepId) {
                      console.log(`  ⚠️ No stepId found for value ${valueId}`);
                      continue;
                    }
                    
                    console.log(`  🔍 Value ${valueInfo.valueName} belongs to step ${actualStepId}`);
                    
                    // If we haven't processed this step yet, get all its data
                    if (!processedSteps.has(actualStepId)) {
                      processedSteps.add(actualStepId);
                      
                      // Get all values for this step to build complete rows
                      const stepValues = await storage.getStepValues(actualStepId);
                      
                      // Debug: Check what's in allValidations
                      console.log(`  🔍 Checking validations for step ${actualStepId}`);
                      let stepValidations = allValidations.filter(v => v.stepId === actualStepId);
                      
                      // Alternative: Try filtering by valueId if stepId doesn't work
                      if (stepValidations.length === 0) {
                        console.log(`  🔍 No validations found by stepId, trying by valueId...`);
                        const valueIdValidations = allValidations.filter(v => 
                          stepValues.some(sv => sv.id === v.valueId || sv.id === v.fieldId)
                        );
                        console.log(`    Found ${valueIdValidations.length} validations by valueId match`);
                        
                        if (valueIdValidations.length > 0) {
                          stepValidations = valueIdValidations;
                        }
                      }
                      
                      console.log(`  📋 Processing step ${actualStepId} for value ${valueInfo.valueName}`);
                      console.log(`    Found ${stepValidations.length} validations, ${stepValues.length} columns`);
                      
                      // Build row objects filtered by expectedFields configuration
                      const rowsByIdentifier = new Map<string, any>();
                      
                      // Check if parameter has expectedFields configuration
                      const expectedFields = param.expectedFields;
                      console.log(`    Parameter ${param.name} expectedFields:`, expectedFields);
                      
                      for (const validation of stepValidations) {
                        if (!validation.identifierId) continue;
                        
                        if (!rowsByIdentifier.has(validation.identifierId)) {
                          rowsByIdentifier.set(validation.identifierId, {});
                        }
                        
                        // Find the column name for this validation
                        const stepValue = stepValues.find(v => v.id === validation.valueId || v.id === validation.fieldId);
                        if (stepValue) {
                          // Only include field if it's in expectedFields (or if no expectedFields specified)
                          if (!expectedFields || expectedFields.includes(stepValue.valueName)) {
                            rowsByIdentifier.get(validation.identifierId)[stepValue.valueName] = validation.extractedValue;
                            console.log(`      ✅ Including field: ${stepValue.valueName}`);
                          } else {
                            console.log(`      ❌ Skipping field: ${stepValue.valueName} (not in expectedFields)`);
                          }
                        }
                      }
                      
                      // Add these rows to the parameter data
                      const rows = Array.from(rowsByIdentifier.values());
                      if (rows.length > 0) {
                        parameterData.push(...rows);
                        console.log(`    Added ${rows.length} rows to parameter data`);
                      }
                    }
                  }
                }
                
                // Set the parameter data
                if (parameterData.length > 0) {
                  toolInputs[param.name] = parameterData;
                  console.log(`✅ Set ${param.name} to ${parameterData.length} rows from cross-step references`);
                  if (parameterData.length > 0) {
                    console.log(`  Sample row:`, parameterData[0]);
                  }
                } else {
                  console.log(`  ❌ No data found for parameter ${param.name}`);
                }
              } else {
                // Direct value (not UUIDs)
                // Check if this is an array with 'user_document' placeholder
                if (Array.isArray(configuredValue) && configuredValue.includes('user_document')) {
                  // Replace 'user_document' with actual document content
                  const replacedValue = configuredValue.map(item => 
                    item === 'user_document' && documentContent 
                      ? documentContent 
                      : item
                  );
                  
                  // For Excel/file parameters with single item, extract the string
                  if (replacedValue.length === 1 && typeof replacedValue[0] === 'string' && 
                      (param.name.toLowerCase().includes('excel') || param.name.toLowerCase().includes('file'))) {
                    toolInputs[param.name] = replacedValue[0];
                    console.log(`✅ Mapped Excel file content to ${param.name} (${replacedValue[0].length} chars)`);
                  } else {
                    toolInputs[param.name] = replacedValue;
                    console.log(`✅ Mapped replaced array to ${param.name}`);
                  }
                } else {
                  toolInputs[param.name] = configuredValue;
                  console.log(`✅ Mapped direct value to ${param.name}`);
                }
              }
            } else {
              // Single value
              toolInputs[param.name] = configuredValue;
              console.log(`✅ Mapped single value to ${param.name}`);
            }
          }
        }
      }
      
      // Ensure all configured inputs are passed for both CODE and AI tools
      for (const param of tool.inputParameters || []) {
        // Check if we already have a value for this parameter
        if (toolInputs[param.name] !== undefined && toolInputs[param.name] !== null) {
          console.log(`📝 Tool parameter ${param.name} already has value`);
        } else if (param.type === 'document' && documentContent) {
          // Add document content for document-type parameters
          console.log(`📄 Adding session document content for tool parameter: ${param.name}`);
          toolInputs[param.name] = documentContent;
        } else if (param.type === 'data' && toolInputs['List Item']) {
          // Map List Item to data-type parameters for AI tools
          console.log(`📊 Mapping List Item to data parameter: ${param.name}`);
          toolInputs[param.name] = toolInputs['List Item'];
        } else {
          // Check if there's a matching value in the resolved toolInputs
          const possibleKeys = [
            param.name,
            param.name.toLowerCase(),
            param.name.replace(/\s+/g, '_').toLowerCase(),
            param.name.replace(/\s+/g, '')
          ];
          
          for (const key of possibleKeys) {
            if (toolInputs[key] !== undefined) {
              toolInputs[param.name] = toolInputs[key];
              console.log(`📝 Mapped ${key} to tool parameter ${param.name}`);
              break;
            }
          }
          
          if (toolInputs[param.name] === undefined) {
            console.log(`⚠️ No value found for tool parameter ${param.name}`);
          }
        }
      }
      
      // STANDARDIZED DOCUMENT LOADING FOR ALL AI TOOLS
      // This process is IDENTICAL for every AI tool - no special cases
      const documentParams = tool.inputParameters?.filter(p => p.type === 'document') || [];
      
      for (const docParam of documentParams) {
        const paramKey = docParam.id || docParam.name;
        
        // Skip if this parameter already has content
        if (toolInputs[paramKey] || toolInputs[docParam.name]) {
          console.log(`✅ Document parameter ${docParam.name} already has content`);
          continue;
        }
        
        console.log(`📄 Processing document parameter: ${docParam.name}`);
        
        // Check if there are reference document IDs configured for this parameter
        const refDocIds = value.inputValues?.[paramKey] || 
                         value.inputValues?.[docParam.name];
        
        if (refDocIds) {
          const { loadReferenceDocuments, extractDocumentIds } = await import('./referenceDocumentLoader');
          const documentIds = extractDocumentIds(refDocIds);
          
          if (documentIds.length > 0) {
            console.log(`  📚 Loading ${documentIds.length} reference documents for ${docParam.name}...`);
            const content = await loadReferenceDocuments(documentIds, session.projectId);
            
            // Set reference document content for this parameter
            // Use both ID and name as keys for maximum compatibility
            toolInputs[paramKey] = content;
            toolInputs[docParam.name] = content;
            
            console.log(`  ✅ Loaded ${content.length} chars of reference content`);
            if (content.length > 100) {
              console.log(`  📄 Preview: ${content.substring(0, 100)}...`);
            }
          } else {
            console.log(`  ⚠️ No valid document IDs found in configuration`);
          }
        } else {
          console.log(`  ℹ️ No reference documents configured for this parameter`);
        }
      }
      
      // Also pass project ID for tools that may need it
      toolInputs.projectId = session.projectId;
      
      // CRITICAL: Pass the value configuration itself to the tool
      // This tells the AI what specific field to extract
      toolInputs.valueConfiguration = {
        valueName: value.valueName,
        description: value.description || value.valueName,
        valueId: value.id,
        stepName: step.stepName,
        inputValues: value.inputValues || {} // CRITICAL: Include the inputValues from the value!
      };
      console.log(`📝 Added value configuration: ${value.valueName}`);
      console.log(`📝 Value configuration inputValues:`, value.inputValues);
      
      // Pass session document content for user_document placeholder replacement
      if (documentContent) {
        toolInputs.sessionDocumentContent = documentContent;
        console.log(`📄 Added sessionDocumentContent for user_document replacement (${documentContent.length} chars)`);
      }
      
      // Log what we're about to send to the tool
      console.log(`🔧 FINAL tool inputs being sent to ${tool.name}:`);
      for (const [key, value] of Object.entries(toolInputs)) {
        if (Array.isArray(value)) {
          console.log(`  ${key}: Array with ${value.length} items`);
          if (value.length > 0 && value.length <= 5) {
            console.log(`    Items:`, value);
          } else if (value.length > 0) {
            console.log(`    First 3 items:`, value.slice(0, 3));
          }
        } else if (typeof value === 'string') {
          console.log(`  ${key}: String (${value.length} chars)`);
          if (value.length <= 100) {
            console.log(`    Content: "${value}"`);
          }
        } else {
          console.log(`  ${key}:`, value);
        }
      }
      
      console.log(`🚀 REACHED REPLACEMENT SECTION - this should always appear`);
      
      // Replace 'user_document' placeholders with actual session document content
      // This must happen AFTER parameter mapping but BEFORE tool execution
      console.log(`🔍 Debug - documentContent available: ${!!documentContent}, length: ${documentContent?.length || 0}`);
      
      if (documentContent) {
        console.log(`🔄 Checking for 'user_document' placeholders to replace...`);
        for (const [key, value] of Object.entries(toolInputs)) {
          if (Array.isArray(value)) {
            // Check if array contains 'user_document'
            if (value.length === 1 && value[0] === 'user_document') {
              console.log(`📄 Replacing ['user_document'] in ${key} with actual document content`);
              toolInputs[key] = documentContent;
            } else if (value.includes('user_document')) {
              console.log(`📄 Replacing 'user_document' in array ${key} with document content`);
              // Replace the user_document element with the actual content
              toolInputs[key] = value.map(v => v === 'user_document' ? documentContent : v);
            }
          } else if (value === 'user_document') {
            console.log(`📄 Replacing 'user_document' placeholder in ${key} with session document content`);
            toolInputs[key] = documentContent;
          }
        }
      } else {
        console.log(`⚠️ No documentContent available - cannot replace 'user_document' placeholders`);
      }
      
      console.log(`📥 Tool inputs prepared:`, JSON.stringify(toolInputs, null, 2));
      
      // Override with custom inputs from user selection modal
      if (customInputs && Object.keys(customInputs).length > 0) {
        console.log(`🎛️ Applying custom inputs from user selection modal:`, JSON.stringify(customInputs, null, 2));
        
        // Merge custom inputs, allowing them to override default inputs
        for (const [key, value] of Object.entries(customInputs)) {
          if (value !== undefined && value !== null && value !== '') {
            console.log(`  🔧 Setting ${key} = ${JSON.stringify(value)} (was: ${JSON.stringify(toolInputs[key])})`);
            toolInputs[key] = value;
          }
        }
        
        console.log(`✅ Final tool inputs after custom input override:`, JSON.stringify(toolInputs, null, 2));
      }
      
      // Add value configuration to tool inputs so AI tools can access inputValues
      if (value.inputValues) {
        console.log(`📝 Adding value configuration to tool inputs for AI instructions`);
        console.log(`📝 Raw inputValues structure:`, JSON.stringify(value.inputValues, null, 2));
        
        toolInputs['valueConfiguration'] = {
          valueName: value.valueName,
          description: value.description,
          stepName: step.stepName,
          inputValues: value.inputValues
        };
        
        // Extract AI Query from inputValues - look for text instructions
        // inputValues can have various keys like "0.xyz" or named parameters
        let aiInstructions = '';
        for (const [key, val] of Object.entries(value.inputValues)) {
          console.log(`  Checking inputValue [${key}]: ${typeof val} = ${JSON.stringify(val)}`);
          
          if (typeof val === 'string') {
            // Skip pure data references (like "@Column.Name")
            if (val.startsWith('@') && val.split(' ').length === 1) {
              console.log(`    -> Skipping data reference: ${val}`);
              continue;
            }
            
            // This is instruction text
            if (val.trim().length > 0) {
              aiInstructions = val;
              console.log(`    -> Found AI instruction: "${val}"`);
              break;
            }
          }
        }
        
        if (aiInstructions) {
          toolInputs['AI Query'] = aiInstructions;
          console.log(`🎯 Final AI Query set to: "${aiInstructions}"`);
        } else {
          console.log(`⚠️ No AI instructions found in inputValues`);
        }
      }
      
      
      // CRITICAL: Check for UPDATE operation FIRST
      const isUpdateOperation = tool.operationType?.toLowerCase().includes('update') && value.orderIndex && value.orderIndex > 0;
      
      // Parse inputParameters early if it's a string - REQUIRED for UUID resolution to work
      let parsedToolParams = tool.inputParameters || [];
      if (typeof parsedToolParams === 'string') {
        try {
          parsedToolParams = JSON.parse(parsedToolParams);
          console.log(`📊 Early-parsed inputParameters from string:`, parsedToolParams.map((p: any) => `${p.name} (${p.type}, id: ${p.id})`));
        } catch (e) {
          console.error('Failed to early-parse inputParameters:', e);
          parsedToolParams = [];
        }
      }
      
      // Execute the tool using the tool engine
      console.log(`\n🔧 EXECUTING TOOL: ${tool.name}`);
      console.log(`   Tool ID: ${tool.id}`);
      console.log(`   Tool Type: ${tool.toolType}`);
      console.log(`   Operation Type: ${tool.operationType || 'not set'}`);
      console.log(`   Output Type: ${tool.outputType || 'single'}`);
      console.log(`   Has AI Prompt: ${!!tool.aiPrompt}`);
      console.log(`   Has Function Code: ${!!tool.functionCode}`);
      console.log(`   LLM Model: ${tool.llmModel || 'default'}`);
      console.log(`   🔄 Is UPDATE Operation: ${isUpdateOperation}`);
      console.log(`   📋 Parsed inputParameters: ${parsedToolParams.length} params`);
      
      // Map inputValues ONLY for non-UPDATE operations
      // For UPDATE operations, skip parameter mapping entirely - incremental builder will provide data
      if (!isUpdateOperation && value.inputValues && Object.keys(value.inputValues).length > 0 && parsedToolParams.length > 0) {
        console.log(`📐 Mapping inputValues to tool parameters using IDs...`);
        console.log(`📐 Available inputValues keys: ${Object.keys(value.inputValues)}`);
        
        // For each tool parameter, check if there's a corresponding inputValue by parameter ID
        for (const param of parsedToolParams) {
          // Use param.id to find the configured value
          if (param.id && value.inputValues[param.id] !== undefined) {
            const configuredValue = value.inputValues[param.id];
            console.log(`🔗 Found inputValue config for parameter ${param.name} (ID: ${param.id}):`, configuredValue);
            
            // Check if this is an array of value IDs (cross-step reference)
            if (Array.isArray(configuredValue)) {
              const hasUUIDs = configuredValue.some(item => 
                typeof item === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)
              );
              
              if (hasUUIDs) {
                // These are value IDs - fetch the data for these values
                console.log(`📊 Fetching data for parameter ${param.name} using value IDs:`, configuredValue);
                
                // Get all validations for the session
                const allValidations = await storage.getFieldValidations(sessionId);
                console.log(`  📊 Total validations in session: ${allValidations.length}`);
                
                // Collect data for each referenced value ID
                const parameterData: any[] = [];
                const processedSteps = new Set<string>();
                
                for (const valueId of configuredValue) {
                  if (typeof valueId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valueId)) {
                    // Get value info to find its step
                    const valueInfo = await storage.getStepValueById(valueId);
                    if (!valueInfo) {
                      console.log(`  ⚠️ Value not found: ${valueId}`);
                      continue;
                    }
                    
                    // Get the actual step value with stepId
                    const fullValueInfo = await storage.getStepValue(valueId);
                    const actualStepId = fullValueInfo?.stepId || valueInfo.stepId;
                    
                    if (!actualStepId) {
                      console.log(`  ⚠️ No stepId found for value ${valueId}`);
                      continue;
                    }
                    
                    console.log(`  🔍 Value ${valueInfo.valueName} belongs to step ${actualStepId}`);
                    
                    // If we haven't processed this step yet, get all its data
                    if (!processedSteps.has(actualStepId)) {
                      processedSteps.add(actualStepId);
                      
                      // Get all values for this step to build complete rows
                      const stepValues = await storage.getStepValues(actualStepId);
                      
                      // Debug: Check what's in allValidations
                      console.log(`  🔍 Checking validations for step ${actualStepId}`);
                      let stepValidations = allValidations.filter(v => v.stepId === actualStepId);
                      
                      // Alternative: Try filtering by valueId if stepId doesn't work
                      if (stepValidations.length === 0) {
                        console.log(`  🔍 No validations found by stepId, trying by valueId...`);
                        const valueIdValidations = allValidations.filter(v => 
                          stepValues.some(sv => sv.id === v.valueId || sv.id === v.fieldId)
                        );
                        console.log(`    Found ${valueIdValidations.length} validations by valueId match`);
                        
                        if (valueIdValidations.length > 0) {
                          stepValidations = valueIdValidations;
                        }
                      }
                      
                      console.log(`  📋 Processing step ${actualStepId} for value ${valueInfo.valueName}`);
                      console.log(`    Found ${stepValidations.length} validations, ${stepValues.length} columns`);
                      
                      // Build row objects filtered by expectedFields configuration
                      const rowsByIdentifier = new Map<string, any>();
                      
                      // Check if parameter has expectedFields configuration
                      const expectedFields = param.expectedFields;
                      console.log(`    Parameter ${param.name} expectedFields:`, expectedFields);
                      
                      for (const validation of stepValidations) {
                        if (!validation.identifierId) continue;
                        
                        if (!rowsByIdentifier.has(validation.identifierId)) {
                          rowsByIdentifier.set(validation.identifierId, {});
                        }
                        
                        // Find the column name for this validation
                        const stepValue = stepValues.find(v => v.id === validation.valueId || v.id === validation.fieldId);
                        if (stepValue) {
                          // Only include field if it's in expectedFields (or if no expectedFields specified)
                          if (!expectedFields || expectedFields.includes(stepValue.valueName)) {
                            rowsByIdentifier.get(validation.identifierId)[stepValue.valueName] = validation.extractedValue;
                            console.log(`      ✅ Including field: ${stepValue.valueName}`);
                          } else {
                            console.log(`      ❌ Skipping field: ${stepValue.valueName} (not in expectedFields)`);
                          }
                        }
                      }
                      
                      // Add these rows to the parameter data
                      const rows = Array.from(rowsByIdentifier.values());
                      if (rows.length > 0) {
                        parameterData.push(...rows);
                        console.log(`    Added ${rows.length} rows to parameter data`);
                      }
                    }
                  }
                }
                
                // Set the parameter data
                if (parameterData.length > 0) {
                  toolInputs[param.name] = parameterData;
                  console.log(`✅ Set ${param.name} to ${parameterData.length} rows from cross-step references`);
                  if (parameterData.length > 0) {
                    console.log(`  Sample row:`, parameterData[0]);
                  }
                } else {
                  console.log(`  ❌ No data found for parameter ${param.name}`);
                }
              } else {
                // Direct value (not UUIDs)
                // Check if this is an array with 'user_document' placeholder
                if (Array.isArray(configuredValue) && configuredValue.includes('user_document')) {
                  // Replace 'user_document' with actual document content
                  const replacedValue = configuredValue.map(item => 
                    item === 'user_document' && documentContent 
                      ? documentContent 
                      : item
                  );
                  
                  // For Excel/file parameters with single item, extract the string
                  if (replacedValue.length === 1 && typeof replacedValue[0] === 'string' && 
                      (param.name.toLowerCase().includes('excel') || param.name.toLowerCase().includes('file'))) {
                    toolInputs[param.name] = replacedValue[0];
                    console.log(`✅ Mapped Excel file content to ${param.name} (${replacedValue[0].length} chars)`);
                  } else {
                    toolInputs[param.name] = replacedValue;
                    console.log(`✅ Mapped replaced array to ${param.name}`);
                  }
                } else {
                  toolInputs[param.name] = configuredValue;
                  console.log(`✅ Mapped direct value to ${param.name}`);
                }
              }
            } else {
              // Single value
              toolInputs[param.name] = configuredValue;
              console.log(`✅ Mapped single value to ${param.name}`);
            }
          }
        }
      }
      
      // Special handling for multi-field Info Page values
      if (value.fields && value.fields.length > 0) {
        console.log(`\n📋 MULTI-FIELD EXTRACTION DETECTED:`);
        console.log(`   Value Name: ${value.valueName}`);
        console.log(`   Number of Fields: ${value.fields.length}`);
        console.log(`   Fields to Extract:`, value.fields.map((f: any) => `${f.name} (${f.dataType})`));
        
        // Add field definitions to tool inputs for AI extraction
        toolInputs.__infoPageFields = value.fields;
        console.log(`   Added __infoPageFields to toolInputs for AI processing`);
      }
      
      // 🎯 CRITICAL FIX: Include automatic data flow previousData in tool inputs
      // This ensures the comprehensive previousData built earlier reaches the extraction processor
      if (previousData && previousData.length > 0) {
        console.log(`🔄 🎯 ADDING AUTOMATIC DATA FLOW to tool inputs:`);
        console.log(`   previousData records: ${previousData.length}`);
        console.log(`   Will be available to extraction processor as inputArray`);
        
        // Add previousData to toolInputs so it reaches the extraction processor
        toolInputs.previousData = previousData;
        
        // Also add it as specific parameter names that AI tools might expect
        toolInputs['Input Data'] = previousData;
        toolInputs['List Item'] = previousData;
        
        if (previousData.length > 0) {
          console.log(`   Sample record structure:`, Object.keys(previousData[0]));
          console.log(`   First record:`, previousData[0]);
        }
      }
      
      // Clean up internal data before passing to tool
      const cleanedToolInputs = { ...toolInputs };
      delete cleanedToolInputs.__crossStepData; // Remove internal cross-step data
      
      // Also remove the raw parameter IDs (like 0.880fzw5k308) from the inputs
      // But preserve special fields like _dataSourceId
      if (value.inputValues) {
        for (const paramId of Object.keys(value.inputValues)) {
          // Preserve _dataSourceId for DATABASE_LOOKUP tools
          if (paramId === '_dataSourceId') {
            cleanedToolInputs._dataSourceId = value.inputValues[paramId];
          } else {
            delete cleanedToolInputs[paramId];
          }
        }
      }
      
      // 📝 LOG FINAL TOOL INPUTS for debugging
      console.log(`📝 FINAL TOOL INPUTS being passed to toolEngine:`);
      console.log(`   Keys: ${Object.keys(cleanedToolInputs)}`);
      if (cleanedToolInputs.previousData) {
        console.log(`   ✅ previousData included: ${cleanedToolInputs.previousData.length} records`);
      }
      if (cleanedToolInputs['Input Data']) {
        console.log(`   ✅ 'Input Data' included: ${cleanedToolInputs['Input Data'].length} records`);
      }
      if (cleanedToolInputs['List Item']) {
        console.log(`   ✅ 'List Item' included: ${cleanedToolInputs['List Item'].length} records`);
      }
      
      console.log(`🚨 SIMPLE DEBUG - About to call toolEngine with keys:`, Object.keys(cleanedToolInputs));
      if (cleanedToolInputs.previousData) {
        console.log(`🚨 SIMPLE DEBUG - previousData exists with ${cleanedToolInputs.previousData.length} records`);
      }
      if (cleanedToolInputs['Input Data']) {
        console.log(`🚨 SIMPLE DEBUG - Input Data exists with ${cleanedToolInputs['Input Data'].length} records`);  
      }
      
      const { toolEngine } = await import("./toolEngine");
      
      // Use already-parsed inputParameters from earlier (line 8128-8138)
      // parsedToolParams was already parsed before UUID resolution
      
      const results = await toolEngine.testTool({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        toolType: tool.toolType,
        inputParameters: parsedToolParams,
        functionCode: tool.functionCode,
        aiPrompt: tool.aiPrompt || tool.description,
        outputType: tool.outputType,
        operationType: tool.operationType,
        llmModel: tool.llmModel,
        metadata: tool.metadata || {}
      }, cleanedToolInputs, undefined, undefined, undefined, stepId, value.orderIndex, sessionId);
      
      console.log(`✅ Tool execution completed. Results count: ${results?.length || 0}`);
      
      // Log the first few results to verify they contain all required fields
      if (results && results.length > 0) {
        console.log(`📊 Verifying tool results contain all validation fields:`);
        console.log(`  First result:`, JSON.stringify(results[0], null, 2));
        if (results.length > 1) {
          console.log(`  Second result:`, JSON.stringify(results[1], null, 2));
        }
        
        // Check if results have the required fields
        const firstResult = results[0];
        console.log(`  ✓ Has extractedValue: ${firstResult.extractedValue !== undefined}`);
        console.log(`  ✓ Has validationStatus: ${firstResult.validationStatus !== undefined}`);
        console.log(`  ✓ Has aiReasoning: ${firstResult.aiReasoning !== undefined}`);
        console.log(`  ✓ Has confidenceScore: ${firstResult.confidenceScore !== undefined}`);
        console.log(`  ✓ Has documentSource: ${firstResult.documentSource !== undefined}`);
      }
      
      // Save the results as field validations
      if (results && results.length > 0) {
        // Simple processing - ensure all results have required fields
        let processedResults = results.map(result => ({
          identifierId: result.identifierId || null,
          extractedValue: result.extractedValue !== undefined ? result.extractedValue : null,
          validationStatus: result.validationStatus || "pending", // Always default to pending for new extractions
          aiReasoning: result.aiReasoning || "",
          confidenceScore: result.confidenceScore || 0,
          documentSource: result.documentSource || ""
        }));
        
        // For CREATE operations (like "Find Missing Items"), filter out null results
        // Only save records that actually have values
        const isCreateOperation = tool?.operationType?.startsWith('create');
        if (isCreateOperation) {
          const originalCount = processedResults.length;
          processedResults = processedResults.filter(r => {
            const value = r.extractedValue;
            // Filter out null, undefined, empty, and "Not Found" values
            return value !== null && 
                   value !== undefined && 
                   value !== '' &&
                   value !== 'null' &&
                   value !== 'undefined' &&
                   value !== 'Not Found' &&
                   value !== 'not found' &&
                   value !== 'NOT FOUND' &&
                   !String(value).toLowerCase().includes('not found');
          });
          console.log(`🔍 CREATE operation: Filtered ${originalCount} results to ${processedResults.length} with actual values`);
        }
        
        // Get existing validations to update based on identifier ID
        const existingValidations = await storage.getFieldValidations(sessionId);
        
        // CRITICAL: If this is a re-extraction of the first column, clean up old records
        // Check if we're extracting the first column (no previousData) but have existing records
        if ((!previousData || previousData.length === 0) && existingValidations.length > 0) {
          // Check if there are existing records for THIS specific column
          const existingColumnValidations = existingValidations.filter(v => v.valueId === valueId);
          
          if (existingColumnValidations.length > processedResults.length) {
            console.log(`🧹 CLEANUP: Found ${existingColumnValidations.length} existing records but only ${processedResults.length} new results`);
            console.log(`   This indicates orphaned records from previous extractions`);
            
            // Delete all existing validations for this column to start fresh
            // This prevents duplicate rows from accumulating
            for (const validation of existingColumnValidations) {
              await storage.deleteFieldValidation(validation.id);
              console.log(`   🗑️ Deleted orphaned validation: ${validation.id}`);
            }
            
            // Clear the array so we don't try to match against deleted records
            existingValidations.length = 0;
            existingValidations.push(...await storage.getFieldValidations(sessionId));
          }
        }
        
        // If previousData is provided, create a Set of valid identifierIds
        // This is the source of truth for row identifiers
        let validIdentifierIds: Set<string> = new Set();
        let previousDataIndex: Map<string, number> = new Map(); // Map identifierId to its index in previousData array
        
        // CRITICAL: Use the index of the identifier in the previousData array
        // This ensures consistent row positioning across all column extractions
        if (previousData && previousData.length > 0) {
          console.log(`📊 Building index map from ${previousData.length} records in previousData`);
          
          for (let i = 0; i < previousData.length; i++) {
            const record = previousData[i];
            if (record.identifierId) {
              validIdentifierIds.add(record.identifierId);
              previousDataIndex.set(record.identifierId, i);
              
              if (i < 5) {
                console.log(`  Record index ${i} -> identifierId: ${record.identifierId}`);
              }
            }
          }
          
          console.log(`📊 Mapped ${validIdentifierIds.size} identifierIds to their array indices`);
          
          // CRITICAL VALIDATION: Check if the identifierIds in previousData actually exist in the database
          // This prevents creating orphaned rows when anchor records have been deleted
          if (validIdentifierIds.size > 0) {
            console.log(`🔍 Validating ${validIdentifierIds.size} identifierIds from previousData against existing database records...`);
            
            // Get existing validations for this step/table to verify anchors exist
            const stepValidations = existingValidations.filter(v => v.stepId === stepId);
            const existingIdentifierIds = new Set<string>();
            
            for (const validation of stepValidations) {
              if (validation.identifierId) {
                existingIdentifierIds.add(validation.identifierId);
              }
            }
            
            console.log(`📊 Found ${existingIdentifierIds.size} existing identifierIds in database for this step`);
            
            // Check how many of the previousData identifierIds actually exist
            let matchingCount = 0;
            for (const id of validIdentifierIds) {
              if (existingIdentifierIds.has(id)) {
                matchingCount++;
              } else {
                console.log(`⚠️ IdentifierId ${id} from previousData not found in database - likely deleted`);
              }
            }
            
            console.log(`✅ ${matchingCount} out of ${validIdentifierIds.size} identifierIds from previousData exist in database`);
            
            // If NONE of the previousData identifierIds exist, this means all anchor records were deleted
            // Return 409 Conflict to inform the user they need to re-extract the first column
            if (matchingCount === 0) {
              console.error(`❌ CRITICAL: No anchor records found! All ${validIdentifierIds.size} identifierIds from previousData have been deleted.`);
              console.error(`   User must re-extract the first column before extracting additional columns.`);
              
              return res.status(409).json({
                success: false,
                message: "The base rows for this extraction have been deleted. Please re-extract the first column before extracting additional columns.",
                error: "MISSING_ANCHOR_RECORDS",
                details: {
                  providedIdentifierCount: validIdentifierIds.size,
                  existingIdentifierCount: 0,
                  stepId: stepId,
                  valueId: valueId
                }
              });
            }
            
            // If only SOME identifierIds exist, log a warning but continue
            // The extraction will only update/create records for the existing anchors
            if (matchingCount < validIdentifierIds.size) {
              const missingCount = validIdentifierIds.size - matchingCount;
              console.warn(`⚠️ WARNING: ${missingCount} out of ${validIdentifierIds.size} anchor records are missing (deleted).`);
              console.warn(`   Extraction will proceed with ${matchingCount} existing anchors only.`);
            }
          }
        }
        
        // CRITICAL: Initialize ALL validation records upfront when extracting the first column
        // This ensures all rows have validation records for all columns, even if we only extract 50 at a time
        if ((!previousData || previousData.length === 0) && processedResults.length > 0) {
          console.log(`🚀 FIRST COLUMN EXTRACTION DETECTED - Initializing ALL validation records upfront`);
          console.log(`   ValueId: ${valueId}, StepId: ${stepId}`);
          console.log(`   Processing ${processedResults.length} results in this batch`);
          
          // Check if this is the identifier field (first column)
          const stepValue = await storage.getStepValue(valueId);
          if (stepValue?.isIdentifier) {
            console.log(`✅ Confirmed this is the IDENTIFIER column: ${stepValue.valueName}`);
            
            // Check if validation records already exist for other columns in this step
            const existingStepValidations = existingValidations.filter(v => v.stepId === stepId);
            const uniqueIdentifiers = new Set(existingStepValidations.map(v => v.identifierId).filter(id => id));
            
            if (uniqueIdentifiers.size === 0 || uniqueIdentifiers.size < processedResults.length) {
              console.log(`🔍 Current state: ${uniqueIdentifiers.size} unique identifierIds exist in database`);
              console.log(`🔍 New extraction: ${processedResults.length} results to process`);
              console.log(`📊 ACTION: Will initialize ALL validation records for complete dataset`);
              
              // Extract ALL identifierIds from the results
              const allIdentifierIds: string[] = [];
              for (let i = 0; i < processedResults.length; i++) {
                const result = processedResults[i];
                // Use AI's identifierId if provided, otherwise generate one
                const identifierId = result.identifierId || crypto.randomUUID();
                allIdentifierIds.push(identifierId);
                
                // Update the result with the identifierId so it's used in the save loop below
                processedResults[i].identifierId = identifierId;
              }
              
              console.log(`📋 Collected ${allIdentifierIds.length} identifierIds from extraction results`);
              console.log(`   First 5 identifierIds: ${allIdentifierIds.slice(0, 5).join(', ')}`);
              
              // Initialize ALL validation records for ALL columns in this step
              try {
                await storage.initializeAllValidationRecords(sessionId, stepId, allIdentifierIds);
                console.log(`✅ Successfully initialized ${allIdentifierIds.length} complete rows with all columns`);
              } catch (error) {
                console.error(`❌ Failed to initialize validation records:`, error);
                // Don't fail the extraction, continue and let individual saves happen
              }
            } else {
              console.log(`ℹ️ Validation records already exist (${uniqueIdentifiers.size} identifiers) - skipping initialization`);
            }
          } else {
            console.log(`ℹ️ This is NOT the identifier column (isIdentifier=${stepValue?.isIdentifier}) - skipping upfront initialization`);
          }
        } else if (previousData && previousData.length > 0) {
          console.log(`ℹ️ Subsequent column extraction (previousData provided) - validation records should already exist`);
        }
        
        // Create new validations ONLY for the actual AI results returned
        // Important: processedResults contains only the records that AI actually processed
        console.log(`📊 Processing ${processedResults.length} actual AI results (not creating validations for unprocessed records)`);
        
        for (let i = 0; i < processedResults.length; i++) {
          const result = processedResults[i];
          
          // Get the identifier ID - trust what the AI returns if it's valid
          let identifierId: string | null = null;
          let recordIndex = i; // Default to the result index
          
          // If we have previousData, validate and use the AI's identifierId
          if (validIdentifierIds.size > 0) {
            // Check if the AI returned a valid identifierId
            if (result.identifierId && validIdentifierIds.has(result.identifierId)) {
              // AI returned a valid identifierId - use it
              identifierId = result.identifierId;
              // Get the original index for this identifierId
              recordIndex = previousDataIndex.get(identifierId) ?? i;
              console.log(`✅ AI returned valid identifierId: ${identifierId} (original index: ${recordIndex})`);
            } else if (result.identifierId) {
              // AI returned an identifierId but it's not in our valid set
              console.log(`⚠️ AI returned unknown identifierId: ${result.identifierId} - generating new one`);
              identifierId = crypto.randomUUID();
            } else {
              // AI didn't return an identifierId - generate one
              console.log(`⚠️ AI didn't return identifierId for position ${i} - generating new one`);
              identifierId = crypto.randomUUID();
            }
          } else {
            // This is the first column being extracted
            if (result.identifierId) {
              // Trust the AI's identifierId for first column
              identifierId = result.identifierId;
              console.log(`🔗 Using AI's identifierId for first column at position ${i}: ${identifierId}`);
            } else {
              // Generate new UUID if AI didn't provide one
              identifierId = crypto.randomUUID();
              console.log(`🔗 Generated new UUID identifierId for first column at position ${i}: ${identifierId}`);
            }
          }
          
          // Format field name to match UI expectations: "StepName.ValueName[index]"
          const fieldName = `${step.stepName}.${value.valueName}[${recordIndex}]`;
          
          // Check if validation already exists for this identifier/record index
          // CRITICAL: Match by identifierId (row ID), not fieldName
          let existingValidation = null;
          
          // First, check if this is a re-extraction of the same column
          // For first column extractions, we need to check for existing records by valueId and recordIndex
          if (!previousData || previousData.length === 0) {
            // This is a first column or re-extraction of first column
            // Check for existing validation by valueId and recordIndex to prevent duplicates
            existingValidation = existingValidations.find(v => 
              v.valueId === valueId && 
              v.recordIndex === recordIndex
            );
            
            // If we found an existing validation, use its identifierId
            if (existingValidation && existingValidation.identifierId) {
              identifierId = existingValidation.identifierId;
              console.log(`🔄 Re-extraction: Using existing identifierId ${identifierId} for record at index ${recordIndex}`);
            }
          } else if (identifierId) {
            // For subsequent columns: match by identifierId AND correct valueId
            existingValidation = existingValidations.find(v => 
              v.identifierId === identifierId && 
              v.valueId === valueId
            );
            
            // Don't look for wrong valueId validations - they likely belong to other columns
            // Only create new validations if none exist for this specific row+column combo
          } else {
            // Fallback for edge cases
            existingValidation = existingValidations.find(v => 
              v.valueId === valueId && 
              v.recordIndex === recordIndex
            );
          }
          
          if (existingValidation) {
            // Check if the field is already validated or verified
            if (existingValidation.validationStatus === 'valid' || existingValidation.validationStatus === 'verified') {
              // DO NOT overwrite validated/verified fields
              console.log(`✅ Skipping ${fieldName} - already validated/verified`);
              continue; // Skip to next result
            }
            
            // Only update if field is pending or not yet extracted
            if (existingValidation.validationStatus === 'pending' || 
                existingValidation.extractedValue === null || 
                existingValidation.extractedValue === undefined) {
              
              // Check if the new value is meaningful before updating
              const extractedVal = result.extractedValue;
              const shouldSkipUpdate = !extractedVal || 
                (typeof extractedVal === 'string' && (
                  extractedVal.trim() === '' ||
                  extractedVal.trim().toLowerCase() === 'not found' ||
                  extractedVal.trim().toLowerCase() === 'n/a' ||
                  extractedVal.trim().toLowerCase() === 'none' ||
                  extractedVal.trim() === '-'
                ));
              
              if (shouldSkipUpdate) {
                console.log(`⏭️ Skipping update for ${fieldName} - no meaningful value ("${extractedVal}")`);
              } else {
                await storage.updateFieldValidation(existingValidation.id, {
                  extractedValue: result.extractedValue,
                  validationStatus: 'pending', // Set to pending for new extractions
                  aiReasoning: result.aiReasoning,
                  confidenceScore: typeof result.confidenceScore === 'number' && result.confidenceScore <= 1 
                    ? Math.round(result.confidenceScore * 100) // Convert decimal (0-1) to percentage (0-100)
                    : result.confidenceScore || 0,
                  documentSource: result.documentSource,
                  identifierId: identifierId,
                  valueId: valueId, // CRITICAL: Update valueId to ensure it's correct for this column
                  fieldId: valueId, // Also update fieldId to match
                  extractedAt: new Date()
                });
                console.log(`📝 Updated validation for ${fieldName} with value: "${result.extractedValue}" (was ${existingValidation.validationStatus})`);
              }
            } else {
              console.log(`⚠️ Skipping update for ${fieldName} - unexpected validation status: ${existingValidation.validationStatus}`);
            }
          } else {
            // Check if the extracted value is meaningful before creating a validation record
            const extractedVal = result.extractedValue;
            const shouldSkipRecord = !extractedVal || 
              (typeof extractedVal === 'string' && (
                extractedVal.trim() === '' ||
                extractedVal.trim().toLowerCase() === 'not found' ||
                extractedVal.trim().toLowerCase() === 'n/a' ||
                extractedVal.trim().toLowerCase() === 'none' ||
                extractedVal.trim() === '-'
              ));
            
            if (shouldSkipRecord) {
              console.log(`⏭️ Skipping validation creation for ${fieldName} - no meaningful value ("${extractedVal}")`);
              continue; // Skip to next result
            }
            
            // Create new validation only for meaningful values
            // In the unified architecture, collectionId should be the stepId for Data Tables
            // This maintains the parent-child relationship: Step (collection) -> Values (columns)
            
            // Simple create - use result directly
            await storage.createFieldValidation({
              id: crypto.randomUUID(),
              sessionId: sessionId,
              fieldId: valueId,
              valueId: valueId,
              stepId: stepId,
              collectionId: stepId,
              fieldName: fieldName,
              recordIndex: recordIndex,
              identifierId: identifierId,
              extractedValue: result.extractedValue,
              validationType: 'collection_property',
              validationStatus: 'pending', // Always set to pending for new extractions
              dataType: 'text',
              aiReasoning: result.aiReasoning,
              confidenceScore: typeof result.confidenceScore === 'number' && result.confidenceScore <= 1 
                ? Math.round(result.confidenceScore * 100) // Convert decimal (0-1) to percentage (0-100)
                : result.confidenceScore || 0,
              documentSource: result.documentSource,
              manuallyVerified: false,
              manuallyUpdated: false,
              collectionName: step.stepName,
              extractedAt: new Date()
            });
            console.log(`✨ Created validation for ${fieldName} with value: "${result.extractedValue}"`);
            console.log(`   🔑 Using valueId: ${valueId} (${value.valueName})`);
          }
        }
        
        console.log(`💾 Saved ${processedResults.length} validation records`);
      }
      
      res.json({ 
        success: true, 
        message: `Extracted ${results?.length || 0} values for ${value.valueName}`,
        resultsCount: results?.length || 0
      });
      
    } catch (error) {
      console.error("Column extraction error:", error);
      res.status(500).json({ message: "Failed to extract column data" });
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
      const python = spawn('python3', ['services/document_extractor.py']);
      
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

  // Get workflow test job status
  app.get("/api/projects/:projectId/test-workflow/job/:jobId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { jobId } = req.params;
      const { jobManager } = await import('./jobManager');
      
      const job = jobManager.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
      
      res.json({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          result: job.result,
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt
        }
      });
    } catch (error) {
      console.error('Error getting job status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job status'
      });
    }
  });
  
  // Test workflow endpoint
  app.post("/api/projects/:projectId/test-workflow", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId } = req.params;
      const { documentId, documentContent: frontendDocContent, valueConfig, previousResults, async: useAsync } = req.body;
      
      console.log('\n🔍 TEST WORKFLOW ENDPOINT HIT');
      console.log('  📝 Request body keys:', Object.keys(req.body));
      console.log('  📝 Document ID:', documentId);
      console.log('  📝 Frontend doc content length:', frontendDocContent?.length || 0);
      console.log('  📝 Value config tool:', valueConfig?.toolId);
      
      // Load the test document content from database if we have a documentId
      let documentContent = frontendDocContent;
      if (documentId) {
        console.log('📄 ATTEMPTING TO LOAD TEST DOCUMENT FROM DATABASE');
        console.log('  📄 Document ID:', documentId);
        const testDoc = await storage.getTestDocument(documentId);
        console.log('  📄 Test doc retrieved:', !!testDoc);
        if (testDoc) {
          console.log('  📄 Test doc fields:', Object.keys(testDoc));
          // Use the correct field name based on what's in the database
          const content = testDoc.extractedContent || testDoc.extracted_content;
          if (content) {
            documentContent = content;
            console.log('  ✅ Loaded document content from DB:', documentContent.length, 'chars');
            console.log('  📋 Content preview:', documentContent.substring(0, 200) + '...');
            console.log('  📋 Content has sheet markers:', documentContent.includes('=== Sheet:'));
          } else {
            console.log('  ⚠️ Test document has no extracted content');
            console.log('  📄 Available fields:', Object.entries(testDoc).map(([k,v]) => `${k}: ${typeof v === 'string' ? v.length + ' chars' : typeof v}`).join(', '));
          }
        } else {
          console.log('  ⚠️ Test document not found in database');
        }
      } else {
        console.log('⚠️ No documentId provided, using frontend content');
      }
      
      console.log('🧪 Test Workflow Request:');
      console.log('  Project:', projectId);
      console.log('  Document:', documentId);
      console.log('  Document Content Length:', documentContent?.length || 0);
      console.log('  Value Config:', valueConfig);
      console.log('  Previous Results Available:', previousResults ? Object.keys(previousResults).length : 0);
      console.log('  Async Mode:', useAsync || false);
      
      // Import jobManager dynamically
      const { jobManager } = await import('./jobManager');
      
      // Check if we should process asynchronously (for large datasets)
      // Increased threshold to 500 items to ensure sequential processing for most workflows
      const shouldUseAsync = useAsync || (previousResults && Object.values(previousResults).some((v: any) => 
        Array.isArray(v) && v.length > 500
      ));
      
      console.log('🔍 ASYNC CHECK:');
      console.log('  useAsync flag:', useAsync);
      console.log('  Has large arrays (>500):', previousResults && Object.values(previousResults).some((v: any) => Array.isArray(v) && v.length > 500));
      console.log('  Should use async:', shouldUseAsync);
      
      if (shouldUseAsync) {
        console.log('📦 Using async processing for large dataset');
        const jobId = jobManager.createJob(projectId);
        
        // Start async processing
        processWorkflowTestAsync(jobId, projectId, documentId, documentContent, valueConfig, previousResults);
        
        return res.json({
          success: true,
          jobId,
          message: 'Test started in background'
        });
      }
      
      // Debug: Log the actual previous results
      if (previousResults) {
        console.log('\n📋 PREVIOUS RESULTS DETAILS:');
        for (const [key, value] of Object.entries(previousResults)) {
          if (Array.isArray(value)) {
            console.log(`  ${key}: Array with ${value.length} items`);
            if (value.length > 0 && value[0]) {
              console.log(`    Sample: ${JSON.stringify(value[0]).slice(0, 100)}...`);
            }
          } else {
            console.log(`  ${key}: ${typeof value}`);
          }
        }
        console.log('');
      }
      
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
          
          // Log incoming data for this function
          console.log('\n📥 INPUT DATA FOR FUNCTION:', excelFunction.name);
          console.log('=' .repeat(60));
          console.log('Step:', valueConfig.stepName);
          console.log('Value:', valueConfig.valueName);
          console.log('Raw Input Values:', Object.keys(valueConfig.inputValues));
          console.log('Previous Results Available:', previousResults ? Object.keys(previousResults) : 'None');
          console.log('=' .repeat(60));
          
          // Prepare input values, replacing document parameters with test document content
          const preparedInputValues = { ...valueConfig.inputValues };
          
          console.log('\n🔍 REFERENCE RESOLUTION START');
          console.log('  Step being processed:', valueConfig.stepName, '>', valueConfig.valueName);
          console.log('  Input values to process:', JSON.stringify(valueConfig.inputValues, null, 2));
          console.log('  Previous results keys available:', previousResults ? Object.keys(previousResults) : 'None');
          
          // Extra debugging for exact key matching
          if (previousResults) {
            console.log('  📋 Detailed previousResults structure:');
            for (const [key, value] of Object.entries(previousResults)) {
              console.log(`    "${key}" => ${Array.isArray(value) ? `Array[${value.length}]` : typeof value}`);
            }
          }
          
          // Special logging for Standard Mapping
          if (valueConfig.valueName === 'Standard Mapping') {
            console.log('🎯 SPECIAL DEBUG FOR STANDARD MAPPING:');
            console.log('  Full previousResults structure:', JSON.stringify(Object.keys(previousResults || {}), null, 2));
            console.log('  Looking for references in inputValues:', valueConfig.inputValues);
            if (previousResults) {
              for (const [key, value] of Object.entries(previousResults)) {
                if (Array.isArray(value)) {
                  console.log(`  previousResults["${key}"] = Array with ${value.length} items`);
                  if (value.length > 0) {
                    console.log(`    First item:`, value[0]);
                  }
                }
              }
            }
            
            // Check what the input values are looking for
            if (valueConfig.inputValues) {
              for (const [paramKey, paramValue] of Object.entries(valueConfig.inputValues)) {
                console.log(`  📍 Input parameter "${paramKey}":`, paramValue);
                if (Array.isArray(paramValue)) {
                  for (const ref of paramValue) {
                    if (typeof ref === 'string' && ref.startsWith('@')) {
                      const lookingFor = ref.slice(1);
                      console.log(`    → Looking for: "${lookingFor}"`);
                      console.log(`    → Found in previousResults: ${previousResults && previousResults[lookingFor] ? 'YES ✅' : 'NO ❌'}`);
                    }
                  }
                }
              }
            }
          }
          
          // Special handling for AI tools - compile merged array BEFORE sending
          if ((excelFunction?.toolType === 'AI' || excelFunction?.toolType === 'AI_ONLY') && 
              valueConfig.valueName === 'Standard Mapping') {
            console.log('\n🎯 SPECIAL HANDLING FOR STANDARD MAPPING AI TOOL');
            console.log('  This is the critical step that needs merged data!');
            console.log('  Current preparedInputValues:', JSON.stringify(preparedInputValues, null, 2));
            
            // Look for the List Item parameter that needs merged data
            for (const [key, value] of Object.entries(preparedInputValues)) {
              console.log(`  🔍 Checking parameter "${key}":`, value);
              
              // Handle both string and array cases
              let shouldMerge = false;
              
              // Case 1: Comma-separated string of references
              if (typeof value === 'string' && value.includes('@') && value.includes(',')) {
                console.log(`    📌 Found comma-separated reference string!`);
                const refs = value.split(',').map(r => r.trim());
                const hasColumnRef = refs.some(r => r.includes('Column Name'));
                const hasWorksheetRef = refs.some(r => r.includes('Worksheet Name'));
                shouldMerge = hasColumnRef && hasWorksheetRef;
              }
              // Case 2: Array with references
              else if (Array.isArray(value)) {
                console.log(`    Array detected with ${value.length} items`);
                console.log(`    First item:`, value[0]);
                console.log(`    Second item:`, value.length > 1 ? value[1] : 'N/A');
                
                // Check if it contains the references we're looking for
                const hasColumnRef = value.some(v => typeof v === 'string' && v.includes('Column Name'));
                const hasWorksheetRef = value.some(v => typeof v === 'string' && v.includes('Worksheet Name'));
                shouldMerge = hasColumnRef && hasWorksheetRef;
              }
              
              if (shouldMerge) {
                console.log('  📌 FOUND THE LIST ITEM PARAMETER WITH REFERENCES!');
                console.log('  📌 Parameter key:', key);
                console.log('  📌 Need to merge Column Names and Worksheet Name arrays');
                
                // Debug what we have in previousResults
                console.log('  📋 DEBUG: previousResults structure:');
                if (previousResults) {
                  for (const [k, v] of Object.entries(previousResults)) {
                    if (Array.isArray(v)) {
                      console.log(`    "${k}": Array[${v.length}]`);
                      if (v.length > 0) {
                        console.log(`      First item:`, v[0]);
                      }
                    } else {
                      console.log(`    "${k}": ${typeof v}`);
                    }
                  }
                }
                
                // Get the actual data from previousResults - try all possible keys
                const columnNames = previousResults?.['Column Name Mapping.Column Names'] || 
                                   previousResults?.['Column Names'] || 
                                   previousResults?.['Column Name Mapping.Column Name'] || [];
                const worksheetNames = previousResults?.['Column Name Mapping.Worksheet Name'] || 
                                      previousResults?.['Worksheet Name'] || 
                                      previousResults?.['Column Name Mapping.Worksheet Names'] || [];
                
                console.log(`  📊 Column Names: ${columnNames.length} items`);
                console.log(`  📊 Worksheet Names: ${worksheetNames.length} items`);
                console.log(`  📊 Available previousResults keys:`, Object.keys(previousResults || {}));
                
                if (columnNames.length > 0 && worksheetNames.length > 0) {
                  // Create the merged array
                  const mergedArray: any[] = [];
                  const maxLength = Math.min(columnNames.length, worksheetNames.length);
                  
                  console.log(`  🔄 Creating merged array with ${maxLength} items`);
                  
                  for (let i = 0; i < maxLength; i++) {
                    const columnItem = columnNames[i];
                    const worksheetItem = worksheetNames[i];
                    
                    const columnValue = columnItem?.extractedValue !== undefined ? 
                                       columnItem.extractedValue : columnItem;
                    const worksheetValue = worksheetItem?.extractedValue !== undefined ? 
                                          worksheetItem.extractedValue : worksheetItem;
                    
                    mergedArray.push({
                      "Column Name": columnValue,
                      "Worksheet Name": worksheetValue
                    });
                  }
                  
                  console.log(`  ✅ SUCCESSFULLY CREATED MERGED ARRAY: ${mergedArray.length} items`);
                  console.log(`  📊 First merged item:`, JSON.stringify(mergedArray[0]));
                  console.log(`  📊 Second merged item:`, JSON.stringify(mergedArray[1]));
                  console.log(`  📊 Third merged item:`, JSON.stringify(mergedArray[2]));
                  console.log(`  📊 Last merged item:`, JSON.stringify(mergedArray[mergedArray.length - 1]));
                  
                  // CRITICAL: Replace the parameter with the merged array
                  preparedInputValues[key] = mergedArray;
                  console.log(`  ✅✅✅ REPLACED PARAMETER "${key}" WITH ${mergedArray.length} MERGED ITEMS`);
                  console.log(`  ✅ AI tool will now receive proper merged data array`);
                  
                  // Break after handling the first matching parameter
                  break;
                } else {
                  console.log('  ❌ ERROR: Missing data for merging!');
                  console.log('  ❌ Column Names available:', columnNames.length);
                  console.log('  ❌ Worksheet Names available:', worksheetNames.length);
                  console.log('  ❌ Available keys:', Object.keys(previousResults || {}));
                }
              }
            }
          }
          
          // Standard reference resolution for other cases
          console.log('\n🔧 REFERENCE RESOLUTION PHASE');
          console.log('  Tool type:', excelFunction?.toolType);
          console.log('  Tool is AI?', excelFunction?.toolType === 'AI' || excelFunction?.toolType === 'AI_ONLY');
          console.log('  Input parameters to resolve:', Object.keys(preparedInputValues));
          
          // Check for @-references in input values and replace with previous results
          for (const [key, value] of Object.entries(preparedInputValues)) {
            console.log(`\n  📍 Processing parameter "${key}"`);
            console.log(`    Raw value:`, JSON.stringify(value).substring(0, 200));
            console.log(`    Value type: ${typeof value}, isArray: ${Array.isArray(value)}`);
            
            // Skip if we already handled this parameter above
            if (valueConfig.valueName === 'Standard Mapping' && Array.isArray(value) && 
                value.length > 0 && typeof value[0] === 'object') {
              console.log('    ✅ Already processed as merged array, skipping reference resolution');
              continue;
            }
            
            // Handle comma-separated string of references (common in AI tool data parameters)
            if (typeof value === 'string' && value.includes('@') && value.includes(',')) {
              console.log(`  📌 COMMA-SEPARATED REFERENCES DETECTED!`);
              console.log(`    Full string: "${value}"`);
              const references = value.split(',').map(ref => ref.trim());
              console.log(`    Split into ${references.length} parts:`, references);
              
              // Process as if it were an array of references
              const allReferences = references.filter(ref => ref.startsWith('@'));
              if (allReferences.length > 0) {
                console.log(`  Found ${allReferences.length} @ references to resolve`);
                
                // Collect all referenced data
                const allReferencedData: any[] = [];
                const referenceMap: {[key: string]: any[]} = {};
                
                for (const ref of allReferences) {
                  const referencePath = ref.slice(1); // Remove @ prefix
                  console.log(`    Processing reference: ${ref} -> ${referencePath}`);
                  
                  // Debug: Log exact key lookup
                  console.log(`      🔍 Looking for key: "${referencePath}" in previousResults`);
                  console.log(`      Available keys:`, previousResults ? Object.keys(previousResults) : 'No previousResults');
                  
                  if (previousResults && previousResults[referencePath]) {
                    const previousData = previousResults[referencePath];
                    referenceMap[referencePath] = previousData;
                    console.log(`      ✅ Found ${Array.isArray(previousData) ? previousData.length : 1} items for ${referencePath}`);
                  } else {
                    console.log(`      ⚠️ No previous results found for "${referencePath}"`);
                    
                    // Try alternate key formats  
                    const alternateKeys = [
                      referencePath.replace('Column Name Mapping.', ''),  // Try without step name
                      referencePath.split('.').pop() || referencePath,  // Try just the value name
                    ];
                    
                    let found = false;
                    for (const altKey of alternateKeys) {
                      if (previousResults && previousResults[altKey]) {
                        console.log(`        ✅ Found data with alternate key: "${altKey}" - ${Array.isArray(previousResults[altKey]) ? previousResults[altKey].length : 1} items`);
                        referenceMap[referencePath] = previousResults[altKey];
                        found = true;
                        break;
                      }
                    }
                    
                    if (!found) {
                      console.log(`        ❌ Could not resolve reference "${referencePath}"`);
                      console.log(`        Available keys in previousResults:`, previousResults ? Object.keys(previousResults) : 'No previousResults');
                    }
                  }
                }
                
                // Merge the referenced data by index
                if (Object.keys(referenceMap).length > 0) {
                  console.log(`  📊 Merging ${Object.keys(referenceMap).length} reference results`);
                  console.log(`    Reference keys to merge:`, Object.keys(referenceMap));
                  
                  const maxLength = Math.max(...Object.values(referenceMap).map(arr => 
                    Array.isArray(arr) ? arr.length : 1
                  ));
                  
                  console.log(`    Maximum array length: ${maxLength}`);
                  
                  // Create merged objects for AI processing
                  for (let i = 0; i < maxLength; i++) {
                    const mergedItem: any = {};
                    
                    for (const [refPath, data] of Object.entries(referenceMap)) {
                      // Use a cleaner key name for the merged object
                      let keyName = refPath.split('.').pop() || refPath;
                      // Clean up the key name for better object structure
                      if (keyName === 'Column Names') keyName = 'Column Name';
                      if (keyName === 'Worksheet Name') keyName = 'Worksheet Name';
                      
                      if (Array.isArray(data) && data[i]) {
                        const item = data[i];
                        const extractedValue = item?.extractedValue !== undefined ? item.extractedValue : item;
                        mergedItem[keyName] = extractedValue;
                      }
                    }
                    
                    if (Object.keys(mergedItem).length > 0) {
                      allReferencedData.push(mergedItem);
                    }
                  }
                  
                  console.log(`    ✨ Created ${allReferencedData.length} merged items`);
                  if (allReferencedData.length > 0) {
                    console.log(`    First merged item:`, JSON.stringify(allReferencedData[0]));
                    if (allReferencedData.length > 1) {
                      console.log(`    Second merged item:`, JSON.stringify(allReferencedData[1]));
                    }
                    console.log(`    Last merged item:`, JSON.stringify(allReferencedData[allReferencedData.length - 1]));
                  }
                  
                  // Replace the string with the merged data array
                  preparedInputValues[key] = allReferencedData;
                  console.log(`    ✅ CRITICAL: Replaced parameter "${key}" with ${allReferencedData.length} merged items`);
                  console.log(`    🔍 VERIFICATION: preparedInputValues["${key}"] is now:`, 
                    Array.isArray(preparedInputValues[key]) ? 
                      `Array[${preparedInputValues[key].length}]` : 
                      typeof preparedInputValues[key]);
                  console.log(`    🔍 First 3 items being sent to AI:`, preparedInputValues[key].slice(0, 3));
                } else {
                  console.log(`    ❌ CRITICAL ERROR: No references could be resolved!`);
                  console.log(`    ❌ The AI will receive unresolved reference strings instead of data`);
                  console.log(`    ❌ Input value was:`, value);
                  console.log(`    ❌ Available previousResults keys:`, previousResults ? Object.keys(previousResults) : 'None');
                  
                  // Don't pass unresolved references to AI tools
                  if (excelFunction?.toolType === 'AI' || excelFunction?.toolType === 'AI_ONLY') {
                    console.log(`    ❌ Removing unresolved references for AI tool to prevent confusion`);
                    delete preparedInputValues[key];
                  }
                }
              }
            }
            // Handle array that might contain reference strings
            else if (Array.isArray(value) && value.length > 0) {
              console.log(`  📋 Processing array parameter "${key}" with ${value.length} items`);
              console.log(`    Array contents:`, value);
              
              // Check if the array contains reference strings (either comma-separated or as array elements)
              const hasReferences = value.some(v => typeof v === 'string' && v.includes('@'));
              
              if (hasReferences) {
                console.log(`  📌 ARRAY CONTAINS REFERENCES!`);
                
                // Handle both cases: single comma-separated string or multiple reference strings
                let references: string[] = [];
                if (value.length === 1 && typeof value[0] === 'string' && value[0].includes(',')) {
                  // Single comma-separated string in array
                  console.log(`    Single comma-separated string in array: "${value[0]}"`);
                  references = value[0].split(',').map(ref => ref.trim());
                } else if (value.every(v => typeof v === 'string' && v.includes('@'))) {
                  // Array of individual reference strings - this is the AI tool case!
                  console.log(`    🚨 CRITICAL: Array of ${value.length} reference strings (AI tool pattern):`, value);
                  console.log(`    🚨 These references need to be merged into a single data array!`);
                  // Check if we have comma-separated references in multiple array elements
                  const allRefs: string[] = [];
                  for (const v of value) {
                    if (typeof v === 'string' && v.includes(',')) {
                      allRefs.push(...v.split(',').map(r => r.trim()));
                    } else if (typeof v === 'string') {
                      allRefs.push(v);
                    }
                  }
                  references = allRefs;
                } else {
                  // Mixed or other format
                  console.log(`    Mixed format, extracting references from array`);
                  references = value.filter(v => typeof v === 'string' && v.includes('@'));
                }
                
                console.log(`    Total references to resolve: ${references.length}`);
                
                // Process the references
                const allReferences = references.filter(ref => ref.startsWith('@'));
                if (allReferences.length > 0) {
                  const allReferencedData: any[] = [];
                  const referenceMap: {[key: string]: any[]} = {};
                  
                  for (const ref of allReferences) {
                    const referencePath = ref.slice(1); // Remove @ prefix
                    console.log(`    Processing reference: ${ref} -> ${referencePath}`);
                    console.log(`      Available keys:`, previousResults ? Object.keys(previousResults) : 'No previousResults');
                    
                    if (previousResults && previousResults[referencePath]) {
                      const previousData = previousResults[referencePath];
                      referenceMap[referencePath] = previousData;
                      console.log(`      ✅ Found ${Array.isArray(previousData) ? previousData.length : 1} items for ${referencePath}`);
                    } else {
                      console.log(`      ⚠️ No data found for "${referencePath}", trying alternates...`);
                      
                      // Try alternate key formats  
                      const alternateKeys = [
                        referencePath.replace('Column Name Mapping.', ''),
                        referencePath.split('.').pop() || referencePath,
                      ];
                      
                      let found = false;
                      for (const altKey of alternateKeys) {
                        if (previousResults && previousResults[altKey]) {
                          console.log(`        ✅ Found with alternate key: "${altKey}" - ${Array.isArray(previousResults[altKey]) ? previousResults[altKey].length : 1} items`);
                          referenceMap[referencePath] = previousResults[altKey];
                          found = true;
                          break;
                        }
                      }
                      
                      if (!found) {
                        console.log(`        ❌ Could not resolve reference "${referencePath}" in array`);
                      }
                    }
                  }
                  
                  // Merge the referenced data
                  if (Object.keys(referenceMap).length > 0) {
                    console.log(`  📊 MERGING ${Object.keys(referenceMap).length} reference results for AI`);
                    console.log(`    Reference keys to merge:`, Object.keys(referenceMap));
                    
                    // Get the maximum length of any referenced array
                    const maxLength = Math.max(...Object.values(referenceMap).map(arr => 
                      Array.isArray(arr) ? arr.length : 1
                    ));
                    
                    console.log(`    Maximum array length: ${maxLength} items`);
                    console.log(`    🎯 This will create ${maxLength} merged objects for the AI`);
                    
                    // Create merged objects, one for each index position
                    for (let i = 0; i < maxLength; i++) {
                      const mergedItem: any = {};
                      
                      for (const [refPath, data] of Object.entries(referenceMap)) {
                        // Extract clean key names for the merged object
                        let keyName = refPath.split('.').pop() || refPath;
                        
                        // Standardize key names for consistency
                        if (keyName === 'Column Names') {
                          keyName = 'Column Name';
                        } else if (keyName === 'Worksheet Name') {
                          keyName = 'Worksheet Name';
                        }
                        
                        // Extract the value at this index
                        if (Array.isArray(data) && data[i]) {
                          const item = data[i];
                          // Get the actual value (either extractedValue or the item itself)
                          const value = item?.extractedValue !== undefined ? item.extractedValue : item;
                          mergedItem[keyName] = value;
                        }
                      }
                      
                      // Only add if we have data
                      if (Object.keys(mergedItem).length > 0) {
                        allReferencedData.push(mergedItem);
                      }
                    }
                    
                    console.log(`    ✨ SUCCESSFULLY created ${allReferencedData.length} merged items`);
                    console.log(`    📊 Each item has format: {"Column Name": "...", "Worksheet Name": "..."}`);
                    
                    if (allReferencedData.length > 0) {
                      console.log(`    Item #1:`, JSON.stringify(allReferencedData[0]));
                      if (allReferencedData.length > 1) {
                        console.log(`    Item #2:`, JSON.stringify(allReferencedData[1]));
                      }
                      if (allReferencedData.length > 2) {
                        console.log(`    Item #3:`, JSON.stringify(allReferencedData[2]));
                      }
                      console.log(`    Last item (#${allReferencedData.length}):`, JSON.stringify(allReferencedData[allReferencedData.length - 1]));
                    }
                    
                    // CRITICAL: Replace the array parameter with the merged data
                    preparedInputValues[key] = allReferencedData;
                    console.log(`    ✅ SUCCESS: Parameter "${key}" now contains ${allReferencedData.length} merged objects`);
                    console.log(`    🚀 AI will receive array of ${allReferencedData.length} items with Column Name + Worksheet Name`);
                  } else {
                    console.log(`    ❌ CRITICAL ERROR: Could not resolve any references!`);
                    console.log(`    ❌ Array contained:`, value);
                    console.log(`    ❌ References found:`, allReferences);
                    
                    // For AI tools, we must not pass unresolved references
                    if ((excelFunction?.toolType === 'AI' || excelFunction?.toolType === 'AI_ONLY') && 
                        allReferences.length > 0) {
                      console.log(`    ❌ REMOVING unresolved references to prevent AI confusion`);
                      delete preparedInputValues[key];
                    }
                  }
                }
              } else {
                // Handle other array cases without references
                console.log(`    Array doesn't contain references, keeping as-is`);
              }
            } else if (typeof value === 'string' && value.startsWith('@')) {
              // Handle single string references
              const referencePath = value.slice(1); // Remove @ prefix
              console.log(`  Found reference: ${value} -> Looking for ${referencePath}`);
              
              // Special handling for @user_document - replace with test document content
              if (referencePath === 'user_document') {
                console.log(`  ✅ Replacing ${key} with test document content (${documentContent?.length || 0} chars)`);
                console.log(`  📄 Document content preview: ${documentContent?.substring(0, 200)}...`);
                preparedInputValues[key] = documentContent || '';
                console.log(`  ✅ Successfully set ${key} to document content`);
              }
              // Check if we have previous results for this reference
              else if (previousResults && previousResults[referencePath]) {
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
                      console.log(`    ✨ Successfully set ${key} to ${extractedValues.length} extracted values`);
                    } else {
                      // Keep the full objects if no extractedValue
                      preparedInputValues[key] = previousData;
                      console.log(`    ⚠️ No extractedValue found, keeping ${previousData.length} full objects`);
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
            
            // CRITICAL DEBUG: Log exact data being sent to AI tool
            if (valueConfig.valueName === 'Standard Mapping') {
              console.log('\n🚨🚨🚨 CRITICAL DEBUG FOR STANDARD MAPPING 🚨🚨🚨');
              console.log('📊 EXACT DATA BEING SENT TO AI TOOL:');
              for (const [key, value] of Object.entries(preparedInputValues)) {
                console.log(`  Parameter ID: "${key}"`);
                if (Array.isArray(value)) {
                  console.log(`    Type: Array[${value.length}]`);
                  if (value.length > 0) {
                    console.log(`    Item #1:`, JSON.stringify(value[0]));
                    if (value.length > 1) {
                      console.log(`    Item #2:`, JSON.stringify(value[1]));
                    }
                    if (value.length > 2) {
                      console.log(`    Item #3:`, JSON.stringify(value[2]));
                    }
                    console.log(`    Item #${value.length}:`, JSON.stringify(value[value.length - 1]));
                  }
                } else if (typeof value === 'string') {
                  console.log(`    Type: String[${value.length} chars]`);
                  console.log(`    Value: "${value.substring(0, 200)}..."`);
                } else {
                  console.log(`    Type: ${typeof value}`);
                  console.log(`    Value:`, value);
                }
              }
              console.log('🚨🚨🚨 END CRITICAL DEBUG 🚨🚨🚨\n');
            }
            
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
            
            // Log the actual data being sent to the AI tool
            console.log('🚀 CRITICAL: About to call tool with:');
            console.log(`  Tool Name: ${excelFunction.name}`);
            console.log(`  Tool Type: ${excelFunction.toolType}`);
            for (const [key, value] of Object.entries(preparedInputValues)) {
              if (Array.isArray(value)) {
                console.log(`  📊 Input "${key}": Array with ${value.length} items`);
                if (value.length > 0) {
                  console.log(`    First 3 items:`, value.slice(0, 3));
                  if (value.length > 3) {
                    console.log(`    Last 2 items:`, value.slice(-2));
                  }
                }
              } else if (typeof value === 'string' && value.length > 100) {
                console.log(`  📝 Input "${key}": String (${value.length} chars)`);
              } else {
                console.log(`  📝 Input "${key}":`, JSON.stringify(value).slice(0, 200));
              }
            }
            
            // Add valueConfiguration to inputs for automatic incremental data
            const enrichedInputs = {
              ...preparedInputValues,
              valueConfiguration: {
                stepId: valueConfig.stepId,
                valueId: valueConfig.valueId || valueConfig.id,
                valueName: valueConfig.valueName,
                stepName: valueConfig.stepName,
                orderIndex: valueConfig.orderIndex,
                inputValues: valueConfig.inputValues
              },
              stepId: valueConfig.stepId,
              valueId: valueConfig.valueId || valueConfig.id
            };
            
            // Execute using toolEngine's testTool method
            const toolResults = await toolEngine.testTool(excelFunction, enrichedInputs);
            
            console.log(`📊 TOOL EXECUTION COMPLETE: ${excelFunction.name}`);
            console.log(`  Results returned: ${toolResults?.length || 0} items`);
            if (toolResults && toolResults.length > 0) {
              console.log(`  First result:`, toolResults[0]);
              if (toolResults.length > 1) {
                console.log(`  Last result:`, toolResults[toolResults.length - 1]);
              }
              if (toolResults.length > 10) {
                console.log(`  Total of ${toolResults.length} results returned`);
              }
            }
            
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
            
            // Log complete output data that will be passed to next function
            console.log('\n📤 OUTPUT DATA FROM FUNCTION:', excelFunction.name);
            console.log('='  .repeat(60));
            console.log('Step:', valueConfig.stepName);
            console.log('Value:', valueConfig.valueName);
            console.log('Number of outputs:', enhancedResults.length);
            if (enhancedResults.length > 0) {
              console.log('\nFirst 3 output items:');
              enhancedResults.slice(0, 3).forEach((item: any, index: number) => {
                console.log(`  [${index}]:`, JSON.stringify(item, null, 2));
              });
              if (enhancedResults.length > 3) {
                console.log(`  ... and ${enhancedResults.length - 3} more items`);
              }
            }
            console.log('=' .repeat(60));
            
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
      const python = spawn('python3', ['services/document_extractor.py']);
      
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

  // Chat endpoints for session assistant
  app.get('/api/sessions/:sessionId/chat', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessages(sessionId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ message: 'Failed to fetch chat messages' });
    }
  });

  app.post('/api/sessions/:sessionId/chat', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { content, message } = req.body;
      const messageContent = content || message || req.body.text || '';
      const userId = req.user!.id;
      
      // Validate message content
      if (!messageContent || messageContent.trim() === '') {
        return res.status(400).json({ message: 'Message content is required' });
      }

      // Save user message
      const userMessage = await storage.createChatMessage({
        sessionId,
        userId,
        role: 'user',
        content: messageContent
      });

      // Get session context for AI
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Get all validations for this session
      const validations = await storage.getFieldValidations(sessionId);
      
      // Get project details
      const projectId = session.projectId;
      
      // Get workflow steps and their values for more context
      const workflowSteps = await storage.getWorkflowSteps(projectId);
      const stepValues: StepValue[] = [];
      for (const step of workflowSteps) {
        const values = await storage.getStepValues(step.id);
        stepValues.push(...values);
      }

      // Get project schema information
      const projectFields = await storage.getProjectSchemaFields(projectId);
      const collections = await storage.getObjectCollections(projectId);
      const collectionProperties: CollectionProperty[] = [];
      for (const collection of collections) {
        const props = await storage.getCollectionProperties(collection.id);
        collectionProperties.push(...props);
      }

      // Generate AI response using all extracted data
      const aiResponse = await generateChatResponse(messageContent, {
        session,
        validations,
        projectFields,
        collections,
        collectionProperties
      });

      // Save assistant message
      const assistantMessage = await storage.createChatMessage({
        sessionId,
        userId,
        role: 'assistant',
        content: aiResponse
      });

      res.json(assistantMessage);
    } catch (error) {
      console.error('Error processing chat message:', error);
      res.status(500).json({ message: 'Failed to process chat message' });
    }
  });

  // Debug endpoint for fixing Document step ordering specifically
  app.get('/debug-fix-document-step-order', async (req, res) => {
    try {
      console.log('🔧 Fixing Document step value ordering...');
      
      // Find the Document step
      const documentSteps = await db
        .select()
        .from(workflowSteps)
        .where(eq(workflowSteps.stepName, 'Document'));
      
      if (documentSteps.length === 0) {
        return res.json({ success: false, message: 'Document step not found' });
      }
      
      const documentStep = documentSteps[0];
      console.log(`Found Document step: ${documentStep.id}`);
      
      // Get current step values
      const values = await db
        .select()
        .from(stepValues)
        .where(eq(stepValues.stepId, documentStep.id))
        .orderBy(asc(stepValues.orderIndex));
      
      console.log('Current order:');
      values.forEach((val, i) => {
        console.log(`${i + 1}. ${val.valueName} (orderIndex: ${val.orderIndex})`);
      });
      
      // Define the correct order: Document Name, Description, Section 5.1
      const correctOrder = [
        { name: 'DOCUMENT NAME', newIndex: 0 },
        { name: 'DESCRIPTION', newIndex: 1 },
        { name: 'SECTION 5.1', newIndex: 2 }
      ];
      
      let updatesCount = 0;
      
      for (const update of correctOrder) {
        const valueToUpdate = values.find(val => 
          val.valueName.toUpperCase() === update.name
        );
        
        if (valueToUpdate && valueToUpdate.orderIndex !== update.newIndex) {
          console.log(`Updating ${valueToUpdate.valueName} orderIndex from ${valueToUpdate.orderIndex} to ${update.newIndex}`);
          
          await db
            .update(stepValues)
            .set({ orderIndex: update.newIndex })
            .where(eq(stepValues.id, valueToUpdate.id));
          
          updatesCount++;
        }
      }
      
      console.log(`✅ Document step ordering fixed! Updated ${updatesCount} values.`);
      res.json({ 
        success: true, 
        message: 'Document step value ordering fixed',
        updatesCount,
        newOrder: correctOrder.map(item => item.name)
      });
      
    } catch (error) {
      console.error('Error fixing Document step order:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint for fixing orderIndex based on creation time
  app.get('/debug-fix-orderindex-by-creation', async (req, res) => {
    try {
      console.log('🔧 Starting orderIndex fix by creation time...');
      
      // Get all workflow steps
      const steps = await db.select().from(workflowSteps);
      console.log(`Found ${steps.length} workflow steps`);
      
      for (const step of steps) {
        console.log(`\n🔧 Processing step: ${step.stepName}`);
        
        // Get all values for this step, ordered by creation time
        const values = await db
          .select()
          .from(stepValues)
          .where(eq(stepValues.stepId, step.id))
          .orderBy(asc(stepValues.createdAt));
        
        console.log(`Found ${values.length} values in step ${step.stepName}`);
        
        // Update orderIndex based on creation order
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          console.log(`Setting ${value.valueName} orderIndex to ${i} (was ${value.orderIndex})`);
          
          await db
            .update(stepValues)
            .set({ orderIndex: i })
            .where(eq(stepValues.id, value.id));
        }
        
        console.log(`✅ Updated ${values.length} values for step ${step.stepName}`);
      }
      
      console.log('🎉 OrderIndex fix completed!');
      res.json({ 
        success: true, 
        message: 'OrderIndex values fixed based on creation time',
        stepsProcessed: steps.length
      });
      
    } catch (error) {
      console.error('Error fixing orderIndex:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== KANBAN BOARD ROUTES ====================

  // Get kanban progress for all sessions in a project (supports multiple kanban steps)
  app.get('/api/projects/:projectId/kanban-progress', authenticateToken, async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Get workflow steps for the project
      const steps = await storage.getWorkflowSteps(projectId);
      const kanbanSteps = steps.filter(s => s.stepType === 'kanban');
      
      if (kanbanSteps.length === 0) {
        return res.json({ hasKanban: false, kanbanSteps: [], progress: {} });
      }
      
      // Get all sessions for the project
      const sessions = await storage.getExtractionSessions(projectId);
      
      // Build kanban step info with status columns and colors
      const kanbanStepInfo: Array<{
        stepId: string;
        stepName: string;
        statusColumns: string[];
        columnColors: string[];
        lastColumn: string;
      }> = [];
      
      // Calculate progress for each session and each kanban step
      // Structure: { [sessionId]: { [stepId]: { total, completed, percentage, statusBreakdown } } }
      const progress: Record<string, Record<string, { 
        total: number; 
        completed: number; 
        percentage: number;
        statusBreakdown: Record<string, number>;
      }>> = {};
      
      for (const kanbanStep of kanbanSteps) {
        const kanbanConfig = (kanbanStep as any).kanbanConfig || {
          statusColumns: ['To Do', 'In Progress', 'Done'],
          columnColors: []
        };
        const statusColumns: string[] = kanbanConfig.statusColumns || ['To Do', 'In Progress', 'Done'];
        const columnColors: string[] = kanbanConfig.columnColors || [];
        const lastColumn = statusColumns[statusColumns.length - 1];
        
        kanbanStepInfo.push({
          stepId: kanbanStep.id,
          stepName: kanbanStep.stepName,
          statusColumns,
          columnColors,
          lastColumn
        });
        
        for (const session of sessions) {
          const cards = await storage.getKanbanCards(session.id, kanbanStep.id);
          const total = cards.length;
          const completed = cards.filter(c => c.status === lastColumn).length;
          const percentage = total > 0 ? Math.floor((completed / total) * 100) : 0;
          
          // Calculate status breakdown for analytics
          const statusBreakdown: Record<string, number> = {};
          for (const col of statusColumns) {
            statusBreakdown[col] = cards.filter(c => c.status === col).length;
          }
          
          if (!progress[session.id]) {
            progress[session.id] = {};
          }
          progress[session.id][kanbanStep.id] = { total, completed, percentage, statusBreakdown };
        }
      }
      
      res.json({
        hasKanban: true,
        kanbanSteps: kanbanStepInfo,
        progress
      });
    } catch (error) {
      console.error('Error fetching kanban progress:', error);
      res.status(500).json({ error: 'Failed to fetch kanban progress' });
    }
  });

  // Get all kanban cards for a session/step
  app.get('/api/sessions/:sessionId/steps/:stepId/kanban-cards', async (req, res) => {
    try {
      const { sessionId, stepId } = req.params;
      const cards = await storage.getKanbanCards(sessionId, stepId);
      res.json(cards);
    } catch (error) {
      console.error('Error fetching kanban cards:', error);
      res.status(500).json({ error: 'Failed to fetch kanban cards' });
    }
  });

  // Get a single kanban card with its checklist items, comments, and attachments
  app.get('/api/kanban-cards/:cardId', async (req, res) => {
    try {
      const { cardId } = req.params;
      const card = await storage.getKanbanCard(cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      
      const [checklistItems, comments, attachments] = await Promise.all([
        storage.getKanbanChecklistItems(cardId),
        storage.getKanbanComments(cardId),
        storage.getKanbanAttachments(cardId)
      ]);
      
      res.json({ ...card, checklistItems, comments, attachments });
    } catch (error) {
      console.error('Error fetching kanban card:', error);
      res.status(500).json({ error: 'Failed to fetch kanban card' });
    }
  });

  // Create a new kanban card
  app.post('/api/sessions/:sessionId/steps/:stepId/kanban-cards', async (req, res) => {
    try {
      const { sessionId, stepId } = req.params;
      const card = await storage.createKanbanCard({
        sessionId,
        stepId,
        ...req.body
      });
      res.status(201).json(card);
    } catch (error) {
      console.error('Error creating kanban card:', error);
      res.status(500).json({ error: 'Failed to create kanban card' });
    }
  });

  // Update a kanban card
  app.patch('/api/kanban-cards/:cardId', async (req, res) => {
    try {
      const { cardId } = req.params;
      const card = await storage.updateKanbanCard(cardId, req.body);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      if (req.body.status && card.sessionId) {
        checkAndRevertWorkflowStatus(card.sessionId).catch(() => {});
      }
      res.json(card);
    } catch (error) {
      console.error('Error updating kanban card:', error);
      res.status(500).json({ error: 'Failed to update kanban card' });
    }
  });

  // Delete a kanban card
  app.delete('/api/kanban-cards/:cardId', async (req, res) => {
    try {
      const { cardId } = req.params;
      const success = await storage.deleteKanbanCard(cardId);
      if (!success) {
        return res.status(404).json({ error: 'Card not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting kanban card:', error);
      res.status(500).json({ error: 'Failed to delete kanban card' });
    }
  });

  // Reorder kanban cards (for drag and drop)
  app.post('/api/sessions/:sessionId/steps/:stepId/kanban-cards/reorder', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { cards } = req.body; // Array of { id, orderIndex, status? }
      const success = await storage.reorderKanbanCards(cards);
      if (sessionId) {
        checkAndRevertWorkflowStatus(sessionId).catch(() => {});
      }
      res.json({ success });
    } catch (error) {
      console.error('Error reordering kanban cards:', error);
      res.status(500).json({ error: 'Failed to reorder kanban cards' });
    }
  });

  // Kanban Checklist Items
  app.get('/api/kanban-cards/:cardId/checklist', async (req, res) => {
    try {
      const items = await storage.getKanbanChecklistItems(req.params.cardId);
      res.json(items);
    } catch (error) {
      console.error('Error fetching checklist items:', error);
      res.status(500).json({ error: 'Failed to fetch checklist items' });
    }
  });

  app.post('/api/kanban-cards/:cardId/checklist', async (req, res) => {
    try {
      const item = await storage.createKanbanChecklistItem({
        cardId: req.params.cardId,
        ...req.body
      });
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating checklist item:', error);
      res.status(500).json({ error: 'Failed to create checklist item' });
    }
  });

  app.patch('/api/kanban-checklist/:itemId', async (req, res) => {
    try {
      const item = await storage.updateKanbanChecklistItem(req.params.itemId, req.body);
      if (!item) {
        return res.status(404).json({ error: 'Checklist item not found' });
      }
      res.json(item);
    } catch (error) {
      console.error('Error updating checklist item:', error);
      res.status(500).json({ error: 'Failed to update checklist item' });
    }
  });

  app.delete('/api/kanban-checklist/:itemId', async (req, res) => {
    try {
      const success = await storage.deleteKanbanChecklistItem(req.params.itemId);
      res.json({ success });
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      res.status(500).json({ error: 'Failed to delete checklist item' });
    }
  });

  // Kanban Comments
  app.get('/api/kanban-cards/:cardId/comments', async (req, res) => {
    try {
      const comments = await storage.getKanbanComments(req.params.cardId);
      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  app.post('/api/kanban-cards/:cardId/comments', async (req, res) => {
    try {
      const comment = await storage.createKanbanComment({
        cardId: req.params.cardId,
        ...req.body
      });
      res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  app.patch('/api/kanban-comments/:commentId', async (req, res) => {
    try {
      const comment = await storage.updateKanbanComment(req.params.commentId, req.body);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      res.json(comment);
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  });

  app.delete('/api/kanban-comments/:commentId', async (req, res) => {
    try {
      const success = await storage.deleteKanbanComment(req.params.commentId);
      res.json({ success });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  });

  // Kanban Attachments
  app.get('/api/kanban-cards/:cardId/attachments', async (req, res) => {
    try {
      const attachments = await storage.getKanbanAttachments(req.params.cardId);
      res.json(attachments);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      res.status(500).json({ error: 'Failed to fetch attachments' });
    }
  });

  // Configure multer for attachment uploads
  const attachmentUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  app.post('/api/kanban-cards/:cardId/attachments', attachmentUpload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Upload to object storage
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      const fileName = file.originalname;
      const objectKey = `kanban-attachments/${req.params.cardId}/${Date.now()}-${fileName}`;
      
      await objectStorageService.uploadFile(objectKey, file.buffer, file.mimetype);
      const fileUrl = await objectStorageService.getSignedUrl(objectKey);
      
      const attachment = await storage.createKanbanAttachment({
        cardId: req.params.cardId,
        fileName: fileName,
        fileUrl: fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: req.body.uploadedBy || null
      });
      res.status(201).json(attachment);
    } catch (error) {
      console.error('Error creating attachment:', error);
      res.status(500).json({ error: 'Failed to create attachment' });
    }
  });

  app.delete('/api/kanban-attachments/:attachmentId', async (req, res) => {
    try {
      const success = await storage.deleteKanbanAttachment(req.params.attachmentId);
      res.json({ success });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      res.status(500).json({ error: 'Failed to delete attachment' });
    }
  });

  // AI Task Generation for Kanban
  app.post('/api/sessions/:sessionId/steps/:stepId/generate-tasks', async (req, res) => {
    try {
      const { sessionId, stepId } = req.params;
      const { 
        aiInstructions, 
        knowledgeDocumentIds, 
        statusColumns, 
        selectedDocumentIds,
        includeUserDocuments = true,
        referenceStepIds,
        dataSourceId,
        dataSourceInstructions
      } = req.body;

      // Get session documents (only if includeUserDocuments is true)
      let documentContent = '';
      if (includeUserDocuments !== false) {
        const allSessionDocs = await storage.getSessionDocuments(sessionId);
        
        // Filter to only selected documents if specified
        const sessionDocs = selectedDocumentIds && selectedDocumentIds.length > 0
          ? allSessionDocs.filter((doc: any) => selectedDocumentIds.includes(doc.id))
          : allSessionDocs;
        
        if (sessionDocs.length > 0) {
          documentContent = sessionDocs
            .map(doc => `--- ${doc.fileName} ---\n${doc.extractedContent || ''}`)
            .join('\n\n');
        }
      }

      // Get reference data from other steps if specified
      let referenceDataContent = '';
      if (referenceStepIds && referenceStepIds.length > 0) {
        const session = await storage.getExtractionSession(sessionId);
        if (session) {
          for (const refStepId of referenceStepIds) {
            const stepData = await storage.getWorkflowStep(refStepId);
            if (stepData) {
              // Get field validations for this step
              const validations = await storage.getFieldValidations(sessionId, refStepId);
              if (validations && validations.length > 0) {
                referenceDataContent += `\n\n--- Extracted Data from ${stepData.stepName} ---\n`;
                
                // Build a map of field IDs to step values and identify DATABASE_LOOKUP fields
                const stepValuesData = await storage.getStepValues(refStepId);
                const fieldIdToStepValue = new Map<string, any>();
                const databaseLookupFields = new Map<string, { dataSourceId: string; outputColumn: string }>();
                
                for (const sv of stepValuesData) {
                  fieldIdToStepValue.set(sv.id, sv);
                  // Check if this step value has a tool - fetch the tool to check if it's DATABASE_LOOKUP
                  if (sv.toolId) {
                    const tool = await storage.getExcelWizardryFunction(sv.toolId);
                    const inputValues = sv.inputValues as any;
                    // dataSourceId can be on the tool OR in the step value's inputValues
                    const dataSourceId = tool?.dataSourceId || inputValues?._dataSourceId;
                    if (tool && tool.toolType === 'DATABASE_LOOKUP' && dataSourceId) {
                      const outputColumn = inputValues?._outputColumn || 'id';
                      databaseLookupFields.set(sv.id, { 
                        dataSourceId: dataSourceId, 
                        outputColumn 
                      });
                    }
                  }
                }
                
                // Cache data sources to avoid multiple fetches
                const dataSourceCache = new Map<string, { data: any[]; columnMappings: Record<string, string> }>();
                
                // Group by identifierId for table data
                // Also build enrichment map for placeholder replacement later
                const groupedData = new Map<string, any>();
                const enrichmentMap = new Map<string, { identifierId: string; fieldName: string; record: Record<string, any> }>();
                
                for (const v of validations) {
                  if (!groupedData.has(v.identifierId)) {
                    groupedData.set(v.identifierId, { __identifierId: v.identifierId });
                  }
                  const stepValue = fieldIdToStepValue.get(v.fieldId);
                  const fieldName = stepValue?.valueName || 'Field';
                  
                  // Check if this field is a DATABASE_LOOKUP and store enrichment data
                  const lookupInfo = databaseLookupFields.get(v.fieldId);
                  if (lookupInfo && v.extractedValue) {
                    // Get or fetch the data source
                    if (!dataSourceCache.has(lookupInfo.dataSourceId)) {
                      const ds = await storage.getApiDataSource(lookupInfo.dataSourceId);
                      if (ds) {
                        dataSourceCache.set(lookupInfo.dataSourceId, {
                          data: ds.cachedData || [],
                          columnMappings: (ds.columnMappings as Record<string, string>) || {}
                        });
                      }
                    }
                    
                    const dsInfo = dataSourceCache.get(lookupInfo.dataSourceId);
                    if (dsInfo && dsInfo.data.length > 0) {
                      // Find the matching record by output column value
                      const matchedRecord = dsInfo.data.find((record: any) => 
                        record[lookupInfo.outputColumn]?.toString() === v.extractedValue?.toString()
                      );
                      
                      if (matchedRecord) {
                        // Store the extracted value for AI context
                        groupedData.get(v.identifierId)[fieldName] = v.extractedValue;
                        
                        // Build enriched record with friendly names for later replacement
                        const enrichedRecord: Record<string, any> = {};
                        for (const [col, val] of Object.entries(matchedRecord)) {
                          if (col !== 'created_at' && col !== 'updated_at' && val !== null && val !== '') {
                            const friendlyName = dsInfo.columnMappings[col] || col;
                            enrichedRecord[friendlyName] = val;
                          }
                        }
                        // Store in enrichment map for placeholder replacement
                        enrichmentMap.set(v.identifierId, {
                          identifierId: v.identifierId,
                          fieldName: fieldName,
                          record: enrichedRecord
                        });
                      } else {
                        groupedData.get(v.identifierId)[fieldName] = v.extractedValue;
                      }
                    } else {
                      groupedData.get(v.identifierId)[fieldName] = v.extractedValue;
                    }
                  } else {
                    groupedData.get(v.identifierId)[fieldName] = v.extractedValue;
                  }
                }
                
                // Store enrichment map in request context for later use
                (req as any).__enrichmentMap = enrichmentMap;
                
                referenceDataContent += JSON.stringify(Array.from(groupedData.values()), null, 2);
              }
            }
          }
        }
      }

      // Get data source content if specified
      let dataSourceContent = '';
      if (dataSourceId) {
        try {
          const dataSource = await storage.getApiDataSource(dataSourceId);
          if (dataSource && dataSource.endpointUrl) {
            const headers: Record<string, string> = { 'Accept': 'application/json' };
            if (dataSource.headers && typeof dataSource.headers === 'object') {
              Object.assign(headers, dataSource.headers);
            }
            if (dataSource.authToken) {
              headers['Authorization'] = dataSource.authToken.startsWith('Bearer ') 
                ? dataSource.authToken 
                : `Bearer ${dataSource.authToken}`;
            }
            
            const dsResponse = await fetch(dataSource.endpointUrl, { headers });
            if (dsResponse.ok) {
              const dsData = await dsResponse.json();
              // Extract data array (handling nested structures like BRYTER)
              let dataArray: any[] = [];
              if (Array.isArray(dsData)) {
                dataArray = dsData;
              } else if (dsData.data?.entries) {
                dataArray = dsData.data.entries;
              } else if (dsData.data && Array.isArray(dsData.data)) {
                dataArray = dsData.data;
              } else if (dsData.entries && Array.isArray(dsData.entries)) {
                dataArray = dsData.entries;
              }
              
              // Limit to first 100 records for context (with filtering instructions for AI)
              const limitedData = dataArray.slice(0, 100);
              dataSourceContent = `\n\n--- Data Source: ${dataSource.name} (${dataArray.length} total records, showing first ${limitedData.length}) ---\n`;
              if (dataSourceInstructions) {
                dataSourceContent += `FILTERING INSTRUCTIONS: ${dataSourceInstructions}\n`;
              }
              dataSourceContent += JSON.stringify(limitedData, null, 2);
            }
          }
        } catch (dsError) {
          console.error('Error fetching data source for task generation:', dsError);
        }
      }

      // Get knowledge documents if specified
      let knowledgeContent = '';
      if (knowledgeDocumentIds && knowledgeDocumentIds.length > 0) {
        for (const docId of knowledgeDocumentIds) {
          const doc = await storage.getKnowledgeDocument(docId);
          if (doc && doc.content) {
            knowledgeContent += `\n\n--- Reference Document: ${doc.displayName} ---\n${doc.content}`;
          }
        }
      }

      // Check if we have any content to analyze
      if (!documentContent && !referenceDataContent && !dataSourceContent && !knowledgeContent) {
        return res.status(400).json({ error: 'No content available for task generation. Please select documents, reference data, or a data source.' });
      }

      // Build the prompt
      const prompt = `You are a task extraction assistant. Analyze the following content and extract actionable tasks.

${aiInstructions ? `INSTRUCTIONS FROM USER: ${aiInstructions}` : 'Extract all action items, tasks, and work items from the provided content.'}

${knowledgeContent ? `REFERENCE DOCUMENTS FOR CONTEXT:${knowledgeContent}` : ''}

${referenceDataContent ? `EXTRACTED DATA FROM PREVIOUS STEPS:${referenceDataContent}` : ''}

${dataSourceContent ? `EXTERNAL DATA SOURCE:${dataSourceContent}` : ''}

${documentContent ? `DOCUMENTS TO ANALYZE:\n${documentContent}` : ''}

AVAILABLE STATUS COLUMNS: ${(statusColumns || ['To Do', 'In Progress', 'Done']).join(', ')}

For each task, you MUST provide:
1. **title**: A clear, concise title (max 80 characters)
2. **description**: A DETAILED description (300-500 characters) that includes:
   - What needs to be done
   - Specific completion instructions from the documents
   - Which department or role is responsible
   - Any deadlines or dependencies mentioned
   - Reference to specific document sections where applicable
3. **status**: Initial status (choose from the available columns, default to first column)
4. **reasoning**: Brief reasoning for why this is a task
5. **checklist**: An array of 3-6 specific subtasks or steps needed to complete this task. Each item should be actionable and measurable.

Return your response as a JSON array with objects having: title, description, status, reasoning, checklist

Example format:
[
  {
    "title": "Review contract terms and conditions",
    "description": "Legal department must review all terms in Section 3 of the tender document, particularly clauses 3.1-3.5 regarding liability and indemnification. Deadline: 5 business days before submission. Must identify any non-standard terms and propose amendments. Coordinate with procurement team for any commercial implications.",
    "status": "To Do",
    "reasoning": "Contract Section 3 mentions mandatory legal review before tender submission",
    "checklist": [
      "Review liability clauses in Section 3.1-3.2",
      "Assess indemnification requirements in Section 3.3",
      "Identify non-standard terms requiring negotiation",
      "Draft proposed amendments document",
      "Obtain sign-off from Legal Director"
    ]
  },
  {
    "title": "Prepare project timeline and schedule",
    "description": "Project Management team to develop comprehensive project timeline based on tender requirements. Must include all milestones from tender Section 5, resource allocation plan, and critical path analysis. Timeline must demonstrate capability to meet client's completion deadline of Q4 2024.",
    "status": "To Do",
    "reasoning": "Tender requires detailed project schedule in submission package",
    "checklist": [
      "Extract all milestone requirements from Section 5",
      "Create detailed Gantt chart with dependencies",
      "Identify resource requirements for each phase",
      "Conduct critical path analysis",
      "Review with Project Director for approval"
    ]
  }
]

CRITICAL RULES:
1. If the user specifies a naming convention for task titles (e.g., "task name should be 'Damage Report - {{Reference}}'"), you MUST follow it exactly, replacing {{placeholders}} with actual values from the data.
2. If the user specifies which tasks go to which status column, follow those rules precisely.
3. Generate comprehensive, detailed descriptions and relevant checklists for each task.
4. Create ONE task per data item when processing extracted data rows.
5. IMPORTANT: For records that have matched reference data (e.g., matched profit center), include the placeholder {{REFERENCE_DATA:identifierId}} in the description where identifierId is the __identifierId value from the data. The system will replace this placeholder with the full formatted reference data after you respond. This keeps your response compact.

Return ONLY the JSON array, no other text.`;

      // Call Gemini AI - using placeholder approach keeps responses compact
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash"
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      let tasks: any[] = [];
      try {
        // Clean up the response - remove markdown code blocks if present
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        tasks = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', text);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      if (!Array.isArray(tasks)) {
        return res.status(500).json({ error: 'AI did not return a valid task array' });
      }
      
      // Replace {{REFERENCE_DATA:identifierId}} placeholders with formatted data
      const enrichmentMap = (req as any).__enrichmentMap as Map<string, { identifierId: string; fieldName: string; record: Record<string, any> }> | undefined;
      if (enrichmentMap && enrichmentMap.size > 0) {
        for (const task of tasks) {
          if (task.description && typeof task.description === 'string') {
            // Find all placeholders in the description
            const placeholderRegex = /\{\{REFERENCE_DATA:([^}]+)\}\}/g;
            task.description = task.description.replace(placeholderRegex, (match: string, identifierId: string) => {
              const enrichment = enrichmentMap.get(identifierId);
              if (enrichment && enrichment.record) {
                // Format the record as readable text
                const lines = Object.entries(enrichment.record)
                  .filter(([_, val]) => val !== null && val !== '')
                  .map(([key, val]) => `${key}: ${val}`);
                return `\n\n--- ${enrichment.fieldName} Details ---\n${lines.join('\n')}`;
              }
              return match; // Keep original if not found
            });
          }
        }
      }

      // Create the kanban cards with checklists
      const createdCards = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const card = await storage.createKanbanCard({
          sessionId,
          stepId,
          title: task.title || 'Untitled Task',
          description: task.description || null,
          status: task.status || (statusColumns?.[0] || 'To Do'),
          orderIndex: i,
          aiGenerated: true,
          aiReasoning: task.reasoning || null
        });
        
        // Create checklist items for this card
        if (task.checklist && Array.isArray(task.checklist)) {
          for (let j = 0; j < task.checklist.length; j++) {
            const checklistText = task.checklist[j];
            if (checklistText && typeof checklistText === 'string') {
              await storage.createKanbanChecklistItem({
                cardId: card.id,
                title: checklistText,
                isCompleted: false,
                orderIndex: j,
                aiGenerated: true
              });
            }
          }
        }
        
        createdCards.push(card);
      }

      res.json({ 
        success: true, 
        cardsCreated: createdCards.length,
        cards: createdCards 
      });

    } catch (error) {
      console.error('Error generating tasks:', error);
      res.status(500).json({ error: 'Failed to generate tasks' });
    }
  });

  // Analytics chart generation endpoint
  app.post('/api/analytics/generate-charts', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { fieldData } = req.body;
      
      if (!fieldData || !Array.isArray(fieldData) || fieldData.length === 0) {
        return res.status(400).json({ error: 'Field data is required' });
      }

      const dataDescription = fieldData.map((field: { fieldName: string; values: string[]; chartType?: string }) => {
        const valueCounts: Record<string, number> = {};
        for (const value of field.values) {
          const normalizedValue = value.trim().toLowerCase();
          valueCounts[normalizedValue] = (valueCounts[normalizedValue] || 0) + 1;
        }
        
        return {
          fieldName: field.fieldName,
          chartType: field.chartType || 'pie',
          totalValues: field.values.length,
          uniqueValues: Object.keys(valueCounts).length,
          valueCounts,
          sampleValues: field.values.slice(0, 5)
        };
      });

      const prompt = `You are a data visualization expert. Analyze the following field data and create chart configurations.

DATA SUMMARY:
${JSON.stringify(dataDescription, null, 2)}

IMPORTANT - INTELLIGENT CATEGORY MATCHING:
Before creating charts, you MUST merge categories that clearly refer to the same thing but have different spellings, typos, or minor variations. Examples:
- "westouter" and "westkouter" → merge into the most common or correct spelling
- "Toronto" and "toronto" and "TORONTO" → merge (case differences)
- "Bruxelles" and "Brussels" → merge if they clearly refer to the same entity
- "New York" and "new york" and "NY" → merge obvious abbreviations
Use the most common spelling as the canonical name, or the most proper/formal version. Sum up the counts for merged categories.

CHART TYPE RULES:
Each field includes a "chartType" that the user selected. You MUST use that chart type exactly:
- "pie": pie chart with aggregated category counts
- "bar": bar chart with aggregated category counts

Return a JSON array of chart configurations. Each chart should have:
- type: Use the chartType specified for each field ("pie" or "bar")
- title: A descriptive title for the chart
- fieldName: The original field name
- data: An array of {name: string, value: number} objects with the aggregated counts (after merging similar categories)

Example output:
[
  {
    "type": "pie",
    "title": "Win/Loss Distribution",
    "fieldName": "Won or Lost",
    "data": [
      {"name": "Won", "value": 15},
      {"name": "Lost", "value": 8}
    ]
  }
]

Return ONLY the JSON array, no other text or markdown.`;

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean up markdown code blocks if present
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let charts;
      try {
        charts = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse AI response:', text);
        
        charts = fieldData.map((field: { fieldName: string; values: string[]; chartType?: string }) => {
          const valueCounts: Record<string, number> = {};
          for (const value of field.values) {
            const normalizedValue = value.trim();
            valueCounts[normalizedValue] = (valueCounts[normalizedValue] || 0) + 1;
          }
          
          const chartData = Object.entries(valueCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, value]) => ({ name, value }));

          return {
            type: field.chartType || 'pie',
            title: `${field.fieldName} Distribution`,
            fieldName: field.fieldName,
            data: chartData
          };
        });
      }

      res.json({ charts });

    } catch (error) {
      console.error('Error generating analytics charts:', error);
      res.status(500).json({ error: 'Failed to generate analytics charts' });
    }
  });

  // Find similar sessions in the same project
  app.post('/api/sessions/:sessionId/find-similar', authenticateToken, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await storage.getExtractionSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get all documents from the current session
      const currentDocs = await storage.getSessionDocuments(sessionId);
      if (currentDocs.length === 0) {
        return res.json({ similarSessions: [] });
      }

      // Get all other sessions in the same project
      const allSessions = await storage.getSessionsByProject(session.projectId);
      const otherSessions = allSessions.filter(s => s.id !== sessionId);

      if (otherSessions.length === 0) {
        return res.json({ similarSessions: [] });
      }

      // Get the combined content from current session documents
      const currentContent = currentDocs
        .map(d => d.extractedContent || '')
        .join('\n')
        .substring(0, 15000); // Limit content size for AI

      // Analyze each session for similarity
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const similarSessions: Array<{
        sessionId: string;
        sessionName: string;
        similarityScore: number;
        matchReason: string;
        documentCount: number;
        hasKanbanContent: boolean;
      }> = [];

      // Check each session for similarity
      for (const otherSession of otherSessions.slice(0, 10)) { // Limit to 10 sessions
        const otherDocs = await storage.getSessionDocuments(otherSession.id);
        if (otherDocs.length === 0) continue;

        const otherContent = otherDocs
          .map(d => d.extractedContent || '')
          .join('\n')
          .substring(0, 15000);

        // Check if there are kanban cards in this session
        const steps = await storage.getWorkflowSteps(session.projectId);
        const kanbanStep = steps.find(s => s.stepType === 'kanban');
        let hasKanbanContent = false;
        if (kanbanStep) {
          const cards = await storage.getKanbanCards(otherSession.id, kanbanStep.id);
          hasKanbanContent = cards.length > 0;
        }

        // Use AI to calculate similarity
        const prompt = `Compare these two documents and determine their similarity.
Document 1 (Current):
${currentContent.substring(0, 5000)}

Document 2 (Previous):
${otherContent.substring(0, 5000)}

Analyze these documents and provide:
1. A similarity score from 0-100 (where 100 is identical subject matter)
2. A brief reason for the match (max 50 words)

Consider similarity in:
- Subject matter (e.g., both are tender documents, both are contracts)
- Document type and structure
- Common terminology and topics

Respond in JSON format:
{"similarityScore": number, "matchReason": "brief explanation"}`;

        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          const jsonMatch = text.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.similarityScore >= 40) { // Only include sessions with 40%+ similarity
              similarSessions.push({
                sessionId: otherSession.id,
                sessionName: otherSession.sessionName,
                similarityScore: parsed.similarityScore,
                matchReason: parsed.matchReason,
                documentCount: otherDocs.length,
                hasKanbanContent
              });
            }
          }
        } catch (aiError) {
          console.error('AI similarity check failed for session:', otherSession.id, aiError);
        }
      }

      // Sort by similarity score descending
      similarSessions.sort((a, b) => b.similarityScore - a.similarityScore);

      res.json({ similarSessions: similarSessions.slice(0, 5) }); // Return top 5

    } catch (error) {
      console.error('Error finding similar sessions:', error);
      res.status(500).json({ error: 'Failed to find similar sessions' });
    }
  });

  // Link a session and copy kanban content with gap analysis
  app.post('/api/sessions/:sessionId/link-session', authenticateToken, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { linkedSessionId } = req.body;
      const userId = (req as any).user?.id;

      if (!linkedSessionId) {
        return res.status(400).json({ error: 'linkedSessionId is required' });
      }

      const session = await storage.getExtractionSession(sessionId);
      const linkedSession = await storage.getExtractionSession(linkedSessionId);
      
      if (!session || !linkedSession) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get documents from both sessions
      const currentDocs = await storage.getSessionDocuments(sessionId);
      const linkedDocs = await storage.getSessionDocuments(linkedSessionId);

      const currentContent = currentDocs.map(d => d.extractedContent || '').join('\n').substring(0, 20000);
      const linkedContent = linkedDocs.map(d => d.extractedContent || '').join('\n').substring(0, 20000);

      // Use AI for gap analysis
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Get existing kanban cards from linked session
      const steps = await storage.getWorkflowSteps(session.projectId);
      const kanbanStep = steps.find(s => s.stepType === 'kanban');

      if (!kanbanStep) {
        return res.status(400).json({ error: 'No kanban step found in this project' });
      }

      const linkedCards = await storage.getKanbanCards(linkedSessionId, kanbanStep.id);

      // Perform gap analysis
      const gapAnalysisPrompt = `Compare these two documents and identify differences.

NEW DOCUMENT:
${currentContent.substring(0, 8000)}

PREVIOUS DOCUMENT:
${linkedContent.substring(0, 8000)}

EXISTING TASKS FROM PREVIOUS SESSION:
${linkedCards.map(c => `- ${c.title}: ${c.description || 'No description'}`).join('\n')}

Analyze the differences between the new and previous documents. Determine:
1. What requirements in the new document are NOT covered by the existing tasks
2. Which existing tasks are NOT relevant to the new document
3. A summary of the key differences

Respond in JSON format:
{
  "gapAnalysis": "A paragraph describing the key differences between the documents",
  "newRequirements": [{"title": "task title", "description": "task description", "aiReasoning": "why this is needed"}],
  "excludedTaskTitles": ["task title that is not relevant"]
}`;

      let gapAnalysis = '';
      let newRequirements: Array<{title: string; description: string; aiReasoning: string}> = [];
      let excludedTaskTitles: string[] = [];

      try {
        const result = await model.generateContent(gapAnalysisPrompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          gapAnalysis = parsed.gapAnalysis || '';
          newRequirements = parsed.newRequirements || [];
          excludedTaskTitles = parsed.excludedTaskTitles || [];
        }
      } catch (aiError) {
        console.error('Gap analysis AI error:', aiError);
        gapAnalysis = 'Unable to perform detailed gap analysis.';
      }

      // Copy relevant cards from linked session
      const copiedCardIds: string[] = [];
      const excludedCardIds: string[] = [];

      for (const card of linkedCards) {
        // Check if this card should be excluded
        const isExcluded = excludedTaskTitles.some(title => 
          card.title.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(card.title.toLowerCase())
        );

        if (isExcluded) {
          excludedCardIds.push(card.id);
          continue;
        }

        // Create a copy of the card with linked session marker
        const newCard = await storage.createKanbanCard({
          sessionId,
          stepId: kanbanStep.id,
          title: card.title,
          description: card.description ? `[From previous session]\n\n${card.description}` : '[From previous session]',
          status: 'To Do', // Reset status to To Do (matches UI column name)
          orderIndex: card.orderIndex,
          assigneeIds: null, // Don't copy assignees
          fieldValues: card.fieldValues,
          aiGenerated: card.aiGenerated,
          aiReasoning: card.aiReasoning,
          documentSource: card.documentSource,
          fromLinkedSession: true,
          linkedFromSessionId: linkedSessionId,
          linkedFromCardId: card.id,
          createdBy: userId || null
        });

        copiedCardIds.push(newCard.id);

        // Copy checklist items
        const checklistItems = await storage.getKanbanChecklistItems(card.id);
        for (const item of checklistItems) {
          await storage.createKanbanChecklistItem({
            cardId: newCard.id,
            title: item.title,
            isCompleted: false, // Reset completion status
            orderIndex: item.orderIndex,
            aiGenerated: item.aiGenerated
          });
        }

        // Copy comments with linked session marker
        const comments = await storage.getKanbanComments(card.id);
        for (const comment of comments) {
          await storage.createKanbanComment({
            cardId: newCard.id,
            userId: comment.userId,
            content: `[Previous session comment]\n\n${comment.content}`,
            fromLinkedSession: true,
            linkedFromSessionId: linkedSessionId
          });
        }

        // Copy attachments
        const attachments = await storage.getKanbanAttachments(card.id);
        for (const attachment of attachments) {
          await storage.createKanbanAttachment({
            cardId: newCard.id,
            commentId: null,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl, // Keep same URL as files are in object storage
            fileSize: attachment.fileSize,
            mimeType: attachment.mimeType,
            uploadedBy: attachment.uploadedBy
          });
        }
      }

      // Create cards for new requirements
      const newTaskIds: string[] = [];
      for (const req of newRequirements) {
        const maxOrder = linkedCards.length + newTaskIds.length;
        const newCard = await storage.createKanbanCard({
          sessionId,
          stepId: kanbanStep.id,
          title: req.title,
          description: `[New requirement]\n\n${req.description}`,
          status: 'todo',
          orderIndex: maxOrder,
          aiGenerated: true,
          aiReasoning: req.aiReasoning,
          fromLinkedSession: false,
          createdBy: userId || null
        });
        newTaskIds.push(newCard.id);
      }

      // Create session link record
      const sessionLink = await storage.createSessionLink({
        sourceSessionId: sessionId,
        linkedSessionId,
        similarityScore: 0, // Will be updated if we want to track
        gapAnalysis,
        newRequirements: newRequirements as any,
        excludedTasks: excludedCardIds as any
      });

      res.json({
        success: true,
        sessionLinkId: sessionLink.id,
        gapAnalysis,
        copiedTaskCount: copiedCardIds.length,
        excludedTaskCount: excludedCardIds.length,
        newTaskCount: newTaskIds.length,
        copiedCardIds,
        newTaskIds
      });

    } catch (error) {
      console.error('Error linking session:', error);
      res.status(500).json({ error: 'Failed to link session' });
    }
  });

  // Get session links for a session
  app.get('/api/sessions/:sessionId/links', authenticateToken, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const links = await storage.getSessionLinks(sessionId);
      res.json({ links });
    } catch (error) {
      console.error('Error getting session links:', error);
      res.status(500).json({ error: 'Failed to get session links' });
    }
  });

  // AgentMail webhook endpoint for receiving inbound emails
  // This creates a new session from email and uploads attachments as documents
  // With auto-reply: validates attachments against required document types
  app.post('/api/webhooks/email', async (req, res) => {
    try {
      console.log('📧 Received inbound email webhook:', JSON.stringify(req.body, null, 2).slice(0, 500));
      console.log('📧 Webhook payload keys:', Object.keys(req.body));
      
      const payload = req.body;
      const inboxId = payload.inbox_id || payload.inboxId;
      const messageId = payload.message_id || payload.messageId || payload.id;
      let subject = payload.subject || 'Email Session';
      let fromEmail = payload.from_?.[0] || payload.from || 'unknown@example.com';
      let textContent = payload.text_plain || payload.text_html || payload.body || '';
      let rawAttachments = payload.attachments || [];
      
      // Webhook payloads often lack the full message body - fetch from AgentMail API if missing
      if (inboxId && messageId && (!textContent || rawAttachments.length === 0)) {
        try {
          const { getMessage } = await import('./integrations/agentmail');
          const fullMessage = await getMessage(inboxId, messageId) as any;
          if (fullMessage) {
            if (!textContent) {
              textContent = fullMessage.text || fullMessage.text_plain || fullMessage.textPlain || fullMessage.html || fullMessage.text_html || fullMessage.textHtml || fullMessage.body || '';
              console.log(`📧 Webhook: Fetched email body from API (${textContent.length} chars)`);
            }
            if (!subject || subject === 'Email Session') {
              subject = fullMessage.subject || subject;
            }
            if (!fromEmail || fromEmail === 'unknown@example.com') {
              fromEmail = fullMessage.from_?.[0] || fullMessage.from || fromEmail;
            }
            if (rawAttachments.length === 0 && fullMessage.attachments?.length > 0) {
              rawAttachments = fullMessage.attachments;
              console.log(`📧 Webhook: Fetched ${rawAttachments.length} attachments from API`);
            }
          }
        } catch (fetchErr) {
          console.log(`📧 Webhook: Could not fetch full message from API:`, fetchErr);
        }
      }
      const attachments = rawAttachments.filter((att: any) => {
        const fname = att.filename || att.fileName || '';
        const ftype = att.content_type || att.contentType || '';
        const fsize = att.size || att.fileSize || 0;
        if (isEmailSignatureAttachment(fname, ftype, fsize)) {
          console.log(`📧 Webhook: Skipping signature attachment: ${fname} (${fsize} bytes)`);
          return false;
        }
        return true;
      });
      if (rawAttachments.length !== attachments.length) {
        console.log(`📧 Webhook: Filtered ${rawAttachments.length - attachments.length} signature attachment(s)`);
      }
      
      if (!inboxId) {
        console.log('📧 No inbox_id in webhook payload, ignoring (may be a notification event)');
        return res.status(200).json({ status: 'ignored', reason: 'no_inbox_id' });
      }
      
      if (!messageId) {
        console.error('📧 No message_id in webhook payload');
        return res.status(400).json({ error: 'Missing message_id' });
      }
      
      // Find project by inbox ID
      const project = await storage.getProjectByInboxId(inboxId);
      if (!project) {
        console.error(`📧 No project found for inbox ID: ${inboxId}`);
        return res.status(404).json({ error: 'Project not found for inbox' });
      }
      
      console.log(`📧 Found project: ${project.name} (${project.id})`);
      
      // Check if this email has already been processed (prevent duplicates)
      const alreadyProcessed = await storage.isEmailProcessed(project.id, messageId);
      if (alreadyProcessed) {
        console.log(`📧 Email ${messageId} already processed, skipping`);
        return res.json({ 
          success: true, 
          message: 'Email already processed',
          duplicate: true 
        });
      }
      
      // Get required document types for this project
      const requiredDocTypes = (project as any).requiredDocumentTypes as Array<{id: string; name: string; description: string}> || [];
      console.log(`📧 Project has ${requiredDocTypes.length} required document types`);
      
      // Import agentmail functions for sending replies
      const { downloadAttachment, sendEmail, renderEmailTemplate, DEFAULT_EMAIL_TEMPLATE } = await import('./integrations/agentmail');
      const emailTemplate = (project as any).emailNotificationTemplate || DEFAULT_EMAIL_TEMPLATE;
      
      // If project has required document types, validate attachments first
      let validationResults: Array<{docType: {id: string; name: string; description: string}; matched: boolean; matchedFile?: string}> = [];
      let attachmentContents: Map<string, {filename: string; content: string; contentType: string; base64: string}> = new Map();
      
      // If project requires documents but no attachments provided, reject immediately
      if (requiredDocTypes.length > 0 && attachments.length === 0) {
        console.log(`📧 No attachments but ${requiredDocTypes.length} document types required, sending rejection email`);
        
        // All document types are missing
        const missingDocTypes = requiredDocTypes.map(dt => ({ docType: dt, matched: false }));
        
        // Generate AI rejection email
        const rejectionPrompt = `Generate a professional, helpful email response for an automated document intake system.

Context:
- The sender submitted an email without any document attachments to "${project.name}"
- This project requires specific documents to be attached
- Original email subject: "${subject}"

Missing Documents (ALL required):
${requiredDocTypes.map(dt => `- ${dt.name}: ${dt.description}`).join('\n')}

Write a polite, professional email explaining:
1. We received their email
2. Unfortunately, no document attachments were found
3. List each required document type and what it should contain
4. Encourage them to reply with the correct documents attached

Keep the tone helpful and professional. Format as plain text email body only (no subject line).`;

        let rejectionBody = '';
        try {
          const aiResult = await model.generateContent(rejectionPrompt);
          rejectionBody = aiResult.response.text();
        } catch (err) {
          console.error('📧 Failed to generate rejection email:', err);
          rejectionBody = `Thank you for your email to ${project.name}.

Unfortunately, we could not find any document attachments in your email. To process your request, we need the following documents:

${requiredDocTypes.map(dt => `- ${dt.name}: ${dt.description}`).join('\n')}

Please reply to this email with the required documents attached.

Thank you.`;
        }
        
        // Send rejection email
        try {
          await sendEmail({
            fromInboxId: inboxId,
            to: fromEmail,
            subject: `Re: ${subject} - Documents Required`,
            textContent: rejectionBody,
            htmlContent: renderEmailTemplate(emailTemplate, {
              subject: `Re: ${subject} - Documents Required`,
              body: rejectionBody.replace(/\n/g, '<br>'),
              projectName: project.name,
              senderEmail: fromEmail
            }),
            replyToMessageId: messageId
          });
          console.log(`📧 Sent rejection email to ${fromEmail} (no attachments)`);
        } catch (err) {
          console.error('📧 Failed to send rejection email:', err);
        }
        
        // Mark email as processed but don't create session
        await storage.markEmailProcessed(project.id, messageId, inboxId, '', subject, fromEmail, textContent, new Date());
        
        return res.json({ 
          success: true, 
          message: 'No attachments provided, rejection email sent',
          rejected: true,
          missingDocuments: requiredDocTypes.map(dt => dt.name)
        });
      }
      
      if (requiredDocTypes.length > 0 && attachments.length > 0) {
        console.log(`📧 Validating ${attachments.length} attachments against ${requiredDocTypes.length} required document types`);
        
        // First, extract content from all attachments
        for (const attachment of attachments) {
          try {
            const { data, filename, contentType } = await downloadAttachment(inboxId, messageId, attachment.attachment_id);
            const base64Content = data.toString('base64');
            const dataUrl = `data:${contentType};base64,${base64Content}`;
            
            // Extract text content
            let extractedContent = '';
            if (contentType.includes('pdf') || contentType.includes('excel') || 
                contentType.includes('spreadsheet') || contentType.includes('word') ||
                contentType.includes('document') || contentType.includes('text')) {
              try {
                const extractionData = {
                  step: "extract_text_only",
                  documents: [{
                    file_name: filename,
                    file_content: dataUrl,
                    mime_type: contentType
                  }]
                };
                
                const extractedResult = await new Promise<string>((resolve) => {
                  const python = spawn('python3', ['services/document_extractor.py']);
                  
                  // Add timeout for extraction (20 seconds)
                  const extractTimeout = setTimeout(() => {
                    python.kill();
                    console.log(`📧 Extraction timeout for ${filename}`);
                    resolve('');
                  }, 20000);
                  
                  python.stdin.write(JSON.stringify(extractionData));
                  python.stdin.end();
                  
                  let output = '';
                  python.stdout.on('data', (chunk) => { output += chunk.toString(); });
                  python.on('close', (code) => {
                    clearTimeout(extractTimeout);
                    if (code === 0) {
                      try {
                        const result = JSON.parse(output);
                        resolve(result.extracted_texts?.[0]?.text_content || '');
                      } catch { resolve(''); }
                    } else { resolve(''); }
                  });
                  python.on('error', () => {
                    clearTimeout(extractTimeout);
                    resolve('');
                  });
                });
                
                extractedContent = extractedResult;
              } catch { /* ignore extraction errors */ }
            }
            
            attachmentContents.set(attachment.attachment_id, {
              filename,
              content: extractedContent,
              contentType,
              base64: base64Content
            });
          } catch (err) {
            console.error(`📧 Failed to download attachment ${attachment.filename}:`, err);
          }
        }
        
        // If all attachment downloads failed, treat as missing documents
        if (attachmentContents.size === 0) {
          console.log(`📧 All attachment downloads failed, treating as missing documents`);
          for (const docType of requiredDocTypes) {
            validationResults.push({ docType, matched: false });
          }
        } else {
        // Validate each required document type using AI
        for (const docType of requiredDocTypes) {
          let matched = false;
          let matchedFile: string | undefined;
          
          // Check each attachment against this document type
          for (const [attachId, attachData] of attachmentContents) {
            try {
              if (!attachData.content && (attachData.contentType?.includes('pdf') || attachData.contentType?.includes('document') || attachData.contentType?.includes('spreadsheet') || attachData.contentType?.includes('excel') || attachData.contentType?.includes('word'))) {
                console.log(`📧 Content extraction failed for ${attachData.filename} (likely scanned document) - accepting by default`);
                matched = true;
                matchedFile = attachData.filename;
                break;
              }

              const validationPrompt = `You are validating if a document matches an expected document type.

Document Type Required: "${docType.name}"
Description: "${docType.description}"

${attachData.content ? `Document Content (first 3000 chars):\n${attachData.content.slice(0, 3000)}` : `Document Info (content extraction failed):\nFilename: ${attachData.filename}\nFile type: ${attachData.contentType}`}

Does this document match the required document type? Consider:
1. Does the content/filename align with what "${docType.name}" should contain?
2. Does it match the description: "${docType.description}"?
${!attachData.content ? '\nNote: Content extraction failed, so base decision on filename and file type only. Be lenient if filename strongly suggests correct document type.' : ''}

Respond with ONLY a JSON object:
{"matches": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`;
              
              // Add timeout for AI call (15 seconds)
              const aiPromise = model.generateContent(validationPrompt);
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('AI validation timeout')), 15000)
              );
              
              const aiResult = await Promise.race([aiPromise, timeoutPromise]);
              const responseText = aiResult.response.text();
              
              // Parse AI response
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.matches && parsed.confidence >= 0.6) {
                  matched = true;
                  matchedFile = attachData.filename;
                  console.log(`📧 Document type "${docType.name}" matched by "${attachData.filename}"`);
                  break;
                }
              }
            } catch (err) {
              console.error(`📧 AI validation error for ${docType.name}:`, err);
              // On AI failure, don't match - require manual review
            }
          }
          
          validationResults.push({ docType, matched, matchedFile });
        }
        } // Close else block for attachmentContents.size > 0
      }
      
      // Check if all required documents are present
      const missingDocTypes = validationResults.filter(r => !r.matched);
      const allRequirementsMet = missingDocTypes.length === 0;
      
      // If requirements not met and there are required document types, send rejection email
      if (requiredDocTypes.length > 0 && !allRequirementsMet) {
        console.log(`📧 Missing ${missingDocTypes.length} required document types, sending rejection email`);
        
        // Generate AI rejection email
        const rejectionPrompt = `Generate a professional, helpful email response for an automated document intake system.

Context:
- The sender submitted documents via email to "${project.name}"
- Some required documents are missing or don't match requirements
- Original email subject: "${subject}"

Missing Documents:
${missingDocTypes.map(m => `- ${m.docType.name}: ${m.docType.description}`).join('\n')}

Documents Received:
${attachments.map((a: any) => `- ${a.filename}`).join('\n') || '(No attachments)'}

Write a polite, professional email explaining:
1. We received their submission
2. Unfortunately, we cannot process it because some required documents are missing
3. List each missing document type and what it should contain
4. Encourage them to reply with the correct documents

Keep the tone helpful and professional. Format as plain text email body only (no subject line).`;

        let rejectionBody = '';
        try {
          const aiResult = await model.generateContent(rejectionPrompt);
          rejectionBody = aiResult.response.text();
        } catch (err) {
          console.error('📧 Failed to generate rejection email:', err);
          rejectionBody = `Thank you for your submission to ${project.name}.

Unfortunately, we cannot process your request because the following required documents are missing:

${missingDocTypes.map(m => `- ${m.docType.name}: ${m.docType.description}`).join('\n')}

Please reply to this email with the missing documents attached.

Thank you.`;
        }
        
        // Send rejection email
        try {
          await sendEmail({
            fromInboxId: inboxId,
            to: fromEmail,
            subject: `Re: ${subject} - Additional Documents Required`,
            textContent: rejectionBody,
            htmlContent: renderEmailTemplate(emailTemplate, {
              subject: `Re: ${subject} - Additional Documents Required`,
              body: rejectionBody.replace(/\n/g, '<br>'),
              projectName: project.name,
              senderEmail: fromEmail
            }),
            replyToMessageId: messageId
          });
          console.log(`📧 Sent rejection email to ${fromEmail}`);
        } catch (err) {
          console.error('📧 Failed to send rejection email:', err);
        }
        
        // Mark email as processed but don't create session
        await storage.markEmailProcessed(project.id, messageId, inboxId, '', subject, fromEmail, textContent, new Date());
        
        return res.json({ 
          success: true, 
          message: 'Documents do not meet requirements, rejection email sent',
          rejected: true,
          missingDocuments: missingDocTypes.map(m => m.docType.name)
        });
      }
      
      // All requirements met (or no requirements) - create session
      const sessionName = subject.slice(0, 100);
      const sessionData = {
        projectId: project.id,
        sessionName,
        description: `Created from email by ${fromEmail}`,
        status: 'pending' as const,
        documentCount: attachments.length,
        extractedData: '{}',
      };
      
      const session = await storage.createExtractionSession(sessionData);
      console.log(`📧 Created session: ${session.id} - ${sessionName}`);
      
      // Mark email as processed immediately to prevent race conditions
      await storage.markEmailProcessed(project.id, messageId, inboxId, session.id, subject, fromEmail, textContent, new Date());
      
      // Generate initial field validations
      await generateSchemaFieldValidations(session.id, project.id);
      
      // Process attachments if any
      if (attachments.length > 0) {
        
        for (const attachment of attachments) {
          try {
            console.log(`📧 Processing attachment: ${attachment.filename}`);
            
            // Download attachment content (inboxId, messageId, attachmentId)
            const { data, filename, contentType } = await downloadAttachment(inboxId, messageId, attachment.attachment_id);
            
            // Convert to base64 for document extractor
            const base64Content = data.toString('base64');
            
            // Extract text content using document_extractor.py (same as manual upload)
            let extractedContent = '';
            
            const supportedType = contentType.includes('pdf') || contentType.includes('excel') || 
                contentType.includes('spreadsheet') || contentType.includes('word') ||
                contentType.includes('document') || contentType.includes('text') ||
                contentType.includes('image/');
            if (supportedType) {
              try {
                const extractionData = {
                  step: "extract_text_only",
                  documents: [{
                    file_name: filename,
                    file_content: base64Content,
                    mime_type: contentType
                  }]
                };
                
                console.log(`📧 Extracting text from: ${filename} (${contentType})`);
                
                const fsNode2 = await import('fs');
                const osMod2 = await import('os');
                const pathMod2 = await import('path');
                const tmpFile = pathMod2.join(osMod2.tmpdir(), `extract_${crypto.randomUUID()}.json`);
                fsNode2.writeFileSync(tmpFile, JSON.stringify(extractionData));
                
                const extractedResult = await new Promise<string>((resolve) => {
                  const python = spawn('python3', ['services/document_extractor.py'], {
                    env: { ...process.env }
                  });
                  const timeout = setTimeout(() => { python.kill(); console.log(`📧 Python extraction timeout for ${filename}`); resolve(''); }, 120000);
                  
                  const inputStream = fsNode2.createReadStream(tmpFile);
                  inputStream.pipe(python.stdin);
                  
                  let output = '';
                  let errOutput = '';
                  
                  python.stdout.on('data', (chunk: Buffer) => {
                    output += chunk.toString();
                  });
                  
                  python.stderr.on('data', (chunk: Buffer) => {
                    errOutput += chunk.toString();
                  });
                  
                  python.on('close', (code: number | null) => {
                    clearTimeout(timeout);
                    try { fsNode2.unlinkSync(tmpFile); } catch {}
                    if (errOutput) console.log(`📧 Python stderr for ${filename}: ${errOutput}`);
                    if (code !== 0) {
                      console.error(`📧 Document extraction error for ${filename}, code: ${code}`);
                      resolve('');
                    } else {
                      try {
                        const result = JSON.parse(output);
                        const text = result.extracted_texts?.[0]?.text_content || '';
                        const extractError = result.extracted_texts?.[0]?.error;
                        if (extractError) console.log(`📧 Extraction error for ${filename}: ${extractError}`);
                        console.log(`📧 Extracted ${text.length} chars from ${filename}`);
                        resolve(text);
                      } catch (parseErr) {
                        console.error(`📧 Failed to parse extraction result for ${filename}:`, parseErr);
                        resolve('');
                      }
                    }
                  });
                  python.on('error', (err: Error) => { clearTimeout(timeout); console.log(`📧 Python spawn error: ${err}`); try { fsNode2.unlinkSync(tmpFile); } catch {} resolve(''); });
                });
                
                extractedContent = extractedResult;
              } catch (extractErr) {
                console.error(`📧 Failed to extract text from ${filename}:`, extractErr);
              }
            }
            
            // Create session document with extracted content
            const document = await storage.createSessionDocument({
              sessionId: session.id,
              fileName: filename,
              mimeType: contentType,
              fileSize: data.length,
              extractedContent: extractedContent,
            });
            
            console.log(`📧 Saved document: ${document.id} - ${filename} (content: ${extractedContent ? 'extracted text' : 'base64'})`);
            
          } catch (attachErr) {
            console.error(`📧 Failed to process attachment ${attachment.filename}:`, attachErr);
          }
        }
        
        // Update session document count
        await storage.updateExtractionSession(session.id, {
          documentCount: attachments.length
        });
      }
      
      console.log(`📧 Email processing complete. Session: ${session.id}`);
      
      // Send confirmation email
      try {
        const confirmationPrompt = `Generate a professional confirmation email for an automated document intake system.

Context:
- The sender successfully submitted documents to "${project.name}"
- All required documents were received and a case has been created
- Original email subject: "${subject}"
- Session/Case ID: ${session.id.slice(0, 8)}

Documents Received:
${attachments.map((a: any) => `- ${a.filename}`).join('\n') || '(No attachments)'}

Write a brief, professional confirmation email that:
1. Thanks them for their submission
2. Confirms we received their documents
3. Provides the case reference number
4. Mentions they will be contacted if additional information is needed

Keep it concise and professional. Format as plain text email body only (no subject line).`;

        let confirmationBody = '';
        try {
          const aiResult = await model.generateContent(confirmationPrompt);
          confirmationBody = aiResult.response.text();
        } catch (err) {
          console.error('📧 Failed to generate confirmation email:', err);
          confirmationBody = `Thank you for your submission to ${project.name}.

We have successfully received your documents and created a case for review.

Case Reference: ${session.id.slice(0, 8).toUpperCase()}

Documents Received:
${attachments.map((a: any) => `- ${a.filename}`).join('\n') || '(No attachments)'}

We will contact you if any additional information is needed.

Thank you.`;
        }
        
        await sendEmail({
          fromInboxId: inboxId,
          to: fromEmail,
          subject: `Re: ${subject} - Submission Received`,
          textContent: confirmationBody,
          htmlContent: renderEmailTemplate(emailTemplate, {
            subject: `Re: ${subject} - Submission Received`,
            body: confirmationBody.replace(/\n/g, '<br>'),
            projectName: project.name,
            senderEmail: fromEmail
          }),
          replyToMessageId: messageId
        });
        console.log(`📧 Sent confirmation email to ${fromEmail}`);
      } catch (err) {
        console.error('📧 Failed to send confirmation email:', err);
      }
      
      res.json({ 
        success: true, 
        sessionId: session.id,
        projectId: project.id,
        documentCount: attachments.length 
      });
      
    } catch (error) {
      console.error('📧 Email webhook error:', error);
      res.status(500).json({ error: 'Failed to process email' });
    }
  });

  // Create HTTP server and return it
  const httpServer = createServer(app);
  return httpServer;
};
