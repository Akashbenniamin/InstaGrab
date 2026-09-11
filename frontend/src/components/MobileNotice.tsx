import { Smartphone } from 'lucide-react';

interface Props {
  isConnected: boolean;
}

export function MobileNotice({ isConnected }: Props) {
  if (isConnected) return null;

  return (
    <div className="block sm:hidden mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 text-sm">
      <div className="flex items-start">
        <Smartphone className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
        <p>
          This tool requires a desktop computer to download videos. The companion app runs on Windows to handle downloads locally.
        </p>
      </div>
    </div>
  );
}
