import React, { useEffect } from "react";

const backButtonStyles = `
  .btn-personalizado {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: transparent;
    color: #0D6EFD;
    border: 2px solid; 
    border-color: #0D6EFD;
    border-radius: 8px;
    padding: 8px 12px;
    font-weight: 600;
    margin-bottom: 10px;
    transition: all 0.3s ease;
  }

  .btn-personalizado:hover,
  .btn-personalizado:focus {
    background-color: #0D6EFD;
    color: #ffffff;
    border-color: #0D6EFD;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .btn-personalizado:active {
    background-color: #0b5ed7;
    color: #ffffff;
    border-color: #0b5ed7;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
`;

function CustomButton({
  onClick,
  text = "Volver",
  icon = "bi-arrow-left-square",
}) {
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = backButtonStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <button className="btn-personalizado" onClick={onClick}>
    <i className={`bi ${icon}`}></i> {text}
    </button>
  );
}

export default CustomButton;
