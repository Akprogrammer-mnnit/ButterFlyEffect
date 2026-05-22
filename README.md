# 🦋 ButterflyEffect

**An AI-Powered Code Dependency & Blast Radius Analyzer (VS Code Extension)**

Ever wondered what breaks when you change a single line of code? **ButterflyEffect** maps your entire codebase into a graph network and uses AI to predict the exact "blast radius" of your modifications—right inside your editor.

[Live Site/Dashboard](https://butter-fly-effect.vercel.app/) | [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ak-mnnit.butterfly-effect)

---

## The Problem it Solves
In large codebases, changing a core utility function can unintentionally break dozens of other files. Traditional search (`Ctrl + F`) isn't smart enough to understand code execution paths. 

**The Solution:** ButterflyEffect reads your code like a compiler, builds a relationship web of every function and import, and uses an LLM to warn you about architectural risks *before* you push your code.

## How to Use (The Workflow)
Using ButterflyEffect is designed to be completely frictionless for the developer:

1. **Sync your Repo:** Go to the [Web Dashboard](https://butter-fly-effect.vercel.app/) and upload/link your GitHub repository. The backend instantly builds the Neo4j dependency graph.
2. **Install the Extension:** Download the ButterflyEffect extension (name: butterfly-effect) in VS Code and open your project.
3. **Write Code:** Start editing your code normally. When you modify a function, a small `🔍 Analyze Impact` button will automatically appear just above it.
4. **Click Analyze:** Click the button. The extension asks the backend to trace every file that depends on this function.
5. **Read the Report:** Within seconds, an AI-generated report opens in your editor, explaining exactly which files might break and what edge cases you need to test based on your specific changes.

## Tech Stack
* **Language:** TypeScript, Node.js
* **AST Parsing:** Tree-sitter (C++ based parsing engine)
* **Graph Database:** Neo4j (Cypher)
* **Storage Database:** MongoDB
* **AI/LLM:** Grok API (Semantic Analysis)
* **Client:** VS Code Extension API

## How it Works (Under the Hood)
1. **Code Parsing:** Uses `Tree-sitter` to parse raw JS/TS files into Abstract Syntax Trees (ASTs) in milliseconds.
2. **Node Extraction:** Custom recursive algorithms extract functions, variables, and default exports while filtering out noise.
3. **Graph Construction:** Pushes the parsed data into **Neo4j** as Nodes (Files, Functions) and Edges (`IMPORTS`, `DEFINES`, `CALLS`) to create a real-time Call Graph.
4. **AI Impact Analysis:** When a user flags a function in VS Code, the backend queries Neo4j to find all dependent paths, feeding that context to an LLM to generate a human-readable "Blast Radius" report.
   
