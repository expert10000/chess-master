# v1.8.0 — Personalized Chess Curriculum / Skill Graph

The skill graph converts existing evidence into an ordered curriculum. It contains Calculation (candidate moves → forcing moves → 2-ply accuracy → 3+ ply consistency), Tactics, Positional play, and Endgames. Each node records a bounded strength estimate, confidence, trend, evidence count, mastery flag, prerequisite and next target.

Motif Memory affects the relevant nodes: for example a recurring poor rook transition reduces rook activity before conversion. The coach can therefore recommend an upstream prerequisite instead of repeatedly assigning a downstream topic with a hidden blocker.
