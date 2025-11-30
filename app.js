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
const pistaUI = document.getElementById('pista');
const palabraUI = document.getElementById('palabra');

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
                esImpostor: false
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

        btnEmpezar.onclick = () => {
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

        };
        // Mostrar palabra al hacer click en la carta
        carta.onclick = async () => {
            tituloCarta.classList.add('atras');
            palabraUI.classList.toggle('atras');
            pistaUI.classList.toggle('atras');
            await esperar(5000);
            tituloCarta.classList.toggle('atras');
            palabraUI.classList.add('atras');
            pistaUI.classList.add('atras');

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

        // Si el estado cambia a "En Juego", TODOS entramos
        if (datosSala.estado === "En Juego") {
            pantallaSala.classList.add('oculto');
            pantallaJuego.classList.remove('oculto');

            const miJugador = datosSala.jugadores[miNombre];

            const palabraUI = document.getElementById('palabra');
            const pistaUI = document.getElementById('pista');

            palabraUI.classList.add('oculto');
            pistaUI.classList.add('oculto');
            // Mostrar palabra o pista según el rol del jugador obtenido de la base de datos
            if (miJugador.esImpostor) {
                pistaUI.innerText = `😈 Eres el Impostor\nPista: ${datosSala.pista}`;
                pistaUI.classList.remove('oculto');
                pistaUI.style.color = "red";
            } else {
                palabraUI.innerText = `La palabra es:\n${datosSala.palabra}`;
                palabraUI.classList.remove('oculto');
                palabraUI.style.color = "black";
            }
        }
        // Si quisiéramos volver al lobby, podríamos poner un 'else if' aquí (que de hecho lo deberíamos hacer)
    });
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