import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get all projects for the authenticated user.
 *
 * @returns Array of project documents ordered by most recently updated,
 *          or an empty array if not authenticated.
 */
export const getProjects = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("projects")
      .withIndex("by_user_id_updated", (q) =>
        q.eq("userId", identity.subject)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Get a single project by its ID.
 *
 * @param id - The project document ID.
 * @returns The project document, or null if not found or not owned by the user.
 */
export const getProject = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== identity.subject) return null;
    return project;
  },
});

/**
 * Create a new project with a name and raw schema DDL.
 *
 * The DDL is stored as-is — PGlite validates and executes it client-side.
 *
 * @param name - Display name for the project.
 * @param schemaSql - Raw PostgreSQL DDL (CREATE TABLE statements, etc.).
 * @returns The new project's document ID.
 * @throws If the user is not authenticated.
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    schemaSql: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const now = Date.now();
    return await ctx.db.insert("projects", {
      userId: identity.subject,
      name: args.name,
      schemaSql: args.schemaSql,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing project's name and/or schema DDL.
 *
 * Only the fields provided will be updated. Always bumps `updatedAt`.
 *
 * @param id - The project document ID.
 * @param name - (optional) New display name.
 * @param schemaSql - (optional) New raw DDL string.
 * @throws If the user is not authenticated or does not own the project.
 */
export const updateProject = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    schemaSql: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found");
    }
    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.schemaSql !== undefined && { schemaSql: args.schemaSql }),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a project and all its associated saved queries.
 *
 * @param id - The project document ID.
 * @throws If the user is not authenticated or does not own the project.
 */
export const deleteProject = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found");
    }
    // Delete associated saved queries
    const queries = await ctx.db
      .query("savedQueries")
      .withIndex("by_project_id", (q) => q.eq("projectId", args.id))
      .collect();
    for (const q of queries) {
      await ctx.db.delete(q._id);
    }
    await ctx.db.delete(args.id);
  },
});
