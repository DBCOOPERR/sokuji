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
  fs.writeFileSync(file, text.slice(0, first) + after + text.slice(first + before.length));
  console.log(`[patched] ${label}`);
}

function appendOnce(file, marker, addition, label) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(marker)) {
    console.log(`[already patched] ${label}`);
    return;
  }
  fs.writeFileSync(file, text.trimEnd() + '\n\n' + addition.trim() + '\n');
  console.log(`[patched] ${label}`);
}

replaceOnce(
  'src/services/interfaces/IClient.ts',
  `export interface GeminiSessionConfig extends BaseSessionConfig {
  provider: 'gemini';
  turnDetectionMode: 'Auto' | 'Push-to-Talk' | 'Push-to-Translate';`,
  `export interface GeminiSessionConfig extends BaseSessionConfig {
  provider: 'gemini';
  sourceLanguage: string;
  targetLanguage: string;
  turnDetectionMode: 'Auto' | 'Push-to-Talk' | 'Push-to-Translate';`,
  'Gemini session language fields',
);

replaceOnce(
  'src/services/providers/GeminiProviderConfig.ts',
  `      model: settings.model,
      voice: settings.voice,
      instructions: systemInstructions,`,
  `      model: settings.model,
      voice: settings.voice,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage,
      instructions: systemInstructions,`,
  'Gemini provider passes languages',
);

replaceOnce(
  'src/components/MainPanel/MainPanel.tsx',
  `import type { VolcengineAST2SessionConfig, VolcengineSTSessionConfig, LocalInferenceSessionConfig, LocalNativeSessionConfig, OpenAITranslateSessionConfig, TranslateTargetLanguage, ZoomAISessionConfig, SonioxSessionConfig } from '../../services/interfaces/IClient';`,
  `import type { VolcengineAST2SessionConfig, VolcengineSTSessionConfig, LocalInferenceSessionConfig, LocalNativeSessionConfig, OpenAITranslateSessionConfig, TranslateTargetLanguage, ZoomAISessionConfig, SonioxSessionConfig, GeminiSessionConfig } from '../../services/interfaces/IClient';`,
  'MainPanel imports GeminiSessionConfig',
);

replaceOnce(
  'src/components/MainPanel/MainPanel.tsx',
  `      tConfig.targetLanguage = (oldSource ?? oldTarget) as TranslateTargetLanguage;
      tConfig.sourceLanguage = oldTarget;
    }

    // Volcengine providers carry language direction in explicit config fields`,
  `      tConfig.targetLanguage = (oldSource ?? oldTarget) as TranslateTargetLanguage;
      tConfig.sourceLanguage = oldTarget;
    }

    // Gemini Live Translate carries its output direction in an explicit target
    // language field rather than in system instructions. Reverse the pair for
    // participant/system audio so "their language -> my language" is preserved.
    if (config.provider === 'gemini') {
      const gemini = config as GeminiSessionConfig;
      [gemini.sourceLanguage, gemini.targetLanguage] = [gemini.targetLanguage, gemini.sourceLanguage];
    }

    // Volcengine providers carry language direction in explicit config fields`,
  'Participant Gemini language direction',
);

replaceOnce(
  'src/services/clients/GeminiClient.ts',
  `import i18n from '../../locales';
import { Provider, ProviderType } from '../../types/Provider';

/**`,
  `import i18n from '../../locales';
import { Provider, ProviderType } from '../../types/Provider';

const GEMINI_LIVE_TRANSLATE_MODEL = 'gemini-3.5-live-translate-preview';

export function isGeminiLiveTranslateModel(model: string): boolean {
  return model.replace(/^models\\//, '').toLowerCase() === GEMINI_LIVE_TRANSLATE_MODEL;
}

/**
 * Convert Sokuji's locale-oriented language values into the target codes
 * accepted by Gemini Live Translate. Most entries can use their primary
 * language subtag; Chinese and Portuguese require explicit variants.
 */
export function toGeminiLiveTranslateLanguageCode(language: string): string {
  const normalized = (language || '').trim().replace('_', '-');
  if (!normalized) return 'en';

  const exact: Record<string, string> = {
    'cmn-cn': 'zh-Hans',
    'zh-cn': 'zh-Hans',
    'zh-hans': 'zh-Hans',
    'zh-hans-cn': 'zh-Hans',
    'zh-tw': 'zh-Hant',
    'zh-hant': 'zh-Hant',
    'zh-hant-tw': 'zh-Hant',
    'pt-br': 'pt-BR',
    'pt-pt': 'pt-PT',
  };

  const lower = normalized.toLowerCase();
  if (exact[lower]) return exact[lower];

  const primary = lower.split('-')[0];
  return primary === 'cmn' ? 'zh-Hans' : primary;
}

/**`,
  'Gemini Live Translate helpers',
);

replaceOnce(
  'src/services/clients/GeminiClient.ts',
  `    // Convert SessionConfig to LiveConnectConfig
    const liveConfig: LiveConnectConfig = {
      responseModalities,
      temperature: config.temperature,
      maxOutputTokens: typeof config.maxTokens === 'number' ? config.maxTokens : undefined,
      systemInstruction: config.instructions ? {
        parts: [{ text: config.instructions }]
      } : undefined,
      speechConfig: config.voice && !config.textOnly ? {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: config.voice
          }
        }
      } : undefined,
      inputAudioTranscription: {},
      outputAudioTranscription: {},  // Always enable for transcript in both normal and textOnly modes
      realtimeInputConfig,
      sessionResumption: {
        handle: this.savedResumptionHandle ?? undefined,
      },
      contextWindowCompression: {
        slidingWindow: {},
      },
    };`,
  `    const liveTranslate = isGeminiSessionConfig(config) && isGeminiLiveTranslateModel(config.model);

    // Gemini 3.5 Live Translate uses a deliberately simplified setup. It does
    // not accept normal Live model instructions; the target language must be
    // supplied through translationConfig or the API defaults to English.
    const liveConfig: LiveConnectConfig = liveTranslate
      ? ({
          responseModalities,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          translationConfig: {
            targetLanguageCode: toGeminiLiveTranslateLanguageCode(config.targetLanguage),
            echoTargetLanguage: false,
          },
        } as LiveConnectConfig)
      : {
          responseModalities,
          temperature: config.temperature,
          maxOutputTokens: typeof config.maxTokens === 'number' ? config.maxTokens : undefined,
          systemInstruction: config.instructions ? {
            parts: [{ text: config.instructions }]
          } : undefined,
          speechConfig: config.voice && !config.textOnly ? {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.voice
              }
            }
          } : undefined,
          inputAudioTranscription: {},
          outputAudioTranscription: {},  // Always enable for transcript in both normal and textOnly modes
          realtimeInputConfig,
          sessionResumption: {
            handle: this.savedResumptionHandle ?? undefined,
          },
          contextWindowCompression: {
            slidingWindow: {},
          },
        };`,
  'Gemini 3.5 Live Translate connection config',
);

replaceOnce(
  'src/services/clients/GeminiClient.test.ts',
  `const baseConfig = {
  model: 'gemini-2.0-flash-live',
  provider: 'gemini' as const,
  turnDetectionMode: 'Auto' as const,`,
  `const baseConfig = {
  model: 'gemini-2.0-flash-live',
  provider: 'gemini' as const,
  sourceLanguage: 'en-US',
  targetLanguage: 'ja-JP',
  turnDetectionMode: 'Auto' as const,`,
  'Gemini test base language fields',
);

appendOnce(
  'src/services/clients/GeminiClient.test.ts',
  `describe('GeminiClient — Gemini 3.5 Live Translate setup'`,
  `describe('GeminiClient — Gemini 3.5 Live Translate setup', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    capturedCallbacks = {};
    mockSessionClose.mockReset();
    mockLiveConnect.mockReset();
    setupSuccessfulConnect();
  });

  it('sends Simplified Chinese through translationConfig', async () => {
    const client = new GeminiClient('test-api-key');

    await client.connect({
      ...baseConfig,
      model: 'gemini-3.5-live-translate-preview',
      sourceLanguage: 'ja-JP',
      targetLanguage: 'cmn-CN',
      instructions: 'This instruction must not be sent to Live Translate',
      temperature: 0.8,
      maxTokens: 2048,
      voice: 'Aoede',
    });

    const connectArgs = mockLiveConnect.mock.calls[0][0];
    expect(connectArgs.config.translationConfig).toEqual({
      targetLanguageCode: 'zh-Hans',
      echoTargetLanguage: false,
    });
    expect(connectArgs.config.inputAudioTranscription).toEqual({});
    expect(connectArgs.config.outputAudioTranscription).toEqual({});
    expect(connectArgs.config.systemInstruction).toBeUndefined();
    expect(connectArgs.config.temperature).toBeUndefined();
    expect(connectArgs.config.maxOutputTokens).toBeUndefined();
    expect(connectArgs.config.speechConfig).toBeUndefined();
    expect(connectArgs.config.realtimeInputConfig).toBeUndefined();
  });

  it('keeps the existing configuration for ordinary Gemini Live models', async () => {
    const client = new GeminiClient('test-api-key');

    await client.connect({
      ...baseConfig,
      model: 'gemini-3.1-flash-live-preview',
      instructions: 'Translate Japanese into Simplified Chinese',
      temperature: 0.3,
      maxTokens: 1024,
    });

    const connectArgs = mockLiveConnect.mock.calls[0][0];
    expect(connectArgs.config.translationConfig).toBeUndefined();
    expect(connectArgs.config.systemInstruction).toEqual({
      parts: [{ text: 'Translate Japanese into Simplified Chinese' }],
    });
    expect(connectArgs.config.temperature).toBe(0.3);
    expect(connectArgs.config.maxOutputTokens).toBe(1024);
    expect(connectArgs.config.realtimeInputConfig).toBeDefined();
  });
});`,
  'Gemini Live Translate tests',
);

console.log('Gemini Live Translate fix applied successfully.');
