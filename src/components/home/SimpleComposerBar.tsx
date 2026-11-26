import React from 'react';
import { CompanionOrbState } from '../../types/angel';
import { ComposerContext, ComposerSubmissionResult } from '../../types/composer';
import { UniversalComposer } from '../composer/UniversalComposer';

interface SimpleComposerBarProps {
  onSubmissionStarted?: (threadId?: string) => void;
  onSendMessage?: (text: string, result?: ComposerSubmissionResult) => void;
  onOrbStateChange: (state: CompanionOrbState) => void;
  onStartVoiceSession?: () => void;
  context?: ComposerContext;
}

export const SimpleComposerBar: React.FC<SimpleComposerBarProps> = ({
  onSubmissionStarted,
  onSendMessage,
  onOrbStateChange,
  onStartVoiceSession,
  context = { type: 'general' },
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto my-4" data-simple-composer-bar="true">
      <UniversalComposer
        context={context}
        variant="simple"
        onSubmissionStarted={onSubmissionStarted}
        onOrbStateChange={onOrbStateChange}
        onStartVoiceSession={onStartVoiceSession}
        onSubmitted={(result) => {
          if (result.success && onSendMessage) {
            onSendMessage('Submitted', result);
          }
        }}
      />
    </div>
  );
};
