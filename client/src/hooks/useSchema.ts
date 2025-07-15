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
      apiRequest("POST", `/api/projects/${projectId}/schema`, field).then(res => res.json()),
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
      apiRequest("PUT", `/api/schema-fields/${id}`, field).then(res => res.json()),
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/schema-fields/${id}`),
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
      apiRequest("POST", `/api/projects/${projectId}/collections`, collection).then(res => res.json()),
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
      apiRequest("PUT", `/api/collections/${id}`, collection).then(res => res.json()),
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/collections/${id}`),
    onSuccess: () => {
      // Invalidate all project queries since we don't know which project this collection belonged to
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

// Collection Properties
export function useCollectionProperties(collectionId: number) {
  return useQuery({
    queryKey: ["/api/collections", collectionId, "properties"],
    queryFn: () => fetch(`/api/collections/${collectionId}/properties`).then(res => res.json()),
    enabled: !!collectionId,
  });
}

export function useCreateProperty(collectionId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (property: Omit<InsertCollectionProperty, "collectionId">) =>
      apiRequest("POST", `/api/collections/${collectionId}/properties`, property).then(res => res.json()),
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
      apiRequest("PUT", `/api/properties/${id}`, property).then(res => res.json()),
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/properties/${id}`),
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
  });
}