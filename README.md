# LangChain.js MCP Adapters
This is a modified version of [Langchain MCP adapter](https://github.com/vrknetha/langchainjs-mcp-adapters)

This package provides adapters for using [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/specification) tools with LangChain.js. It enables seamless integration between LangChain.js and MCP servers, allowing you to use MCP tools in your LangChain applications.

[![npm version](https://img.shields.io/npm/v/langchainjs-mcp-adapters.svg)](https://www.npmjs.com/package/langchainjs-mcp-adapters)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Connect to MCP servers using stdio or SSE transports
- Connect to multiple MCP servers simultaneously
- Configure connections using a JSON configuration file
- **Support for custom headers in SSE connections** (great for authentication!)
- Integrate MCP tools with LangChain.js agents
- Comprehensive logging capabilities

## Installation

```bash
npm install langchainjs-mcp-adapters
```

For Node.js environments with SSE connections requiring headers, you need to install the optional dependency:

```bash
npm install eventsource
```

## Prerequisites

- Node.js >= 18
- For stdio transport: Python MCP servers require Python 3.8+
- For SSE transport: A running MCP server with SSE endpoint
- For SSE with headers in Node.js: The `eventsource` package

## Usage

### Connecting to an MCP Server

You can connect to an MCP server using either stdio or SSE transport:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

// Create a client
const client = new MultiServerMCPClient();

// Connect to a server using stdio
await client.connectToServerViaStdio(
  'math-server', // A name to identify this server
  'python', // Command to run
  ['./math_server.py'] // Arguments for the command
);

// Connect to a server using SSE
await client.connectToServerViaSSE(
  'weather-server', // A name to identify this server
  'http://localhost:8000/sse' // URL of the SSE server
);

// Connect to a server using SSE with custom headers
await client.connectToServerViaSSE(
  'auth-server', // A name to identify this server
  'http://localhost:8000/sse', // URL of the SSE server
  {
    Authorization: 'Bearer your-token-here',
    'X-Custom-Header': 'custom-value',
  },
  true // Use Node.js EventSource (requires eventsource package)
);

// Get all tools from all connected servers
const tools = client.getTools();

// Use the tools
const result = await tools[0].invoke({ param1: 'value1', param2: 'value2' });

// Close the client when done
await client.close();
```

### Initializing Multiple Connections

You can also initialize multiple connections at once:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

const client = new MultiServerMCPClient({
  'math-server': {
    command: 'python',
    args: ['./math_server.py'],
  },
  'weather-server': {
    transport: 'sse',
    url: 'http://localhost:8000/sse',
  },
  'auth-server': {
    transport: 'sse',
    url: 'http://localhost:8000/sse',
    headers: {
      Authorization: 'Bearer your-token-here',
      'X-Custom-Header': 'custom-value',
    },
    useNodeEventSource: true, // Use Node.js EventSource for headers support
  },
});

// Initialize all connections
await client.initializeConnections();

// Get all tools
const tools = client.getTools();

// Close all connections when done
await client.close();
```

### Using Configuration File

You can define your MCP server configurations in a JSON file (`mcp.json`) and load them:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';

// Create a client from the config file
const client = MultiServerMCPClient.fromConfigFile();
// Or specify a custom path: MultiServerMCPClient.fromConfigFile("./config/mcp.json");

// Initialize all connections
await client.initializeConnections();

// Get all tools
const tools = client.getTools();

// Close all connections when done
await client.close();
```

Example `mcp.json` file:

```json
{
  "servers": {
    "math": {
      "command": "python",
      "args": ["./examples/math_server.py"]
    },
    "weather": {
      "transport": "sse",
      "url": "http://localhost:8000/sse"
    },
    "auth-server": {
      "transport": "sse",
      "url": "http://localhost:8000/sse",
      "headers": {
        "Authorization": "Bearer your-token-here",
        "X-Custom-Header": "custom-value"
      },
      "useNodeEventSource": true
    },
    "uvx-server": {
      "transport": "uvx",
      "packageName": "my-uvx-package",
      "serverScript": "server.js",
      "args": ["--port", "3000"],
      "env": {
        "DEBUG": "true"
      }
    },
    "npx-server": {
      "transport": "npx",
      "packageName": "mcp-server-example",
      "args": ["--port", "3001"]
    }
  }
}
```

The client will attempt to connect to all servers defined in the configuration file. If a server is not available, it will log an error and continue with the available servers. If no servers are available, it will throw an error.

```typescript
// Error handling when initializing connections
try {
  const client = MultiServerMCPClient.fromConfigFile();
  await client.initializeConnections();
  // Use the client...
} catch (error) {
  console.error('Failed to connect to any servers:', error.message);
}
```

### Transport Types

The client supports multiple transport types:

#### 1. stdio

Run a command as a child process and communicate with it via standard input/output.

```json
{
  "transport": "stdio",
  "command": "python",
  "args": ["./examples/math_server.py"],
  "env": {
    "DEBUG": "true"
  }
}
```

#### 2. SSE (Server-Sent Events)

Connect to a server using Server-Sent Events.

```json
{
  "transport": "sse",
  "url": "http://localhost:8000/sse",
  "headers": {
    "Authorization": "Bearer token"
  },
  "useNodeEventSource": true
}
```

#### 3. UVX

Run a UVX package as an MCP server.

```json
{
  "transport": "uvx",
  "packageName": "my-uvx-package",
  "serverScript": "server.js",
  "args": ["--port", "3000"],
  "env": {
    "DEBUG": "true"
  }
}
```

#### 4. NPX

Run an NPM package as an MCP server.

```json
{
  "transport": "npx",
  "packageName": "mcp-server-example",
  "serverScript": "start",
  "args": ["--port", "3001"],
  "env": {
    "PORT": "3001"
  }
}
```

### Using with LangChain Agents

You can use MCP tools with LangChain agents:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Create a client and connect to servers
const client = new MultiServerMCPClient();
await client.connectToServerViaStdio('math-server', 'python', ['./math_server.py']);

// Get tools
const tools = client.getTools();

// Create an agent
const model = new ChatOpenAI({ temperature: 0 });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant that can use tools to solve problems.'],
  ['human', '{input}'],
]);

const agent = createOpenAIFunctionsAgent({
  llm: model,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

// Run the agent
const result = await agentExecutor.invoke({
  input: 'What is 5 + 3?',
});

console.log(result.output);

// Close the client when done
await client.close();
```

### Using with Google's Gemini Models

The package also supports integration with Google's Gemini models:

```typescript
import { MultiServerMCPClient } from 'langchainjs-mcp-adapters';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createGoogleGenerativeAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Create a client and connect to servers
const client = new MultiServerMCPClient();
await client.connectToServerViaStdio('math-server', 'python', ['./math_server.py']);

// Get tools
const tools = client.getTools();

// Create a Gemini agent
const model = new ChatGoogleGenerativeAI({
  modelName: 'gemini-pro',
  apiKey: process.env.GOOGLE_API_KEY,
});

// Create and run the agent
// ... similar to the OpenAI example
```

## Example MCP Servers

### Math Server (stdio transport)

Here's an example of a simple MCP server in Python using stdio transport:

```python
from mcp.server.fastmcp import FastMCP

# Create a server
mcp = FastMCP(name="Math")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers and return the result."""
    return a + b

@mcp.tool()
def multiply(a: int, b: int) -> int:
    """Multiply two integers and return the result."""
    return a * b

# Run the server with stdio transport
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Weather Server (SSE transport)

Here's an example of an MCP server using SSE transport:

```python
from mcp.server.fastmcp import FastMCP

# Create a server
mcp = FastMCP(name="Weather")

@mcp.tool()
def get_temperature(city: str) -> str:
    """Get the current temperature for a city."""
    # Mock implementation
    temperatures = {
        "new york": "72°F",
        "london": "65°F",
        "tokyo": "25 degrees Celsius",
    }

    city_lower = city.lower()
    if city_lower in temperatures:
        return f"The current temperature in {city} is {temperatures[city_lower]}."
    else:
        return "Temperature data not available for this city"

# Run the server with SSE transport
if __name__ == "__main__":
    mcp.run(transport="sse")
```

## Running the Examples

The package includes several example files that demonstrate how to use MCP adapters:

1. `math_example.ts` - Basic example using a math server with stdio transport
2. `sse_example.ts` - Example using a weather server with SSE transport
3. `multi_transport_example.ts` - Example connecting to multiple servers with different transport types
4. `json_config_example.ts` - Example using server configurations from an `mcp.json` file
5. `gemini_example.ts` - Example using Google's Gemini models
6. `logging_example.ts` - Example demonstrating logging capabilities
7. `sse_with_headers_example.ts` - Example showing how to use custom headers with SSE connections
8. `uvx_npx_example.ts` - Example demonstrating how to use UVX and NPX transport types