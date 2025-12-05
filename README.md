<div align="center">
   
# TOON Context Optimizer

![video](/public/video.gif)

## Preview

![image](/public/preview.png)

![image](/public/preview2.png)

</div>

Boost adoption of the TOON format by seamlessly integrating it into your IDE chat workflows. **TOON Context Optimizer** inspects every JSON file you attach to VS Code's chat, converts it to TOON automatically when that saves tokens, and transparently forwards the optimal representation to the LLM.

## How It Works
1. Register a chat participant `@context` through the VS Code extension API.
2. On each chat request, gather attached files and decode JSON contents.
3. Convert JSON payloads to TOON, compare token counts (using `@dqbd/tiktoken`), and select the format with fewer tokens:
   - **If the delta is positive** (TOON has fewer tokens than JSON), TOON is used.
   - **If the delta is negative** (JSON has fewer tokens than TOON), JSON is used.
   - This ensures the LLM always receives the most token-efficient format.
4. Stream a summary of deltas back to the user and forward the optimized content to the LLM.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Compile the extension:
   ```bash
   npm run compile && vsce package
   ```
3. Launch the extension host (F5 in VS Code) and open a chat session.
4. Mention `@context` and attach one or more `.json` files; the extension will handle the rest.

## Notes
- Relies on `@toon-format/toon` for TOON encoding and `@dqbd/tiktoken` for GPT-compatible token counting.
- Evaluate ways to intercept attached files without `@context`; today the VS Code API only delivers JSON payloads that mention `@context`, so generic attachments remain untouched.
- Explore native browser integrations to remove any remaining friction for TOON adoption.
