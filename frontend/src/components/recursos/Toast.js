import React, { useState, useEffect } from 'react';

function Toast({ message, type, duration = 5000 }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration]);

    if (!isVisible) {
        return null;
    }

    return (
        <div className="mensaje-container">
            <div className={`mensaje mensaje-${type}`}>
                {type === 'error' && <i className="bi bi-exclamation-triangle-fill"></i>}
                {type === 'success' && <i className="bi bi-check-circle-fill"></i>}
                <span>{message}</span>
            </div>
        </div>
    );
}

export default Toast;