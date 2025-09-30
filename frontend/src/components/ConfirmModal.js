// // src/components/ConfirmModal.js
// import React from 'react';
// import "./ConfirmModal.css";

// function ConfirmModal({ show, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar" }) {
//   if (!show) return null;

//   return (
//     <div className="modal-overlay">
//       <div className="modal-content modal-delete-content">
//         <h3>{title}</h3>
//         <p>{message}</p>
//         <div className="modal-buttons">
//           <button className="btn btn-confirm" onClick={onConfirm}>
//             {confirmText}
//           </button>
//           <button className="btn btn-cancel" onClick={onCancel}>
//             {cancelText}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default ConfirmModal;