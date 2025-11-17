import './CustomButton.css';

function CustomButton({
  onClick,
  text = "Volver",
  icon = "bi-arrow-left-square",
  className = "",
  type = "button",
  children,
}) {
  return (
    <button type={type} className={`btn-personalizado ${className}`} onClick={onClick}>
      {children ? children : (<><i className={`bi ${icon}`}></i> {text}</>)}
    </button>
  );
}

export default CustomButton;
