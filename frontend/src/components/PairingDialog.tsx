import { useState, useRef, useEffect } from 'react';
import { X, KeyRound, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onPair: (code: string) => Promise<boolean>;
  onClose: () => void;
}

export function PairingDialog({ isOpen, onPair, onClose }: Props) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCode(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter' && code.every(c => c)) {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    
    const success = await onPair(fullCode);
    
    setLoading(false);
    if (success) {
      onClose();
    } else {
      setError('Invalid pairing code or helper offline');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-[var(--border-color)] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold flex items-center">
            <KeyRound className="w-5 h-5 mr-2 text-insta-pink" />
            Pair Helper
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <p className="text-center text-[var(--text-secondary)]">
            Enter the 6-digit code shown in the InstaGrab helper system tray icon to connect securely.
          </p>
          
          <div className="flex justify-center gap-2 sm:gap-3">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] focus:ring-2 focus:ring-insta-pink focus:outline-none transition-all"
                disabled={loading}
              />
            ))}
          </div>
          
          {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
          
          <button
            onClick={handleSubmit}
            disabled={loading || code.some(c => !c)}
            className="w-full py-3 rounded-xl insta-gradient text-white font-semibold disabled:opacity-50 transition-opacity flex justify-center items-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
