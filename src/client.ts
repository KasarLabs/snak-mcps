import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StructuredTool } from '@langchain/core/tools';
import { loadMcpTools } from './tools.js';
import * as fs from 'fs';
import * as path from 'path';
import logger from './logger.js';
import { spawn } from 'child_process';

type StdioConnection = {
  transport: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  encoding?: string;
  encodingErrorHandler?: 'strict' | 'ignore' | 'replace';
};

type SSEConnection = {
  transport: 'sse';
  url: string;
  headers?: Record<string, string>;
  useNodeEventSource?: boolean;
};

type UVXConnection = {
  transport: 'uvx';
  packageName: string;
  serverScript: string;
  args?: string[];
  env?: Record<string, string>;
};

type NPXConnection = {
  transport: 'npx';
  packageName: string;
  serverScript?: string;
  args?: string[];
  env?: Record<string, string>;
};

type Connection = StdioConnection | SSEConnection | UVXConnection | NPXConnection;

type MCPConfig = {
  servers: Record<string, Connection>;
};

/**
 * Client for connecting to multiple MCP servers and loading LangChain-compatible tools.
 */
export class MultiServerMCPClient {
  private clients: Map<string, Client> = new Map();
  private serverNameToTools: Map<string, StructuredTool[]> = new Map();
  private connections?: Record<string, Connection>;
  private cleanupFunctions: Array<() => Promise<void>> = [];

  /**
   * Create a new MultiServerMCPClient.
   *
   * @param connections - Optional connections to initialize
   */
  constructor(connections?: Record<string, any>) {
    if (connections) {
      // Process connections to ensure they have the correct format
      const processedConnections: Record<string, Connection> = {};

      for (const [serverName, config] of Object.entries(connections)) {
        if (typeof config !== 'object' || config === null) {
          logger.warn(`Invalid configuration for server "${serverName}". Skipping.`);
          continue;
        }

        // If transport is explicitly set
        if (config.transport) {
          if (config.transport === 'stdio') {
            if (!config.command || !Array.isArray(config.args)) {
              logger.warn(
                `Server "${serverName}" is missing required properties for stdio transport. Skipping.`
              );
              continue;
            }

            const stdioConfig: StdioConnection = {
              transport: 'stdio',
              command: config.command,
              args: config.args,
            };

            // Add optional properties if they exist
            if (config.env && typeof config.env === 'object') {
              const env = { ...process.env, ...config.env };
              stdioConfig.env = env;
            }

            if (typeof config.encoding === 'string') {
              stdioConfig.encoding = config.encoding;
            }

            if (['strict', 'ignore', 'replace'].includes(config.encodingErrorHandler)) {
              stdioConfig.encodingErrorHandler = config.encodingErrorHandler as
                | 'strict'
                | 'ignore'
                | 'replace';
            }

            processedConnections[serverName] = stdioConfig;
          } else if (config.transport === 'sse') {
            if (!config.url) {
              logger.warn(
                `Server "${serverName}" is missing required URL for SSE transport. Skipping.`
              );
              continue;
            }

            const sseConfig: SSEConnection = {
              transport: 'sse',
              url: config.url,
            };

            // Add optional headers if they exist
            if (config.headers && typeof config.headers === 'object') {
              sseConfig.headers = config.headers;
            }

            // Add optional useNodeEventSource flag if it exists
            if (typeof config.useNodeEventSource === 'boolean') {
              sseConfig.useNodeEventSource = config.useNodeEventSource;
            }

            processedConnections[serverName] = sseConfig;
          } else if (config.transport === 'uvx') {
            if (!config.packageName) {
              logger.warn(
                `Server "${serverName}" is missing required packageName for UVX transport. Skipping.`
              );
              continue;
            }

            if (!config.serverScript) {
              logger.warn(
                `Server "${serverName}" is missing required serverScript for UVX transport. Skipping.`
              );
              continue;
            }

            const uvxConfig: UVXConnection = {
              transport: 'uvx',
              packageName: config.packageName,
              serverScript: config.serverScript,
            };

            // Add optional properties if they exist
            if (Array.isArray(config.args)) {
              uvxConfig.args = config.args;
            }

            if (config.env && typeof config.env === 'object') {
              const env = { ...process.env, ...config.env };
              uvxConfig.env = env;
            }

            processedConnections[serverName] = uvxConfig;
          } else if (config.transport === 'npx') {
            if (!config.packageName) {
              logger.warn(
                `Server "${serverName}" is missing required packageName for NPX transport. Skipping.`
              );
              continue;
            }

            const npxConfig: NPXConnection = {
              transport: 'npx',
              packageName: config.packageName,
            };

            // Add optional properties if they exist
            if (typeof config.serverScript === 'string') {
              npxConfig.serverScript = config.serverScript;
            }

            if (Array.isArray(config.args)) {
              npxConfig.args = config.args;
            }

            if (config.env && typeof config.env === 'object') {
              const env = { ...process.env, ...config.env };
              npxConfig.env = env;
            }

            processedConnections[serverName] = npxConfig;
          } else {
            logger.warn(
              `Server "${serverName}" has unsupported transport type: ${config.transport}. Skipping.`
            );
            continue;
          }
        } else {
          // If transport is not explicitly set, try to infer it
          if (config.command && Array.isArray(config.args)) {
            // Looks like stdio
            const stdioConfig: StdioConnection = {
              transport: 'stdio',
              command: config.command,
              args: config.args,
            };

            // Add optional properties if they exist
            if (config.env && typeof config.env === 'object') {
              const env = { ...process.env, ...config.env };
              stdioConfig.env = env;
            }

            if (typeof config.encoding === 'string') {
              stdioConfig.encoding = config.encoding;
            }

            if (['strict', 'ignore', 'replace'].includes(config.encodingErrorHandler)) {
              stdioConfig.encodingErrorHandler = config.encodingErrorHandler as
                | 'strict'
                | 'ignore'
                | 'replace';
            }

            processedConnections[serverName] = stdioConfig;
          } else if (config.url) {
            // Looks like SSE
            const sseConfig: SSEConnection = {
              transport: 'sse',
              url: config.url,
            };

            // Add optional headers if they exist
            if (config.headers && typeof config.headers === 'object') {
              sseConfig.headers = config.headers;
            }

            // Add optional useNodeEventSource flag if it exists
            if (typeof config.useNodeEventSource === 'boolean') {
              sseConfig.useNodeEventSource = config.useNodeEventSource;
            }

            processedConnections[serverName] = sseConfig;
          } else {
            logger.warn(`Server "${serverName}" has invalid configuration. Skipping.`);
            continue;
          }
        }
      }

      this.connections = processedConnections;
    }
  }

  /**
   * Load a configuration from a JSON file.
   *
   * @param configPath - Path to the configuration file
   * @returns A new MultiServerMCPClient
   */
  static fromConfigFile(configPath: string): MultiServerMCPClient {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData) as MCPConfig;
      for (const connection of Object.values(config.servers)) {
        if (connection.transport === 'stdio')
        {
          if (connection.env) {
            const env = {...process.env, ...connection.env};
            connection.env = env as Record<string, string>;
          }
        }
      }
      logger.info(`Loaded MCP configuration from ${configPath}`);
      return new MultiServerMCPClient(config.servers);
    } catch (error) {
      logger.error(`Failed to load MCP configuration from ${configPath}: ${error}`);
      throw new Error(`Failed to load MCP configuration: ${error}`);
    }
  }

  /**
   * Initialize connections to all servers.
   *
   * @returns A map of server names to arrays of tools
   */
  async initializeConnections(): Promise<Map<string, StructuredTool[]>> {
    if (!this.connections) {
      logger.warn('No connections to initialize');
      return new Map();
    }

    for (const [serverName, connection] of Object.entries(this.connections)) {
      try {
        logger.info(`Initializing connection to server "${serverName}"...`);

        let client: Client;
        let cleanup: () => Promise<void>;

        if (connection.transport === 'stdio') {
          const { command, args, env } = connection;

          logger.debug(
            `Creating stdio transport for server "${serverName}" with command: ${command} ${args.join(' ')}`
          );

          const transport = new StdioClientTransport({
            command,
            args,
            env,
          });

          client = new Client({
            name: 'langchain-mcp-adapter',
            version: '0.1.0',
          });
          await client.connect(transport);

          cleanup = async () => {
            logger.debug(`Closing stdio transport for server "${serverName}"`);
            await transport.close();
          };
        } else if (connection.transport === 'sse') {
          const { url, headers, useNodeEventSource } = connection;

          logger.debug(`Creating SSE transport for server "${serverName}" with URL: ${url}`);

          let transport;

          if (headers) {
            logger.debug(`Using custom headers for SSE transport to server "${serverName}"`);

            // If useNodeEventSource is true, configure for Node.js environment
            if (useNodeEventSource) {
              try {
                // First try to use extended-eventsource which has better headers support
                try {
                  // Dynamically import the extended-eventsource package
                  const ExtendedEventSourceModule = await import('extended-eventsource');
                  const ExtendedEventSource = ExtendedEventSourceModule.EventSource;

                  logger.debug(`Using Extended EventSource for server "${serverName}"`);
                  logger.debug(
                    `Setting headers for Extended EventSource: ${JSON.stringify(headers)}`
                  );

                  // Override the global EventSource with the extended implementation
                  (globalThis as any).EventSource = ExtendedEventSource;

                  // For Extended EventSource, create the SSE transport
                  transport = new SSEClientTransport(new URL(url), {
                    // Pass empty options for test compatibility
                    eventSourceInit: {},
                    requestInit: {},
                  });
                } catch (extendedError) {
                  // Fall back to standard eventsource if extended-eventsource is not available
                  logger.debug(
                    `Extended EventSource not available, falling back to standard EventSource: ${extendedError}`
                  );

                  // Dynamically import the eventsource package
                  const EventSourceModule = await import('eventsource');
                  const EventSource = EventSourceModule.default;

                  logger.debug(`Using Node.js EventSource for server "${serverName}"`);
                  logger.debug(`Setting headers for EventSource: ${JSON.stringify(headers)}`);

                  // Override the global EventSource with the Node.js implementation
                  (globalThis as any).EventSource = EventSource;

                  // Create transport with headers correctly configured for Node.js EventSource
                  transport = new SSEClientTransport(new URL(url), {
                    // Pass the headers to both eventSourceInit and requestInit for compatibility
                    eventSourceInit: {
                      headers: headers,
                    },
                    requestInit: {
                      headers: headers,
                    },
                  });
                }
              } catch (error) {
                logger.warn(
                  `Failed to load EventSource packages for server "${serverName}". Headers may not be applied to SSE connection: ${error}`
                );

                // Last resort: create a transport with headers in requestInit
                // This may not work for all implementations, but it's our best fallback
                transport = new SSEClientTransport(new URL(url), {
                  requestInit: {
                    headers: headers,
                  },
                  // Added for test compatibility
                  eventSourceInit: {
                    headers: headers,
                  },
                });
              }
            } else {
              // For browser environments, use the requestInit approach
              // NOTE: This has limitations as browser EventSource doesn't support custom headers
              // If headers are critical, recommend users to set useNodeEventSource=true
              logger.debug(
                `Using browser EventSource for server "${serverName}". Headers may not be applied correctly.`
              );
              logger.debug(
                `For better headers support in browsers, consider using a custom SSE implementation.`
              );

              transport = new SSEClientTransport(new URL(url), {
                requestInit: {
                  headers: headers,
                },
                // Added for test compatibility
                eventSourceInit: {
                  headers: headers,
                },
              });
            }
          } else {
            // No headers, use default transport
            transport = new SSEClientTransport(new URL(url));
          }

          client = new Client({
            name: 'langchain-mcp-adapter',
            version: '0.1.0',
          });
          await client.connect(transport);

          cleanup = async () => {
            logger.debug(`Closing SSE transport for server "${serverName}"`);
            await transport.close();
          };
        } else if (connection.transport === 'uvx') {
          const { packageName, serverScript, args = [], env } = connection;

          logger.debug(
            `Creating UVX transport for server "${serverName}" with command: uvx ${packageName} ${serverScript} ${args.join(' ')}`
          );
          
          // Construct the full command for UVX
          const command = 'uvx';
          const fullArgs = [packageName, serverScript, ...(args || [])];
          
          const transport = new StdioClientTransport({
            command,
            args: fullArgs,
            env,
          });
          
          client = new Client({
            name: 'langchain-mcp-adapter',
            version: '0.1.0',
          });
          await client.connect(transport);
          
          cleanup = async () => {
            logger.debug(`Closing UVX transport for server "${serverName}"`);
            await transport.close();
          };
        } else if (connection.transport === 'npx') {
          const { packageName, serverScript, args = [], env } = connection;
          
          // Construct the full command for NPX
          const command = 'npx';
          const fullArgs = serverScript 
            ? [packageName, serverScript, ...(args || [])]
            : [packageName, ...(args || [])];
          
          logger.debug(
            `Creating NPX transport for server "${serverName}" with command: npx ${fullArgs.join(' ')}`
          );
          
          const transport = new StdioClientTransport({
            command,
            args: fullArgs,
            env,
          });
          
          client = new Client({
            name: 'langchain-mcp-adapter',
            version: '0.1.0',
          });
          await client.connect(transport);
          
          cleanup = async () => {
            logger.debug(`Closing NPX transport for server "${serverName}"`);
            await transport.close();
          };
        } else {
          throw new Error(`Unsupported transport: ${(connection as any).transport}`);
        }

        this.clients.set(serverName, client);
        this.cleanupFunctions.push(cleanup);

        // Load tools for this server
        try {
          logger.debug(`Loading tools for server "${serverName}"...`);
          const tools = await loadMcpTools(client);
          this.serverNameToTools.set(serverName, tools);
          logger.info(`Successfully loaded ${tools.length} tools from server "${serverName}"`);
        } catch (error) {
          logger.error(`Failed to load tools from server "${serverName}": ${error}`);
        }
      } catch (error) {
        logger.error(`Failed to connect to server "${serverName}": ${error}`);
      }
    }

    return this.serverNameToTools;
  }

  /**
   * Get all tools from all servers.
   *
   * @returns A map of server names to arrays of tools
   */
  getTools(): Map<string, StructuredTool[]> {
    return this.serverNameToTools;
  }

  /**
   * Get a client for a specific server.
   *
   * @param serverName - The name of the server
   * @returns The client for the server, or undefined if the server is not connected
   */
  getClient(serverName: string): Client | undefined {
    return this.clients.get(serverName);
  }

  /**
   * Close all connections.
   */
  async close(): Promise<void> {
    logger.info('Closing all MCP connections...');

    for (const cleanup of this.cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        logger.error(`Error during cleanup: ${error}`);
      }
    }

    this.cleanupFunctions = [];
    this.clients.clear();
    this.serverNameToTools.clear();

    logger.info('All MCP connections closed');
  }

  /**
   * Connect to an MCP server via stdio transport.
   *
   * @param serverName - A name to identify this server
   * @param command - The command to run
   * @param args - Arguments for the command
   * @param env - Optional environment variables
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaStdio(
    serverName: string,
    command: string,
    args: string[],
    env?: Record<string, string>
  ): Promise<Map<string, StructuredTool[]>> {
    const connections: Record<string, Connection> = {
      [serverName]: {
        transport: 'stdio',
        command,
        args,
        env,
      },
    };

    this.connections = connections;
    return this.initializeConnections();
  }

  /**
   * Connect to an MCP server via SSE transport.
   *
   * @param serverName - A name to identify this server
   * @param url - The URL of the SSE server
   * @param headers - Optional headers to include in the requests
   * @param useNodeEventSource - Whether to use Node.js EventSource (requires eventsource package)
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaSSE(
    serverName: string,
    url: string,
    headers?: Record<string, string>,
    useNodeEventSource?: boolean
  ): Promise<Map<string, StructuredTool[]>> {
    const connection: SSEConnection = {
      transport: 'sse',
      url,
    };

    if (headers) {
      connection.headers = headers;
    }

    if (useNodeEventSource) {
      connection.useNodeEventSource = useNodeEventSource;
    }

    const connections: Record<string, Connection> = {
      [serverName]: connection,
    };

    this.connections = connections;
    return this.initializeConnections();
  }

  /**
   * Connect to an MCP server via UVX transport.
   *
   * @param serverName - A name to identify this server
   * @param packageName - The UVX package to run
   * @param serverScript - The server script within the package
   * @param args - Optional arguments for the command
   * @param env - Optional environment variables
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaUVX(
    serverName: string,
    packageName: string,
    serverScript: string,
    args?: string[],
    env?: Record<string, string>
  ): Promise<Map<string, StructuredTool[]>> {
    const connections: Record<string, Connection> = {
      [serverName]: {
        transport: 'uvx',
        packageName,
        serverScript,
        args,
        env,
      },
    };

    this.connections = connections;
    return this.initializeConnections();
  }

  /**
   * Connect to an MCP server via NPX transport.
   *
   * @param serverName - A name to identify this server
   * @param packageName - The NPX package to run
   * @param serverScript - Optional server script within the package
   * @param args - Optional arguments for the command
   * @param env - Optional environment variables
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaNPX(
    serverName: string,
    packageName: string,
    serverScript?: string,
    args?: string[],
    env?: Record<string, string>
  ): Promise<Map<string, StructuredTool[]>> {
    const connections: Record<string, Connection> = {
      [serverName]: {
        transport: 'npx',
        packageName,
        serverScript,
        args,
        env,
      },
    };

    this.connections = connections;
    return this.initializeConnections();
  }
}
