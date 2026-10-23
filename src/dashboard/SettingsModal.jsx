import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Clock, Zap } from 'lucide-react';
import { useSyncStatus } from './sync/useSyncStatus';
import ReminderSection from './settings/ReminderSection';
import ImportSection from './settings/ImportSection';
import PublicProfileSection from './settings/PublicProfileSection';
import WeeklyRecapSection from './settings/WeeklyRecapSection';
import { useProfile } from './settings/useProfile';

const SettingsModal = ({ isOpen, onClose, onSave, status: statusProp }) => {
    const own = useSyncStatus();
    const status = statusProp || own.status;
    const signedIn = !!status && status.state !== 'signed_out';
    const { profile, loading: profileLoading, save: saveProfile } = useProfile(isOpen && signedIn);

    // Default settings
    const [settings, setSettings] = useState({
        maxReviewsPerDay: 0 // 0 = Unlimited
    });

    useEffect(() => {
        if (isOpen) {
            // Load from localStorage
            const saved = localStorage.getItem('ALGORECALL_SETTINGS');
            let parsed = {};
            if (saved) {
                try {
                    parsed = JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse settings', e);
                }
            }

            // Also load from chrome.storage.local for extension-wide settings
            if (chrome && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['reminderFrequencyHours'], (result) => {
                    // Ensure defaults
                    if (parsed.maxReviewsPerDay === undefined) parsed.maxReviewsPerDay = 0;
                    if (result.reminderFrequencyHours) parsed.reminderFrequencyHours = result.reminderFrequencyHours;
                    else parsed.reminderFrequencyHours = 6; // Default if not set

                    setSettings(parsed);
                });
            } else {
                if (parsed.maxReviewsPerDay === undefined) parsed.maxReviewsPerDay = 0;
                if (parsed.reminderFrequencyHours === undefined) parsed.reminderFrequencyHours = 6;
                setSettings(parsed);
            }
        }
    }, [isOpen]);

    const handleSave = () => {
        // Save to localStorage
        localStorage.setItem('ALGORECALL_SETTINGS', JSON.stringify(settings));

        // Save extension-wide settings to chrome.storage.local
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                reminderFrequencyHours: settings.reminderFrequencyHours
            });
        }

        // Notify parent to reload/apply
        onSave(settings);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-4 flex items-center justify-between border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Shield className="text-indigo-400" size={20} />
                        Settings
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Max Reviews Per Day */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Clock size={16} className="text-gray-400" />
                            Daily Review Limit
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                min="0"
                                value={settings.maxReviewsPerDay}
                                onChange={(e) => setSettings({ ...settings, maxReviewsPerDay: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-2 w-24 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-center font-mono"
                            />
                            <span className="text-sm text-gray-500">
                                {settings.maxReviewsPerDay === 0 ? '(Unlimited)' : 'reviews / day'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Limits how many problems you review in a single session. Overflow problems will remain in the backlog for tomorrow.
                            <br />
                            <span className="text-indigo-400/80">Set to 0 for unlimited reviews.</span>
                        </p>
                    </div>

                    <div className="border-t border-gray-800 pt-6 space-y-3">
                        <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Zap size={16} className="text-gray-400" />
                            Notification frequency
                        </label>
                        <div className="flex items-center gap-4">
                            <select
                                value={settings.reminderFrequencyHours || 6}
                                onChange={(e) => setSettings({ ...settings, reminderFrequencyHours: parseInt(e.target.value) })}
                                className="bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            >
                                <option value="4">Every 4 Hours</option>
                                <option value="6">Every 6 Hours (Default)</option>
                                <option value="12">Every 12 Hours</option>
                                <option value="24">Every 24 Hours</option>
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            How often to remind you about due reviews when you visit a coding platform.
                        </p>
                    </div>

                    <ReminderSection />
                    <ImportSection />
                    {signedIn && (
                        <>
                            <PublicProfileSection profile={profile} onSave={saveProfile} loading={profileLoading} />
                            <WeeklyRecapSection profile={profile} onSave={saveProfile} />
                        </>
                    )}
                </div>

                <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                    >
                        <Save size={18} />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
