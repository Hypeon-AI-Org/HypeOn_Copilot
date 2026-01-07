/**
 * React Hook for HypeOn Chat Integration
 * Based on FRONTEND_INTEGRATION.md
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChatService, ChatRequest, ChatResponse, Session, Message, TableData, Insight, Artifact, ResearchPlan, SearchTermStatus } from '@/lib/chatService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export interface UseHypeonChatOptions {
  apiUrl?: string;
  token?: string | null;
  autoLoadSessions?: boolean;
}

export interface StageInfo {
  name: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  message?: string;
  latencyMs?: number;
  error?: string;
  stageIndex?: number;
  totalStages?: number;
}

export interface UseHypeonChatReturn {
  // State
  messages: Message[];
  sessionId: string | null;
  sessions: Session[];
  loading: boolean;
  error: string | null;
  currentSession: Session | null;
  progress: {
    stage: string;
    progress: number;
    message: string;
  } | null;
  stages: Map<string, StageInfo>; // Track all stages in execution
  stagesArray: StageInfo[]; // Array version for React re-rendering
  progressUpdateCounter: number; // Counter that increments on each progress update
  researchPlan: ResearchPlan | null; // Research plan with search terms

  // Actions
  sendMessage: (message: string) => Promise<ChatResponse | null>;
  sendMessageStream: (
    message: string,
    onChunk: (chunk: string) => void,
    onProgress?: (stage: string, progress: number, message: string) => void
  ) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  newChat: () => void;
  setSession: (sessionId: string | null) => void;
  refreshSessions: () => Promise<void>;
}

export function useHypeonChat(options: UseHypeonChatOptions = {}): UseHypeonChatReturn {
  const { apiUrl, token, autoLoadSessions = false } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<{ stage: string; progress: number; message: string } | null>(null);
  const [stages, setStages] = useState<Map<string, StageInfo>>(new Map());
  // Force re-render counter - increments on every progress update to ensure UI updates
  const [progressUpdateCounter, setProgressUpdateCounter] = useState(0);
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null);
  
  // Convert stages Map to array for React re-rendering
  // This ensures React detects changes when stages update
  // Use useMemo to recalculate when stages Map changes
  // Create a dependency key from Map contents to force recalculation
  const stagesDependencyKey = useMemo(() => {
    return Array.from(stages.entries())
      .map(([name, info]) => `${name}:${info.status}:${info.message}:${info.progress}`)
      .join('|');
  }, [stages]);
  
  const stagesArray = useMemo(() => {
    const arr = Array.from(stages.values()).sort((a, b) => {
      if (a.stageIndex !== undefined && b.stageIndex !== undefined) {
        return a.stageIndex - b.stageIndex;
      }
      return a.name.localeCompare(b.name);
    });
    // Force new array reference by spreading
    return [...arr];
  }, [stagesDependencyKey]);

  // Stage labels mapping
  const stageLabels: Record<string, string> = {
    routing: 'Initializing',
    enhance: 'Optimizing',
    research: 'Searching',
    analysis: 'Analyzing',
    compose: 'Composing',
    done: 'Complete',
    error: 'Error',
    unknown: 'Processing',
  };

  const chatService = new ChatService(apiUrl || API_BASE_URL, token);

  // Load sessions on mount if autoLoadSessions is true
  useEffect(() => {
    if (autoLoadSessions && token) {
      loadSessions().catch(console.error);
    }
  }, [autoLoadSessions, token]);

  // Start with a new chat on mount (user can select old sessions from sidebar)
  useEffect(() => {
    // Only clear session if token changes from non-null to null (logout)
    // Don't clear if token is set (login) - let the component handle loading saved session
    if (!token) {
      // Clear any saved session on logout
      localStorage.removeItem('current_session_id');
      // Reset to new chat state
      setSessionId(null);
      setMessages([]);
      setCurrentSession(null);
    }
    // If token is set, don't clear - let the component load the saved session
  }, [token]);

  const sendMessage = useCallback(
    async (message: string): Promise<ChatResponse | null> => {
      if (!message.trim() || loading) return null;

      setLoading(true);
      setError(null);

      // Add user message optimistically
      const userMessage: Message = {
        message_id: `temp-${Date.now()}`,
        session_id: sessionId || 'temp',
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const request: ChatRequest = {
          message,
          session_id: sessionId,
          plan: 'basic',
          request_id: `req-${Date.now()}-${Math.random()}`,
        };

        const response = await chatService.chat(request);

        // Update session ID if new conversation
        if (!sessionId) {
          setSessionId(response.session_id);
          localStorage.setItem('current_session_id', response.session_id);
        }

        // Add assistant message
        const assistantMessage: Message = {
          message_id: `msg-${Date.now()}`,
          session_id: response.session_id,
          role: 'assistant',
          content: response.answer,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Refresh sessions to update last_active_at
        if (token) {
          refreshSessions().catch(console.error);
        }

        return response;
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        // Remove optimistic user message on error
        setMessages((prev) => prev.filter((m) => m.message_id !== userMessage.message_id));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading, token, chatService]
  );

  const sendMessageStream = useCallback(
    async (
      message: string, 
      onChunk: (chunk: string) => void,
      onProgress?: (stage: string, progress: number, message: string) => void
    ): Promise<void> => {
      if (!message.trim() || loading) return;

      setLoading(true);
      setError(null);
      setProgress({ stage: 'routing', progress: 0, message: 'Initializing...' });
      setStages(new Map()); // Reset stages for new request
      setProgressUpdateCounter(0); // Reset counter for new request
      setResearchPlan(null); // Reset research plan for new request

      // Add user message optimistically
      const userMessage: Message = {
        message_id: `temp-${Date.now()}`,
        session_id: sessionId || 'temp',
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Create streaming assistant message that updates in real-time
      const streamingMessageId = `streaming-${Date.now()}`;
      const streamingMessage: Message = {
        message_id: streamingMessageId,
        session_id: sessionId || 'temp',
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        isStreaming: true, // Mark as streaming
      };
      setMessages((prev) => [...prev, streamingMessage]);

      let assistantContent = '';
      let tokenCount = 0;
      const streamingTables: TableData[] = [];
      const streamingInsights: Insight[] = [];
      const streamingArtifacts: Artifact[] = [];

      // Helper to estimate token count (rough approximation: ~4 chars per token)
      const estimateTokens = (text: string): number => {
        return Math.ceil(text.length / 4);
      };

      try {
        const request: ChatRequest = {
          message,
          session_id: sessionId,
          plan: 'basic',
          request_id: `req-${Date.now()}-${Math.random()}`,
        };

        await chatService.chatStream(
          request,
          (chunk: string, done: boolean) => {
            // Accumulate tokens silently in the background (no real-time display)
            // We'll show the full response with animation when complete
            if (chunk) {
              assistantContent += chunk;
              tokenCount += estimateTokens(chunk);
              // Don't update UI during streaming - wait for complete response
              // Just call onChunk for any external listeners
              onChunk(chunk);
            }
          },
          (newSessionId: string, tables, explanation, insights, artifacts, metadata) => {
            // Update session ID if new conversation
            if (!sessionId) {
              setSessionId(newSessionId);
              localStorage.setItem('current_session_id', newSessionId);
            }

            // Merge progressive tables with final tables (final takes precedence)
            const allTables = [...streamingTables];
            if (tables) {
              tables.forEach(finalTable => {
                const existingIndex = allTables.findIndex(t => t.id === finalTable.id);
                if (existingIndex >= 0) {
                  allTables[existingIndex] = finalTable; // Update existing
                } else {
                  allTables.push(finalTable); // Add new
                }
              });
            }

            // Replace streaming message with final message including structured data
            // Mark as new so it gets animation
            const assistantMessage: Message & { isNew?: boolean; metadata?: any } = {
              message_id: `msg-${Date.now()}`,
              session_id: newSessionId,
              role: 'assistant',
              content: assistantContent,
              created_at: new Date().toISOString(),
              token_count: tokenCount,
              // Include structured data from streaming response
              tables: allTables.length > 0 ? allTables : (tables || []),
              insights: [...streamingInsights, ...(insights || [])],
              artifacts: [...streamingArtifacts, ...(artifacts || [])],
              explanation: explanation || null,
              isStreaming: false,
              isNew: true, // Mark as new to trigger animation
              // Store metadata for display (including sectionTitles if provided)
              metadata: metadata || {},
            };

            setMessages((prev) =>
              prev.map((msg) =>
                msg.message_id === streamingMessageId ? assistantMessage : msg
              )
            );
            setProgress(null); // Clear progress when done
            
            // Mark all stages as completed
            setStages(prev => {
              const updated = new Map(prev);
              updated.forEach((stage, key) => {
                if (stage.status === 'active') {
                  updated.set(key, { ...stage, status: 'completed', progress: 1.0 });
                }
              });
              return updated;
            });

            // Refresh sessions
            if (token) {
              refreshSessions().catch(console.error);
            }
          },
          (stage: string, progressValue: number, statusMessage: string) => {
            // IMPORTANT: Always update with the latest message from backend
            // Don't override with generic messages - preserve detailed messages
            const message = statusMessage?.trim() || 'Processing...';
            
            // Use console.log instead of console.debug for visibility
            if (process.env.NODE_ENV === 'development') {
              console.log('🟢 Progress handler called:', {
                stage,
                progress: progressValue,
                message: message,
                isDetailedMessage: message !== 'Processing...' && !message.startsWith('Starting ') && !message.includes('complete')
              });
            }
            
            setProgress({ stage, progress: progressValue, message });
            
            // Force re-render by incrementing counter - ensures UI updates immediately
            setProgressUpdateCounter(prev => prev + 1);
            
            // Update stage progress in stages map
            setStages(prev => {
              const updated = new Map(prev);
              const existing = updated.get(stage);
              if (existing) {
                updated.set(stage, {
                  ...existing,
                  progress: progressValue,
                  message: message, // Always update with latest message
                });
              } else {
                // Create new stage entry if it doesn't exist
                updated.set(stage, {
                  name: stage,
                  label: stageLabels[stage] || stage,
                  status: 'active',
                  progress: progressValue,
                  message: message, // Store the detailed message
                });
              }
              return updated;
            });
            
            // Track search term statuses for research plan
            if (stage === 'research' && researchPlan) {
              // Check if this is a search completion message
              const searchMatch = message.match(/Searched: ['"](.+?)['"]/);
              if (searchMatch) {
                const actualSearch = searchMatch[1];
                
                setResearchPlan(prev => {
                  if (!prev) return prev;
                  
                  return {
                    ...prev,
                    searchTerms: prev.searchTerms.map(term => {
                      const termLower = term.toLowerCase();
                      const searchLower = actualSearch.toLowerCase();
                      
                      // Fuzzy match: check if terms are similar
                      if (termLower.includes(searchLower) || searchLower.includes(termLower)) {
                        return term; // Keep as string, status will be tracked separately if needed
                      }
                      return term;
                    })
                  };
                });
              }
              
              // Check if this is an active search message
              const searchingMatch = message.match(/Searching: ['"](.+?)['"]/);
              if (searchingMatch) {
                const activeSearch = searchingMatch[1];
                
                // Note: We track this for display purposes, but don't modify the searchTerms array
                // The UI component can use this information to highlight the active search
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔍 Active search detected:', activeSearch);
                }
              }
            }
            
            if (onProgress) {
              onProgress(stage, progressValue, message);
            }
          },
          // Progressive table callback
          (table: TableData) => {
            streamingTables.push(table);
            // Update streaming message with new table immediately
            setMessages((prev) =>
              prev.map((msg) =>
                msg.message_id === streamingMessageId
                  ? { 
                      ...msg, 
                      tables: [...streamingTables],
                      isStreaming: true
                    }
                  : msg
              )
            );
          },
          // Progressive insight callback
          (insight: Insight) => {
            streamingInsights.push(insight);
            // Update streaming message with new insight immediately
            setMessages((prev) =>
              prev.map((msg) =>
                msg.message_id === streamingMessageId
                  ? { 
                      ...msg, 
                      insights: [...streamingInsights],
                      isStreaming: true
                    }
                  : msg
              )
            );
          },
          // Progressive artifact callback
          (artifact: Artifact) => {
            streamingArtifacts.push(artifact);
            // Update streaming message with new artifact immediately
            setMessages((prev) =>
              prev.map((msg) =>
                msg.message_id === streamingMessageId
                  ? { 
                      ...msg, 
                      artifacts: [...streamingArtifacts],
                      isStreaming: true
                    }
                  : msg
              )
            );
          },
          // Stage start callback
          (stage: string, stageIndex: number, totalStages: number) => {
            setStages(prev => {
              const updated = new Map(prev);
              // Don't overwrite if stage already exists with a detailed message
              // The backend will send detailed progress messages immediately after stage_start
              const existing = updated.get(stage);
              if (!existing || existing.message === `Starting ${stageLabels[stage] || stage}...`) {
                updated.set(stage, {
                  name: stage,
                  label: stageLabels[stage] || stage,
                  status: 'active',
                  progress: 0,
                  message: `Starting ${stageLabels[stage] || stage}...`,
                  stageIndex,
                  totalStages,
                });
              } else {
                // Preserve existing message and just update status/indices
                updated.set(stage, {
                  ...existing,
                  status: 'active',
                  stageIndex,
                  totalStages,
                });
              }
              return updated;
            });
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`→ Stage ${stage} started (${stageIndex + 1}/${totalStages})`);
            }
          },
          // Stage complete callback with timing
          (stage: string, success: boolean, latencyMs?: number | null, error?: string) => {
            setStages(prev => {
              const updated = new Map(prev);
              const existing = updated.get(stage);
              
              // IMPORTANT: Preserve the existing detailed message if it exists
              // Only use generic completion message if no detailed message was stored
              const preserveMessage = existing?.message && 
                                     existing.message !== `Starting ${stageLabels[stage] || stage}...` &&
                                     !existing.message.includes('complete') &&
                                     success; // Only preserve if success
              
              const completionMessage = success
                ? `${stageLabels[stage] || stage} complete${latencyMs ? ` (${(latencyMs / 1000).toFixed(1)}s)` : ''}`
                : `Failed: ${error || 'Unknown error'}`;
              
              if (existing) {
                updated.set(stage, {
                  ...existing,
                  status: success ? 'completed' : 'failed',
                  progress: success ? 1.0 : 0,
                  latencyMs: latencyMs || undefined,
                  error: error || undefined,
                  // Preserve detailed message if it exists, otherwise use completion message
                  message: preserveMessage ? existing.message : completionMessage,
                });
              } else {
                // Create entry if it doesn't exist
                updated.set(stage, {
                  name: stage,
                  label: stageLabels[stage] || stage,
                  status: success ? 'completed' : 'failed',
                  progress: success ? 1.0 : 0,
                  latencyMs: latencyMs || undefined,
                  error: error || undefined,
                  message: completionMessage,
                });
              }
              return updated;
            });
            
            if (process.env.NODE_ENV === 'development') {
              const latencyText = latencyMs ? ` (${(latencyMs / 1000).toFixed(1)}s)` : '';
              console.log(`✓ Stage ${stage} complete${latencyText}`, { success, latencyMs, error });
            }
          },
          // Research plan callback
          (plan: ResearchPlan) => {
            // Initialize search terms with pending status
            setResearchPlan(plan);
            
            if (process.env.NODE_ENV === 'development') {
              console.log('📋 Research plan received:', {
                searchTermsCount: plan.searchTerms.length,
                objectives: plan.objectives.length,
                dataPoints: plan.dataPoints.length
              });
            }
          },
          // Error callback
          (error: string, code?: string) => {
            setError(error);
            setProgress(null);
            // Keep partial content if available
            if (assistantContent) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.message_id === streamingMessageId
                    ? { ...msg, isStreaming: false, content: assistantContent }
                    : msg
                )
              );
            } else {
              // Remove streaming message on error if no content
              setMessages((prev) => 
                prev.filter((m) => m.message_id !== streamingMessageId)
              );
            }
          }
        );
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        setProgress(null);
        // Remove optimistic user message and streaming message on error
        setMessages((prev) => 
          prev.filter((m) => 
            m.message_id !== userMessage.message_id && 
            m.message_id !== streamingMessageId
          )
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading, token, chatService]
  );

  const loadSessions = useCallback(async () => {
    // Skip auth check if disabled in development
    const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    if (!isAuthDisabled && !token) {
      setSessions([]);
      return;
    }

    try {
      const loadedSessions = await chatService.getSessions();
      setSessions(loadedSessions);
      setError(null);
    } catch (err: any) {
      // Handle connection errors gracefully - don't show error if backend is unavailable
      const isConnectionError = err.message?.includes('Backend unavailable') || 
                               err.message?.includes('Failed to connect') ||
                               err.message?.includes('Failed to fetch');
      
      if (isConnectionError) {
        // Silently fail - backend is not running, which is expected in some dev scenarios
        setSessions([]);
        setError(null);
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Backend not available - sessions will not be loaded. Start the backend server to enable session management.');
        }
      } else {
        setError(err.message || 'Failed to load sessions');
        setSessions([]);
      }
    }
  }, [token, chatService]);

  const loadSession = useCallback(
    async (sid: string) => {
      // Skip auth check if disabled in development
      const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                             process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
      
      // If no token and auth not disabled, silently fail - session management requires auth
      if (!isAuthDisabled && !token) {
        console.warn('Cannot load session: Authentication required. Chat will work without session history.');
        setSessionId(sid);
        setMessages([]);
        setCurrentSession(null);
        localStorage.setItem('current_session_id', sid);
        return;
      }

      try {
        const [session, sessionMessages] = await Promise.all([
          chatService.getSession(sid),
          chatService.getSessionMessages(sid),
        ]);

        setSessionId(sid);
        setMessages(sessionMessages);
        setCurrentSession(session);
        localStorage.setItem('current_session_id', sid);
        setError(null);
      } catch (err: any) {
        // Handle connection errors gracefully
        const isConnectionError = err.message?.includes('Backend unavailable') || 
                                 err.message?.includes('Failed to connect') ||
                                 err.message?.includes('Failed to fetch');
        const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                               process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
        
        // Don't show error if it's just missing auth, permission denied, or backend unavailable - user can still chat
        if (err.message?.includes('Authentication required') || 
            (err.message?.includes('permission') && isAuthDisabled) ||
            (err.message?.includes('Session not found') && isAuthDisabled)) {
          console.warn('Session history unavailable. Chat will work without session history.');
          setSessionId(sid);
          setMessages([]);
          setCurrentSession(null);
          setError(null);
        } else if (isConnectionError) {
          // Backend not available - silently fail
          setSessionId(sid);
          setMessages([]);
          setCurrentSession(null);
          setError(null);
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Backend not available - session history unavailable. Start the backend server to load session history.');
          }
        } else {
          setError(err.message || 'Failed to load session');
          throw err;
        }
      }
    },
    [token, chatService]
  );

  const newChat = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setCurrentSession(null);
    localStorage.setItem('current_session_id', 'new');
  }, []);

  const setSession = useCallback((sid: string | null) => {
    setSessionId(sid);
    if (sid) {
      localStorage.setItem('current_session_id', sid);
    } else {
      localStorage.setItem('current_session_id', 'new');
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    await loadSessions();
  }, [loadSessions]);

  return {
    messages,
    sessionId,
    sessions,
    loading,
    error,
    currentSession,
    progress,
    stages,
    stagesArray, // Array version for better React re-rendering
    progressUpdateCounter, // Force re-render counter
    researchPlan, // Research plan with search terms
    sendMessage,
    sendMessageStream,
    loadSessions,
    loadSession,
    newChat,
    setSession,
    refreshSessions,
  };
}

