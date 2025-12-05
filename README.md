# Overload Timer

Overload Timer es un módulo para Foundry VTT que permite mostrar una animación global, iniciar un temporizador visible para todos los jugadores y gestionar automáticamente música y efectos de sonido durante el proceso. Está diseñado para escenas de tensión, cuenta atrás dramáticas o eventos especiales dentro de la partida.

El módulo es completamente sincronizado mediante sockets, por lo que todos los jugadores ven la misma animación y temporizador aunque no sean ellos quienes ejecuten el comando.

---

## Características

### Animación de inicio
Al iniciar el overload:
- La imagen aparece desde la izquierda.
- Se detiene en el centro.
- Se desplaza hacia la derecha y desaparece.
- El temporizador comienza automáticamente después de la animación.

### Temporizador global
- Visible para todos los jugadores.
- Ubicado en la parte superior central de la pantalla.
- Por defecto dura 3 minutos.
- Puede iniciarse con cualquier duración en segundos.
- Parpadeo en rojo durante el último minuto.
- Al llegar a 0 dispara la animación final correspondiente.

### Finalización automática
Al agotarse el temporizador:
- Se reproduce un efecto sonoro de finalización.
- Se muestra una animación de “overload finish”.
- Se restaura la música que estaba sonando previamente (si existía).

### Cancelación manual
En cualquier momento se puede cancelar:
- Reproduce un sonido distinto (rotura).
- Muestra la animación “overload cancel”.
- Se restablece la música original.

### Gestión de audio
El módulo:
- Guarda y detiene la música que estuviera sonando antes (excepto su propia playlist).
- Reproduce una pista principal mientras está activo el overload.
- Nunca restaura la música del propio módulo.
- Restablece la música previa al terminar o cancelar.

### Permisos configurables
En las opciones del mundo se puede definir:
- Rol mínimo requerido para ejecutar comandos.
- Lista de usuarios autorizados por nombre.

---

## Instalación

### Instalación mediante manifest URL
En Foundry VTT:
1. Abrir **Add-on Modules**.
2. Pulsar **Install Module**.
3. Introducir esta URL "https://raw.githubusercontent.com/X14-lab/overload-timer/refs/heads/main/module.json" en **Manifest URL**:

