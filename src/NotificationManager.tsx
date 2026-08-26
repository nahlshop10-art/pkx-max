import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Bell, Key, MessageSquare, AlertCircle, ArrowLeft, Settings, Copy, Check } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cloudStore } from './lib/cloudStore';

interface NotificationManagerProps {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

export default function NotificationManager({ websiteSettings, setWebsiteSettings, onClose }: NotificationManagerProps) {
  const [botToken, setBotToken] = useState(websiteSettings?.telegramNotification?.botToken || '');
  const [chatId, setChatId] = useState(websiteSettings?.telegramNotification?.chatId || '');
  const [enabled, setEnabled] = useState(websiteSettings?.telegramNotification?.enabled || false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedChatId, setCopiedChatId] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        telegramNotification: {
          enabled,
          botToken,
          chatId,
        }
      };
      setWebsiteSettings(updatedSettings);
      await cloudStore.saveSetting('websiteSettings', updatedSettings);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToken = () => {
    if (!botToken) return;
    navigator.clipboard.writeText(botToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyChatId = () => {
    if (!chatId) return;
    navigator.clipboard.writeText(chatId);
    setCopiedChatId(true);
    setTimeout(() => setCopiedChatId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Header Row matched to high fidelity design */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--dash-border)] bg-[var(--dash-bg)]">
        <div className="flex items-center gap-2">
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--dash-border)] rounded-full transition-colors"
          >
            <ArrowLeft size={18} className="text-[#e2e8f0]" />
          </button>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500 fill-blue-500/20 animate-pulse" />
            <h1 className="text-base font-semibold text-white tracking-tight">
              Notification Settings
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {saveMessage && (
              <motion.p 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`text-xs font-medium ${saveMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}
              >
                {saveMessage}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ backgroundColor: websiteSettings?.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
            className="hover:brightness-95 active:scale-95 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-4 pb-12">
          
          {/* Main settings card matching structure of image */}
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 md:p-5 shadow-sm space-y-4">
            
            {/* Top Telegram Switch Box */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--dash-border)]">
              <div className="flex items-center gap-3">
                {/* Custom highly polished Telegram Logo circle */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/10 border border-blue-500/20 shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-400 fill-current translate-x-[-0.5px] translate-y-[0.5px]" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.54 3.65-.52.36-.99.53-1.41.52-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.37-.49 1.02-.75 3.99-1.74 6.66-2.88 7.99-3.44 3.81-1.58 4.6-.18 4.5 1.08z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Enable Telegram Notifications</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Receive a message on Telegram whenever a new order is placed</p>
                </div>
              </div>

              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-[var(--dash-bg)] cursor-pointer ${enabled ? 'bg-blue-500' : 'bg-gray-600'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-all ${
                    enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Config title & form section */}
            <div className={`space-y-4 transition-all duration-300 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
              
              <div className="flex items-center gap-1.5 text-white">
                <Settings className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-semibold tracking-wide uppercase text-gray-300">Telegram Configuration</h3>
              </div>

              {/* Two Column Grid layout same to same as image */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Bot Token input with search/key icon and copy button */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-400">
                    Telegram Bot Token
                  </label>
                  <div className="relative flex items-center bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg focus-within:border-blue-500 transition-colors">
                    <div className="pl-3 flex items-center pointer-events-none text-gray-400">
                      <Key className="h-4 w-4 text-blue-400/80" />
                    </div>
                    <input
                      type="text"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="e.g. 8642328760:AAH3b9ijXcDTf0e5..."
                      className="w-full pl-2.5 pr-10 py-1.5 bg-transparent text-white placeholder-gray-600 focus:outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="absolute right-2.5 p-1 text-gray-500 hover:text-white hover:bg-[var(--dash-border)] rounded transition-colors"
                      title="Copy Token"
                    >
                      {copiedToken ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Chat ID input with message icon and copy button */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-400">
                    Chat ID
                  </label>
                  <div className="relative flex items-center bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg focus-within:border-blue-500 transition-colors">
                    <div className="pl-3 flex items-center pointer-events-none text-gray-400">
                      <MessageSquare className="h-4 w-4 text-blue-400/80" />
                    </div>
                    <input
                      type="text"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      placeholder="e.g. 6805318773"
                      className="w-full pl-2.5 pr-10 py-1.5 bg-transparent text-white placeholder-gray-600 focus:outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleCopyChatId}
                      className="absolute right-2.5 p-1 text-gray-500 hover:text-white hover:bg-[var(--dash-border)] rounded transition-colors"
                      title="Copy Chat ID"
                    >
                      {copiedChatId ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

              </div>

              {/* Polish Alert Box for better setup UX */}
              <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg flex gap-2.5 text-blue-400/90 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                <div className="leading-relaxed">
                  <strong>Quick Setup Guide:</strong> Start a conversation with your bot in Telegram by searching for its username and clicking <strong>/start</strong> before saving settings. Use <span className="font-mono text-[10px] bg-blue-500/10 px-1 py-0.5 rounded text-blue-300">@userinfobot</span> or similar tools to fetch your personal <strong>Chat ID</strong>.
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

