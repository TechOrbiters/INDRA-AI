import { useState, useEffect, useRef, useCallback } from 'react';
import AppShell from '../components/AppShell';
import { trpcClient } from '../utils/trpc';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  attributes: Record<string, unknown>;
  x?: number;
  y?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

type NodeType = 'person' | 'topic' | 'document' | 'project' | 'team' | string;

const TYPE_COLORS: Record<string, string> = {
  person: '#24A148',
  topic: '#0F62FE',
  document: '#8A3FFC',
  project: '#F1C21B',
  team: '#DA1E28',
};

const TYPE_LABELS: Record<string, string> = {
  person: 'Person',
  topic: 'Topic / Collection',
  document: 'Document',
  project: 'Project',
  team: 'Team',
};

function getColor(type: string): string {
  return TYPE_COLORS[type] || '#6F6F6F';
}

function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  // Force-directed layout approximation using a radial + jitter approach
  const W = 100, H = 100;
  const center = { x: W / 2, y: H / 2 };
  const positioned: GraphNode[] = [];

  // Count connections
  const degreeMap: Record<string, number> = {};
  edges.forEach(e => {
    degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
    degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
  });

  // Sort by degree descending — most connected near center
  const sorted = [...nodes].sort((a, b) => (degreeMap[b.id] || 0) - (degreeMap[a.id] || 0));

  sorted.forEach((node, i) => {
    if (i === 0) {
      positioned.push({ ...node, x: center.x, y: center.y });
    } else {
      const angle = (i / sorted.length) * 2 * Math.PI;
      const radius = 20 + (i % 3) * 10;
      positioned.push({
        ...node,
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
  });

  return positioned;
}

export default function GraphViewPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState<NodeType | 'all'>('all');
  const [hovered, setHovered] = useState<string | null>(null);
  const [pathResult, setPathResult] = useState<{ path: string[]; narrative: string } | null>(null);
  const [pathFrom, setPathFrom] = useState<string | null>(null);
  const [findingPath, setFindingPath] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (trpcClient as any).graph.getGraph.query();
        const positioned = layoutNodes(result.nodes, result.edges);
        setData({ nodes: positioned, edges: result.edges });
      } catch {
        setError('Failed to load knowledge graph. Make sure you are signed in.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const findPath = useCallback(async (from: string, to: string) => {
    setFindingPath(true);
    setPathResult(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (trpcClient as any).graph.getPath.query({ source: from, target: to });
      setPathResult(result);
    } catch {
      setPathResult({ path: [], narrative: 'Could not find a path between these nodes.' });
    } finally {
      setFindingPath(false);
    }
  }, []);

  const handleNodeClick = (node: GraphNode) => {
    if (pathFrom === null) {
      setSelected(node);
    } else if (pathFrom === node.id) {
      setPathFrom(null);
      setPathResult(null);
    } else {
      findPath(pathFrom, node.id);
      setPathFrom(null);
    }
  };

  const visibleNodes = data?.nodes.filter(n => filter === 'all' || n.type === filter) ?? [];
  const visibleEdgeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = data?.edges.filter(e => visibleEdgeIds.has(e.source) && visibleEdgeIds.has(e.target)) ?? [];
  const pathSet = new Set(pathResult?.path ?? []);

  const nodeMap: Record<string, GraphNode> = {};
  (data?.nodes ?? []).forEach(n => { nodeMap[n.id] = n; });

  const uniqueTypes = [...new Set((data?.nodes ?? []).map(n => n.type))];

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#8A3FFC]/30 border-t-[#8A3FFC] rounded-full animate-spin" />
            <div className="text-white/40 text-sm">Loading knowledge graph…</div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-4xl mb-4">🕸</div>
            <div className="text-white font-medium mb-2">Graph Unavailable</div>
            <div className="text-white/40 text-sm">{error}</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5 bg-[#0D1117] flex-shrink-0 flex-wrap">
          <h1 className="text-sm font-bold text-white">Knowledge Graph</h1>
          <span className="text-white/30 text-xs">
            {visibleNodes.length} nodes · {visibleEdges.length} connections
          </span>

          {/* Filter */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === 'all' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              All
            </button>
            {uniqueTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === type ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                style={filter === type ? { backgroundColor: `${getColor(type)}30`, color: getColor(type) } : {}}
              >
                {TYPE_LABELS[type] || type}
              </button>
            ))}
          </div>

          {/* Path finder UI */}
          <div className="ml-auto flex items-center gap-2">
            {pathFrom !== null ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8A3FFC]/10 border border-[#8A3FFC]/20">
                <span className="w-2 h-2 rounded-full bg-[#8A3FFC] animate-pulse" />
                <span className="text-xs text-[#8A3FFC]">Click target node to find path…</span>
                <button
                  onClick={() => { setPathFrom(null); setPathResult(null); }}
                  className="text-white/40 hover:text-white text-xs ml-1"
                >
                  ×
                </button>
              </div>
            ) : (
              selected && (
                <button
                  onClick={() => { setPathFrom(selected.id); setPathResult(null); }}
                  disabled={findingPath}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8A3FFC]/10 border border-[#8A3FFC]/20 text-[#8A3FFC] text-xs hover:bg-[#8A3FFC]/20 transition-colors"
                >
                  🔗 Find path from "{selected.label.slice(0, 20)}"
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* SVG Canvas */}
          <div className="flex-1 relative overflow-hidden bg-[#080B14]">
            {/* Grid pattern */}
            <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.05 }}>
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full"
              style={{ overflow: 'visible' }}
            >
              {/* Glow defs */}
              <defs>
                {uniqueTypes.map(type => (
                  <filter key={type} id={`glow-${type}`}>
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
              </defs>

              {/* Edges */}
              {visibleEdges.map(edge => {
                const src = nodeMap[edge.source];
                const tgt = nodeMap[edge.target];
                if (!src?.x || !tgt?.x) return null;
                const isHighlighted = pathSet.has(edge.source) && pathSet.has(edge.target);
                return (
                  <line
                    key={edge.id}
                    x1={src.x} y1={src.y}
                    x2={tgt.x} y2={tgt.y}
                    stroke={isHighlighted ? '#8A3FFC' : 'rgba(255,255,255,0.08)'}
                    strokeWidth={isHighlighted ? 0.6 : 0.3}
                    strokeDasharray={isHighlighted ? 'none' : 'none'}
                    style={{ transition: 'stroke 0.3s' }}
                  />
                );
              })}

              {/* Nodes */}
              {visibleNodes.map(node => {
                const color = getColor(node.type);
                const isSelected = selected?.id === node.id;
                const isHovered = hovered === node.id;
                const isInPath = pathSet.has(node.id);
                const isPathFrom = pathFrom === node.id;
                const radius = isSelected ? 3.5 : isHovered ? 3.2 : 2.5;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    aria-label={node.label}
                  >
                    {/* Outer glow ring */}
                    {(isSelected || isInPath || isPathFrom) && (
                      <circle
                        r={radius + 2}
                        fill="none"
                        stroke={isPathFrom ? '#8A3FFC' : color}
                        strokeWidth="0.4"
                        opacity="0.5"
                      />
                    )}

                    {/* Main circle */}
                    <circle
                      r={radius}
                      fill={`${color}${isSelected ? 'FF' : '25'}`}
                      stroke={color}
                      strokeWidth={isSelected ? 0.5 : 0.3}
                      filter={isSelected || isHovered ? `url(#glow-${node.type})` : undefined}
                    />

                    {/* Label */}
                    <text
                      y={radius + 2.5}
                      textAnchor="middle"
                      fill={isSelected || isHovered ? 'white' : 'rgba(255,255,255,0.5)'}
                      fontSize="2.2"
                      style={{ userSelect: 'none', transition: 'fill 0.2s', pointerEvents: 'none' }}
                    >
                      {node.label.length > 16 ? `${node.label.slice(0, 14)}…` : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 bg-[#0D1117]/80 backdrop-blur-sm rounded-xl p-3 border border-white/5">
              {Object.entries(TYPE_LABELS).filter(([t]) => uniqueTypes.includes(t)).map(([type, label]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(type) }} />
                  <span className="text-xs text-white/50">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-72 border-l border-white/5 bg-[#0D1117] flex flex-col overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b border-white/5">
              <div className="text-xs text-white/40 uppercase tracking-wider font-medium">Graph Stats</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: 'Nodes', value: data?.nodes.length || 0 },
                  { label: 'Edges', value: data?.edges.length || 0 },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-white">{s.value}</div>
                    <div className="text-xs text-white/40">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Path Result */}
            {pathResult && (
              <div className="p-4 border-b border-white/5">
                <div className="text-xs text-[#8A3FFC] uppercase tracking-wider font-medium mb-2">Path Result</div>
                <p className="text-xs text-white/60 leading-relaxed">{pathResult.narrative}</p>
                {pathResult.path.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pathResult.path.map((nodeId, i) => (
                      <div key={nodeId} className="flex items-center gap-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#8A3FFC]/10 text-[#8A3FFC] border border-[#8A3FFC]/20">
                          {nodeMap[nodeId]?.label || nodeId}
                        </span>
                        {i < pathResult.path.length - 1 && (
                          <span className="text-white/20 text-xs">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Node Detail */}
            {selected ? (
              <div className="p-4 flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${getColor(selected.type)}20`, border: `1px solid ${getColor(selected.type)}40` }}
                  >
                    {selected.type === 'person' ? '👤'
                      : selected.type === 'document' ? '📄'
                      : selected.type === 'topic' ? '🏷'
                      : selected.type === 'project' ? '🚀'
                      : '🌐'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{selected.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: getColor(selected.type) }}>
                      {TYPE_LABELS[selected.type] || selected.type}
                    </div>
                  </div>
                </div>

                {Object.entries(selected.attributes).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(selected.attributes).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2">
                        <div className="text-xs text-white/40 capitalize w-20 flex-shrink-0">{key}</div>
                        <div className="text-xs text-white/70">{String(val)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs text-white/40 mb-2">Connections</div>
                  <div className="text-sm font-bold text-white">
                    {data?.edges.filter(e => e.source === selected.id || e.target === selected.id).length ?? 0}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/30">
                <div className="text-4xl mb-3">🕸</div>
                <div className="text-xs">Click any node to inspect it</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
