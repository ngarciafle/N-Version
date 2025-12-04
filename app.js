// Funciones necesarias de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect, update, onChildAdded, onChildRemoved, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
let listaPalabras = [];

fetch('./palabras.json')
    .then(res => res.json())
    .then(data => {
        listaPalabras = data;
    });

// ---CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAr08Jub2w6oIkTfRpyiUL0CseYzVP6_p8",
    authDomain: "impostor-game-v1.firebaseapp.com",
    databaseURL: "https://impostor-game-v1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "impostor-game-v1",
    storageBucket: "impostor-game-v1.firebasestorage.app",
    messagingSenderId: "24684641990",
    appId: "1:24684641990:web:cec7d6ddc6b59c1fdda1c7"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Variables del DOM (HTML)
const pantallaLogin = document.getElementById('pantalla-login');
const pantallaSala = document.getElementById('pantalla-sala');
const pantallaJuego = document.getElementById('pantalla-juego');
const btnCrear = document.getElementById('btnCrear');
const nombreInput = document.getElementById('nombreInput');
const carta = document.getElementById('carta');
const tituloCarta = carta.querySelector('h3');
const palabraUI = document.getElementById('palabra');
const btnVotar = document.getElementById('btnVotar');
const pantallaVotacion = document.getElementById('pantalla-votacion');
const pantallaRonda = document.getElementById('pantalla-ronda');
const btnPalabra = document.getElementById('btnPalabra');
let listaPalabrasUsuarios = [];
const contenedorPalabras = document.getElementById('contenedorPalabras');

// FUNCION 1: CREAR SALA
btnCrear.addEventListener('click', () => {
    const nombre = nombreInput.value;
    if (!nombre) return alert("¡Ponte un nombre!");

    const salaId = Math.floor(1000 + Math.random() * 9000);

    const salaRef = ref(db, 'salas/' + salaId);

    set(salaRef, {
        estado: "Esperando",
        jugadores: {
            [nombre]: {
                puntos: 0,
                esLider: true,
                esImpostor: false,
                vota: false
            }
        }
    }).then(() => {
        entrarEnSala(salaId, nombre);
    }).catch((error) => {
        console.error("Error:", error);
        alert("Error al crear sala");
    });
});

// FUNCION 2: UNIRSE A SALA EXISTENTE (Usa la función entrarEnSala solo que valida antes la existencia de la sala y el nombre no repetido)
const btnUnirse = document.getElementById('btnUnirse');
const codigoInput = document.getElementById('codigoInput');

btnUnirse.addEventListener('click', () => {
    const salaId = codigoInput.value.trim();
    const nombre = nombreInput.value.trim();

    if (!nombre || !salaId) return alert("Pon nombre y código");

    const salaRef = ref(db, 'salas/' + salaId);
    const jugadorRef = ref(db, 'salas/' + salaId + '/jugadores/' + nombre);

    get(salaRef).then((salaSnapshot) => {
        if (!salaSnapshot.exists()) {
            alert("❌ La sala " + salaId + " no existe. Pídele el código correcto a tu amigo.");
            return;
        }

        get(jugadorRef).then((jugadorSnapshot) => {
            if (jugadorSnapshot.exists()) {
                alert("⚠️ El nombre '" + nombre + "' ya está en uso en esta sala.");
                return;
            }

            set(jugadorRef, {
                puntos: 0,
                esLider: false
            }).then(() => {
                entrarEnSala(salaId, nombre);
            });
        });

    }).catch((error) => {
        console.error("Error al validar:", error);
    });
});

// FUNCION 3: ENTRAR EN SALA (COMÚN A CREAR Y UNIRSE)
function entrarEnSala(salaId, miNombre) {
    pantallaLogin.classList.add('oculto');
    pantallaSala.classList.remove('oculto');
    document.getElementById('tituloSala').innerText = "Sala: " + salaId;

    const miJugadorRef = ref(db, `salas/${salaId}/jugadores/${miNombre}`);
    onDisconnect(miJugadorRef).remove();

    const jugadoresRef = ref(db, `salas/${salaId}/jugadores`);

    // --- A. GESTIÓN DE LA LISTA Y EL LÍDER (Estado general) ---
    onValue(jugadoresRef, (snapshot) => {
        const datos = snapshot.val();
        const listaUI = document.getElementById('listaJugadores');
        const btnEmpezar = document.getElementById('btnEmpezar');
        const mensajeEstado = document.getElementById('mensajeEstado');

        listaUI.innerHTML = "";

        if (!datos) return;

        // 1. CONVERTIMOS A ARRAY Y ORDENAMOS ALFABÉTICAMENTE
        const jugadoresArray = Object.keys(datos).sort();

        let hayLider = false;
        let soyLider = false;

        // 2. PRIMERA PASADA: PINTAR Y DETECTAR LÍDER
        jugadoresArray.forEach(nombre => {
            const jugador = datos[nombre];
            const li = document.createElement('li');
            li.textContent = (jugador.esLider ? "👑 " : "👤 ") + nombre;

            if (nombre === miNombre) {
                li.style.fontWeight = 'bold';
                li.style.color = '#4CAF50';
            }

            listaUI.appendChild(li);

            if (jugador.esLider) hayLider = true;
            if (jugador.esLider && nombre === miNombre) soyLider = true;
        });

        // 3. LÓGICA DE TRONO VACÍO (HERENCIA)
        if (!hayLider && jugadoresArray.length > 0) {
            if (jugadoresArray[0] === miNombre) {
                console.log("El líder se fue. Reclamando trono...");
                update(miJugadorRef, { esLider: true });
                soyLider = true;
            }
        }

        // 4. ACTUALIZAR BOTÓN
        if (soyLider) {
            btnEmpezar.classList.remove('oculto');
            mensajeEstado.innerText = "👑 Eres el líder. Inicia cuando estéis todos.";
            mensajeEstado.style.color = "green";
        } else {
            btnEmpezar.classList.add('oculto');
            mensajeEstado.innerText = "Esperando al líder...";
            mensajeEstado.style.color = "black";
        }

        const btnSalir = document.getElementById('btnSalir');

        //5. GESTIÓN DE SALIDA DE LA SALA
        btnSalir.onclick = () => {
            remove(miJugadorRef).then(() => {
                get(jugadoresRef).then((snapshot) => {
                    if (!snapshot.exists()) {
                        const salaRef = ref(db, 'salas/' + salaId);
                        remove(salaRef);
                        console.log("Sala vacía eliminada.");
                    }
                });
                location.reload();
            });
        };
        //6. EMPEZAR PARTIDA
        //Falta por poner una manera de empezar la votacion
        //Falta una manera de que cuando empieces todos entren en la partida (Parte C - Sincronización del juego)
        //Aquí unicamente el líder iniciará la partida y asigna roles automáticamente (lo hace cambiando el estado en la db y el resto lo detecta con el listener de la parte C)

        btnEmpezar.onclick = async () => {
            const numeroAzar = Math.floor(Math.random() * listaPalabras.length); //Selecciona índice al azar
            const palabra = listaPalabras[numeroAzar].word; //Selecciona palabra al azar y pista
            const pista = listaPalabras[numeroAzar].hint;
            const numeroImpostores = Math.ceil(jugadoresArray.length / 4); // 1 impostor cada 4 jugadores
            const salaEstadoRef = ref(db, `salas/${salaId}`);
            update(salaEstadoRef, {
                estado: "En Juego",
                palabra: palabra,
                pista: pista
            });
            let impostores = [];

            //Seleccion aleatoria de impostores
            while (impostores.length < numeroImpostores) {
                let numeroImpostor = Math.floor(Math.random() * jugadoresArray.length);
                if (!impostores.includes(numeroImpostor)) {
                    impostores.push(numeroImpostor);
                }
            }
            //Asignacion de roles
            jugadoresArray.forEach((nombre, index) => {
                const jugadorRef = ref(db, `salas/${salaId}/jugadores/${nombre}`);
                const esImpostor = impostores.includes(index);

                update(jugadorRef, {
                    esImpostor: esImpostor
                });

            });
            await esperar(15000);
            const jugadorAzar = Math.floor(Math.random() * jugadoresArray.length); //empieza la ronda un jugador al azar
            update(salaEstadoRef, {
                estado: "RondaPalabras",
                turno: jugadoresArray[jugadorAzar]
            });
        };
        // Mostrar palabra al hacer click en la carta
        carta.onclick = () => {
            tituloCarta.classList.toggle('atras');
            palabraUI.classList.toggle('atras');
        };

        //7. BOTÓN VOTAR
        /* btnVotar.onclick = () => {
             //Si todo el mundo quiere votar,   **seria mejor implementar que el 50% quiera votar o 70% ??
             const salaEstadoRef = ref(db, `salas/${salaId}`);
             const jugadorRef = ref(db, `salas/${salaId}/jugadores/${miNombre}`);
             update(jugadorRef, {
                 vota: true
             });
             if () {
                 update(salaEstadoRef, {
                     estado: "Votando" // ** metemos como atributo quien el impostor??
                 });
 
             } else {
 
             }
         }; */

         //8. BOTÓN MANDAR PALABRA EN RONDA
         btnPalabra.onclick = () => {
            get(ref(db, `salas/${salaId}`)).then((snapshot) => { //Obtenemos datos sala
                const datosSala = snapshot.val();
                if (datosSala.turno === miNombre) {
                    const palabraRonda = document.getElementById('palabraRonda').value.trim();
                    if (!palabraRonda) {
                        return mostrarNotificacion("¡Escribe una palabra!") 
                    } else {
                        if(palabraRonda.toLowerCase() == datosSala.palabra.toLowerCase()) {
                            update(ref(db, `salas/${salaId}`), { estado: "Finalizada" });
                        } else {
                            push(ref(db, `salas/${salaId}/palabrasRonda`), {
                                jugador: miNombre,
                                palabra: palabraRonda
                            });
                            listaPalabrasUsuarios.push(miNombre + " ha dicho " + palabraRonda);
                            update(ref(db, `salas/${salaId}`), {
                                turno: jugadoresArray[(jugadoresArray.indexOf(miNombre) + 1) % jugadoresArray.length]
                            })
                        }
                    }
                } else {
                    mostrarNotificacion("Culebron no mires el codigo.");
                }
            });


         };
    });

    // --- B. NOTIFICACIONES DE LA SALA (Entradas y Salidas) (Usando la función mostrarNotificacion) ---
    onChildAdded(jugadoresRef, (snapshot) => {
        if (snapshot.key !== miNombre) {
            mostrarNotificacion(`👋 ${snapshot.key} se ha unido.`);
        }
    });

    onChildRemoved(jugadoresRef, (snapshot) => {
        mostrarNotificacion(`❌ ${snapshot.key} ha salido.`);
    });

    // --- C. SINCRONIZACIÓN DEL JUEGO ---
    const salaRef = ref(db, `salas/${salaId}`);

    onValue(salaRef, (snapshot) => {
        const datosSala = snapshot.val();
        if (!datosSala) return; // Sala borrada

        // Variables para la lógica de votación
        const btnVotar = document.getElementById('btnVotar');
        const soyLider = (datosSala.jugadores[miNombre].esLider === true);
        const totalJugadores = Object.keys(datosSala.jugadores).length;

        // Calculamos cuántos han votado (si existe el objeto, contamos las claves)
        const votosActuales = datosSala.votos ? Object.keys(datosSala.votos).length : 0;

        document.getElementById('jugadoresVotadores').innerText = `${Object.keys(datosSala.jugadores).length}`; //ajustar txt para total jugadores

        // --- ESTADO 1: EN JUEGO ---
        if (datosSala.estado === "En Juego") {
            pantallaSala.classList.add('oculto');
            pantallaVotacion.classList.add('oculto');
            pantallaJuego.classList.remove('oculto');

            const miJugador = datosSala.jugadores[miNombre];
            const palabraUI = document.getElementById('palabra');

            // 1. Mostrar roles
            palabraUI.classList.add('oculto');
            if (miJugador.esImpostor) {
                palabraUI.innerText = `😈 Eres el Impostor\nPista: ${datosSala.pista}`;
                palabraUI.classList.remove('oculto');
                palabraUI.style.color = "red";
            } else {
                palabraUI.innerText = `La palabra es:\n${datosSala.palabra}`;
                palabraUI.classList.remove('oculto');
                palabraUI.style.color = "black";
            }

        }
        // --- ESTADO 2: RONDA DE PALABRAS ---
        else if (datosSala.estado === "RondaPalabras") { //Hay que integrar un chat ** o poner palabras y que se muestren al resto de la sala
            pantallaRonda.classList.remove('oculto');
            pantallaJuego.classList.add('oculto');
            contenedorPalabras.classList.remove('oculto');

            // 2. Configuración del Botón de Votar
            btnVotar.classList.remove('oculto');

            if (datosSala.turno === miNombre) {
                // ES MI TURNO
                document.getElementById('turnoPalabra').classList.remove('atras');
                document.querySelector('.tituloRonda').innerHTML = `✍Es tu turno!`;

            } else {
                // NO ES MI TURNO
                document.getElementById('turnoPalabra').classList.add('atras');
                document.querySelector('.tituloRonda').innerHTML = `Es el turno de ${datosSala.turno}`;
            }

            if (soyLider) {
                // LÍDER: Ve botón de acción
                btnVotar.innerHTML = "📢 Comenzar Votación";
                btnVotar.disabled = false;
                btnVotar.style.opacity = "1";
                btnVotar.style.cursor = "pointer";
    
                // Al hacer clic, se cambia el estado global
                btnVotar.onclick = () => {
                    update(ref(db, `salas/${salaId}`), { estado: "Votando" });
                };
            } else {
                // CIVILES: Ven el contador en espera
                btnVotar.innerHTML = `Votos: 0/${totalJugadores}`;
                btnVotar.disabled = true;
                btnVotar.style.opacity = "0.5"; // Efecto visual de apagado
                btnVotar.style.cursor = "not-allowed";
                btnVotar.title = "Espera a que el líder inicie la votación";
            }
        }
        // --- ESTADO 3: VOTANDO ---
        else if (datosSala.estado === "Votando") {
            // ¿Ocultamos el juego y mostramos pantalla votación? Ahora mismo siempre que entramos en este estado ocultamos todo y mostramos votación, si lo quieres cambiar dímelo

            pantallaRonda.classList.add('oculto');
            pantallaVotacion.classList.remove('oculto');
            // Aseguramos que la pantalla de resultado esté oculta por si volvemos a jugar
            document.getElementById('pantalla-resultado').classList.add('oculto');

            // 1. ACTUALIZAR EL CONTADOR
            const tituloVotos = document.getElementById('titulo-votos');
            if (tituloVotos) {
                tituloVotos.innerText = `Votos: ${votosActuales}/${totalJugadores}`;
            }

            // 2. CREAR LOS BOTONES
            const listaVotacion = document.getElementById('lista-votacion-ul');

            if (!listaVotacion || listaVotacion.children.length === 0) {
                pantallaVotacion.innerHTML = `
                    <h2>¡Es hora de votar!</h2>
                    <h3 id="titulo-votos">Votos: ${votosActuales}/${totalJugadores}</h3>
                    <ul id="lista-votacion-ul" style="list-style:none; padding:0;"></ul>
                `;

                const ul = document.getElementById('lista-votacion-ul');

                Object.keys(datosSala.jugadores).forEach(nombre => {
                    // FIX: No permitir votarse a uno mismo
                    if (nombre !== miNombre) {
                        const item = document.createElement('li');
                        item.className = "jugador-voto-item";
                        const botonVotar = document.createElement('button');
                        botonVotar.textContent = `Votar por ${nombre}`;
                        botonVotar.className = "boton";

                        botonVotar.onclick = () => {
                            // Desactivar botones tras votar para evitar spam
                            const botones = ul.querySelectorAll('button');
                            botones.forEach(btn => {
                                btn.disabled = true;
                                btn.style.opacity = "0.5";
                            });

                            const votoRef = ref(db, `salas/${salaId}/votos/${miNombre}`);
                            set(votoRef, nombre).then(() => {
                                mostrarNotificacion(`Has votado a ${nombre} 🗳️`);
                            });
                        };

                        item.appendChild(botonVotar);
                        ul.appendChild(item);
                    }
                });
            }

            // 3. LÓGICA DEL LÍDER (EL JUEZ)
            // Si todos han votado, el líder calcula el resultado
            if (soyLider && votosActuales === totalJugadores) {
                setTimeout(() => {
                    calcularResultado(datosSala.votos);
                }, 1000);
            }
        }
        
        // ... (bloque votando) ...

        // --- ESTADO 4: RESULTADO FINAL ---
        else if (datosSala.estado === "Resultado") {
            pantallaVotacion.classList.add('oculto');
            pantallaJuego.classList.add('oculto');
            const pantallaRes = document.getElementById('pantalla-resultado');
            pantallaRes.classList.remove('oculto');

            const nombreExpulsado = document.getElementById('nombreExpulsado');
            const rolExpulsado = document.getElementById('rolExpulsado');
            const expulsado = datosSala.expulsado;

            nombreExpulsado.innerText = expulsado;

            // Mostrar si era impostor o no
            // Buscamos en la lista de jugadores qué rol tenía el expulsado
            const datosExpulsado = datosSala.jugadores[expulsado];
            if (datosExpulsado && datosExpulsado.esImpostor) {
                rolExpulsado.innerText = "😈 ¡Era el IMPOSTOR!";
                rolExpulsado.style.color = "green"; // Ganaron los civiles
            } else {
                rolExpulsado.innerText = "😇 Era un inocente...";
                rolExpulsado.style.color = "red"; // Ganó el impostor
            }

            // Lógica para volver a jugar (Solo líder)
            const btnReiniciar = document.getElementById('btnReiniciar');
            if (soyLider) {
                btnReiniciar.classList.remove('oculto');
                btnReiniciar.onclick = () => {
                    // Reseteamos la sala para jugar otra vez
                    // Borramos votos, roles y volvemos a "Esperando"
                    // NOTA: Es mejor hacer un update selectivo o setear valores por defecto
                    const updates = {};
                    updates[`salas/${salaId}/estado`] = "Esperando";
                    updates[`salas/${salaId}/votos`] = null; // Borrar votos
                    updates[`salas/${salaId}/expulsado`] = null;

                    // También habría que resetear los roles de jugadores, 
                    // pero eso se hace al iniciar partida de nuevo.

                    update(ref(db), updates);
                };
            } else {
                btnReiniciar.classList.add('oculto');
            }
        }

        // --- ESTADO 5: VUELTA AL LOBBY (Reset) ---
        else if (datosSala.estado === "Esperando") {
            pantallaLogin.classList.add('oculto');

            const pantallaRes = document.getElementById('pantalla-resultado');
            if (pantallaRes) pantallaRes.classList.add('oculto');

            pantallaSala.classList.remove('oculto');

            const pistaUI = document.getElementById('pista');
            if (pistaUI) pistaUI.classList.add('oculto');
            palabraUI.classList.add('oculto');
        } 
        
        // --- ESTADO 6: PARTIDA FINALIZADA (Reset) ---
        // else if (datosSala.estado === "Finalizada") { // si has ganado o perdido diferentes mensajes
        //     pantallaRonda.classList.add('oculto');
        //     pantallaVotacion.classList.add('oculto');
        //     if (miNombre.esImpostor) {

        //     }
        // }

        // --- GESTION HISTORIAL PALABRAS --- **** ????? HAY QUE IMPLEMENTAR LA FUNCION AUXILIAR RELLENAR CONTENEDOR PALABRAS
        const historialRef = ref(db, `salas/${salaId}/palabrasRonda`);
    
        onChildAdded(historialRef, (snapshot) => {        
        if (contenedorPalabras) {
            
            // Color diferente si soy yo
            if (dato.jugador === miNombre) {
                p.style.color = "#4CAF50"; 
            }            
            contenedorPalabras.scrollTop = contenedorPalabras.scrollHeight; // Auto-scroll
        }
    });
    });
    
    // FUNCION AUXILIAR: CALCULAR RESULTADO DE VOTACIÓN
    function calcularResultado(votos) {
        const recuento = {};

        // Contamos votos
        for (let votante in votos) {
            const acusado = votos[votante];
            recuento[acusado] = (recuento[acusado] || 0) + 1;
        }

        // Buscamos al más votado
        let expulsado = "Nadie";
        let maxVotos = -1;

        for (let nombre in recuento) {
            if (recuento[nombre] > maxVotos) {
                maxVotos = recuento[nombre];
                expulsado = nombre;
            }
        }

        // OJO: Aquí podríamos añadir lógica de empates (si maxVotos se repite), 
        // pero de momento expulsamos al primero que encontremos con el máximo.

        // Actualizamos la base de datos para que TODOS vean el resultado
        update(ref(db, `salas/${salaId}`), {
            estado: "Resultado",
            expulsado: expulsado
        });
    }
}

// FUNCION AUXILIAR: MOSTRAR NOTIFICACIONES TOAST
function mostrarNotificacion(mensaje) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5500);
}

//FUNCION AUXILIAR: ESPERAR SEGUNDOS
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//FUNCIONA AUXILIAR: CREAR CONTENEDOR DE PALABRAS  

function actualizarContenedorPalabras() {
    for (i in listaPalabrasUsuarios) {
        contenedorPalabras.innerHTML += `<p>${listaPalabrasUsuarios[i].jugador} ha dicho ${listaPalabrasUsuarios[i].palabra}</p>`;
    }
}