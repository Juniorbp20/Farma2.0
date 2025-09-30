export const extractErrorMessage = (err) => {
let mensaje = err.response?.data?.message || err.message;

if (typeof mensaje === "object") {
    if (mensaje.message) {
    mensaje = mensaje.message;
    } else {
    mensaje = JSON.stringify(mensaje);
    }
}

return mensaje;
};
