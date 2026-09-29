const targets = [
  ['Angular', 'http://localhost:4200/'],
  ['API', 'http://localhost:3000/api/v1/health'],
  ['Swagger', 'http://localhost:3000/docs-json'],
];

let failed = false;
for (const [name, url] of targets) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    console.log(`${response.ok ? '✓' : '✗'} ${name}: HTTP ${response.status} (${url})`);
    failed ||= !response.ok;
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : 'sin respuesta'} (${url})`);
  }
}

process.exitCode = failed ? 1 : 0;
