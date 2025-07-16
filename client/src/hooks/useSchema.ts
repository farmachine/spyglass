import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ProjectSchemaField, 
  InsertProjectSchemaField,
  ObjectCollection,
  InsertObjectCollection,
  CollectionProperty,
  InsertCollectionProperty
} from "@shared/schema";

// Schema Fields
export function useProjectSchemaFields(projectId: number) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "schema"],
    queryFn: () => fetch(`/api/projects/${projectId}/schema`).then(res => res.json()),
    enabled: !!projectId,
  });
}

export function useCreateSchemaField(projectId: number) {
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

export function useUpdateSchemaField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, field }: { id: number; field: Partial<InsertProjectSchemaField> }) =>
      apiRequest(`/api/schema-fields/${id}`, {
        method: "PUT",
        body: JSON.stringify(field),
      }),
    onSuccess: (_, { field }) => {
      if (field.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", field.projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", field.projectId, "schema"] });
      }
    },
  });
}

export function useDeleteSchemaField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => apiRequest(`/api/schema-fields/${id}`, {
      method: "DELETE",
    }),
    onSuccess: (_, id) => {
      // Invalidate all project queries since we don't know which project this field belonged to
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

// Object Collections
export function useObjectCollections(projectId: number) {
  return useQuery({
    queryKey: ["/api/projects", projectId, "collections"],
    queryFn: () => fetch(`/api/projects/${projectId}/collections`).then(res => res.json()),
    enabled: !!projectId,
  });
}

export function useCreateCollection(projectId: number) {
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

export function useUpdateCollection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, collection }: { id: number; collection: Partial<InsertObjectCollection> }) =>
      apiRequest(`/api/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(collection),
      }),
    onSuccess: (_, { collection }) => {
      if (collection.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", collection.projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", collection.projectId, "collections"] });
      }
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => apiRequest(`/api/collections/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      // Invalidate all project queries since we don't know which project this collection belonged to
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
    onError: (error: any) => {
      console.error("Delete collection error:", error);
    },
  });
}

// Collection Properties
export function useCollectionProperties(collectionId: number) {
  return useQuery({
    queryKey: ["/api/collections", collectionId, "properties"],
    queryFn: () => apiRequest(`/api/collections/${collectionId}/properties`),
    enabled: !!collectionId,
  });
}

// Get all properties for all collections in a project (for target fields)
export function useAllProjectProperties(projectId: number) {
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

export function useCreateProperty(collectionId: number) {
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
    mutationFn: ({ id, property }: { id: number; property: Partial<InsertCollectionProperty> }) =>
      apiRequest(`/api/properties/${id}`, {
        method: "PUT",
        body: JSON.stringify(property),
      }),
    onSuccess: (_, { property }) => {
      if (property.collectionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/collections", property.collectionId, "properties"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => apiRequest(`/api/properties/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
  });
}