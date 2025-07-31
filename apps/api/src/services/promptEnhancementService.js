import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { executeTrack } from './trackService.js';
import { generateAIResponse } from './aiService.js';

const openAi = new OpenAI(process.env.OPENAI_API_KEY);

const PROMPT_ENHANCEMENT_SYSTEM_PROMPT = `
  This is an optimized prompt.

---

### Detailed Guidelines for Critically Improving Prompts:

1. **Deep Critical Analysis of the Original Prompt:**
   - Read and critically analyze the original prompt carefully.
   - Clearly identify and reflect upon the original intent, assumptions, context, and expected outcomes.

2. **Explicitly Address Identified Issues and User Suggestions:**
   - Critically evaluate every issue or suggestion provided by the user.
   - Clearly integrate practical solutions directly into the revised prompt, ensuring every issue is resolved.

3. **Maintain and Clarify Original Intent:**
   - Ensure the enhanced prompt clearly maintains the original purpose and expected outcomes.
   - Explicitly clarify ambiguous or vague terms, instructions, and conditions.

3. **Enhance Clarity, Precision, and Specificity:**
   - Rewrite the prompt to maximize clarity, conciseness, precision, and coherence.
   - Provide detailed, explicit instructions and clearly defined parameters to prevent misinterpretation.

4. **Critical Enhancement of Examples (if provided):**
   - Carefully review the original examples for clarity, relevance, and effectiveness.
   - Improve, expand, or refine examples to clearly illustrate the expected outcomes.

5. **Final Output:**
   - Produce ONLY the fully enhanced prompt as the final output.
   - Do NOT include the original prompt or other unnecessary context in your output.

---

### Recommended Templates for Enhanced Prompts:

When appropriate, use one of these structured templates:

- **Structured Task Template:**
  - Task Description
  - Specific Requirements
  - Expected Outcome(s)

- **Instructional Template:**
  - Numbered Step-by-Step Instructions
  - Critical Considerations and Guidelines

- **Contextual Scenario Template:**
  - Scenario Description
  - Contextual Background Information
  - Defined Task and Expected Outcome(s)

- **Comparative Analysis Template:**
  - Concepts/Items to Compare
  - Detailed Comparison Criteria
  - Instructions for Comparison Presentation

- **Problem-Solution Template:**
  - Problem Statement
  - Clearly Defined Requirements or Constraints
  - Expected Detailed Solution(s)

- **Creative Generation Template:**
  - Creative Task Description or Goal
  - Clear Parameters or Constraints
  - Desired Output Format

If none of these templates precisely match the prompt, then critically adapt or skip the use of templates to ensure effectiveness.

---

`;

export const enhancePrompt = async (originalPrompt, suggestions, optimizationToken, optimizationTokenData, optimizationProvider, optimizationModel) => {
  const input = [
    {
      role: 'system',
      content: PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `
        Original Prompt:
${originalPrompt}

Incorporate the following suggestions to enhance the original prompt, listed by priority:

${suggestions
  .map(
    (s, i) => `
${i + 1}. Problem Identified: ${s.data.description}
   Suggested Solution: ${s.solution}`
  )
  .join('\n\n')}

Critically analyze and thoroughly understand the original prompt before incorporating these prioritized suggestions. Ensure the enhanced prompt maintains its original purpose, clarity, and intended outcomes.

Only output the enhanced prompt itself—no additional text or explanations. Keep examples and important notes of the original prompt, allways keep it, never remove it.
      `,
    },
  ];

  const completion = await generateAIResponse({
    messages: input,
    token: optimizationToken,
    tokenData: optimizationTokenData,
    provider: optimizationProvider,
    model: optimizationModel,
  });

  return completion.choices[0].message.content
    .replaceAll('```json', '')
    .replaceAll('```', '');
};
