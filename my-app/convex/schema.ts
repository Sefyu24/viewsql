import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  projects: defineTable({
    userId: v.string(),
    name: v.string(),
    schemaSql: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_id_updated", ["userId", "updatedAt"]),

  savedQueries: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    name: v.string(),
    sql: v.string(),
    createdAt: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_user_id", ["userId"]),
});
