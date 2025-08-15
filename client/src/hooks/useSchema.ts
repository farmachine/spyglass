import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ProjectSchemaField, 
  InsertProjectSchemaField,
  ObjectCollection,
  InsertObjectCollection,
  CollectionProperty,
  InsertCollectionProperty,
  ExcelWizardryFunction,
  KnowledgeDocument,
  ExtractionRule
} from "@shared/schema";

// Schema Fields
export function useProjectSchemaFields(projectId: string) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "schema"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/schema`),
    enabled: !!projectId,
  });
}

export function useCreateSchemaField(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (field: Omit<InsertProjectSchemaField, "projectId">) =>
      apiRequest(`/api/projects/${projectId}/schema`, {
        method: "POST",
        body: JSON.stringify(field),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "schema"] });
    },
  });
}

export function useUpdateSchemaField(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, field }: { id: string; field: Partial<InsertProjectSchemaField> }) =>
      apiRequest(`/api/schema-fields/${id}`, {
        method: "PUT",
        body: JSON.stringify(field),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "schema"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

export function useDeleteSchemaField(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/api/schema-fields/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "schema"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

// Object Collections
export function useObjectCollections(projectId: string) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "collections"],
    queryFn: () => apiRequest(`/api/projects/${projectId}/collections`),
    enabled: !!projectId,
  });
}

export function useCreateCollection(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (collection: Omit<InsertObjectCollection, "projectId">) =>
      apiRequest(`/api/projects/${projectId}/collections`, {
        method: "POST",
        body: JSON.stringify(collection),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "collections"] });
    },
  });
}

export function useUpdateCollection(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, collection }: { id: string; collection: Partial<InsertObjectCollection> }) =>
      apiRequest(`/api/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(collection),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

export function useDeleteCollection(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/api/collections/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      // Only invalidate if optimistic updates haven't already been applied
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: () => {
      // This will be handled by the component's error handling
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

// Collection Properties
export function useCollectionProperties(collectionId: string) {
  return useQuery({
    queryKey: ["/api/collections", collectionId, "properties"],
    queryFn: () => apiRequest(`/api/collections/${collectionId}/properties`),
    enabled: !!collectionId,
  });
}

// Get all properties for all collections in a project (for target fields)
export function useAllProjectProperties(projectId: string) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "all-properties"],
    queryFn: async () => {
      // First get all collections for the project
      const collections = await apiRequest(`/api/projects/${projectId}/collections`);
      
      // Then get properties for each collection
      const allProperties = [];
      for (const collection of collections) {
        try {
          const properties = await apiRequest(`/api/collections/${collection.id}/properties`);
          allProperties.push(...properties.map(prop => ({
            ...prop,
            collectionName: collection.collectionName,
          })));
        } catch (error) {
          console.warn(`Failed to fetch properties for collection ${collection.id}:`, error);
        }
      }
      
      return allProperties;
    },
    enabled: !!projectId,
  });
}

export function useCreateProperty(collectionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (property: Omit<InsertCollectionProperty, "collectionId">) =>
      apiRequest(`/api/collections/${collectionId}/properties`, {
        method: "POST",
        body: JSON.stringify(property),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections", collectionId, "properties"] });
      // Also invalidate project queries since collections are part of project details
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, property, collectionId }: { id: string; property: Partial<InsertCollectionProperty>; collectionId?: string }) => {
      console.log('🚀 API CALL - PUT /api/properties/' + id, {
        propertyData: property,
        collectionId
      });
      return apiRequest(`/api/properties/${id}`, {
        method: "PUT",
        body: JSON.stringify(property),
      });
    },
    onSuccess: (result, { property, collectionId }) => {
      console.log('✅ API SUCCESS - Property update response:', result);
      
      // Use the collectionId parameter or the property's collectionId
      const targetCollectionId = collectionId || property.collectionId;
      if (targetCollectionId) {
        console.log('🔄 CACHE INVALIDATION - Invalidating collection properties for:', targetCollectionId);
        queryClient.invalidateQueries({ queryKey: ["/api/collections", targetCollectionId, "properties"] });
      }
      // Invalidate all project-related queries for broader cache refresh
      console.log('🔄 CACHE INVALIDATION - Invalidating all project and collection queries');
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
    onError: (error) => {
      console.error('❌ API ERROR - Property update failed:', error);
    }
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/api/properties/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
  });
}

// Excel Wizardry Functions
export function useExcelWizardryFunctions() {
  return useQuery({
    queryKey: ["/api/excel-functions"],
    queryFn: () => apiRequest("/api/excel-functions"),
  });
}