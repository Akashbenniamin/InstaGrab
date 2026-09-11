import { useState } from 'react';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';

export function PrivacyNotice() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-12 text-center max-w-lg mx-auto">
      <div className="flex items-center justify-center space-x-2 text-sm text-[var(--text-secondary)] mb-2">
        <Shield className="w-4 h-4 text-green-500" />
        <p>100% Private & Local</p>
      </div>
      
      <p className="text-xs text-[var(--text-secondary)]">
        Your downloads happen directly on your device. No videos pass through our servers. No data is collected.
      </p>
      
      <button 
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-insta-pink hover:underline inline-flex items-center"
      >
        {expanded ? 'Show less' : 'Learn more'}
        {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
      </button>

      {expanded && (
        <div className="mt-4 p-4 text-left text-xs bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] space-y-2">
          <p><strong>How it works:</strong> InstaGrab uses a local helper application to process downloads directly on your machine. This website simply acts as a remote control for that helper.</p>
          <p><strong>Legal Notice:</strong> Download content only when you have permission. Respect creators' copyrights. This tool is for personal use only.</p>
        </div>
      )}
    </div>
  );
}
