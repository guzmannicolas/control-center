import { useEffect, useState } from 'react';

export interface RagStageInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  industryStandard: string;
  pythonSnippet: string;
}

export const RAG_STAGES: RagStageInfo[] = [
  {
    id: 'query-expansion',
    name: '1. Query Transformation & HyDE',
    category: 'Input Optimization',
    description: 'User queries are often ambiguous, short, or poorly phrased. Modern RAG pipelines expand the query using Multi-Query generation, Step-Back prompting, or HyDE (Hypothetical Document Embeddings) to bridge lexical and semantic gaps.',
    industryStandard: 'LangChain MultiQueryRetriever, LlamaIndex SubQuestionQueryEngine, Cohere Rerank query expansion.',
    pythonSnippet: `from pydantic import BaseModel, Field
import google.genai as genai

class QueryExpansions(BaseModel):
    queries: list[str] = Field(description="3 diverse reformulations of the original query")

def expand_query(client: genai.Client, original_query: str) -> list[str]:
    prompt = f"Generate 3 diverse search queries capturing different technical angles of: '{original_query}'"
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=dict(response_mime_type="application/json", response_schema=QueryExpansions)
    )
    return [original_query] + response.parsed.queries`,
  },
  {
    id: 'hybrid-retrieval',
    name: '2. Hybrid Retrieval (Dense + Sparse BM25)',
    category: 'Dual-Channel Retrieval',
    description: 'Dense vector embeddings (OpenAI text-embedding-3, Cohere embed-v3) excel at semantic similarity, but fail on exact identifiers, model numbers, and error codes. Modern systems run Dense Vector Cosine AND Sparse BM25 / SPLADE in parallel.',
    industryStandard: 'pgvector + pg_trgm / tsvector, Qdrant Hybrid Search, Pinecone Sparse-Dense, Elasticsearch BM25.',
    pythonSnippet: `async def hybrid_retrieve(query: str, top_k: int = 25):
    # Parallel dispatch: semantic vector search + keyword lexical BM25
    dense_task = vector_store.similarity_search_with_score(query, k=top_k)
    sparse_task = bm25_index.search(query, k=top_k)
    dense_results, sparse_results = await asyncio.gather(dense_task, sparse_task)
    
    # Reciprocal Rank Fusion (RRF) with constant k=60
    rrf_scores = {}
    for rank, doc in enumerate(dense_results):
        rrf_scores[doc.id] = rrf_scores.get(doc.id, 0) + 1.0 / (60 + rank + 1)
    for rank, doc in enumerate(sparse_results):
        rrf_scores[doc.id] = rrf_scores.get(doc.id, 0) + 1.0 / (60 + rank + 1)
        
    return sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]`,
  },
  {
    id: 'reranking',
    name: '3. Cross-Encoder Re-Ranking',
    category: 'Attention-Based Filtering',
    description: 'Bi-encoders embed query and documents independently into fixed vectors (fast, coarse). Cross-encoders feed (Query, Document) pairs together through full multi-head self-attention layers. Reranking filters 50 raw candidates down to the top 5 high-precision chunks.',
    industryStandard: 'Cohere Rerank v3, BAAI/bge-reranker-large, FlashRank, CrossEncoder(ms-marco-MiniLM-L-6-v2).',
    pythonSnippet: `from sentence_transformers import CrossEncoder

reranker = CrossEncoder('BAAI/bge-reranker-large')

def rerank_documents(query: str, candidates: list[Document], top_n: int = 5) -> list[Document]:
    # Feed query-document pairs into joint cross-attention
    pairs = [[query, doc.page_content] for doc in candidates]
    scores = reranker.predict(pairs)
    
    # Rank by semantic cross-attention score
    scored_docs = list(zip(candidates, scores))
    scored_docs.sort(key=lambda x: x[1], reverse=True)
    
    # Keep only confident matches above threshold
    return [doc for doc, score in scored_docs[:top_n] if score > 0.35]`,
  },
  {
    id: 'context-assembly',
    name: '4. Context Packing & Lost-in-the-Middle',
    category: 'Prompt Engineering',
    description: 'LLMs exhibit the "Lost in the Middle" phenomenon: chunks placed in the center of long prompts are often ignored. Modern context packers place the highest-confidence chunk at the very beginning, second highest at the very end, and surround them with markdown citations.',
    industryStandard: 'LangChain LongContextReorder, Contextual Compression, Token-budget pruning.',
    pythonSnippet: `def assemble_context_window(ranked_docs: list[Document], max_tokens: int = 4000) -> str:
    # Reorder documents: golden chunks at start and end
    reordered = []
    for i, doc in enumerate(ranked_docs):
        if i % 2 == 0:
            reordered.append(doc)
        else:
            reordered.insert(0, doc)
            
    # Format with explicit citation anchors
    formatted_chunks = [
        f"<document index='{i+1}' source='{doc.metadata.get('source')}'>\\n{doc.page_content}\\n</document>"
        for i, doc in enumerate(reordered)
    ]
    return "\\n\\n".join(formatted_chunks)`,
  },
  {
    id: 'agentic-crag',
    name: '5. Corrective RAG (CRAG) & Agentic Loops',
    category: 'Self-Correction & Reflection',
    description: 'Static RAG blindly answers even if the retrieved context is irrelevant or conflicting. Corrective RAG (CRAG) runs a retrieval evaluator node: if relevant, it synthesizes; if ambiguous, it triggers web search or knowledge graph expansion; if irrelevant, it triggers query reformulation.',
    industryStandard: 'LangGraph StateGraph, LlamaIndex Agent Workflow, Self-RAG, Adaptive RAG.',
    pythonSnippet: `from langgraph.graph import StateGraph, END

def evaluate_retrieval(state: RagState) -> str:
    evaluator_prompt = f"Are these documents sufficient to accurately answer: '{state['query']}'?"
    confidence = grade_documents(evaluator_prompt, state['documents'])
    
    if confidence == "CORRECT":
        return "generate_answer"
    elif confidence == "AMBIGUOUS":
        return "web_search_fallback"
    else:
        return "rewrite_query"

workflow = StateGraph(RagState)
workflow.add_node("retrieve", hybrid_retrieve)
workflow.add_node("rerank", rerank_documents)
workflow.add_node("evaluate", evaluate_retrieval)
workflow.add_conditional_edges("evaluate", evaluate_retrieval, {
    "generate_answer": "synthesize",
    "web_search_fallback": "tavily_search",
    "rewrite_query": "rewrite"
})`,
  },
];

interface SimulationCandidate {
  id: string;
  source: string;
  snippet: string;
  denseRank: number;
  sparseRank: number;
  initialScore: number;
  rerankScore: number;
  selected: boolean;
}

const SAMPLE_CANDIDATES: SimulationCandidate[] = [
  {
    id: 'doc-1',
    source: 'knowledge/architecture.md',
    snippet: 'MCP Authenticator validates tokens via SHA-256 hashes and timingSafeEqual. It supports instant revocation without restarting Docker containers.',
    denseRank: 1,
    sparseRank: 3,
    initialScore: 0.88,
    rerankScore: 0.96,
    selected: true,
  },
  {
    id: 'doc-2',
    source: 'knowledge/database-schema.md',
    snippet: 'PostgreSQL schema holds outreach leads, deals, and audit logs. Connection pool limits Fastify to 20 max clients.',
    denseRank: 2,
    sparseRank: 12,
    initialScore: 0.74,
    rerankScore: 0.31,
    selected: false,
  },
  {
    id: 'doc-3',
    source: 'apps/api/src/mcp/auth.ts',
    snippet: 'McpAuthenticator parses Bearer token, queries mcp_tokens.json, and decorates FastifyRequest with client identity and rate limit bounds.',
    denseRank: 4,
    sparseRank: 1,
    initialScore: 0.82,
    rerankScore: 0.94,
    selected: true,
  },
  {
    id: 'doc-4',
    source: 'knowledge/vps-topology.md',
    snippet: 'Contabo VPS runs Caddy on port 443 with TLS reverse proxying to Fastify on port 4100.',
    denseRank: 8,
    sparseRank: 6,
    initialScore: 0.65,
    rerankScore: 0.22,
    selected: false,
  },
  {
    id: 'doc-5',
    source: 'apps/api/src/routes/knowledge.ts',
    snippet: 'POST /api/mcp endpoint handles JSON-RPC 2.0 messages with strict 120 req/min rate limit to block denial of service attempts.',
    denseRank: 3,
    sparseRank: 2,
    initialScore: 0.85,
    rerankScore: 0.91,
    selected: true,
  },
];

export function RagStudio() {
  const [activeStageId, setActiveStageId] = useState<string>('query-expansion');
  const [selectedQuery, setSelectedQuery] = useState<string>(
    'How does our MCP server authenticate clients and prevent unauthorized access?'
  );
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [rerankerEnabled, setRerankerEnabled] = useState<boolean>(true);
  const [chunkSize, setChunkSize] = useState<number>(512);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'code' | 'architecture'>('pipeline');

  const activeStage = RAG_STAGES.find((s) => s.id === activeStageId) ?? RAG_STAGES[0]!;

  // Simulation step runner
  useEffect(() => {
    if (!isSimulating) return;
    if (simulationStep < 5) {
      const timer = setTimeout(() => {
        setSimulationStep((prev) => prev + 1);
      }, 1600);
      return () => clearTimeout(timer);
    }
    setIsSimulating(false);
  }, [isSimulating, simulationStep]);

  const handleRunSimulation = () => {
    setSimulationStep(1);
    setIsSimulating(true);
  };

  const handleResetSimulation = () => {
    setIsSimulating(false);
    setSimulationStep(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0b0f19 0%, #081d33 100%)',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
              State of the Art RAG & AI Retrieval Pipelines
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Interactive visual simulator of production retrieval systems: Hybrid Search, Cross-Encoder Re-Ranking, and Agentic Reflection.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('pipeline')}
              style={{
                background: activeTab === 'pipeline' ? '#1e293b' : 'transparent',
                border: `1px solid ${activeTab === 'pipeline' ? '#38bdf8' : '#334155'}`,
                color: activeTab === 'pipeline' ? '#38bdf8' : '#94a3b8',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Interactive Simulator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              style={{
                background: activeTab === 'code' ? '#1e293b' : 'transparent',
                border: `1px solid ${activeTab === 'code' ? '#38bdf8' : '#334155'}`,
                color: activeTab === 'code' ? '#38bdf8' : '#94a3b8',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Production Python Code
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('architecture')}
              style={{
                background: activeTab === 'architecture' ? '#1e293b' : 'transparent',
                border: `1px solid ${activeTab === 'architecture' ? '#38bdf8' : '#334155'}`,
                color: activeTab === 'architecture' ? '#38bdf8' : '#94a3b8',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Architecture Comparison
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'pipeline' && (
        <>
          {/* Simulation Query Configuration & Controls */}
          <div
            style={{
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="rag-query-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8' }}>
                Query Simulation Input
              </label>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <input
                  id="rag-query-input"
                  type="text"
                  value={selectedQuery}
                  onChange={(e) => setSelectedQuery(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '280px',
                    background: '#0b0f19',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    fontSize: '0.84rem',
                    color: '#f8fafc',
                  }}
                />
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  style={{
                    background: isSimulating ? '#854d0e' : '#0284c7',
                    border: `1px solid ${isSimulating ? '#eab308' : '#38bdf8'}`,
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: isSimulating ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {isSimulating ? `Processing Stage ${simulationStep}/5...` : 'Run Pipeline Simulation'}
                </button>
                {simulationStep > 0 && (
                  <button
                    type="button"
                    onClick={handleResetSimulation}
                    style={{
                      background: 'transparent',
                      border: '1px solid #334155',
                      color: '#94a3b8',
                      borderRadius: '8px',
                      padding: '0.6rem 0.85rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Hyperparameter Controls */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                borderTop: '1px solid #1e293b',
                paddingTop: '0.75rem',
              }}
            >
              {/* Chunk Size */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Chunk Size: <strong style={{ color: '#38bdf8' }}>{chunkSize} tokens</strong>
                </span>
                <input
                  type="range"
                  min="256"
                  max="1024"
                  step="256"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              {/* Reranker Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setRerankerEnabled(!rerankerEnabled)}
                  style={{
                    background: rerankerEnabled ? '#064e3b' : '#1e293b',
                    border: `1px solid ${rerankerEnabled ? '#10b981' : '#475569'}`,
                    color: rerankerEnabled ? '#6ee7b7' : '#94a3b8',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cross-Encoder Reranker: {rerankerEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#cbd5e1' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: simulationStep > 0 ? '#10b981' : '#64748b',
                  }}
                />
                <span>
                  {simulationStep === 0
                    ? 'Ready to simulate'
                    : simulationStep === 5
                    ? 'Pipeline execution complete'
                    : `Active Stage: ${RAG_STAGES[simulationStep - 1]?.name}`}
                </span>
              </div>
            </div>
          </div>

          {/* Animated Flow Pipeline Diagram */}
          <div
            style={{
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
                Visual Execution Workflow
              </span>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Click any stage to inspect its production logic
              </span>
            </div>

            {/* Interactive Stage Pipeline Cards with Animated Connectors */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.6rem',
                position: 'relative',
              }}
            >
              {RAG_STAGES.map((stage, idx) => {
                const stageIndex = idx + 1;
                const isCurrentStage = simulationStep === stageIndex;
                const isPassedStage = simulationStep > stageIndex;
                const isSelected = activeStageId === stage.id;

                let borderColor = '#1e293b';
                let bgColor = '#0b0f19';
                let textColor = '#94a3b8';

                if (isCurrentStage) {
                  borderColor = '#38bdf8';
                  bgColor = '#031326';
                  textColor = '#38bdf8';
                } else if (isPassedStage) {
                  borderColor = '#10b981';
                  bgColor = 'rgba(16, 185, 129, 0.05)';
                  textColor = '#6ee7b7';
                } else if (isSelected) {
                  borderColor = '#818cf8';
                  bgColor = '#0f172a';
                  textColor = '#c7d2fe';
                }

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setActiveStageId(stage.id)}
                    style={{
                      background: bgColor,
                      border: `1px solid ${borderColor}`,
                      boxShadow: isCurrentStage ? '0 0 14px rgba(56, 189, 248, 0.35)' : 'none',
                      borderRadius: '10px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.25s ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: textColor, textTransform: 'uppercase' }}>
                        {isPassedStage ? 'DONE' : isCurrentStage ? 'ACTIVE' : `STAGE ${stageIndex}`}
                      </span>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: isPassedStage ? '#10b981' : isCurrentStage ? '#38bdf8' : '#334155',
                          boxShadow: isCurrentStage ? '0 0 8px #38bdf8' : 'none',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.3 }}>
                      {stage.name.replace(/^\d+\.\s*/, '')}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{stage.category}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Data Candidates View (Simulated retrieval results) */}
            <div
              style={{
                background: '#0b0f19',
                border: '1px solid #1e293b',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                  Retrieved Chunk Candidates & Reranking Scores
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {rerankerEnabled
                    ? 'Cross-Encoder filtered noise chunks; top 3 promoted to context window'
                    : 'Raw Bi-Encoder vector scores (unfiltered)'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {SAMPLE_CANDIDATES.map((item) => {
                  const isKept = rerankerEnabled ? item.selected : item.initialScore > 0.7;
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isKept ? '#081726' : '#0f172a',
                        border: `1px solid ${isKept ? '#0284c7' : '#1e293b'}`,
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        opacity: isKept ? 1 : 0.5,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                          {item.source}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Dense Rank #{item.denseRank} | BM25 Rank #{item.sparseRank}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: isKept ? '#064e3b' : '#1e293b',
                              color: isKept ? '#34d399' : '#94a3b8',
                            }}
                          >
                            Score: {rerankerEnabled ? item.rerankScore.toFixed(2) : item.initialScore.toFixed(2)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: isKept ? '#34d399' : '#f87171',
                            }}
                          >
                            {isKept ? 'INCLUDED IN PROMPT' : 'FILTERED (NOISE)'}
                          </span>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                        {item.snippet}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Code Inspector Tab */}
      {activeTab === 'code' && (
        <div
          style={{
            background: '#050811',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                {activeStage.name}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Industry Standard Tools: <strong style={{ color: '#38bdf8' }}>{activeStage.industryStandard}</strong>
              </p>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            {activeStage.description}
          </p>

          <div
            style={{
              background: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#e2e8f0',
              overflowX: 'auto',
              lineHeight: 1.55,
            }}
          >
            <pre style={{ margin: 0 }}>{activeStage.pythonSnippet}</pre>
          </div>
        </div>
      )}

      {/* Architecture Comparison Tab */}
      {activeTab === 'architecture' && (
        <div
          style={{
            background: '#050811',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
            Evolution of RAG Architectures (2023 - 2026)
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1e293b', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem' }}>Architecture Paradigm</th>
                  <th style={{ padding: '0.75rem' }}>Retrieval Strategy</th>
                  <th style={{ padding: '0.75rem' }}>Weaknesses / Vulnerabilities</th>
                  <th style={{ padding: '0.75rem' }}>Production Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 700, color: '#f87171' }}>Naive RAG (2023)</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>Single cosine similarity on fixed-size chunks (e.g. 500 chars).</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>Misses exact IDs, keyword mismatches, high hallucination rate.</td>
                  <td style={{ padding: '0.75rem', color: '#f87171' }}>Deprecated for production. Only for basic tutorials.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>Advanced RAG (2024-2025)</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>Hybrid Search (BM25 + Dense) + Cross-Encoder Reranking + Sliding window chunking.</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>Static execution: fails if knowledge base has no answer (cannot self-correct).</td>
                  <td style={{ padding: '0.75rem', color: '#38bdf8' }}>Standard baseline for internal enterprise search.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 700, color: '#34d399' }}>Modular & Agentic RAG / CRAG (2026)</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>Dynamic Routing, Reflection Loops, Query Rewriting, Web Fallback, Tool Calling.</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>Higher token latency and orchestration complexity.</td>
                  <td style={{ padding: '0.75rem', color: '#34d399' }}>Gold standard for mission-critical agentic systems.</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.75rem', fontWeight: 700, color: '#a78bfa' }}>GraphRAG (2026)</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>Entity extraction + Knowledge Graph relationship traversal combined with vector space.</td>
                  <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>High ingestion cost during graph clustering.</td>
                  <td style={{ padding: '0.75rem', color: '#a78bfa' }}>Best for multi-hop reasoning over large unstructured corpora.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
