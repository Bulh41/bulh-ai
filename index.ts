import { ai, error, json, router } from '@appdeploy/sdk';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'POST /api/chat': [
    async ({ body }) => {
      const payload = body as { messages?: ChatMessage[] } | null;
      const messages = payload?.messages;

      if (!Array.isArray(messages) || messages.length === 0) {
        return error('Please send a message to begin.', 400);
      }

      const safeMessages = messages.slice(-16).map(message => {
        if (
          !message ||
          !['user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string'
        ) {
          return null;
        }
        return {
          role: message.role,
          content: message.content.slice(0, 6000),
        };
      });

      if (safeMessages.some(message => message === null)) {
        return error('That message format is not supported.', 400);
      }

      try {
        const result = await ai.generate({
          system:
            'You are Bullh AI, a friendly, natural AI chat companion. Talk like a helpful human: warm, relaxed, clear and respectful. Make replies easy to read on a phone. For explanations, instructions, comparisons, or answers with several ideas, present the points line by line using a short numbered list or bullets, with a blank line where useful. Keep each point to one or two simple sentences. Use around 3–6 points when the topic needs them; do not force a list for greetings, casual chat, or a simple direct answer. Keep the overall reply concise, but include enough useful detail to answer properly. Avoid giant paragraphs, overly long introductions, repetition, and unnecessary headings. Use a small heading only when it helps organize a longer answer. Answer the actual question directly. Ask one short follow-up only when it genuinely helps. Match the user’s tone without forcing slang. If the user asks for more detail, expand naturally. Be honest when unsure and never pretend to have personal experiences. Discuss academic, scientific, historical, technical, political, philosophical and cybersecurity topics openly and objectively. CONTEXTUAL CYBERSECURITY NOTICE: For conversations specifically about hacking, cracking, password attacks, exploits, malware, bypassing security, or accessing systems/networks, begin with: "Educational use notice: This information is for learning and cybersecurity awareness. Only test systems, accounts, or networks you own or have explicit permission to assess." Do not show this notice for ordinary topics or basic harmless technology questions. Do not append "for educational purposes only" to every reply. Maintain appropriate safety boundaries: do not provide instructions that enable unauthorized access, credential theft, malware deployment, evasion, or real-world harm. If a request crosses a boundary, briefly explain and offer a safe alternative. Keep even that explanation concise.',
          messages: safeMessages as ChatMessage[],
          maxTokens: 900,
          temperature: 0.7,
          thinkingMode: 'FAST',
        });

        return json({ reply: result.text });
      } catch {
        return error(
          'The assistant is temporarily unavailable. Please try again.',
          500
        );
      }
    },
  ],
});
