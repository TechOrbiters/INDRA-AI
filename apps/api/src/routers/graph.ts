import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../services/database';

export const graphRouter = router({
  getGraph: protectedProcedure.query(async ({ ctx }) => {
    // F-003 Graph Visuals loader
    const entities = await db.graphEntity.findMany({
      where: { orgId: ctx.user.orgId },
    });

    const relationships = await db.graphRelationship.findMany({
      where: { orgId: ctx.user.orgId },
    });

    return {
      nodes: entities.map((e) => ({
        id: e.id,
        type: e.entityType,
        label: e.name,
        attributes: e.attributes ? JSON.parse(e.attributes) : {},
      })),
      edges: relationships.map((r) => ({
        id: r.id,
        source: r.sourceEntityId,
        target: r.targetEntityId,
        type: r.relationshipType,
        weight: r.weight,
      })),
    };
  }),

  getPath: protectedProcedure
    .input(z.object({ source: z.string(), target: z.string() }))
    .query(async ({ input, ctx }) => {
      // Find paths. For MVP, check if there is a direct or 2-step relation
      const relations = await db.graphRelationship.findMany({
        where: { orgId: ctx.user.orgId },
      });

      // Simple BFS pathway finder
      const adj: Record<string, string[]> = {};
      relations.forEach((rel) => {
        if (!adj[rel.sourceEntityId]) adj[rel.sourceEntityId] = [];
        if (!adj[rel.targetEntityId]) adj[rel.targetEntityId] = [];
        adj[rel.sourceEntityId].push(rel.targetEntityId);
        adj[rel.targetEntityId].push(rel.sourceEntityId); // treating relationships as undirected for routing
      });

      const queue: string[][] = [[input.source]];
      const visited = new Set<string>([input.source]);
      let path: string[] = [];

      while (queue.length > 0) {
        const currentPath = queue.shift()!;
        const lastNode = currentPath[currentPath.length - 1];

        if (lastNode === input.target) {
          path = currentPath;
          break;
        }

        const neighbors = adj[lastNode] || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push([...currentPath, neighbor]);
          }
        }
      }

      // Generate AI narrative explaining connection pathway
      let narrative = '';
      if (path.length > 1) {
        const entityNames: Record<string, string> = {};
        const entities = await db.graphEntity.findMany({
          where: { id: { in: path } },
        });
        entities.forEach(e => {
          entityNames[e.id] = e.name;
        });

        const steps = [];
        for (let i = 0; i < path.length - 1; i++) {
          const from = entityNames[path[i]] || path[i];
          const to = entityNames[path[i+1]] || path[i+1];
          steps.push(`"${from}" links to "${to}"`);
        }
        narrative = `Connection found: ${steps.join(' which in turn links to ')}. This relationship pattern suggests a direct collaboration alignment between these topics.`;
      } else {
        narrative = 'No path found between selected entities.';
      }

      return {
        path,
        narrative,
      };
    }),
});
