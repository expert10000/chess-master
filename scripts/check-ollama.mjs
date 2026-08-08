const url = 'http://127.0.0.1:11434/api/tags';

try {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const models = Array.isArray(data.models)
    ? data.models.map((entry) => entry?.name ?? entry?.model).filter(Boolean)
    : [];
  console.log('Ollama: online');
  console.log(`Endpoint: ${url}`);
  if (models.length) {
    console.log('Models:');
    for (const model of models) console.log(`  - ${model}`);
  } else {
    console.log('Models: none installed');
    console.log('Example: ollama pull qwen3:8b');
  }
} catch (error) {
  console.error('Ollama: not reachable');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Start Ollama locally, then run this check again.');
  process.exitCode = 1;
}
