import type { Metadata } from 'next';
import { OpenChatButton } from '@/components/OpenChatButton';
import { PageHero, Section } from '@/components/ui';
import { VoiceAgent } from '@/components/VoiceAgent';

export const metadata: Metadata = {
  title: 'AI Voice Assistant',
  description: 'Talk to the Bhargava Junior College AI voice assistant in English, Telugu or Hindi. Answers come only from verified college information.',
  alternates: { canonical: '/voice-assistant' },
};

export default function VoiceAssistantPage() {
  return (
    <>
      <PageHero eyebrow="AI assistance" title="Two assistants, one verified knowledge base" intro="Talk to the voice assistant, or type to the chat assistant. Both answer only from Bhargava Junior College’s verified information, and say so when they don’t know." />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <VoiceAgent embedded />
          <div className="space-y-4 text-sm leading-6">
            <div className="card p-5">
              <p className="font-semibold text-heading">🎙️ AI Voice Assistant</p>
              <p className="mt-1 text-muted">Voice only. Tap Start, allow the microphone and ask out loud in English, తెలుగు or हिंदी. It answers in a female voice; start talking any time to interrupt. Works in Chrome, Edge and Safari on computers and phones.</p>
            </div>
            <div className="card p-5">
              <p className="font-semibold text-heading">💬 AI Chat Assistant</p>
              <p className="mt-1 text-muted">Text only. Type your question and get a written answer with links, book a campus visit or talk to a counsellor.</p>
              <OpenChatButton className="btn-outline mt-3">Open the chat assistant</OpenChatButton>
            </div>
            <p className="text-xs text-muted">Both are AI assistants, not people. They never promise admission, seats or ranks. For payments or anything sensitive, they connect you to the admissions office.</p>
          </div>
        </div>
      </Section>
    </>
  );
}
