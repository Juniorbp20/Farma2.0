/* eslint-disable react-hooks/exhaustive-deps */
// src/pages/LoginPage.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './LoginPage.css';
import { login } from '../services/authService';
import { gsap, Power2, Quad } from 'gsap';

const useCharacterAnimation = (usernameRef, passwordRef, svgRef, showPassword, passwordValue) => {
  const [isEmailFocus, setIsEmailFocus] = useState(false);
  const [isPasswordFocus, setIsPasswordFocus] = useState(false);
  const svgElements = useRef({});
  const blinkingTween = useRef(null);
  const eyesCovered = useRef(false);

  const getAngle = (x1, y1, x2, y2) => Math.atan2(y1 - y2, x1 - x2);

  const startBlinking = useCallback((delay = 12) => {
    if (blinkingTween.current || !svgElements.current.eyes) return;

    const { eyes } = svgElements.current;
    const randomDelay = Math.floor(Math.random() * delay) + 1;

    blinkingTween.current = gsap.to(eyes, 0.1, {
      delay: randomDelay,
      scaleY: 0.1,
      yoyo: true,
      repeat: 1,
      transformOrigin: "center center",
      onComplete: () => {
        blinkingTween.current = null;
        startBlinking(12);
      }
    });
  }, []);

  const stopBlinking = useCallback(() => {
    if (blinkingTween.current) {
      blinkingTween.current.kill();
      blinkingTween.current = null;
      gsap.set(svgElements.current.eyes, { scaleY: 1 });
    }
  }, []);

  const calculateFaceMove = useCallback(() => {
    const emailEl = usernameRef.current;
    if (!emailEl || !svgRef.current || !svgElements.current.eyes) return;

    const emailRect = emailEl.getBoundingClientRect();
    const svgRect = svgRef.current.getBoundingClientRect();

    const targetX = emailRect.left + emailRect.width / 2;
    const targetY = emailRect.top + emailRect.height / 2;

    const characterCenterX = svgRect.left + 492 / 1000 * svgRect.width;
    const characterCenterY = svgRect.top + 316 / 1000 * svgRect.height;

    const eyeRAngle = getAngle(characterCenterX, characterCenterY, targetX, targetY);

    const moveX = Math.cos(eyeRAngle) * 20;
    const moveY = Math.sin(eyeRAngle) * 10;

    gsap.to(svgElements.current.eyes, 0.6, { x: -moveX, y: -moveY, ease: Power2.easeOut });
  }, [usernameRef, svgRef]);

  const coverEyes = useCallback((partial = false) => {
    const { armL, armR } = svgElements.current;

    gsap.killTweensOf([armL, armR]);
    gsap.set([armL, armR], { visibility: "visible" });

    const TARGET_Y = -180;
    const L_ARM_X = 155;
    const R_ARM_X = -155;
    const COVER_ROTATION = -148;

    const HIDDEN_Y = -100;

    const TARGET_Y_PEEK = -180;
    const L_ARM_X_PEEK = L_ARM_X + 0;

    if (!partial) {
      gsap.to(armL, 0.7, { rotation: COVER_ROTATION, x: L_ARM_X, y: TARGET_Y, ease: Quad.easeOut });
      gsap.to(armR, 0.7, { rotation: -COVER_ROTATION, x: R_ARM_X, y: TARGET_Y, ease: Quad.easeOut, delay: 0.1 });
    }
    else {
      gsap.to(armL, 0.6, { rotation: COVER_ROTATION, x: L_ARM_X_PEEK, y: TARGET_Y_PEEK, ease: Quad.easeOut });
      gsap.to(armR, 0.7, { rotation: -COVER_ROTATION, x: R_ARM_X, y: HIDDEN_Y, ease: Quad.easeOut });
    }
    eyesCovered.current = true;
  }, []);

  const uncoverEyes = useCallback(() => {
    if (!eyesCovered.current) return;
    const { armL, armR } = svgElements.current;
    const HIDDEN_Y = 400;
    const HIDDEN_X = 0;
    const HIDDEN_ROT = 0;

    gsap.killTweensOf([armL, armR]);

    gsap.to(armL, 1.4, { rotation: HIDDEN_ROT, x: HIDDEN_X, y: HIDDEN_Y, ease: Quad.easeOut, delay: 0.1 });
    gsap.to(armR, 1.4, {
      rotation: HIDDEN_ROT, x: HIDDEN_X, y: HIDDEN_Y, ease: Quad.easeOut, onComplete: () => {
        gsap.set([armL, armR], { visibility: "hidden" });
      }
    });
    eyesCovered.current = false;
  }, []);

  // --- Efectos de React ---
  useEffect(() => {
    if (svgRef.current) {
      svgElements.current = {
        armL: svgRef.current.querySelector('#brazoIzq'),
        armR: svgRef.current.querySelector('#brazoDer'),
        eyes: svgRef.current.querySelector('.eyes-group'),
        eyeL: svgRef.current.querySelector('#ojoIzq ellipse'),
        eyeR: svgRef.current.querySelector('#ojoDer ellipse'),
      };

      // Posición inicial de los brazos (derechitas y fuera de vista)
      const INITIAL_HIDDEN_Y = 400;
      const INITIAL_HIDDEN_X = 0;
      const INITIAL_ROTATION = 0;
      gsap.set(svgElements.current.armL, { x: INITIAL_HIDDEN_X, y: INITIAL_HIDDEN_Y, rotation: INITIAL_ROTATION, visibility: "hidden", transformOrigin: "center center" });
      gsap.set(svgElements.current.armR, { x: INITIAL_HIDDEN_X, y: INITIAL_HIDDEN_Y, rotation: INITIAL_ROTATION, visibility: "hidden", transformOrigin: "center center" });

      startBlinking(5);
    }
    return () => stopBlinking();
  }, [svgRef, startBlinking, stopBlinking]);


  // Maneja el foco y el toggle de la contraseña
  useEffect(() => {
    if (isPasswordFocus) {
      stopBlinking();
      coverEyes(showPassword);
    }
    else if (isEmailFocus) {
      stopBlinking();
      
      // LÓGICA CLAVE: Solo descubrir si el campo de contraseña está vacío
      if (!passwordValue) { 
        uncoverEyes(); 
      }
      
      const handler = () => calculateFaceMove();
      usernameRef.current.addEventListener('input', handler);
      calculateFaceMove(); 
      return () => usernameRef.current.removeEventListener('input', handler);
    } 
    else {
      //uncoverEyes();
      startBlinking(12);
      gsap.to(svgElements.current.eyes, 0.5, { x: 0, y: 0, ease: Power2.easeOut });
    }
  }, [isEmailFocus, isPasswordFocus, showPassword, uncoverEyes, coverEyes, stopBlinking, startBlinking, calculateFaceMove, usernameRef]);

  const handleEmailFocus = () => { setIsEmailFocus(true); setIsPasswordFocus(false); };
  const handleEmailBlur = () => { setIsEmailFocus(false); };
  const handlePasswordFocus = () => { setIsPasswordFocus(true); setIsEmailFocus(false); };
  const handlePasswordBlur = () => { setIsPasswordFocus(false); };


  return {
    handleEmailFocus,
    handleEmailBlur,
    handlePasswordFocus,
    handlePasswordBlur,
    coverEyes,
    svgRef, usernameRef, passwordRef
  };
};


function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});


  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const {
    handleEmailFocus,
    handleEmailBlur,
    handlePasswordFocus,
    handlePasswordBlur,
    coverEyes,
    svgRef
  } = useCharacterAnimation(usernameRef, passwordRef, useRef(null), showPassword, password);


  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
    coverEyes(!showPassword);
  };




  // Dentro de LoginPage
  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!username.trim()) {
      errors.username = 'Usuario no puede estar vacío.';
      isValid = false;
    } else if (username.length < 6) {
      errors.username = 'Usuario debe tener un mínimo de 6 caracteres.';
      isValid = false;
    } else if (username.length > 50) {
      errors.username = 'Usuario debe tener un máximo de 50 caracteres.';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Campo contraseña no puede estar vacío.';
      isValid = false;
    } else if (password.length < 4) {
      errors.password = 'Contraseña debe tener un mínimo de 4 caracteres.';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { user } = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
    <div className="container d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="row w-100">
        <div className="col-12 col-sm-8 col-md-6 col-lg-4 mx-auto">

          {/* INICIO Personaje*/}
          <div className="text-center login-character-container" ref={svgRef}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              viewBox="142 30 700 700"
              className="character-svg"
              style={{ height: '100%', width: '100%' }}
            >
              <defs>
                <clipPath id="clippath">
                  <path d="M447.045,389.186h91.374c2.208,0,4,1.792,4,4v15.415c0,10.756-8.733,19.489-19.489,19.489h-60.395c-10.756,0-19.489-8.733-19.489-19.489v-15.415c0-2.208,1.792-4,4-4Z" fill="none" />
                </clipPath>
              </defs>

              {/* CAPA 1: CUERPO (Fondo) */}
              <g id="cuerpo">
                <g>
                  <path d="M267.986,858.564v-281.154c0-44.522,36.222-80.745,80.745-80.745h290.904c44.523,0,80.745,36.222,80.745,80.745v281.154h-452.394Z" fill="#fff" />
                  <path d="M639.635,499.666c42.869,0,77.745,34.876,77.745,77.745v278.154h-446.393v-278.154c0-42.869,34.876-77.745,77.745-77.745h290.904M639.635,493.666h-290.904c-46.251,0-83.745,37.494-83.745,83.745v284.154h458.393v-284.154c0-46.251-37.494-83.745-83.745-83.745h0Z" fill="#2c2c2c" />
                </g>
                <g>
                  <polygon points="492.21 493.666 424.55 493.666 492.21 671.695 559.869 493.666 492.21 493.666" fill="#008cff" />
                  <polygon points="519.696 543.565 492.21 507.198 464.723 543.565 478.466 558.365 470.364 614.213 492.21 671.695 514.055 614.213 505.953 558.365 519.696 543.565" fill="#005691" />
                </g>
                <polygon points="527.66 496.978 492.209 508.572 456.759 496.978 453.446 472.416 530.973 472.416 527.66 496.978" fill="#d88361" />
                <g>
                  <path d="M551.975,605.515h85.702v48.105c0,7.175-5.825,13-13,13h-59.702c-7.175,0-13-5.825-13-13v-48.105h0Z" fill="#dfe8ef" stroke="#2c2c2c" strokeMiterlimit="10" strokeWidth="6" />
                  <line x1="620.833" y1="596.741" x2="620.833" y2="614.29" fill="none" stroke="#2c2c2c" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="8" />
                </g>
                <circle cx="492.209" cy="713.835" r="7.894" fill="#2c2c2c" />
                <circle cx="492.209" cy="762.043" r="7.894" fill="#2c2c2c" />
                <circle cx="492.209" cy="810.25" r="7.894" fill="#2c2c2c" />
              </g>

              {/* CAPA 2: CABEZA */}
              <g id="cabeza">
                <g>
                  <g>
                    <circle cx="333.101" cy="328.358" r="38.151" fill="#d88361" />
                    <path d="M314.653,318.599s19.349,2.262,21.132,25.527" fill="none" stroke="#a5563a" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="10" />
                  </g>
                  <g>
                    <circle cx="651.433" cy="328.358" r="38.151" fill="#d88361" />
                    <path d="M669.881,318.599s-19.349,2.262-21.132,25.527" fill="none" stroke="#a5563a" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="10" />
                  </g>
                  <rect x="336.522" y="148.743" width="311.375" height="324.766" rx="56.128" ry="56.128" fill="#f4a07a" />
                </g>
                <path d="M498.591,283.891c6.269,17.332,23.653,73.31,5.22,85.389-9.697,5.468-21.23-2.683-28.358-8.793-1.054-.938.155-2.625,1.372-1.944,6.552,3.275,17.171,10.004,24.104,6.133,13.634-10.198-.766-64.424-4.531-80.079-.375-1.355,1.647-2.107,2.192-.706h0Z" fill="#c47053" />
                <g clipPath="url(#clippath)">
                  <path d="M447.045,389.186h91.374c2.208,0,4,1.792,4,4v15.415c0,10.756-8.733,19.489-19.489,19.489h-60.395c-10.756,0-19.489-8.733-19.489-19.489v-15.415c0-2.208,1.792-4,4-4Z" fill="#000202" />
                  <ellipse cx="491.346" cy="428.584" rx="30.685" ry="18.043" fill="#f20618" />
                  <rect x="451.949" y="384.535" width="79.782" height="11.277" rx="3.404" ry="3.404" fill="#fdfcff" />
                </g>
                <g>
                  <rect x="330.884" y="141.272" width="20.298" height="197.058" rx="3.872" ry="3.872" fill="#2c2c2c" />
                  <rect x="634.083" y="141.272" width="20.298" height="197.058" rx="3.872" ry="3.872" fill="#2c2c2c" />
                  <path d="M379.497,87.567h283.308c20.362,0,36.894,16.531,36.894,36.894v48.423c0,20.362-16.531,36.894-36.894,36.894h-303.096v-102.423c0-10.921,8.866-19.787,19.787-19.787Z" fill="#2c2c2c" />
                  <path d="M343.146,131.546h39.064v99.747c0,13.331-10.823,24.154-24.154,24.154h-40.569c-5.637,0-10.213-4.576-10.213-10.213v-77.816c0-19.798,16.074-35.872,35.872-35.872Z" fill="#2c2c2c" />
                  <path d="M594.826,169.182h49.406v86.266h-19.576c-16.463,0-29.83-13.366-29.83-29.83v-56.436h0Z" fill="#2c2c2c" />
                </g>
              </g>

              {/* CAPA 3: OJOS (Para el parpadeo y la mirada) */}
              <g className="eyes-group">
                <g id="ojoIzq">
                  <path d="M380.289,282.904s25.09-24.668,66.814-8.598" fill="none" stroke="#2c2c2c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12" />
                  <ellipse cx="418.028" cy="316.805" rx="14.692" ry="18.043" fill="#1c0e0e" />
                </g>
                <g id="ojoDer">
                  <path d="M608.076,282.904s-25.09-24.668-66.814-8.598" fill="none" stroke="#2c2c2c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12" />
                  <ellipse cx="570.338" cy="316.805" rx="14.692" ry="18.043" fill="#1c0e0e" />
                </g>
              </g>

              {/* CAPA 4: BRAZO IZQUIERDO (SUPERIOR - PARA CUBRIR) */}
              <g id="brazoIzq" className="arm-left">
                <g>
                  <path d="M195.694,759.471v105.368c0,4.218-2.922,7.874-7.037,8.803h0c-4.351.982-8.767-1.361-10.392-5.515l-9.892-25.28v45.693c0,7.545-6.116,13.661-13.661,13.661h0c0,7.805-6.327,14.132-14.132,14.132h-23.965c-7.805,0-14.132-6.327-14.132-14.132v-1.884l-2.814-.082c-7.386-.216-13.26-6.266-13.26-13.655v-127.168l109.285.059Z" fill="#f4a07a" stroke="#2c2c2c" strokeLinejoin="round" strokeWidth="7" />
                  <path d="M68.979,378.622h142.73v413.176c0,2.795-2.269,5.064-5.064,5.064H76.15c-3.957,0-7.17-3.213-7.17-7.17v-411.069h0Z" fill="#fff" stroke="#2c2c2c" strokeMiterlimit="10" strokeWidth="8" />
                </g>
              </g>

              {/* CAPA 5: BRAZO DERECHO (La capa más alta) */}
              <g id="brazoDer" className="arm-right">
                <g>
                  <path d="M791.187,759.471v105.368c0,4.218,2.922,7.874,7.037,8.803h0c4.351.982,8.767-1.361,10.392-5.515l9.892-25.28v45.693c0,7.545,6.116,13.661,13.661,13.661h0c0,7.805,6.327,14.132,14.132,14.132h23.965c7.805,0,14.132-6.327,14.132-14.132v-1.884l2.814-.082c7.386-.216,13.26-6.266,13.26-13.655v-127.168s-109.285.059-109.285.059Z" fill="#f4a07a" stroke="#2c2c2c" strokeLinejoin="round" strokeWidth="7" />
                  <path d="M782.341,378.622h130.496c2.795,0,5.064,2.269,5.064,5.064v413.176h-142.73v-411.069c0-3.957,3.213-7.17,7.17-7.17Z" transform="translate(1693.071 1175.484) rotate(-180)" fill="#fff" stroke="#2c2c2c" strokeMiterlimit="10" strokeWidth="8" />
                </g>
              </g>

            </svg>
          </div>
          {/* FIN Personaje*/}

          <div className="card card-form-login shadow-sm" style={{ border: '3px solid #E2ECFF', borderRadius: '15px', fontFamily: 'Roboto', userselect: 'none', padding: '10px 0'}}>
            <div className="card-body p-4">
              <h3 className="text-center mb-4">Iniciar Sesión</h3>
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ fontWeight: '400' }}>
                <div className="mb-2">
                  <label className="form-label">Usuario</label>
                  <input
                    ref={usernameRef}
                    type="text"
                    className="form-control"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="usuario1234"
                    onFocus={handleEmailFocus}
                    onBlur={handleEmailBlur}
                  />
                  {validationErrors.username && (
                    <span className="text-danger" style={{ fontSize: '0.9rem' }}>
                      {validationErrors.username}
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <label className="form-label">Contraseña</label>
                  <div className="input-group">
                    <input
                      ref={passwordRef}
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      onFocus={handlePasswordFocus}
                      onBlur={handlePasswordBlur}
                    />
                    <button
                      className="btn btn-form-verlogin btn-outline-secondary ms-1"
                      type="button"
                      onClick={togglePasswordVisibility}
                      title={showPassword ? 'Ocultar Contraseña' : 'Mostrar Contraseña'}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                    {validationErrors.password && (
                      <span className="text-danger" style={{ fontSize: '0.9rem'}}>
                        {validationErrors.password}
                      </span>
                    )}
                </div>

                <button type="submit" className="btn btn-form-login btn-primary w-50" disabled={loading} style={{ margin: '0px auto', display: 'block', marginTop: '30px' }}>
                  {loading ? 'Ingresando...' : 'Entrar'}
                </button>
              </form>
            </div>
          </div>
          <p className="texto-aviso">
            Acceso restringido. Contacte al administrador principal si no tiene credenciales.
          </p>
        </div>
      </div>
    </div>
  </div>
  );
}

export default LoginPage;