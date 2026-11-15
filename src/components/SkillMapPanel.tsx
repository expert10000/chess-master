import { rankedSkills, type SkillMapMemory } from '../lib/skillMap';

interface SkillMapPanelProps { memory: SkillMapMemory; onJump(id: string): void; }

export function SkillMapPanel({ memory, onJump }: SkillMapPanelProps) {
  const skills = rankedSkills(memory);
  return <section className="panel skill-map-panel" id="coach-skill-map">
    <div className="panel-heading compact"><div><span className="eyebrow">Learner model</span><h2>Skill map</h2></div><span className="stable-release-badge">v1.1.2</span></div>
    <p className="skill-map-intro">A persistent curriculum view built from reviewed games and training evidence—not a single mistake counter.</p>
    <div className="skill-map-grid">{skills.map((skill) => <article key={skill.id} className="skill-card">
      <div><strong>{skill.label}</strong><span className={`skill-trend ${skill.trend}`}>{skill.trend}</span></div>
      <small>{skill.evidence}</small>
      <p><b>Confidence:</b> {skill.confidence}</p>
      <button type="button" onClick={() => onJump(skill.trainingTarget)}>{skill.recommendation}</button>
    </article>)}</div>
  </section>;
}
