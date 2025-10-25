import './CustomButton.css';

function CustomButton({
  onClick,
  text = "Volver",
  icon = "bi-arrow-left-square",
}) {
  return (
    <button className="btn-personalizado" onClick={onClick}>
      <i className={`bi ${icon}`}></i> {text}
    </button>
  );
}

export default CustomButton;