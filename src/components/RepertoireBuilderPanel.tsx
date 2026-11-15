import { useState, type CSSProperties } from 'react';
import { buildRepertoireTree, type RepertoireTreeNode } from '../lib/repertoireTree';
import type { RepertoireMemory } from '../lib/repertoireMemory';

interface RepertoireBuilderPanelProps { memory: RepertoireMemory; disabled?: boolean; onTrainBranch(rootKey: string): void; }

function TreeNode({ node, depth, disabled, onTrainBranch }: { node: RepertoireTreeNode; depth: number; disabled: boolean; onTrainBranch(rootKey: string): void }) {
  return <li className="repertoire-tree-node" style={{ '--tree-depth': depth } as CSSProperties}>
    <div className="repertoire-tree-node-main">
      <div><strong>{node.choice.moveSan}</strong><small>{node.choice.variation ?? node.choice.openingName} · {node.performance}</small></div>
      <div className="repertoire-node-badges">{node.weak && <b className="weak">weak</b>}{node.forgotten && <b className="forgotten">forgotten</b>}{node.transposition && <b>transpose</b>}</div>
      <button type="button" onClick={() => onTrainBranch(node.choice.positionKey)} disabled={disabled}>Train branch</button>
    </div>
    {node.alternatives.length > 0 && <small className="repertoire-alternatives">Alternatives: {node.alternatives.map((item) => item.san).join(', ')}</small>}
    {node.children.length > 0 && <ul>{node.children.map((child) => <TreeNode key={child.choice.positionKey} node={child} depth={depth + 1} disabled={disabled} onTrainBranch={onTrainBranch} />)}</ul>}
  </li>;
}

export function RepertoireBuilderPanel({ memory, disabled = false, onTrainBranch }: RepertoireBuilderPanelProps) {
  const [side, setSide] = useState<'w' | 'b'>('w');
  const roots = buildRepertoireTree(memory, side);
  return <section className="panel repertoire-builder-panel" id="coach-repertoire-builder">
    <div className="panel-heading compact"><div><span className="eyebrow">Repertoire builder 2.0</span><h2>My opening tree</h2></div><span className="repertoire-position-count">{Object.keys(memory.choices).length} nodes</span></div>
    <div className="repertoire-side-tabs"><button className={side === 'w' ? 'active' : ''} onClick={() => setSide('w')}>White repertoire</button><button className={side === 'b' ? 'active' : ''} onClick={() => setSide('b')}>Black repertoire</button></div>
    {!roots.length ? <div className="repertoire-memory-note"><strong>No {side === 'w' ? 'White' : 'Black'} nodes saved yet.</strong><p>Save moves from the Local ECO book to grow this side of the tree.</p></div> : <ul className="repertoire-tree">{roots.map((node) => <TreeNode key={node.choice.positionKey} node={node} depth={0} disabled={disabled} onTrainBranch={onTrainBranch} />)}</ul>}
    <p className="repertoire-local-note">Preferred moves are tree nodes; remembered deviations provide played-game history, while recall practice marks forgotten nodes. “Transpose” appears when multiple saved paths reach the same position.</p>
  </section>;
}
