import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface AffectedNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'variable' | string;
  file_path: string;
  start_line: number;
  end_line: number;
  code: string;
  relationship: string;
} 

export interface ChangedNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'variable' | string;
  file_path: string;
  start_line: number;
  end_line: number;
  old_code: string;
  new_code: string;
}

export interface ImpactAnalysisInput {
  changed_node: ChangedNode;
  affected_nodes: AffectedNode[];
}

export interface ImpactAnalysisResult {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  impact_breakdown: {
    node_name: string;
    node_type: string;
    file_path: string;
    relationship: string;
    impact: string;
    may_break: boolean;
  }[];
  potential_bugs: string[];
}

function buildPrompt(input: ImpactAnalysisInput): string {
  const { changed_node, affected_nodes } = input;

  const affectedNodesText = affected_nodes
    .map((node, index) => {
      return `
    ### Affected Node ${index + 1}
    - **Name:** ${node.name}
    - **Type:** ${node.type}
    - **File:** ${node.file_path} (lines ${node.start_line}–${node.end_line})
    - **Relationship to changed node:** ${node.relationship}
    - **Code:**
    \`\`\`
    ${node.code}
    \`\`\`
    `;
        })
        .join('\n---\n');
      
      return `
    You are an expert software engineer and code impact analyst. Your job is to deeply analyze a code change and determine its ripple effects across a codebase using graph-based dependency data.
      
    ---
      
    ## CHANGED NODE (The code that was modified)
    - **Name:** ${changed_node.name}
    - **Type:** ${changed_node.type}
    - **File:** ${changed_node.file_path} (lines ${changed_node.start_line}–${changed_node.end_line})
      
    - **Code BEFORE change:**
    \`\`\`
    ${changed_node.old_code}
    \`\`\`
      
    - **Code AFTER change:**
    \`\`\`
    ${changed_node.new_code}
    \`\`\`
      
    ---
      
    ## AFFECTED NODES (Nodes directly or indirectly dependent on the changed node)
    Total affected: ${affected_nodes.length}
      
    ${affectedNodesText}
      
    ---
      
    ## YOUR TASK
      
    Carefully compare the BEFORE and AFTER code of **${changed_node.name}** and analyze the exact diff — what logic changed, what parameters changed, what return values changed. Then determine the ripple effect on all ${affected_nodes.length} affected nodes. Be extremely precise, technical, and actionable.
      
    Respond ONLY in the following JSON format with no additional text, no markdown backticks, no preamble:
      
    {
      "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
      "summary": "One concise paragraph summarizing exactly what changed and the overall impact on dependent nodes",
      "impact_breakdown": [
        {
          "node_name": "name of the affected node",
          "node_type": "function | class | variable",
          "file_path": "path to file",
          "relationship": "relationship to changed node",
          "impact": "Precise technical description of how this node is affected by the specific change made",
          "may_break": true or false
        }
      ],
      "potential_bugs": [
        "Specific potential bug or breaking change description 1",
        "Specific potential bug or breaking change description 2"
      ]
    }
      
    ## RULES FOR YOUR ANALYSIS:
    1. Always compare old_code vs new_code first — identify the exact diff before analyzing impact
    2. Be extremely specific — mention exact function names, parameter names, return types
    3. Do NOT make vague statements like "this might affect performance" — be precise
    4. risk_level must be: LOW (cosmetic/no logic change), MEDIUM (logic change with limited scope), HIGH (core logic change affecting multiple nodes), CRITICAL (breaking change that will definitely cause failures)
    5. may_break must be true if the change in signature, return type, or logic WILL cause errors in the dependent node
    6. potential_bugs must describe exact failure scenarios with context
    7. Return ONLY the JSON object — no markdown, no backticks, no explanation before or after
    `;
}

export async function analyzeImpact(input: ImpactAnalysisInput): Promise<ImpactAnalysisResult> {
  try {
    const prompt = buildPrompt(input);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert software engineer and code impact analyst. You always respond with pure valid JSON only — no markdown, no backticks, no explanation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const response = completion.choices[0].message.content!;

    const cleaned = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed: ImpactAnalysisResult = JSON.parse(cleaned);
    return parsed;

  } catch (error: any) {
    throw new Error(`Groq analysis failed: ${error.message}`);
  }
}

