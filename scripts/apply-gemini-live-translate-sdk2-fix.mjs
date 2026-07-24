import fs from 'node:fs';

function replaceOnce(file, before, after, label) {
  const text = fs.readFileSync(file, 'utf8');
  const first = text.indexOf(before);
  if (first < 0) {
    throw new Error(`[${label}] expected source block was not found in ${file}`);
  }
  if (text.indexOf(before, first + before.length) >= 0) {
    throw new Error(`[${label}] source block matched more than once in ${file}`);
  }
  fs.writeFileSync(file, text.slice(0, first) + after + text.slice(first + before.length), 'utf8');
  console.log(`[patched] ${label}`);
}

replaceOnce(
  'src/services/clients/GeminiClient.ts',
  `    const liveTranslate = isGeminiSessionConfig(config) && isGeminiLiveTranslateModel(config.model);\n\n    // Gemini 3.5 Live Translate uses a deliberately simplified setup.`,
  `    const liveTranslate = isGeminiSessionConfig(config) && isGeminiLiveTranslateModel(config.model);\n    const liveTranslateTargetLanguageCode = liveTranslate\n      ? toGeminiLiveTranslateLanguageCode(config.targetLanguage)\n      : undefined;\n\n    if (liveTranslate && isGeminiSessionConfig(config)) {\n      console.info('[Sokuji] [GeminiClient] Live Translate language config:', JSON.stringify({\n        sourceLanguage: config.sourceLanguage,\n        targetLanguage: config.targetLanguage,\n        targetLanguageCode: liveTranslateTargetLanguageCode,\n        echoTargetLanguage: true,\n      }));\n    }\n\n    // Gemini 3.5 Live Translate uses a deliberately simplified setup.`,
  'Live Translate resolved-language diagnostics',
);

replaceOnce(
  'src/services/clients/GeminiClient.ts',
  `            targetLanguageCode: toGeminiLiveTranslateLanguageCode(config.targetLanguage),\n            echoTargetLanguage: false,`,
  `            targetLanguageCode: liveTranslateTargetLanguageCode!,\n            echoTargetLanguage: true,`,
  'Live Translate SDK 2 configuration',
);

replaceOnce(
  'src/services/clients/GeminiClient.ts',
  `                  config: {\n                    temperature: liveConfig.temperature,\n                    maxOutputTokens: liveConfig.maxOutputTokens,\n                    systemInstruction: liveConfig.systemInstruction ? 'set' : 'none'\n                  }`,
  `                  config: {\n                    temperature: liveConfig.temperature,\n                    maxOutputTokens: liveConfig.maxOutputTokens,\n                    systemInstruction: liveConfig.systemInstruction ? 'set' : 'none',\n                    translationConfig: liveTranslate ? liveConfig.translationConfig : undefined,\n                    sourceLanguage: liveTranslate && isGeminiSessionConfig(config) ? config.sourceLanguage : undefined,\n                    targetLanguage: liveTranslate && isGeminiSessionConfig(config) ? config.targetLanguage : undefined,\n                    resolvedTargetLanguageCode: liveTranslateTargetLanguageCode,\n                  }`,
  'Session log exposes Live Translate language config',
);

replaceOnce(
  'src/services/clients/GeminiClient.test.ts',
  `      echoTargetLanguage: false,`,
  `      echoTargetLanguage: true,`,
  'Live Translate test mirrors mobile client echo setting',
);

console.log('Gemini Live Translate SDK 2 follow-up fix applied successfully.');
