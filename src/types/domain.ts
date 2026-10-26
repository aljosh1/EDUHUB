export type Permission = "viewer" | "editor";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export interface DocumentSummary {
  id: string;
  title: string;
  owner_id: string;
  updated_at: string;
  created_at: string;
  owner_display_name?: string | null;
}

export interface DocumentRecord extends DocumentSummary {
  content: unknown;
}

export interface ShareRecord {
  id: string;
  document_id: string;
  shared_by: string;
  shared_with: string;
  permission: Permission;
  created_at: string;
  shared_with_email?: string | null;
  shared_with_display_name?: string | null;
}

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] } as const;

/** Central permission evaluation used by UI and server. */
export function evaluatePermission(params: {
  userId: string;
  ownerId: string;
  sharePermission?: Permission | null;
}): { canRead: boolean; canEdit: boolean; canDelete: boolean; canManageShares: boolean; role: "owner" | "editor" | "viewer" | "none" } {
  const { userId, ownerId, sharePermission } = params;
  if (userId === ownerId) {
    return {
      canRead: true,
      canEdit: true,
      canDelete: true,
      canManageShares: true,
      role: "owner",
    };
  }
  if (sharePermission === "editor") {
    return {
      canRead: true,
      canEdit: true,
      canDelete: false,
      canManageShares: false,
      role: "editor",
    };
  }
  if (sharePermission === "viewer") {
    return {
      canRead: true,
      canEdit: false,
      canDelete: false,
      canManageShares: false,
      role: "viewer",
    };
  }
  return {
    canRead: false,
    canEdit: false,
    canDelete: false,
    canManageShares: false,
    role: "none",
  };
}
