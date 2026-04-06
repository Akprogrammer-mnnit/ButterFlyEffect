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




