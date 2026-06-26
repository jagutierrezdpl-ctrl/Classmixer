-- Configuración de tamaños variables por grupo cooperativo.
-- group_sizes almacena un array JSON de enteros, p.ej. [4,4,4,3,3,3].
-- Cada elemento es el número de alumnos asignado a ese grupo (en orden).
-- Si está presente, reemplaza la lógica de num_groups + max_per_group.
-- num_groups y max_per_group se mantienen por compatibilidad con sesiones
-- existentes que no tengan group_sizes configurado.
alter table group_sessions
  add column if not exists group_sizes jsonb;
