import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CheckCircleIcon as CheckCircle2, AlertIcon as AlertTriangle, InfoIcon as Info } from './sync/icons';

const Toast = ({ message, type = 'info', isVisible, onClose, duration = 3000 }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 300); // Wait for fade out animation
            }, duration);
            return () => clearTimeout(timer);
        } else {
            setShow(false);
        }
    }, [isVisible, duration, onClose]);

    if (!isVisible && !show) return null;

    const styles = {
        success: 'bg-green-500/10 border-green-500/20 text-green-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        warning: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        info: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
    };

    const icons = {
        success: <CheckCircle2 size={18} />,
        error: <AlertTriangle size={18} />,
        warning: <AlertTriangle size={18} />,
        info: <Info size={18} />
    };

    return (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform ${show ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl ${styles[type] || styles.info}`}>
                {icons[type] || icons.info}
                <span className="font-medium text-sm">{message}</span>
                <button onClick={() => setShow(false)} className="ml-2 hover:bg-black/10 rounded-full p-1 transition-colors">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default Toast;
