# ClassMixer OR-Tools Solver

Microservicio Python con OR-Tools CP-SAT para generación óptima de propuestas de mezcla.

## Despliegue en Railway

1. Crea un nuevo servicio en [railway.app](https://railway.app)
2. Conecta este repositorio y selecciona el directorio `python-solver`
3. Railway detecta el Dockerfile automáticamente
4. Copia la URL pública del servicio (ej. `https://classmixer-solver.up.railway.app`)
5. En Vercel, añade la variable de entorno: `PYTHON_SERVICE_URL=https://classmixer-solver.up.railway.app`

## Despliegue en Render

1. New Web Service → conecta el repo → Root Directory: `python-solver`
2. Runtime: Docker
3. Igual que arriba para la variable de entorno

## Desarrollo local

```bash
cd python-solver
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

La API estará en `http://localhost:8000`. Docs en `http://localhost:8000/docs`.

## Cómo funciona

Sin `PYTHON_SERVICE_URL` configurada, ClassMixer usa su algoritmo heurístico interno.
Con la variable configurada, llama al solver OR-Tools que usa CP-SAT para encontrar
la distribución óptima respetando todas las restricciones.
