import React from "react";
import "./ActionButton.css";

function ActionButton({
  variant = "primary",
  icon,
  text,
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  fullWidth = false,
  className = "",
  children,
  ...rest
}) {
  const content = children || text;
  const classes = [
    "action-btn",
    `action-btn-${variant}`,
    fullWidth ? "action-btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span
          className="spinner-border spinner-border-sm me-2"
          role="status"
          aria-hidden="true"
        />
      )}
      {!loading && icon && <i className={`${icon} me-2`}></i>}
      {content}
    </button>
  );
}

export default ActionButton;
