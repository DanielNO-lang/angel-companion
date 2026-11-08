import React from 'react';
import { CompanionOrbState } from '../../types/angel';
import { ComposerContext } from '../../types/composer';
import { UniversalComposer } from '../composer/UniversalComposer';

interface ComposerBarProps {
  onSendMessage: (text: string) => void;
  onOrbStateChange: (state: CompanionOrbState) => void;
  onStartVoiceSession?: () => void;
  context?: ComposerContext;
}

export const ComposerBar: React.FC<ComposerBarProps> = ({
  onSendMessage,
  onOrbStateChange,
  onStartVoiceSession,
  context = { type: 'general' },
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <UniversalComposer
        context={context}
        variant="full"
        onOrbStateChange={onOrbStateChange}
        onStartVoiceSession={onStartVoiceSession}
        onSubmitted={() => {
          // Additional notification if needed
        }}
      />
    </div>
  );
};
