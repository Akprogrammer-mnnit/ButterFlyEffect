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
  total_graph_dependencies: number;
}

export interface ImpactAnalysisResult {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  direct_issues: string[];
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
  const { changed_node, affected_nodes, total_graph_dependencies } = input;

  const affectedNodesText = affected_nodes
    .map((node, index) => {
      return `
    ### Affected Node ${index + 1}
    - **Name:** ${node.name}
    - **Type:** ${node.type}
    - **File:** ${node.file_path}
    - **Relationship:** ${node.relationship}
    - **Code:**
    \`\`\`
    ${node.code}
    \`\`\`
    `;
    })
    .join('\n---\n');

  return `
    You are an expert software engineer and code impact analyst. 
      
    ---
    ## CHANGED NODE
    - **Name:** ${changed_node.name}
    - **File:** ${changed_node.file_path}
      
    - **Code BEFORE change:**
    \`\`\`
    ${changed_node.old_code}
    \`\`\`
      
    - **Code AFTER change:**
    \`\`\`
    ${changed_node.new_code}
    \`\`\`
      
    ---
      
    ## AFFECTED NODES
    MASSIVE BLAST RADIUS DETECTED: This change impacts a total of **${total_graph_dependencies}** nodes in the graph!
    Displaying the top ${affected_nodes.length} most critical nodes for your analysis:
      
    ${affectedNodesText}
      
    ---
      
    ## YOUR TASK
    Analyze the exact diff of the CHANGED NODE. 
    Acknowledge in your summary that this change ripples across ${total_graph_dependencies} total files.
      
    Respond ONLY in the following JSON format:
    {
      "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
      "summary": "One concise paragraph...",
      "direct_issues": ["..."],
      "impact_breakdown": [
        {
          "node_name": "...",
          "node_type": "...",
          "file_path": "...",
          "relationship": "...",
          "impact": "...",
          "may_break": true
        }
      ],
      "potential_bugs": ["..."]
    }
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
          content: 'You are an expert software engineer and code impact analyst. You always respond with pure valid JSON only.'
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
    const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleaned);

  } catch (error: any) {
    throw new Error(`Groq analysis failed: ${error.message}`);
  }
}