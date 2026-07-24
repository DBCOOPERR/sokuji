import fs from 'node:fs';

const files = [
  'src/services/interfaces/IClient.ts',
  'src/services/providers/GeminiProviderConfig.ts',
  'src/components/MainPanel/MainPanel.tsx',
  'src/services/clients/GeminiClient.ts',
  'src/services/clients/GeminiClient.test.ts',
];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  fs.writeFileSync(file, normalized, 'utf8');
  console.log(`[normalized EOL] ${file}`);
}
