import React, { useEffect } from 'react';
import { Save } from 'lucide-react';
import Modal from './Modal';

const AddProblemModal = ({ isOpen, onClose, onSave, initialData = null }) => {
    // Reset form when modal opens/closes or initialData changes
    // But since we use uncontrolled inputs with defaultValues, we key the form to force re-render
    const isEdit = !!initialData;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <div className="bg-indigo-500/20 p-2 rounded-lg">
                        <Save className="text-indigo-400" size={24} />
                    </div>
                    {isEdit ? 'Edit Problem' : 'Add New Problem'}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    {isEdit ? 'Update problem details and notes.' : 'Manually track a problem for spaced repetition.'}
                </p>
            </div>

            <form
                key={initialData ? initialData.url : 'new'}
                onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    // Pass current initialData to preserve IDs/History if handled by parent, 
                    // usually parent handles merging but form just emits values.
                    // For edit, we might want to ensure URL isn't changed or we handle it gracefully.
                    onSave(formData);
                }}
                className="space-y-4"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</label>
                        <input
                            name="title"
                            required
                            defaultValue={initialData?.title || ''}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-colors"
                            placeholder="e.g. Two Sum"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Problem URL</label>
                        <input
                            name="url"
                            required
                            readOnly={isEdit}
                            defaultValue={initialData?.url || ''}
                            className={`w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-colors ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            placeholder="https://leetcode.com/..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Platform</label>
                        <select
                            name="platform"
                            defaultValue={initialData?.platform || 'LeetCode'}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none hover:cursor-pointer"
                        >
                            <option value="LeetCode">LeetCode</option>
                            <option value="HackerRank">HackerRank</option>
                            <option value="Codeforces">Codeforces</option>
                            <option value="NeetCode">NeetCode</option>
                            <option value="TUF">TakeUForward</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Difficulty</label>
                        <select
                            name="difficulty"
                            defaultValue={initialData?.difficulty || 'Easy'}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none hover:cursor-pointer"
                        >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pattern Tags</label>
                    <input
                        name="pattern"
                        defaultValue={Array.isArray(initialData?.pattern_tag) ? initialData.pattern_tag.join(', ') : (initialData?.pattern_tag || '')}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-colors"
                        placeholder="e.g. Two Pointers, Sliding Window (comma separated)"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Key Insight / Notes</label>
                    <textarea
                        name="notes"
                        rows="3"
                        defaultValue={initialData?.notes || ''}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-colors resize-none"
                        placeholder="What's the main trick?"
                    />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-400 hover:text-white font-medium transition-colors">Cancel</button>
                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                        {isEdit ? 'Update Problem' : 'Save Problem'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddProblemModal;
