# Ciudad pequeña

Un diorama de pueblo dibujado a mano, en el navegador: colocas bloques en una isla y cada uno se
convierte en algo distinto según sus vecinos y su altura, hasta cinco pisos. Es un MVP propio,
inspirado en la mecánica de [Little City](https://littlecity.io) de Derek Yao, sin usar su código ni
su arte: **53 formas** distintas, **43 hallazgos**, y un contador de clics que no se pierde.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # comprueba tipos y genera dist/
npm run preview  # sirve dist/
```

## Cómo se juega

- Elige un bloque y toca una casilla. **Vuelve a tocarla y sube un piso, hasta cinco.** Nada se
  destruye al insistir: para quitar algo está **Borrar**. El panel lleva la **cuenta de clics**.
- La altura cambia lo que sale: una casa pasa por **casa alta, casona, casa de vecindad y palacio**;
  una torre, por **campanario, atalaya, aguja y torre maestra**; un **árbol crece de verdad en cada
  clic** (tronco, ramas y copa), hasta el roble; un **jardín**, por parque, invernadero, laberinto y
  arboreto; una **muralla**, por muralla, torreón, fortaleza y alcázar.
- Los vecinos también mandan, y cambian en cuanto cambias una altura: la primera regla que encaja
  decide lo que se dibuja. Además, **una casa pegada a algo mucho más alto gana un piso** (sin
  romperse): el pueblo crece hacia dentro, no se pisa.
- Arrastra para girar la isla; rueda o pellizco para acercarte.
- Atajos: `1`–`9` y `0` eligen bloque, `E` borra.
- **Crecer** genera un pueblo nuevo en otra isla; **Vaciar** deja la isla en blanco.
- **Compartir** copia un enlace con el pueblo dentro (el estado va en el `#` de la URL, sin servidor);
  **Postal** descarga el diorama en PNG; **Guía** lista los 43 hallazgos; **Sonido** enciende el
  viento y las gaviotas; **Ciclo** pone el día y la noche en marcha.
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

Y lo que pasa alrededor:

- Si el vecino más alto está **tres o más niveles por encima**, la casilla se dibuja con un piso de
  más (tope: cinco). Una casa de un piso junto a una torre de cinco sale con dos.
- Los roles se recalculan al momento: una torre sola es una torre; con dos torres al lado, castillo;
  y si alguna de ellas llega al cuarto piso, ciudadela. Subir una altura puede convertir también las
  casillas de alrededor, sin que nada se pierda.
- La guía muestra los hallazgos que ya has visto y los que faltan en gris.

## Los 43 hallazgos

Cada casilla se resuelve a partir de sus vecinos y de sus pisos. Manda la primera regla que encaja:

| Regla | Se vuelve | Cuándo |
|---|---|---|
| R-G04 | Arboreto | Un jardín de cinco clics, con árboles de todo el mundo |
| R-G03 | Laberinto | Un jardín de cuatro clics: setos en laberinto |
| R-G02 | Invernadero | Un jardín de tres clics, con cristaleras |
| R-G01 | Parque | Un jardín de dos clics: árboles, bancos y un estanque |
| R-W04 | Alcázar | Una muralla de cinco clics: el alcázar del pueblo |
| R-W03 | Fortaleza | Una muralla de cuatro clics, con dos torres y puerta |
| R-W02 | Torreón | Una muralla de tres clics, con torre redonda |
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
| R-H18 | Granero | Una casa junto a un campo |
| R-H15 | Casa de campo | Una casa entre dos o más árboles |
| R-B01 | Puente | Un camino puesto sobre el agua |
| R-D01 | Muelle de piedra | Un camino que toca el agua |
| R-M11 | Teatro | Una plaza junto a una torre |
| R-M12 | Templete | Una plaza entre tres árboles o más |
| R-F01 | Plaza con fuente | Cuatro plazas juntas |
| R-P02 | Roble | Un árbol de tres clics: el gran roble del pueblo |
| R-P01 | Huerto | Cuatro árboles juntos |

Los bloques base (casa, torre, molino, calle, plaza, árbol, embarcadero, campo, jardín y tapia) no
cuentan como hallazgo, pero sí cambian de altura. Un jardín al lado de una casa hace que la casa gane
un piso, y una muralla junta convierte un rincón en fortaleza: todo se interconecta.

## Lo que se mueve

- La gente pasea por las calles con las piernas y los brazos articulados; en la plaza hay gente
  parada, meciéndose, y algunos niños. Uno de cada tres lleva la cesta de la compra.
- **Gatos** que se cruzan por las calles, con la cola levantada y las patas moviéndose; **palomas**
  que picotean en la plaza y en el muelle.
- Los veleros y los botes de remos navegan frente a la costa dejando estelas que se abren.
- Las gaviotas dan vueltas sobre los tejados, baten las alas y de vez en cuando se lanzan en picado.
- Sale humo de las chimeneas, y vapor del molino de agua.
- **Día y noche** cada 3,5 minutos: el papel se vuelve azul, la tinta pesa más y se encienden las
  ventanas, los faroles y la fragua. Con `?hora=0.7` arranca de noche; con el botón **Ciclo** se
  puede dejar siempre de día.

## Cómo está montado

| Archivo | Qué hace |
|---|---|
| `src/grid.ts` | rejilla, isla procedural (semilla), bloques con nivel, guardado en `localStorage` |
| `src/rules.ts` | hechos de cada casilla (vecinos, agua, nivel, altura de alrededor) y 43 reglas ordenadas |
| `src/grow.ts` | el generador de "crecer un pueblo": plaza, calles, callejón, castillo, granja, puerto |
| `src/geo.ts` | acumula primitivas en una geometría con color por vértice y recoge las luces |
| `src/buildings.ts` | los 53 roles en 3D: pisos apilados, cúpulas, castillos, invernaderos, árboles que crecen |
| `src/materials.ts` | tinta en cinco manchas (sin rayado), agua con oleaje suave, humo y luces; `uDusk` mueve todo al atardecer |
| `src/life.ts` | gente articulada, gatos, palomas, grupos en la plaza, barcos con estela, gaviotas, humo |
| `src/scene.ts` | cámara, isla, agua, sombras dibujadas, reconstrucción, ciclo de luz y postal |
| `src/share.ts` | codifica el pueblo en la URL (`#p=semilla.xzkN…`) y lo valida al cargar |
| `src/guide.ts` | la guía de hallazgos |
| `src/audio.ts` | viento, agua y gaviotas con WebAudio: sin archivos de sonido |
| `src/main.ts` | paleta, puntero, alturas, pellizco, panel, avisos |

Notas de implementación que costaron encontrar:

- El contorno es un *inverted hull*: la misma geometría en `BackSide`, empujada por la normal con un
  ruido. Nada más fino que el grosor del contorno se vuelve una mancha negra, así que el empedrado se
  construye con losas pequeñas en vez de líneas.
- El sombreado son cinco manchas planas, sombra de contacto en la base y un filo de tinta al ras del
  perfil. Antes había un rayado en pantalla; se quitó porque parecía tela y se comía el dibujo.
- Todo el color va por vértice y `THREE.ColorManagement` está desactivado: los shaders escriben el
  color tal cual, sin conversiones, así que el papel es exactamente `#f2ede3` (y su noche, `#9ba0b8`).
- El agua es un plato que se desvanece hacia el papel a partir del radio de la isla, para que el
  diorama parezca flotar en una hoja.
- Luces y humo son dos nubes de `Points`, una llamada de dibujo cada una: la posición, el tamaño y la
  opacidad de cada punto se calculan en el shader con el reloj, sin tocar la CPU.
- Los edificios se reconstruyen al colocar, pero la vida se anima por reloj: los barcos, los gatos y
  las gaviotas no saltan, porque su posición depende del tiempo y no de la reconstrucción.

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

1. Contenido: la referencia tiene 102 edificios especiales con guía; aquí hay 43.
2. Estaciones y clima: nieve, lluvia, fiestas y mercado con puestos que se montan.
3. Objetos narrados: alguien llevando pan del horno al puesto, barcos que cargan y descargan.
4. Varios pueblos guardados y una galería de postales.
5. PWA instalable y modo sin conexión; la guía como páginas estáticas con su propia URL.

`repo/` contiene el build público de Little City, clonado solo para estudiar cómo está hecho (y su
guía pública de 102 edificios, que sirvió de lista de ideas). No se usa en este proyecto y queda
fuera del repositorio.
