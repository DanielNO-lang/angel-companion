import React from 'react';
import { CompanionOrbState } from '../../types/angel';
import { ComposerContext } from '../../types/composer';
import { UniversalComposer } from '../composer/UniversalComposer';

interface SimpleComposerBarProps {
  onSendMessage?: (text: string) => void;
  onOrbStateChange: (state: CompanionOrbState) => void;
  onStartVoiceSession?: () => void;
  context?: ComposerContext;
}

export const SimpleComposerBar: React.FC<SimpleComposerBarProps> = ({
  onSendMessage,
  onOrbStateChange,
  onStartVoiceSession,
  context = { type: 'general' },
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto my-4">
      <UniversalComposer
        context={context}
        variant="simple"
        onOrbStateChange={onOrbStateChange}
        onStartVoiceSession={onStartVoiceSession}
        onSubmitted={() => {
          if (onSendMessage) onSendMessage('Submitted');
        }}
      />
    </div>
  );
};
