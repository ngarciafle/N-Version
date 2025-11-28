// Importamos las funciones necesarias de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect, update, onChildAdded, onChildRemoved, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAr08Jub2w6oIkTfRpyiUL0CseYzVP6_p8",
    authDomain: "impostor-game-v1.firebaseapp.com",
    databaseURL: "https://impostor-game-v1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "impostor-game-v1",
    storageBucket: "impostor-game-v1.firebasestorage.app",
    messagingSenderId: "24684641990",
    appId: "1:24684641990:web:cec7d6ddc6b59c1fdda1c7"
};
// ----------------------------------------------

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Variables del DOM (HTML)
const pantallaLogin = document.getElementById('pantalla-login');
const pantallaSala = document.getElementById('pantalla-sala');
const btnCrear = document.getElementById('btnCrear');
const nombreInput = document.getElementById('nombreInput');

// FUNCION 1: CREAR SALA
btnCrear.addEventListener('click', () => {
    const nombre = nombreInput.value;
    if (!nombre) return alert("¡Ponte un nombre!");

    // Generar ID aleatorio para la sala (ej: 4582)
    const salaId = Math.floor(1000 + Math.random() * 9000);

    // Referencia a la base de datos: salas/4582
    const salaRef = ref(db, 'salas/' + salaId);

    // Escribir en la base de datos (set)
    set(salaRef, {
        estado: "Esperando",
        jugadores: {
            [nombre]: { // Usamos el nombre como clave por simplicidad ahora
                puntos: 0,
                esLider: true
            }
        }
    }).then(() => {
        // Si se guarda bien, entramos a la sala
        entrarEnSala(salaId, nombre);
    }).catch((error) => {
        console.error("Error:", error);
        alert("Error al crear sala");
    });
});

// FUNCION 2: UNIRSE A SALA
const btnUnirse = document.getElementById('btnUnirse');
const codigoInput = document.getElementById('codigoInput');

btnUnirse.addEventListener('click', () => {
    const salaId = codigoInput.value.trim(); // .trim() quita espacios accidentales
    const nombre = nombreInput.value.trim();

    if (!nombre || !salaId) return alert("Pon nombre y código");

    const salaRef = ref(db, 'salas/' + salaId);
    const jugadorRef = ref(db, 'salas/' + salaId + '/jugadores/' + nombre);

    // 1. VALIDACIÓN DE SALA (¿Existe la casa?)
    get(salaRef).then((salaSnapshot) => {
        if (!salaSnapshot.exists()) {
            alert("❌ La sala " + salaId + " no existe. Pídele el código correcto a tu amigo.");
            return; // ¡IMPORTANTE! Aquí cortamos la ejecución
        }

        // 2. VALIDACIÓN DE USUARIO (¿Está ocupada la silla?)
        get(jugadorRef).then((jugadorSnapshot) => {
            if (jugadorSnapshot.exists()) {
                alert("⚠️ El nombre '" + nombre + "' ya está en uso en esta sala.");
                return;
            }

            // 3. SI TODO ESTÁ BIEN, ENTRAMOS
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
    // Autodestrucción al salir
    onDisconnect(miJugadorRef).remove();

    const jugadoresRef = ref(db, `salas/${salaId}/jugadores`);

    // --- A. GESTIÓN DE LA LISTA Y EL LÍDER (Estado general) ---
    onValue(jugadoresRef, (snapshot) => {
        const datos = snapshot.val();
        const listaUI = document.getElementById('listaJugadores');
        const btnEmpezar = document.getElementById('btnEmpezar');
        const mensajeEstado = document.getElementById('mensajeEstado');

        listaUI.innerHTML = "";

        if (!datos) return; // Si no hay nadie

        // 1. CONVERTIMOS A ARRAY Y ORDENAMOS ALFABÉTICAMENTE
        // Esto evita peleas: todos verán la lista en el mismo orden
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
                li.style.color = '#4CAF50'; // Te pinto en verde para que te reconozcas
            }

            listaUI.appendChild(li);

            if (jugador.esLider) hayLider = true;
            if (jugador.esLider && nombre === miNombre) soyLider = true;
        });

        // 3. LÓGICA DE TRONO VACÍO (HERENCIA)
        if (!hayLider && jugadoresArray.length > 0) {
            // Si soy el primero de la lista ordenada, reclamo el trono
            if (jugadoresArray[0] === miNombre) {
                console.log("El líder se fue. Reclamando trono...");
                // Actualizo en DB
                update(miJugadorRef, { esLider: true });
                // TRUCO: Fuerzo visualmente que soy líder AHORA MISMO para evitar el lag
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
        // Al pulsar SALIR manualmente
        btnSalir.onclick = () => {
            // 1. Nos borramos a nosotros mismos
            remove(miJugadorRef).then(() => {
                // 2. Comprobamos si queda alguien más
                get(jugadoresRef).then((snapshot) => {
                    if (!snapshot.exists()) {
                        // SI NO QUEDA NADIE (snapshot vacío), borramos la sala entera
                        const salaRef = ref(db, 'salas/' + salaId);
                        remove(salaRef);
                        console.log("Sala vacía eliminada.");
                    }
                });
                // 3. Reseteamos la UI (volvemos al login)
                location.reload();
            });
        };
    });

    // --- B. NOTIFICACIONES (Entradas y Salidas) ---
    // Alguien nuevo entra (o yo mismo al cargar)
    onChildAdded(jugadoresRef, (snapshot) => {
        // Solo notificamos si NO soy yo mismo (para no spamear al entrar)
        if (snapshot.key !== miNombre) {
            mostrarNotificacion(`👋 ${snapshot.key} se ha unido.`);
        }
    });

    // Alguien se va
    onChildRemoved(jugadoresRef, (snapshot) => {
        mostrarNotificacion(`❌ ${snapshot.key} ha salido.`);
    });
}

function mostrarNotificacion(mensaje) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    container.appendChild(toast);

    // Eliminar el elemento del DOM cuando termine la animación (3s)
    setTimeout(() => {
        toast.remove();
    }, 5500);
}