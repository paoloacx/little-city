# Ciudad pequeña

Un diorama de pueblo dibujado a mano, en el navegador: colocas bloques en una isla y cada uno se
convierte en algo distinto según sus vecinos y su altura, hasta cinco pisos. Es un MVP propio,
inspirado en la mecánica de [Little City](https://littlecity.io) de Derek Yao, sin usar su código ni
su arte: **62 formas** distintas, **52 hallazgos**, bloques que se desbloquean jugando y cuatro islas
distintas.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # comprueba tipos y genera dist/
npm run preview  # sirve dist/
```

## Cómo se juega

- Elige un bloque y toca una casilla. **Vuelve a tocarla y sube un piso, hasta cinco.** Nada se
  destruye al insistir: para quitar algo está **Borrar**. El panel lleva la **cuenta de clics**.
- **Deshacer** (`Ctrl`+`Z`) vuelve atrás hasta cuarenta veces; **Pincel** (`B`) pinta arrastrando, y
  con **clic derecho** una casilla sube de golpe a cinco alturas.
- La altura cambia lo que sale: una casa pasa por **casa alta, casona, casa de vecindad y palacio**;
  una torre, por **campanario, atalaya, aguja y torre maestra**; un **árbol crece de verdad en cada
  clic** (tronco, ramas y copa), hasta el roble; un **jardín**, por parque, invernadero, laberinto y
  arboreto; una **muralla**, por muralla, torreón, fortaleza y alcázar.
- Los bloques se ganan: **Campo** con 2 hallazgos, **Muelle** con 4, **Molino** con 6, **Jardín** con
  10 y **Muralla** con 16. La paleta enseña el candado y lo que falta; al llegar, avisa.
- Los vecinos también mandan, y cambian en cuanto cambias una altura: la primera regla que encaja
  decide lo que se dibuja. Además, **una casa pegada a algo mucho más alto gana un piso** (sin
  romperse): el pueblo crece hacia dentro, no se pisa.
- Arrastra para girar la isla; rueda o pellizco para acercarte.
- Atajos: `1`–`9` y `0` eligen bloque, `B` el pincel, `E` borra, `Ctrl`+`Z` deshace.
- **Crecer** genera un pueblo nuevo en otra isla, y cada isla es distinta: **prado**, **bosque**,
  **dunas** o **roquedo**, con sus flores, setas, conchas o peñascos. **Vaciar** deja la isla en
  blanco.
- **Compartir** copia un enlace con el pueblo dentro (el estado va en el `#` de la URL, sin servidor);
  **Postal** descarga el diorama en PNG; **Guía** lista los 52 hallazgos; **Pueblos** guarda tres
  partidas en el navegador para volver a ellas; **Foto** esconde la interfaz (Esc sale); **Sonido**
  enciende el viento y las gaviotas; **Ciclo** pone el día y la noche en marcha; **Estación** da la
  vuelta al año y **Lugar real** dibuja un barrio de OpenStreetMap en el tablero.
- Al entrar por primera vez sale una tarjeta con las cuatro reglas del juego, y no vuelve a salir.
- Caminos y muelles se pueden poner **sobre el agua**: un camino sobre el agua es un puente.
- El pueblo se guarda solo en `localStorage` y se recupera al volver.

## Las cinco alturas

Cada clic en la misma casilla sube un piso, y el edificio cambia de forma. Lo mismo con los árboles.

| Clics | Casa | Torre | Árbol | Jardín | Muralla |
|---|---|---|---|---|---|
| 1 | Casa | Torre | Árbol | Jardín | Tapia |
| 2 | Casa alta | Campanario | Árbol (más grande) | Parque | Muralla |
| 3 | Casona | Atalaya | Roble | Invernadero | Torreón |
| 4 | Casa de vecindad | Aguja | Roble (más grande) | Laberinto | Fortaleza |
| 5 | Palacio | Torre maestra | Roble con columpio | Arboreto | Alcázar |

Y estas son las mezclas que no dependen de la altura:

| Si juntas | Sale |
|---|---|
| Jardín junto a la plaza | Jardín de la plaza, con fuente |
| Jardín en la orilla | Jardín de agua, con nenúfares y embarcadero |
| Muralla de 2–3 clics junto a una torre | Puerta de la muralla, con rastrillo |
| Campo junto a un jardín | Viñedo, con parras y barricas |
| Casa entre dos campos | Cuadra, con caballo y forraje |

El **muelle** es un embarcadero de verdad: tablones separados sobre largueros, postes hincados en el
agua con sus anillos de cuerda, norayes, escala, barandilla y farol. Con dos clics gana la cabeza en
T donde atracan los botes, con cajas y un barril; con tres, una grúa con polea y caja colgando. El
**muelle de piedra** son losas grandes con contrafuerte, anillas de amarre, escalones al agua y un
barril.

Y lo que pasa alrededor:

- Si el vecino más alto está **tres o más niveles por encima**, la casilla se dibuja con un piso de
  más (tope: cinco). Una casa de un piso junto a una torre de cinco sale con dos.
- Los roles se recalculan al momento: una torre sola es una torre; con dos torres al lado, castillo;
  y si alguna de ellas llega al cuarto piso, ciudadela. Subir una altura puede convertir también las
  casillas de alrededor, sin que nada se pierda.
- La guía muestra los hallazgos que ya has visto y los que faltan en gris.

## Los 52 hallazgos

Los edificios se pueden girar: con el botón **Girar** o la tecla **R**, sobre el que esté bajo el
puntero o sobre el último que pusiste. Un cuarto de vuelta cada vez, y el giro se guarda con el
pueblo (también en los enlaces de compartir).

Las murallas se unen solas: cada pieza mira a sus cuatro vecinos y saca un brazo hacia los que son
muralla, así que una hilera se convierte en una cerca continua, la esquina gira y el torreón se
levanta donde toca. Una pieza suelta se dibuja como un tramo corto con su puerta, y esa sí se puede
girar a mano. La tapia, el adarve, el torreón, la fortaleza, el alcázar y la puerta de la muralla
comparten altura y ejes para que todo encaje.

Cada casilla se resuelve a partir de sus vecinos y de sus pisos. Manda la primera regla que encaja:

| Regla | Se vuelve | Cuándo |
|---|---|---|
| R-G06 | Jardín de agua | Un jardín en la orilla, con estanque, nenúfares y embarcadero |
| R-G05 | Jardín de la plaza | Un jardín junto a la plaza, con fuente y setos recortados |
| R-G04 | Arboreto | Un jardín de cinco clics, con árboles de todo el mundo |
| R-G03 | Laberinto | Un jardín de cuatro clics: setos en laberinto |
| R-G02 | Invernadero | Un jardín de tres clics, con cristaleras |
| R-G01 | Parque | Un jardín de dos clics: árboles, bancos y un estanque |
| R-W04 | Alcázar | Una muralla de cinco clics: el alcázar del pueblo |
| R-W03 | Fortaleza | Una muralla de cuatro clics, con dos torres y puerta |
| R-W02 | Torreón | Una muralla de tres clics, con torre redonda |
| R-W05 | Puerta de la muralla | Una muralla de dos o tres clics junto a una torre |
| R-W01 | Muralla | Una tapia de dos clics, con adarve y almenas |
| R-M04 | Ciudadela | Un castillo con una torre de cuatro pisos o más |
| R-M03 | Castillo | Tres torres juntas. Si las subes, crece |
| R-L01 | Faro | Una torre en la orilla. Más alta, si la subes |
| R-T04 | Observatorio | Una torre junto a la plaza |
| R-T05 | Palomar | Una torre entre dos árboles |
| R-T03 | Torre del reloj | Una torre con dos calles y una casa cerca |
| R-T09 | Torre maestra | Una torre de cinco pisos |
| R-T08 | Aguja | Una torre de cuatro pisos junto a las casas |
| R-T07 | Atalaya | Una torre de tres pisos |
| R-T02 | Campanario | Una torre con un piso más |
| R-C02 | Catedral | Una casa de dos o tres pisos junto a una torre |
| R-H01 | Capilla | Una casa pegada a una torre |
| R-C01 | Ayuntamiento | Una casa alta junto a la plaza, con una calle |
| R-H06 | Posada | Una casa en el rincón de la plaza, con dos calles |
| R-H22 | Biblioteca | Una casa alta junto a la plaza, con casas alrededor |
| R-H21 | Escuela | Una casa junto a la plaza, con dos casas alrededor |
| R-C03 | Palacio | Una casa de cinco pisos, con su cimborrio |
| R-H23 | Casa de vecindad | Una casa de cuatro pisos |
| R-H09 | Casona | Una casa de tres pisos (tres clics en la casilla) |
| R-H10 | Casa alta | Una casa con un piso más (dos clics en la casilla) |
| R-H16 | Molino de agua | Un molino junto al agua |
| R-H17 | Almacén | Una casa entre dos embarcaderos |
| R-H05 | Casa de botes | Una casa junto a un embarcadero |
| R-H19 | Herrería | Una casa junto a un campo y un camino |
| R-H07 | Tienda | Una casa abierta a dos calles |
| R-S01 | Puesto de mercado | Una casa entre la plaza y el camino |
| R-H24 | Cuadra | Una casa entre dos campos, con caballos |
| R-H18 | Granero | Una casa junto a un campo |
| R-H15 | Casa de campo | Una casa entre dos o más árboles |
| R-B01 | Puente | Un camino puesto sobre el agua |
| R-D01 | Muelle de piedra | Un camino que toca el agua |
| R-M11 | Teatro | Una plaza junto a una torre |
| R-M12 | Templete | Una plaza entre tres árboles o más |
| R-F01 | Plaza con fuente | Cuatro plazas juntas |
| R-P02 | Roble | El gran roble: sigue creciendo en el cuarto y el quinto clic |
| R-P01 | Huerto | Cuatro árboles juntos |
| R-F02 | Viñedo | Un campo junto a un jardín, con sus parras |

Los bloques base (casa, torre, molino, calle, plaza, árbol, embarcadero, campo, jardín y tapia) no
cuentan como hallazgo, pero sí cambian de altura. Un jardín al lado de una casa hace que la casa gane
un piso, y una muralla junta convierte un rincón en fortaleza: todo se interconecta.

## Lo que se mueve

- Las casas tienen oficio: la **casa solariega** crece junto a un jardín (con verja, parra y
  cipreses), la **casa de pescadores** se queda en la orilla con la barca del revés y las redes
  tendidas, la **casa torre** se arrima a dos torres y saca su escalera de caracol, y la **casa del
  molinero** vive junto al molino, con polea y sacos de harina. Con la casa, la casa alta, la casona,
  la vecindad y el palacio son nueve casas distintas.
- La gente pasea por las calles y cruza la plaza con las piernas y los brazos articulados, y sale
  también de las casas que dan a la calle. En la plaza hay gente parada, meciéndose, y algunos niños.
  Van a escala de puerta y con cuerpo entero: piernas, zapatos, abrigo con fajín, manos, cuello, cara
  con ojos, nariz y boca, pelo y sombrero (gorra, pamela de paja, capucha, chistera o nada). Muchos
  llevan delantal, zurrón o cesta. Cada uno proyecta una sombra suave en el suelo, y la gente parada
  se coloca en el borde de la plaza para no meterse dentro del quiosco ni de la fuente.
- **Perros** que trotan de acá para allá moviendo la cola, y un **globo aerostático** que da vueltas
  al pueblo, subiendo y bajando con la brisa.
- **Gatos** que se cruzan por las calles, con la cola levantada y las patas moviéndose; **palomas**
  que picotean en la plaza y en el muelle.
- Los veleros y los botes de remos navegan frente a la costa dejando estelas que se abren.
- Las gaviotas dan vueltas sobre los tejados, baten las alas y de vez en cuando se lanzan en picado.
- Sale humo de las chimeneas, y vapor del molino de agua.
- **Día y noche** cada 3,5 minutos: el papel se vuelve azul, la tinta pesa más y se encienden las
  ventanas, los faroles y la fragua. Con `?hora=0.7` arranca de noche; con el botón **Ciclo** se
  puede dejar siempre de día.

## Las cuatro estaciones

El botón **Estación** da la vuelta al año, y con él cambia el pueblo entero sin perder nada de lo que
has construido:

| | Árboles | Suelo | Tiempo |
|---|---|---|---|
| Primavera | verdes claros, en flor | verde fresco | pétalos que caen |
| Verano | verdes plenos | verde seco y dorado | nada: cielo limpio |
| Otoño | cobre, ámbar y ocre | rastrojo | hojas que caen |
| Invierno | desnudos, con la copa de nieve | casi blanco | nieve |

Cada estación es una tabla en `src/season.ts` con tres tonos de hoja, tres de césped, dos de cosecha y
un color de partícula. Los árboles, los setos, las huertas y los campos leen esos tonos; el césped de
la isla se mezcla hacia el color de la estación; y una sola nube de puntos —`weatherMaterial`— hace la
nieve, los pétalos o las hojas con una llamada de dibujo. En invierno las flores casi no salen.

Se guarda en el navegador y se puede fijar en el enlace con `?estacion=otono`, para mandar un pueblo
en otoño. La primera visita entra en la estación del mes.

## Cómo está montado

| Archivo | Qué hace |
|---|---|
| `src/grid.ts` | rejilla, isla procedural (semilla), bloques con nivel, guardado en `localStorage` |
| `src/rules.ts` | hechos de cada casilla (vecinos, agua, nivel, altura de alrededor) y 52 reglas ordenadas |
| `src/grow.ts` | el generador de "crecer un pueblo": plaza, calles, callejón, castillo, granja, puerto |
| `src/geo.ts` | acumula primitivas en una geometría con color por vértice y recoge las luces |
| `src/buildings.ts` | los 62 roles en 3D: palacios, castillos, invernaderos, viñedos, cuadras, muelles, árboles que crecen |
| `src/materials.ts` | tres tonos planos (sin rayado), agua con oleaje suave, humo y luces; `uDusk` mueve todo al atardecer |
| `src/life.ts` | gente articulada, gatos, perros, palomas, globo aerostático, barcos con estela, gaviotas, humo, tiempo |
| `src/season.ts` | las cuatro estaciones: tonos de hoja, césped y cosecha, y qué cae del cielo |
| `src/place.ts` | un barrio de OpenStreetMap: buscar el sitio, pedir el mapa y decidir cada casilla |
| `src/placeui.ts` | la ventana de "Lugar real": dirección, tamaño, ubicación y resultados |
| `src/share.ts` | el pueblo en un enlace (`#p=semilla.xzkN…`), con altura y giro de cada bloque; lo valida al cargar |
| `src/scene.ts` | cámara, isla con su bioma y sus hierbas, agua, sombras, reconstrucción, ciclo de luz y postal |
| `src/guide.ts` | la guía de hallazgos |
| `src/intro.ts` | la tarjeta de bienvenida, que se muestra una sola vez |
| `src/saves.ts` | tres pueblos guardados en `localStorage`, con su fecha y sus hallazgos |
| `src/audio.ts` | viento, agua y gaviotas con WebAudio: sin archivos de sonido |
| `src/main.ts` | paleta con candados, puntero, pincel, deshacer, alturas, panel, avisos |

### Notas que costaron encontrar

- Las murallas y las casas nuevas comparten helpers: `wallArm`, `wallPier`, `wallStub` y `wallRun`
  dibujan los brazos según la máscara de vecinos (`LINK_N`, `LINK_E`, `LINK_S`, `LINK_W`), y los
  remates son de hierro fino (`finial`, `chapelCross`).
- El contorno es un *inverted hull*: la misma geometría en `BackSide`, empujada por la normal con un
  ruido. El trazo es fino (0,008 de mundo) a propósito: con un hull grueso las ventanas y las puertas
  desaparecían bajo la tinta, y la hierba o los matojos salían como garabatos negros. Por eso los
  matojos son montoncitos anchos y no briznas: lo que es más fino que la pluma se dibuja solo con
  tinta. El empedrado se construye con losas pequeñas, no con líneas.
- El sombreado son **tres tonos planos**: la cara iluminada se mezcla un 14 % hacia crema, la de
  sombra un 58 % hacia abajo y un 20 % hacia violeta, y el paso entre ambos es una banda estrecha,
  así que la cara gira sin escalones. Antes eran cinco bandas de gris que oscurecían el color: por
  eso las sombras salían turbias. Hay además sombra de contacto en la base y un filo de tinta muy
  suave al ras del perfil.
- El suelo no es un damero: el tono del césped sale de un campo de ruido lento (cuatro o cinco
  casillas de largo), así que las casillas vecinas casi comparten color, y encima van una o dos
  manchas poligonales irregulares a un 3-7 % de tono. Antes cada casilla elegía su verde y se veía la
  cuadrícula.
- El empedrado de plazas y caminos son polígonos irregulares (`patch`, seis formas) sobre un lecho
  de argamasa oscura, con las juntas al azar: una losa nunca es un cuadrado. La calle es tierra
  apisonada con manchas de desgaste, no una cruz de losas claras.
- Los **molinos** eran tres tambores colocados a alturas fijas: con dos o tres pisos quedaban huecos
  entre ellos y las aspas salían flotando. Ahora son dos tambores troncocónicos que se solapan, con la
  galería en la junta, el capó sobre el último y las aspas en un eje que sale del muro.
- Las **iglesias** (una casa junto a una torre) escondían la torre detrás del tejado de la nave, así
  que la aguja y la cruz parecían flotar sobre el tejado. Ahora la torre siempre pasa el caballete, la
  aguja arranca dentro del fuste (sin cornisa que sobrevuele) y la cruz se apoya en el vértice.
- Los **árboles** tenían un tronco casi tan ancho como alto: un tocón. Ahora el tronco es fino y
  troncocónico, con tres ramas y una copa de bolas redondas —`puff`, la mitad de triángulos que una
  esfera entera—; en invierno la copa es de nieve con trozos de rama asomando.
- Fuera los **tablones sueltos**: la madera a la deriva de la orilla, los troncos caídos del bosque,
  las raíces en cruz y el banco bajo el roble (que parecía un montón de tablas en mitad del prado).
  El banco es ahora un banco con patas y respaldo, y solo aparece donde hay plaza o paseo.
- Las ventanas llevan marco de piedra que sobresale del muro, cruceta y alféizar; las puertas, jambas,
  dintel, dos cuarteles y picaporte. Las casas eligen entre siete cales de muro y muchas llevan
  entramado de madera en las esquinas, para que una calle no parezca la misma casa repetida.
- Los remates de los tejados son veletas de hierro finas, con banderín de tela cuando toca; antes eran
  cruces de tinta que desde lejos parecían manchas. La cruz de la capilla también es de hierro y fina.
- Todo el color va por vértice y `THREE.ColorManagement` está desactivado: los shaders escriben el
  color tal cual, sin conversiones, así que el papel es exactamente `#f2ede3` (y su noche, `#9ba0b8`).
- El agua es un plato que se desvanece hacia el papel a partir del radio de la isla, para que el
  diorama parezca flotar en una hoja.
- Luces y humo son dos nubes de `Points`, una llamada de dibujo cada una: la posición, el tamaño y la
  opacidad de cada punto se calculan en el shader con el reloj, sin tocar la CPU.
- Los edificios se reconstruyen al colocar, pero la vida se anima por reloj: los barcos, los perros,
  el globo y las gaviotas no saltan, porque su posición depende del tiempo y no de la reconstrucción.
- El pueblo se dibuja en **tres llamadas**: una geometría fusionada para la superficie, otra (la
  misma) para el contorno de tinta y una tercera para las sombras del suelo. Antes era una malla por
  casilla, con su sombra: unas trescientas llamadas solo en edificios.
- Cada casilla guarda su geometría entre reconstrucciones, con una firma (papel, pisos, enlace de
  muralla, giro). Al colocar o girar algo solo se reconstruyen las casillas que cambian: una edición
  cuesta unos 3-5 ms en vez de 50.
- La vida se reconstruye por partes: la gente y los animales solo cuando cambia la forma del pueblo
  (calles, plazas, casas), el humo solo cuando cambian las alturas, y las luces de las ventanas
  siempre, que es baratísimo. Subir un piso ya no rehace cincuenta figuras.
- Las primitivas (`cube`, `plate`, `post`, `blob`…) son instancias únicas y `GeoBuilder` copia sus
  triángulos a arrays, sin crear una `BufferGeometry` por pieza. Eso dejó la construcción del pueblo
  en un tercio del tiempo.
- El `Raycaster` y sus vectores se reutilizan: el puntero llama a `pick` en cada movimiento.
- En pantallas de menos de 720 px hay menos gente (55 %), que es donde más se notan las llamadas.
- Con `npm run dev`, `__ciudad.stats()` y `__ciudad.rebuild(10)` dan llamadas de dibujo y milisegundos
  de reconstrucción desde la consola.
- Los enlaces llevan versión: `#p=3-…` guarda cinco caracteres por bloque (x, z, tipo, altura y
  giro); los enlaces antiguos, con cuatro, se siguen abriendo y entran con giro cero.
- Deshacer guarda fotos del pueblo (semilla, bloques, altura, giro y clics) en memoria: cuesta cinco
  números por casilla y aguanta cuarenta pasos. El pincel recuerda la última casilla pintada para que un arrastre
  largo no convierta una casa en una torre.

## Pruebas y rendimiento

Antes de dar un cambio por bueno:

```bash
npx tsc --noEmit   # tipos
npm run build      # el build que se publica
```

Lo medido en un pueblo de unos cien bloques, con la ventana quieta:

| | antes | ahora |
|---|---|---|
| Primer dibujo del pueblo | ~70 ms | ~25 ms |
| Colocar o girar un bloque | ~50 ms | 3-5 ms |
| Cambiar una altura (solo la vida) | 12-19 ms | 0,2 ms |
| Llamadas de dibujo del pueblo | ~300 | 3 (superficie, tinta y sombras) |

Lo que queda en ~300 llamadas es la vida: cada caminante son seis piezas y cada quieto cuatro. Es el
siguiente sitio donde apretar, fusionando brazos y piernas de los que no andan.

## Un barrio de verdad

**Lugar real** dibuja el pueblo sobre un trozo de mapa auténtico: escribes una dirección, o le dices
que use tu ubicación, y el juego pide los datos a OpenStreetMap. El cuadrado que elijas (250, 400,
600 o 900 m) se parte en las quince por quince casillas del tablero y cada casilla mira qué hay ahí:

| En el mapa | En el juego |
|---|---|
| agua, río, canal, costa | casilla de agua: la isla toma la forma de la orilla |
| un edificio, con sus plantas | una casa de una a tres alturas, girada como su fachada |
| una calle, una senda | un camino |
| parque, jardín, bosque | árboles; huerta, viña o labor | campo |
| una plaza | plaza |
| un embarcadero | muelle |

Donde el mapa no tiene edificios dibujados pero pasa una calle, el juego pone una parcela: las
calles y el agua son las de verdad, y las casas que nadie ha mapeado las imagina el juego. El barrio
sale jugable desde el primer clic, y desde ahí lo cambias como cualquier otro pueblo.

El enlace guarda el sitio (`?sitio=lat,lon,ancho&lugar=nombre`), así que se puede compartir un barrio
concreto; al abrirlo se vuelve a pedir el mapa. La última copia queda en el navegador, de modo que el
barrio se abre aunque los servidores públicos estén caídos —que lo están a menudo—. Los datos son
**© OpenStreetMap contributors**, con licencia ODbL: por eso la ventana lo dice y el mapa se pide
solo para dibujar.

El código está en `src/place.ts` (buscar el sitio, pedir el mapa, decidir cada casilla) y
`src/placeui.ts` (la ventana). Las consultas van con menos de diez cláusulas, dos espejos y dos
rondas de espera: los servidores gratuitos devuelven «at capacity» a la primera de cambio.

## Publicarlo en abierto

Es una web estática: `npm run build` deja todo en `dist/` y no necesita servidor propio.
`vite.config.ts` usa `base: './'`, así que el build vale igual en la raíz de un dominio que en un
subdirectorio (`usuario.github.io/repo/`).

**GitHub Pages, automático.** El flujo ya está en `.github/workflows/deploy.yml`:

1. Crea el repositorio vacío en GitHub (sin README ni licencia) y copia su URL.
2. En esta carpeta:

   ```bash
   git init
   git add .
   git commit -m "Ciudad pequeña"
   git branch -M main
   git remote add origin https://github.com/TUUSUARIO/ciudad-pequena.git
   git push -u origin main
   ```

3. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Cada push a `main` compila y publica; la URL aparece en **Settings → Pages** y en el paso `deploy`
   (`https://TUUSUARIO.github.io/ciudad-pequena/`).

**Sin instalar nada, en un minuto.** `npm run build` y arrastra la carpeta `dist/` a
[app.netlify.com/drop](https://app.netlify.com/drop) o a **Cloudflare Pages → Direct upload**. Te dan
una URL pública al momento. También vale `npx vercel --prod` o `npx netlify deploy --prod --dir=dist`.

**Comprobarlo en casa**: `npm run build && npm run preview` → http://localhost:4173.

## Qué falta respecto a la referencia

1. Contenido: la referencia tiene 102 edificios especiales con guía; aquí hay 52.
2. Clima de verdad: lluvia con charcos, tormenta y mercado con puestos que se montan.
3. Objetos narrados: alguien llevando pan del horno al puesto, barcos que cargan y descargan.
4. Una galería de postales (los pueblos guardados ya están, en tres huecos).
5. PWA instalable y modo sin conexión; la guía como páginas estáticas con su propia URL.

`repo/` contiene el build público de Little City, clonado solo para estudiar cómo está hecho (y su
guía pública de 102 edificios, que sirvió de lista de ideas). No se usa en este proyecto y queda
fuera del repositorio.
