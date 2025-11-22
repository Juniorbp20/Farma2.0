import React, { useEffect } from "react";
import "./ConfirmModal.css";

function ConfirmModal({
    isOpen,
    title = "Confirmar",
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    onConfirm,
    onCancel,
    confirmVariant = "primary",
    cancelVariant = "outline-danger",
    confirmIcon = "bi-check-circle",
    cancelIcon = "bi-x-octagon",
    isLoading = false,
    showCancel = true,
    ariaLabelledBy,
}) {
    useEffect(() => {
        if (!isOpen) return;
        const handler = (event) => {
            if (event.key === "Escape" && !isLoading) {
                onCancel?.();
            }
            if (event.key === "Enter" && !isLoading) {
                onConfirm?.();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, isLoading, onCancel, onConfirm]);

    if (!isOpen) return null;

    const titleId = ariaLabelledBy || "confirm-modal-title";

    return (
        <div
            className="confirm-modal-overlay"
            role="presentation"
            onClick={() => {
                if (!isLoading) onCancel?.();
            }}
        >
            <div
                className="confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id={titleId}>{title}</h3>
                {message ? (
                    <div className="confirm-modal-message">
                        {typeof message === "string" ? <p>{message}</p> : message}
                    </div>
                ) : null}
                <div className="confirm-modal-actions">
                    {showCancel && (
                        <button
                            type="button"
                            className={`btn btn-${cancelVariant} confirm-btn confirm-btn-cancel`}
                            onClick={onCancel}
                            disabled={isLoading}
                        >
                            {cancelIcon && <i className={`bi ${cancelIcon} me-2`}></i>}
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        className={`btn btn-${confirmVariant} confirm-btn confirm-btn-confirm`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading && (
                            <span className="spinner-border spinner-border-sm me-2" />
                        )}
                        {!isLoading && confirmIcon && (
                            <i className={`bi ${confirmIcon} me-2`}></i>
                        )}
                        {isLoading ? "Procesando..." : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;
