/**
 * This example demonstrates how to use the MCP adapter with UVX and NPX transports.
 *
 * It shows:
 * 1. How to create a client with UVX transport configuration
 * 2. How to create a client with NPX transport configuration
 * 3. How to use the connectToServerViaUVX and connectToServerViaNPX methods
 * 4. How to use configurations from a JSON file
 *
 * To run this example:
 * node --loader ts-node/esm examples/uvx_npx_example.ts
 */

import { MultiServerMCPClient } from '../src/client.js';

// Example 1: Using UVX and NPX with direct configuration
async function directConfigExample() {
  console.log('=== Example 1: Using Direct Configuration ===');

  try {
    // Create a client with a custom configuration
    const client = new MultiServerMCPClient({
      'uvx-server': {
        transport: 'uvx',
        packageName: 'my-uvx-package',
        serverScript: 'server.js',
        args: ['--port', '3000'],
      },
      'npx-server': {
        transport: 'npx',
        packageName: 'mcp-server-example',
        args: ['--port', '3001'],
      },
    });

    // Initialize all connections
    console.log('Initializing connections to all servers...');

    try {
      await client.initializeConnections();
      console.log('Connected to all servers');
    } catch (error) {
      console.error(
        'Error connecting to some servers:',
        error instanceof Error ? error.message : String(error)
      );
      console.log('Continuing with available servers...');
    }

    // Get all tools from all servers
    const serverTools = client.getTools();

    // Display available tools
    for (const [serverName, tools] of serverTools.entries()) {
      console.log(`\nServer: ${serverName}`);
      for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
    }

    // Close all connections
    await client.close();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

// Example 2: Using connectToServerViaUVX and connectToServerViaNPX methods
async function connectMethodsExample() {
  console.log('\n=== Example 2: Using Connect Methods ===');

  try {
    // Create a client
    const client = new MultiServerMCPClient();

    // Connect to a UVX server
    console.log('Connecting to UVX server...');
    try {
      await client.connectToServerViaUVX(
        'uvx-math',
        'mcp-math-server',
        'server.js',
        ['--verbose']
      );
      console.log('Connected to UVX server');
    } catch (error) {
      console.error(
        'Error connecting to UVX server:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Connect to an NPX server
    console.log('Connecting to NPX server...');
    try {
      await client.connectToServerViaNPX(
        'npx-weather',
        'mcp-weather-server',
        undefined,
        ['--port', '3002']
      );
      console.log('Connected to NPX server');
    } catch (error) {
      console.error(
        'Error connecting to NPX server:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Get all tools from all servers
    const serverTools = client.getTools();

    // Display available tools
    for (const [serverName, tools] of serverTools.entries()) {
      console.log(`\nServer: ${serverName}`);
      for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
    }

    // Close all connections
    await client.close();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

// Example 3: Using JSON Configuration
async function jsonConfigExample() {
  console.log('\n=== Example 3: Using JSON Configuration ===');

  try {
    // Create a client with custom configuration
    const client = new MultiServerMCPClient({
      'uvx-server': {
        transport: 'uvx',
        packageName: 'mcp-server',
        serverScript: 'index.js',
        env: {
          DEBUG: 'true',
        },
      },
      'npx-server': {
        transport: 'npx',
        packageName: 'another-mcp-server',
        serverScript: 'start',
        env: {
          PORT: '3003',
        },
      },
    });

    // Initialize all connections
    console.log('Initializing connections to all servers...');

    try {
      await client.initializeConnections();
      console.log('Connected to all servers');
    } catch (error) {
      console.error(
        'Error connecting to some servers:',
        error instanceof Error ? error.message : String(error)
      );
      console.log('Continuing with available servers...');
    }

    // Get all tools from all servers
    const serverTools = client.getTools();

    // Display available tools
    for (const [serverName, tools] of serverTools.entries()) {
      console.log(`\nServer: ${serverName}`);
      for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
    }

    // Close all connections
    await client.close();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run all examples
async function main() {
  try {
    await directConfigExample();
    await connectMethodsExample();
    await jsonConfigExample();
  } catch (error) {
    console.error('Error in main:', error instanceof Error ? error.message : String(error));
  }
}

main(); 