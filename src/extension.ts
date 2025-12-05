import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { encode as toonEncode } from '@toon-format/toon';
import { encoding_for_model, type Tiktoken } from '@dqbd/tiktoken';

let cachedEncoding: Tiktoken | undefined;

export function activate(context: vscode.ExtensionContext) {
    const chatParticipant = vscode.chat.createChatParticipant('ai-prompt-popup.context', async (request, chatContext, stream, token) => {
        const fileRefs: { fileName: string; uri: vscode.Uri }[] = [];
        if (request.references && request.references.length > 0) {
            for (const ref of request.references) {
                let fileUri: vscode.Uri | undefined;
                if (ref.value instanceof vscode.Uri) {
                    fileUri = ref.value;
                } else if (typeof ref.value === 'object' && ref.value !== null) {
                    const val = ref.value as any;
                    if (val.uri) {
                        fileUri = val.uri;
                    }
                }
                if (fileUri) {
                    const fileName = fileUri.fsPath.split('/').pop() || fileUri.fsPath;
                    fileRefs.push({ fileName, uri: fileUri });
                }
            }
        }
        const llmMessages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(request.prompt)
        ];
        const decoder = new TextDecoder();
        const deltaLines: string[] = [];
        const enrichedFiles: { fileName: string; formatLabel: string; content: string }[] = [];
        for (const { fileName, uri } of fileRefs) {
            if (!fileName.toLowerCase().endsWith('.json')) {
                continue;
            }

            try {
                const content = decoder.decode(await vscode.workspace.fs.readFile(uri));
                const parsed = JSON.parse(content);
                const { delta, toon } = await deltaToonJson(parsed);
                const useToon = delta > 0;
                const formatLabel = useToon ? 'TOON' : 'JSON';
                const contentForPrompt = (useToon ? toon : content).trim();

                deltaLines.push(`- ${fileName}: delta = ${delta} (format ${formatLabel})`);
                enrichedFiles.push({ fileName, formatLabel, content: contentForPrompt });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                deltaLines.push(`- ${fileName}: error calculating delta (${message})`);
            }
        }

        if (deltaLines.length > 0) {
            stream.markdown('**Delta TOON vs JSON**\n');
            stream.markdown(`${deltaLines.join('\n')}\n\n`);
        }

        if (enrichedFiles.length > 0) {
            stream.markdown('**Files sent to the LLM**\n');
            for (const { fileName, formatLabel, content } of enrichedFiles) {
                stream.markdown(`- ${fileName} (${formatLabel})\n`);
                llmMessages.push(
                    vscode.LanguageModelChatMessage.User(
                        `File content ${fileName} (${formatLabel}):\n\n\
\`\`\`\n${content}\n\`\`\``
                    )
                );
            }
            stream.markdown('\n');
        }

        try {
            const chatResponse = await request.model.sendRequest(llmMessages, {}, token);
            for await (const fragment of chatResponse.text) {
                stream.markdown(fragment);
            }
        } catch (error) {
            stream.markdown('Error contacting the LLM');
        }

        return { metadata: { command: '' } };
    });

    chatParticipant.iconPath = new vscode.ThemeIcon('output');

    context.subscriptions.push(chatParticipant);
}

export function deactivate() {
    if (cachedEncoding) {
        cachedEncoding.free();
        cachedEncoding = undefined;
    }
}

async function getEncoding(): Promise<Tiktoken> {
    if (!cachedEncoding) {
        cachedEncoding = await encoding_for_model('gpt-4o-mini');
    }
    return cachedEncoding;
}

export async function deltaToonJson(obj: any): Promise<{ delta: number, toon: string }> {
    const encoding = await getEncoding();
    const toon = toonEncode(obj);
    const json = JSON.stringify(obj);
    
    const toonTokenIds = Array.from(encoding.encode(toon));
    const jsonTokenIds = Array.from(encoding.encode(json));

    const toonTokenCount = toonTokenIds.length;
    const jsonTokenCount = jsonTokenIds.length;

    const delta = jsonTokenCount - toonTokenCount;
    return { delta, toon };
}