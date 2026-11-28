import React from 'react';
import { CompanionOrbState } from '../../types/angel';
import { ComposerContext } from '../../types/composer';
import { UniversalComposer } from '../composer/UniversalComposer';

interface ComposerBarProps {
  onSendMessage: (text: string) => void;
  onOrbStateChange: (state: CompanionOrbState) => void;
  onStartVoiceSession?: () => void;
  isGenerating?: boolean;
  onStopGenerating?: () => void;
  context?: ComposerContext;
}

export const ComposerBar: React.FC<ComposerBarProps> = ({
  onSendMessage,
  onOrbStateChange,
  onStartVoiceSession,
  isGenerating = false,
  onStopGenerating,
  context = { type: 'general' },
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <UniversalComposer
        context={context}
        variant="full"
        onOrbStateChange={onOrbStateChange}
        onStartVoiceSession={onStartVoiceSession}
        isGenerating={isGenerating}
        onStopGenerating={onStopGenerating}
        onSubmissionStarted={() => {
          onSendMessage('Submitted');
        }}
        onSubmitted={() => {
          onSendMessage('Submitted');
        }}
      />
    </div>
  );
};
