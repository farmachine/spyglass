import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertProjectSchema,
  insertProjectSchemaFieldSchema,
  insertObjectCollectionSchema,
  insertCollectionPropertySchema,
  insertKnowledgeDocumentSchema,
  insertExtractionRuleSchema,
  insertExtractionSessionSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProjectWithDetails(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const result = insertProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      const project = await storage.createProject(result.data);
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProjectSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.errors });
      }
      
      const project = await storage.updateProject(id, result.data);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project Schema Fields
  app.get("/api/projects/:projectId/schema", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const fields = await storage.getProjectSchemaFields(projectId);
      res.json(fields);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schema fields" });
    }
  });

  app.post("/api/projects/:projectId/schema", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const result = insertProjectSchemaFieldSchema.safeParse({
        ...req.body,
        projectId
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid schema field data", errors: result.error.errors });
      }
      
      const field = await storage.createProjectSchemaField(result.data);
      res.status(201).json(field);
    } catch (error) {
      res.status(500).json({ message: "Failed to create schema field" });
    }
  });

  app.put("/api/schema-fields/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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
  app.get("/api/projects/:projectId/collections", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const collections = await storage.getObjectCollections(projectId);
      res.json(collections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.post("/api/projects/:projectId/collections", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const result = insertObjectCollectionSchema.safeParse({
        ...req.body,
        projectId
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid collection data", errors: result.error.errors });
      }
      
      const collection = await storage.createObjectCollection(result.data);
      res.status(201).json(collection);
    } catch (error) {
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  app.put("/api/collections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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

  app.delete("/api/collections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteObjectCollection(id);
      if (!deleted) {
        return res.status(404).json({ message: "Collection not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete collection" });
    }
  });

  // Collection Properties
  app.get("/api/collections/:collectionId/properties", async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      const properties = await storage.getCollectionProperties(collectionId);
      res.json(properties);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collection properties" });
    }
  });

  app.post("/api/collections/:collectionId/properties", async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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
      const projectId = parseInt(req.params.projectId);
      const documents = await storage.getKnowledgeDocuments(projectId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge documents" });
    }
  });

  app.post("/api/projects/:projectId/knowledge", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
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
      const id = parseInt(req.params.id);
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
      res.status(500).json({ message: "Failed to update knowledge document" });
    }
  });

  app.delete("/api/knowledge/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteKnowledgeDocument(id);
      if (!success) {
        return res.status(404).json({ message: "Knowledge document not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete knowledge document" });
    }
  });

  // Extraction Rules
  app.get("/api/projects/:projectId/rules", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const rules = await storage.getExtractionRules(projectId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch extraction rules" });
    }
  });

  app.post("/api/projects/:projectId/rules", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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
      const projectId = parseInt(req.params.projectId);
      const sessions = await storage.getExtractionSessions(projectId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch extraction sessions" });
    }
  });

  app.post("/api/projects/:projectId/sessions", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const result = insertExtractionSessionSchema.safeParse({ ...req.body, projectId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid extraction session data", errors: result.error.errors });
      }
      
      const session = await storage.createExtractionSession(result.data);
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to create extraction session" });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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

  // Process extraction session with AI
  app.post("/api/sessions/:sessionId/process", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { files, project_data } = req.body;
      
      // Import the Python AI extraction module
      const { spawn } = require('child_process');
      
      // Prepare data for Python script
      const extractionData = {
        session_id: sessionId,
        files: files || [],
        project_schema: {
          schema_fields: project_data?.schemaFields || [],
          collections: project_data?.collections || []
        },
        extraction_rules: project_data?.extractionRules || []
      };
      
      // Call Python extraction script
      const python = spawn('python', ['-c', `
import sys
import json
sys.path.append('.')
from ai_extraction import process_extraction_session

data = json.loads(sys.stdin.read())
result = process_extraction_session(data)
print(json.dumps(result))
`]);
      
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
          console.error('Python script error:', error);
          return res.status(500).json({ 
            message: "AI extraction failed", 
            error: error 
          });
        }
        
        try {
          const result = JSON.parse(output);
          
          // Update session status
          await storage.updateExtractionSession(sessionId, {
            status: "completed",
            extractedData: JSON.stringify(result)
          });
          
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

  const httpServer = createServer(app);
  return httpServer;
}
