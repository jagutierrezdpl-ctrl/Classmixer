# CLASSMIXER / SOCIOGRAMAS ESCOLARES
## Especificación completa para desarrollar una aplicación web de mezcla inteligente de clases y análisis sociométrico

---

## 0. Resumen del proyecto

Crear una aplicación web para centros educativos que permita:

1. Importar alumnos desde un Excel.
2. Registrar información académica, social y organizativa.
3. Generar un cuestionario sociométrico para el alumnado.
4. Crear sociogramas automáticos con las respuestas.
5. Detectar alumnos aislados, líderes, subgrupos y relaciones significativas.
6. Configurar reglas pedagógicas entre alumnos.
7. Generar propuestas equilibradas de nuevas clases.
8. Revisar manualmente las propuestas.
9. Exportar los resultados en Excel, PDF e informes internos.

La aplicación no debe sustituir el criterio docente. Debe funcionar como un asistente profesional para ayudar al equipo directivo, orientación y tutores a tomar decisiones mejor fundamentadas.

---

# 1. Nombre provisional del producto

Nombre interno:

**ClassMixer**

Posibles nombres comerciales:

- ClassMixer
- EquiClass
- AulaBalance
- SociClass
- Grupos Inteligentes
- AulaLink
- Sociograma Escolar

---

# 2. Objetivo principal

Diseñar una plataforma que ayude a mezclar clases escolares de forma equilibrada teniendo en cuenta:

- Clase de origen.
- Género.
- Nivel académico.
- Nota media.
- Conducta.
- Necesidades educativas.
- Relaciones de amistad.
- Relaciones de trabajo.
- Conflictos.
- Sociograma del grupo.
- Criterios definidos por el equipo docente.

El sistema debe generar varias propuestas de agrupación y explicar sus ventajas, riesgos y posibles problemas.

---

# 3. Objetivos secundarios

Además de generar nuevas clases, la aplicación debe permitir:

- Crear sociogramas interactivos.
- Detectar alumnos socialmente aislados.
- Detectar alumnos con muchas elecciones recibidas.
- Detectar relaciones recíprocas.
- Detectar relaciones unidireccionales.
- Detectar subgrupos.
- Detectar alumnos puente.
- Detectar dependencias sociales.
- Detectar posibles riesgos de exclusión.
- Generar informes para tutores y orientación.
- Comparar propuestas antes de aceptar una mezcla definitiva.

---

# 4. Principios importantes del sistema

## 4.1. Supervisión humana

El algoritmo nunca debe tomar una decisión definitiva sin revisión humana.

Debe proponer, no imponer.

El admin siempre debe poder:

- Revisar.
- Bloquear.
- Ajustar.
- Recalcular.
- Exportar solo cuando confirme.

## 4.2. Transparencia

Cada propuesta debe explicar:

- Qué reglas cumple.
- Qué reglas incumple.
- Qué alumnos quedan con amigos.
- Qué alumnos quedan sin conexiones.
- Qué equilibrio académico tiene.
- Qué equilibrio de género tiene.
- Qué conflictos evita.
- Qué puntos débiles tiene.

## 4.3. Configuración flexible

Cada colegio debe poder configurar sus propios criterios.

No todos los centros dan el mismo peso a:

- Notas.
- Género.
- Conducta.
- Amistades.
- Conflictos.
- Necesidades educativas.
- Mezcla entre A y B.

## 4.4. Protección de datos

La aplicación trabaja con datos sensibles de menores.

Debe diseñarse con privacidad desde el inicio.

Puntos obligatorios:

- Acceso restringido.
- Datos mínimos necesarios.
- No mostrar respuestas entre alumnos.
- No permitir que los alumnos vean sociogramas.
- Exportaciones solo para personal autorizado.
- Posibilidad de borrar un proceso completo.
- Registro de actividad del admin.

---

# 5. Roles de usuario

## 5.1. Superadministrador del sistema

Uso interno de la plataforma.

Puede:

- Crear centros.
- Gestionar licencias.
- Ver estado técnico de procesos.
- No debe acceder al contenido sensible salvo autorización expresa.

## 5.2. Administrador de centro

Normalmente:

- Director.
- Jefe de estudios.
- Coordinador TIC.
- Orientador.

Puede:

- Crear procesos.
- Importar alumnos.
- Gestionar usuarios docentes.
- Configurar reglas generales.
- Lanzar cuestionarios.
- Ejecutar algoritmos.
- Ver sociogramas.
- Exportar resultados.

## 5.3. Tutor / Profesor autorizado

Puede:

- Ver alumnos de sus grupos.
- Añadir observaciones.
- Añadir reglas entre alumnos.
- Consultar sociogramas si tiene permiso.
- Revisar propuestas.
- Proponer cambios.

No debe poder borrar procesos completos salvo permiso especial.

## 5.4. Orientador

Puede:

- Ver datos sociales.
- Ver sociogramas.
- Ver alertas de aislamiento.
- Añadir observaciones sensibles.
- Configurar reglas de protección.
- Crear informes internos.

## 5.5. Alumno

Puede:

- Acceder a un cuestionario mediante enlace.
- Identificarse con código o cuenta institucional.
- Elegir compañeros según las preguntas configuradas.

No puede:

- Ver respuestas de otros.
- Ver sociogramas.
- Ver propuestas de mezcla.
- Ver reglas docentes.
- Ver notas.

---

# 6. Flujo general de uso

## 6.1. Crear proceso

El admin crea un nuevo proceso.

Ejemplo:

**Mezcla de 6º Primaria para 1º ESO - Curso 2026/2027**

Campos:

- Nombre del proceso.
- Curso escolar.
- Etapa.
- Nivel actual.
- Nivel destino.
- Grupos de origen.
- Grupos destino.
- Fecha de inicio.
- Fecha límite del cuestionario.
- Estado del proceso.

Estados posibles:

- Borrador.
- Cuestionario abierto.
- Cuestionario cerrado.
- En análisis.
- Propuestas generadas.
- Propuesta seleccionada.
- Cerrado.
- Archivado.

## 6.2. Importar alumnos

El admin sube un Excel.

El sistema:

- Lee datos.
- Valida columnas.
- Detecta errores.
- Detecta duplicados.
- Permite corregir antes de guardar.
- Crea los alumnos en el proceso.

## 6.3. Configurar cuestionario

El admin decide:

- Qué preguntas se harán.
- Cuántos compañeros puede elegir cada alumno.
- Si las elecciones son obligatorias.
- Si se preguntan relaciones de amistad.
- Si se preguntan relaciones de trabajo.
- Si se permiten preguntas negativas.
- Si se usa acceso con código o cuenta institucional.

## 6.4. Generar enlace del cuestionario

El sistema genera:

- Un enlace general.
- Opcionalmente enlaces individuales.
- Códigos de acceso por alumno.
- QR para imprimir o proyectar.

## 6.5. Responder cuestionario

El alumno entra y responde.

El sistema guarda:

- Alumno que responde.
- Alumnos elegidos.
- Tipo de elección.
- Fecha y hora.
- Estado de completado.

## 6.6. Crear sociograma

Cuando hay respuestas suficientes, el sistema genera:

- Sociograma de amistad.
- Sociograma de trabajo.
- Sociograma combinado.
- Métricas sociales.
- Alertas.

## 6.7. Configurar reglas de mezcla

El admin define:

- Número de clases destino.
- Tamaño máximo y mínimo.
- Reglas obligatorias.
- Reglas blandas.
- Pesos del algoritmo.
- Restricciones entre alumnos.

## 6.8. Ejecutar algoritmo

El sistema genera varias propuestas.

Cada propuesta incluye:

- Distribución de alumnos.
- Métricas por grupo.
- Puntuación total.
- Alertas.
- Reglas cumplidas e incumplidas.
- Sociograma futuro simulado.

## 6.9. Revisión manual

El admin puede:

- Mover alumnos.
- Bloquear posiciones.
- Recalcular.
- Guardar versiones.
- Comparar versiones.

## 6.10. Exportar

Exportaciones:

- Excel con clases finales.
- PDF por clase.
- Informe de equilibrio.
- Informe social.
- Informe para orientación.
- Imagen del sociograma.

---

# 7. Importación de alumnos desde Excel

## 7.1. Formato de Excel recomendado

Hoja obligatoria:

**Alumnos**

Columnas obligatorias:

| Columna | Tipo | Ejemplo |
|---|---|---|
| id_alumno | Texto | A001 |
| nombre | Texto | Marta |
| apellidos | Texto | García López |
| clase_actual | Texto | 6A |
| genero | Texto | F |
| nota_media | Número | 8.4 |

Columnas recomendadas:

| Columna | Tipo | Ejemplo |
|---|---|---|
| nivel_academico | Texto | Alto |
| conducta | Texto | Media |
| necesidades | Texto | No |
| observaciones | Texto | Conviene separar de A008 |
| tutor | Texto | María Pérez |
| grupo_origen | Texto | 6A |
| repetidor | Booleano | No |
| apoyo | Texto | Refuerzo matemáticas |

## 7.2. Valores permitidos

### Género

Opciones recomendadas:

- F
- M
- Otro
- No especificado

El sistema no debe fallar si el centro decide usar otras etiquetas, pero debe pedir mapeo.

### Nivel académico

Opciones:

- Alto
- Medio-alto
- Medio
- Medio-bajo
- Bajo

También puede calcularse automáticamente desde nota_media.

### Conducta

Opciones:

- Positiva
- Normal
- Seguimiento
- Conflictiva

### Necesidades

Opciones:

- No
- Sí
- ACNEAE
- NEE
- Refuerzo
- Altas capacidades
- Observación interna

## 7.3. Validaciones de importación

El sistema debe comprobar:

- Que existe id_alumno.
- Que no hay IDs duplicados.
- Que cada alumno tiene nombre.
- Que cada alumno tiene clase de origen.
- Que la nota media es numérica.
- Que el género está informado o mapeado.
- Que no hay columnas obligatorias vacías.
- Que no hay alumnos duplicados por nombre y apellidos.
- Que las clases de origen coinciden con las configuradas.

## 7.4. Pantalla de revisión de importación

Antes de guardar, mostrar:

- Total de alumnos detectados.
- Alumnos válidos.
- Alumnos con errores.
- Alumnos con advertencias.
- Clases detectadas.
- Distribución por género.
- Nota media general.
- Distribución por nivel académico.

Botones:

- Corregir datos.
- Descargar plantilla.
- Volver a subir Excel.
- Confirmar importación.

---

# 8. Gestión de alumnos

Cada alumno tendrá una ficha interna.

## 8.1. Datos básicos

- ID.
- Nombre.
- Apellidos.
- Clase actual.
- Grupo de origen.
- Género.
- Nota media.
- Nivel académico.
- Conducta.
- Necesidades.
- Observaciones.
- Tutor.

## 8.2. Datos sociales

- Elecciones realizadas.
- Elecciones recibidas.
- Relaciones recíprocas.
- Relaciones de trabajo.
- Número de conexiones.
- Índice de aislamiento.
- Índice de centralidad.
- Subgrupo detectado.

## 8.3. Datos de mezcla

- Clase propuesta.
- Clase final.
- Reglas aplicadas.
- Conflictos detectados.
- Amigos conservados.
- Alertas.

---

# 9. Cuestionario sociométrico

## 9.1. Objetivo

Recoger información social para:

- Crear sociogramas.
- Detectar afinidades.
- Detectar alumnos aislados.
- Mejorar la mezcla de clases.
- Garantizar que ningún alumno quede sin vínculos relevantes si es posible.

## 9.2. Tipos de preguntas

### Pregunta de amistad

Texto sugerido:

> Elige hasta 5 compañeros o compañeras con los que te gustaría compartir clase el próximo curso.

Configuración:

- Mínimo de elecciones: 1.
- Máximo de elecciones: 5.
- Permitir buscar por nombre.
- Mostrar alumnos del mismo nivel.
- No mostrar notas ni datos internos.

### Pregunta de trabajo

Texto sugerido:

> Elige hasta 3 compañeros o compañeras con los que trabajas bien en clase.

Configuración:

- Mínimo: 0.
- Máximo: 3.
- Opcional.

### Pregunta de apoyo emocional

Texto sugerido:

> Elige hasta 3 compañeros o compañeras con los que te sientes cómodo o tranquila.

Configuración:

- Opcional.
- Recomendada para orientación.
- Visible solo para perfiles autorizados.

### Pregunta negativa

No se recomienda usar de forma general.

Si el centro la activa, debe aparecer con lenguaje cuidadoso.

Texto sugerido:

> ¿Hay algún compañero o compañera con quien crees que te cuesta trabajar en clase?

Configuración:

- Máximo: 2.
- Opcional.
- Solo visible para orientación/admin.
- No se usa como rechazo público.
- Se trata como dato sensible.

## 9.3. Acceso al cuestionario

Opciones:

### Código individual

Cada alumno recibe un código.

Ventajas:

- No requiere login.
- Fácil en Primaria.

Riesgos:

- Puede compartirse.

### Cuenta Google Workspace

El alumno entra con su correo institucional.

Ventajas:

- Más seguro.
- Identificación automática.

Riesgos:

- Requiere configuración OAuth.

### Enlace general + selección de nombre

No recomendado salvo grupos pequeños.

Riesgo:

- Un alumno puede responder por otro.

## 9.4. Estado de respuestas

El admin verá:

- Total de alumnos.
- Respuestas completadas.
- Respuestas pendientes.
- Porcentaje completado.
- Alumnos que no han respondido.
- Respuestas incompletas.

---

# 10. Sociograma inteligente

## 10.1. Objetivo

Construir una representación visual y analítica de las relaciones sociales del grupo.

Debe poder usarse:

- Antes de mezclar clases.
- Durante la generación de propuestas.
- Después de generar una propuesta.
- Como herramienta independiente para tutoría y orientación.

## 10.2. Tipos de sociograma

### Sociograma de amistad

Basado en la pregunta:

- Con quién te gustaría compartir clase.

### Sociograma de trabajo

Basado en la pregunta:

- Con quién trabajas bien.

### Sociograma emocional

Basado en la pregunta:

- Con quién te sientes cómodo.

### Sociograma combinado

Integra:

- Amistad.
- Trabajo.
- Relaciones docentes.
- Conflictos.

## 10.3. Visualización

La pantalla debe mostrar un grafo interactivo.

### Nodo

Cada alumno es un nodo.

Datos mostrables:

- Nombre.
- Clase actual.
- Género.
- Nivel académico.
- Nota media.
- Conducta.
- Necesidades.
- Número de elecciones recibidas.
- Número de relaciones recíprocas.

### Tamaño del nodo

Debe representar la cantidad de elecciones recibidas.

Más grande:

- Alumno muy elegido.

Más pequeño:

- Alumno poco elegido.

### Color del nodo

Configurable por el usuario.

Opciones:

- Por género.
- Por clase de origen.
- Por nivel académico.
- Por conducta.
- Por comunidad detectada.
- Por clase propuesta.
- Por riesgo social.

### Aristas / conexiones

Cada relación entre alumnos se representa con una línea.

Tipos:

- Afinidad unilateral.
- Afinidad mutua.
- Relación de trabajo.
- Relación emocional.
- Conflicto docente.
- Regla de no juntar.
- Regla de mantener juntos.

### Grosor de conexión

Debe aumentar si la relación tiene más fuerza.

Ejemplo:

- Ana elige a Marta como amiga.
- Ana también elige a Marta para trabajar.
- Marta también elige a Ana.

Resultado:

- Relación muy fuerte.

## 10.4. Filtros del sociograma

Filtros necesarios:

- Ver solo clase 6A.
- Ver solo clase 6B.
- Ver todos.
- Ver solo relaciones mutuas.
- Ver solo alumnos aislados.
- Ver solo conflictos.
- Ver por género.
- Ver por nivel académico.
- Ver por comunidad.
- Ver por propuesta de mezcla.

## 10.5. Métricas sociales

### Elecciones recibidas

Número de veces que un alumno ha sido elegido.

### Elecciones realizadas

Número de compañeros que el alumno ha elegido.

### Reciprocidad

Porcentaje de relaciones mutuas.

Ejemplo:

Si Ana elige a Marta y Marta elige a Ana, es una relación recíproca.

### Centralidad

Mide la importancia del alumno dentro de la red.

### Centralidad de intermediación

Detecta alumnos puente entre grupos.

### Cohesión grupal

Mide el nivel de conexión global del grupo.

### Aislamiento

Detecta alumnos con pocas o ninguna conexión.

### Densidad de red

Relaciones existentes comparadas con las relaciones posibles.

## 10.6. Detecciones automáticas

### Alumno aislado

Criterios posibles:

- Cero elecciones recibidas.
- Ninguna relación recíproca.
- Una única relación débil.
- No pertenece a ningún subgrupo.

### Alumno vulnerable

Criterios posibles:

- Solo una conexión relevante.
- Depende de un único compañero.
- Si se separa de ese compañero, queda aislado.

### Líder social

Criterios posibles:

- Muchas elecciones recibidas.
- Alta centralidad.
- Conecta con varios subgrupos.

### Alumno puente

Alumno que conecta comunidades diferentes.

Importante para:

- Mezclas equilibradas.
- Integración social.
- Evitar grupos cerrados.

### Subgrupo cerrado

Grupo de alumnos que se eligen mucho entre ellos pero apenas conectan con otros.

### Pareja fuerte

Dos alumnos con relación recíproca muy intensa.

### Grupo dominante

Subgrupo con demasiada influencia social.

## 10.7. Alertas del sociograma

El sistema debe mostrar alertas como:

- Alumno sin elecciones recibidas.
- Alumno sin relaciones recíprocas.
- Alumno dependiente de una única relación.
- Subgrupo cerrado de más de 5 alumnos.
- Conflicto entre alumnos con alta cercanía.
- Alumno vulnerable separado de su único vínculo.
- Propuesta de mezcla con riesgo social elevado.

## 10.8. Sociograma futuro

Tras generar una propuesta de mezcla, el sistema debe mostrar cómo quedarían las relaciones dentro de cada nueva clase.

Ejemplo:

Nueva clase 1ºA:

- 25 alumnos.
- 24 tienen al menos una relación.
- 1 alumno queda sin relación directa.
- 87% de amistades recíprocas preservadas.

Nueva clase 1ºB:

- 25 alumnos.
- 25 tienen al menos una relación.
- 0 alumnos aislados.
- 91% de amistades recíprocas preservadas.

## 10.9. Exportaciones del sociograma

Debe permitir exportar:

- Imagen PNG.
- PDF visual.
- PDF con informe analítico.
- Excel con métricas.
- Informe individual por alumno.
- Informe para orientación.

## 10.10. Tecnología recomendada para sociograma

Librerías posibles:

- Cytoscape.js
- React Flow
- D3.js

Recomendación principal:

**Cytoscape.js**

Motivos:

- Especializada en grafos.
- Permite nodos y relaciones complejas.
- Permite layouts automáticos.
- Permite análisis visual de redes.
- Permite exportar imágenes.
- Tiene buen rendimiento.

---

# 11. Motor de reglas

## 11.1. Tipos de reglas

Las reglas pueden ser:

- Obligatorias.
- De prioridad alta.
- De prioridad media.
- De prioridad baja.

## 11.2. Reglas obligatorias

Nunca deben incumplirse salvo que el sistema indique que no existe solución posible.

Ejemplos:

- Lucas y Mario no pueden estar juntos.
- No superar 25 alumnos por clase.
- Cada clase debe tener al menos 23 alumnos.
- No juntar a más de 2 alumnos de un grupo conflictivo.
- Un alumno concreto debe estar en una clase determinada.

## 11.3. Reglas blandas

Se intentan cumplir, pero pueden incumplirse si no hay alternativa.

Ejemplos:

- Mantener al menos una amistad por alumno.
- Equilibrar nota media.
- Equilibrar género.
- Mantener relaciones recíprocas.
- Repartir alumnos con conducta difícil.
- Mezclar alumnado de A y B.

## 11.4. Reglas entre alumnos

### No juntar

Ejemplo:

- Alumno A no puede ir con Alumno B.

Campos:

- Alumno 1.
- Alumno 2.
- Prioridad.
- Motivo interno.
- Creado por.
- Fecha.

### Mantener juntos

Ejemplo:

- Alumno A debería ir con Alumno B.

Campos:

- Alumno 1.
- Alumno 2.
- Prioridad.
- Motivo.

### Mantener al menos uno

Ejemplo:

Pablo debe ir con al menos uno de:

- Diego.
- Hugo.
- Martín.

### Separar grupo

Ejemplo:

De estos 6 alumnos, máximo 2 por clase.

### No dejar solo

Ejemplo:

Alumno vulnerable debe conservar al menos una relación significativa.

### Bloquear en clase

Ejemplo:

Marta debe ir a 1ºA.

### Excluir de mezcla

Ejemplo:

Alumno que cambia de centro o repite.

---

# 12. Configuración del algoritmo

## 12.1. Pesos configurables

El admin debe poder ajustar pesos.

Ejemplo:

| Factor | Peso |
|---|---:|
| Conflictos | 100 |
| Evitar aislamiento | 95 |
| Amistades recíprocas | 90 |
| Amistades elegidas | 85 |
| Relaciones de trabajo | 75 |
| Equilibrio académico | 80 |
| Equilibrio de género | 60 |
| Mezcla A/B | 50 |
| Conducta | 70 |
| Necesidades educativas | 80 |

## 12.2. Perfiles de configuración

El sistema puede ofrecer plantillas:

### Perfil equilibrado

Da peso similar a todo.

### Perfil social

Da más peso a:

- Amistades.
- Aislamiento.
- Sociograma.
- Relaciones recíprocas.

### Perfil académico

Da más peso a:

- Nota media.
- Nivel académico.
- Reparto de alumnado de apoyo.

### Perfil convivencia

Da más peso a:

- Conflictos.
- Conducta.
- Separación de grupos problemáticos.

### Perfil personalizado

El centro ajusta todo.

---

# 13. Generador de propuestas

## 13.1. Objetivo

Generar varias distribuciones posibles de alumnos en nuevas clases.

Debe producir mínimo:

- Propuesta A.
- Propuesta B.
- Propuesta C.

Opcionalmente:

- Hasta 10 propuestas.

## 13.2. Evaluación de cada propuesta

Cada propuesta tendrá:

- Puntuación total.
- Puntuación social.
- Puntuación académica.
- Puntuación de convivencia.
- Puntuación de equilibrio de género.
- Puntuación de equilibrio de origen.
- Número de reglas incumplidas.
- Número de alumnos sin amistad.
- Número de conflictos evitados.
- Número de amistades recíprocas preservadas.

## 13.3. Métricas por clase

Para cada clase destino:

- Número de alumnos.
- Número de niñas.
- Número de niños.
- Nota media.
- Distribución por nivel académico.
- Distribución por clase de origen.
- Número de alumnos con necesidades.
- Número de alumnos con conducta de seguimiento.
- Número de amistades internas.
- Número de relaciones recíprocas internas.
- Alumnos sin conexión.
- Alumnos vulnerables.

## 13.4. Comparador de propuestas

Tabla comparativa:

| Métrica | Propuesta A | Propuesta B | Propuesta C |
|---|---:|---:|---:|
| Puntuación total | 94 | 91 | 96 |
| Alumnos sin amigo | 2 | 1 | 0 |
| Nota media equilibrada | 9/10 | 10/10 | 9/10 |
| Género equilibrado | 8/10 | 9/10 | 9/10 |
| Conflictos incumplidos | 0 | 0 | 0 |
| Amistades preservadas | 88% | 85% | 93% |

---

# 14. Algoritmo recomendado

## 14.1. Tecnología

Usar:

**Google OR-Tools**

Motivo:

Permite resolver problemas de asignación con restricciones.

## 14.2. Modelo del problema

Cada alumno debe asignarse a una clase destino.

Variable:

x[alumno][clase] = 1 si el alumno está en esa clase.

## 14.3. Restricciones duras

- Cada alumno debe estar en una sola clase.
- Cada clase debe tener mínimo y máximo de alumnos.
- Parejas marcadas como “no juntar” no pueden compartir clase.
- Alumnos bloqueados deben ir a su clase asignada.
- No superar máximo de alumnado de seguimiento por clase.
- No superar diferencia máxima de tamaño entre clases.

## 14.4. Restricciones blandas

- Mantener amistades.
- Mantener relaciones recíprocas.
- Mantener al menos una amistad por alumno.
- Equilibrar nota media.
- Equilibrar género.
- Equilibrar origen A/B.
- Repartir niveles académicos.
- Repartir conducta.
- Repartir necesidades.

## 14.5. Función objetivo

Maximizar una puntuación global.

Puntuación =

- Puntos por amistades preservadas.
- Puntos por relaciones recíprocas preservadas.
- Puntos por equilibrio académico.
- Puntos por equilibrio de género.
- Puntos por equilibrio de origen.
- Puntos por evitar aislamiento.
- Penalización por conflictos.
- Penalización por desequilibrios.

## 14.6. Cuando no hay solución

Si no existe solución posible, el sistema debe informar:

- Qué reglas bloquean el proceso.
- Qué reglas son incompatibles.
- Qué regla habría que relajar.
- Propuesta de solución.

Ejemplo:

> No es posible cumplir todas las reglas obligatorias porque el alumno A está bloqueado en 1ºA, pero también tiene una regla obligatoria de no compartir clase con el alumno B, que también está bloqueado en 1ºA.

---

# 15. Edición manual

## 15.1. Vista drag & drop

El admin debe poder arrastrar alumnos entre clases.

## 15.2. Impacto en tiempo real

Al mover un alumno, mostrar:

- Cambio en nota media.
- Cambio en género.
- Cambio en amistades.
- Cambio en conflictos.
- Cambio en alumnos vulnerables.
- Reglas afectadas.

Ejemplo:

> Al mover a Marta a 1ºB:
> - Se rompe una amistad recíproca.
> - Mejora el equilibrio académico.
> - Empeora el equilibrio de género.
> - No incumple reglas obligatorias.

## 15.3. Bloqueo de alumnos

El admin puede bloquear:

- Alumno en clase concreta.
- Pareja junta.
- Pareja separada.
- Subgrupo repartido.

## 15.4. Recalcular desde una versión

El admin puede hacer ajustes manuales y después pedir:

> Recalcular respetando estos cambios.

---

# 16. Informes

## 16.1. Informe de propuesta

Debe incluir:

- Resumen general.
- Métricas por clase.
- Reglas cumplidas.
- Reglas incumplidas.
- Alertas.
- Alumnos vulnerables.
- Sociograma futuro.
- Recomendaciones.

## 16.2. Informe para dirección

Más resumido:

- Número de alumnos.
- Criterios usados.
- Equilibrio final.
- Observaciones principales.
- Versión aprobada.

## 16.3. Informe para tutores

Por clase:

- Listado de alumnos.
- Datos básicos.
- Observaciones internas.
- Alumnos con seguimiento.
- Relaciones sociales relevantes.

## 16.4. Informe para orientación

Más sensible:

- Alumnos aislados.
- Alumnos vulnerables.
- Relaciones de dependencia.
- Conflictos.
- Subgrupos.
- Recomendaciones.

## 16.5. Informe de sociograma

Debe incluir:

- Imagen del grafo.
- Métricas sociales.
- Alumnos más elegidos.
- Alumnos con menos elecciones.
- Relaciones recíprocas.
- Subgrupos detectados.
- Alertas.

---

# 17. Exportaciones

## 17.1. Excel final

Hojas:

- Clases finales.
- Métricas.
- Reglas.
- Alertas.
- Alumnos sin amistad.
- Sociograma métricas.

## 17.2. PDF

Tipos:

- PDF completo.
- PDF dirección.
- PDF tutores.
- PDF orientación.
- PDF sociograma.

## 17.3. Imagen

Exportar sociograma en:

- PNG.
- SVG si es posible.

---

# 18. Panel de administración

## 18.1. Dashboard inicial

Mostrar:

- Procesos activos.
- Procesos cerrados.
- Alumnos totales.
- Cuestionarios pendientes.
- Alertas sociales.
- Últimas propuestas generadas.

## 18.2. Pantalla de proceso

Pestañas:

1. Resumen.
2. Alumnos.
3. Cuestionario.
4. Respuestas.
5. Sociograma.
6. Reglas.
7. Algoritmo.
8. Propuestas.
9. Exportaciones.
10. Configuración.

---

# 19. Pantallas principales

## 19.1. Login

Opciones:

- Email y contraseña.
- Google Workspace.
- Microsoft 365.

## 19.2. Crear proceso

Formulario:

- Nombre.
- Curso.
- Nivel actual.
- Nivel destino.
- Grupos origen.
- Grupos destino.
- Número de clases nuevas.
- Capacidad por clase.

## 19.3. Importar alumnos

Componentes:

- Subida de Excel.
- Botón descargar plantilla.
- Vista previa.
- Validación.
- Confirmación.

## 19.4. Alumnos

Tabla con filtros:

- Nombre.
- Clase.
- Género.
- Nota.
- Nivel.
- Conducta.
- Necesidades.
- Estado cuestionario.
- Alertas.

## 19.5. Cuestionario

Opciones:

- Activar preguntas.
- Configurar máximos.
- Generar enlace.
- Generar QR.
- Ver respuestas.

## 19.6. Sociograma

Componentes:

- Grafo interactivo.
- Filtros.
- Métricas.
- Alertas.
- Lista de alumnos aislados.
- Lista de líderes.
- Lista de subgrupos.
- Exportar.

## 19.7. Reglas

Componentes:

- Crear regla.
- Tipo de regla.
- Alumnos implicados.
- Prioridad.
- Motivo.
- Activar/desactivar.

## 19.8. Algoritmo

Componentes:

- Seleccionar perfil.
- Ajustar pesos.
- Número de propuestas.
- Ejecutar.
- Ver estado.
- Ver errores.

## 19.9. Propuestas

Componentes:

- Tarjetas de propuestas.
- Comparativa.
- Métricas.
- Ver detalle.
- Editar manualmente.
- Seleccionar propuesta final.

## 19.10. Exportaciones

Opciones:

- Excel.
- PDF.
- Imagen sociograma.
- Informe completo.
- Informe reducido.

---

# 20. Base de datos propuesta

## 20.1. Tabla users

Campos:

- id
- email
- name
- role
- center_id
- created_at
- updated_at

## 20.2. Tabla centers

Campos:

- id
- name
- address
- city
- country
- created_at

## 20.3. Tabla processes

Campos:

- id
- center_id
- name
- school_year
- source_level
- target_level
- status
- created_by
- created_at
- updated_at

## 20.4. Tabla students

Campos:

- id
- process_id
- external_id
- first_name
- last_name
- current_class
- gender
- average_grade
- academic_level
- behavior_level
- needs_type
- observations
- active
- created_at

## 20.5. Tabla questionnaire_settings

Campos:

- id
- process_id
- friendship_enabled
- friendship_min
- friendship_max
- work_enabled
- work_min
- work_max
- emotional_enabled
- emotional_min
- emotional_max
- negative_enabled
- negative_max
- access_mode
- deadline

## 20.6. Tabla questionnaire_tokens

Campos:

- id
- process_id
- student_id
- token
- used
- completed_at

## 20.7. Tabla responses

Campos:

- id
- process_id
- respondent_student_id
- target_student_id
- relation_type
- weight
- created_at

relation_type:

- friendship
- work
- emotional
- negative

## 20.8. Tabla rules

Campos:

- id
- process_id
- rule_type
- priority
- description
- created_by
- active
- created_at

rule_type:

- must_separate
- should_keep_together
- must_keep_together
- keep_at_least_one
- max_from_group
- lock_student_to_class
- exclude_student
- protect_vulnerable

## 20.9. Tabla rule_students

Campos:

- id
- rule_id
- student_id
- role

## 20.10. Tabla proposals

Campos:

- id
- process_id
- name
- score_total
- score_social
- score_academic
- score_gender
- score_behavior
- status
- generated_at
- created_by

## 20.11. Tabla proposal_assignments

Campos:

- id
- proposal_id
- student_id
- target_class

## 20.12. Tabla proposal_metrics

Campos:

- id
- proposal_id
- metric_key
- metric_value
- target_class
- created_at

## 20.13. Tabla sociogram_metrics

Campos:

- id
- process_id
- student_id
- received_count
- given_count
- reciprocal_count
- centrality
- betweenness
- isolation_score
- community_id
- created_at

## 20.14. Tabla audit_logs

Campos:

- id
- user_id
- center_id
- process_id
- action
- entity_type
- entity_id
- created_at
- metadata

---

# 21. API propuesta

## 21.1. Procesos

### GET /api/processes

Lista procesos.

### POST /api/processes

Crea proceso.

### GET /api/processes/:id

Detalle.

### PATCH /api/processes/:id

Actualiza.

### DELETE /api/processes/:id

Archiva o elimina.

## 21.2. Alumnos

### POST /api/processes/:id/import-students

Importa Excel.

### GET /api/processes/:id/students

Lista alumnos.

### PATCH /api/students/:id

Actualiza alumno.

### DELETE /api/students/:id

Desactiva alumno.

## 21.3. Cuestionario

### POST /api/processes/:id/questionnaire/settings

Guarda configuración.

### POST /api/processes/:id/questionnaire/generate

Genera enlaces.

### GET /q/:token

Carga cuestionario público.

### POST /q/:token

Envía respuesta.

## 21.4. Sociograma

### GET /api/processes/:id/sociogram

Obtiene grafo.

### POST /api/processes/:id/sociogram/calculate

Calcula métricas.

### GET /api/processes/:id/sociogram/alerts

Obtiene alertas.

### GET /api/processes/:id/sociogram/export

Exporta.

## 21.5. Reglas

### GET /api/processes/:id/rules

Lista reglas.

### POST /api/processes/:id/rules

Crea regla.

### PATCH /api/rules/:id

Actualiza.

### DELETE /api/rules/:id

Elimina.

## 21.6. Propuestas

### POST /api/processes/:id/proposals/generate

Genera propuestas.

### GET /api/processes/:id/proposals

Lista propuestas.

### GET /api/proposals/:id

Detalle.

### PATCH /api/proposals/:id/assignments

Edita asignaciones.

### POST /api/proposals/:id/recalculate

Recalcula.

### POST /api/proposals/:id/approve

Aprueba propuesta final.

## 21.7. Exportaciones

### GET /api/proposals/:id/export/excel

Excel.

### GET /api/proposals/:id/export/pdf

PDF.

### GET /api/processes/:id/export/sociogram

Sociograma.

---

# 22. Tecnología recomendada

## 22.1. Frontend

- Next.js 15
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Query
- Cytoscape.js

## 22.2. Backend

Opción A:

- Next.js API routes

Suficiente para MVP.

Opción B:

- FastAPI
- Python

Mejor si el algoritmo con OR-Tools se ejecuta en backend Python.

## 22.3. Base de datos

- PostgreSQL
- Supabase como opción rápida

## 22.4. Autenticación

- Supabase Auth
- Google Workspace OAuth
- Microsoft OAuth
- Email/password

## 22.5. Importación Excel

Librerías:

- xlsx
- exceljs

## 22.6. Exportación PDF

Librerías:

- React PDF
- Puppeteer
- Playwright PDF

## 22.7. Algoritmo

- Google OR-Tools
- Python recomendado

## 22.8. Hosting

MVP:

- Vercel para frontend.
- Supabase para base de datos.
- Railway / Render / Fly.io para backend Python.

---

# 23. Privacidad y RGPD

## 23.1. Datos sensibles

El sistema trata:

- Datos de menores.
- Datos académicos.
- Datos sociales.
- Posibles datos de necesidades educativas.
- Relaciones personales.

Debe tratarse como información confidencial.

## 23.2. Principios

- Minimización de datos.
- Acceso restringido.
- Cifrado en tránsito.
- Cifrado en reposo si es posible.
- Registro de accesos.
- Eliminación de datos bajo petición.
- Procesos archivables.
- Separación por centro.

## 23.3. Restricciones de visualización

Los alumnos no deben ver:

- Quién los ha elegido.
- Sociogramas.
- Resultados.
- Reglas.
- Informes.

Los tutores solo ven lo que su rol permita.

Orientación puede ver más datos, pero debe quedar registrado.

## 23.4. Auditoría

Registrar:

- Usuario que importa alumnos.
- Usuario que crea reglas.
- Usuario que ve informes sensibles.
- Usuario que genera propuestas.
- Usuario que exporta datos.
- Fecha y hora.
- Acción realizada.

---

# 24. Fases de desarrollo

## Fase 1 - MVP básico

Objetivo:

Crear una versión funcional mínima.

Incluye:

- Login admin.
- Crear proceso.
- Importar alumnos por Excel.
- Crear cuestionario.
- Responder cuestionario.
- Ver respuestas.
- Crear sociograma básico.
- Crear reglas simples.
- Generar mezcla básica.
- Exportar Excel.

## Fase 2 - Sociograma avanzado

Incluye:

- Cytoscape.js.
- Métricas sociales.
- Detección de aislados.
- Detección de relaciones recíprocas.
- Detección de subgrupos.
- Exportación PNG/PDF.
- Informe de sociograma.

## Fase 3 - Algoritmo avanzado

Incluye:

- OR-Tools.
- Pesos configurables.
- Propuestas múltiples.
- Comparador.
- Simulador social.
- Reglas complejas.

## Fase 4 - Informes y edición manual

Incluye:

- Drag & drop.
- Impacto en tiempo real.
- Informes PDF.
- Historial de versiones.
- Recalcular desde ajustes.

## Fase 5 - Producto completo

Incluye:

- Multi-centro.
- Roles avanzados.
- Licencias.
- Auditoría completa.
- IA explicativa.
- Históricos por curso.
- Plantillas de configuración.

---

# 25. MVP recomendado para empezar

No intentar construir todo al principio.

Primera versión realista:

1. Login admin.
2. Crear proceso.
3. Importar Excel.
4. Configurar cuestionario simple.
5. Generar enlace.
6. Recoger elecciones.
7. Crear sociograma básico.
8. Configurar reglas de no juntar.
9. Generar dos clases equilibradas.
10. Exportar Excel.

Después mejorar.

---

# 26. Instrucciones para Codex

## 26.1. Crear proyecto

Crear una aplicación Next.js 15 con TypeScript.

Usar:

- Tailwind CSS.
- shadcn/ui.
- Supabase.
- PostgreSQL.
- TanStack Query.
- React Hook Form.
- Zod.
- Cytoscape.js.
- xlsx.

## 26.2. Estructura de carpetas

Propuesta:

```txt
/src
  /app
    /(auth)
    /(dashboard)
    /q
    /api
  /components
    /students
    /questionnaire
    /sociogram
    /rules
    /proposals
    /exports
  /lib
    /db
    /auth
    /excel
    /algorithm
    /sociogram
    /pdf
  /types
  /schemas
  /hooks
  /utils
```

## 26.3. Crear modelos TypeScript

Crear tipos para:

- User.
- Center.
- Process.
- Student.
- QuestionnaireSettings.
- Response.
- Rule.
- Proposal.
- Assignment.
- SociogramNode.
- SociogramEdge.
- SociogramMetric.

## 26.4. Crear pantallas

Crear estas pantallas:

- Login.
- Dashboard.
- Procesos.
- Crear proceso.
- Detalle de proceso.
- Importar alumnos.
- Alumnos.
- Cuestionario.
- Respuestas.
- Sociograma.
- Reglas.
- Algoritmo.
- Propuestas.
- Exportaciones.

## 26.5. Crear algoritmo inicial simple

Para el MVP, si OR-Tools tarda en integrarse, crear un algoritmo heurístico inicial:

1. Ordenar alumnos por nota.
2. Repartir alternativamente para equilibrar media.
3. Ajustar género.
4. Corregir conflictos.
5. Intentar mantener al menos una amistad.
6. Calcular puntuación.
7. Repetir varias veces con aleatorización.
8. Devolver las mejores propuestas.

Más adelante sustituir por OR-Tools.

## 26.6. Crear sociograma inicial

Entrada:

- Lista de alumnos.
- Lista de respuestas.

Salida:

- Nodos.
- Aristas.
- Métricas simples.

Métricas iniciales:

- Elecciones recibidas.
- Elecciones dadas.
- Relaciones recíprocas.
- Alumnos sin elecciones recibidas.

## 26.7. Crear exportación Excel

Debe exportar:

- Clase destino.
- Nombre.
- Apellidos.
- Clase origen.
- Género.
- Nota.
- Nivel.
- Observaciones.

---

# 27. Criterios de calidad

La aplicación debe ser:

- Clara.
- Segura.
- Fácil de usar.
- Visual.
- Explicable.
- Revisable.
- Configurable.
- Exportable.

No debe ser una caja negra.

---

# 28. Riesgos del proyecto

## Riesgo 1

Usar datos sociales de menores de forma inadecuada.

Solución:

Privacidad estricta.

## Riesgo 2

Que el algoritmo tome decisiones injustas.

Solución:

Revisión humana obligatoria.

## Riesgo 3

Que se interpreten mal los sociogramas.

Solución:

Mostrarlos como herramienta orientativa, no diagnóstica.

## Riesgo 4

Que el profesorado no confíe en la mezcla.

Solución:

Explicar cada propuesta con métricas claras.

## Riesgo 5

Que haya reglas incompatibles.

Solución:

Sistema de validación y explicación de conflictos.

---

# 29. Frase de producto

ClassMixer ayuda a los centros educativos a crear clases equilibradas combinando datos académicos, criterios docentes y análisis sociométrico, siempre con supervisión humana.

---

# 30. Resultado esperado

Al finalizar el desarrollo, el centro podrá:

1. Subir un Excel con alumnos.
2. Enviar un cuestionario sociométrico.
3. Ver sociogramas.
4. Detectar alumnos aislados.
5. Configurar reglas.
6. Generar propuestas de nuevas clases.
7. Comparar alternativas.
8. Ajustar manualmente.
9. Exportar la distribución final.

---

# 31. Nota final

El valor diferencial del proyecto no está solo en mezclar clases.

El verdadero valor está en combinar:

- Sociograma.
- Reglas docentes.
- Datos académicos.
- Algoritmo de equilibrio.
- Revisión humana.
- Informes comprensibles.

Eso convierte la herramienta en una plataforma profesional de análisis y organización escolar.

---

# 32. Plan de desarrollo estructurado

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind + shadcn/ui |
| Estado servidor | TanStack Query |
| Formularios | React Hook Form + Zod |
| Grafos | Cytoscape.js |
| Backend | Next.js API Routes (MVP) → FastAPI Python (algoritmo avanzado) |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth + OAuth (Google / Microsoft) |
| Excel | xlsx |
| PDF | React PDF / Puppeteer |
| Algoritmo avanzado | Google OR-Tools (Python) |
| Hosting | Vercel + Supabase + Railway |

---

## Estructura de carpetas

```
/src
  /app
    /(auth)              → login, register
    /(dashboard)         → área privada admin/tutor
    /q/[token]           → cuestionario público alumnos
    /api                 → API routes Next.js
  /components
    /ui                  → shadcn/ui base
    /students
    /questionnaire
    /sociogram
    /rules
    /proposals
    /exports
  /lib
    /db                  → Supabase client + queries
    /auth                → middleware + roles
    /excel               → import/export xlsx
    /algorithm           → heurística MVP
    /sociogram           → cálculo de métricas
    /pdf                 → generación PDF
  /types                 → tipos TypeScript globales
  /schemas               → schemas Zod
  /hooks                 → custom hooks TanStack Query
  /utils
```

---

## Orden de implementación

```
Semana 1-2   → Setup + DB + Auth + Layout base
Semana 3-4   → Procesos + Importación Excel
Semana 5-6   → Cuestionario (admin + página pública alumno)
Semana 7-8   → Sociograma básico + Algoritmo heurístico + Exportación Excel
Semana 9-11  → Sociograma avanzado (Fase 2)
Semana 12-14 → OR-Tools + Reglas complejas + Comparador (Fase 3)
Semana 15-17 → Editor drag & drop + Informes PDF (Fase 4)
Semana 18+   → Multi-centro + Licencias + Roles avanzados (Fase 5)
```

---

## FASE 1 — Fundación y MVP funcional

### 1.1 Setup del proyecto
- [ ] npx create-next-app@15 con TypeScript + Tailwind
- [ ] Instalación y configuración de shadcn/ui
- [ ] Configuración Supabase (proyecto, env vars)
- [ ] Middleware de autenticación y protección de rutas
- [ ] Layout base del dashboard (sidebar, navbar, breadcrumbs)

### 1.2 Base de datos — Migración inicial
Tablas en orden de dependencia:
```
centers → users → processes → students
→ questionnaire_settings → questionnaire_tokens
→ responses → rules → rule_students
→ proposals → proposal_assignments
→ proposal_metrics → sociogram_metrics → audit_logs
```
- [ ] Migraciones SQL en Supabase
- [ ] Row Level Security (RLS) por center_id
- [ ] Tipos TypeScript generados desde esquema DB

### 1.3 Autenticación y roles
- [ ] Login con email/password (Supabase Auth)
- [ ] Middleware de roles: superadmin | admin | tutor | orientador | alumno
- [ ] Guard de acceso por rol en cada ruta
- [ ] Registro de audit_log en acciones sensibles

### 1.4 Gestión de procesos
- [ ] Pantalla listado de procesos (con estados visuales)
- [ ] Formulario crear proceso (nombre, nivel, grupos origen/destino, fechas)
- [ ] Máquina de estados: borrador → cuestionario_abierto → ... → archivado
- [ ] Dashboard con métricas generales

### 1.5 Importación de alumnos
- [ ] Componente drag-and-drop para subir Excel
- [ ] Parser xlsx + validaciones (IDs duplicados, columnas obligatorias, nota numérica)
- [ ] Pantalla de revisión previa: resumen, errores, advertencias, distribución
- [ ] Descarga de plantilla Excel
- [ ] Confirmación e inserción en DB
- [ ] Tabla de alumnos con filtros

### 1.6 Cuestionario sociométrico
- [ ] Configuración: activar preguntas, máximos por tipo, modo de acceso
- [ ] Generación de tokens individuales por alumno
- [ ] Generación de QR y enlace general
- [ ] Ruta pública /q/[token] accesible sin login
- [ ] Interfaz alumno: búsqueda de compañeros, selección, envío
- [ ] Panel de seguimiento admin: % completado, pendientes

### 1.7 Sociograma básico
- [ ] Cálculo de métricas: elecciones dadas/recibidas, relaciones recíprocas
- [ ] Visualización con Cytoscape.js: nodos + aristas
- [ ] Tamaño de nodo proporcional a elecciones recibidas
- [ ] Color por clase de origen
- [ ] Detección básica de alumnos sin elecciones recibidas

### 1.8 Reglas simples
- [ ] CRUD de reglas: must_separate y lock_student_to_class
- [ ] Asignación de alumnos a regla
- [ ] Visualización de reglas activas por proceso

### 1.9 Algoritmo heurístico MVP
Lógica:
1. Ordenar alumnos por nota_media
2. Distribución snake para equilibrar medias
3. Ajuste de género por ronda
4. Aplicar separaciones obligatorias
5. Intentar mantener al menos una amistad recíproca por alumno
6. Repetir N veces con seed aleatorio, evaluar y devolver top 3

- [ ] Implementación en /lib/algorithm
- [ ] Cálculo de puntuación por propuesta
- [ ] Persistencia de propuestas en DB

### 1.10 Vista de propuestas y exportación Excel
- [ ] Tarjetas de propuestas con métricas clave
- [ ] Vista detalle por clase
- [ ] Exportación Excel: clase destino, nombre, apellidos, origen, género, nota, nivel, observaciones

---

## FASE 2 — Sociograma avanzado

- [ ] Layouts Cytoscape.js configurables (cose, cola, dagre)
- [ ] Color del nodo por género / clase / nivel / comunidad / riesgo
- [ ] Grosor de arista proporcional a fuerza de relación
- [ ] Tipos de arista diferenciados visualmente
- [ ] Tooltip hover con datos del alumno
- [ ] Filtros avanzados del grafo
- [ ] Centralidad de grado e intermediación (betweenness)
- [ ] Detección de comunidades (Louvain)
- [ ] Detecciones: aislado, vulnerable, líder, puente, subgrupo cerrado
- [ ] Panel de alertas con severidad
- [ ] Exportación PNG, PDF analítico, Excel métricas

---

## FASE 3 — Algoritmo avanzado OR-Tools

- [ ] Microservicio FastAPI con OR-Tools (CP-SAT)
- [ ] Variables binarias x[alumno][clase]
- [ ] Restricciones duras: tamaño, separaciones, bloqueos
- [ ] Restricciones blandas penalizadas con pesos configurables
- [ ] Generación de hasta 10 propuestas con seeds distintos
- [ ] Perfiles predefinidos: equilibrado / social / académico / convivencia
- [ ] Reglas complejas: keep_at_least_one, max_from_group, protect_vulnerable, exclude_student
- [ ] Comparador side-by-side de propuestas
- [ ] Sociograma futuro simulado por propuesta
- [ ] Diagnóstico de infactibilidad con explicación en lenguaje natural

---

## FASE 4 — Edición manual e informes PDF

- [ ] Editor drag & drop (kanban: columnas = clases, tarjetas = alumnos)
- [ ] Impacto en tiempo real al mover alumno (delta nota, género, amistades, reglas)
- [ ] Bloqueos manuales desde el editor
- [ ] Historial de versiones + restaurar versión
- [ ] Informe PDF para dirección (resumen ejecutivo)
- [ ] Informe PDF para tutores por clase
- [ ] Informe PDF para orientación (datos sensibles, requiere rol)
- [ ] Informe PDF de sociograma con imagen del grafo
- [ ] Flujo de aprobación final con confirmación explícita + audit_log

---

## FASE 5 — Producto completo SaaS

- [ ] Superadmin: gestión de centros y licencias
- [ ] Aislamiento total de datos por center_id (RLS estricto)
- [ ] Límites por licencia: nº procesos, nº alumnos, módulos activos
- [ ] Tutor ve solo sus grupos asignados
- [ ] Orientador con acceso a datos sensibles + registro obligatorio
- [ ] Panel de auditoría completo para admin del centro
- [ ] Históricos inter-anuales: comparar sociogramas de distintos cursos
- [ ] IA explicativa opcional: resúmenes automáticos de alertas y propuestas

---

## Dependencias críticas

| Dependencia | Riesgo |
|---|---|
| Supabase RLS bien configurado desde el inicio | Alto — hacerlo luego es muy costoso |
| Separación algoritmo en microservicio Python | Medio — puede deferirse al MVP |
| Cytoscape.js en Next.js (requiere dynamic import + ssr:false) | Bajo — solución conocida |
| Generación PDF con imagen del sociograma en Vercel | Medio — Puppeteer tiene restricciones en serverless |

---

## Principios transversales no negociables

1. **Privacidad por diseño**: RLS activado desde el día 1. Los alumnos nunca acceden a datos de otros.
2. **Audit log automático**: toda acción sobre datos sensibles queda registrada.
3. **El algoritmo propone, el humano decide**: ninguna acción es irreversible sin confirmación explícita.
4. **Transparencia**: cada propuesta explica métricas, reglas cumplidas e incumplidas.
5. **Infactibilidad explicada**: si no hay solución, el sistema dice por qué, no falla en silencio.
